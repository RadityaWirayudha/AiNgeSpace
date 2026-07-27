import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { existsSync } from "node:fs"
import { join } from "node:path"

/** Ask the OS for a free loopback port instead of guessing one. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address()
      if (addr && typeof addr === "object") {
        const { port } = addr
        probe.close(() => resolve(port))
      } else {
        probe.close(() => reject(new Error("could not resolve a free port")))
      }
    })
  })
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      // Any HTTP response at all means the listener is up; a 404 or a redirect
      // from Clerk middleware is still "ready".
      await fetch(url, { method: "GET", redirect: "manual" })
      return
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  throw new Error(
    `Next server did not answer on ${url} within ${timeoutMs}ms (${String(lastError)})`
  )
}

export interface NextServerHandle {
  url: string
  stop: () => void
}

/**
 * Boots `.next/standalone/server.js` in a child process.
 *
 * A packaged app has no `node` binary of its own, so the Electron binary is
 * re-used as a plain Node runtime via ELECTRON_RUN_AS_NODE. This is the
 * supported trick and keeps the installer to a single executable.
 */
export async function startNextServer(opts: {
  standaloneDir: string
  env: Record<string, string>
  onLog?: (line: string) => void
}): Promise<NextServerHandle> {
  const serverJs = join(opts.standaloneDir, "server.js")
  if (!existsSync(serverJs)) {
    throw new Error(
      `standalone server not found at ${serverJs} — run \`npm run build:next\` first`
    )
  }

  const port = await findFreePort()
  const url = `http://127.0.0.1:${port}`

  const child: ChildProcess = spawn(process.execPath, [serverJs], {
    cwd: opts.standaloneDir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...opts.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
  })

  child.stdout?.on("data", (d: Buffer) => opts.onLog?.(d.toString().trimEnd()))
  child.stderr?.on("data", (d: Buffer) => opts.onLog?.(d.toString().trimEnd()))

  let exited: { code: number | null } | null = null
  child.on("exit", (code) => {
    exited = { code }
  })

  try {
    await waitForServer(url, 45_000)
  } catch (err) {
    if (exited) {
      throw new Error(
        `Next server exited early with code ${exited.code}. ${String(err)}`
      )
    }
    child.kill()
    throw err
  }

  return {
    url,
    stop: () => {
      if (!child.killed) child.kill()
    },
  }
}
