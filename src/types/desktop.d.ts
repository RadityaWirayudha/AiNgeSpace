/**
 * Contract between the Electron preload bridge and the renderer.
 *
 * This file is the single source of truth for both sides: `electron/preload.ts`
 * imports these types, and the renderer sees `window.bridgemind` through the
 * global augmentation below. Keep the surface narrow — the whole point of the
 * bridge is that the renderer never touches `spawn` or `ipcRenderer` directly.
 */

export interface TerminalCreateOptions {
  cols?: number
  rows?: number
  /** Absolute path. Ignored by the main process if it is not an existing directory. */
  cwd?: string
}

export interface TerminalCreateResult {
  ok: boolean
  pid?: number
  shell?: string
  cwd?: string
  error?: string
}

export interface TerminalExitPayload {
  exitCode: number
  signal?: number
}

export interface DesktopTerminalApi {
  create(id: string, opts?: TerminalCreateOptions): Promise<TerminalCreateResult>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  kill(id: string): void
  /** Returns an unsubscribe function. */
  onData(id: string, cb: (data: string) => void): () => void
  /** Returns an unsubscribe function. */
  onExit(id: string, cb: (payload: TerminalExitPayload) => void): () => void
}

export interface DesktopBridge {
  readonly isDesktop: true
  readonly platform: string
  readonly appVersion: string
  /**
   * Windows build number, or 0 elsewhere. xterm needs it to model ConPTY's
   * line-wrapping behaviour; without it, wrapped output reflows into garbage
   * the first time a pane is resized.
   */
  readonly osBuild: number
  terminal: DesktopTerminalApi
  /** Opens a URL in the user's real browser instead of inside the app window. */
  openExternal(url: string): Promise<boolean>
  /**
   * Opens the OS folder picker and resolves to an absolute path, or null if the
   * user cancelled. `defaultPath` only suggests where to start.
   */
  chooseDirectory(defaultPath?: string): Promise<string | null>
  /**
   * Fires for every `aingespace://…` URL the OS hands to the app — currently the
   * sign-in ticket coming back from the browser. Returns an unsubscribe
   * function. A link that arrives before the renderer subscribes is buffered by
   * the main process and replayed on the first subscription.
   */
  onDeepLink(cb: (url: string) => void): () => void
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    bridgemind?: DesktopBridge
  }
}
