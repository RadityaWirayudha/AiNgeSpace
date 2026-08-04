"use client"

/**
 * Every live `Terminal` in the app, owned outside the React tree.
 *
 * The reason this module exists: splitting a pane replaces a leaf node with a
 * brand-new split node, so React unmounts the component that was rendering that
 * terminal. When the terminal itself lived in component state, that unmount
 * disposed it — throwing away the xterm buffer, the scroll position and the
 * selection, then rebuilding all of it from a replay buffer on remount. Every
 * split, every maximize and every workspace switch paid that cost, and the
 * shell was killed outright if the remount did not happen in time.
 *
 * Here, React owns only a slot. `attachInstance` moves the terminal's host
 * element into that slot and `detachInstance` moves it back to a staging node;
 * neither touches the `Terminal`. A terminal is destroyed in exactly one place —
 * `disposeInstance` — which the store calls when the terminal is really gone.
 *
 * Note that xterm's `open()` is a no-op the second time it is called with a
 * different parent, so re-parenting *must* be done by moving the host node.
 */

import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import { ClipboardAddon } from "@xterm/addon-clipboard"
import { WebglAddon } from "@xterm/addon-webgl"
import "@xterm/xterm/css/xterm.css"
import { acquirePtySession, releasePtySession } from "./pty-session"
import { matchAction } from "./keybindings"
import type { DesktopBridge } from "@/types/desktop"

/* ------------------------------------------------------------------
   CONSTANTS
-------------------------------------------------------------------*/

/**
 * Chromium drops the least-recently-used WebGL context once a page holds too
 * many (~16), which would blank a terminal the user is still looking at. Cap
 * below that and let the overflow render through the DOM: slower, but correct.
 */
const MAX_WEBGL_CONTEXTS = 12

/**
 * ConPTY resize is expensive — it repaints the whole screen buffer — so the
 * grid is allowed to settle before the shell is told about it. Fits themselves
 * are not debounced; only the message to the PTY is.
 */
const PTY_RESIZE_DEBOUNCE_MS = 80

const BANNER = [
  "\x1b[38;2;147;51;234m    _    _ _   _            \x1b[38;2;168;85;247m ___                    \x1b[0m",
  "\x1b[38;2;147;51;234m   / \\  (_) \\ | | __ _  ___ \x1b[38;2;168;85;247m/ __| _ __   __ _  ___ ___ \x1b[0m",
  "\x1b[38;2;168;85;247m  / _ \\ | |  \\| |/ _` |/ _ \\\x1b[38;2;192;132;252m\\__ \\| '_ \\ / _` |/ __/ _ \\\x1b[0m",
  "\x1b[38;2;192;132;252m / ___ \\| | |\\  | (_| |  __/\x1b[38;2;192;132;252m___) | |_) | (_| | (_|  __/\x1b[0m",
  "\x1b[38;2;126;34;206m/_/   \\_\\_|_| \\_|\\__, |\\___|\x1b[38;2;126;34;206m|____/| .__/ \\__,_|\\___\\___|\x1b[0m",
  "\x1b[38;2;126;34;206m                  |___/      \x1b[38;2;126;34;206m      |_|                  \x1b[0m",
]

const DIM = "\x1b[38;2;98;98;106m"
/** "live" purple — reserved for things that need attention. */
const LIVE = "\x1b[38;2;168;85;247m"
const RESET = "\x1b[0m"

/* ------------------------------------------------------------------
   STATE
-------------------------------------------------------------------*/

interface Instance {
  id: string
  term: Terminal
  fit: FitAddon
  webgl: WebglAddon | null
  /** Persistent parent for xterm's own DOM; moved between slots and staging. */
  host: HTMLDivElement
  /** The React slot this instance is currently rendered into, if any. */
  container: HTMLElement | null
  lastCols: number
  lastRows: number
  resizeTimer: ReturnType<typeof setTimeout> | null
  onFocus: (() => void) | null
  detachShell: () => void
  disposed: boolean
}

const instances = new Map<string, Instance>()
/** Reverse lookup for the shared ResizeObserver, which reports elements. */
const containerToId = new WeakMap<Element, string>()

