import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import type { IPty } from "node-pty"
import type {
  TerminalCreateOptions,
  TerminalCreateResult,
} from "../src/types/desktop"

// Required from the main process only. Requiring it at module scope in a
// sandboxed preload would fail, which is exactly why the PTY lives here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodePty = require("node-pty") as typeof import("node-pty")

interface Session {
  pty: IPty
  shell: string
  cwd: string
}

const MAX_SESSIONS = 64
/** A runaway process can emit megabytes per second; drop anything absurd rather
 *  than wedging the renderer's IPC queue. */
const MAX_CHUNK = 512 * 1024
const MAX_WRITE = 64 * 1024

function defaultShell(): { file: string; args: string[] } {
  if (process.platform === "win32") {
    const root = process.env.SystemRoot ?? "C:\\Windows"
    const ps = join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    return {
      file: existsSync(ps) ? ps : "powershell.exe",
      // -NoLogo keeps the pane clean; the profile is honoured so the user's
      // aliases and prompt work like they do in Windows Terminal.
      args: ["-NoLogo"],
    }
  }
  return { file: process.env.SHELL ?? "/bin/bash", args: [] }
}

function isDirectory(p: string | undefined): p is string {
  if (!p) return false
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function clampDim(value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback
  return Math.min(500, Math.max(2, n))
}

export class PtyManager {
  private sessions = new Map<string, Session>()

  constructor(
    private readonly fallbackCwd: string,
    private readonly emit: (
      channel: "data" | "exit",
      id: string,
      payload: unknown
    ) => void
  ) {}

  create(id: string, opts: TerminalCreateOptions = {}): TerminalCreateResult {
    if (typeof id !== "string" || !id || id.length > 128) {
      return { ok: false, error: "invalid terminal id" }
    }

    const existing = this.sessions.get(id)
    if (existing) {
      // Re-attaching (React strict-mode double mount, or a remount after a
      // layout change) must not orphan the running shell.
      return {
        ok: true,
        pid: existing.pty.pid,
        shell: existing.shell,
        cwd: existing.cwd,
      }
    }

    if (this.sessions.size >= MAX_SESSIONS) {
      return { ok: false, error: `terminal limit reached (${MAX_SESSIONS})` }
    }

    const { file, args } = defaultShell()
    const cwd = isDirectory(opts.cwd) ? opts.cwd : this.fallbackCwd

    try {
      const pty = nodePty.spawn(file, args, {
        name: "xterm-256color",
        cols: clampDim(opts.cols, 80),
        rows: clampDim(opts.rows, 24),
        cwd,
        env: { ...process.env } as Record<string, string>,
        useConpty: process.platform === "win32",
      })

      pty.onData((data) => {
        this.emit("data", id, data.length > MAX_CHUNK ? data.slice(0, MAX_CHUNK) : data)
      })

      pty.onExit(({ exitCode, signal }) => {
        this.sessions.delete(id)
        this.emit("exit", id, { exitCode, signal })
      })

      this.sessions.set(id, { pty, shell: file, cwd })
      return { ok: true, pid: pty.pid, shell: file, cwd }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  write(id: string, data: string): void {
    if (typeof data !== "string" || data.length > MAX_WRITE) return
    this.sessions.get(id)?.pty.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id)
    if (!session) return
    try {
      session.pty.resize(clampDim(cols, 80), clampDim(rows, 24))
    } catch {
      // The shell can exit between the fit() and this call.
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return
    this.sessions.delete(id)
    try {
      session.pty.kill()
    } catch {
      // Already gone.
    }
  }

  /** Called on `will-quit`; without it ConPTY leaves orphaned conhost children. */
  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }
}
