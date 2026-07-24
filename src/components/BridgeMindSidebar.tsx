"use client"

import { cn } from "@/lib/utils"

interface WorkspaceItem {
  id: string
  name: string
  count: number
}

interface BridgeMindSidebarProps {
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string
  onSelect: (id: string) => void
  className?: string
}

export function BridgeMindSidebar({
  workspaces,
  activeWorkspaceId,
  onSelect,
  className,
}: BridgeMindSidebarProps) {
  const total = workspaces.reduce((sum, ws) => sum + ws.count, 0)

  return (
    <div className={cn("bm-sidebar", className)}>
      <div className="bm-sidebar-header">
        WORKSPACES {total}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            className={cn(
              "bm-sidebar-item",
              ws.id === activeWorkspaceId && "bm-sidebar-item-active"
            )}
          >
            <span className="truncate text-[12px]">{ws.name}</span>
            <span className="bm-badge">{ws.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
