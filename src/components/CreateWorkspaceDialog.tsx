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
import { applyWorkingDirInput, compactPath, joinPath } from "@/lib/workspace/paths"
import {
  fetchWorkspaces,
  type WorkspaceRow,
} from "@/features/workspace/workspace-api"
import type { DirectoryProbe, DirectoryProblem } from "@/types/desktop"

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
/** Shown in the box before a folder has been chosen. Dim, and never submitted —
 *  it is an example, not a default. Only the web build ever sees it: on the
 *  desktop the field starts at the user's real home folder. */
const WORKING_DIR_EXAMPLE = "C:\\Users\\nama\\projects\\app"

/**
 * Why the chosen folder was refused. Phrased as what is true of the folder, not
 * as what the user did wrong — the path may well have come from a workspace
 * created on another machine.
 */
const FOLDER_PROBLEM: Record<DirectoryProblem, string> = {
  missing: "Folder ini belum ada di komputer kamu.",
  "not-directory": "Itu sebuah berkas, bukan folder.",
  denied: "Folder ini ada, tapi Windows tidak mengizinkan kami membukanya.",
}

/**
 * What to do about it, shown under the prompt the moment a folder turns out not
 * to exist.
 *
 * Being told "wrong" is not actionable, so this answers the question the user
 * actually has: *then where am I?* It names the deepest folder on the path that
 * does exist and lists what is inside it — the same thing they would see if they
 * opened that folder in Explorer — and each name is a button that goes there.
 */
