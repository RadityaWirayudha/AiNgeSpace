"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import {
  Maximize2,
  Minimize2,
  X,
  MoreHorizontal,
  Copy,
  Pencil,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  usePaneTerminalStore,
  countLeaves,
  findLeaf,
  type PaneTerminalNode,
} from "./pane-terminal-store"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function TerminalFallback({ label }: { label: string }) {
  return (
    <div className="w-full h-full bg-bm-terminal flex items-center justify-center gap-2">
      <div className="size-3.5 rounded-full border-2 border-bm-border border-t-bm-text-secondary animate-spin" />
      <span className="text-[10px] text-bm-text-dim">{label}</span>
    </div>
  )
}

const TerminalPanel = dynamic(
  () => import("./TerminalPanel").then((mod) => mod.TerminalPanel),
  {
    ssr: false,
    loading: () => <TerminalFallback label="loading shell…" />,
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
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className={cn(
              "inline-flex items-center justify-center size-5 rounded-sm transition-colors",
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
  onRename,
}: {
  paneId: string
  terminalId: string
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { duplicateTerminal, closeTerminal, state } = usePaneTerminalStore()
  const tree = state.trees[paneId]
  const canClose = tree ? countLeaves(tree) > 1 : false

  // The menu had no dismiss path at all: it stayed open until its own button
  // was clicked again, and stacked on top of other panes' menus.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const items = [
    {
      icon: Pencil,
      label: "Rename",
      action: onRename,
      disabled: false,
    },
    {
      icon: Copy,
      label: "Duplicate",
      action: () => duplicateTerminal(paneId, terminalId),
      disabled: false,
    },
    {
      icon: X,
      label: "Close terminal",
      action: () => closeTerminal(paneId, terminalId),
      disabled: !canClose,
    },
  ]

  return (
    <div ref={ref} className="relative">
      <ToolbarBtn
        icon={MoreHorizontal}
        label="More actions"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 w-40 py-1 rounded-md border border-bm-border bg-bm-pane-header shadow-xl shadow-black/50 z-50"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-[11px] transition-colors text-left",
                item.disabled
                  ? "text-bm-text-dim cursor-not-allowed"
                  : "text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.04]"
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (item.disabled) return
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

function TerminalLeafView({
  node,
  paneId,
}: {
  node: Extract<PaneTerminalNode, { type: "leaf" }>
  paneId: string
}) {
  const {
    state,
    splitTerminal,
    closeTerminal,
    toggleMaximize,
    renameTerminal,
    setActive,
  } = usePaneTerminalStore()

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(node.name)

  const isActive = state.activeTerminalId === node.terminalId
  const tree = state.trees[paneId]
  const leafCount = tree ? countLeaves(tree) : 1
  const isMaximized = state.maximized[paneId] === node.terminalId

  const commitRename = () => {
    renameTerminal(paneId, node.terminalId, draft)
    setRenaming(false)
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 min-w-0 overflow-hidden",
        isActive &&
          leafCount > 1 &&
          "border border-[color:var(--bm-live)] [box-shadow:inset_0_0_0_1px_var(--bm-live)] transition-[border-color,box-shadow] duration-150 ease-out"
      )}
      onClick={() => setActive(node.terminalId)}
    >
      <div
        className={cn(
          "flex items-center justify-between h-7 pl-2 pr-1 border-b shrink-0 gap-2 transition-colors",
          isActive
            ? "border-bm-live/25 bg-bm-pane-header"
            : "border-bm-border bg-bm-pane"
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {isActive && (
            <span className="size-1.5 rounded-full bg-bm-live shrink-0" />
          )}
          {renaming ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") {
                  setDraft(node.name)
                  setRenaming(false)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-28 bg-bm-bg border border-bm-live/40 rounded-sm px-1 text-[10px] font-mono text-bm-text outline-none"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setDraft(node.name)
                setRenaming(true)
              }}
              className={cn(
                "text-[10px] font-medium font-mono truncate",
                isActive ? "text-bm-text" : "text-bm-text-secondary"
              )}
            >
              {node.name}
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <OverflowMenu
            paneId={paneId}
            terminalId={node.terminalId}
            onRename={() => {
              setDraft(node.name)
              setRenaming(true)
            }}
          />
          <div className="w-px h-3 bg-bm-border mx-0.5" />
          {/* Maximize is meaningless with one terminal — the old build showed
              it anyway and clicking it silently deleted siblings. */}
          {leafCount > 1 && (
            <ToolbarBtn
              icon={isMaximized ? Minimize2 : Maximize2}
              label={isMaximized ? "Restore split" : "Maximize"}
              onClick={() => toggleMaximize(paneId, node.terminalId)}
            />
          )}
          <ToolbarBtn
            icon={SplitSquareHorizontal}
            label="Split right"
            onClick={() => splitTerminal(paneId, node.terminalId, "horizontal")}
          />
          <ToolbarBtn
            icon={SplitSquareVertical}
            label="Split down"
            onClick={() => splitTerminal(paneId, node.terminalId, "vertical")}
          />
          {leafCount > 1 && (
            <>
              <div className="w-px h-3 bg-bm-border mx-0.5" />
              <ToolbarBtn
                icon={X}
                label="Close terminal"
                onClick={() => closeTerminal(paneId, node.terminalId)}
                variant="destructive"
              />
            </>
          )}
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

function TerminalNode({
  node,
  paneId,
}: {
  node: PaneTerminalNode
  paneId: string
}) {
  if (node.type === "leaf") {
    return <TerminalLeafView node={node} paneId={paneId} />
  }

  const isHorizontal = node.direction === "horizontal"

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col"
      )}
    >
      {node.children.map((child, i) => (
        <div
          key={child.id}
          // basis-0 with flex-1 makes siblings share space evenly regardless of
          // content; without it a chatty terminal pushes the others to nothing.
          className={cn(
            "min-h-0 min-w-0 overflow-hidden flex-1 basis-0",
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
  const maximizedId = state.maximized[paneId]

  useEffect(() => {
    if (!paneId || state.trees[paneId]) return
    initPane(paneId, `bm-init-${paneId}`, "Terminal A")
    // Keyed off the tree rather than a local `initialized` flag so that a pane
    // remounting (workspace switch) re-initialises instead of rendering forever
    // against a tree that no longer exists.
  }, [paneId, state.trees, initPane])

  if (!tree) return <TerminalFallback label="attaching…" />

  const maximizedLeaf = maximizedId ? findLeaf(tree, maximizedId) : null

  return (
    <div className="w-full h-full overflow-hidden">
      <TerminalNode node={maximizedLeaf ?? tree} paneId={paneId} />
    </div>
  )
}
