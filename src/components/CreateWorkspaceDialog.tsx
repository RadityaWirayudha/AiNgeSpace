"use client"

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react"
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Folder,
  FolderSearch,
  FolderTree,
  GitBranch,
  Terminal,
  Layers,
  Server,
  Boxes,
  Brain,
  BookOpen,
  Settings2,
  History,
  Bot,
  Cpu,
  Sparkles,
  Zap,
  Play,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LAYOUT_PRESETS,
  terminalCountFor,
  type LayoutPreset,
} from "@/lib/workspace/layouts"
import { applyWorkingDirInput, compactPath } from "@/lib/workspace/paths"
import {
  fetchWorkspaces,
  type WorkspaceRow,
} from "@/features/workspace/workspace-api"

/* ------------------------------------------------------------------
   TYPES
-------------------------------------------------------------------*/
export interface WorkspaceDraft {
  id: string
  name: string
  /** Absolute folder every terminal in this workspace starts in. */
  workingDir: string
  layoutId: string
  terminalCount: number
  agentIds: string[]
  agentCount: number
  /** False when the POST failed and this workspace exists only in this tab.
   *  The caller uses it to decide whether anything may be written back — the
   *  id belongs to no row, so a pane insert against it would 404. */
  persisted: boolean
}

interface CreateWorkspaceDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (draft: WorkspaceDraft) => void
}

/* ------------------------------------------------------------------
   DATA
-------------------------------------------------------------------*/
const STEPS = [
  { id: 1, label: "Start" },
  { id: 2, label: "Layout" },
  { id: 3, label: "Agen" },
] as const

/** How many workspaces the Recent grid shows. Two columns, so an even number. */
const RECENT_LIMIT = 6

/**
 * Deliberately UI only. Two of the three do not exist yet, and the workspace row
 * has no column for this — a field that can only ever hold one value carries no
 * information. Give it a column on the day a second product can actually be
 * selected.
 */
const PRODUCTS = [
  {
    id: "aingespace",
    name: "AiNgeSpace",
    icon: Terminal,
    desc: "Terminal paralel dengan agen di tiap panel.",
    available: true,
  },
  {
    id: "aingecommit",
    name: "AiNgeCommit",
    icon: GitBranch,
    desc: "Alur commit dan review yang dibantu agen.",
    available: false,
  },
  {
    id: "aingeexplorer",
    name: "AiNgExplorer",
    icon: FolderTree,
    desc: "Menjelajah berkas dan struktur proyek dari satu panel.",
    available: false,
  },
] as const

const DEFAULT_PRODUCT = "aingespace"

// The presets themselves live in src/lib/workspace/layouts.ts, because the
// database CHECK constraint and both workspace route handlers need the same
// list — and the workspace route needs the terminal count that only this
// dialog used to know.
const LAYOUTS = LAYOUT_PRESETS

/**
 * Not wired up yet — the tiles render disabled under a Coming Soon badge, so
 * this list is labels only. The layout and agent set each preset used to apply
 * were removed with it: an unread field is a promise the code does not keep, and
 * the pairing will be redesigned when the feature is actually built.
 */
const PRESETS = [
  { id: "p1", name: "Frontend", icon: Layers, desc: "UI, komponen, styling" },
  { id: "p2", name: "Backend", icon: Server, desc: "API, layanan, data" },
  { id: "p3", name: "Fullstack", icon: Boxes, desc: "Klien dan server bersamaan" },
  { id: "p4", name: "AI Dev", icon: Brain, desc: "Model + aplikasi paralel" },
  { id: "p5", name: "Riset", icon: BookOpen, desc: "Notebook dan eksplorasi" },
  { id: "p6", name: "DevOps", icon: Settings2, desc: "Infra, pipeline, pemantauan" },
] as const

const AGENTS = [
  { id: "a1", name: "Frontline", provider: "Anthropic", model: "Sonnet 5", icon: Bot, desc: "Membaca dan mengedit kode UI, menjaga komponen tetap sinkron.", tokens: "~4k / turn" },
  { id: "a2", name: "Backline", provider: "Anthropic", model: "Sonnet 5", icon: Cpu, desc: "Mengelola layanan, migrasi, dan kontrak API.", tokens: "~6k / turn" },
  { id: "a3", name: "Reviewer", provider: "Anthropic", model: "Haiku 4.5", icon: Sparkles, desc: "Tinjauan cepat pada diff sebelum masuk.", tokens: "~1.5k / turn" },
  { id: "a4", name: "Analyst", provider: "Anthropic", model: "Opus 4.8", icon: Zap, desc: "Penalaran mendalam untuk data dan tugas riset.", tokens: "~9k / turn" },
  { id: "a5", name: "Watcher", provider: "Anthropic", model: "Haiku 4.5", icon: Terminal, desc: "Memantau log dan pipeline, menandai kegagalan.", tokens: "~1k / turn" },
] as const

