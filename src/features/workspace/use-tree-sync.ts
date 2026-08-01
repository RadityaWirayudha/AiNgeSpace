"use client"

import { useCallback, useEffect, useRef } from "react"
import type { PaneTerminalNode } from "@/features/terminal/pane-terminal-store"
import { updatePane } from "./workspace-api"

/**
 * Long enough that one drag of a splitter is a single write, short enough that
 * closing the window straight after a split still catches it. RESIZE_SPLIT only
 * commits on pointer-up, but SPLIT and CLOSE can arrive in bursts from held
 * keyboard shortcuts.
 */
const DEBOUNCE_MS = 400

interface Options {
  trees: Record<string, PaneTerminalNode>
  nameSeq: Record<string, number>
  /** False for panes that have no row behind them — a workspace created while
   *  the API was unreachable, for instance. */
  isSavable: (paneId: string) => boolean
  onError?: (error: unknown) => void
}

/**
 * Writes `panes_aingespace.tree` whenever a pane's tree changes.
 *
 * Trees are immutable in the reducer — every split, close and resize produces a
 * whole new object — so identity comparison against the last value written is
 * enough to tell a real change from a re-render, with no deep diffing.
 */
export function useTreeSync({ trees, nameSeq, isSavable, onError }: Options) {
  /** Last value known to be in the database, by pane id. */
  const saved = useRef<Record<string, PaneTerminalNode>>({})
  const pending = useRef<Record<string, PaneTerminalNode>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read at flush time rather than closed over: a flush fired by `pagehide`
  // has to write the newest sequence numbers, not the ones from the render
  // that happened to schedule it.
  const latest = useRef({ nameSeq, isSavable, onError })
  useEffect(() => {
    latest.current = { nameSeq, isSavable, onError }
  })

  /**
   * Records a tree as already stored — used right after loading a workspace, so
   * the first render does not write back the exact rows it just read.
   */
  const markSaved = useCallback((paneId: string, tree: PaneTerminalNode) => {
    saved.current[paneId] = tree
    delete pending.current[paneId]
  }, [])

  const flush = useCallback((keepalive = false) => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    const entries = Object.entries(pending.current)
    if (entries.length === 0) return
    pending.current = {}

    for (const [paneId, tree] of entries) {
      updatePane(
        paneId,
        { tree, nameSeq: latest.current.nameSeq[paneId] ?? 1 },
        keepalive
      )
        .then(() => {
          saved.current[paneId] = tree
        })
        .catch((error) => {
          // `saved` is left stale on purpose: the next change to this pane will
          // see a mismatch and try again. Nothing retries on its own, so a pane
          // that has been deleted underneath us cannot start a request loop.
          latest.current.onError?.(error)
        })
    }
  }, [])

  useEffect(() => {
    let dirty = false

    for (const [paneId, tree] of Object.entries(trees)) {
      if (saved.current[paneId] === tree) continue
      if (pending.current[paneId] === tree) continue
      if (!latest.current.isSavable(paneId)) {
        // Nothing to write to. Remember it anyway so the check is not repeated
        // on every keystroke that moves focus.
        saved.current[paneId] = tree
        continue
      }
      pending.current[paneId] = tree
      dirty = true
    }

    // A pane that has gone from the tree map was closed; its row went with it.
    for (const paneId of Object.keys(saved.current)) {
      if (!(paneId in trees)) delete saved.current[paneId]
    }
    for (const paneId of Object.keys(pending.current)) {
      if (!(paneId in trees)) delete pending.current[paneId]
    }

    if (!dirty) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(false), DEBOUNCE_MS)
  }, [trees, flush])

  // A reload or a window close inside the debounce window would otherwise drop
  // the layout the user just arranged. `pagehide` rather than `beforeunload`:
  // it is the one that fires reliably when the tab is discarded on mobile and
  // when Electron closes the window.
  useEffect(() => {
    const onPageHide = () => flush(true)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      flush(true)
    }
  }, [flush])

  return { markSaved }
}
