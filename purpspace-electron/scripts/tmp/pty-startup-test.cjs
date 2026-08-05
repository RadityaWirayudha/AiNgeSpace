/**
 * Throwaway probe for two assumptions in `attachPty`:
 *   1. `cwd` reaches the shell.
 *   2. A command written immediately after spawn — no delay, no waiting for a
 *      prompt — still runs, because the pseudoconsole buffers stdin.
 *
 * Run with electron, not node: node-pty is built against Electron's ABI.
 *   npx electron scripts/tmp/pty-startup-test.cjs
 *
 * Forward slashes on purpose — no backslash escapes to get wrong.
 */

const { app, dialog } = require("electron")
const pty = require("node-pty")

const TARGET = "C:/Users/user/2026 3/PurpVoice"

app.whenReady().then(() => {
  // Never let a failure sit on a modal dialog waiting for a click.
  dialog.showErrorBox = (title, content) => console.error(`[${title}] ${content}`)

  let p
  try {
    p = pty.spawn("powershell.exe", ["-NoLogo", "-NoProfile"], {
      cols: 80,
      rows: 24,
      cwd: TARGET,
      useConpty: true,
    })
  } catch (err) {
    console.error("SPAWN FAILED:", err && err.message)
    app.exit(1)
    return
  }

  let out = ""
  p.onData((d) => {
    out += d
  })

  // Exactly what attachPty does: write straight away, then leave the shell
  // running — an `exit` in the same breath would race the output flush and make
  // the result look empty whether or not the command ran.
  p.write("Write-Output MARKER-OK\r")

  let finished = false
  const done = () => {
    if (finished) return
    finished = true
    const clean = out.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "")
    console.log("=== OUTPUT ===")
    console.log(clean.trim())
    console.log("=== END ===")
    console.log("cwd landed:", clean.includes("PurpVoice"))
    console.log("command ran:", clean.includes("MARKER-OK"))
    app.exit(0)
  }

  p.onExit(done)
  setTimeout(done, 8000)
})