/**
 * Terminals whose startup command has already been sent.
 *
 * Keyed by `terminalId` and deliberately never cleaned up, not even in
 * `disposeInstance`. A dispose followed by a re-attach inside the PTY's 500 ms
 * grace window (switch workspace away and straight back) rebuilds the `Instance`
 * against the *same live shell* — `acquirePtySession` hands back the existing
 * session — so a per-instance flag would type the command a second time into a
 * shell already running the agent. The set is bounded by how many terminals the
 * user opens in one session, which is a handful of strings.
 */
const started = new Set<string>()

/**
 * How a terminal's shell should come up. Read only when the shell is actually
 * spawned, which is once per `terminalId`.
 */
export interface ShellLaunch {
  /** Absolute folder. Ignored by the main process if it is not a directory, so a
   *  stale workspace path degrades to the default rather than failing to spawn. */
  cwd?: string
  /** Typed in, followed by Enter, once the shell answers. Null means nothing to
   *  run — the overwhelmingly common case. */
  startupCommand?: string | null
}

let staging: HTMLDivElement | null = null
let observer: ResizeObserver | null = null
let webglContexts = 0

/* ------------------------------------------------------------------
   SHARED MEASUREMENT
-------------------------------------------------------------------*/

const dirty = new Set<string>()
let fitFrame = 0

/**
 * One observer and one animation frame for the whole app. Per-terminal
 * observers meant a twelve-pane workspace forced twelve separate layout passes
 * per resize tick; batching them collapses that into a single thrash cycle.
 */
function ensureObserver(): ResizeObserver {
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = containerToId.get(entry.target)
        if (id) dirty.add(id)
      }
      scheduleFlush()
    })
  }
  return observer
}

function scheduleFlush() {
  if (fitFrame) return
  // ResizeObserver fires before the browser has finished painting the new size,
  // so measuring in the same tick reads a stale box.
  fitFrame = requestAnimationFrame(() => {
    fitFrame = 0
    const pending = [...dirty]
    dirty.clear()
    for (const id of pending) {
      const inst = instances.get(id)
      if (inst) fitInstance(inst)
    }
  })
}

/** Queues a re-fit for a terminal whose box changed without the observer firing
 *  (a sash drag writes styles directly, bypassing React and the observer). */
export function requestFit(terminalId: string) {
  dirty.add(terminalId)
  scheduleFlush()
}

export function requestFitAll() {
  for (const id of instances.keys()) dirty.add(id)
  scheduleFlush()
}

function sendPtyResize(inst: Instance) {
  if (inst.resizeTimer !== null) {
    clearTimeout(inst.resizeTimer)
    inst.resizeTimer = null
  }
  if (inst.disposed) return
  desktopBridge()?.terminal.resize(inst.id, inst.term.cols, inst.term.rows)
}

function queuePtyResize(inst: Instance) {
  if (inst.resizeTimer !== null) clearTimeout(inst.resizeTimer)
  inst.resizeTimer = setTimeout(() => {
    inst.resizeTimer = null
    if (!inst.disposed) {
      desktopBridge()?.terminal.resize(inst.id, inst.term.cols, inst.term.rows)
    }
  }, PTY_RESIZE_DEBOUNCE_MS)
}

function fitInstance(inst: Instance) {
  const el = inst.container
  // Detached, or hidden behind a maximized sibling. Leaving the PTY at its last
  // size is what lets a hidden shell keep running untouched.
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return

  try {
    inst.fit.fit()
  } catch {
    // Container was torn down mid-measure.
    return
  }

  const { cols, rows } = inst.term
  // The old code sent this on every fit, so a window drag produced one IPC
  // message per terminal per frame for a grid that had not actually changed.
  if (cols === inst.lastCols && rows === inst.lastRows) return
  inst.lastCols = cols
  inst.lastRows = rows
  queuePtyResize(inst)
}

/* ------------------------------------------------------------------
   SETUP HELPERS
-------------------------------------------------------------------*/

function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== "undefined" ? window.purpspace : undefined
}

