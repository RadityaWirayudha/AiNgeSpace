"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsLeft,
  ChevronsUpDown,
  Keyboard,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/* ------------------------------------------------------------------
   TYPES
-------------------------------------------------------------------*/

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
  /** Optional row actions. Each one only renders when its handler is passed. */
  onAddPane?: (workspaceId: string) => void
  onClosePane?: (workspaceId: string, paneId: string) => void
  onRenameWorkspace?: (workspaceId: string, name: string) => void
  onDeleteWorkspace?: (workspaceId: string) => void
  /** Context-menu only: environment variables are a per-workspace setting, not
   *  something worth a permanent control in a 184px rail. */
  onOpenEnvVars?: (workspaceId: string) => void
  /** Receives every id in its new order. Enables drag-to-reorder and Alt+↑/↓. */
  onReorderWorkspaces?: (orderedIds: string[]) => void
  className?: string
}

/** `all` is the resting state; the others narrow the tree to panes of that
 *  status, which is what lets the activity meter double as a filter. */
type StatusFilter = "all" | "running" | "warning" | "error"

type DropEdge = "before" | "after"

/* ------------------------------------------------------------------
   CONSTANTS
-------------------------------------------------------------------*/

const MIN_WIDTH = 184
const MAX_WIDTH = 380
const DEFAULT_WIDTH = 232
const RAIL_WIDTH = 48
const WIDTH_KEY = "aingespace:sidebar-width"
const RAIL_KEY = "aingespace:sidebar-rail"
/** Tooltips are everywhere in here; the app-wide provider fires them with no
 *  delay, which turns a mouse crossing the sidebar into a strobe. Base UI's
 *  delay lives on the provider, so the sidebar nests its own. */
const TIP_DELAY = 420

const clampWidth = (w: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)))

/* ------------------------------------------------------------------
   PERSISTED CHROME
   The sidebar's width and rail state outlive a reload, but localStorage
   cannot be touched while rendering on the server. The stored value is
   therefore read once on the client, cached at module scope, and only
   applied after hydration — so the server and client agree on the first
   paint and no effect has to write state back into React.
-------------------------------------------------------------------*/

interface SidebarPrefs {
  width: number
  railed: boolean
}

const DEFAULT_PREFS: SidebarPrefs = { width: DEFAULT_WIDTH, railed: false }
let cachedPrefs: SidebarPrefs | null = null

function readPrefs(): SidebarPrefs {
  if (cachedPrefs) return cachedPrefs
  let prefs = DEFAULT_PREFS
  try {
    const storedWidth = Number(localStorage.getItem(WIDTH_KEY))
    prefs = {
      width:
        Number.isFinite(storedWidth) && storedWidth > 0
          ? clampWidth(storedWidth)
          : DEFAULT_WIDTH,
      railed: localStorage.getItem(RAIL_KEY) === "1",
    }
  } catch {
    // Private mode or a blocked store — the defaults are perfectly usable.
  }
  cachedPrefs = prefs
  return prefs
}

function writePrefs(patch: Partial<SidebarPrefs>) {
  const next = { ...readPrefs(), ...patch }
  cachedPrefs = next
  try {
    localStorage.setItem(WIDTH_KEY, String(next.width))
    localStorage.setItem(RAIL_KEY, next.railed ? "1" : "0")
  } catch {
    // Persistence is a nicety, not a requirement.
  }
}

/** localStorage never changes underneath us, so the subscription is inert; the
 *  store exists only to tell render-on-server from render-on-client. */
const subscribeMounted = () => () => {}
const getMounted = () => true
const getMountedServer = () => false

/* ------------------------------------------------------------------
   SMALL HELPERS
-------------------------------------------------------------------*/

/** Worst status wins, so a workspace roll-up never hides an error behind an
 *  idle pane. Order: error > running > warning > idle. */
function rollUpStatus(panes: SidebarPane[]): string {
  if (panes.some((p) => p.status === "error")) return "error"
  if (panes.some((p) => p.status === "running")) return "running"
  if (panes.some((p) => p.status === "warning")) return "warning"
  return "idle"
}

function toneFor(status: string): string {
  switch (status) {
    case "running":
      return "bg-bm-live"
    case "warning":
      return "bg-bm-warning"
    case "error":
      return "bg-destructive"
    default:
      return "bg-bm-text-dim"
  }
}

/** Identity hues. Deliberately kept off orange, red and yellow: those three
 *  already mean live, error and warning everywhere else in the app, and a
 *  workspace that merely happens to hash to amber must not read as a warning. */
const TONES = [
  "#a78bfa",
  "#60a5fa",
  "#34d399",
  "#22d3ee",
  "#c084fc",
  "#818cf8",
] as const

/** Derived from the id, not the index: the colour a user has learnt to
 *  associate with a workspace survives a reorder, a rename, and a reload. */
function hueFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return TONES[hash % TONES.length]
}

/** The tile carries two facts in one 18px slot — which workspace this is
 *  (colour + letter) and whether anything in it needs attention (corner dot).
 *  Idle stays dotless: a badge on every row is a badge on none. */
function WorkspaceTile({
  id,
  label,
  status,
  active = false,
  large = false,
  className,
}: {
  id: string
  label: string
  status: string
  active?: boolean
  large?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      data-active={active ? "1" : undefined}
      style={{ "--bm-tone": hueFor(id) } as React.CSSProperties}
      className={cn("bm-ws-tile", large && "bm-ws-tile-lg", className)}
    >
      {label}
      {status !== "idle" && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 size-1.5 rounded-full ring-2 ring-bm-bg",
            toneFor(status),
            status === "running" && "bm-dot-live"
          )}
        />
      )}
    </span>
  )
}

/** One character for the 18px tile. Two would have to be set at 7px to fit,
 *  which is smaller than the row's own text and reads as noise. */
function letterFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "·"
}

function initials(name: string): string {
  const words = name.trim().split(/[\s_\-./]+/).filter(Boolean)
  if (words.length === 0) return "··"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== "function") return false
  const tag = el.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable ||
    // xterm keeps a hidden textarea; swallowing Ctrl+K there would break the
    // terminal's own keybindings.
    el.closest(".xterm") !== null
  )
}

function StatusDot({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  // Idle renders as an outline, not a filled dot: most panes are idle most of
  // the time, and a column of solid grey dots is noise that hides the two or
  // three that actually mean something.
  const tone =
    status === "running"
      ? "bm-glyph-running bm-dot-live"
      : status === "warning"
        ? "bm-glyph-warning"
        : status === "error"
          ? "bm-glyph-error"
          : "bm-glyph-idle"

  return (
    <span className={cn("bm-glyph", tone, className)}>
      <span className="sr-only">{status}</span>
    </span>
  )
}

/** Marks the matched substring so a filtered list explains itself. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const at = text.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="bm-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

/** Mounted fresh for each rename, so the draft starts from the current name
 *  without an effect syncing prop into state. */
function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string
  onCommit: (name: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const done = useRef(false)

  const commit = () => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    if (next && next !== initial) onCommit(next)
    else onCancel()
  }

  return (
    <input
      // Focus is safe here: the field only exists because the user just asked
      // to rename this row.
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") commit()
        if (e.key === "Escape") {
          done.current = true
          onCancel()
        }
      }}
      onBlur={commit}
      aria-label="Workspace name"
      className="flex-1 min-w-0 bg-transparent text-[11px] font-medium text-bm-text outline-none border-b border-bm-link/50"
    />
  )
}

