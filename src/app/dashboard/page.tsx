"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Terminal,
  GitBranch,
  FolderOpen,
  Clock,
  ArrowRight,
  Plus,
  Code2,
  Activity,
  HardDrive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CreateWorkspaceDialog } from "@/components/CreateWorkspaceDialog"

const mockWorkspaces = [
  {
    id: "ws-1",
    name: "my-nextjs-app",
    repo: "user/my-nextjs-app",
    branch: "main",
    updatedAt: "2 hours ago",
    language: "TypeScript",
    status: "active" as const,
  },
  {
    id: "ws-2",
    name: "ai-chatbot",
    repo: "user/ai-chatbot",
    branch: "develop",
    updatedAt: "1 day ago",
    language: "Python",
    status: "idle" as const,
  },
  {
    id: "ws-3",
    name: "portfolio-site",
    repo: "user/portfolio-site",
    branch: "main",
    updatedAt: "3 days ago",
    language: "JavaScript",
    status: "idle" as const,
  },
]

const languageColors: Record<string, string> = {
  TypeScript: "text-blue-400 bg-blue-400/10",
  Python: "text-green-400 bg-green-400/10",
  JavaScript: "text-yellow-400 bg-yellow-400/10",
}

const statusColors: Record<string, { dot: string; label: string }> = {
  active: { dot: "bg-green-500", label: "Active" },
  idle: { dot: "bg-zinc-600", label: "Idle" },
}

export default function DashboardPage() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-purple/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-violet/[0.03] rounded-full blur-[100px] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between h-14 px-5 border-b border-white/[0.06] shrink-0 backdrop-blur-md bg-[#09090b]/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-purple/15 to-violet/10 border border-purple/15 flex items-center justify-center">
              <Terminal className="size-3.5 text-purple" />
            </div>
            <span className="text-sm font-bold tracking-tight">AiNgeSpace</span>
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
          {[
            { icon: FolderOpen, label: "Workspaces", value: "3", color: "text-purple" },
            { icon: Activity, label: "Active", value: "1", color: "text-green-400" },
            { icon: HardDrive, label: "Storage", value: "2.4 GB", color: "text-blue-400" },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl card-surface">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`size-3.5 ${stat.color}`} />
                <span className="text-[11px] text-zinc-500 font-medium">{stat.label}</span>
              </div>
              <div className="text-lg font-bold tracking-tight">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          {mockWorkspaces.map((ws) => (
            <Link key={ws.id} href={`/workspace/${ws.id}`}>
              <div className="group relative flex items-center gap-4 p-4 rounded-xl card-surface hover:border-purple/20 transition-all duration-300 cursor-pointer">
                <div className="size-11 rounded-xl bg-purple/8 border border-purple/10 flex items-center justify-center shrink-0 group-hover:bg-purple/12 group-hover:scale-105 transition-all duration-300">
                  <FolderOpen className="size-5 text-purple/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground group-hover:text-purple-light transition-colors">
                      {ws.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`size-1.5 rounded-full ${statusColors[ws.status].dot}`} />
                      <span className="text-[10px] text-zinc-600">{statusColors[ws.status].label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <GitBranch className="size-3 text-purple/60" />
                      {ws.branch}
                    </span>
                    <span className="w-px h-3 bg-white/[0.06]" />
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {ws.updatedAt}
                    </span>
                    {ws.language && (
                      <>
                        <span className="w-px h-3 bg-white/[0.06]" />
                        <span className={`flex items-center gap-1 ${languageColors[ws.language] || "text-zinc-400"}`}>
                          <Code2 className="size-3" />
                          {ws.language}
                        </span>
                      </>
                    )}
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
          // Hand the chosen layout to the workspace route, which reads and
          // clears it on mount.
          try {
            localStorage.setItem(
              "aingespace:pending-layout",
              JSON.stringify({
                terminalCount: draft.terminalCount,
                layoutId: draft.layoutId,
                agentIds: draft.agentIds,
              })
            )
          } catch {
            // Private mode / storage disabled — the workspace still opens.
          }
          router.push(`/workspace/${draft.id}`)
        }}
      />
    </div>
  )
}
