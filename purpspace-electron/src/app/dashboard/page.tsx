"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Folder,
  FolderOpen,
  Clock,
  ArrowRight,
  Plus,
  History,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"
import { CreateWorkspaceDialog } from "@/components/CreateWorkspaceDialog"
import {
  fetchWorkspaces,
  ApiError,
  type WorkspaceRow,
} from "@/features/workspace/workspace-api"
import { relativeTime } from "@/lib/format/relative-time"
import { compactPath } from "@/lib/workspace/paths"

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: WorkspaceRow[] }
  | { kind: "error"; message: string }

/** Shared so the "not ready yet" case keeps a stable identity and the stats
 *  memo does not recompute on every render. */
const NO_ROWS: WorkspaceRow[] = []

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="p-4 rounded-xl card-surface">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold tracking-tight">{value}</div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [state, setState] = useState<LoadState>({ kind: "loading" })
  // Bumped by the retry button. The fetch lives entirely in the effect so that
  // nothing sets state synchronously while React is committing.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    fetchWorkspaces()
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows })
      })
      .catch((error) => {
        if (cancelled) return
        setState({
          kind: "error",
          message:
            error instanceof ApiError && error.status === 401
              ? "Sign in to see your workspaces."
              : "Could not load workspaces.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ kind: "loading" })
    setAttempt((n) => n + 1)
  }, [])

  const rows = state.kind === "ready" ? state.rows : NO_ROWS

  /**
   * The three cards used to read "3", "1" and "2.4 GB", none of which came from
   * anywhere. These are the only figures the workspace list can actually
   * support — there is no liveness signal and no disk accounting in the schema.
   */
  const stats = useMemo(() => {
    // Distinct folders, not workspaces: two workspaces on one checkout is a
    // normal way to work, and counting them twice would say nothing.
    const folders = new Set(
      rows.map((row) => row.working_dir.trim()).filter(Boolean)
    )
    const newest = rows.reduce<string | null>((latest, row) => {
      if (!latest) return row.updated_at
      return Date.parse(row.updated_at) > Date.parse(latest)
        ? row.updated_at
        : latest
    }, null)

    return [
      {
        icon: FolderOpen,
        label: "Workspaces",
        value: String(rows.length),
        color: "text-purple",
      },
      {
        icon: Folder,
        label: "Working folders",
        value: String(folders.size),
        color: "text-blue-400",
      },
      {
        icon: History,
        label: "Last active",
        value: newest ? relativeTime(newest) : "—",
        color: "text-green-400",
      },
    ]
  }, [rows])

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-purple/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-violet/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between h-14 px-5 border-b border-white/[0.06] shrink-0 backdrop-blur-md bg-[#09090b]/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-purple/15 to-violet/10 border border-purple/15 flex items-center justify-center">
              <PurpSpaceMark className="size-5" />
            </div>
            <span className="text-sm font-bold tracking-tight">PurpSpace</span>
          </Link>
          <div className="w-px h-4 bg-white/[0.06]" />
          <span className="text-xs text-zinc-500">Dashboard</span>
        </div>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-1.5 bg-purple hover:bg-purple-dark text-white text-xs font-medium glow-purple-sm rounded-lg"
        >
          <Plus className="size-3.5" />
          New Workspace
        </Button>
      </header>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Workspaces</h1>
          <p className="text-sm text-zinc-500">
            Select a workspace to open it in the terminal.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-10">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {state.kind === "loading" && (
          <div className="flex items-center gap-2 justify-center py-16 text-sm text-zinc-500">
            <span className="size-3.5 rounded-full border-2 border-white/10 border-t-purple animate-spin" />
            Loading workspaces…
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-zinc-400">{state.message}</p>
            <Button variant="ghost" size="sm" onClick={retry}>
              Try again
            </Button>
          </div>
        )}

        {state.kind === "ready" && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="size-11 rounded-xl bg-purple/8 border border-purple/10 flex items-center justify-center">
              <FolderOpen className="size-5 text-purple/80" />
            </div>
            <div>
              <p className="text-sm font-semibold">No workspaces yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Create one to pick a working folder, a pane layout and its
                agents.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 bg-purple hover:bg-purple-dark text-white text-xs"
            >
              <Plus className="size-3.5" />
              New Workspace
            </Button>
          </div>
        )}

        <div className="grid gap-2">
          {rows.map((ws) => (
            <Link key={ws.id} href={`/workspace/${ws.id}`}>
              <div className="group relative flex items-center gap-4 p-4 rounded-xl card-surface hover:border-purple/20 transition-all duration-300 cursor-pointer">
                <div className="size-11 rounded-xl bg-purple/8 border border-purple/10 flex items-center justify-center shrink-0 group-hover:bg-purple/12 group-hover:scale-105 transition-all duration-300">
                  <FolderOpen className="size-5 text-purple/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground group-hover:text-purple-light transition-colors truncate">
                      {ws.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 min-w-0">
                    {/* compactPath keeps the tail, which is the part that
                        identifies the folder; the full path stays on hover. */}
                    <span
                      className="flex items-center gap-1 min-w-0"
                      title={ws.working_dir}
                    >
                      <Folder className="size-3 text-purple/60 shrink-0" />
                      <span className="truncate font-mono">
                        {compactPath(ws.working_dir)}
                      </span>
                    </span>
                    <span className="w-px h-3 bg-white/[0.06] shrink-0" />
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="size-3" />
                      {relativeTime(ws.updated_at)}
                    </span>
                  </div>
                </div>
                <ArrowRight className="size-4 text-zinc-600 group-hover:text-purple group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(draft) => {
          // The layout used to be smuggled to the workspace route through
          // localStorage because the POST body dropped it. It is a column now,
          // so the route reads it back from the workspace itself.
          router.push(`/workspace/${draft.id}`)
        }}
      />
    </div>
  )
}
