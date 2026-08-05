"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react"
import dynamic from "next/dynamic"
import {
  Maximize2,
  Minimize2,
  X,
  MoreHorizontal,
  Copy,
  Pencil,
  Keyboard,
  SplitSquareHorizontal,
  SplitSquareVertical,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  usePaneTerminalState,
  usePaneTerminalActions,
  collectTerminals,
  countLeaves,
  findLeaf,
  type PaneTerminalNode,
  type TerminalSplit,
  type PaneTerminalActions,
} from "./pane-terminal-store"
import { formatChord, matchAction, useKeymap } from "./keybindings"
import { useShortcutsDialog } from "@/components/KeyboardShortcutsDialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Smallest a pane may be dragged to. Below this the header alone fills it and
 *  the terminal underneath is a single unreadable row. */
const MIN_PANE_PX = 48

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

/* ------------------------------------------------------------------
   REGISTRY ACCESS
-------------------------------------------------------------------*/

type Registry = typeof import("./terminal-instances")

let registry: Registry | null = null
let registryLoad: Promise<unknown> | null = null

/**
 * The registry pulls in xterm, which must stay out of the server render and out
 * of the initial chunk — the same reason `TerminalPanel` goes through
 * `next/dynamic`. Every caller here runs in response to a pointer or a key, by
 * which point a terminal has mounted and already loaded the module, so the
 * cached reference makes the real path synchronous and the `null` branch only
 * ever covers a race nobody can trigger by hand.
 */
function getRegistry(): Registry | null {
  if (!registry && !registryLoad) {
    registryLoad = import("./terminal-instances").then((mod) => {
      registry = mod
    })
  }
  return registry
}

/** Chords are for the grid, not for whatever the user is typing into. xterm's
 *  own hidden textarea is the exception: it holds focus whenever a terminal is
 *  in use, which is precisely when these shortcuts have to work. */
function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return false
  return !el.classList.contains("xterm-helper-textarea")
}

/* ------------------------------------------------------------------
   TOOLBAR
-------------------------------------------------------------------*/

