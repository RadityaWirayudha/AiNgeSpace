import { app, BrowserWindow, ipcMain, shell } from "electron"
import { join, resolve } from "node:path"
import { CH } from "./channels"
import { resolveRuntimeEnv } from "./env"
import { PtyManager } from "./pty-manager"
import { startNextServer, type NextServerHandle } from "./next-server"
import type { TerminalCreateOptions } from "../src/types/desktop"

// Must run before any getPath("userData") call so dev and packaged builds agree
// on %APPDATA%\BridgeMind instead of splitting into two config directories.
app.setName("BridgeMind")

const PROTOCOL = "aingespace"
const APP_BG = "#0e0e10" // --bg-app, referensi.md §2

/** Repo root when running from source; irrelevant once packaged.
 *  __dirname is <root>/dist-electron/electron, hence two levels up. */
const projectRoot = resolve(__dirname, "..", "..")
const isDev = !app.isPackaged
const devUrl = process.env.BM_DEV_URL ?? "http://localhost:3000"

let mainWindow: BrowserWindow | null = null
let nextServer: NextServerHandle | null = null
let ptyManager: PtyManager | null = null

process.env.BM_APP_VERSION = app.getVersion()

function log(...parts: unknown[]) {
  // Stays on stdout: visible in `npm run dev:desktop`, harmless when packaged.
  console.log("[bridgemind]", ...parts)
}

function standaloneDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "app-next")
    : join(projectRoot, ".next", "standalone")
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    // Painting the window in the app background avoids the white flash that a
    // default-coloured window shows for the first frame.
    backgroundColor: APP_BG,
    show: false,
    autoHideMenuBar: true,
    title: "BridgeMind",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // xterm's canvas renderer is materially smoother with this off.
      backgroundThrottling: false,
    },
  })

  win.once("ready-to-show", () => win.show())

  win.webContents.on("did-finish-load", flushDeepLinks)

  // Anything that is not the app itself belongs in the user's real browser —
  // in particular OAuth screens, which must never render inside the shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })

  win.webContents.on("will-navigate", (event, url) => {
    const target = new URL(url)
    const current = new URL(win.webContents.getURL() || "http://127.0.0.1")
    if (target.host !== current.host) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  win.on("closed", () => {
    mainWindow = null
  })

  return win
}

function registerIpc(manager: PtyManager) {
  ipcMain.handle(CH.terminalCreate, (_e, id: string, opts: TerminalCreateOptions) =>
    manager.create(id, opts ?? {})
  )
  ipcMain.on(CH.terminalWrite, (_e, id: string, data: string) => manager.write(id, data))
  ipcMain.on(CH.terminalResize, (_e, id: string, cols: number, rows: number) =>
    manager.resize(id, cols, rows)
  )
  ipcMain.on(CH.terminalKill, (_e, id: string) => manager.kill(id))

  ipcMain.handle(CH.openExternal, async (_e, url: string) => {
    // Only ever hand real web URLs to the OS — never file: or custom schemes.
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
      await shell.openExternal(parsed.toString())
      return true
    } catch {
      return false
    }
  })
}

/** URLs that arrived before a renderer existed to receive them. */
const queuedLinks: string[] = []

function flushDeepLinks() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  while (queuedLinks.length > 0) {
    const url = queuedLinks.shift()
    if (url) mainWindow.webContents.send(CH.deepLink, url)
  }
}

function forwardDeepLink(rawUrl: string) {
  // Carries the sign-in ticket back from the browser (see the /desktop-auth
  // page). `webContents.send` on a page that has not finished loading is
  // dropped silently, and a cold start *through* the protocol handler is
  // exactly that case, so anything that cannot be delivered now is queued and
  // replayed from `did-finish-load`.
  log("deep link:", rawUrl)
  queuedLinks.push(rawUrl)
  flushDeepLinks()
}

/** Windows hands the URL to a cold-started app as a plain argv entry. */
function deepLinkFromArgv(argv: string[]): string | undefined {
  return argv.find((a) => a.startsWith(`${PROTOCOL}://`))
}

async function boot() {
  const { vars, source } = resolveRuntimeEnv(projectRoot)
  log(source ? `env loaded from ${source}` : "no .env.local found — server routes will fail")

  const home = app.getPath("home")
  // Typing in a pane should land somewhere useful: the repo in dev, home in prod.
  const fallbackCwd = isDev ? projectRoot : home

  ptyManager = new PtyManager(fallbackCwd, (channel, id, payload) => {
    const target = channel === "data" ? CH.terminalData : CH.terminalExit
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(target, id, payload)
    }
  })
  registerIpc(ptyManager)

  mainWindow = createWindow()

  if (isDev) {
    log(`dev mode — loading ${devUrl}`)
    await mainWindow.loadURL(devUrl)
    return
  }

  try {
    nextServer = await startNextServer({
      standaloneDir: standaloneDir(),
      env: vars,
      onLog: (line) => log("next:", line),
    })
    log(`serving ${nextServer.url}`)
    await mainWindow.loadURL(nextServer.url)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log("failed to start Next server:", message)
    // A blank window with no explanation is the worst failure mode; render the
    // reason in the app's own palette instead.
    await mainWindow.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<body style="margin:0;background:${APP_BG};color:#d4d4d8;font:13px ui-monospace,monospace;padding:32px">
           <p style="color:#a855f7">BridgeMind could not start its local server.</p>
           <pre style="white-space:pre-wrap;color:#8a8a92">${message.replace(/[<&]/g, "")}</pre>
           </body>`
        )
    )
    mainWindow.show()
  }
}

// A second launch must focus the running window, not spawn a rival Next server.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const link = deepLinkFromArgv(argv)
    if (link) forwardDeepLink(link)
  })

  app.on("open-url", (event, url) => {
    event.preventDefault()
    forwardDeepLink(url)
  })

  app.whenReady().then(() => {
    if (isDev && process.platform === "win32") {
      // Unpackaged Windows needs the executable + script path spelled out.
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1] ?? ".")])
    } else {
      app.setAsDefaultProtocolClient(PROTOCOL)
    }
    // A cold start triggered by clicking the callback link carries the URL in
    // argv rather than through `second-instance`.
    const initialLink = deepLinkFromArgv(process.argv)
    if (initialLink) queuedLinks.push(initialLink)
    return boot()
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void boot()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })

  app.on("will-quit", () => {
    ptyManager?.killAll()
    nextServer?.stop()
  })
}