/* ------------------------------------------------------------------
   GRID PREVIEW
-------------------------------------------------------------------*/
function GridPreview({
  layout,
  size = 44,
  active,
}: {
  layout: LayoutPreset
  size?: number
  active: boolean
}) {
  const cell = cn(
    "rounded-[2px] border",
    active ? "border-purple bg-purple/10" : "border-zinc-600"
  )
  const opacity = active ? "opacity-100" : "opacity-55"
  const grid = "grid" in layout ? layout.grid : undefined
  const dir = "dir" in layout ? layout.dir : undefined

  if (grid) {
    const [cols, rows] = grid
    return (
      <div
        className={cn("grid gap-[3px]", opacity)}
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          width: size,
          height: size,
        }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} className={cell} />
        ))}
      </div>
    )
  }

  if (dir) {
    return (
      <div
        className={cn("flex gap-[3px]", dir === "col" && "flex-col", opacity)}
        style={{ width: size, height: size }}
      >
        <div className={cn("flex-1", cell)} />
        <div className={cn("flex-1", cell)} />
      </div>
    )
  }

  return (
    <div className={cn(cell, opacity)} style={{ width: size, height: size }} />
  )
}

/* ------------------------------------------------------------------
   TOGGLE
-------------------------------------------------------------------*/
function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative w-9 h-5 rounded-full shrink-0 transition-colors duration-150 cursor-pointer",
        on ? "bg-purple" : "bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] size-4 rounded-full transition-all duration-150",
          on ? "left-[18px] bg-[#0E0E10]" : "left-[2px] bg-zinc-400"
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------------
   STEPPER
