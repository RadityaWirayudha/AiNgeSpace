"use client"

import { X, Pin, Maximize2, Minimize2, SplitSquareHorizontal } from "lucide-react"
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
  /** When false, the active orange/live ring is not painted on the pane's
   *  outer border. Use when a pane contains multiple split children so the
   *  active highlight can be delegated to a single child instead. */
  activeRing?: boolean
  /** Real agent state. Drives the header dot independently of selection. */
  status?: "running" | "idle" | "warning" | "error"
  progress?: number
  headerActions?: PaneHeaderAction[]
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Removes body padding for full-bleed children such as terminals. */
  flush?: boolean
  onClose?: () => void
  onPin?: () => void
  onSplit?: () => void
  expanded?: boolean
  onToggleExpand?: () => void
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
            type="button"
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation()
              onClick()
            }}
            className={cn(
              "inline-flex items-center justify-center size-5 rounded-sm transition-[color,background-color,opacity]",
              "text-bm-text-secondary hover:text-bm-text hover:bg-white/[0.06]",
              // Icons stay hidden until hover to keep the chrome quiet, but must
              // reappear on keyboard focus or they become unreachable controls.
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              variant === "destructive" &&
                "hover:text-destructive hover:bg-destructive/10"
            )}
          />
        }
      >
        <Icon className="size-3" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[10px] font-mono">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Pane({
  title,
  active = false,
  activeRing = true,
  status = "idle",
  progress,
  headerActions,
  footer,
  children,
  className,
  flush = false,
  onClose,
  onPin,
  onSplit,
  expanded = false,
  onToggleExpand,
  pinned = false,
}: PaneProps) {
  return (
    <div
      className={cn(
        "bm-pane group",
        active && activeRing && "bm-pane-active",
        expanded && "rounded-none",
        className
      )}
    >
      <div className="bm-pane-header">
        <div className="flex items-center gap-2 min-w-0">
          {/* Status is carried by a dot as well as border colour — colour alone
              is not perceivable for every user, so the state is also exposed
              as text to assistive tech. */}
          <span
            className={cn(
              "size-1.5 rounded-full shrink-0",
              status === "running" && "bg-bm-live bm-dot-live",
              status === "warning" && "bg-bm-warning",
              status === "error" && "bg-destructive",
              status === "idle" && (active ? "bg-bm-text" : "bg-bm-text-dim")
            )}
          >
            <span className="sr-only">{status}</span>
          </span>
          <span
            title={title}
            className={cn(
              "text-[11px] font-medium font-mono truncate",
              active ? "text-bm-text" : "text-bm-text-secondary"
            )}
          >
            {title}
          </span>
          {progress !== undefined && (
            <span className="bm-progress bm-progress-active">{progress}%</span>
          )}
          {pinned && <Pin className="size-2.5 text-bm-link shrink-0" />}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {headerActions?.map((action) => (
            <HeaderButton
              key={action.label}
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
          {onToggleExpand && (
            <HeaderButton
              icon={expanded ? Minimize2 : Maximize2}
              label={expanded ? "Restore" : "Expand"}
              onClick={onToggleExpand}
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

        {progress !== undefined && (
          <span
            aria-hidden
            className="bm-progress-rail"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        )}
      </div>

      <div className={cn("bm-pane-body", flush && "bm-pane-body-flush")}>
        {children}
      </div>

      {footer && <div className="bm-pane-footer">{footer}</div>}
    </div>
  )
}
