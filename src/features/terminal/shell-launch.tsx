"use client"

/**
 * How a workspace tells its terminals where to open and what to run.
 *
 * This is a React context rather than a module-level "current workspace"
 * variable on purpose. Child effects run before parent effects, so a global set
 * by the layout would still be empty when the first `TerminalPanel` attaches —
 * the one terminal a single-pane workspace has. Context is read during render,
 * which is top-down, so it is always populated by the time a panel asks.
 *
 * Nothing here re-renders anything. The value is a stable object holding a
 * mutable assignment map; terminals read it once, when their shell is spawned.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { ShellLaunch } from "./terminal-instances"

export interface ShellLaunchSource {
  /** The launch settings for one terminal. Stable per `terminalId`. */
  claim: (terminalId: string) => ShellLaunch
}

/** No workspace above us: plain shells in the default folder, nothing typed. */
const NO_LAUNCH: ShellLaunchSource = { claim: () => ({}) }

const ShellLaunchContext = createContext<ShellLaunchSource>(NO_LAUNCH)

export function useShellLaunch(): ShellLaunchSource {
  return useContext(ShellLaunchContext)
}

export function ShellLaunchProvider({
  cwd,
  startupCommands,
  children,
}: {
  /** Absolute folder for every terminal in this workspace. */
  cwd?: string
  /** One command per agent that has a launcher, in catalogue order. */
  startupCommands?: readonly string[]
  children: ReactNode
}) {
  // The caller rebuilds `startupCommands` on every render, so depend on its
  // contents, not its identity: otherwise the assignment map below would be
  // thrown away and rebuilt each render, and a terminal that re-attached could
  // be handed a command a second time. Joined on newlines because the commands
  // themselves contain spaces.
  const key = (startupCommands ?? []).join("\n")

  const value = useMemo<ShellLaunchSource>(() => {
    const commands = key ? key.split("\n") : []
    /**
     * Which command each terminal was given.
     *
     * Terminals claim in mount order, which for a fresh workspace is the pane
     * tree read left to right — so with two agents and two panes, the left pane
     * runs the first agent. The result is remembered per `terminalId` so a
     * remount (React strict mode, a pane hidden and shown again) neither shifts
     * the assignment nor hands out the same command twice.
     *
     * Terminals past the number of agents get no command, and agents past the
     * number of terminals never start. Both are the honest outcome: there is
     * nowhere to put them.
     */
    const assigned = new Map<string, ShellLaunch>()

    return {
      claim(terminalId) {
        const seen = assigned.get(terminalId)
        if (seen) return seen
        // Derived from the map rather than kept in a counter: React Compiler
        // rejects reassigning a captured `let` after render, and counting is
        // over a handful of entries.
        let taken = 0
        for (const l of assigned.values()) if (l.startupCommand) taken += 1
        const launch: ShellLaunch = { cwd, startupCommand: commands[taken] ?? null }
        assigned.set(terminalId, launch)
        return launch
      },
    }
  }, [cwd, key])

  return (
    <ShellLaunchContext.Provider value={value}>{children}</ShellLaunchContext.Provider>
  )
}
