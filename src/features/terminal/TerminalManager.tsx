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
      <div className="w-full h-full bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 rounded-full border-2 border-purple/30 border-t-purple animate-spin" />
          <span className="text-xs text-zinc-600 font-mono">Loading terminal...</span>
        </div>
      </div>
    ),
  }
)

export function TerminalManager() {
  const { state, setActiveTerminal } = useTerminalStore()
  const { terminals, activeTerminalId } = state

  const count = terminals.length

  const getGridClass = () => {
    if (count === 1) return "grid-cols-1 grid-rows-1"
    if (count === 2) return "grid-cols-2 grid-rows-1"
    if (count === 3) return "grid-cols-2 grid-rows-2"
    if (count === 4) return "grid-cols-2 grid-rows-2"
    return "grid-cols-2 grid-rows-2"
  }

  const getVisibleTerminals = () => {
    if (count <= 4) return terminals
    return terminals.slice(-4)
  }

  const visible = getVisibleTerminals()
  const overflow = count > 4 ? count - 4 : 0

  return (
    <div className={cn("grid gap-1 h-full rounded-lg overflow-hidden", getGridClass())}>
      {visible.map((terminal) => (
        <div
          key={terminal.id}
          className="flex flex-col min-h-0 min-w-0 terminal-chrome overflow-hidden"
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
      {overflow > 0 && (
        <div className="flex items-center justify-center bg-[#0c0c0f] text-zinc-500 text-xs font-mono rounded-lg border border-white/[0.06]">
          +{overflow} more terminal{overflow > 1 ? "s" : ""}
        </div>
      )}
    </div>
  )
}
