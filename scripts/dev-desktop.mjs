/**
 * Runs `next dev` and the Electron shell together without pulling in
 * `concurrently`. Electron is only started once the dev server answers, so the
 * window never opens onto a connection-refused page.
 */
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEV_URL = process.env.BM_DEV_URL ?? "http://localhost:3000"
const npx = process.platform === "win32" ? "npx.cmd" : "npx"

const children = []
let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

async function waitForDevServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (shuttingDown) return false
    try {
      await fetch(DEV_URL, { method: "GET", redirect: "manual" })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, 400))
    }
  }
  return false
}

console.log("[dev:desktop] starting next dev…")
const next = spawn(npx, ["next", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
})
children.push(next)
next.on("exit", (code) => shutdown(code ?? 0))

console.log("[dev:desktop] compiling electron/…")
const tsc = spawn(npx, ["tsc", "-p", "tsconfig.electron.json"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
})

tsc.on("exit", async (code) => {
  if (code !== 0) {
    console.error("[dev:desktop] electron typescript build failed")
    return shutdown(code ?? 1)
  }

  const ready = await waitForDevServer()
  if (!ready) {
    console.error(`[dev:desktop] ${DEV_URL} never came up`)
    return shutdown(1)
  }

  console.log("[dev:desktop] launching electron")
  const electron = spawn(npx, ["electron", "."], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BM_DEV_URL: DEV_URL },
  })
  children.push(electron)
  electron.on("exit", (c) => shutdown(c ?? 0))
})
