"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import {
  Terminal,
  Settings,
  HelpCircle,
  Search,
  SplitSquareHorizontal,
  Copy,
  X,
  PanelLeft,
  Maximize2,
  GitBranch,
  GitPullRequest,
  FolderGit2,
  Rocket,
  RefreshCw,
  Cloud,
  CloudOff,
  FileCode,
  ChevronRight,
  Shield,
  Bug,
  Package,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PurpSpaceMark } from "@/components/brand/PurpSpaceMark"

interface MenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  shortcut?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

interface MenuBarProps {
  onToggleExplorer?: () => void
  explorerOpen?: boolean
}

export function MenuBar({ onToggleExplorer, explorerOpen }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    // An open menu covered the app with no keyboard way out.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(null)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const menus: MenuGroup[] = [
    {
      label: "File",
      items: [
        { label: "New File", icon: FileCode, shortcut: "Ctrl+N" },
        { label: "New Terminal", icon: Terminal, shortcut: "Ctrl+`" },
        { separator: true, label: "" },
        { label: "Open Workspace", icon: FolderGit2 },
        { label: "Recent Workspaces", icon: ChevronRight },
        { separator: true, label: "" },
        { label: "Preferences", icon: Settings, shortcut: "Ctrl+," },
      ],
    },
    {
      label: "GitHub",
      items: [
        { label: "Connect GitHub", icon: Cloud },
        { label: "Clone Repository", icon: GitBranch },
        { separator: true, label: "" },
        { label: "Pull Requests", icon: GitPullRequest },
        { label: "Issues", icon: Bug },
        { separator: true, label: "" },
        { label: "Push Changes", icon: Rocket, shortcut: "Ctrl+Shift+P" },
        { label: "Pull Changes", icon: RefreshCw },
        { label: "Disconnect", icon: CloudOff, disabled: true },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: explorerOpen ? "Hide Explorer" : "Show Explorer",
          icon: PanelLeft,
          shortcut: "Ctrl+B",
          action: onToggleExplorer,
        },
        { label: "Toggle Full Screen", icon: Maximize2, shortcut: "F11" },
        { separator: true, label: "" },
        { label: "Search", icon: Search, shortcut: "Ctrl+Shift+F" },
      ],
    },
    {
      label: "Terminal",
      items: [
        { label: "New Terminal", icon: Terminal, shortcut: "Ctrl+`" },
        { label: "Split Terminal", icon: SplitSquareHorizontal },
        { separator: true, label: "" },
        { label: "Duplicate Terminal", icon: Copy },
        { label: "Close Terminal", icon: X, shortcut: "Ctrl+Shift+`" },
      ],
    },
    {
      label: "Packages",
      items: [
        { label: "Install Packages", icon: Package },
        { label: "Update Packages", icon: RefreshCw },
        { separator: true, label: "" },
        { label: "Run Scripts", icon: Terminal },
        { label: "Audit Security", icon: Shield },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Documentation", icon: HelpCircle },
        { separator: true, label: "" },
        { label: "Release Notes", icon: FileCode },
        { label: "About PurpSpace", icon: Terminal },
      ],
    },
  ]

  return (
    <div
      ref={menuRef}
      className="flex items-center h-7 px-1 bg-[#0c0c0f] border-b border-white/[0.06] shrink-0 select-none"
    >
      <Link href="/" className="flex items-center gap-0.5 mr-2 group">
        <PurpSpaceMark
          className="size-4 transition-opacity group-hover:opacity-80"
          title="PurpSpace"
        />
      </Link>

      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={openMenu === menu.label}
            className={cn(
              "px-2 py-0.5 text-[11px] rounded-sm transition-colors",
              openMenu === menu.label
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
            )}
            onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
            // Only track the pointer once a menu is already open, so merely
            // sweeping across the bar doesn't pop menus open.
            onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div
              role="menu"
              aria-label={menu.label}
              className="absolute top-full left-0 mt-0.5 w-56 py-1 rounded-lg border border-white/[0.08] bg-[#0c0c0f] shadow-2xl shadow-black/60 z-50"
            >
              {menu.items.map((item, i) =>
                item.separator ? (
                  <div key={i} role="separator" className="my-1 h-px bg-white/[0.06]" />
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1 text-[11px] text-left transition-colors",
                      item.disabled
                        ? "text-zinc-600 cursor-not-allowed"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                    )}
                    onClick={() => {
                      if (item.disabled) return
                      item.action?.()
                      setOpenMenu(null)
                    }}
                    disabled={item.disabled}
                  >
                    {item.icon && <item.icon className="size-3.5 shrink-0" />}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <span className="text-zinc-600 text-[10px] font-mono">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
