"use client"

import { useState, useMemo, useCallback } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/* ------------------------------------------------------------------
   TYPES
-------------------------------------------------------------------*/
interface CreateWorkspaceDialogProps {
  open: boolean
  onClose: () => void
  onCreated?: (workspaceId: string) => void
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
  { id: "l1", label: "1", count: 1, cells: [[1, 1]] },
  { id: "l2v", label: "2", count: 2, cells: [[1, 1], [1, 1]], dir: "row" as const },
  { id: "l2h", label: "2", count: 2, cells: [[1], [1]], dir: "col" as const },
  { id: "l4", label: "4", count: 4, grid: [2, 2] as const },
  { id: "l6", label: "6", count: 6, grid: [3, 2] as const },
  { id: "l8", label: "8", count: 8, grid: [4, 2] as const },
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

/* ------------------------------------------------------------------
   GRID PREVIEW
-------------------------------------------------------------------*/
interface LayoutGrid {
  grid: readonly [number, number]
  dir?: never
}

interface LayoutDir {
  grid?: never
  dir: "row" | "col"
}

interface LayoutSingle {
  grid?: never
  dir?: never
}

type LayoutShape = LayoutGrid | LayoutDir | LayoutSingle

function GridPreview({
  layout,
  size = 44,
  active,
}: {
  layout: (typeof LAYOUTS)[number]
  size?: number
  active: boolean
}) {
  const cellColor = active ? "border-purple" : "border-zinc-600"
  const cellBg = active ? "bg-purple/10" : "bg-transparent"
  const opacity = active ? "opacity-100" : "opacity-55"
  const shape = layout as unknown as LayoutShape

  if (shape.grid) {
    const [cols, rows] = shape.grid
    return (
      <div
        className={cn("grid gap-[3px]", opacity)}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, width: size, height: size }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div key={i} className={cn("rounded-[2px] border", cellColor, cellBg)} />
        ))}
      </div>
    )
  }

  if (shape.dir === "row") {
    return (
      <div className={cn("flex gap-[3px]", opacity)} style={{ width: size, height: size }}>
        <div className={cn("flex-1 rounded-[2px] border", cellColor, cellBg)} />
        <div className={cn("flex-1 rounded-[2px] border", cellColor, cellBg)} />
      </div>
    )
  }

  if (shape.dir === "col") {
    return (
      <div className={cn("flex flex-col gap-[3px]", opacity)} style={{ width: size, height: size }}>
        <div className={cn("flex-1 rounded-[2px] border", cellColor, cellBg)} />
        <div className={cn("flex-1 rounded-[2px] border", cellColor, cellBg)} />
      </div>
    )
  }

  return (
    <div
      className={cn("rounded-[2px] border", cellColor, cellBg, opacity)}
      style={{ width: size, height: size }}
    />
  )
}

