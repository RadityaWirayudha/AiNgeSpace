"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Pane } from "@/components/Pane"

interface AgentPaneProps {
  title: string
  active?: boolean
  progress?: number
  items?: string[]
  bulletPoints?: { label: string; value: string; href?: string }[]
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

export function AgentPane({
  title,
  active = false,
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
      onPin={() => setPinned((p) => !p)}
      onClose={onClose}
      className={className}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-bm-text-dim">»</span>
            {autoMode && <span className="truncate">auto mode on</span>}
            {agentCount > 0 && (
              <span className="text-bm-text-dim shrink-0">
                · {agentCount} agent{agentCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
          {duration && <span className="shrink-0 text-bm-text-dim">{duration}</span>}
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {warning && (
          <p className="bm-warning text-[11px] leading-relaxed">{warning}</p>
        )}

        {items?.map((item, i) => (
          <p key={i} className="text-bm-text text-[12px] leading-relaxed">
            {item}
          </p>
        ))}

        {bulletPoints && bulletPoints.length > 0 && (
          <ul className="flex flex-col gap-1">
            {bulletPoints.map((bp) => (
              <li key={bp.label} className="flex items-start gap-2 text-[12px]">
                <span className="text-bm-text-dim shrink-0" aria-hidden>
                  •
                </span>
                <span className="min-w-0">
                  <span className="text-bm-text-secondary">{bp.label}: </span>
                  {/* Values that carry an href are real links; the rest are
                      plain text rather than link-coloured non-links. */}
                  {bp.href ? (
                    <a href={bp.href} className="bm-link break-all">
                      {bp.value}
                    </a>
                  ) : (
                    <span className="text-bm-text break-all">{bp.value}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {links && links.length > 0 && (
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href} className="text-[12px]">
                <a href={link.href} className="bm-link break-all">
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        )}

        {(server || controlPanel) && (
          <dl className={cn("flex flex-col gap-1.5 text-[12px]")}>
            {server && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-bm-text-secondary">Server:</dt>
                <dd className="text-bm-text break-all">{server}</dd>
              </div>
            )}
            {controlPanel && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-bm-text-secondary">Control Panel:</dt>
                <dd>
                  <a href={controlPanel} className="bm-link break-all">
                    {controlPanel}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </Pane>
  )
}