function FolderGuidance({
  probe,
  onEnter,
  onBrowse,
}: {
  probe: DirectoryProbe
  onEnter: (name: string) => void
  onBrowse: (() => void) | null
}) {
  return (
    <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[11px] text-amber-200/90">
        <AlertCircle className="size-3 shrink-0 mt-[3px]" />
        <span>{FOLDER_PROBLEM[probe.reason ?? "missing"]}</span>
      </p>

      {probe.nearest ? (
        <>
          <p className="mt-2 text-[11px] text-zinc-400">
            Yang benar-benar ada sampai sini:{" "}
            <span className="font-mono text-zinc-300">{probe.nearest}</span>
          </p>

          {probe.children.length > 0 ? (
            <>
              <p className="mt-2 text-[11px] text-zinc-500">
                Isinya — klik untuk masuk:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {probe.children.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onEnter(name)}
                    className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 font-mono text-[11px] text-zinc-300 transition-colors hover:border-zinc-500 hover:text-foreground cursor-pointer"
                  >
                    <Folder className="size-3 text-zinc-500" strokeWidth={1.9} />
                    {name}
                  </button>
                ))}
                {/* The list is capped in the main process. Saying so is more
                    honest than letting eight names read as "that is all". */}
                {probe.more && (
                  <span className="self-center font-mono text-[11px] text-zinc-600">
                    …dan lainnya
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-[11px] text-zinc-500">
              Tidak ada sub-folder yang bisa dibaca di sana.
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-[11px] text-zinc-500">
          Drive-nya sendiri tidak terbaca — mungkin kartu atau drive jaringan
          yang sedang tidak tersambung.
        </p>
      )}

      {onBrowse && (
        <button
          type="button"
          onClick={onBrowse}
          className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-purple hover:underline cursor-pointer"
        >
          <FolderSearch className="size-3" />
          Cari sendiri lewat file explorer
        </button>
      )}
    </div>
  )
}

function WorkingFolderStep({
  path,
  command,
  onCommandChange,
  onRunCommand,
  onBrowse,
  problem,
  onEnterChild,
  error,
}: {
  /** The folder that has been chosen. Read-only here: the box is a picker, not
   *  a text field, so this only ever changes through `onBrowse` or the prompt. */
  path: string
  command: string
  onCommandChange: (v: string) => void
  onRunCommand: () => void
  /** Null on the web build: there is no OS picker to open there, so the box is
   *  not dressed up as a control that would do nothing. */
  onBrowse: (() => void) | null
  /** A finished probe of `path` that came back bad. Null while it is unknown —
   *  mid-typing, or on the web build where nothing can be checked. */
  problem: DirectoryProbe | null
  onEnterChild: (name: string) => void
  error?: string
}) {
  const empty = path.length === 0

  // Identical between the two branches so the box does not shift by a pixel
  // between the desktop and web builds.
  const boxClass = cn(
    "w-full flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border transition-colors",
    error || problem ? "border-destructive/60" : "border-border"
  )

  const boxContents = (
    <>
      <Folder className="size-3.5 text-zinc-500 shrink-0" />
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-left text-sm font-mono",
          empty ? "text-zinc-600" : "text-foreground"
        )}
      >
        {empty ? WORKING_DIR_EXAMPLE : path}
      </span>
    </>
  )

  return (
    <Field
      label="Working folder"
      hint="Tempat semua terminal di workspace ini mulai berjalan."
      error={error}
    >
      {onBrowse ? (
        <button
          type="button"
          onClick={onBrowse}
          // The whole box opens the picker, not just the icon. The icon marks
          // what the box does; making it the only hit target would leave most
          // of a full-width control inert for no reason.
          title={path || undefined}
          aria-label={
            path ? `Ganti folder kerja. Sekarang: ${path}` : "Pilih folder kerja"
          }
          className={cn(
            boxClass,
            "group cursor-pointer hover:border-zinc-500 focus:outline-none focus-visible:border-purple/50"
          )}
        >
          {boxContents}
          <FolderSearch className="size-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-foreground" />
        </button>
      ) : (
        // Web build. No picker exists, so this is a readout — and the browse
        // icon is dropped with it rather than left as an affordance for
        // something that cannot happen. The prompt below still works.
        <div className={boxClass} title={path || undefined}>
          {boxContents}
        </div>
      )}

      {/* The only typeable part of this step. It is a shell prompt: `cd ../x`
          moves the folder above, relative to whatever is already there. */}
      <div className="mt-2 flex items-center gap-1.5 h-5 font-mono text-[11px]">
        <span aria-hidden="true" className="select-none text-zinc-700">
          &gt;
        </span>
        <input
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          // Enter runs the line rather than submitting the step — the step's
          // own button is the way forward, and a prompt that advanced a wizard
          // would be a trap for anyone used to a shell.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            onRunCommand()
          }}
          // Also on blur, so clicking straight through to "Berikutnya" applies
          // the line the user can see they typed.
          onBlur={onRunCommand}
          placeholder="cd ../other-project"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Perintah cd untuk memindahkan folder kerja"
          className="flex-1 min-w-0 bg-transparent outline-none text-zinc-400 caret-purple placeholder:text-zinc-600"
        />
      </div>

      {problem && (
        <FolderGuidance
          probe={problem}
          onEnter={onEnterChild}
          onBrowse={onBrowse}
        />
      )}
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
/** Same store, for the same reason. The bridge reads this off an env var the
 *  main process sets before the window exists, so it is available on the very
 *  first render — no effect, and therefore no empty field flashing past. */
const readHomeDir = () => window.bridgemind?.homeDir ?? ""
const NO_HOME = () => ""

/** Long enough that holding a key down does not fire a probe per character,
 *  short enough that the answer feels like it belongs to what was just typed. */
