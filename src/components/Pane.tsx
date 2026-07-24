"use client"

import { useState } from "react"
import {
  X,
  Pin,
  Maximize2,
  Minimize2,
  SplitSquareHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface PaneHeaderAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: "ghost" | "destructive"
}

interface PaneProps {
  title: string
  active?: boolean
  progress?: number
  headerActions?: PaneHeaderAction[]
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  onClose?: () => void
  onPin?: () => void
  onSplit?: () => void
  onExpand?: () => void
  pinned?: boolean
}

function HeaderButton({
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
              "inline-flex items-center justify-center size-5 rounded-sm transition-colors outline-none opacity-0 group-hover:opacity-100",
              "text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.06]",
              variant === "destructive" &&
                "hover:text-destructive hover:bg-destructive/10"
            )}
          />
        }
      >
        <Icon className="size-3" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs font-mono">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Pane({
  title,
  active = false,
  progress,
  headerActions,
  footer,
  children,
  className,
  onClose,
  onPin,
  onSplit,
  onExpand,
  pinned = false,
}: PaneProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "bm-pane group",
        active && "bm-pane-active",
        expanded && "fixed inset-0 z-50 rounded-none",
        className
      )}
    >
      <div className="bm-pane-header">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "text-[11px] font-medium font-mono truncate",
              active ? "text-bm-text" : "text-bm-text-secondary"
            )}
          >
            {title}
          </span>
          {progress !== undefined && (
            <span className="bm-progress bm-progress-active">
              {progress}%
            </span>
          )}
          {pinned && (
            <Pin className="size-2.5 text-bm-sidebar-active shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {headerActions?.map((action, i) => (
            <HeaderButton
              key={i}
              icon={action.icon}
              label={action.label}
              onClick={action.onClick}
              variant={action.variant}
            />
          ))}
          {onSplit && (
            <HeaderButton
              icon={SplitSquareHorizontal}
              label="Split"
              onClick={onSplit}
            />
          )}
          {onExpand && (
            <HeaderButton
              icon={expanded ? Minimize2 : Maximize2}
              label={expanded ? "Minimize" : "Expand"}
              onClick={() => {
                setExpanded(!expanded)
                onExpand()
              }}
            />
          )}
          {onPin && (
            <HeaderButton
              icon={Pin}
              label={pinned ? "Unpin" : "Pin"}
              onClick={onPin}
            />
          )}
          {onClose && (
            <HeaderButton
              icon={X}
              label="Close"
              onClick={onClose}
              variant="destructive"
            />
          )}
        </div>
      </div>

      <div className="bm-pane-body">{children}</div>

      {footer && <div className="bm-pane-footer">{footer}</div>}
    </div>
  )
}
