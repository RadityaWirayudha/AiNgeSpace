"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { Plus, LayoutGrid } from "lucide-react"
import { BridgeMindSidebar } from "@/components/BridgeMindSidebar"
import { Pane } from "@/components/Pane"
import {
  CreateWorkspaceDialog,
  type WorkspaceDraft,
} from "@/components/CreateWorkspaceDialog"
import { PaneTerminalProvider } from "@/features/terminal/pane-terminal-store"
import { PaneTerminalManager } from "@/features/terminal/PaneTerminalManager"
import { cn } from "@/lib/utils"

interface PaneData {
  id: string
  title: string
  status: "running" | "idle" | "warning" | "error"
  progress?: number
  duration?: string
  agentCount?: number
  pinned?: boolean
}

interface WorkspaceData {
  id: string
  name: string
  panes: PaneData[]
}

const initialWorkspaces: WorkspaceData[] = [
  {
    id: "swarm-1",
    name: "Swarm",
    panes: [
      { id: "pane-1", title: "Review project structure", status: "idle", agentCount: 3 },
      { id: "pane-2", title: "Audit dependency tree", status: "idle", agentCount: 2 },
    ],
  },
  {
    id: "gpt-1",
    name: "GPT 5.5",
    panes: [
      {
        id: "pane-7",
        title: "Generate integration tests",
        status: "running",
        progress: 72,
        duration: "Cooked for 3m 45s",
        agentCount: 5,
      },
      { id: "pane-8", title: "Code review pass", status: "idle", agentCount: 2 },
    ],
  },
]

/** Keeps panes roughly square: the old layout was pinned to two columns, so a
 *  single pane rendered at half width with dead space beside it, and six panes
 *  produced three cramped rows. */
function gridFor(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1"
  if (count === 2) return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
  if (count <= 4) return "grid-cols-1 grid-rows-4 md:grid-cols-2 md:grid-rows-2"
  if (count <= 6) return "grid-cols-2 grid-rows-3 lg:grid-cols-3 lg:grid-rows-2"
  return "grid-cols-2 grid-rows-4 lg:grid-cols-4 lg:grid-rows-2"
}

function EmptyState({
  onCreate,
  /** With every workspace closed there is nothing to add a pane *to*, so the
   *  call to action has to change with it. */
  variant = "pane",
}: {
  onCreate: () => void
  variant?: "pane" | "workspace"
}) {
  const isPane = variant === "pane"
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="size-10 rounded-md border border-bm-border bg-bm-pane flex items-center justify-center">
        <LayoutGrid className="size-4 text-bm-text-dim" />
      </div>
      <div>
        <p className="text-[13px] text-bm-text font-medium">
          {isPane ? "No panes yet" : "No workspaces"}
        </p>
        <p className="text-[11px] text-bm-text-secondary mt-1 max-w-xs">
          {isPane
            ? "This workspace is empty. Add a pane to start a terminal and attach agents to it."
            : "Create a workspace to pick a repository, a pane layout, and the agents that run in it."}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-sm border border-bm-border bg-bm-pane-header text-[11px] text-bm-text hover:border-bm-live/40 hover:text-bm-text transition-colors"
      >
        <Plus className="size-3" />
        {isPane ? "Add pane" : "New workspace"}
      </button>
    </div>
  )
}