/** Paint size. The pointer target is always larger than the box — see
 *  `.bm-ib::after` — so `sm` stays visually quiet without being unhittable. */
type IconButtonSize = "sm" | "md" | "lg"

const ICON_SIZE: Record<IconButtonSize, string> = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-3.5",
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  danger = false,
  primary = false,
  focusable = true,
  size = "sm",
  side = "right",
  shortcut,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  /** Rests one greyscale step brighter, for the one action a band is *for*. */
  primary?: boolean
  /** Row actions opt out: three tab stops per workspace would bury the tree,
   *  and the same commands are on the row's context menu. */
  focusable?: boolean
  size?: IconButtonSize
  side?: "top" | "right" | "bottom" | "left"
  /** Rendered as a right-aligned key hint in the tooltip rather than being
   *  pasted into the label, so the accessible name stays a plain verb. */
  shortcut?: string
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={active || undefined}
            tabIndex={focusable ? undefined : -1}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className={cn(
              "bm-ib",
              `bm-ib-${size}`,
              primary && "bm-ib-primary",
              danger && "bm-ib-danger",
              className
            )}
          />
        }
      >
        <Icon className={cn(ICON_SIZE[size], "relative")} />
      </TooltipTrigger>
      {/* The popup is already an inline-flex row, so the label and the key hint
          just sit in it as siblings. */}
      <TooltipContent side={side} className="text-[10px] font-mono">
        <span>{label}</span>
        {shortcut && (
          <span className="text-bm-text-dim tracking-wide">{shortcut}</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------------------
   ACTIVITY METER
   One row of togglable counters sitting on a proportional hairline. It is the
   densest way to answer "what is this machine doing right now" without
   spending a colour on decoration.
-------------------------------------------------------------------*/

interface StatusCounts {
  running: number
  warning: number
  error: number
  idle: number
  total: number
}

function MeterChip({
  status,
  count,
  label,
  filter,
  onFilter,
}: {
  status: Exclude<StatusFilter, "all">
  count: number
  label: string
  filter: StatusFilter
  onFilter: (next: StatusFilter) => void
}) {
  const on = filter === status
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-pressed={on}
            onClick={() => onFilter(on ? "all" : status)}
            data-tone={status}
            className="bm-chip"
          />
        }
      >
        <span
          className={cn(
            "relative size-1.5 rounded-full shrink-0",
            count > 0 ? toneFor(status) : "bg-bm-text-dim/50",
            status === "running" && count > 0 && "bm-dot-live"
          )}
        />
        <span className="relative">{count}</span>
        <span className="relative">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-mono">
        {on ? "Show every pane" : `Show only ${label} panes`}
      </TooltipContent>
    </Tooltip>
  )
}

