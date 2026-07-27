"use client"

/**
 * Keeps a real PTY attached to its `terminalId` across React remounts.
 *
 * `PaneTerminalManager` rebuilds the node tree whenever a pane is split,
 * maximised or restored. The element type at a given position changes when a
 * leaf becomes a split, so React tears the existing leaf down and mounts a new
 * one — killing the shell straight from the unmount cleanup would destroy a
 * running command every time the user clicks "split right".
 *
 * So the kill is deferred. A remount inside the grace window re-attaches to the
 * same shell and replays whatever it printed while no xterm was listening; a
 * genuinely closed terminal still frees its process a couple of seconds later.
 */

import type {
  DesktopBridge,
  TerminalCreateResult,
  TerminalExitPayload,
} from "@/types/desktop"

/** Long enough to cover a remount (and StrictMode's double mount), short
 *  enough that closing a pane does not leave a shell running for minutes. */
const REATTACH_GRACE_MS = 2_500

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
