"use client"

import Link from "next/link"
import { GitBranch, Wifi, Terminal, LogOut, ChevronDown, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

export function Header({ workspaceName }: { workspaceName?: string }) {
  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-white/[0.06] bg-[#0c0c0f]/80 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="size-6 rounded-lg bg-gradient-to-br from-purple/15 to-violet/10 border border-purple/10 flex items-center justify-center group-hover:border-purple/20 transition-colors">
            <Terminal className="size-3 text-purple" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">
            AiNgeSpace
          </span>
        </Link>
        {workspaceName && (
          <>
            <div className="w-px h-3.5 bg-white/[0.06]" />
            <span className="text-xs text-zinc-500 font-mono">{workspaceName}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="gap-1.5 text-[11px] font-mono font-normal border border-white/[0.06] bg-white/[0.03] text-zinc-400 rounded-md">
          <GitBranch className="size-3 text-purple" />
          main
        </Badge>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <div className="relative">
            <Wifi className="size-3.5 text-green-500" />
            <div className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <span>Connected</span>
        </div>

        <div className="w-px h-4 bg-white/[0.06]" />

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs hover:bg-white/[0.04] transition-colors outline-none">
            <div className="size-5 rounded-full bg-gradient-to-br from-purple to-violet flex items-center justify-center ring-2 ring-white/[0.06]">
              <span className="text-[10px] font-bold text-white">U</span>
            </div>
            <ChevronDown className="size-3 text-zinc-500" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-white/[0.08] bg-[#0c0c0f]">
            <DropdownMenuItem className="gap-2 text-xs text-zinc-400 focus:text-foreground">
              <Settings className="size-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem className="gap-2 text-xs text-zinc-400 focus:text-foreground">
              <LogOut className="size-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
