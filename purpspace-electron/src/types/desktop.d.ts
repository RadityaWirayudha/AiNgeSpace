/**
 * Contract between the Electron preload bridge and the renderer.
 *
 * This file is the single source of truth for both sides: `electron/preload.ts`
 * imports these types, and the renderer sees `window.purpspace` through the
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

export type DirectoryProblem =
  /** Nothing at this path. */
  | "missing"
  /** Something is there, but a terminal cannot start in it. */
  | "not-directory"
  /** It exists and the OS will not let us look. */
  | "denied"

/**
 * What the main process found at a path. `ok` decides whether a workspace may
 * point at it; the rest exists so the user can be told *where they actually
 * are* rather than only that they are wrong.
 */
export interface DirectoryProbe {
  /** The path as the OS spells it: `~` expanded, separators canonical. The
   *  renderer adopts this so the field matches the file explorer exactly. */
  path: string
  ok: boolean
  /** Null when `ok`. */
  reason: DirectoryProblem | null
  /** Deepest ancestor that does exist — equal to `path` when `ok`. Empty only
   *  if even the root is gone (a disconnected network drive). */
  nearest: string
  /** Sub-folder names directly inside `nearest`, alphabetical, capped. */
  children: string[]
  /** True when `children` was cut short. */
  more: boolean
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
  /**
   * The user's home folder, as the OS spells it. Travels as an env var rather
   * than an IPC call so the working-folder field can be seeded during the first
   * render instead of after an effect.
   */
  readonly homeDir: string
  terminal: DesktopTerminalApi
  /** Opens a URL in the user's real browser instead of inside the app window. */
  openExternal(url: string): Promise<boolean>
  /**
   * Opens the OS folder picker and resolves to an absolute path, or null if the
   * user cancelled. `defaultPath` only suggests where to start.
   */
  chooseDirectory(defaultPath?: string): Promise<string | null>
  /**
   * Checks a path against the real filesystem. Never rejects — a path that
   * cannot be read comes back as a `DirectoryProbe` explaining why.
   */
  probeDirectory(path: string): Promise<DirectoryProbe>
  /**
   * Fires for every `purpspace://…` URL the OS hands to the app — currently the
   * sign-in ticket coming back from the browser. Returns an unsubscribe
   * function. A link that arrives before the renderer subscribes is buffered by
   * the main process and replayed on the first subscription.
   */
  onDeepLink(cb: (url: string) => void): () => void
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    purpspace?: DesktopBridge
  }
}
