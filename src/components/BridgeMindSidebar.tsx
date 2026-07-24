"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Activity,
  Layers,
  Search,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkspaceItem {
  id: string
  name: string
  count: number
  status?: "active" | "idle" | "warning"
  panes?: { title: string; status: string }[]
}

interface BridgeMindSidebarProps {
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string
  onSelect: (id: string) => void
  onCreateWorkspace?: () => void
  className?: string
}

function StatusDot({ status }: { status?: string }) {
  if (status === "running") {
    return <Circle className="size-1.5 fill-purple text-purple animate-pulse" />
  }
  if (status === "warning") {
    return <Circle className="size-1.5 fill-amber-500 text-amber-500" />
  }
  return <Circle className="size-1.5 fill-zinc-600 text-zinc-600" />
}

function WorkspaceGroup({
  workspace,
  isActive,
  onSelect,
}: {
  workspace: WorkspaceItem
  isActive: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(isActive)

  const hasRunning = workspace.panes?.some((p) => p.status === "running")

  return (
    <div className="mb-0.5">
      <button
        onClick={() => {
          onSelect()
          setExpanded(!expanded)
        }}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-1.5 text-left transition-all duration-150 outline-none group rounded-sm mx-1",
          isActive
            ? "bg-purple/10 text-bm-text"
            : "text-bm-text-secondary hover:bg-white/[0.03] hover:text-bm-text"
        )}
        style={{ width: "calc(100% - 8px)" }}
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0 text-zinc-600" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-zinc-600" />
        )}

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasRunning ? (
            <Activity className="size-3 text-purple shrink-0" />
          ) : (
            <Layers className="size-3 text-zinc-600 shrink-0" />
          )}
          <span className="truncate text-[11px] font-medium">{workspace.name}</span>
        </div>

        <span
          className={cn(
            "text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0",
            isActive
              ? "bg-purple/20 text-purple"
              : "bg-white/[0.04] text-zinc-600"
          )}
        >
          {workspace.count}
        </span>
      </button>

      {expanded && workspace.panes && workspace.panes.length > 0 && (
        <div className="ml-5 mt-0.5 mb-1">
          {workspace.panes.map((pane, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer rounded-sm"
            >
              <StatusDot status={pane.status} />
              <span className="truncate">{pane.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BridgeMindSidebar({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateWorkspace,
  className,
}: BridgeMindSidebarProps) {
  const total = workspaces.reduce((sum, ws) => sum + ws.count, 0)
  const activeCount = workspaces.filter(
    (ws) => ws.panes?.some((p) => p.status === "running")
  ).length

  return (
    <div className={cn("flex flex-col h-full bg-bm-bg border-r border-bm-border", className)}>
      <div className="px-3 py-3 border-b border-bm-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-5 rounded bg-gradient-to-br from-purple to-violet flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">BM</span>
          </div>
          <span className="text-[11px] font-semibold text-bm-text tracking-wide">
            BridgeMind
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple/60" />
            {activeCount} active
          </span>
          <span className="text-zinc-700">·</span>
          <span>{total} agents</span>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-white/[0.02] border border-bm-border/50 text-zinc-600 text-[10px]">
          <Search className="size-3" />
          <span>Search workspaces…</span>
        </div>
      </div>

      <div className="px-2 mb-1">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[9px] font-medium text-zinc-700 uppercase tracking-widest">
            Workspaces
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-zinc-700">{workspaces.length}</span>
            {onCreateWorkspace && (
              <button
                onClick={onCreateWorkspace}
                className="inline-flex items-center justify-center size-4 rounded-sm text-zinc-600 hover:text-bm-text hover:bg-white/[0.06] transition-colors outline-none"
              >
                <Plus className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
        {workspaces.map((ws) => (
          <WorkspaceGroup
            key={ws.id}
            workspace={ws}
            isActive={ws.id === activeWorkspaceId}
            onSelect={() => onSelect(ws.id)}
          />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-bm-border/50 text-[9px] text-zinc-700 font-mono">
        BridgeMind v1.0
      </div>
    </div>
  )
}
