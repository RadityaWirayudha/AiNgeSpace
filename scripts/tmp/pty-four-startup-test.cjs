/**
 * Throwaway probe for the 4-terminal preset: four PTYs spawned at once, each
 * written to immediately after spawn. Checks that no shell loses its startup
 * line when four pseudoconsoles come up together.
 *
 * Run with electron, not node: node-pty is built against Electron's ABI.
 *   npx electron scripts/tmp/pty-four-startup-test.cjs
 *
 * Forward slashes on purpose — no backslash escapes to get wrong.
 */

const { app, dialog } = require("electron")
const pty = require("node-pty")

const TARGET = "C:/Users/user/2026 3/PurpVoice"
const COUNT = 4

app.whenReady().then(() => {
  dialog.showErrorBox = (title, content) => console.error(`[${title}] ${content}`)

  const shells = []
  for (let i = 0; i < COUNT; i += 1) {
    let p
    try {
      p = pty.spawn("powershell.exe", ["-NoLogo", "-NoProfile"], {
        cols: 80,
        rows: 24,
        cwd: TARGET,
        useConpty: true,
      })
    } catch (err) {
      console.error(`SPAWN ${i} FAILED:`, err && err.message)
      app.exit(1)
      return
    }
    const rec = { i, p, out: "" }
    p.onData((d) => {
      rec.out += d
    })
    shells.push(rec)
    // Exactly what attachPty does: write straight away, no delay.
    p.write(`Write-Output MARKER-${i}-OK\r`)
  }

  let finished = false
  const done = () => {
    if (finished) return
    finished = true
    let allOk = true
    for (const rec of shells) {
      const clean = rec.out.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "")
      const cwdOk = clean.includes("PurpVoice")
      const cmdOk = clean.includes(`MARKER-${rec.i}-OK`)
      if (!cwdOk || !cmdOk) allOk = false
      console.log(`shell ${rec.i}: cwd=${cwdOk} command=${cmdOk}`)
    }
    console.log("all four ok:", allOk)
    app.exit(allOk ? 0 : 1)
  }

  setTimeout(done, 10000)
})