function stagingNode(): HTMLDivElement {
  if (!staging) {
    staging = document.createElement("div")
    staging.setAttribute("data-bm-terminal-staging", "")
    // A real size rather than 0×0: xterm measures its glyph cell on open, and
    // measuring inside a collapsed box produces a 1-column grid.
    staging.style.cssText =
      "position:fixed;left:-99999px;top:0;width:800px;height:600px;" +
      "visibility:hidden;pointer-events:none;contain:strict"
    document.body.appendChild(staging)
  }
  return staging
}

/** Resolve the CSS custom property to a real font stack — xterm measures glyphs
 *  on a canvas and cannot read `var(--font-geist-mono)`, so passing the var
 *  produced fallback metrics and misaligned columns. */
function resolveMonoFont(el: HTMLElement): string {
  const resolved = getComputedStyle(el).getPropertyValue("--font-geist-mono").trim()
  const stack = ['"Cascadia Code"', '"Fira Code"', "Menlo", "monospace"]
  return resolved ? [resolved, ...stack].join(", ") : stack.join(", ")
}

/** ConPTY wraps lines without emitting a wrap marker; xterm needs to be told so
 *  it stops reflowing wrapped output into garbage on resize. */
function windowsPtyOptions(bridge: DesktopBridge | undefined) {
  if (!bridge || bridge.platform !== "win32") return undefined
  const buildNumber = bridge.osBuild
  return typeof buildNumber === "number" && buildNumber > 0
    ? ({ backend: "conpty", buildNumber } as const)
    : ({ backend: "conpty" } as const)
}

function loadWebgl(inst: Instance) {
  // Must run after open(): the addon needs the terminal's element to exist.
  if (webglContexts >= MAX_WEBGL_CONTEXTS) return
  try {
    const addon = new WebglAddon()
    addon.onContextLoss(() => {
      // Losing the context leaves a blank pane unless the addon is torn down,
      // at which point xterm silently falls back to the DOM renderer.
      if (inst.webgl === addon) {
        inst.webgl = null
        webglContexts = Math.max(0, webglContexts - 1)
      }
      addon.dispose()
    })
    inst.term.loadAddon(addon)
    inst.webgl = addon
    webglContexts += 1
  } catch {
    // No GPU, or a blocklisted driver. The DOM renderer still works.
  }
}

/* ------------------------------------------------------------------
   SHELL ATTACHMENT
-------------------------------------------------------------------*/

/**
 * Written in both modes, but only actually *visible* in the browser mock.
 *
 * ConPTY owns the whole screen buffer: it clears and repaints with absolute
 * cursor positioning on attach and on every resize, so anything drawn outside
 * the PTY's own model is wiped within a frame or two. Stripping the opening
 * `ESC[2J`/`ESC[H` was tried and does not survive the first resize repaint.
 * Making the banner stick in desktop mode means having the shell print it —
 * i.e. spawning PowerShell with `-NoLogo -NoExit -Command <banner>` — which
 * trades a cosmetic win for quoting risk in the one code path that must never
 * break. Left as-is deliberately.
 */
function writeBanner(term: Terminal, terminalId: string, live: boolean) {
  for (const line of BANNER) term.writeln(line)
  term.writeln("")
  term.writeln("  \x1b[38;2;168;85;247mPurpSpace Terminal\x1b[0m")
  term.writeln(
    live
      ? `  ${DIM}session ${terminalId} · attaching to your shell…${RESET}`
      : `  ${DIM}session ${terminalId} · type ${RESET}\x1b[38;2;110;168;254mhelp${RESET}${DIM} to begin${RESET}`
  )
  term.writeln("")
}

/**
 * Desktop path: raw bytes in both directions.
 *
 * There is deliberately no local line editor here — the PTY already owns
 * history, arrow keys, tab completion and Ctrl+C, and a second parser on top of
 * it would fight the shell.
 */
