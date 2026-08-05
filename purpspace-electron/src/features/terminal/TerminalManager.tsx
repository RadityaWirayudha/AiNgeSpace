"use client"

import dynamic from "next/dynamic"
import { useTerminalStore } from "./terminal-store"
import { TerminalToolbar } from "./TerminalToolbar"
import { cn } from "@/lib/utils"

const TerminalPanel = dynamic(
  () => import("./TerminalPanel").then((mod) => mod.TerminalPanel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-bm-terminal flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-5 rounded-full border-2 border-bm-border border-t-bm-text-secondary animate-spin" />
          <span className="text-xs text-bm-text-dim font-mono">
            Loading terminal…
          </span>
        </div>
      </div>
    ),
  }
)

export function TerminalManager() {
  const { state, setActiveTerminal } = useTerminalStore()
  const { terminals, activeTerminalId } = state

  const count = terminals.length

  // Columns only; rows are implicit so an odd count (5 or 7) fills the last
  // row instead of leaving a hole in a fixed 2x4 grid.
  const getGridClass = () => {
    if (count <= 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-1 md:grid-cols-2"
    if (count <= 4) return "grid-cols-1 md:grid-cols-2"
    if (count <= 6) return "grid-cols-2 lg:grid-cols-3"
    return "grid-cols-2 lg:grid-cols-4"
  }

  return (
    <div
      className={cn(
        "grid gap-1 h-full min-h-0 auto-rows-fr rounded-lg overflow-hidden",
        getGridClass()
      )}
    >
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          className="flex flex-col min-h-0 min-w-0 terminal-chrome overflow-hidden rounded-md"
        >
          <TerminalToolbar
            terminalId={terminal.id}
            terminalName={terminal.name}
            isActive={terminal.id === activeTerminalId}
          />
          <div className="flex-1 min-h-0">
            <TerminalPanel
              terminalId={terminal.id}
              isActive={terminal.id === activeTerminalId}
              onFocus={() => setActiveTerminal(terminal.id)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