/* ------------------------------------------------------------------
   TOGGLE
-------------------------------------------------------------------*/
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative w-9 h-5 rounded-full shrink-0 transition-colors duration-150 outline-none cursor-pointer",
        on ? "bg-purple" : "bg-zinc-700"
      )}
    >
      <div
        className={cn(
          "absolute top-[2px] w-4 h-4 rounded-full transition-all duration-150",
          on ? "left-[18px] bg-[#0E0E10]" : "left-[2px] bg-zinc-500"
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------------
   STEP INDICATORS
-------------------------------------------------------------------*/
function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-1">
      {STEPS.map((s, i) => {
        const done = s.id < current
        const active = s.id === current
        return (
          <div key={s.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-150 border",
                  done
                    ? "bg-purple border-purple text-[#0E0E10]"
                    : active
                      ? "bg-purple/10 border-purple text-purple"
                      : "bg-transparent border-zinc-700 text-zinc-600"
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : s.id}
              </div>
              <span
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  active ? "text-foreground" : done ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-px",
                  done ? "bg-purple/60" : "bg-zinc-700"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

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
}: {
  workspaceName: string
  setWorkspaceName: (v: string) => void
  repoUrl: string
  setRepoUrl: (v: string) => void
  branch: string
  setBranch: (v: string) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-[13px] font-semibold text-foreground block mb-1.5">
          Nama workspace
        </label>
        <p className="text-[11px] text-zinc-500 mb-2.5">
          Label untuk workspace ini di sidebar.
        </p>
        <input
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="proyek-saya"
          className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-purple/50 focus:ring-1 focus:ring-purple/20 transition-colors font-mono"
        />
      </div>

      <div>
        <label className="text-[13px] font-semibold text-foreground block mb-1.5">
          Repositori GitHub
        </label>
        <p className="text-[11px] text-zinc-500 mb-2.5">
          Repo yang akan digunakan workspace ini.
        </p>
        <div className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border border-border focus-within:border-purple/50 focus-within:ring-1 focus-within:ring-purple/20 transition-colors">
          <Folder className="size-3.5 text-zinc-500 shrink-0" />
          <input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="user/nama-repo"
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
          />
        </div>
      </div>

      <div>
        <label className="text-[13px] font-semibold text-foreground block mb-1.5">
          Cabang
        </label>
        <div className="flex items-center gap-2.5 h-9 px-3 rounded-lg bg-secondary border border-border focus-within:border-purple/50 focus-within:ring-1 focus-within:ring-purple/20 transition-colors">
          <GitBranch className="size-3.5 text-zinc-500 shrink-0" />
          <input
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-zinc-600 font-mono"
          />
        </div>
      </div>
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
  setPresetId,
}: {
  layoutId: string
  setLayoutId: (v: string) => void
  presetId: string | null
  setPresetId: (v: string | null) => void
}) {
  const active = LAYOUTS.find((l) => l.id === layoutId)!

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <label className="text-[13px] font-semibold text-foreground block">
              Layout terminal
            </label>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Berapa banyak panel terminal yang kamu butuhkan?
            </p>
          </div>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {active.count} terminal
          </Badge>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {LAYOUTS.map((l) => {
            const on = l.id === layoutId
            return (
              <button
                key={l.id}
                onClick={() => {
                  setLayoutId(l.id)
                  setPresetId(null)
                }}
                className={cn(
                  "flex flex-col items-center gap-2 py-3 px-1 rounded-lg cursor-pointer transition-all duration-150 border",
                  on
                    ? "bg-purple/10 border-purple"
                    : "bg-secondary border-border hover:border-zinc-500"
                )}
              >
                <GridPreview layout={l} active={on} />
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    on ? "text-purple" : "text-zinc-600"
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
        <label className="text-[13px] font-semibold text-foreground block mb-1">
          Prasetel
        </label>
        <p className="text-[11px] text-zinc-500 mb-3">
          Workspace, layout, dan agen dalam satu klik.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const on = presetId === p.id
            const Icon = p.icon
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPresetId(p.id)
                  setLayoutId(p.layout)
                }}
                className={cn(
                  "text-left flex flex-col gap-2 p-3 rounded-lg cursor-pointer transition-all duration-150 border",
                  on
                    ? "bg-purple/10 border-purple"
                    : "bg-secondary border-border hover:border-zinc-500"
                )}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center",
                      on ? "bg-purple" : "bg-zinc-800"
                    )}
                  >
                    <Icon
                      className={cn("size-3.5", on ? "text-[#0E0E10]" : "text-zinc-500")}
                      strokeWidth={1.9}
                    />
                  </div>
                  {on && <Check className="size-3.5 text-purple" strokeWidth={2.5} />}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{p.name}</div>
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
      <div className="flex items-center justify-between mb-1">
        <div>
          <label className="text-[13px] font-semibold text-foreground block">
            Jalankan agen secara otomatis
          </label>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Agen akan dimulai di panel terminal masing-masing saat workspace dibuka.
          </p>
        </div>
        <Badge variant="secondary" className="text-[11px] font-mono">
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
                "flex items-start gap-3 p-3.5 rounded-lg border transition-all duration-150",
                on
                  ? "bg-purple/5 border-purple/30"
                  : "bg-secondary border-border"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg shrink-0 mt-0.5 flex items-center justify-center",
                  on ? "bg-purple" : "bg-zinc-800"
                )}
              >
                <Icon
                  className={cn("size-3.5", on ? "text-[#0E0E10]" : "text-zinc-500")}
                  strokeWidth={1.9}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-foreground">
                    {a.name}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {a.provider} · {a.model}
                  </span>
                  <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto font-mono">
                    {a.tokens}
                  </span>
                </div>
                <div className="text-[12px] text-zinc-500 mt-1">{a.desc}</div>
              </div>

              <Toggle on={on} onClick={() => toggleAgent(a.id)} />
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
  const [workspaceName, setWorkspaceName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [layoutId, setLayoutId] = useState("l1")
  const [presetId, setPresetId] = useState<string | null>(null)
  const [agents, setAgents] = useState<Record<string, boolean>>({ a1: true })
  const [submitting, setSubmitting] = useState(false)

  const toggleAgent = useCallback((id: string) => {
    setAgents((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const heading = useMemo(() => {
    if (step === 1) return { title: "Pilih repositorimu", sub: "Hubungkan repo GitHub dan beri nama workspace." }
    if (step === 2) return { title: "Atur layout", sub: "Pilih berapa banyak terminal yang ingin dijalankan berdampingan." }
    return { title: "Tambah agen AI", sub: "Pilih agen mana yang otomatis dijalankan saat workspace ini dibuka." }
  }, [step])

  const canNext = useMemo(() => {
    if (step === 1) return workspaceName.trim().length > 0 && repoUrl.trim().length > 0
    return true
  }, [step, workspaceName, repoUrl])

  const handleLaunch = async () => {
    setSubmitting(true)
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
        onCreated?.(data.id)
        handleClose()
      }
    } catch {
      // diam saja — user bisa coba ulang
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setWorkspaceName("")
    setRepoUrl("")
    setBranch("main")
    setLayoutId("l1")
    setPresetId(null)
    setAgents({ a1: true })
    setSubmitting(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-up"
        style={{ animationDuration: "0.2s" }}
        onClick={handleClose}
      />

      {/* dialog */}
      <div
        className="relative w-full max-w-[640px] bg-bm-pane border border-bm-border rounded-xl shadow-2xl overflow-hidden animate-fade-in-up"
        style={{ animationDuration: "0.25s" }}
      >
        {/* tombol tutup */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-foreground hover:bg-white/5 transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="px-7 pt-6 pb-5">
          <Stepper current={step} />

          <div className="text-center mt-4 mb-5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {heading.title}
            </h2>
            <p className="text-[12px] text-zinc-500 mt-1">{heading.sub}</p>
          </div>

          <div className="min-h-[320px]">
            {step === 1 && (
              <RepositoryStep
                workspaceName={workspaceName}
                setWorkspaceName={setWorkspaceName}
                repoUrl={repoUrl}
                setRepoUrl={setRepoUrl}
                branch={branch}
                setBranch={setBranch}
              />
            )}
            {step === 2 && (
              <LayoutStep
                layoutId={layoutId}
                setLayoutId={setLayoutId}
                presetId={presetId}
                setPresetId={setPresetId}
              />
            )}
            {step === 3 && (
              <AgentsStep enabled={agents} toggleAgent={toggleAgent} />
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-bm-border/50 bg-bm-bg/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="gap-1 text-zinc-500"
          >
            <ChevronLeft className="size-3.5" />
            Kembali
          </Button>

          <div className="flex items-center gap-2">
            {step < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="text-zinc-500"
              >
                Lewati
              </Button>
            )}
            <Button
              size="sm"
              disabled={!canNext || submitting}
              onClick={() => {
                if (step < 3) {
                  setStep((s) => s + 1)
                } else {
                  handleLaunch()
                }
              }}
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