function attachPty(
  inst: Instance,
  desktop: DesktopBridge,
  launch: ShellLaunch
): () => void {
  const { term, id } = inst
  let disposed = false
  const input = term.onData((data) => desktop.terminal.write(id, data))

  void acquirePtySession(desktop, id, {
    cols: term.cols,
    rows: term.rows,
    cwd: launch.cwd,
    onData: (data) => {
      if (!disposed) term.write(data)
    },
    onExit: ({ exitCode }) => {
      if (disposed) return
      term.writeln("")
      term.writeln(`  ${DIM}[process exited with code ${exitCode}]${RESET}`)
    },
  })
    .then((result) => {
      if (disposed) return
      if (!result.ok) {
        // Silently dead panes are the worst outcome; say why in the live colour.
        term.writeln(`  ${LIVE}shell failed to start: ${result.error ?? "unknown error"}${RESET}`)
        term.writeln("")
        return
      }
      // The first fit ran before the PTY existed, so its resize was dropped.
      inst.lastCols = term.cols
      inst.lastRows = term.rows
      sendPtyResize(inst)

      // Start the agent, at most once per terminal, ever. See `started`.
      const cmd = launch.startupCommand
      if (cmd && !started.has(id)) {
        started.add(id)
        // No delay before this write: the pseudoconsole buffers stdin, so the
        // shell reads the line whenever it finishes starting up. A timer would
        // only be a guess at how long that takes, and would type into whatever
        // was on screen if the guess ran short.
        desktop.terminal.write(id, `${cmd}\r`)
      }
    })
    .catch((err: unknown) => {
      if (disposed) return
      term.writeln(`  ${LIVE}shell bridge error: ${String(err)}${RESET}`)
      term.writeln("")
    })

  return () => {
    disposed = true
    input.dispose()
    releasePtySession(id)
  }
}

/**
 * Browser path: the original canned shell, kept verbatim so `npm run dev` and
 * any future web build still look and behave the way they did.
 */
function attachMockShell(term: Terminal): () => void {
  const prompt = "\x1b[38;2;168;85;247m❯\x1b[0m "
  let line = ""
  const history: string[] = []
  let historyIdx = -1

  term.write(prompt)

  const run = (cmd: string) => {
    switch (true) {
      case cmd === "clear":
        term.clear()
        return
      case cmd === "help":
        term.writeln("  \x1b[38;2;168;85;247mCommands\x1b[0m")
        term.writeln("    clear     Clear the screen")
        term.writeln("    help      Show this help")
        term.writeln("    whoami    Print current user")
        term.writeln("    pwd       Print working directory")
        term.writeln("    ls        List files")
        term.writeln("    echo      Echo text")
        term.writeln("")
        return
      case cmd === "whoami":
        term.writeln("  developer")
        term.writeln("")
        return
      case cmd === "pwd":
        term.writeln("  ~/workspace")
        term.writeln("")
        return
      case cmd === "ls":
        term.writeln(
          "  \x1b[38;2;110;168;254msrc/\x1b[0m     \x1b[38;2;110;168;254mpublic/\x1b[0m   package.json"
        )
        term.writeln("  README.md  tsconfig.json  next.config.ts")
        term.writeln("")
        return
      case cmd.startsWith("echo "):
        term.writeln(`  ${cmd.slice(5)}`)
        term.writeln("")
        return
      default:
        term.writeln(
          `  \x1b[38;2;224;195;76m${cmd.split(" ")[0]}: not connected to a shell yet\x1b[0m`
        )
        term.writeln("")
    }
  }

  const disposable = term.onData((data) => {
    // Arrow keys arrive as escape sequences; the old handler let them through
    // the `data >= " "` branch and printed literal "[A" into the buffer.
    if (data === "\x1b[A" || data === "\x1b[B") {
      if (history.length === 0) return
      if (data === "\x1b[A") {
        historyIdx = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1)
      } else {
        if (historyIdx < 0) return
        historyIdx = historyIdx + 1
        if (historyIdx >= history.length) {
          historyIdx = -1
          term.write("\r\x1b[K" + prompt)
          line = ""
          return
        }
      }
      line = history[historyIdx] ?? ""
      term.write("\r\x1b[K" + prompt + line)
      return
    }
    // Swallow remaining control sequences (left/right/home/etc.).
    if (data.startsWith("\x1b")) return

    if (data === "\r") {
      const cmd = line.trim()
      term.writeln("")
      if (cmd) {
        history.push(cmd)
        run(cmd)
      }
      historyIdx = -1
      line = ""
      term.write(prompt)
      return
    }

    if (data === "\x7f") {
      if (line.length > 0) {
        line = line.slice(0, -1)
        term.write("\b \b")
      }
      return
    }

    // Ctrl+C
    if (data === "\x03") {
      term.writeln("^C")
      line = ""
      term.write(prompt)
      return
    }

    if (data >= " ") {
      line += data
      term.write(data)
    }
  })

  return () => disposable.dispose()
}

