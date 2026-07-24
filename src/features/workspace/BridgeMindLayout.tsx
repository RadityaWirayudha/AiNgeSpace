"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { BridgeMindSidebar } from "@/components/BridgeMindSidebar"
import { AgentPane } from "@/components/AgentPane"

interface PaneData {
  id: string
  title: string
  status: "running" | "idle" | "warning" | "error"
  progress?: number
  items?: string[]
  bulletPoints?: { label: string; value: string }[]
  warning?: string
  server?: string
  controlPanel?: string
  duration?: string
  autoMode?: boolean
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
        items: [
          "Two things worth flagging:",
          "1. bridgemind_admin no…",
          "2. bridgeagent_memory…",
        ],
        autoMode: true,
        agentCount: 3,
      },
      {
        id: "pane-2",
        title: "Review project and…",
        status: "idle",
        items: [
          "COUPON_PRICE_REFLECTION…",
          "(main, 2 dirty)",
        ],
        autoMode: true,
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
        items: [
          "The BOM overlay is up",
          "and running. Here's…",
        ],
        bulletPoints: [
          { label: "Server", value: "bomb-sprint…" },
          { label: "Control panel", value: "open…" },
        ],
        duration: "Cooked for 12m 1s",
        autoMode: true,
        agentCount: 4,
      },
      {
        id: "pane-4",
        title: "Review project and…",
        status: "idle",
        items: [
          "PNG, matching the…",
          "…",
        ],
        autoMode: true,
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
        warning: "Deprecation warning: v2 API will be removed",
        items: [
          "Migrating 3 endpoints…",
          "Tests passing: 47/52",
        ],
        duration: "Cooked for 5m 32s",
        autoMode: true,
        agentCount: 3,
      },
      {
        id: "pane-6",
        title: "Deploy staging…",
        status: "idle",
        items: [
          "Build completed",
          "Waiting for review…",
        ],
        autoMode: true,
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
        items: [
          "Generating unit tests for",
          "src/features/auth/…",
        ],
        duration: "Cooked for 3m 45s",
        autoMode: true,
        agentCount: 5,
      },
      {
        id: "pane-8",
        title: "Code review…",
        status: "idle",
        items: [
          "PR #142 reviewed",
          "2 suggestions…",
        ],
        autoMode: true,
        agentCount: 2,
      },
    ],
  },
]

export function BridgeMindLayout({ workspaces: propWorkspaces, className }: BridgeMindLayoutProps) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("bridgemind-1")
  const [activePaneId, setActivePaneId] = useState<string | null>("pane-3")

  const workspaces = propWorkspaces ?? mockWorkspaces
  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)
  const panes = activeWorkspace?.panes ?? []

  return (
    <div className={cn("flex h-screen bg-bm-bg overflow-hidden", className)}>
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
              <AgentPane
                title={pane.title}
                active={pane.id === activePaneId}
                status={pane.status}
                progress={pane.progress}
                items={pane.items}
                bulletPoints={pane.bulletPoints}
                warning={pane.warning}
                server={pane.server}
                controlPanel={pane.controlPanel}
                duration={pane.duration}
                autoMode={pane.autoMode}
                agentCount={pane.agentCount}
                className="h-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
