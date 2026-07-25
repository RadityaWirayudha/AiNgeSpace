"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Maximize2,
  Minimize2,
  X,
  MoreHorizontal,
  Pin,
  Copy,
  Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  usePaneTerminalStore,
  type PaneTerminalNode,
} from "./pane-terminal-store"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const TerminalPanel = dynamic(
  () => import("./TerminalPanel").then((mod) => mod.TerminalPanel),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-bm-pane flex items-center justify-center">
        <div className="size-4 rounded-full border-2 border-purple/30 border-t-purple animate-spin" />
      </div>
    ),
  }
)

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  variant = "ghost",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: "ghost" | "destructive"
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={(e) => { e.stopPropagation(); onClick() }}
            className={cn(
              "inline-flex items-center justify-center size-5 rounded-sm transition-colors outline-none",
              "text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.06]",
              variant === "destructive" &&
                "hover:text-destructive hover:bg-destructive/10"
            )}
          />
        }
      >
        <Icon className="size-3" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-mono">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function OverflowMenu({
  paneId,
  terminalId,
}: {
  paneId: string
  terminalId: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const menuItems = [
    { icon: Pin, label: "Pin Terminal", action: () => {} },
    { icon: Copy, label: "Duplicate", action: () => {} },
    { icon: Pencil, label: "Rename", action: () => {} },
  ]

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn
        icon={MoreHorizontal}
        label="More Actions"
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 py-1 rounded-md border border-bm-border bg-bm-pane-header shadow-xl shadow-black/50 z-50">
          {menuItems.map((item, i) => (
            <button
              key={i}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.04] transition-colors outline-none"
              onClick={() => {
                item.action()
                setOpen(false)
              }}
            >
              <item.icon className="size-3 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SplitBtn({
  direction,
  label,
  onClick,
}: {
  direction: "horizontal" | "vertical"
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={(e) => { e.stopPropagation(); onClick() }}
            className={cn(
              "inline-flex items-center justify-center size-5 rounded-sm transition-colors outline-none",
              "text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.06]"
            )}
          />
        }
      >
        {direction === "horizontal" ? (
          <div className="flex gap-[1px] w-3 h-2">
            <div className="flex-1 rounded-[1px] bg-bm-text-secondary/70" />
            <div className="flex-1 rounded-[1px] bg-bm-border" />
          </div>
        ) : (
          <div className="flex flex-col gap-[1px] w-2.5 h-2.5">
            <div className="flex-1 rounded-[1px] bg-bm-text-secondary/70" />
            <div className="flex-1 rounded-[1px] bg-bm-border" />
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-mono">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function TerminalNode({
  node,
  paneId,
}: {
  node: PaneTerminalNode
  paneId: string
}) {
  const {
    state,
    splitTerminal,
    closeTerminal,
    expandTerminal,
    setActive,
  } = usePaneTerminalStore()

  if (node.type === "leaf") {
    const isActive = state.activeTerminalId === node.terminalId

    return (
      <div
        className={cn(
          "flex flex-col min-h-0 min-w-0 overflow-hidden",
          isActive && "ring-1 ring-purple/50"
        )}
        onClick={() => setActive(node.terminalId)}
      >
        <div
          className={cn(
            "flex items-center justify-between h-7 px-2 border-b shrink-0 transition-colors",
            isActive
              ? "border-purple/20 bg-bm-pane-header"
              : "border-bm-border bg-bm-pane"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {isActive && (
              <span className="size-1.5 rounded-full bg-purple animate-pulse shrink-0" />
            )}
            <span
              className={cn(
                "text-[10px] font-medium font-mono truncate",
                isActive ? "text-bm-text" : "text-bm-text-secondary"
              )}
            >
              {node.name}
            </span>
          </div>

          <div
            className="flex items-center gap-0.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <OverflowMenu paneId={paneId} terminalId={node.terminalId} />
            <div className="w-px h-3 bg-bm-border mx-0.5" />
            <ToolbarBtn
              icon={state.trees[paneId]?.type === "leaf" ? Maximize2 : Minimize2}
              label={state.trees[paneId]?.type === "leaf" ? "Expand" : "Restore"}
              onClick={() => expandTerminal(paneId, node.terminalId)}
            />
            <SplitBtn
              direction="horizontal"
              label="Split Horizontal"
              onClick={() => splitTerminal(paneId, node.terminalId, "horizontal")}
            />
            <SplitBtn
              direction="vertical"
              label="Split Vertical"
              onClick={() => splitTerminal(paneId, node.terminalId, "vertical")}
            />
            <div className="w-px h-3 bg-bm-border mx-0.5" />
            <ToolbarBtn
              icon={X}
              label="Close"
              onClick={() => closeTerminal(paneId, node.terminalId)}
              variant="destructive"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <TerminalPanel
            terminalId={node.terminalId}
            isActive={isActive}
            onFocus={() => setActive(node.terminalId)}
          />
        </div>
      </div>
    )
  }

  const isHorizontal = node.direction === "horizontal"

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col"
      )}
    >
      {node.children.map((child, i) => (
        <div
          key={child.id}
          className={cn(
            "min-h-0 min-w-0 overflow-hidden flex-1",
            i > 0 && isHorizontal && "border-l border-bm-border",
            i > 0 && !isHorizontal && "border-t border-bm-border"
          )}
        >
          <TerminalNode node={child} paneId={paneId} />
        </div>
      ))}
    </div>
  )
}

export function PaneTerminalManager({ paneId }: { paneId: string }) {
  const { state, initPane } = usePaneTerminalStore()
  const tree = state.trees[paneId]
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized && paneId) {
      const termId = `bm-init-${paneId}`
      initPane(paneId, termId, "Terminal A")
      setInitialized(true)
    }
  }, [paneId, initialized, initPane])

  if (!tree) {
    return (
      <div className="w-full h-full bg-bm-pane flex items-center justify-center">
        <div className="size-4 rounded-full border-2 border-purple/30 border-t-purple animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-hidden">
      <TerminalNode node={tree} paneId={paneId} />
    </div>
  )
}
