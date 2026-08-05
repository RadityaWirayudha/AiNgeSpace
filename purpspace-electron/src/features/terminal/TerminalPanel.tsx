"use client"

/**
 * A slot, not a terminal.
 *
 * The `Terminal` itself lives in `terminal-instances.ts`, outside React, so
 * that unmounting this component — which happens on every split, maximize and
 * workspace switch — does not destroy the shell or the scrollback. All this
 * component does is tell the registry which box to render into.
 */

import { memo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useShellLaunch } from "./shell-launch"
import {
  attachInstance,
  detachInstance,
  focusInstance,
  setFocusHandler,
} from "./terminal-instances"

interface TerminalPanelProps {
  isActive: boolean
  terminalId: string
  onFocus: () => void
}

function TerminalPanelImpl({ isActive, terminalId, onFocus }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Held in a ref so a new callback identity from the parent cannot re-run the
  // attach effect and bounce the terminal through staging and back.
  const onFocusRef = useRef(onFocus)
  // Same reasoning for the workspace's launch settings: a re-rendered provider
  // must not re-run the attach effect. The ref starts out correct, so the very
  // first attach — the one that actually spawns the shell — already sees them.
  const launch = useShellLaunch()
  const launchRef = useRef(launch)

  useEffect(() => {
    onFocusRef.current = onFocus
  }, [onFocus])

  useEffect(() => {
    launchRef.current = launch
  }, [launch])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    attachInstance(terminalId, el, launchRef.current.claim(terminalId))
    setFocusHandler(terminalId, () => onFocusRef.current())

    return () => {
      setFocusHandler(terminalId, null)
      // Passing the element lets the registry ignore this cleanup if a newer
      // mount has already claimed the terminal, which is the order React uses
      // when a slot moves position in the tree.
      detachInstance(terminalId, el)
    }
  }, [terminalId])

  useEffect(() => {
    if (isActive) focusInstance(terminalId)
  }, [isActive, terminalId])

  return (
    <div
      ref={containerRef}
      onMouseDown={onFocus}
      className={cn(
        "w-full h-full min-h-0 min-w-0 overflow-hidden bg-bm-terminal",
        !isActive && "opacity-90"
      )}
    />
  )
}

export const TerminalPanel = memo(TerminalPanelImpl)
