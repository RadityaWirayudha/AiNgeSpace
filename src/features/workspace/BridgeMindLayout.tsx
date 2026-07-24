"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { BridgeMindSidebar } from "@/components/BridgeMindSidebar"
import { Pane } from "@/components/Pane"
import {
  PaneTerminalProvider,
  usePaneTerminalStore,
  collectTerminals,
} from "@/features/terminal/pane-terminal-store"
import { PaneTerminalManager } from "@/features/terminal/PaneTerminalManager"

interface PaneData {
  id: string
  title: string
  status: "running" | "idle" | "warning" | "error"
  progress?: number
  duration?: string
  agentCount?: number
}

interface WorkspaceData {
  id: string
  name: string
  count: number
  panes: PaneData[]
}

interface BridgeMindLayoutProps {
  workspaces?: WorkspaceData[]
  className?: string
}

const mockWorkspaces: WorkspaceData[] = [
  {
    id: "swarm-1",
    name: "Swarm 2",
    count: 2,
    panes: [
      {
        id: "pane-1",
        title: "Review project and…",
        status: "idle",
        agentCount: 3,
      },
      {
        id: "pane-2",
        title: "Review project and…",
        status: "idle",
        agentCount: 2,
      },
    ],
  },
  {
    id: "bridgemind-1",
    name: "BridgeMind 8",
    count: 8,
    panes: [
      {
        id: "pane-3",
        title: "Launch BOM sprint…",
        status: "running",
        progress: 5,
        duration: "Cooked for 12m 1s",
        agentCount: 4,
      },
      {
        id: "pane-4",
        title: "Review project and…",
        status: "idle",
        agentCount: 2,
      },
    ],
  },
  {
    id: "bridgemind-2",
    name: "BridgeMind 7",
    count: 7,
    panes: [
      {
        id: "pane-5",
        title: "Refactor auth module…",
        status: "warning",
        duration: "Cooked for 5m 32s",
        agentCount: 3,
      },
      {
        id: "pane-6",
        title: "Deploy staging…",
        status: "idle",
        agentCount: 1,
      },
    ],
  },
  {
    id: "gpt-1",
    name: "GPT 5.5",
    count: 6,
    panes: [
      {
        id: "pane-7",
        title: "Generate tests…",
        status: "running",
        progress: 72,
        duration: "Cooked for 3m 45s",
        agentCount: 5,
      },
      {
        id: "pane-8",
        title: "Code review…",
        status: "idle",
        agentCount: 2,
      },
    ],
  },
]

function BridgeMindInner() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("bridgemind-1")
  const [activePaneId, setActivePaneId] = useState<string | null>("pane-3")

  const workspaces = mockWorkspaces
  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)
  const panes = activeWorkspace?.panes ?? []

  return (
    <div className="flex h-screen bg-bm-bg overflow-hidden">
      <BridgeMindSidebar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelect={(id) => {
          setActiveWorkspaceId(id)
          const ws = workspaces.find((w) => w.id === id)
          setActivePaneId(ws?.panes[0]?.id ?? null)
        }}
        className="w-44 shrink-0"
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="grid grid-cols-2 gap-px flex-1 p-px">
          {panes.map((pane) => (
            <div
              key={pane.id}
              className="min-h-0 min-w-0"
              onClick={() => setActivePaneId(pane.id)}
            >
              <Pane
                title={pane.title}
                active={pane.id === activePaneId}
                progress={pane.progress}
                className="h-full"
                footer={
                  <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5">
                      <span className="text-bm-text-secondary">»</span>
                      <span>auto mode on</span>
                      {pane.agentCount !== undefined && pane.agentCount > 0 && (
                        <span className="text-bm-text-secondary">
                          · {pane.agentCount} agent{pane.agentCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                    {pane.duration && <span>{pane.duration}</span>}
                  </div>
                }
              >
                <div className="w-full h-full">
                  <PaneTerminalManager paneId={pane.id} />
                </div>
              </Pane>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BridgeMindLayout({ className }: BridgeMindLayoutProps) {
  return (
    <PaneTerminalProvider>
      <BridgeMindInner />
    </PaneTerminalProvider>
  )
}