function BridgeMindInner() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>(initialWorkspaces)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("gpt-1")
  const [activePaneId, setActivePaneId] = useState<string | null>("pane-7")
  const [expandedPaneId, setExpandedPaneId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  // Monotonic counter instead of Date.now(): two panes added in the same
  // millisecond used to collide on the same React key.
  const paneSeq = useRef(0)

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)
  const panes = activeWorkspace?.panes ?? []

  const handleWorkspaceCreated = useCallback((draft: WorkspaceDraft) => {
    // The dialog used to hand back only an id, so the name the user typed and
    // the layout they picked were both discarded.
    const newWs: WorkspaceData = {
      id: draft.id,
      name: draft.name,
      panes: Array.from({ length: draft.terminalCount }, (_, i) => ({
        id: `${draft.id}-pane-${i + 1}`,
        title: draft.repo ? `${draft.repo} · pane ${i + 1}` : `Pane ${i + 1}`,
        status: "idle" as const,
        agentCount: draft.agentCount,
      })),
    }
    setWorkspaces((prev) => [...prev, newWs])
    setActiveWorkspaceId(newWs.id)
    setActivePaneId(newWs.panes[0]?.id ?? null)
    setExpandedPaneId(null)
  }, [])

  /** Adding a pane works on any workspace, so the sidebar's per-row `+` can
   *  target a workspace without first making it active. */
  const addPaneTo = useCallback((workspaceId: string) => {
    paneSeq.current += 1
    const paneId = `${workspaceId}-p${paneSeq.current}`
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === workspaceId
          ? {
              ...ws,
              panes: [
                ...ws.panes,
                {
                  id: paneId,
                  title: `Pane ${ws.panes.length + 1}`,
                  status: "idle",
                  agentCount: 0,
                },
              ],
            }
          : ws
      )
    )
    // Selection is state, not a side effect of the updater — setting it inside
    // the map callback fired twice under StrictMode.
    setActiveWorkspaceId(workspaceId)
    setActivePaneId(paneId)
    setExpandedPaneId(null)
  }, [])

  const addPane = useCallback(
    () => addPaneTo(activeWorkspaceId),
    [addPaneTo, activeWorkspaceId]
  )

  const closePane = useCallback((workspaceId: string, paneId: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, panes: ws.panes.filter((p) => p.id !== paneId) }
          : ws
      )
    )
    // A closed pane must not stay expanded or keep selection.
    setExpandedPaneId((cur) => (cur === paneId ? null : cur))
    setActivePaneId((cur) => (cur === paneId ? null : cur))
  }, [])

  const renameWorkspace = useCallback((workspaceId: string, name: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === workspaceId ? { ...ws, name } : ws))
    )
  }, [])

  const deleteWorkspace = useCallback(
    (workspaceId: string) => {
      const index = workspaces.findIndex((ws) => ws.id === workspaceId)
      if (index < 0) return
      const next = workspaces.filter((ws) => ws.id !== workspaceId)
      setWorkspaces(next)
      // Closing the active workspace has to hand focus to a survivor, or the
      // grid renders empty with no obvious way back.
      if (activeWorkspaceId === workspaceId) {
        const fallback = next[Math.min(index, next.length - 1)]
        setActiveWorkspaceId(fallback?.id ?? "")
        setActivePaneId(fallback?.panes[0]?.id ?? null)
        setExpandedPaneId(null)
      }
    },
    [workspaces, activeWorkspaceId]
  )

  /** The sidebar hands back the full id list in its new order; ids it does not
   *  know about (a workspace created mid-drag) keep their relative position at
   *  the end rather than being dropped. */
  const reorderWorkspaces = useCallback((orderedIds: string[]) => {
    setWorkspaces((prev) => {
      const byId = new Map(prev.map((ws) => [ws.id, ws]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((ws): ws is WorkspaceData => ws !== undefined)
      const seen = new Set(next.map((ws) => ws.id))
      for (const ws of prev) if (!seen.has(ws.id)) next.push(ws)
      return next
    })
  }, [])

  const togglePin = useCallback(
    (paneId: string) => {
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspaceId
            ? {
                ...ws,
                panes: ws.panes.map((p) =>
                  p.id === paneId ? { ...p, pinned: !p.pinned } : p
                ),
              }
            : ws
        )
      )
    },
    [activeWorkspaceId]
  )

  const sidebarWorkspaces = useMemo(
    () =>
      workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        // Count was a hand-maintained field that drifted from reality the
        // moment a pane was added or closed.
        count: ws.panes.length,
        panes: ws.panes.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
      })),
    [workspaces]
  )

  const visiblePanes = expandedPaneId
    ? panes.filter((p) => p.id === expandedPaneId)
    : panes

  return (
    <div className="flex h-screen bg-bm-bg overflow-hidden">
      <BridgeMindSidebar
        workspaces={sidebarWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        activePaneId={activePaneId}
        onSelect={(id) => {
          setActiveWorkspaceId(id)
          const ws = workspaces.find((w) => w.id === id)
          setActivePaneId(ws?.panes[0]?.id ?? null)
          setExpandedPaneId(null)
        }}
        onSelectPane={(wsId, paneId) => {
          setActiveWorkspaceId(wsId)
          setActivePaneId(paneId)
          setExpandedPaneId(null)
        }}
        onCreateWorkspace={() => setDialogOpen(true)}
        onAddPane={addPaneTo}
        onClosePane={closePane}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        onReorderWorkspaces={reorderWorkspaces}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {workspaces.length === 0 ? (
          <EmptyState
            variant="workspace"
            onCreate={() => setDialogOpen(true)}
          />
        ) : panes.length === 0 ? (
          <EmptyState onCreate={addPane} />
        ) : (
          <div
            className={cn(
              "grid gap-px flex-1 p-px min-h-0 min-w-0",
              gridFor(visiblePanes.length)
            )}
          >
            {visiblePanes.map((pane) => (
              <Pane
                key={pane.id}
                title={pane.title}
                active={pane.id === activePaneId}
                status={pane.status}
                progress={pane.progress}
                pinned={pane.pinned}
                flush
                className="h-full min-h-0"
                expanded={expandedPaneId === pane.id}
                onToggleExpand={() =>
                  setExpandedPaneId((cur) => (cur === pane.id ? null : pane.id))
                }
                onPin={() => togglePin(pane.id)}
                onClose={() => closePane(activeWorkspaceId, pane.id)}
                footer={
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-bm-text-dim">»</span>
                      <span className="truncate">auto mode on</span>
                      {!!pane.agentCount && (
                        <span className="text-bm-text-dim shrink-0">
                          · {pane.agentCount} agent
                          {pane.agentCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                    {pane.duration && (
                      <span className="shrink-0 text-bm-text-dim">
                        {pane.duration}
                      </span>
                    )}
                  </div>
                }
              >
                {/* Selecting a pane happens on mousedown of its body/header so
                    that clicking into a terminal also focuses the pane. */}
                <div
                  className="w-full h-full"
                  onMouseDown={() => setActivePaneId(pane.id)}
                >
                  <PaneTerminalManager paneId={pane.id} />
                </div>
              </Pane>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleWorkspaceCreated}
      />
    </div>
  )
}

export function BridgeMindLayout() {
  return (
    <PaneTerminalProvider>
      <BridgeMindInner />
    </PaneTerminalProvider>
  )
}
