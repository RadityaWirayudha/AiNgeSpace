"use client"

import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import "@xterm/xterm/css/xterm.css"
import { cn } from "@/lib/utils"
import { acquirePtySession, releasePtySession } from "./pty-session"
import type { DesktopBridge } from "@/types/desktop"

interface TerminalPanelProps {
  isActive: boolean
  terminalId: string
  onFocus: () => void
}

const BANNER = [
  "\x1b[38;2;147;51;234m    _    _ _   _            \x1b[38;2;168;85;247m ___                    \x1b[0m",
  "\x1b[38;2;147;51;234m   / \\  (_) \\ | | __ _  ___ \x1b[38;2;168;85;247m/ __| _ __   __ _  ___ ___ \x1b[0m",
  "\x1b[38;2;168;85;247m  / _ \\ | |  \\| |/ _` |/ _ \\\x1b[38;2;192;132;252m\\__ \\| '_ \\ / _` |/ __/ _ \\\x1b[0m",
  "\x1b[38;2;192;132;252m / ___ \\| | |\\  | (_| |  __/\x1b[38;2;192;132;252m___) | |_) | (_| | (_|  __/\x1b[0m",
  "\x1b[38;2;126;34;206m/_/   \\_\\_|_| \\_|\\__, |\\___|\x1b[38;2;126;34;206m|____/| .__/ \\__,_|\\___\\___|\x1b[0m",
  "\x1b[38;2;126;34;206m                  |___/      \x1b[38;2;126;34;206m      |_|                  \x1b[0m",
]

const DIM = "\x1b[38;2;98;98;106m"
/** "live" orange from referensi.md §2 — reserved for things that need attention. */
const LIVE = "\x1b[38;2;224;129;60m"
const RESET = "\x1b[0m"

/** Resolve the CSS custom property to a real font stack — xterm measures glyphs
 *  on a canvas and cannot read `var(--font-geist-mono)`, so passing the var
 *  produced fallback metrics and misaligned columns. */
function resolveMonoFont(el: HTMLElement): string {
  const resolved = getComputedStyle(el)
    .getPropertyValue("--font-geist-mono")
    .trim()
  const stack = ['"Cascadia Code"', '"Fira Code"', "Menlo", "monospace"]
  return resolved ? [resolved, ...stack].join(", ") : stack.join(", ")
}

/**
 * Written in both modes, but only actually *visible* in the browser mock.
 *
 * ConPTY owns the whole screen buffer: it clears and repaints with absolute
 * cursor positioning on attach and on every resize, so anything drawn outside
 * the PTY's own model is wiped within a frame or two. Stripping the opening
 * `ESC[2J`/`ESC[H` was tried and does not survive the first resize repaint.
 * Making the banner stick in desktop mode means having the shell print it —
 * i.e. spawning PowerShell with `-NoLogo -NoExit -Command <banner>` — which
 * trades a cosmetic win for quoting risk in the one code path that must never
 * break. Left as-is deliberately.
 */
function writeBanner(term: Terminal, terminalId: string, live: boolean) {
  for (const line of BANNER) term.writeln(line)
  term.writeln("")
  term.writeln("  \x1b[38;2;168;85;247mAiNgeSpace Terminal\x1b[0m")
  term.writeln(
    live
      ? `  ${DIM}session ${terminalId} · attaching to your shell…${RESET}`
      : `  ${DIM}session ${terminalId} · type ${RESET}\x1b[38;2;110;168;254mhelp${RESET}${DIM} to begin${RESET}`
  )
  term.writeln("")
}

/**
 * Desktop path: raw bytes in both directions.
 *
 * There is deliberately no local line editor here — the PTY already owns
 * history, arrow keys, tab completion and Ctrl+C, and a second parser on top of
 * it would fight the shell.
 */
function attachPty(
  term: Terminal,
  desktop: DesktopBridge,
  terminalId: string,
  refit: () => void
): () => void {
  let disposed = false
  const input = term.onData((data) => desktop.terminal.write(terminalId, data))

  void acquirePtySession(desktop, terminalId, {
    cols: term.cols,
    rows: term.rows,
    onData: (data) => {
      if (!disposed) term.write(data)
    },
    onExit: ({ exitCode }) => {
      if (disposed) return
      term.writeln("")
      term.writeln(`  ${DIM}[process exited with code ${exitCode}]${RESET}`)
    },
  })
    .then((result) => {
      if (disposed) return
      if (!result.ok) {
        // Silently dead panes are the worst outcome; say why in the live colour.
        term.writeln(`  ${LIVE}shell failed to start: ${result.error ?? "unknown error"}${RESET}`)
        term.writeln("")
        return
      }
      // The first fit ran before the PTY existed, so its resize was dropped.
      refit()
    })
    .catch((err: unknown) => {
      if (disposed) return
      term.writeln(`  ${LIVE}shell bridge error: ${String(err)}${RESET}`)
      term.writeln("")
    })

  return () => {
    disposed = true
    input.dispose()
    releasePtySession(terminalId)
  }
}

/**
 * Browser path: the original canned shell, kept verbatim so `npm run dev` and
 * any future web build still look and behave the way they did.
 */
