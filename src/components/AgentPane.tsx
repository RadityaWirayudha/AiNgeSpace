"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Pane } from "@/components/Pane"

interface AgentPaneProps {
  title: string
  active?: boolean
  status?: "running" | "idle" | "warning" | "error"
  progress?: number
  items?: string[]
  bulletPoints?: { label: string; value: string }[]
  links?: { text: string; href: string }[]
  warning?: string
  server?: string
  controlPanel?: string
  duration?: string
  autoMode?: boolean
  agentCount?: number
  className?: string
  onClose?: () => void
}

function StatusDot({ status }: { status: AgentPaneProps["status"] }) {
  const colors = {
    running: "bg-purple",
    idle: "bg-bm-text-secondary",
    warning: "bg-bm-warning",
    error: "bg-destructive",
  }

  return (
    <span
      className={cn(
        "size-1.5 rounded-full shrink-0",
        colors[status ?? "idle"],
        status === "running" && "animate-pulse"
      )}
    />
  )
}

export function AgentPane({
  title,
  active = false,
  status = "idle",
  progress,
  items,
  bulletPoints,
  links,
  warning,
  server,
  controlPanel,
  duration,
  autoMode = true,
  agentCount = 0,
  className,
  onClose,
}: AgentPaneProps) {
  const [pinned, setPinned] = useState(false)

  return (
    <Pane
      title={title}
      active={active}
      progress={progress}
      pinned={pinned}
      onPin={() => setPinned(!pinned)}
      onClose={onClose}
      className={className}
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="flex items-center gap-1.5">
            <span className="text-bm-text-secondary">»</span>
            {autoMode && <span>auto mode on</span>}
            {agentCount > 0 && (
              <span className="text-bm-text-secondary">
                · {agentCount} agent{agentCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          {duration && <span>{duration}</span>}
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {warning && (
          <div className="text-bm-warning text-[11px] leading-relaxed">
            {warning}
          </div>
        )}

        {items && items.length > 0 && (
          <div className="flex flex-col gap-1">
            {items.map((item, i) => (
              <div key={i} className="text-bm-text text-[12px] leading-relaxed">
                {item}
              </div>
            ))}
          </div>
        )}

        {bulletPoints && bulletPoints.length > 0 && (
          <div className="flex flex-col gap-1">
            {bulletPoints.map((bp, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="text-bm-text-secondary shrink-0">•</span>
                <span>
                  <span className="text-bm-text-secondary">{bp.label}: </span>
                  <span className="bm-link">{bp.value}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {links && links.length > 0 && (
          <div className="flex flex-col gap-1">
            {links.map((link, i) => (
              <div key={i} className="text-[12px]">
                <span className="bm-link cursor-pointer">{link.text}</span>
              </div>
            ))}
          </div>
        )}

        {server && (
          <div className="flex flex-col gap-0.5 text-[12px]">
            <span className="text-bm-text-secondary">Server:</span>
            <span className="bm-link">{server}</span>
          </div>
        )}

        {controlPanel && (
          <div className="flex flex-col gap-0.5 text-[12px]">
            <span className="text-bm-text-secondary">Control Panel:</span>
            <span className="bm-link">{controlPanel}</span>
          </div>
        )}
      </div>
    </Pane>
  )
}
