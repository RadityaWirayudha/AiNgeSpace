"use client"

import { use, useSyncExternalStore, useCallback } from "react"
import { WorkspaceView } from "@/features/workspace/WorkspaceView"

interface PendingLayout {
  terminalCount?: number
}

/** The pending layout is a one-shot handoff from the create dialog. It is read
 *  and cleared exactly once per workspace id, then memoised so that
 *  getSnapshot stays referentially stable across renders. */
const resolved = new Map<string, number>()

function readTerminalCount(id: string): number {
  const cached = resolved.get(id)
  if (cached !== undefined) return cached

  let count = 1
  try {
    const raw = localStorage.getItem("aingespace:pending-layout")
    if (raw) {
      const config = JSON.parse(raw) as PendingLayout
      localStorage.removeItem("aingespace:pending-layout")
      if (
        typeof config.terminalCount === "number" &&
        Number.isFinite(config.terminalCount)
      ) {
        count = Math.min(8, Math.max(1, Math.trunc(config.terminalCount)))
      }
    }
  } catch {
    // Corrupt or unavailable storage — fall back to a single terminal.
  }

  resolved.set(id, count)
  return count
}

const subscribe = () => () => {}

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  // localStorage cannot be touched during render or on the server: the old
  // version read *and mutated* it inline, so the server rendered 1 terminal
  // while the client rendered N and the entry was consumed before commit.
  const getSnapshot = useCallback(() => readTerminalCount(id), [id])
  const terminalCount = useSyncExternalStore(subscribe, getSnapshot, () => null)

  if (terminalCount === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-[11px] text-bm-text-dim">
          <span className="size-3.5 rounded-full border-2 border-bm-border border-t-bm-text-secondary animate-spin" />
          Opening workspace…
        </div>
      </div>
    )
  }

  return <WorkspaceView key={id} initialTerminalCount={terminalCount} />
}