function attachMockShell(term: Terminal): () => void {
  const prompt = "\x1b[38;2;224;129;60m❯\x1b[0m "
  let line = ""
  const history: string[] = []
  let historyIdx = -1

  term.write(prompt)

  const run = (cmd: string) => {
    switch (true) {
      case cmd === "clear":
        term.clear()
        return
      case cmd === "help":
        term.writeln("  \x1b[38;2;168;85;247mCommands\x1b[0m")
        term.writeln("    clear     Clear the screen")
        term.writeln("    help      Show this help")
        term.writeln("    whoami    Print current user")
        term.writeln("    pwd       Print working directory")
        term.writeln("    ls        List files")
        term.writeln("    echo      Echo text")
        term.writeln("")
        return
      case cmd === "whoami":
        term.writeln("  developer")
        term.writeln("")
        return
      case cmd === "pwd":
        term.writeln("  ~/workspace")
        term.writeln("")
        return
      case cmd === "ls":
        term.writeln(
          "  \x1b[38;2;110;168;254msrc/\x1b[0m     \x1b[38;2;110;168;254mpublic/\x1b[0m   package.json"
        )
        term.writeln("  README.md  tsconfig.json  next.config.ts")
        term.writeln("")
        return
      case cmd.startsWith("echo "):
        term.writeln(`  ${cmd.slice(5)}`)
        term.writeln("")
        return
      default:
        term.writeln(
          `  \x1b[38;2;224;195;76m${cmd.split(" ")[0]}: not connected to a shell yet\x1b[0m`
        )
        term.writeln("")
    }
  }

  const disposable = term.onData((data) => {
    // Arrow keys arrive as escape sequences; the old handler let them through
    // the `data >= " "` branch and printed literal "[A" into the buffer.
    if (data === "\x1b[A" || data === "\x1b[B") {
      if (history.length === 0) return
      if (data === "\x1b[A") {
        historyIdx = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1)
      } else {
        if (historyIdx < 0) return
        historyIdx = historyIdx + 1
        if (historyIdx >= history.length) {
          historyIdx = -1
          term.write("\r\x1b[K" + prompt)
          line = ""
          return
        }
      }
      line = history[historyIdx] ?? ""
      term.write("\r\x1b[K" + prompt + line)
      return
    }
    // Swallow remaining control sequences (left/right/home/etc.).
    if (data.startsWith("\x1b")) return

    if (data === "\r") {
      const cmd = line.trim()
      term.writeln("")
      if (cmd) {
        history.push(cmd)
        run(cmd)
      }
      historyIdx = -1
      line = ""
      term.write(prompt)
      return
    }

    if (data === "\x7f") {
      if (line.length > 0) {
        line = line.slice(0, -1)
        term.write("\b \b")
      }
      return
    }

    // Ctrl+C
    if (data === "\x03") {
      term.writeln("^C")
      line = ""
      term.write(prompt)
      return
    }

    if (data >= " ") {
      line += data
      term.write(data)
    }
  })

  return () => disposable.dispose()
}

export function TerminalPanel({
  isActive,
  terminalId,
  onFocus,
}: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || terminalRef.current) return

    const term = new Terminal({
      fontFamily: resolveMonoFont(container),
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      // Reflow long output when the pane is resized instead of hard-wrapping
      // at the original width.
      convertEol: true,
      theme: {
        background: "#09090b",
        foreground: "#d4d4d8",
        cursor: "#e0813c",
        cursorAccent: "#09090b",
        selectionBackground: "rgba(224, 129, 60, 0.25)",
        selectionForeground: "#fafafa",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#6ea8fe",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#d4d4d8",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#93c5fd",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(container)

    fitAddonRef.current = fitAddon
    terminalRef.current = term

    // Present only inside the Electron shell; the web build gets the mock.
    const desktop = typeof window !== "undefined" ? window.bridgemind : undefined

    // fit() divides by the container size; calling it before the pane has been
    // laid out threw "dimensions of undefined" and left the grid 1 column wide.
    const safeFit = () => {
      const el = containerRef.current
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
      try {
        fitAddon.fit()
      } catch {
        // Container was torn down mid-measure.
        return
      }
      // The PTY has to track the visible grid, otherwise full-screen programs
      // (vim, less, git log) wrap against the wrong width.
      desktop?.terminal.resize(terminalId, term.cols, term.rows)
    }

    writeBanner(term, terminalId, Boolean(desktop))

    const detach = desktop
      ? attachPty(term, desktop, terminalId, safeFit)
      : attachMockShell(term)

    // ResizeObserver fires before the browser has finished painting the new
    // size; deferring to rAF avoids fitting against a stale box.
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(safeFit)
    })
    observer.observe(container)
    frame = requestAnimationFrame(safeFit)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      detach()
      term.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [terminalId])

  useEffect(() => {
    if (isActive) terminalRef.current?.focus()
  }, [isActive])

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      className={cn(
        "w-full h-full min-h-0 min-w-0 overflow-hidden bg-bm-terminal",
        !isActive && "opacity-90"
      )}
    />
  )
}