-------------------------------------------------------------------*/
function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2.5">
      {STEPS.map((s, i) => {
        const done = s.id < current
        const active = s.id === current
        return (
          <li key={s.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors border",
                  done
                    ? "bg-purple border-purple text-[#0E0E10]"
                    : active
                      ? "bg-purple/10 border-purple text-purple"
                      : "bg-transparent border-zinc-700 text-zinc-600"
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : s.id}
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : done
                      ? "text-zinc-400"
                      : "text-zinc-600"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn("w-8 h-px", done ? "bg-purple/60" : "bg-zinc-700")}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------
   FIELD
-------------------------------------------------------------------*/
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[13px] font-semibold text-foreground block mb-1">
        {label}
      </label>
      {hint && <p className="text-[11px] text-zinc-500 mb-2">{hint}</p>}
      {children}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-destructive mt-1.5">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 1 — START
-------------------------------------------------------------------*/
function StartStep({
  productId,
  setProductId,
}: {
  productId: string
  setProductId: (v: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Fitur" className="space-y-2">
      {PRODUCTS.map((p) => {
        const on = p.id === productId
        const Icon = p.icon
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            // `disabled` also keeps these out of the dialog's focus trap, which
            // filters on `button:not([disabled])`.
            disabled={!p.available}
            onClick={() => setProductId(p.id)}
            className={cn(
              "w-full text-left flex items-center gap-3 p-3.5 rounded-lg border transition-colors",
              !p.available
                ? "bg-secondary/40 border-border/60 opacity-60 cursor-not-allowed"
                : on
                  ? "bg-purple/10 border-purple cursor-pointer"
                  : "bg-secondary border-border hover:border-zinc-500 cursor-pointer"
            )}
          >
            <span
              className={cn(
                "size-8 rounded-lg shrink-0 flex items-center justify-center",
                on ? "bg-purple" : "bg-zinc-800"
              )}
            >
              <Icon
                className={cn("size-3.5", on ? "text-[#0E0E10]" : "text-zinc-400")}
                strokeWidth={1.9}
              />
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-foreground">
                  {p.name}
                </span>
                {!p.available && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-zinc-700 text-zinc-500"
                  >
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="text-[12px] text-zinc-500 mt-0.5">{p.desc}</p>
            </div>

            {on && (
              <Check className="size-3.5 text-purple shrink-0" strokeWidth={2.5} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 2 — WORKING FOLDER (dirender bersama layout)
-------------------------------------------------------------------*/
function WorkingFolderStep({
  value,
  onChange,
  onCommit,
  onBrowse,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  /** Null on the web build: there is no OS dialog to open there. */
  onBrowse: (() => void) | null
  error?: string
}) {
  return (
    <Field
      label="Working folder"
      hint="Tempat semua terminal di workspace ini mulai berjalan."
      error={error}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border transition-colors focus-within:border-purple/50",
          error ? "border-destructive/60" : "border-border"
        )}
      >
        <Folder className="size-3.5 text-zinc-500 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Enter resolves `cd ..` in place rather than submitting the step —
          // this field behaves like a prompt, which is what the hint promises.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            onCommit()
          }}
          onBlur={onCommit}
          placeholder="C:\Users\nama\projects\app"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={!!error}
          aria-label="Working folder"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
        />
        {onBrowse && (
          <button
            type="button"
            onClick={onBrowse}
            aria-label="Pilih folder"
            className="size-6 -mr-1 rounded-md shrink-0 flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
          >
            <FolderSearch className="size-3.5" />
          </button>
        )}
      </div>

      {/* Announces that the field also takes `cd`, which nothing else would. */}
      <p className="mt-2 text-[11px] font-mono text-zinc-600">
        <span className="text-zinc-700 select-none">&gt; </span>
        cd ../other-project
      </p>
    </Field>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 2 — RECENT
-------------------------------------------------------------------*/
function RecentSection({
  items,
  onPick,
}: {
  items: WorkspaceRow[]
  onPick: (row: WorkspaceRow) => void
}) {
  // Nothing to recall yet. An empty box teaches a first-time user nothing.
  if (items.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <History className="size-3.5 text-zinc-500" />
          <span className="text-[13px] font-semibold text-foreground">Recent</span>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {items.length}
          </Badge>
        </div>
        <span className="text-[11px] text-zinc-500">Workspace terakhir dibuka</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onPick(row)}
            // compactPath drops the head of the path; the full one stays
            // reachable rather than being lost to make the card fit.
            title={row.working_dir}
            className="text-left flex items-center gap-2.5 p-3 rounded-lg cursor-pointer transition-colors border bg-secondary border-border hover:border-zinc-500"
          >
            <span className="size-6 rounded-md bg-zinc-800 shrink-0 flex items-center justify-center">
              <Folder className="size-3.5 text-zinc-400" strokeWidth={1.9} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-foreground truncate">
                {row.name}
              </span>
              <span className="block text-[11px] text-zinc-500 font-mono truncate">
                {compactPath(row.working_dir)}
              </span>
            </span>
            <span className="text-[11px] font-mono text-zinc-500 shrink-0">
              {terminalCountFor(row.layout_preset)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 2 — LAYOUT (dirender di bawah field repositori)
-------------------------------------------------------------------*/
function LayoutStep({
  layoutId,
  setLayoutId,
  recent,
  onPickRecent,
}: {
  layoutId: string
  setLayoutId: (v: string) => void
  recent: WorkspaceRow[]
  onPickRecent: (row: WorkspaceRow) => void
}) {
  const active = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between mb-3 gap-3">
          <div>
            <span className="text-[13px] font-semibold text-foreground block">
              Layout terminal
            </span>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Berapa banyak panel terminal yang kamu butuhkan?
            </p>
          </div>
          <Badge variant="secondary" className="text-[11px] font-mono shrink-0">
            {active.count} terminal
          </Badge>
        </div>

        <div
          role="radiogroup"
          aria-label="Layout terminal"
          className="grid grid-cols-3 sm:grid-cols-6 gap-2"
        >
          {LAYOUTS.map((l) => {
            const on = l.id === layoutId
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${l.count} terminal`}
                onClick={() => setLayoutId(l.id)}
                className={cn(
                  "flex flex-col items-center gap-2 py-3 px-1 rounded-lg cursor-pointer transition-colors border",
                  on
                    ? "bg-purple/10 border-purple"
                    : "bg-secondary border-border hover:border-zinc-500"
                )}
              >
                <GridPreview layout={l} active={on} />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    on ? "text-purple" : "text-zinc-500"
                  )}
                >
                  {l.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <RecentSection items={recent} onPick={onPickRecent} />

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-semibold text-foreground">Presets</span>
          <Badge
            variant="outline"
            className="text-[10px] border-zinc-700 text-zinc-500"
          >
            Coming Soon
          </Badge>
        </div>
        <p className="text-[11px] text-zinc-500 mb-3">
          Layout dan agen dalam satu klik. Belum aktif.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.id}
                aria-hidden="true"
                className="text-left flex flex-col gap-2 p-3 rounded-lg border bg-secondary/40 border-border/60 opacity-50 select-none"
              >
                <span className="size-6 rounded-md bg-zinc-800 flex items-center justify-center">
                  <Icon className="size-3.5 text-zinc-400" strokeWidth={1.9} />
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{p.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 3 — AGEN
-------------------------------------------------------------------*/
function AgentsStep({
  enabled,
  toggleAgent,
}: {
  enabled: Record<string, boolean>
  toggleAgent: (id: string) => void
}) {
  const activeCount = AGENTS.filter((a) => enabled[a.id]).length

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[13px] font-semibold text-foreground block">
            Jalankan agen secara otomatis
          </span>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Agen dimulai di panel terminal masing-masing saat workspace dibuka.
          </p>
        </div>
        <Badge variant="secondary" className="text-[11px] font-mono shrink-0">
          {activeCount} aktif
        </Badge>
      </div>

      <div className="space-y-2">
        {AGENTS.map((a) => {
          const on = !!enabled[a.id]
          const Icon = a.icon
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-lg border transition-colors",
                on ? "bg-purple/5 border-purple/30" : "bg-secondary border-border"
              )}
            >
              <span
                className={cn(
                  "size-8 rounded-lg shrink-0 mt-0.5 flex items-center justify-center",
                  on ? "bg-purple" : "bg-zinc-800"
                )}
              >
                <Icon
                  className={cn("size-3.5", on ? "text-[#0E0E10]" : "text-zinc-400")}
                  strokeWidth={1.9}
                />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-foreground">
                    {a.name}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {a.provider} · {a.model}
                  </span>
                  <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto font-mono">
                    {a.tokens}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-500 mt-1">{a.desc}</p>
              </div>

              <Toggle
                on={on}
                onClick={() => toggleAgent(a.id)}
                label={`Aktifkan agen ${a.name}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------
   DIALOG
-------------------------------------------------------------------*/

/** Distinguishes local-only workspaces created in the same millisecond, which
 *  a timestamp id could not. */
let localWorkspaceSeq = 0

/** Whether the Electron bridge exists is settled before the renderer runs, so
 *  there is nothing to subscribe to — but reading `window` during render still
 *  has to go through a store to stay hydration-safe. */
const NEVER_CHANGES = () => () => {}
const readDesktop = () => !!window.bridgemind
const NOT_DESKTOP = () => false

export function CreateWorkspaceDialog({
  open,
  onClose,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [step, setStep] = useState(1)
  const [showErrors, setShowErrors] = useState(false)
  // Pre-selected: it is the only product that exists, so making the user click
  // it would be ceremony rather than a choice.
  const [productId, setProductId] = useState<string>(DEFAULT_PRODUCT)
  // Two states for one field. `workingDir` is the folder that has been accepted
  // and is what `cd ../x` resolves against; `workingDirInput` is the raw text in
  // the box, which is allowed to be a half-typed command. Resolving on every
  // keystroke would rewrite the field the moment "cd " was typed.
  const [workingDir, setWorkingDir] = useState("")
  const [workingDirInput, setWorkingDirInput] = useState("")
  const [layoutId, setLayoutId] = useState("l1")
  const [recent, setRecent] = useState<WorkspaceRow[]>([])
  const [agents, setAgents] = useState<Record<string, boolean>>({ a1: true })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  const isDesktop = useSyncExternalStore(NEVER_CHANGES, readDesktop, NOT_DESKTOP)

  const reset = useCallback(() => {
    setStep(1)
    setShowErrors(false)
    setProductId(DEFAULT_PRODUCT)
    setWorkingDir("")
    setWorkingDirInput("")
    setLayoutId("l1")
    setAgents({ a1: true })
    setSubmitting(false)
    setSubmitError(null)
    // `recent` is deliberately left alone: the effect below refetches it on the
    // next open, and clearing it here would only make the section flicker.
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  // Escape to dismiss and a body scroll lock — the dialog previously trapped
  // the user with only the small × as an exit, and the page scrolled behind it.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        handleClose()
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, handleClose])

  // Keep Tab inside the dialog; without this, focus walked into the page
  // underneath while the modal was still covering it.
  useEffect(() => {
    if (!open) return
    const node = dialogRef.current
    if (!node) return

    const first = node.querySelector<HTMLElement>(
      "input, button:not([disabled])"
    )
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const firstEl = focusables[0]
      const lastEl = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    node.addEventListener("keydown", onKeyDown)
    return () => node.removeEventListener("keydown", onKeyDown)
  }, [open, step])

  // The Recent list is the only reason this dialog reads existing workspaces.
  // Fetching in a `.then` rather than the effect body keeps it clear of
  // react-hooks/set-state-in-effect, which is an error in this repo.
  useEffect(() => {
    if (!open) return
    let cancelled = false

    fetchWorkspaces()
      .then((rows) => {
        if (cancelled) return
        // The route orders by sort_order — the order the user dragged the
        // sidebar into. "Recent" means time, so it is re-sorted here.
        const byTime = [...rows].sort(
          (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
        )
        setRecent(byTime.slice(0, RECENT_LIMIT))
      })
      .catch(() => {
        // Recent is a shortcut, not a requirement. Signed out or offline, the
        // section simply does not appear — it must never block creation.
        if (!cancelled) setRecent([])
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const toggleAgent = useCallback((id: string) => {
    setAgents((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  /**
   * What the field means right now. `applyWorkingDirInput` is idempotent for
   * anything that is not a `cd`, so recomputing it every render is safe — and
   * that is what makes "type a path, click Next without leaving the field" work
   * without waiting for a blur to flush through React state.
   */
  const resolvedWorkingDir = useMemo(
    () => applyWorkingDirInput(workingDir, workingDirInput),
    [workingDir, workingDirInput]
  )

  /** Enter and blur only. Its job is to let the user *see* `cd ../x` turn into a
   *  real path; validation and submit never depend on it having run. */
  const commitWorkingDir = useCallback(() => {
    setWorkingDir(resolvedWorkingDir)
    setWorkingDirInput(resolvedWorkingDir)
  }, [resolvedWorkingDir])

  const browseForFolder = useCallback(() => {
    const bridge = window.bridgemind
    if (!bridge) return
    void bridge.chooseDirectory(workingDir).then((picked) => {
      if (!picked) return
      setWorkingDir(picked)
      setWorkingDirInput(picked)
      setShowErrors(false)
    })
  }, [workingDir])

  /** Fills the draft being created — it does not open the workspace that was
   *  clicked. This is the "new workspace" dialog; opening an old one from here
   *  would be a surprise. */
  const pickRecent = useCallback((row: WorkspaceRow) => {
    setWorkingDir(row.working_dir)
    setWorkingDirInput(row.working_dir)
    setLayoutId(row.layout_preset)
    setShowErrors(false)
  }, [])

  const heading = useMemo(() => {
    if (step === 1)
      return {
        title: "Start",
        sub: "Pilih fitur yang dijalankan. Namanya dibuat otomatis.",
      }
    if (step === 2)
      return {
        title: "Layout",
        sub: "Pilih folder kerja lalu tentukan jumlah panel terminal.",
      }
    return {
      title: "Tambah agen AI",
      sub: "Pilih agen yang otomatis dijalankan saat workspace dibuka.",
    }
  }, [step])

  // Step 1 has nothing to validate: the product is always pre-selected and the
  // name is generated by the server, so the working folder on step 2 is the only
  // field the user can get wrong. Its shape is not checked here — only the
  // machine running the shell can say whether a path is real.
  const step2Valid = resolvedWorkingDir.length > 0

  /** `agentOverride` serves "Buka tanpa AI", which creates the workspace now
   *  with no agents instead of walking through step 3. */
  const handleLaunch = async (agentOverride?: string[]) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const terminalCount = terminalCountFor(layoutId)
      const agentIds =
        agentOverride ?? AGENTS.filter((a) => agents[a.id]).map((a) => a.id)

      let workspaceId: string | null = null
      // The name is the server's to decide: it is the only side that can see
      // every workspace the user owns, and "Workspace 3" is only correct
      // relative to that list.
      let name: string | null = null
      try {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workingDir: resolvedWorkingDir,
            // The layout and the agent selection used to stop here: the layout
            // was smuggled through localStorage and the agents were dropped
            // entirely, so reopening a workspace lost both.
            layoutPreset: layoutId,
            agentIds,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          workspaceId = data.id ?? null
          name = data.name ?? null
        }
      } catch {
        // Offline or unauthenticated — fall back to a local-only workspace
        // rather than blocking the user.
      }

      // The old fallback was `ws-${Date.now()}`, which read as a real id but is
      // not a uuid, so every later request for it failed validation instead of
      // being recognised as unbacked. A "local-" id says what it is, and
      // `persisted: false` tells the caller not to write anything for it.
      const persisted = workspaceId !== null
      if (!workspaceId) {
        const seq = ++localWorkspaceSeq
        workspaceId = `local-ws-${seq}`
        // Numbering it "Workspace N" would be a lie: this one is not in the list
        // the server counts, so it would collide with the next real workspace.
        name = `Workspace lokal ${seq}`
      }

      onCreated?.({
        id: workspaceId,
        name: name ?? "Workspace",
        workingDir: resolvedWorkingDir,
        layoutId,
        terminalCount,
        agentIds,
        agentCount: agentIds.length,
        persisted,
      })
      handleClose()
    } catch {
      setSubmitError("Gagal membuat workspace. Coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    // The old build let you tab past an invalid step and only failed later.
    if (step === 2 && !step2Valid) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    setStep((s) => Math.min(3, s + 1))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-bm-fade-in"
        onClick={handleClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ws-title"
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col bg-bm-pane border border-bm-border rounded-xl shadow-2xl overflow-hidden animate-bm-dialog-in"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Tutup dialog"
          className="absolute top-3 right-3 z-10 size-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <X className="size-4" />
        </button>

        {/* The body scrolls on short viewports; the old fixed min-height pushed
            the footer buttons off-screen on laptops. */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-7 pt-6 pb-5">
          <Stepper current={step} />

          <div className="text-center mt-4 mb-5">
            <h2
              id="create-ws-title"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              {heading.title}
            </h2>
            <p className="text-[12px] text-zinc-500 mt-1">{heading.sub}</p>
          </div>

          {step === 1 && (
            <StartStep productId={productId} setProductId={setProductId} />
          )}
          {step === 2 && (
            <div className="space-y-6">
              <WorkingFolderStep
                value={workingDirInput}
                onChange={setWorkingDirInput}
                onCommit={commitWorkingDir}
                onBrowse={isDesktop ? browseForFolder : null}
                error={
                  showErrors && !step2Valid
                    ? "Pilih folder tempat terminal akan dijalankan."
                    : undefined
                }
              />
              <div className="h-px bg-bm-border" />
              <LayoutStep
                layoutId={layoutId}
                setLayoutId={setLayoutId}
                recent={recent}
                onPickRecent={pickRecent}
              />
            </div>
          )}
          {step === 3 && <AgentsStep enabled={agents} toggleAgent={toggleAgent} />}

          {submitError && (
            <p className="flex items-center gap-1.5 text-[12px] text-destructive mt-4">
              <AlertCircle className="size-3.5 shrink-0" />
              {submitError}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-7 py-4 border-t border-bm-border bg-bm-bg/40 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowErrors(false)
              setStep((s) => Math.max(1, s - 1))
            }}
            disabled={step === 1 || submitting}
            className="gap-1 text-zinc-400"
          >
            <ChevronLeft className="size-3.5" />
            Kembali
          </Button>

          <div className="flex items-center gap-2">
            {/* Not "skip": this creates the workspace now, with no agents. The
                old button only jumped to the last step, where the primary
                button was still waiting to be pressed. */}
            {step < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Launching without a working folder would post a body zod
                  // rejects, and the user would land on a local-only workspace
                  // without ever being told why.
                  if (!step2Valid) {
                    setShowErrors(true)
                    setStep(2)
                    return
                  }
                  void handleLaunch([])
                }}
                disabled={submitting}
                className="text-zinc-400"
              >
                Buka tanpa AI
              </Button>
            )}
            <Button
              size="sm"
              disabled={submitting}
              onClick={() => (step < 3 ? goNext() : handleLaunch())}
              className={cn(
                "gap-1.5 font-semibold",
                step === 3 && "bg-purple hover:bg-purple-dark glow-purple-sm"
              )}
            >
              {step === 1
                ? "Berikutnya: Layout"
                : step === 2
                  ? "Berikutnya: Agen"
                  : submitting
                    ? "Membuat…"
                    : "Luncurkan workspace"}
              {step < 3 ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <Play className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
