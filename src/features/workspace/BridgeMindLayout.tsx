"use client"

import { useState, useRef } from "react"
import { BridgeMindSidebar } from "@/components/BridgeMindSidebar"
import { Pane } from "@/components/Pane"
import { CreateWorkspaceDialog } from "@/components/CreateWorkspaceDialog"
import { PaneTerminalProvider } from "@/features/terminal/pane-terminal-store"
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
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(mockWorkspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("gpt-1")
  const [activePaneId, setActivePaneId] = useState<string | null>("pane-7")
  const [dialogOpen, setDialogOpen] = useState(false)
  const wsCounterRef = useRef(0)

  const createWorkspace = () => {
    setDialogOpen(true)
  }

  const handleWorkspaceCreated = (workspaceId: string) => {
    wsCounterRef.current++
    const newWs: WorkspaceData = {
      id: workspaceId,
      name: `Workspace ${wsCounterRef.current}`,
      count: 0,
      panes: [],
    }
    setWorkspaces((prev) => [...prev, newWs])
    setActiveWorkspaceId(newWs.id)
    setActivePaneId(null)
  }

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)
  const panes = activeWorkspace?.panes ?? []

  return (
    <div className="flex h-screen bg-bm-bg overflow-hidden">
      <BridgeMindSidebar
        workspaces={workspaces.map((ws) => ({
          ...ws,
          panes: ws.panes.map((p) => ({ title: p.title, status: p.status })),
        }))}
        activeWorkspaceId={activeWorkspaceId}
        onSelect={(id) => {
          setActiveWorkspaceId(id)
          const ws = workspaces.find((w) => w.id === id)
          setActivePaneId(ws?.panes[0]?.id ?? null)
        }}
        onCreateWorkspace={createWorkspace}
        className="w-52 shrink-0"
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

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
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