function ActivityMeter({
  counts,
  filter,
  onFilter,
}: {
  counts: StatusCounts
  filter: StatusFilter
  onFilter: (next: StatusFilter) => void
}) {
  const segments = [
    { key: "error", value: counts.error, cls: "bg-destructive" },
    { key: "running", value: counts.running, cls: "bg-bm-live" },
    { key: "warning", value: counts.warning, cls: "bg-bm-warning" },
    { key: "idle", value: counts.idle, cls: "bg-white/[0.14]" },
  ].filter((s) => s.value > 0)

  const denominator = Math.max(1, counts.total)

  return (
    <div className="border-t border-bm-border shrink-0">
      <div className="flex items-center gap-0.5 pl-1.5 pr-2 h-[26px]">
        <MeterChip
          status="running"
          count={counts.running}
          label="live"
          filter={filter}
          onFilter={onFilter}
        />
        {/* Error and warning chips only exist when there is something to
            report — an always-on "0 errors" is noise in a dense rail. */}
        {counts.error > 0 && (
          <MeterChip
            status="error"
            count={counts.error}
            label="err"
            filter={filter}
            onFilter={onFilter}
          />
        )}
        {counts.warning > 0 && (
          <MeterChip
            status="warning"
            count={counts.warning}
            label="warn"
            filter={filter}
            onFilter={onFilter}
          />
        )}
        <span className="ml-auto shrink-0 pr-0.5 text-[10px] tabular-nums text-bm-text-dim">
          {counts.total} pane{counts.total === 1 ? "" : "s"}
        </span>
      </div>

      {/* Full-bleed and 2px: a proportional rule along the bottom edge of the
          panel, not a progress bar competing with the tree. */}
      <div
        role="img"
        aria-label={`${counts.running} running, ${counts.warning} warning, ${counts.error} error, ${counts.idle} idle`}
        className="flex h-[2px] w-full overflow-hidden bg-white/[0.04]"
      >
        {segments.map((s) => (
          <span
            key={s.key}
            style={{ width: `${(s.value / denominator) * 100}%` }}
            className={cn("bm-sb-seg h-full", s.cls)}
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   CONTEXT MENU
   Right-click keeps the hover strip down to three icons while still exposing
   reorder and destructive commands.
-------------------------------------------------------------------*/

interface MenuEntry {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onSelect: () => void
  hint?: string
  danger?: boolean
  disabled?: boolean
}

function ContextMenu({
  x,
  y,
  title,
  entries,
  onClose,
}: {
  x: number
  y: number
  title: string
  entries: MenuEntry[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Rendered once at the raw cursor point, measured, then nudged back inside
  // the viewport — kept invisible until then so the correction never shows.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(6, Math.min(x, window.innerWidth - r.width - 6)),
      y: Math.max(6, Math.min(y, window.innerHeight - r.height - 6)),
    })
    el.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus()
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("resize", onClose)
    window.addEventListener("wheel", onClose, { passive: true })
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("resize", onClose)
      window.removeEventListener("wheel", onClose)
    }
  }, [onClose])

  const move = (delta: 1 | -1) => {
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])"
      ) ?? []
    )
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = at < 0 ? 0 : (at + delta + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${title} actions`}
      style={{ left: pos?.x ?? x, top: pos?.y ?? y, opacity: pos ? 1 : 0 }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          move(1)
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          move(-1)
        }
      }}
      className={cn(
        "fixed z-50 min-w-[168px] py-1 rounded-sm",
        "bg-bm-pane-header border border-bm-border"
      )}
    >
      <div className="px-2 pb-1 mb-1 border-b border-bm-border">
        <p className="truncate text-[9px] font-mono uppercase tracking-[0.12em] text-bm-text-dim">
          {title}
        </p>
      </div>
      {entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          role="menuitem"
          disabled={entry.disabled}
          onClick={() => {
            entry.onSelect()
            onClose()
          }}
          className={cn(
            "bm-menu-item",
            entry.danger && "bm-menu-item-danger"
          )}
        >
          <entry.icon className="size-3 shrink-0" />
          <span className="flex-1 truncate">{entry.label}</span>
          {entry.hint && (
            <span className="shrink-0 text-[9px] font-mono text-bm-text-dim">
              {entry.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------
   WORKSPACE ROW
-------------------------------------------------------------------*/

function WorkspaceRow({
  workspace,
  panes,
  isActive,
  activePaneId,
  expanded,
  query,
  renaming,
  confirmingDelete,
  tabKey,
  draggable,
  dragging,
  dragActive,
  dropEdge,
  onRowFocus,
  onToggle,
  onSelect,
  onSelectPane,
  onAddPane,
  onClosePane,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onContextMenu,
  onDragStart,
  onDragOverRow,
  onDragEnd,
  onDrop,
}: {
  workspace: WorkspaceItem
  panes: SidebarPane[]
  isActive: boolean
  activePaneId?: string | null
  expanded: boolean
  query: string
  renaming: boolean
  confirmingDelete: boolean
  tabKey: string | null
  draggable: boolean
  dragging: boolean
  dragActive: boolean
  dropEdge: DropEdge | null
  onRowFocus: (key: string) => void
  onToggle: () => void
  onSelect: () => void
  onSelectPane?: (paneId: string) => void
  onAddPane?: () => void
  onClosePane?: (paneId: string) => void
  onStartRename?: () => void
  onCommitRename?: (name: string) => void
  onCancelRename?: () => void
  onRequestDelete?: () => void
  onConfirmDelete?: () => void
  onCancelDelete?: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDragOverRow: (edge: DropEdge) => void
  onDragEnd: () => void
  onDrop: () => void
}) {
  const listId = useId()
  const rowRef = useRef<HTMLDivElement>(null)
  const allPanes = workspace.panes ?? []
  const status = rollUpStatus(allPanes)
  const runningCount = allPanes.filter((p) => p.status === "running").length
  const showChildren = expanded && panes.length > 0
  const rowKey = `ws:${workspace.id}`
  const showClose = isActive && Boolean(onRequestDelete)

  if (confirmingDelete) {
    return (
      <div className="mx-1 mb-0.5 rounded-sm border border-destructive/30 bg-destructive/[0.06] px-2 py-1.5">
        <p className="text-[10px] text-bm-text-secondary leading-tight">
          Close{" "}
          <span className="text-bm-text font-medium">{workspace.name}</span>
          {workspace.count > 0 && (
            <span className="text-bm-text-dim">
              {" "}
              and its {workspace.count} pane{workspace.count === 1 ? "" : "s"}
            </span>
          )}
          ?
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            // The row was replaced under the pointer; focus has to follow or
            // the keyboard user is left with nothing selected.
            autoFocus
            onClick={onConfirmDelete}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                onCancelDelete?.()
              }
            }}
            // Several rows can offer a "Close" button at once, so the label
            // says which workspace this one closes.
            aria-label={`Close workspace ${workspace.name}`}
            data-sb-confirm-delete
            className="bm-btn bm-btn-danger"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onCancelDelete}
            className="bm-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      draggable={draggable && !renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move"
        // Firefox refuses to start a drag with an empty payload.
        e.dataTransfer.setData("text/plain", workspace.id)
        onDragStart()
      }}
      onDragOver={(e) => {
        if (!dragActive || dragging) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        // Measured against the header row, not the whole block: an expanded
        // workspace is tall enough that its own midpoint means nothing.
        const r = rowRef.current?.getBoundingClientRect()
        if (!r) return
        onDragOverRow(e.clientY < r.top + r.height / 2 ? "before" : "after")
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        if (!dragActive) return
        e.preventDefault()
        onDrop()
      }}
      className={cn(
        "relative mb-0.5 transition-opacity duration-100",
        dragging && "opacity-40"
      )}
    >
      {dropEdge && (
        <span
          aria-hidden
          className={cn(
            "absolute left-1 right-1 z-20 h-[2px] rounded-full bg-bm-link",
            dropEdge === "before" ? "-top-px" : "-bottom-px"
          )}
        />
      )}

      <div
        ref={rowRef}
        className={cn(
          // Full-bleed: the highlight runs edge to edge so the accent bar sits
          // flush with the panel border instead of floating in a margin.
          "group/row bm-row relative flex items-center h-[26px] pr-1.5",
          isActive && "bm-row-active",
          // Sticky only earns its keep once a workspace has children to scroll
          // under it.
          showChildren && "sticky top-0 z-[6] bm-row-sticky",
          isActive ? "text-bm-text" : "text-bm-text-secondary"
        )}
      >
        {/* Live wins the bar: "something is running in here" outranks "this is
            the one you are looking at", and orange keeps its single meaning
            (referensi.md §2). Otherwise the bar carries selection. */}
        {isActive && (
          <span
            aria-hidden
            className={cn(
              "absolute left-0 inset-y-0 z-10 w-[2px]",
              status === "running" ? "bg-bm-live" : "bg-bm-select"
            )}
          />
        )}

        {renaming ? (
          <div className="relative flex items-center gap-1.5 flex-1 min-w-0 pl-[22px] pr-2 py-1">
            <WorkspaceTile
              id={workspace.id}
              label={letterFor(workspace.name)}
              status={status}
              active={isActive}
            />
            <RenameInput
              initial={workspace.name}
              onCommit={(name) => onCommitRename?.(name)}
              onCancel={() => onCancelRename?.()}
            />
          </div>
        ) : (
          <>
            <button
              type="button"
              role="treeitem"
              aria-level={1}
              aria-selected={isActive}
              data-sb-row
              data-sb-kind="workspace"
              data-sb-key={rowKey}
              tabIndex={tabKey === rowKey ? 0 : -1}
              aria-expanded={panes.length > 0 ? expanded : undefined}
              aria-controls={showChildren ? listId : undefined}
              aria-current={isActive ? "true" : undefined}
              title={workspace.name}
              onFocus={() => onRowFocus(rowKey)}
              onContextMenu={onContextMenu}
              onClick={() => {
                if (isActive) onToggle()
                else onSelect()
              }}
              onDoubleClick={() => onStartRename?.()}
              className="relative flex items-center h-full flex-1 min-w-0 pl-2 text-left"
            >
              {/* Fixed slots, not gaps: the chevron and the status glyph each
                  own a column, so every name in the tree — parent or child —
                  starts on the same x. */}
              <span
                className={cn(
                  "w-3.5 shrink-0 flex items-center justify-center text-bm-text-dim",
                  panes.length === 0 && "opacity-0"
                )}
              >
                {expanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </span>

              <WorkspaceTile
                id={workspace.id}
                label={letterFor(workspace.name)}
                status={status}
                active={isActive}
              />

              <span
                className={cn(
                  "truncate text-[11px] leading-none flex-1 pl-2 pt-px",
                  isActive ? "font-medium text-bm-text" : "font-normal"
                )}
              >
                <Highlight text={workspace.name} query={query} />
              </span>
            </button>

            {/* Count and close sit in the flow; the hover cluster floats over
                the name. A 184px sidebar cannot spare 60px of permanently
                reserved chrome, and the name is what the user is scanning. */}
            <span className="relative flex items-center gap-1 shrink-0 pl-1">
              <span
                data-tone={
                  runningCount > 0 ? "live" : isActive ? "select" : undefined
                }
                title={
                  runningCount > 0
                    ? `${runningCount} running of ${workspace.count} pane${
                        workspace.count === 1 ? "" : "s"
                      }`
                    : `${workspace.count} pane${
                        workspace.count === 1 ? "" : "s"
                      }`
                }
                className={cn(
                  "bm-count",
                  "group-hover/row:opacity-0 group-focus-within/row:opacity-0"
                )}
              >
                {workspace.count}
              </span>

              {/* The selected row keeps its close button on screen. It is the
                  one workspace the user is demonstrably done with or working
                  in, and hunting for a hover target to leave it is the kind of
                  friction a keyboard-first panel should not have. */}
              {showClose && (
                <IconButton
                  icon={X}
                  label="Close workspace"
                  shortcut="Del"
                  onClick={() => onRequestDelete?.()}
                  danger
                  focusable={false}
                />
              )}
            </span>

            {(onAddPane || onStartRename || onRequestDelete) && (
              <span
                className={cn(
                  "bm-row-actions absolute top-0 bottom-0 z-10 pl-2",
                  showClose ? "right-[26px]" : "right-1.5",
                  "flex items-center gap-0.5",
                  "opacity-0 transition-opacity duration-100",
                  "group-hover/row:opacity-100 focus-within:opacity-100"
                )}
              >
                {onAddPane && (
                  <IconButton
                    icon={Plus}
                    label="Add pane"
                    onClick={onAddPane}
                    primary
                    focusable={false}
                  />
                )}
                {onStartRename && (
                  <IconButton
                    icon={Pencil}
                    label="Rename"
                    shortcut="F2"
                    onClick={onStartRename}
                    focusable={false}
                  />
                )}
                {/* Skipped when the row already shows a persistent ×: two
                    controls for one command in a 20px span is a misclick. */}
                {onRequestDelete && !showClose && (
                  <IconButton
                    icon={Trash2}
                    label="Close workspace"
                    shortcut="Del"
                    onClick={onRequestDelete}
                    danger
                    focusable={false}
                  />
                )}
              </span>
            )}
          </>
        )}
      </div>

      {showChildren && (
        <div
          id={listId}
          role="group"
          // The rail sits at x=15px — the centre of the parent's chevron slot —
          // so the branch visibly descends from the disclosure control.
          className="bm-tree-rail relative ml-[15px] mb-1"
        >
          {panes.map((pane) => {
            const paneActive = pane.id === activePaneId && isActive
            const paneKey = `pane:${workspace.id}:${pane.id}`
            return (
              <div
                key={pane.id}
                className={cn(
                  "group/row bm-row relative flex items-center h-[24px] -ml-[15px] pl-[15px]",
                  paneActive && "bm-row-active",
                  paneActive
                    ? "text-bm-text"
                    : "text-bm-text-secondary hover:text-bm-text"
                )}
              >
                {/* The selected child gets the same flush accent bar as a
                    selected parent, so one selection language covers both
                    levels of the tree. */}
                {paneActive && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[15px] inset-y-0 z-[6] w-[2px]",
                      pane.status === "running" ? "bg-bm-live" : "bg-bm-select"
                    )}
                  />
                )}
                <button
                  type="button"
                  role="treeitem"
                  aria-level={2}
                  aria-selected={paneActive}
                  data-sb-row
                  data-sb-kind="pane"
                  data-sb-key={paneKey}
                  tabIndex={tabKey === paneKey ? 0 : -1}
                  title={pane.title}
                  aria-current={paneActive ? "true" : undefined}
                  onFocus={() => onRowFocus(paneKey)}
                  onClick={() => onSelectPane?.(pane.id)}
                  // 11px + 8px glyph column lands the title on exactly the same
                  // x as its parent's name.
                  className="flex items-center h-full flex-1 min-w-0 pl-[13px] text-[11px] text-left"
                >
                  <span className="w-3 shrink-0 flex items-center justify-center">
                    <StatusDot status={pane.status} />
                  </span>
                  <span className="truncate leading-none pl-1.5 pt-px">
                    <Highlight text={pane.title} query={query} />
                  </span>
                </button>
                {onClosePane && (
                  <span
                    className={cn(
                      "bm-row-actions absolute right-1 top-0 bottom-0 z-10 pl-2",
                      "flex items-center opacity-0 transition-opacity duration-100",
                      "group-hover/row:opacity-100 focus-within:opacity-100"
                    )}
                  >
                    <IconButton
                      icon={X}
                      label="Close pane"
                      onClick={() => onClosePane(pane.id)}
                      danger
                      focusable={false}
                    />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   RAIL (COLLAPSED) MODE
-------------------------------------------------------------------*/

function Rail({
  workspaces,
  activeWorkspaceId,
  counts,
  mod,
  onSelect,
  onExpand,
  onSearch,
  onCreateWorkspace,
}: {
  workspaces: WorkspaceItem[]
  activeWorkspaceId: string
  counts: StatusCounts
  mod: string
  onSelect: (id: string) => void
  onExpand: () => void
  onSearch: () => void
  onCreateWorkspace?: () => void
}) {
  const denominator = Math.max(1, counts.total)
  return (
    <>
      <div className="flex flex-col items-center gap-1 py-2 border-b border-bm-border shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={onExpand}
                className={cn(
                  "relative size-[22px] rounded-[3px] shrink-0",
                  "bg-gradient-to-br from-purple to-violet",
                  "flex items-center justify-center",
                  // The brand tile is the rail's expand affordance, but nothing
                  // about a static logo says "clickable" — so it dims on press
                  // like every other control in the panel.
                  "transition-opacity duration-100 hover:opacity-85 active:opacity-70"
                )}
              />
            }
          >
            <span className="text-[9px] font-bold text-white leading-none">
              BM
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[10px] font-mono">
            <span>Expand sidebar</span>
            <span className="text-bm-text-dim tracking-wide">{mod}B</span>
          </TooltipContent>
        </Tooltip>

        <IconButton
          icon={Search}
          label="Search workspaces"
          shortcut="/"
          onClick={onSearch}
          side="right"
          size="lg"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-1.5 flex flex-col items-center gap-1">
        {workspaces.map((ws, index) => {
          const panes = ws.panes ?? []
          const status = rollUpStatus(panes)
          const running = panes.filter((p) => p.status === "running").length
          const isActive = ws.id === activeWorkspaceId
          return (
            <Tooltip key={ws.id}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => onSelect(ws.id)}
                    aria-current={isActive ? "true" : undefined}
                    aria-label={ws.name}
                    className={cn(
                      // One tile, one glyph. The pane count moved to the
                      // tooltip: two stacked numbers in a 48px rail read as
                      // clutter, and the tile's own status dot already answers
                      // the question the rail exists to answer.
                      "relative flex items-center justify-center shrink-0 rounded-[5px]",
                      "transition-opacity duration-100",
                      isActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                    )}
                  />
                }
              >
                {/* Same tile as the expanded panel, one size up — collapsing
                    the sidebar must not change what a workspace looks like. */}
                <WorkspaceTile
                  id={ws.id}
                  label={initials(ws.name)}
                  status={status}
                  active={isActive}
                  large
                />
                {isActive && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full",
                      status === "running" ? "bg-bm-live" : "bg-bm-select"
                    )}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="right" className="text-[10px] font-mono">
                {ws.name} · {running > 0 ? `${running} live / ` : ""}
                {ws.count} pane{ws.count === 1 ? "" : "s"}
                {index < 9 ? ` · Alt+${index + 1}` : ""}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Same foot as the expanded panel: an action row over a proportional
          2px rule, so collapsing changes the width and nothing else. */}
      <div className="shrink-0 border-t border-bm-border">
        {onCreateWorkspace && (
          <div className="flex items-center justify-center h-[30px]">
            <IconButton
              icon={Plus}
              label="New workspace"
              onClick={onCreateWorkspace}
              primary
              size="lg"
              side="right"
            />
          </div>
        )}
        <div
          role="img"
          aria-label={`${counts.running} running, ${counts.warning} warning, ${counts.error} error`}
          className="flex h-[2px] w-full overflow-hidden bg-white/[0.04]"
        >
          {counts.error > 0 && (
            <span
              className="bm-sb-seg h-full bg-destructive"
              style={{ width: `${(counts.error / denominator) * 100}%` }}
            />
          )}
          {counts.running > 0 && (
            <span
              className="bm-sb-seg h-full bg-bm-live"
              style={{ width: `${(counts.running / denominator) * 100}%` }}
            />
          )}
          {counts.warning > 0 && (
            <span
              className="bm-sb-seg h-full bg-bm-warning"
              style={{ width: `${(counts.warning / denominator) * 100}%` }}
            />
          )}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------
   SHORTCUT SHEET
-------------------------------------------------------------------*/

function ShortcutSheet({
  mod,
  canReorder,
  onClose,
}: {
  mod: string
  canReorder: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      // The toggle closes the sheet through its own onClick. Without this
      // guard the outside-click handler closes it first and the click
      // immediately reopens it.
      if (target?.closest?.("[data-sb-help-toggle]")) return
      if (!ref.current?.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKey, true)
    }
  }, [onClose])

  const rows: [string, string][] = [
    [`${mod}K /`, "Search"],
    [`${mod}B`, "Collapse sidebar"],
    ["↑ ↓", "Move between rows"],
    ["→ ←", "Expand · collapse"],
    ["Alt 1-9", "Jump to workspace"],
    ...(canReorder
      ? ([["Alt ↑ ↓", "Reorder workspace"]] as [string, string][])
      : []),
    ["F2", "Rename workspace"],
    ["Del", "Close workspace"],
    ["Esc", "Clear filters"],
  ]

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Sidebar shortcuts"
      className={cn(
        "absolute left-1 right-1 bottom-8 z-40 rounded-sm p-2",
        "bg-bm-pane-header border border-bm-border"
      )}
    >
      <div className="flex items-center gap-1 pb-1.5 mb-1.5 border-b border-bm-border">
        <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-bm-text-dim">
          Shortcuts
        </span>
        <button
          type="button"
          aria-label="Close shortcuts"
          onClick={onClose}
          className="bm-ib size-4 ml-auto"
        >
          <X className="size-3 relative" />
        </button>
      </div>
      <dl className="grid gap-1">
        {rows.map(([keys, label]) => (
          <div key={keys} className="flex items-center gap-2">
            <dt className="shrink-0 w-[54px] text-[9px] font-mono text-bm-text-dim">
              {keys}
            </dt>
            <dd className="min-w-0 truncate text-[10px] text-bm-text-secondary">
              {label}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------
   SIDEBAR
-------------------------------------------------------------------*/

export function BridgeMindSidebar({
  workspaces,
  activeWorkspaceId,
  activePaneId,
  onSelect,
  onSelectPane,
  onCreateWorkspace,
  onAddPane,
  onClosePane,
  onRenameWorkspace,
  onDeleteWorkspace,
  onOpenEnvVars,
  onReorderWorkspaces,
  className,
}: BridgeMindSidebarProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [resizing, setResizing] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [tabbable, setTabbable] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [menu, setMenu] = useState<{
    x: number
    y: number
    workspaceId: string
  } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: string
    edge: DropEdge
  } | null>(null)
  const [shade, setShade] = useState({ top: false, bottom: false })
  // null means "whatever is stored"; a value means the user changed it here.
  const [widthOverride, setWidthOverride] = useState<number | null>(null)
  const [railOverride, setRailOverride] = useState<boolean | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* -- persisted chrome ------------------------------------------- */

  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMounted,
    getMountedServer
  )
  const prefs = mounted ? readPrefs() : DEFAULT_PREFS
  const width = widthOverride ?? prefs.width
  const railed = railOverride ?? prefs.railed
  const isMac = mounted && /mac|iphone|ipad/i.test(navigator.userAgent)

  const applyWidth = useCallback((next: number) => {
    const w = clampWidth(next)
    setWidthOverride(w)
    writePrefs({ width: w })
  }, [])

  const applyRailed = useCallback((next: boolean) => {
    setRailOverride(next)
    writePrefs({ railed: next })
  }, [])

  /* -- derived counts ---------------------------------------------- */

  const counts = useMemo<StatusCounts>(() => {
    let running = 0
    let warning = 0
    let error = 0
    let total = 0
    for (const ws of workspaces) {
      for (const pane of ws.panes ?? []) {
        total += 1
        if (pane.status === "running") running += 1
        else if (pane.status === "warning") warning += 1
        else if (pane.status === "error") error += 1
      }
    }
    return {
      running,
      warning,
      error,
      idle: total - running - warning - error,
      total,
    }
  }, [workspaces])

  /* -- filtering ---------------------------------------------------- */

  const filtering = query.trim().length > 0 || statusFilter !== "all"

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows: { workspace: WorkspaceItem; panes: SidebarPane[] }[] = []

    for (const ws of workspaces) {
      let panes = ws.panes ?? []
      if (statusFilter !== "all") {
        panes = panes.filter((p) => p.status === statusFilter)
        if (panes.length === 0) continue
      }
      if (q) {
        const nameHit = ws.name.toLowerCase().includes(q)
        const paneHits = panes.filter((p) => p.title.toLowerCase().includes(q))
        if (!nameHit && paneHits.length === 0) continue
        // A name hit keeps the whole workspace visible; otherwise only the
        // panes that actually matched are listed.
        panes = nameHit ? panes : paneHits
      }
      rows.push({ workspace: ws, panes })
    }
    return rows
  }, [workspaces, query, statusFilter])

  const resetFilters = useCallback(() => {
    setQuery("")
    setStatusFilter("all")
  }, [])

  /* -- reordering --------------------------------------------------- */

  // Reordering a filtered list would move rows the user cannot see, so the
  // affordance disappears until the filters are cleared.
  const canReorder = Boolean(onReorderWorkspaces) && !filtering

  const moveWorkspace = useCallback(
    (id: string, delta: 1 | -1) => {
      if (!onReorderWorkspaces) return
      const ids = workspaces.map((ws) => ws.id)
      const from = ids.indexOf(id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= ids.length) return
      ;[ids[from], ids[to]] = [ids[to], ids[from]]
      onReorderWorkspaces(ids)
    },
    [workspaces, onReorderWorkspaces]
  )

  const clearDrag = useCallback(() => {
    setDragId(null)
    setDropTarget(null)
  }, [])

  const commitDrop = useCallback(() => {
    const target = dropTarget
    const moving = dragId
    clearDrag()
    if (!moving || !target || !onReorderWorkspaces || moving === target.id)
      return
    const ids = workspaces.map((ws) => ws.id)
    const from = ids.indexOf(moving)
    if (from < 0) return
    ids.splice(from, 1)
    let to = ids.indexOf(target.id)
    if (to < 0) return
    if (target.edge === "after") to += 1
    ids.splice(to, 0, moving)
    onReorderWorkspaces(ids)
  }, [dragId, dropTarget, workspaces, onReorderWorkspaces, clearDrag])

  /* -- global shortcuts ------------------------------------------- */

  const focusSearch = useCallback(() => {
    applyRailed(false)
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [applyRailed])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target)
      const mod = e.metaKey || e.ctrlKey

      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        if (typing) return
        e.preventDefault()
        applyRailed(!railed)
        return
      }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        if (typing) return
        e.preventDefault()
        focusSearch()
        return
      }
      if (e.key === "/" && !mod && !typing) {
        e.preventDefault()
        focusSearch()
        return
      }
      // Alt, not Ctrl/Cmd: browsers reserve Ctrl+1..9 for tab switching and
      // will not let a page cancel it.
      if (e.altKey && !mod && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
        if (typing) return
        const target = workspaces[Number(e.code.slice(5)) - 1]
        if (!target) return
        e.preventDefault()
        onSelect(target.id)
        setOverrides((o) => ({ ...o, [target.id]: true }))
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focusSearch, applyRailed, railed, workspaces, onSelect])

  /* -- resize ------------------------------------------------------ */

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      const startX = e.clientX
      const startWidth = railed ? RAIL_WIDTH : width
      applyRailed(false)
      setResizing(true)
      const previousSelect = document.body.style.userSelect
      const previousCursor = document.body.style.cursor
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"

      const onMove = (ev: PointerEvent) => {
        applyWidth(startWidth + (ev.clientX - startX))
      }
      const onUp = () => {
        setResizing(false)
        document.body.style.userSelect = previousSelect
        document.body.style.cursor = previousCursor
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        window.removeEventListener("pointercancel", onUp)
      }
      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
      window.addEventListener("pointercancel", onUp)
    },
    [railed, width, applyRailed, applyWidth]
  )

  const resizeByKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 32 : 8
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        applyWidth(width - step)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        applyWidth(width + step)
      } else if (e.key === "Home") {
        e.preventDefault()
        applyWidth(MIN_WIDTH)
      } else if (e.key === "End") {
        e.preventDefault()
        applyWidth(MAX_WIDTH)
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        applyRailed(!railed)
      }
    },
    [width, railed, applyWidth, applyRailed]
  )

  /* -- expansion ---------------------------------------------------- */

  const isExpanded = useCallback(
    (id: string) => {
      // While filtering, every surviving row opens so matches are reachable.
      if (filtering) return true
      return overrides[id] ?? id === activeWorkspaceId
    },
    [filtering, overrides, activeWorkspaceId]
  )

  const allExpanded =
    visible.length > 0 &&
    visible.every(({ workspace }) => isExpanded(workspace.id))

  const setAll = (next: boolean) => {
    setOverrides(
      Object.fromEntries(workspaces.map((ws) => [ws.id, next])) as Record<
        string,
        boolean
      >
    )
  }

  /* -- roving tabindex --------------------------------------------- */

  /** Exactly one row in the tree is reachable by Tab; the arrow keys do the
   *  rest. Twenty workspaces should not cost twenty tab stops. */
  const tabKey = useMemo(() => {
    const keys: string[] = []
    for (const { workspace, panes } of visible) {
      keys.push(`ws:${workspace.id}`)
      if (isExpanded(workspace.id)) {
        for (const pane of panes) keys.push(`pane:${workspace.id}:${pane.id}`)
      }
    }
    if (tabbable && keys.includes(tabbable)) return tabbable
    const activeKey = `ws:${activeWorkspaceId}`
    if (keys.includes(activeKey)) return activeKey
    return keys[0] ?? null
  }, [visible, tabbable, activeWorkspaceId, isExpanded])

  /* -- arrow-key navigation ---------------------------------------- */

  // Rows are read straight out of the DOM, so the traversal order is always
  // the order the user sees — no parallel index to keep in sync.
  const moveFocus = useCallback((delta: 1 | -1 | "first" | "last") => {
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-sb-row]") ?? []
    )
    if (rows.length === 0) return
    const current = rows.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (delta === "first") next = 0
    else if (delta === "last") next = rows.length - 1
    else if (current < 0) next = delta === 1 ? 0 : rows.length - 1
    else next = (current + delta + rows.length) % rows.length
    rows[next]?.focus()
  }, [])

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = document.activeElement as HTMLElement | null
    const kind = el?.dataset?.sbKind
    const id = el?.closest<HTMLElement>("[data-sb-ws]")?.dataset.sbWs

    // Alt+↑/↓ reorders rather than navigating.
    if (
      e.altKey &&
      canReorder &&
      kind === "workspace" &&
      id &&
      (e.key === "ArrowUp" || e.key === "ArrowDown")
    ) {
      e.preventDefault()
      moveWorkspace(id, e.key === "ArrowDown" ? 1 : -1)
      // The row travels with the data; the caret has to follow it.
      const key = `ws:${id}`
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLElement>(`[data-sb-key="${CSS.escape(key)}"]`)
          ?.focus()
      })
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        moveFocus(1)
        break
      case "ArrowUp":
        e.preventDefault()
        moveFocus(-1)
        break
      case "Home":
        e.preventDefault()
        moveFocus("first")
        break
      case "End":
        e.preventDefault()
        moveFocus("last")
        break
      case "ArrowRight":
        if (kind === "workspace" && id && !isExpanded(id)) {
          e.preventDefault()
          setOverrides((o) => ({ ...o, [id]: true }))
        } else if (kind === "workspace") {
          e.preventDefault()
          moveFocus(1)
        }
        break
      case "ArrowLeft":
        if (kind === "workspace" && id && isExpanded(id)) {
          e.preventDefault()
          setOverrides((o) => ({ ...o, [id]: false }))
        } else if (kind === "pane") {
          e.preventDefault()
          moveFocus(-1)
        }
        break
      case "F2":
        if (kind === "workspace" && id && onRenameWorkspace) {
          e.preventDefault()
          setRenamingId(id)
        }
        break
      case "Delete":
        if (kind === "workspace" && id && onDeleteWorkspace) {
          e.preventDefault()
          setConfirmDeleteId(id)
        }
        break
      case "Escape":
        if (filtering) {
          e.preventDefault()
          resetFilters()
        }
        break
      default:
        break
    }
  }

  /* -- scroll shading ---------------------------------------------- */

  const measureShade = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const top = el.scrollTop > 2
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 2
    setShade((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    )
  }, [])

  const onTreeScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => measureShade(e.currentTarget),
    [measureShade]
  )

  // The list can outgrow its box without ever being scrolled — adding a pane,
  // expanding a workspace, dragging the sidebar wider. Re-measure on all three
  // rather than waiting for a scroll event that may never come.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    measureShade(el)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => measureShade(el))
    observer.observe(el)
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measureShade, visible, railed, overrides, width])

  /* -- context menu -------------------------------------------------- */

  const hasRowMenu = Boolean(
    onAddPane ||
      onRenameWorkspace ||
      onReorderWorkspaces ||
      onDeleteWorkspace ||
      onOpenEnvVars
  )

  const menuWorkspace = menu
    ? workspaces.find((ws) => ws.id === menu.workspaceId)
    : undefined

  const menuEntries = useMemo<MenuEntry[]>(() => {
    if (!menu) return []
    const workspaceId = menu.workspaceId
    const index = workspaces.findIndex((ws) => ws.id === workspaceId)
    const entries: MenuEntry[] = []
    if (onAddPane) {
      entries.push({
        key: "add",
        label: "Add pane",
        icon: Plus,
        onSelect: () => {
          setOverrides((o) => ({ ...o, [workspaceId]: true }))
          onAddPane(workspaceId)
        },
      })
    }
    if (onRenameWorkspace) {
      entries.push({
        key: "rename",
        label: "Rename",
        icon: Pencil,
        hint: "F2",
        onSelect: () => setRenamingId(workspaceId),
      })
    }
    if (onOpenEnvVars) {
      entries.push({
        key: "env",
        label: "Environment variables",
        icon: KeyRound,
        onSelect: () => onOpenEnvVars(workspaceId),
      })
    }
    if (onReorderWorkspaces) {
      entries.push({
        key: "up",
        label: "Move up",
        icon: ArrowUp,
        hint: "Alt↑",
        disabled: !canReorder || index <= 0,
        onSelect: () => moveWorkspace(workspaceId, -1),
      })
      entries.push({
        key: "down",
        label: "Move down",
        icon: ArrowDown,
        hint: "Alt↓",
        disabled: !canReorder || index < 0 || index >= workspaces.length - 1,
        onSelect: () => moveWorkspace(workspaceId, 1),
      })
    }
    if (onDeleteWorkspace) {
      entries.push({
        key: "close",
        label: "Close workspace",
        icon: Trash2,
        hint: "Del",
        danger: true,
        onSelect: () => setConfirmDeleteId(workspaceId),
      })
    }
    return entries
  }, [
    menu,
    workspaces,
    canReorder,
    onAddPane,
    onRenameWorkspace,
    onReorderWorkspaces,
    onDeleteWorkspace,
    onOpenEnvVars,
    moveWorkspace,
  ])

  const mod = isMac ? "⌘" : "Ctrl"

  /* -- render ------------------------------------------------------ */

  return (
    <TooltipProvider delay={TIP_DELAY} closeDelay={0}>
      <div
        data-resizing={resizing ? "1" : "0"}
        style={{ width: railed ? RAIL_WIDTH : width }}
        className={cn(
          "bm-sb relative flex flex-col h-full min-h-0 shrink-0",
          "bg-bm-bg border-r border-bm-border",
          className
        )}
      >
        {railed ? (
          <Rail
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            counts={counts}
            mod={mod}
            onSelect={onSelect}
            onExpand={() => applyRailed(false)}
            onSearch={focusSearch}
            onCreateWorkspace={onCreateWorkspace}
          />
        ) : (
          <>
            {/* ---- brand + rail toggle ---- */}
            {/* Every band in this panel starts on the same 8px gutter as a tree
                row, so the left edge reads as one column rather than four. */}
            <div className="flex items-center gap-2 pl-2 pr-1 h-10 border-b border-bm-border shrink-0">
              <div className="size-[18px] rounded-[3px] bg-gradient-to-br from-purple to-violet flex items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-white leading-none">
                  BM
                </span>
              </div>
              <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-bm-text tracking-[0.01em]">
                BridgeMind
                <span className="ml-1 text-[9px] font-normal text-bm-text-dim tracking-normal">
                  v1.0
                </span>
              </span>
              <span className="flex items-center gap-px shrink-0">
                <span data-sb-help-toggle className="inline-flex">
                  <IconButton
                    icon={Keyboard}
                    label="Keyboard shortcuts"
                    side="bottom"
                    active={showHelp}
                    onClick={() => setShowHelp((v) => !v)}
                  />
                </span>
                <IconButton
                  icon={ChevronsLeft}
                  label="Collapse sidebar"
                  shortcut={`${mod}B`}
                  side="bottom"
                  onClick={() => applyRailed(true)}
                />
              </span>
            </div>

            {/* ---- search ---- */}
            <div className="px-2 pt-1.5 pb-1 shrink-0">
              <div
                className={cn(
                  "group flex items-center gap-1.5 h-[26px] px-1.5 rounded-[3px]",
                  "bg-white/[0.025] border border-bm-border",
                  "focus-within:border-bm-link/50 focus-within:bg-white/[0.04]",
                  "transition-colors duration-100"
                )}
              >
                <Search className="size-3 text-bm-text-dim shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation()
                      if (query) setQuery("")
                      else searchRef.current?.blur()
                    }
                    // Enter and ↓ both step into the results; typing then
                    // arrowing is how anyone uses a filter box.
                    if (e.key === "ArrowDown" || e.key === "Enter") {
                      e.preventDefault()
                      moveFocus("first")
                    }
                  }}
                  placeholder="Search…"
                  aria-label="Search workspaces and panes"
                  className="flex-1 min-w-0 bg-transparent text-[10px] text-bm-text placeholder:text-bm-text-dim outline-none"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    // Paints at 16px to sit inside the 26px field, but carries
                    // the shared slop so it is not a pixel hunt.
                    className="bm-ib size-4"
                  >
                    <X className="size-3 relative" />
                  </button>
                ) : (
                  <kbd className="shrink-0 pr-0.5 text-[10px] font-mono text-bm-text-dim/60 leading-none">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* ---- section header ---- */}
            {/* The label sits on a hairline that runs to the panel edge: it
                separates search from tree without stacking another border. */}
            {/* 26px, not 22px: the band has to seat a real control. The old
                height only fit a 16px glyph box, which is how the panel's
                primary action ended up smaller than the text beside it. */}
            <div className="flex items-center gap-1.5 pl-2 pr-1 h-[26px] shrink-0">
              <span className="text-[9px] font-medium text-bm-text-dim uppercase tracking-[0.14em] leading-none">
                Workspaces
              </span>
              <span className="text-[9px] font-mono text-bm-text-dim/70 tabular-nums leading-none">
                {filtering
                  ? `${visible.length}/${workspaces.length}`
                  : workspaces.length}
              </span>
              <span aria-hidden className="bm-rule flex-1 min-w-2" />
              {filtering && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="shrink-0 px-1 text-[9px] font-mono uppercase tracking-wider text-bm-link/80 hover:text-bm-link transition-colors"
                >
                  clear
                </button>
              )}
              <span className="ml-auto flex items-center gap-px">
                {workspaces.length > 1 && !filtering && (
                  <IconButton
                    icon={allExpanded ? ChevronsDownUp : ChevronsUpDown}
                    label={allExpanded ? "Collapse all" : "Expand all"}
                    onClick={() => setAll(!allExpanded)}
                    side="bottom"
                  />
                )}
                {onCreateWorkspace && (
                  <IconButton
                    icon={Plus}
                    label="New workspace"
                    onClick={onCreateWorkspace}
                    primary
                    side="bottom"
                  />
                )}
              </span>
            </div>

            {/* ---- tree ---- */}
            <div className="relative flex-1 min-h-0">
              {/* Hairlines rather than gradients: they say "more above / more
                  below" without muddying the row underneath. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-bm-border transition-opacity duration-150",
                  shade.top ? "opacity-100" : "opacity-0"
                )}
              />
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-px bg-bm-border transition-opacity duration-150",
                  shade.bottom ? "opacity-100" : "opacity-0"
                )}
              />
              <div
                ref={listRef}
                role="tree"
                aria-label="Workspaces and panes"
                onKeyDown={onListKeyDown}
                onScroll={onTreeScroll}
                // A drag released outside any row still has to clear the caret.
                onDragEnd={clearDrag}
                className="h-full overflow-y-auto scrollbar-thin pb-2"
              >
                {workspaces.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-[10px] text-bm-text-secondary">
                      No workspaces yet.
                    </p>
                    {onCreateWorkspace && (
                      <button
                        type="button"
                        onClick={onCreateWorkspace}
                        className="bm-btn mt-2"
                      >
                        <Plus className="size-3" />
                        New workspace
                      </button>
                    )}
                  </div>
                ) : visible.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-[10px] text-bm-text-secondary leading-relaxed">
                      {query.trim() ? (
                        <>
                          Nothing matches{" "}
                          <span className="text-bm-text">“{query.trim()}”</span>.
                        </>
                      ) : statusFilter === "running" ? (
                        "No workspace is live right now."
                      ) : (
                        `No pane is in ${statusFilter} state.`
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="bm-btn mt-2"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  visible.map(({ workspace, panes }) => (
                    <div key={workspace.id} data-sb-ws={workspace.id}>
                      <WorkspaceRow
                        workspace={workspace}
                        panes={panes}
                        isActive={workspace.id === activeWorkspaceId}
                        activePaneId={activePaneId}
                        expanded={isExpanded(workspace.id)}
                        query={query}
                        renaming={renamingId === workspace.id}
                        confirmingDelete={confirmDeleteId === workspace.id}
                        tabKey={tabKey}
                        draggable={canReorder}
                        dragging={dragId === workspace.id}
                        dragActive={dragId !== null}
                        dropEdge={
                          dropTarget?.id === workspace.id ? dropTarget.edge : null
                        }
                        onRowFocus={setTabbable}
                        onDragStart={() => setDragId(workspace.id)}
                        onDragOverRow={(edge) =>
                          setDropTarget((prev) =>
                            prev?.id === workspace.id && prev.edge === edge
                              ? prev
                              : { id: workspace.id, edge }
                          )
                        }
                        onDragEnd={clearDrag}
                        onDrop={commitDrop}
                        onContextMenu={(e) => {
                          if (!hasRowMenu) return
                          e.preventDefault()
                          // Shift+F10 and the Menu key raise the same event
                          // with no cursor behind it; anchor to the row then.
                          const fromKeyboard =
                            e.clientX === 0 && e.clientY === 0
                          const r = e.currentTarget.getBoundingClientRect()
                          setMenu({
                            x: fromKeyboard ? r.left + 8 : e.clientX,
                            y: fromKeyboard ? r.bottom : e.clientY,
                            workspaceId: workspace.id,
                          })
                        }}
                        onToggle={() =>
                          setOverrides((o) => ({
                            ...o,
                            [workspace.id]: !isExpanded(workspace.id),
                          }))
                        }
                        onSelect={() => {
                          setOverrides((o) => ({ ...o, [workspace.id]: true }))
                          onSelect(workspace.id)
                        }}
                        onSelectPane={(paneId) =>
                          onSelectPane?.(workspace.id, paneId)
                        }
                        onAddPane={
                          onAddPane
                            ? () => {
                                // A pane added to a collapsed workspace would
                                // otherwise land somewhere the user cannot see.
                                setOverrides((o) => ({
                                  ...o,
                                  [workspace.id]: true,
                                }))
                                onAddPane(workspace.id)
                              }
                            : undefined
                        }
                        onClosePane={
                          onClosePane
                            ? (paneId) => onClosePane(workspace.id, paneId)
                            : undefined
                        }
                        onStartRename={
                          onRenameWorkspace
                            ? () => setRenamingId(workspace.id)
                            : undefined
                        }
                        onCommitRename={(name) => {
                          onRenameWorkspace?.(workspace.id, name)
                          setRenamingId(null)
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onRequestDelete={
                          onDeleteWorkspace
                            ? () => setConfirmDeleteId(workspace.id)
                            : undefined
                        }
                        onConfirmDelete={() => {
                          onDeleteWorkspace?.(workspace.id)
                          setConfirmDeleteId(null)
                        }}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ---- status bar ----
                Counters live at the foot, the way a terminal reports state.
                At the top they were the loudest thing on the panel and pushed
                the tree — the actual content — below the fold. */}
            {showHelp && (
              <ShortcutSheet
                mod={mod}
                canReorder={Boolean(onReorderWorkspaces)}
                onClose={() => setShowHelp(false)}
              />
            )}
            <ActivityMeter
              counts={counts}
              filter={statusFilter}
              onFilter={setStatusFilter}
            />
          </>
        )}

        {menu && menuWorkspace && menuEntries.length > 0 && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            title={menuWorkspace.name}
            entries={menuEntries}
            onClose={() => setMenu(null)}
          />
        )}

        {/* ---- resize handle ---- */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuenow={railed ? RAIL_WIDTH : width}
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={resizeByKey}
          onDoubleClick={() => {
            applyWidth(DEFAULT_WIDTH)
            applyRailed(false)
          }}
          className={cn(
            "bm-sb-resize absolute top-0 -right-[3px] z-20 h-full w-[6px] cursor-col-resize",
            resizing && "bm-sb-resize-active"
          )}
        />
      </div>
    </TooltipProvider>
  )
}

export type { WorkspaceItem as SidebarWorkspaceItem, SidebarPane }
