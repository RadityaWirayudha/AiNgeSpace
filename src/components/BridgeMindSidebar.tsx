"use client"

import { useState, useMemo, useId } from "react"
import { ChevronDown, ChevronRight, Search, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarPane {
  id: string
  title: string
  status: string
}

interface WorkspaceItem {
  id: string
  name: string
  count: number
  panes?: SidebarPane[]
}

interface BridgeMindSidebarProps {
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string
  activePaneId?: string | null
  onSelect: (id: string) => void
  onSelectPane?: (workspaceId: string, paneId: string) => void
  onCreateWorkspace?: () => void
  className?: string
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "running"
      ? "bg-bm-live bm-dot-live"
      : status === "warning"
        ? "bg-bm-warning"
        : status === "error"
          ? "bg-destructive"
          : "bg-bm-text-dim"

  return (
    <span className={cn("size-1.5 rounded-full shrink-0", tone)}>
      <span className="sr-only">{status}</span>
    </span>
  )
}

function WorkspaceGroup({
  workspace,
  isActive,
  activePaneId,
  onSelect,
  onSelectPane,
}: {
  workspace: WorkspaceItem
  isActive: boolean
  activePaneId?: string | null
  onSelect: () => void
  onSelectPane?: (paneId: string) => void
}) {
  // Collapse state is intentionally uncontrolled, but it must not be seeded
  // once and then drift: only the active workspace expands, and selecting a
  // different one always opens it.
  const [collapsed, setCollapsed] = useState(false)
  const showChildren = isActive && !collapsed
  const hasRunning = workspace.panes?.some((p) => p.status === "running")
  const listId = useId()

  return (
    <div className="mb-0.5">
      <div className="mx-1">
        <button
          type="button"
          aria-expanded={showChildren}
          aria-controls={listId}
          onClick={() => {
            if (isActive) {
              setCollapsed((c) => !c)
            } else {
              setCollapsed(false)
              onSelect()
            }
          }}
          className={cn(
            "flex items-center gap-1.5 w-full px-2 py-1.5 text-left rounded-sm transition-colors",
            isActive
              ? "bg-white/[0.06] text-bm-text"
              : "text-bm-text-secondary hover:bg-white/[0.03] hover:text-bm-text"
          )}
        >
          <span className="shrink-0 text-bm-text-dim">
            {showChildren ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </span>

          {/* Orange means live, per the palette — a running workspace is the one
              thing in the sidebar allowed to use an accent. */}
          {hasRunning && <span className="size-1.5 rounded-full bg-bm-live shrink-0" />}

          <span className="truncate text-[11px] font-medium flex-1">
            {workspace.name}
          </span>

          <span
            className={cn(
              "text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0 tabular-nums",
              isActive
                ? "bg-white/[0.08] text-bm-text-secondary"
                : "bg-white/[0.04] text-bm-text-dim"
            )}
          >
            {workspace.count}
          </span>
        </button>
      </div>

      {showChildren && workspace.panes && workspace.panes.length > 0 && (
        <div id={listId} className="ml-4 mt-0.5 mb-1 pl-1 border-l border-bm-border">
          {workspace.panes.map((pane) => (
            <button
              key={pane.id}
              type="button"
              // These rows had cursor-pointer and hover states but no handler,
              // so they read as interactive and did nothing.
              onClick={() => onSelectPane?.(pane.id)}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1 text-[10px] rounded-sm transition-colors text-left",
                pane.id === activePaneId
                  ? "text-bm-text bg-white/[0.04]"
                  : "text-bm-text-dim hover:text-bm-text-secondary hover:bg-white/[0.02]"
              )}
            >
              <StatusDot status={pane.status} />
              <span className="truncate">{pane.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BridgeMindSidebar({
  workspaces,
  activeWorkspaceId,
  activePaneId,
  onSelect,
  onSelectPane,
  onCreateWorkspace,
  className,
}: BridgeMindSidebarProps) {
  const [query, setQuery] = useState("")

  const totalPanes = workspaces.reduce((sum, ws) => sum + ws.count, 0)
  const activeCount = workspaces.filter((ws) =>
    ws.panes?.some((p) => p.status === "running")
  ).length

  // The search field was a decorative div with placeholder text that could not
  // be typed into. Now it filters on workspace and pane titles.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workspaces
    return workspaces.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        ws.panes?.some((p) => p.title.toLowerCase().includes(q))
    )
  }, [workspaces, query])

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 bg-bm-bg border-r border-bm-border",
        className
      )}
    >
      <div className="px-3 py-3 border-b border-bm-border shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-5 rounded bg-gradient-to-br from-purple to-violet flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-white">BM</span>
          </div>
          <span className="text-[11px] font-semibold text-bm-text tracking-wide">
            BridgeMind
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-bm-text-dim">
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "size-1.5 rounded-full",
                activeCount > 0 ? "bg-bm-live" : "bg-bm-text-dim"
              )}
            />
            {activeCount} live
          </span>
          <span>·</span>
          <span className="tabular-nums">{totalPanes} panes</span>
        </div>
      </div>

      <div className="px-2 py-2 shrink-0">
        <div className="flex items-center gap-1.5 h-7 px-2 rounded-sm bg-white/[0.02] border border-bm-border focus-within:border-bm-link/40 transition-colors">
          <Search className="size-3 text-bm-text-dim shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces…"
            aria-label="Search workspaces"
            className="flex-1 min-w-0 bg-transparent text-[10px] text-bm-text placeholder:text-bm-text-dim outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="text-bm-text-dim hover:text-bm-text shrink-0"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      <div className="px-3 pb-1 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium text-bm-text-dim uppercase tracking-widest">
            Workspaces
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-bm-text-dim tabular-nums">
              {filtered.length}
            </span>
            {onCreateWorkspace && (
              <button
                type="button"
                aria-label="Create workspace"
                onClick={onCreateWorkspace}
                className="inline-flex items-center justify-center size-4 rounded-sm text-bm-text-dim hover:text-bm-text hover:bg-white/[0.06] transition-colors"
              >
                <Plus className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pb-4">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-[10px] text-bm-text-dim">
            No workspaces match “{query}”.
          </p>
        ) : (
          filtered.map((ws) => (
            <WorkspaceGroup
              key={ws.id}
              workspace={ws}
              isActive={ws.id === activeWorkspaceId}
              activePaneId={activePaneId}
              onSelect={() => onSelect(ws.id)}
              onSelectPane={(paneId) => onSelectPane?.(ws.id, paneId)}
            />
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-bm-border text-[9px] text-bm-text-dim font-mono shrink-0">
        BridgeMind v1.0
      </div>
    </div>
  )
}
