"use client"

import { useState } from "react"
import { MenuBar } from "@/components/MenuBar"
import { Explorer } from "@/components/Explorer"
import { TerminalManager } from "@/features/terminal/TerminalManager"
import { TerminalProvider } from "@/features/terminal/terminal-store"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function WorkspaceView() {
  const [explorerOpen, setExplorerOpen] = useState(true)

  return (
    <TerminalProvider>
      <div className="flex flex-col h-screen bg-background overflow-hidden">
        <MenuBar
          onToggleExplorer={() => setExplorerOpen(!explorerOpen)}
          explorerOpen={explorerOpen}
        />
        <div className="flex flex-1 min-h-0">
          {explorerOpen && (
            <div className="w-56 shrink-0 animate-in slide-in-from-left-2 duration-200">
              <Explorer />
            </div>
          )}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center h-8 px-1 border-b border-white/[0.06] bg-[#0c0c0f]/60 shrink-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={() => setExplorerOpen(!explorerOpen)}
                      className="inline-flex items-center justify-center size-6 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors outline-none"
                    />
                  }
                >
                  {explorerOpen ? (
                    <PanelLeftClose className="size-3.5" />
                  ) : (
                    <PanelLeft className="size-3.5" />
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {explorerOpen ? "Hide Explorer" : "Show Explorer"}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex-1 min-h-0 p-1">
              <TerminalManager />
            </div>
          </div>
        </div>
      </div>
    </TerminalProvider>
  )
}
