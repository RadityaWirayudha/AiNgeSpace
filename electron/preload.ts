import { contextBridge, ipcRenderer } from "electron"
import { CH } from "./channels"
import type {
  DesktopBridge,
  DirectoryProbe,
  TerminalCreateOptions,
  TerminalCreateResult,
  TerminalExitPayload,
} from "../src/types/desktop"

type DataCb = (data: string) => void
type ExitCb = (payload: TerminalExitPayload) => void
type LinkCb = (url: string) => void

// One ipcRenderer listener per channel, fanned out here. Registering a listener
// per terminal would hit Electron's max-listeners warning once a workspace has
// a dozen panes open.
const dataSubs = new Map<string, Set<DataCb>>()
const exitSubs = new Map<string, Set<ExitCb>>()

ipcRenderer.on(CH.terminalData, (_e, id: string, data: string) => {
  const subs = dataSubs.get(id)
  if (!subs) return
  for (const cb of subs) cb(data)
})

ipcRenderer.on(CH.terminalExit, (_e, id: string, payload: TerminalExitPayload) => {
  const subs = exitSubs.get(id)
  if (!subs) return
  for (const cb of subs) cb(payload)
})

// Deep links are not addressed to a terminal, so they get their own flat set.
// A link can land before React has mounted the subscriber — the auth callback
// arrives from a browser the user may have been sitting in for a minute — so an
// unclaimed URL is held here and replayed to the first subscriber. Without this
// the sign-in ticket would be dropped and the window would sit there signed out
// with no error to explain it.
const linkSubs = new Set<LinkCb>()
let pendingLink: string | null = null

ipcRenderer.on(CH.deepLink, (_e, url: string) => {
  if (linkSubs.size === 0) {
    pendingLink = url
    return
  }
  for (const cb of linkSubs) cb(url)
})

function subscribe<T extends DataCb | ExitCb>(
  store: Map<string, Set<T>>,
  id: string,
  cb: T
): () => void {
  let set = store.get(id)
  if (!set) {
    set = new Set()
    store.set(id, set)
  }
  set.add(cb)
  return () => {
    const current = store.get(id)
    if (!current) return
    current.delete(cb)
    if (current.size === 0) store.delete(id)
  }
}

const bridge: DesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  appVersion: process.env.BM_APP_VERSION ?? "0.0.0",
  // Set by the main process before the window is created. `os` is not reachable
  // from a sandboxed preload, so it travels as an env var the same way the app
  // version already does.
  osBuild: Number(process.env.BM_OS_BUILD ?? "0") || 0,
  // Same route as the two above: `os.homedir()` is not reachable from a
  // sandboxed preload, so the main process hands it over as an env var.
  homeDir: process.env.BM_HOME_DIR ?? "",
  terminal: {
    create: (id: string, opts?: TerminalCreateOptions): Promise<TerminalCreateResult> =>
      ipcRenderer.invoke(CH.terminalCreate, id, opts ?? {}),
    write: (id: string, data: string) => ipcRenderer.send(CH.terminalWrite, id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send(CH.terminalResize, id, cols, rows),
    kill: (id: string) => ipcRenderer.send(CH.terminalKill, id),
    onData: (id: string, cb: DataCb) => subscribe(dataSubs, id, cb),
    onExit: (id: string, cb: ExitCb) => subscribe(exitSubs, id, cb),
  },
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(CH.openExternal, url),
  chooseDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke(CH.chooseDirectory, defaultPath),
  probeDirectory: (path: string): Promise<DirectoryProbe> =>
    ipcRenderer.invoke(CH.probeDirectory, path),
  onDeepLink: (cb: LinkCb) => {
    linkSubs.add(cb)
    if (pendingLink !== null) {
      const replay = pendingLink
      pendingLink = null
      // Deliver out of band so the caller finishes subscribing (and React
      // finishes its effect) before the callback runs.
      queueMicrotask(() => cb(replay))
    }
    return () => {
      linkSubs.delete(cb)
    }
  },
}

contextBridge.exposeInMainWorld("bridgemind", bridge)
