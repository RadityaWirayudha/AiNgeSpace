import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { existsSync } from "node:fs"
import { join } from "node:path"

/**
 * The literal string the server binds to and the window loads. It has to be
 * `localhost` and not `127.0.0.1`, and the two must never diverge.
 *
 * Next 16.2.11 builds the URL it hands to a proxy/middleware function as
 * `${protocol}://${fetchHostname || "localhost"}:${port}` (next-server.js), and
 * in a standalone build that hostname is not populated — the middleware always
 * sees `http://localhost:<port>/`. `clerkMiddleware` echoes that URL back as
 * `x-middleware-rewrite` (its `decorateRequest` does `new URL(req.url)`), while
 * router-server compares the rewrite against an `initUrl` built from the *real*
 * HOSTNAME. With HOSTNAME=127.0.0.1 the origins differ, so Next classifies its
 * own rewrite as an external destination and http-proxies the request back to
 * `http://localhost:<port>/` — a self-proxy loop that ends in
 * `socket hang up (ECONNRESET)` and HTTP 500 on every route. Verified with
 * `DEBUG=next:router-server*`.
 *
 * Binding to `localhost` makes both sides agree. `localhost` stays loopback-only
 * (127.0.0.1 and ::1), so this does not widen the server's exposure.
 */
const HOST = "localhost"

/** Ask the OS for a free loopback port instead of guessing one. */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on("error", reject)
    // Probe the same hostname the server will bind, or the port could be free
    // on 127.0.0.1 and taken on ::1.
    probe.listen(0, HOST, () => {
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
  const url = `http://${HOST}:${port}`

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
      HOSTNAME: HOST,
    },
  })

  child.stdout?.on("data", (d: Buffer) => opts.onLog?.(d.toString().trimEnd()))
  child.stderr?.on("data", (d: Buffer) => opts.onLog?.(d.toString().trimEnd()))

  let exited: { code: number | null } | null = null
  child.on("exit", (code) => {
    exited = { code }
  })
  // Read through a function: control-flow analysis cannot see the assignment
  // inside the listener and would otherwise narrow `exited` to `null` here.
  const lastExit = (): { code: number | null } | null => exited

  try {
    await waitForServer(url, 45_000)
  } catch (err) {
    const crash = lastExit()
    if (crash) {
      throw new Error(
        `Next server exited early with code ${crash.code}. ${String(err)}`
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
