"use client"

import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import "@xterm/xterm/css/xterm.css"
import { cn } from "@/lib/utils"

interface TerminalPanelProps {
  isActive: boolean
  terminalId: string
  onFocus: () => void
}

export function TerminalPanel({ isActive, terminalId, onFocus }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const term = new Terminal({
      fontFamily: 'var(--font-geist-mono), "Cascadia Code", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      theme: {
        background: "#09090b",
        foreground: "#d4d4d8",
        cursor: "#9333ea",
        cursorAccent: "#09090b",
        selectionBackground: "rgba(147, 51, 234, 0.25)",
        selectionForeground: "#fafafa",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#d4d4d8",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    fitAddon.fit()
    fitAddonRef.current = fitAddon
    terminalRef.current = term

    term.writeln("\x1b[38;2;147;51;234m  ___   __  __             __      ___\x1b[0m")
    term.writeln("\x1b[38;2;168;85;247m / _ | / /_/ /_____  _____/ /__   / _ \\\x1b[0m")
    term.writeln("\x1b[38;2;192;132;252m/ __ |/ __/ __/ __ \\/ __  / _ \\ / // /\x1b[0m")
    term.writeln("\x1b[38;2;147;51;234m/_/ |_/_/ /_/ /_/ / /_/ /  __// // /\x1b[0m")
    term.writeln("\x1b[38;2;126;34;206m                           /___/____/\x1b[0m")
    term.writeln("")
    term.writeln(`  \x1b[38;2;168;85;247mWelcome to AiNgeSpace Terminal\x1b[0m`)
    term.writeln(`  \x1b[38;2;82;82;91mTerminal ID: ${terminalId}\x1b[0m`)
    term.writeln("")

    const promptStr = "\x1b[38;2;147;51;234m❯\x1b[0m "
    let currentLine = ""

    term.write(promptStr)

    term.onData((data) => {
      if (data === "\r") {
        if (currentLine.trim()) {
          term.writeln("")
          if (currentLine.trim() === "clear") {
            term.clear()
          } else if (currentLine.trim() === "help") {
            term.writeln("  \x1b[38;2;168;85;247mAvailable commands:\x1b[0m")
            term.writeln("  clear     - Clear terminal")
            term.writeln("  help      - Show this help")
            term.writeln("  whoami    - Show current user")
            term.writeln("  pwd       - Print working directory")
            term.writeln("  ls        - List files")
            term.writeln("  echo      - Echo text")
            term.writeln("")
          } else if (currentLine.trim() === "whoami") {
            term.writeln("  \x1b[38;2;147;51;234mdeveloper\x1b[0m")
            term.writeln("")
          } else if (currentLine.trim() === "pwd") {
            term.writeln("  \x1b[38;2;147;51;234m~/workspace\x1b[0m")
            term.writeln("")
          } else if (currentLine.trim() === "ls") {
            term.writeln("  \x1b[38;2;168;85;247msrc/\x1b[0m    \x1b[38;2;147;51;234mpackage.json\x1b[0m    README.md")
            term.writeln("  \x1b[38;2;192;132;252mpublic/\x1b[0m   tsconfig.json    next.config.ts")
            term.writeln("")
          } else if (currentLine.trim().startsWith("echo ")) {
            term.writeln(`  ${currentLine.trim().slice(5)}`)
            term.writeln("")
          } else {
            term.writeln(`  \x1b[38;2;82;82;91mCommand simulated: ${currentLine.trim()}\x1b[0m`)
            term.writeln("")
          }
        }
        currentLine = ""
        term.write(promptStr)
      } else if (data === "\x7f") {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write("\b \b")
        }
      } else if (data >= " ") {
        currentLine += data
        term.write(data)
      }
    })

    const observer = new ResizeObserver(() => {
      fitAddon.fit()
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      term.dispose()
      terminalRef.current = null
    }
  }, [terminalId])

  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus()
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      onClick={onFocus}
      className={cn(
        "w-full h-full bg-[#09090b] transition-all duration-200",
        isActive && "terminal-active"
      )}
    />
  )
}