/* ------------------------------------------------------------------
   LIFECYCLE
-------------------------------------------------------------------*/

function createInstance(id: string, launch: ShellLaunch): Instance {
  const parent = stagingNode()
  const host = document.createElement("div")
  host.className = "w-full h-full"
  host.style.cssText = "width:100%;height:100%"
  parent.appendChild(host)

  const desktop = desktopBridge()
  const term = new Terminal({
    fontFamily: resolveMonoFont(parent),
    fontSize: 12,
    lineHeight: 1.35,
    cursorBlink: true,
    cursorStyle: "bar",
    scrollback: 5000,
    // Only the mock shell needs bare \n promoted to \r\n. Against a real PTY it
    // corrupts TUI redraws, which emit line feeds without meaning "column 0".
    convertEol: !desktop,
    windowsPty: windowsPtyOptions(desktop),
    theme: {
      background: "#09090b",
      foreground: "#d4d4d8",
      cursor: "#a855f7",
      cursorAccent: "#09090b",
      selectionBackground: "rgba(168, 85, 247, 0.25)",
      selectionForeground: "#fafafa",
      black: "#18181b",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#6ea8fe",
      magenta: "#a855f7",
      cyan: "#06b6d4",
      white: "#d4d4d8",
      brightBlack: "#52525b",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#facc15",
      brightBlue: "#93c5fd",
      brightMagenta: "#c084fc",
      brightCyan: "#22d3ee",
      brightWhite: "#fafafa",
    },
    allowProposedApi: true,
  })

  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  term.loadAddon(new ClipboardAddon())
  term.open(host)

  const inst: Instance = {
    id,
    term,
    fit,
    webgl: null,
    host,
    container: null,
    lastCols: term.cols,
    lastRows: term.rows,
    resizeTimer: null,
    onFocus: null,
    detachShell: () => {},
    disposed: false,
  }

  loadWebgl(inst)

  // App chords have to reach the document listener rather than being encoded
  // and sent to the shell. Reading the keymap live means rebinding takes effect
  // immediately, with no need to re-attach anything.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== "keydown") return true
    return matchAction(e) === null
  })

  // Focus can arrive without a click — Tab, or a programmatic focus after a
  // split — so track it at the source instead of on an outer click handler.
  term.textarea?.addEventListener("focus", () => inst.onFocus?.())

  writeBanner(term, id, Boolean(desktop))
  inst.detachShell = desktop ? attachPty(inst, desktop, launch) : attachMockShell(term)

  instances.set(id, inst)
  return inst
}

export function ensureInstance(terminalId: string, launch: ShellLaunch = {}): void {
  if (typeof document === "undefined") return
  if (!instances.has(terminalId)) createInstance(terminalId, launch)
}

/**
 * Moves the terminal into a React slot. Creates it on first use.
 *
 * `launch` is read only on that first use, because that is the only moment a
 * shell is spawned — a terminal that is already running keeps the folder and the
 * agent it started with, which is what someone who reopens a pane expects.
 */
export function attachInstance(
  terminalId: string,
  container: HTMLElement,
  launch: ShellLaunch = {}
): void {
  if (typeof document === "undefined") return
  const inst = instances.get(terminalId) ?? createInstance(terminalId, launch)

  if (inst.container && inst.container !== container) {
    ensureObserver().unobserve(inst.container)
    containerToId.delete(inst.container)
  }

  inst.container = container
  containerToId.set(container, terminalId)
  container.appendChild(inst.host)
  ensureObserver().observe(container)
  requestFit(terminalId)
}

