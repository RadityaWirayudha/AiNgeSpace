"use client"

import { use } from "react"
import { WorkspaceView } from "@/features/workspace/WorkspaceView"

function readTerminalCount(): number {
  if (typeof window === "undefined") return 1
  try {
    const raw = localStorage.getItem("aingespace:pending-layout")
    if (raw) {
      const config = JSON.parse(raw) as { terminalCount?: number }
      localStorage.removeItem("aingespace:pending-layout")
      return config.terminalCount ?? 1
    }
  } catch {
    // fallback
  }
  return 1
}

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const terminalCount = readTerminalCount()

  return <WorkspaceView key={id} initialTerminalCount={terminalCount} />
}
