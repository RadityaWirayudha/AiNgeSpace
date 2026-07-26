"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Folder,
  GitBranch,
  Terminal,
  Layers,
  Server,
  Boxes,
  Brain,
  BookOpen,
  Settings2,
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

/* ------------------------------------------------------------------
   TYPES
-------------------------------------------------------------------*/
export interface WorkspaceDraft {
  id: string
  name: string
  repo: string
  branch: string
  layoutId: string
  terminalCount: number
  agentIds: string[]
  agentCount: number
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
  { id: 1, label: "Repositori" },
  { id: 2, label: "Layout" },
  { id: 3, label: "Agen" },
] as const

const LAYOUTS = [
  { id: "l1", label: "1", count: 1 },
  { id: "l2v", label: "2", count: 2, dir: "row" },
  { id: "l2h", label: "2", count: 2, dir: "col" },
  { id: "l4", label: "4", count: 4, grid: [2, 2] },
  { id: "l6", label: "6", count: 6, grid: [3, 2] },
  { id: "l8", label: "8", count: 8, grid: [4, 2] },
] as const

const PRESETS = [
  { id: "p1", name: "Frontend", icon: Layers, layout: "l4", agents: ["a1", "a3"], desc: "UI, komponen, styling" },
  { id: "p2", name: "Backend", icon: Server, layout: "l4", agents: ["a2"], desc: "API, layanan, data" },
  { id: "p3", name: "Fullstack", icon: Boxes, layout: "l6", agents: ["a1", "a2"], desc: "Klien dan server bersamaan" },
  { id: "p4", name: "AI Dev", icon: Brain, layout: "l6", agents: ["a1", "a2", "a4"], desc: "Model + aplikasi paralel" },
  { id: "p5", name: "Riset", icon: BookOpen, layout: "l2v", agents: ["a4"], desc: "Notebook dan eksplorasi" },
  { id: "p6", name: "DevOps", icon: Settings2, layout: "l8", agents: ["a2", "a5"], desc: "Infra, pipeline, pemantauan" },
] as const

const AGENTS = [
  { id: "a1", name: "Frontline", provider: "Anthropic", model: "Sonnet 5", icon: Bot, desc: "Membaca dan mengedit kode UI, menjaga komponen tetap sinkron.", tokens: "~4k / turn" },
  { id: "a2", name: "Backline", provider: "Anthropic", model: "Sonnet 5", icon: Cpu, desc: "Mengelola layanan, migrasi, dan kontrak API.", tokens: "~6k / turn" },
  { id: "a3", name: "Reviewer", provider: "Anthropic", model: "Haiku 4.5", icon: Sparkles, desc: "Tinjauan cepat pada diff sebelum masuk.", tokens: "~1.5k / turn" },
  { id: "a4", name: "Analyst", provider: "Anthropic", model: "Opus 4.8", icon: Zap, desc: "Penalaran mendalam untuk data dan tugas riset.", tokens: "~9k / turn" },
  { id: "a5", name: "Watcher", provider: "Anthropic", model: "Haiku 4.5", icon: Terminal, desc: "Memantau log dan pipeline, menandai kegagalan.", tokens: "~1k / turn" },
] as const

type Layout = (typeof LAYOUTS)[number]

/* ------------------------------------------------------------------
   GRID PREVIEW
-------------------------------------------------------------------*/
function GridPreview({
  layout,
  size = 44,
  active,
}: {
  layout: Layout
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

const inputCls =
  "w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-purple/50 transition-colors font-mono"

/* ------------------------------------------------------------------
   LANGKAH 1 — REPOSITORI
-------------------------------------------------------------------*/
function RepositoryStep({
  workspaceName,
  setWorkspaceName,
  repoUrl,
  setRepoUrl,
  branch,
  setBranch,
  showErrors,
}: {
  workspaceName: string
  setWorkspaceName: (v: string) => void
  repoUrl: string
  setRepoUrl: (v: string) => void
  branch: string
  setBranch: (v: string) => void
  showErrors: boolean
}) {
  const nameError =
    showErrors && !workspaceName.trim() ? "Nama workspace wajib diisi." : undefined
  // Validate the shape rather than only checking for emptiness, so the repo is
  // usable downstream.
  const repoError =
    showErrors && !/^[\w.-]+\/[\w.-]+$/.test(repoUrl.trim())
      ? "Gunakan format pengguna/nama-repo."
      : undefined

  return (
    <div className="space-y-5">
      <Field
        label="Nama workspace"
        hint="Label untuk workspace ini di sidebar."
        error={nameError}
      >
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="proyek-saya"
          aria-invalid={!!nameError}
          className={cn(inputCls, nameError && "border-destructive/60")}
        />
      </Field>

      <Field
        label="Repositori GitHub"
        hint="Repo yang akan digunakan workspace ini."
        error={repoError}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border transition-colors focus-within:border-purple/50",
            repoError ? "border-destructive/60" : "border-border"
          )}
        >
          <Folder className="size-3.5 text-zinc-500 shrink-0" />
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="user/nama-repo"
            aria-invalid={!!repoError}
            aria-label="Repositori GitHub"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
          />
        </div>
      </Field>

      <Field label="Cabang">
        <div className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border border-border focus-within:border-purple/50 transition-colors">
          <GitBranch className="size-3.5 text-zinc-500 shrink-0" />
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            aria-label="Cabang"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
          />
        </div>
      </Field>
    </div>
  )
}