/**
 * Parks the terminal back in staging. The `Terminal`, its buffer and its shell
 * are all untouched — this is what makes splitting and maximizing free.
 */
export function detachInstance(terminalId: string, container?: HTMLElement): void {
  const inst = instances.get(terminalId)
  if (!inst) return
  // A remount can attach the new slot before the old one cleans up; ignore the
  // stale cleanup so it cannot unhook the live container.
  if (container && inst.container !== container) return

  if (inst.container) {
    ensureObserver().unobserve(inst.container)
    containerToId.delete(inst.container)
    inst.container = null
  }
  dirty.delete(terminalId)
  if (!inst.disposed) stagingNode().appendChild(inst.host)
}

export function disposeInstance(terminalId: string): void {
  const inst = instances.get(terminalId)
  if (!inst) return
  instances.delete(terminalId)
  inst.disposed = true

  if (inst.resizeTimer !== null) clearTimeout(inst.resizeTimer)
  if (inst.container) {
    ensureObserver().unobserve(inst.container)
    containerToId.delete(inst.container)
    inst.container = null
  }
  dirty.delete(terminalId)

  if (inst.webgl) {
    webglContexts = Math.max(0, webglContexts - 1)
    inst.webgl = null
  }
  inst.detachShell()
  inst.term.dispose()
  inst.host.remove()
}

/** Single ownership rule: anything the store no longer knows about is gone. */
export function disposeInstancesExcept(keep: ReadonlySet<string>): void {
  for (const id of [...instances.keys()]) {
    if (!keep.has(id)) disposeInstance(id)
  }
}

/* ------------------------------------------------------------------
   ACCESS
-------------------------------------------------------------------*/

export function setFocusHandler(terminalId: string, handler: (() => void) | null): void {
  const inst = instances.get(terminalId)
  if (inst) inst.onFocus = handler
}

export function focusInstance(terminalId: string): void {
  instances.get(terminalId)?.term.focus()
}

/** Visible terminals and their screen boxes, for directional focus movement. */
export function visibleRects(): { id: string; rect: DOMRect }[] {
  const out: { id: string; rect: DOMRect }[] = []
  for (const [id, inst] of instances) {
    const el = inst.container
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) continue
    out.push({ id, rect: el.getBoundingClientRect() })
  }
  return out
}

/**
 * Nearest visible terminal in a direction. Candidates must overlap the source
 * on the perpendicular axis, so moving right out of a tall pane lands in the
 * neighbour beside it rather than one diagonally across the grid.
 */
export function neighbourInDirection(
  fromId: string,
  direction: "left" | "right" | "up" | "down"
): string | null {
  const rects = visibleRects()
  const source = rects.find((r) => r.id === fromId)
  if (!source) return null

  const horizontal = direction === "left" || direction === "right"
  let best: { id: string; distance: number } | null = null

  for (const candidate of rects) {
    if (candidate.id === fromId) continue
    const { rect } = candidate
    const a = source.rect

    const overlaps = horizontal
      ? rect.bottom > a.top + 1 && rect.top < a.bottom - 1
      : rect.right > a.left + 1 && rect.left < a.right - 1
    if (!overlaps) continue

    let distance: number
    if (direction === "left") distance = a.left - rect.right
    else if (direction === "right") distance = rect.left - a.right
    else if (direction === "up") distance = a.top - rect.bottom
    else distance = rect.top - a.bottom

    // Allow a small negative slack for the 1px borders between panes.
    if (distance < -2) continue
    if (!best || distance < best.distance) {
      best = { id: candidate.id, distance }
    }
  }

  return best?.id ?? null
}

/* ------------------------------------------------------------------
   FONT READINESS
-------------------------------------------------------------------*/

// xterm measures its cell before the webfont has loaded, so the first paint is
// laid out against fallback metrics and every column is slightly off until
// something triggers a resize.
if (typeof document !== "undefined" && "fonts" in document) {
  void document.fonts.ready.then(() => requestFitAll())
}
