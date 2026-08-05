"use client"

import { useState, useMemo } from "react"
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Search,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { mockFileTree } from "@/features/explorer/file-tree-data"
import type { FileNode } from "@/types"

function FileIcon({ node, isOpen }: { node: FileNode; isOpen?: boolean }) {
  if (node.type === "directory") {
    return isOpen ? (
      <FolderOpen className="size-4 text-purple/80" />
    ) : (
      <Folder className="size-4 text-purple/50" />
    )
  }

  const ext = node.name.split(".").pop()
  const colorMap: Record<string, string> = {
    tsx: "text-blue-400/80",
    ts: "text-blue-300/80",
    js: "text-yellow-400/80",
    json: "text-yellow-300/80",
    css: "text-pink-400/80",
    md: "text-zinc-400/80",
  }
  return <File className={cn("size-4", colorMap[ext ?? ""] ?? "text-zinc-500")} />
}

/** Directories first, then alphabetical. Copies before sorting: calling
 *  .sort() directly mutated the shared mockFileTree constant on every render. */
function sortNodes(nodes: FileNode[]): FileNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === "directory" ? -1 : 1
  })
}

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2)
  const isDir = node.type === "directory"
  const children = useMemo(
    () => (node.children ? sortNodes(node.children) : []),
    [node.children]
  )

  return (
    <div>
      <button
        type="button"
        onClick={() => isDir && setIsOpen(!isOpen)}
        aria-expanded={isDir ? isOpen : undefined}
        title={node.name}
        className={cn(
          "flex items-center gap-1.5 w-full py-[3px] px-2 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] rounded-sm transition-colors group",
          !isDir && "cursor-default"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <span className="shrink-0">
            {isOpen ? (
              <ChevronDown className="size-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            ) : (
              <ChevronRight className="size-3 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            )}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <FileIcon node={node} isOpen={isOpen} />
        <span className="truncate">{node.name}</span>
      </button>

      {isDir && isOpen && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Explorer({ className }: { className?: string }) {
  const roots = useMemo(() => sortNodes(mockFileTree), [])

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-[#09090b] border-r border-white/[0.06]",
        className
      )}
    >
      <div className="flex items-center justify-between h-9 px-3 border-b border-white/[0.06] shrink-0">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Refresh file tree"
            className="inline-flex items-center justify-center size-5 rounded-md hover:bg-white/[0.05] transition-colors text-zinc-600 hover:text-zinc-400"
          >
            <RefreshCw className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Search files"
            className="inline-flex items-center justify-center size-5 rounded-md hover:bg-white/[0.05] transition-colors text-zinc-600 hover:text-zinc-400"
          >
            <Search className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {roots.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}
      </div>
    </div>
  )
}