const PROBE_DELAY_MS = 250

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
  // The box and the prompt are two different things, so they are two states.
  // `pickedDir` is the folder the user has actually chosen — empty means "still
  // the default", which is why it is stored separately from the folder shown.
  // `dirCommand` is the line being typed at the prompt, which is allowed to be
  // half-finished.
  const [pickedDir, setPickedDir] = useState("")
  const [dirCommand, setDirCommand] = useState("")
  /** The last answer from the filesystem, tagged with the path it was about —
   *  an answer to a path the user has since moved off is not evidence. */
  const [probe, setProbe] = useState<{ path: string; result: DirectoryProbe } | null>(
    null
  )
  const [layoutId, setLayoutId] = useState("l1")
  const [recent, setRecent] = useState<WorkspaceRow[]>([])
  const [agents, setAgents] = useState<Record<string, boolean>>({ a1: true })
  const [submitting, setSubmitting] = useState(false)
  /** A folder check is in flight from one of the footer buttons. Separate from
   *  `submitting` because nothing has been created yet — it only stops a second
   *  click from starting a second workspace behind the first one's check. */
  const [checking, setChecking] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  const isDesktop = useSyncExternalStore(NEVER_CHANGES, readDesktop, NOT_DESKTOP)
  const homeDir = useSyncExternalStore(NEVER_CHANGES, readHomeDir, NO_HOME)

  /** The folder the box shows. Home is where a file explorer opens, so it is
   *  where this opens too — and because it is derived rather than copied into
   *  state, `reset()` falls back to it for free. */
  const workingDir = pickedDir || homeDir

  const reset = useCallback(() => {
    setStep(1)
    setShowErrors(false)
    setProductId(DEFAULT_PRODUCT)
    setPickedDir("")
    setDirCommand("")
    setProbe(null)
    setLayoutId("l1")
    setAgents({ a1: true })
    setSubmitting(false)
    setChecking(false)
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
   * Where the step would land if it were submitted right now — the chosen
   * folder, with any unrun prompt line applied on top. Deriving it rather than
   * waiting for Enter is what makes "type `cd ../x`, click Berikutnya" work
   * without the click having to race a blur through React state.
   *
   * An empty prompt is *not* passed to `applyWorkingDirInput`: an empty line
   * would resolve to an empty path and wipe the folder that is already chosen.
   */
  const resolvedWorkingDir = useMemo(
    () =>
      dirCommand.trim() ? applyWorkingDirInput(workingDir, dirCommand) : workingDir,
    [workingDir, dirCommand]
  )

  /** Enter and blur. Runs the line and clears it, the way a shell does — the box
   *  above is the output. Validation and submit never depend on it having run. */
  const runDirCommand = useCallback(() => {
    if (!dirCommand.trim()) return
    // A `cd` that resolves to nothing is refused rather than allowed to blank
    // the box; the line is still cleared, so the prompt does not sit there
    // looking like it was ignored. A folder that simply does not exist *is*
    // committed — the box shows where you asked to go, and the guidance under
    // the prompt explains why you are not there.
    if (resolvedWorkingDir) setPickedDir(resolvedWorkingDir)
    setDirCommand("")
  }, [dirCommand, resolvedWorkingDir])

  const browseForFolder = useCallback(() => {
    const bridge = window.bridgemind
    if (!bridge) return
    void bridge.chooseDirectory(workingDir).then((picked) => {
      if (!picked) return
      setPickedDir(picked)
      // The picker is absolute truth; a half-typed `cd` against the old folder
      // would otherwise still be pending and move it again on the next blur.
      setDirCommand("")
      setShowErrors(false)
    })
  }, [workingDir])

  /** True while the prompt is settled — no half-typed line waiting to move the
   *  folder. Guidance waits for this so it does not shout at someone who is
   *  three characters into typing a name. */
  const settled = dirCommand.trim().length === 0

  // Holds the working folder to what is really on disk. Debounced, because
  // `resolvedWorkingDir` changes on every keystroke at the prompt, and skipped
  // entirely on the web build, where there is no disk to ask.
  //
  // `setProbe` lives inside the `.then`, not the effect body — the repo's
  // react-hooks/set-state-in-effect rule is an error, and this is the shape the
  // rest of the codebase uses for the same reason.
  useEffect(() => {
    if (!open || step !== 2 || !isDesktop) return
    const target = resolvedWorkingDir
    if (!target) return

    let cancelled = false
    const timer = setTimeout(() => {
      const bridge = window.bridgemind
      if (!bridge) return
      void bridge.probeDirectory(target).then((result) => {
        if (cancelled) return
        setProbe({ path: target, result })
        // Adopt the OS's own spelling — "~/projects" becomes the real path,
        // "C:/Users/user" becomes "C:\Users\user". The box then matches the
        // file explorer character for character, which is the whole point.
        //
        // Only when the prompt is settled: re-basing under a pending `cd` would
        // apply that `cd` a second time on the next render. And only when the
        // spelling actually differs, so this converges after one extra probe.
        if (settled && result.ok && result.path && result.path !== target) {
          setPickedDir(result.path)
        }
      })
    }, PROBE_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `settled` is read inside the callback, so it belongs in the deps even
    // though it does not decide whether to probe.
  }, [open, step, isDesktop, resolvedWorkingDir, settled])

  /** The probe, but only if it is about the folder currently shown. Null means
   *  "not known yet", never "fine" — nothing is let through on a null. */
  const currentProbe =
    probe && probe.path === resolvedWorkingDir ? probe.result : null

  /** Fills the draft being created — it does not open the workspace that was
   *  clicked. This is the "new workspace" dialog; opening an old one from here
   *  would be a surprise. */
  const pickRecent = useCallback((row: WorkspaceRow) => {
    setPickedDir(row.working_dir)
    setDirCommand("")
    setLayoutId(row.layout_preset)
    setShowErrors(false)
  }, [])

  /** Clicking a name in the guidance list. Same move as typing `cd <name>`, but
   *  against the folder that exists rather than the one that does not. */
  const enterChildFolder = useCallback(
    (name: string) => {
      const base = currentProbe?.nearest
      if (!base) return
      setPickedDir(joinPath(base, name))
      setDirCommand("")
      setShowErrors(false)
    },
    [currentProbe]
  )

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
  // thing the user can leave unset.
  const step2Valid = resolvedWorkingDir.length > 0

  /** The probe to explain, or null. Held back until the prompt is settled so the
   *  panel does not flicker through every intermediate path while a name is
   *  being typed — unless the user has already been stopped by a button, in
   *  which case they are owed the reason immediately. */
  const folderProblem =
    currentProbe && !currentProbe.ok && (settled || showErrors)
      ? currentProbe
      : null

  /**
   * The gate both footer buttons pass through. A workspace whose folder does not
   * exist is not a workspace: every terminal in it would silently fall back to
   * some other directory, and the mistake would only surface later as commands
   * run in the wrong place.
   *
   * Uses the debounced probe when it is already about this exact path, and asks
   * outright when it is not — the click must not depend on a timer having fired.
   */
  const ensureFolderExists = async (): Promise<boolean> => {
    const target = resolvedWorkingDir
    if (!target) return false

    const bridge = window.bridgemind
    // Web build. There is no filesystem here to be right or wrong about, and
    // refusing a path this side cannot see would block creation outright.
    if (!bridge) return true

    if (probe && probe.path === target) return probe.result.ok

    setChecking(true)
    try {
      const result = await bridge.probeDirectory(target)
      setProbe({ path: target, result })
      return result.ok
    } catch {
      // The check itself broke. Blocking on a failure of the checker would be
      // punishing the user for our bug; the terminal will report the real
      // problem if there is one.
      return true
    } finally {
      setChecking(false)
    }
  }

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

  const goNext = async () => {
    // The old build let you tab past an invalid step and only failed later.
    if (step === 2 && !(await ensureFolderExists())) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    setStep((s) => Math.min(3, s + 1))
  }

  /** "Buka tanpa AI" skips step 3, not step 2 — the folder is still checked. */
  const launchWithoutAgents = async () => {
    if (!(await ensureFolderExists())) {
      setShowErrors(true)
      setStep(2)
      return
    }
    await handleLaunch([])
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
                path={workingDir}
                command={dirCommand}
                onCommandChange={setDirCommand}
                onRunCommand={runDirCommand}
                onBrowse={isDesktop ? browseForFolder : null}
                problem={folderProblem}
                onEnterChild={enterChildFolder}
                error={
                  !showErrors
                    ? undefined
                    : !step2Valid
                      ? "Pilih folder tempat terminal akan dijalankan."
                      : folderProblem
                        ? // The reason is spelled out in the panel below; this
                          // line exists so a blocked click says *something*,
                          // rather than looking like the button is broken.
                          "Belum bisa lanjut — folder kerjanya harus benar-benar ada."
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
            disabled={step === 1 || submitting || checking}
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
                onClick={() => void launchWithoutAgents()}
                disabled={submitting || checking}
                className="text-zinc-400"
              >
                Buka tanpa AI
              </Button>
            )}
            <Button
              size="sm"
              disabled={submitting || checking}
              onClick={() => void (step < 3 ? goNext() : handleLaunch())}
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
