import { contextBridge, ipcRenderer } from "electron"
import { CH } from "./channels"
import type {
  DesktopBridge,
  TerminalCreateOptions,
  TerminalCreateResult,
  TerminalExitPayload,
} from "../src/types/desktop"

type DataCb = (data: string) => void
type ExitCb = (payload: TerminalExitPayload) => void

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
}

contextBridge.exposeInMainWorld("bridgemind", bridge)