function ToolbarBtn({
  icon: Icon,
  label,
  chord,
  onClick,
  variant = "ghost",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  /** Encoded chord from the keymap. Read live, so rebinding updates the tooltip
   *  without a reload. */
  chord?: string
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
        {chord && (
          <span className="ml-1.5 text-bm-text-dim">{formatChord(chord)}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function OverflowMenu({
  paneId,
  terminalId,
  canClose,
  onRename,
}: {
  paneId: string
  terminalId: string
  canClose: boolean
  onRename: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { duplicateTerminal, closeTerminal } = usePaneTerminalActions()
  const shortcuts = useShortcutsDialog()
  const keymap = useKeymap()

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
      chord: keymap["terminal.rename"],
      action: onRename,
      disabled: false,
    },
    {
      icon: Copy,
      label: "Duplicate",
      chord: keymap["terminal.duplicate"],
      action: () => duplicateTerminal(paneId, terminalId),
      disabled: false,
    },
    {
      icon: X,
      label: "Close terminal",
      chord: keymap["terminal.close"],
      action: () => closeTerminal(paneId, terminalId),
      disabled: !canClose,
    },
    // Third of the three discovery routes for the keymap, sitting where the
    // user already is rather than behind a settings screen.
    {
      icon: Keyboard,
      label: "Pintasan keyboard…",
      chord: keymap["app.openShortcuts"],
      action: () => shortcuts.open(),
      disabled: false,
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
          className="absolute top-full right-0 mt-1 w-52 py-1 rounded-md border border-bm-border bg-bm-pane-header shadow-xl shadow-black/50 z-50"
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
              <span className="truncate">{item.label}</span>
              <span className="ml-auto pl-2 shrink-0 font-mono text-[10px] text-bm-text-dim">
                {formatChord(item.chord)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   LEAF
-------------------------------------------------------------------*/

/**
 * Split out so the draft seeds itself on mount. The edit can start from three
 * places — the header's double-click, the overflow menu, or the rename chord —
 * and a field that lived in the leaf would need an effect to notice each one.
 */
function RenameInput({
  initialName,
  onCommit,
  onCancel,
}: {
  initialName: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initialName)

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        // Enter and Escape mean the field here, not the pane behind it.
        e.stopPropagation()
        if (e.key === "Enter") onCommit(draft)
        if (e.key === "Escape") onCancel()
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-28 bg-bm-bg border border-bm-live/40 rounded-sm px-1 text-[10px] font-mono text-bm-text outline-none"
    />
  )
}

function TerminalLeafView({
  node,
  paneId,
}: {
  node: Extract<PaneTerminalNode, { type: "leaf" }>
  paneId: string
}) {
  const state = usePaneTerminalState()
  const {
    splitTerminal,
    closeTerminal,
    toggleMaximize,
    renameTerminal,
    setRenaming,
    setActive,
  } = usePaneTerminalActions()
  const keymap = useKeymap()

  const isActive = state.activeTerminalId === node.terminalId
  const tree = state.trees[paneId]
  const leafCount = tree ? countLeaves(tree) : 1
  const isMaximized = state.maximized[paneId] === node.terminalId
  const renaming = state.renamingTerminalId === node.terminalId

  // Stable identity keeps the memoised slot from re-rendering — and therefore
  // from re-running its attach effect — every time focus moves.
  const handleFocus = useCallback(
    () => setActive(node.terminalId),
    [setActive, node.terminalId]
  )

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
            <RenameInput
              initialName={node.name}
              onCommit={(name) => renameTerminal(paneId, node.terminalId, name)}
              onCancel={() => setRenaming(null)}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation()
                setRenaming(node.terminalId)
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
            canClose={leafCount > 1}
            onRename={() => setRenaming(node.terminalId)}
          />
          <div className="w-px h-3 bg-bm-border mx-0.5" />
          {/* Maximize is meaningless with one terminal — the old build showed
              it anyway and clicking it silently deleted siblings. */}
          {leafCount > 1 && (
            <ToolbarBtn
              icon={isMaximized ? Minimize2 : Maximize2}
              label={isMaximized ? "Restore split" : "Maximize"}
              chord={keymap["terminal.toggleMaximize"]}
              onClick={() => toggleMaximize(paneId, node.terminalId)}
            />
          )}
          <ToolbarBtn
            icon={SplitSquareHorizontal}
            label="Split right"
            chord={keymap["terminal.splitRight"]}
            onClick={() => splitTerminal(paneId, node.terminalId, "horizontal")}
          />
          <ToolbarBtn
            icon={SplitSquareVertical}
            label="Split down"
            chord={keymap["terminal.splitDown"]}
            onClick={() => splitTerminal(paneId, node.terminalId, "vertical")}
          />
          {leafCount > 1 && (
            <>
              <div className="w-px h-3 bg-bm-border mx-0.5" />
              <ToolbarBtn
                icon={X}
                label="Close terminal"
                chord={keymap["terminal.close"]}
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
          onFocus={handleFocus}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   SASH
-------------------------------------------------------------------*/

interface DragState {
  prev: HTMLElement
  next: HTMLElement
  /** Combined pixel size of the two neighbours when the drag started. Working
   *  in the pair's own space keeps the maths independent of how much room the
   *  sashes themselves take out of the parent. */
  pairPx: number
  /** Combined `flexGrow` of the pair, which the drag redistributes but never
   *  changes — so the other children of the split do not move. */
  pairGrow: number
  startPrevPx: number
  startPointer: number
  terminalIds: string[]
  sizes: number[]
}

function Sash({
  paneId,
  node,
  index,
}: {
  paneId: string
  node: TerminalSplit
  /** Sash `i` sits between children `i - 1` and `i`. */
  index: number
}) {
  const { resizeSplitNode } = usePaneTerminalActions()
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)
  const horizontal = node.direction === "horizontal"

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return

    // `:scope >` matters: nested splits render their own `data-split-index`
    // wrappers, and an unscoped query would grab a grandchild.
    const prev = parent.querySelector<HTMLElement>(
      `:scope > [data-split-index="${index - 1}"]`
    )
    const next = parent.querySelector<HTMLElement>(
      `:scope > [data-split-index="${index}"]`
    )
    if (!prev || !next) return

    const prevRect = prev.getBoundingClientRect()
    const nextRect = next.getBoundingClientRect()
    const prevPx = horizontal ? prevRect.width : prevRect.height
    const nextPx = horizontal ? nextRect.width : nextRect.height
    const pairPx = prevPx + nextPx
    // Nowhere legal to drag to; starting anyway would just jitter both panes.
    if (pairPx <= MIN_PANE_PX * 2) return

    const even = 1 / node.children.length
    const sizes = node.children.map((_, i) => node.sizes[i] ?? even)

    drag.current = {
      prev,
      next,
      pairPx,
      pairGrow: sizes[index - 1] + sizes[index],
      startPrevPx: prevPx,
      startPointer: horizontal ? e.clientX : e.clientY,
      terminalIds: [
        ...collectTerminals(node.children[index - 1]),
        ...collectTerminals(node.children[index]),
      ].map((t) => t.id),
      sizes,
    }

    // Capture keeps the drag alive over the terminals either side, which would
    // otherwise swallow the pointer the moment it left the 5px strip.
    //
    // Deliberately no preventDefault(): suppressing a pointerdown's default
    // also suppresses the compatibility mouse events, and the double-click
    // reset below is one of them. Text selection is held off with
    // `user-select: none` on `.bm-sash` instead.
    el.setPointerCapture(e.pointerId)
    setDragging(true)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return

    const pointer = horizontal ? e.clientX : e.clientY
    const wanted = d.startPrevPx + (pointer - d.startPointer)
    const prevPx = Math.min(
      Math.max(wanted, MIN_PANE_PX),
      d.pairPx - MIN_PANE_PX
    )
    const prevGrow = (d.pairGrow * prevPx) / d.pairPx
    const nextGrow = d.pairGrow - prevGrow

    // Written straight to the DOM. Routing sixty pointermoves a second through
    // the reducer would re-render every leaf in the pane on every frame, which
    // is exactly the jank this whole change exists to remove.
    d.prev.style.flexGrow = String(prevGrow)
    d.next.style.flexGrow = String(nextGrow)
    d.sizes[index - 1] = prevGrow
    d.sizes[index] = nextGrow

    // The shared observer will catch this too, but only the terminals whose box
    // actually moved need re-fitting, and asking directly gets them into the
    // same frame as the style write.
    const reg = getRegistry()
    for (const id of d.terminalIds) reg?.requestFit(id)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setDragging(false)
    if (ref.current?.hasPointerCapture(e.pointerId)) {
      ref.current.releasePointerCapture(e.pointerId)
    }
    // Commits the values already on the elements, so the re-render that follows
    // paints identical geometry and the drag ends without a flicker.
    resizeSplitNode(paneId, node.id, d.sizes)
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-label={
        horizontal ? "Geser lebar terminal" : "Geser tinggi terminal"
      }
      className={cn(
        "bm-sash",
        horizontal ? "bm-sash-col" : "bm-sash-row",
        dragging && "bm-sash-active"
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() =>
        resizeSplitNode(
          paneId,
          node.id,
          node.children.map(() => 1 / node.children.length)
        )
      }
    />
  )
}

/* ------------------------------------------------------------------
   TREE
-------------------------------------------------------------------*/

function TerminalNode({
  node,
  paneId,
  maximizedId,
}: {
  node: PaneTerminalNode
  paneId: string
  maximizedId: string | null
}) {
  if (node.type === "leaf") {
    return <TerminalLeafView node={node} paneId={paneId} />
  }

  const isHorizontal = node.direction === "horizontal"
  const even = 1 / node.children.length

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col"
      )}
    >
      {node.children.map((child, i) => {
        /**
         * Maximize hides siblings instead of unmounting them. That is the whole
         * fix for the shell-killing bug: a `display:none` ancestor measures
         * zero, the fit scheduler skips the terminal, the PTY keeps its last
         * size, and the process underneath never notices. Swapping this for
         * `visibility`, `opacity` or a conditional render brings the bug back.
         */
        const hidden = maximizedId !== null && !findLeaf(child, maximizedId)
        return (
          <Fragment key={child.id}>
            {/* A sash between two hidden-or-maximized children would be a
                floating hairline across an otherwise full-bleed terminal. */}
            {i > 0 && maximizedId === null && (
              <Sash paneId={paneId} node={node} index={i} />
            )}
            <div
              data-split-index={i}
              className={cn(
                "min-h-0 min-w-0 overflow-hidden",
                hidden && "hidden"
              )}
              style={{ flexGrow: node.sizes[i] ?? even, flexBasis: 0 }}
            >
              <TerminalNode
                node={child}
                paneId={paneId}
                maximizedId={maximizedId}
              />
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------
   HOTKEYS
-------------------------------------------------------------------*/

function moveFocus(
  reg: Registry | null,
  setActive: PaneTerminalActions["setActive"],
  fromId: string,
  direction: "left" | "right" | "up" | "down"
) {
  const next = reg?.neighbourInDirection(fromId, direction)
  if (!next) return
  setActive(next)
  reg?.focusInstance(next)
}

/**
 * One capture-phase listener for the whole app.
 *
 * Capture, because a terminal has focus almost all of the time and xterm would
 * otherwise encode the keystroke and post it to the shell. The other half of
 * that contract lives in the registry, where `attachCustomKeyEventHandler`
 * returns `false` for any chord currently bound — so an unbound `Alt+f` still
 * reaches the shell untouched.
 */
export function TerminalHotkeys() {
  const state = usePaneTerminalState()
  const actions = usePaneTerminalActions()
  const shortcuts = useShortcutsDialog()

  // Re-registering the listener on every state change would be a lot of churn
  // for a handler that only ever wants the newest values.
  const latest = useRef({ state, actions, shortcuts })
  useEffect(() => {
    latest.current = { state, actions, shortcuts }
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { state: s, actions: a, shortcuts: dialog } = latest.current

      // The dialog installs its own capture listener while recording, and this
      // one is registered first. Standing down is what stops the chord being
      // recorded from firing the action it is about to be bound to.
      if (dialog.isOpen) return
      // Capture runs ahead of every React handler, so a field cannot defend
      // itself by calling stopPropagation — the check has to happen here.
      if (isTextEntry(e.target)) return

      const action = matchAction(e)
      // Not ours. Leave it alone — the shell is waiting for it.
      if (action === null) return
      e.preventDefault()

      if (action === "app.openShortcuts") {
        dialog.open()
        return
      }

      const activeId = s.activeTerminalId
      if (!activeId) return

      const reg = getRegistry()
      switch (action) {
        case "terminal.focusLeft":
          moveFocus(reg, a.setActive, activeId, "left")
          return
        case "terminal.focusRight":
          moveFocus(reg, a.setActive, activeId, "right")
          return
        case "terminal.focusUp":
          moveFocus(reg, a.setActive, activeId, "up")
          return
        case "terminal.focusDown":
          moveFocus(reg, a.setActive, activeId, "down")
          return
        case "terminal.rename":
          a.setRenaming(activeId)
          return
        default:
          break
      }

      // The remaining actions are scoped to a pane, and the active terminal is
      // the only thing that knows which one that is.
      const paneId = Object.keys(s.trees).find((id) =>
        findLeaf(s.trees[id], activeId)
      )
      if (!paneId) return

      switch (action) {
        case "terminal.splitRight":
          a.splitTerminal(paneId, activeId, "horizontal")
          break
        case "terminal.splitDown":
          a.splitTerminal(paneId, activeId, "vertical")
          break
        case "terminal.duplicate":
          a.duplicateTerminal(paneId, activeId)
          break
        case "terminal.close":
          a.closeTerminal(paneId, activeId)
          break
        case "terminal.toggleMaximize":
          a.toggleMaximize(paneId, activeId)
          break
      }
    }

    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])

  return null
}

/* ------------------------------------------------------------------
   ROOT
-------------------------------------------------------------------*/

export function PaneTerminalManager({ paneId }: { paneId: string }) {
  const state = usePaneTerminalState()
  const { initPane } = usePaneTerminalActions()
  const tree = state.trees[paneId]

  useEffect(() => {
    if (!paneId || state.trees[paneId]) return
    initPane(paneId, `bm-init-${paneId}`, "Terminal A")
    // Keyed off the tree rather than a local `initialized` flag so that a pane
    // remounting (workspace switch) re-initialises instead of rendering forever
    // against a tree that no longer exists.
  }, [paneId, state.trees, initPane])

  if (!tree) return <TerminalFallback label="attaching…" />

  // A maximize flag whose terminal has since been closed would otherwise hide
  // every sibling and leave the pane blank.
  const rawMaximized = state.maximized[paneId] ?? null
  const maximizedId =
    rawMaximized && findLeaf(tree, rawMaximized) ? rawMaximized : null

  return (
    <div className="w-full h-full overflow-hidden">
      <TerminalNode node={tree} paneId={paneId} maximizedId={maximizedId} />
    </div>
  )
}
