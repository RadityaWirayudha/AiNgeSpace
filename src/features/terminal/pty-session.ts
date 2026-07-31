"use client"

/**
 * Keeps a real PTY attached to its `terminalId`.
 *
 * This used to carry the whole burden of surviving React: `PaneTerminalManager`
 * rebuilt its node tree on every split, so React tore down the leaf component
 * and the shell went with it unless the kill was deferred long enough for a
 * remount to re-attach.
 *
 * That is no longer how terminals are owned. `terminal-instances.ts` holds the
 * `Terminal` outside the React tree, so a split moves a DOM node and nothing is
 * unmounted from the PTY's point of view; `releasePtySession` is now reached
 * only from `disposeInstance`, i.e. when the terminal is genuinely gone. The
 * grace window is kept — much shorter — purely as a safety net, and the replay
 * buffer still earns its place: it repaints a shell that printed while its
 * pane was hidden.
 */

import type {
  DesktopBridge,
  TerminalCreateResult,
  TerminalExitPayload,
} from "@/types/desktop"

/** Now that remounts no longer reach this module, the only job left is to
 *  absorb a same-tick release/acquire pair. Kept short so a closed pane frees
 *  its process promptly. */
const REATTACH_GRACE_MS = 500

/** Cap on the replay buffer. A build log can emit megabytes; only the tail is
 *  worth showing, and holding all of it would leak for the app's lifetime. */
const MAX_REPLAY_CHARS = 256 * 1024

type DataSink = (data: string) => void
type ExitSink = (payload: TerminalExitPayload) => void

interface Session {
  bridge: DesktopBridge
  /** Chunks rather than one string: appending to a 256 KB string per PTY chunk
   *  is quadratic and shows up as jank during noisy output. */
  replay: string[]
  replayChars: number
  dataSink: DataSink | null
  exitSink: ExitSink | null
  unsubscribe: () => void
  killTimer: ReturnType<typeof setTimeout> | null
  exit: TerminalExitPayload | null
  ready: Promise<TerminalCreateResult>
}

const sessions = new Map<string, Session>()

function record(session: Session, data: string) {
  session.replay.push(data)
  session.replayChars += data.length
  while (session.replayChars > MAX_REPLAY_CHARS && session.replay.length > 1) {
    session.replayChars -= session.replay.shift()!.length
  }
}

function finalize(terminalId: string, session: Session) {
  // A newer mount may have replaced this session already; never kill its shell.
  if (sessions.get(terminalId) !== session) return
  if (session.killTimer !== null) {
    clearTimeout(session.killTimer)
    session.killTimer = null
  }
  sessions.delete(terminalId)
  session.unsubscribe()
  session.bridge.terminal.kill(terminalId)
}

export interface AcquireOptions {
  cols: number
  rows: number
  cwd?: string
  onData: DataSink
  onExit: ExitSink
}

/**
 * Returns the `create` result — the same promise on re-attach, so a remount
 * never spawns a second shell for one `terminalId`.
 */
export function acquirePtySession(
  bridge: DesktopBridge,
  terminalId: string,
  opts: AcquireOptions
): Promise<TerminalCreateResult> {
  const existing = sessions.get(terminalId)
  if (existing) {
    if (existing.killTimer !== null) {
      clearTimeout(existing.killTimer)
      existing.killTimer = null
    }
    existing.dataSink = opts.onData
    existing.exitSink = opts.onExit
    for (const chunk of existing.replay) opts.onData(chunk)
    if (existing.exit) opts.onExit(existing.exit)
    return existing.ready
  }

  const session: Session = {
    bridge,
    replay: [],
    replayChars: 0,
    dataSink: opts.onData,
    exitSink: opts.onExit,
    unsubscribe: () => {},
    killTimer: null,
    exit: null,
    ready: Promise.resolve({ ok: false }),
  }

  // Subscribed before `create` so nothing the shell prints on startup is lost.
  const offData = bridge.terminal.onData(terminalId, (data) => {
    record(session, data)
    session.dataSink?.(data)
  })
  const offExit = bridge.terminal.onExit(terminalId, (payload) => {
    session.exit = payload
    session.exitSink?.(payload)
  })
  session.unsubscribe = () => {
    offData()
    offExit()
  }

  session.ready = bridge.terminal.create(terminalId, {
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
  })

  sessions.set(terminalId, session)
  return session.ready
}

/** Detaches the current xterm and schedules the kill. */
export function releasePtySession(terminalId: string) {
  const session = sessions.get(terminalId)
  if (!session) return

  session.dataSink = null
  session.exitSink = null

  // Nothing left to re-attach to, so do not hold the record for the grace window.
  if (session.exit) {
    finalize(terminalId, session)
    return
  }

  if (session.killTimer !== null) clearTimeout(session.killTimer)
  session.killTimer = setTimeout(() => finalize(terminalId, session), REATTACH_GRACE_MS)
}
