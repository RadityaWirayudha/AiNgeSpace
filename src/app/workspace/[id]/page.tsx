"use client"

import { use, useEffect, useState } from "react"
import { WorkspaceView } from "@/features/workspace/WorkspaceView"
import { fetchWorkspace } from "@/features/workspace/workspace-api"
import { terminalCountFor } from "@/lib/workspace/layouts"

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  // The layout used to arrive through a one-shot "aingespace:pending-layout"
  // entry in localStorage, which meant it was gone on the second visit and
  // absent entirely on another machine. It is a column on the workspace row
  // now, so the page just reads it back.
  const [terminalCount, setTerminalCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchWorkspace(id)
      .then((row) => {
        if (!cancelled) setTerminalCount(terminalCountFor(row.layout_preset))
      })
      .catch(() => {
        // An unsaved workspace (local-ws-N) 404s, and a signed-out user 401s.
        // Neither is a reason to refuse to open a terminal.
        if (!cancelled) setTerminalCount(1)
      })

    return () => {
      cancelled = true
    }
  }, [id])

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
