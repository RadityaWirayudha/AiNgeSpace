"use client"

import {
  Plus,
  X,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useTerminalStore } from "./terminal-store"
import type { SplitDirection } from "@/types"

interface TerminalToolbarProps {
  terminalId: string
  terminalName: string
  isActive: boolean
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  variant = "ghost",
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: "ghost" | "destructive"
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              "inline-flex items-center justify-center size-6 rounded-md transition-colors outline-none",
              "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]",
              variant === "destructive" &&
                "hover:text-destructive hover:bg-destructive/10"
            )}
          />
        }
      >
        <Icon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function SplitButton({
  dir,
  label,
  onClick,
}: {
  dir: SplitDirection
  label: string
  onClick: () => void
}) {
  const isVertical = dir === "left" || dir === "right"
  const currentIsLeft = dir === "left"
  const currentIsTop = dir === "up"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              "inline-flex items-center justify-center size-6 rounded-md transition-colors outline-none",
              "hover:bg-purple/10 group"
            )}
          />
        }
      >
        {isVertical ? (
          <div className="flex gap-[1px] w-3 h-2.5">
            <div
              className={cn(
                "flex-1 rounded-[1px] transition-colors",
                currentIsLeft
                  ? "bg-zinc-500 group-hover:bg-purple"
                  : "bg-zinc-700 group-hover:bg-purple/40"
              )}
            />
            <div
              className={cn(
                "flex-1 rounded-[1px] transition-colors",
                !currentIsLeft
                  ? "bg-zinc-500 group-hover:bg-purple"
                  : "bg-zinc-700 group-hover:bg-purple/40"
              )}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-[1px] w-2.5 h-3">
            <div
              className={cn(
                "flex-1 rounded-[1px] transition-colors",
                currentIsTop
                  ? "bg-zinc-500 group-hover:bg-purple"
                  : "bg-zinc-700 group-hover:bg-purple/40"
              )}
            />
            <div
              className={cn(
                "flex-1 rounded-[1px] transition-colors",
                !currentIsTop
                  ? "bg-zinc-500 group-hover:bg-purple"
                  : "bg-zinc-700 group-hover:bg-purple/40"
              )}
            />
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function DuplicateButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              "inline-flex items-center justify-center size-6 rounded-md transition-colors outline-none",
              "hover:bg-purple/10 group"
            )}
          />
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-500 group-hover:text-purple transition-colors"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" className="fill-zinc-700 group-hover:fill-purple/20 transition-colors" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" className="fill-zinc-500 group-hover:fill-purple transition-colors" />
        </svg>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function TerminalToolbar({
  terminalId,
  terminalName,
  isActive,
}: TerminalToolbarProps) {
  const { addTerminal, closeTerminal, duplicateTerminal, setActiveTerminal } =
    useTerminalStore()

  return (
    <div
      className={cn(
        "flex items-center justify-between h-8 px-2 border-b transition-all duration-200 shrink-0",
        isActive
          ? "border-purple/20 bg-gradient-to-r from-purple/[0.04] to-transparent"
          : "border-white/[0.04] bg-[#0c0c0f]"
      )}
      onClick={() => setActiveTerminal(terminalId)}
    >
      <div className="flex items-center gap-1.5">
        {isActive && (
          <span className="size-1.5 rounded-full bg-purple animate-pulse" />
        )}
        <span
          className={cn(
            "text-[11px] font-medium font-mono",
            isActive ? "text-zinc-200" : "text-zinc-500"
          )}
        >
          {terminalName}
        </span>
      </div>

      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <ToolbarButton
          icon={Plus}
          label="New Terminal"
          onClick={() => addTerminal()}
        />
        <div className="w-px h-3 bg-white/[0.06] mx-0.5" />
        <SplitButton
          dir="left"
          label="Split Left"
          onClick={() => addTerminal(terminalId, "left")}
        />
        <SplitButton
          dir="right"
          label="Split Right"
          onClick={() => addTerminal(terminalId, "right")}
        />
        <SplitButton
          dir="up"
          label="Split Up"
          onClick={() => addTerminal(terminalId, "up")}
        />
        <SplitButton
          dir="down"
          label="Split Down"
          onClick={() => addTerminal(terminalId, "down")}
        />
        <div className="w-px h-3 bg-white/[0.06] mx-0.5" />
        <DuplicateButton
          label="Duplicate"
          onClick={() => duplicateTerminal(terminalId)}
        />
        <ToolbarButton
          icon={X}
          label="Close"
          onClick={() => closeTerminal(terminalId)}
          variant="destructive"
        />
      </div>
    </div>
  )
}