/* ------------------------------------------------------------------
   LANGKAH 2 — LAYOUT
-------------------------------------------------------------------*/
function LayoutStep({
  layoutId,
  setLayoutId,
  presetId,
  applyPreset,
}: {
  layoutId: string
  setLayoutId: (v: string) => void
  presetId: string | null
  applyPreset: (id: string) => void
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

      <div>
        <span className="text-[13px] font-semibold text-foreground block mb-1">
          Prasetel
        </span>
        <p className="text-[11px] text-zinc-500 mb-3">
          Layout dan agen dalam satu klik.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const on = presetId === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "text-left flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-colors border",
                  on
                    ? "bg-purple/10 border-purple"
                    : "bg-secondary border-border hover:border-zinc-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "size-6 rounded-md flex items-center justify-center",
                      on ? "bg-purple" : "bg-zinc-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-3.5",
                        on ? "text-[#0E0E10]" : "text-zinc-400"
                      )}
                      strokeWidth={1.9}
                    />
                  </span>
                  {on && <Check className="size-3.5 text-purple" strokeWidth={2.5} />}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{p.desc}</div>
                </div>
              </button>
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
export function CreateWorkspaceDialog({
  open,
  onClose,
  onCreated,
}: CreateWorkspaceDialogProps) {
  const [step, setStep] = useState(1)
  const [showErrors, setShowErrors] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [layoutId, setLayoutId] = useState("l1")
  const [presetId, setPresetId] = useState<string | null>(null)
  const [agents, setAgents] = useState<Record<string, boolean>>({ a1: true })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setStep(1)
    setShowErrors(false)
    setWorkspaceName("")
    setRepoUrl("")
    setBranch("main")
    setLayoutId("l1")
    setPresetId(null)
    setAgents({ a1: true })
    setSubmitting(false)
    setSubmitError(null)
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

  const toggleAgent = useCallback((id: string) => {
    setAgents((prev) => ({ ...prev, [id]: !prev[id] }))
    // Hand-editing agents means the selection no longer matches a preset.
    setPresetId(null)
  }, [])

  // Presets advertised an agent set but only ever applied the layout, so
  // picking "AI Dev" silently left you with the default single agent.
  const applyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setPresetId(id)
    setLayoutId(preset.layout)
    setAgents(Object.fromEntries(preset.agents.map((a) => [a, true])))
  }, [])

  const heading = useMemo(() => {
    if (step === 1)
      return {
        title: "Pilih repositorimu",
        sub: "Hubungkan repo GitHub dan beri nama workspace.",
      }
    if (step === 2)
      return {
        title: "Atur layout",
        sub: "Pilih berapa banyak terminal yang berjalan berdampingan.",
      }
    return {
      title: "Tambah agen AI",
      sub: "Pilih agen yang otomatis dijalankan saat workspace dibuka.",
    }
  }, [step])

  const step1Valid =
    workspaceName.trim().length > 0 &&
    /^[\w.-]+\/[\w.-]+$/.test(repoUrl.trim())

  const handleLaunch = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const terminalCount =
        LAYOUTS.find((l) => l.id === layoutId)?.count ?? 1
      const agentIds = AGENTS.filter((a) => agents[a.id]).map((a) => a.id)

      let workspaceId: string | null = null
      try {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workspaceName.trim(),
            githubRepo: repoUrl.trim(),
            githubBranch: branch.trim() || "main",
          }),
        })
        if (res.ok) {
          const data = await res.json()
          workspaceId = data.id ?? null
        }
      } catch {
        // Offline or unauthenticated — fall back to a local-only workspace
        // rather than blocking the user.
      }

      if (!workspaceId) workspaceId = `ws-${Date.now()}`

      onCreated?.({
        id: workspaceId,
        name: workspaceName.trim(),
        repo: repoUrl.trim(),
        branch: branch.trim() || "main",
        layoutId,
        terminalCount,
        agentIds,
        agentCount: agentIds.length,
      })
      handleClose()
    } catch {
      setSubmitError("Gagal membuat workspace. Coba lagi.")
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (step === 1 && !step1Valid) {
      // The old build let you tab past an invalid step and only failed later.
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
            <RepositoryStep
              workspaceName={workspaceName}
              setWorkspaceName={setWorkspaceName}
              repoUrl={repoUrl}
              setRepoUrl={setRepoUrl}
              branch={branch}
              setBranch={setBranch}
              showErrors={showErrors}
            />
          )}
          {step === 2 && (
            <LayoutStep
              layoutId={layoutId}
              setLayoutId={(id) => {
                setLayoutId(id)
                setPresetId(null)
              }}
              presetId={presetId}
              applyPreset={applyPreset}
            />
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
            {/* "Lewati" used to call handleClose, throwing away everything the
                user had entered. It now jumps to the last step instead. */}
            {step < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!step1Valid) {
                    setShowErrors(true)
                    setStep(1)
                    return
                  }
                  setStep(3)
                }}
                disabled={submitting}
                className="text-zinc-400"
              >
                Lewati
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
                ? "Berikut: layout"
                : step === 2
                  ? "Berikut: agen"
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
