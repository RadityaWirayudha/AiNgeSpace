"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import type { SplitDirection } from "@/types"

export interface TerminalTab {
  id: string
  name: string
}

interface TerminalState {
  terminals: TerminalTab[]
  activeTerminalId: string
  /** Monotonic name counter. Deriving names from terminals.length reused a
   *  letter every time a terminal was closed, producing two "Terminal B"s. */
  nameSeq: number
}

type TerminalAction =
  | { type: "ADD_TERMINAL"; payload: { afterId?: string; direction?: SplitDirection } }
  | { type: "CLOSE_TERMINAL"; payload: { id: string } }
  | { type: "SET_ACTIVE"; payload: { id: string } }
  | { type: "DUPLICATE_TERMINAL"; payload: { id: string } }

let counter = 0
function nextId() {
  return `term-${++counter}`
}

function generateName(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let n = index
  let out = ""
  do {
    out = letters[n % 26] + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Terminal ${out}`
}

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case "ADD_TERMINAL": {
      const { afterId, direction } = action.payload
      const id = nextId()
      const newTerminal: TerminalTab = { id, name: generateName(state.nameSeq) }
      const terminals = [...state.terminals]

      if (afterId && direction) {
        const idx = terminals.findIndex((t) => t.id === afterId)
        if (idx !== -1) {
          const insertIdx = direction === "right" || direction === "down" ? idx + 1 : idx
          terminals.splice(insertIdx, 0, newTerminal)
        } else {
          terminals.push(newTerminal)
        }
      } else {
        terminals.push(newTerminal)
      }

      return { terminals, activeTerminalId: id, nameSeq: state.nameSeq + 1 }
    }

    case "CLOSE_TERMINAL": {
      const { id } = action.payload
      const idx = state.terminals.findIndex((t) => t.id === id)
      if (idx === -1) return state
      const remaining = state.terminals.filter((t) => t.id !== id)

      // Never leave the workspace with zero terminals.
      if (remaining.length === 0) {
        const newId = nextId()
        return {
          terminals: [{ id: newId, name: generateName(state.nameSeq) }],
          activeTerminalId: newId,
          nameSeq: state.nameSeq + 1,
        }
      }

      let newActiveId = state.activeTerminalId
      if (state.activeTerminalId === id) {
        newActiveId = remaining[Math.min(idx, remaining.length - 1)].id
      }

      return { ...state, terminals: remaining, activeTerminalId: newActiveId }
    }

    case "SET_ACTIVE": {
      if (state.activeTerminalId === action.payload.id) return state
      return { ...state, activeTerminalId: action.payload.id }
    }

    case "DUPLICATE_TERMINAL": {
      const { id } = action.payload
      const idx = state.terminals.findIndex((t) => t.id === id)
      if (idx === -1) return state
      const source = state.terminals[idx]
      const newId = nextId()
      const terminals = [...state.terminals]
      terminals.splice(idx + 1, 0, { id: newId, name: `${source.name} (copy)` })
      return { ...state, terminals, activeTerminalId: newId }
    }

    default:
      return state
  }
}

function makeInitialState(count: number): TerminalState {
  const safe = Math.min(8, Math.max(1, Math.trunc(count) || 1))
  const terminals: TerminalTab[] = []
  for (let i = 0; i < safe; i++) {
    terminals.push({ id: nextId(), name: generateName(i) })
  }
  return {
    terminals,
    activeTerminalId: terminals[0].id,
    nameSeq: safe,
  }
}

interface TerminalContextValue {
  state: TerminalState
  addTerminal: (afterId?: string, direction?: SplitDirection) => void
  closeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void
  duplicateTerminal: (id: string) => void
  activeTerminalId: string
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({
  children,
  initialCount = 1,
}: {
  children: ReactNode
  initialCount?: number
}) {
  const [state, dispatch] = useReducer(
    terminalReducer,
    initialCount,
    makeInitialState
  )

  const addTerminal = useCallback(
    (afterId?: string, direction?: SplitDirection) =>
      dispatch({ type: "ADD_TERMINAL", payload: { afterId, direction } }),
    []
  )
  const closeTerminal = useCallback(
    (id: string) => dispatch({ type: "CLOSE_TERMINAL", payload: { id } }),
    []
  )
  const setActiveTerminal = useCallback(
    (id: string) => dispatch({ type: "SET_ACTIVE", payload: { id } }),
    []
  )
  const duplicateTerminal = useCallback(
    (id: string) => dispatch({ type: "DUPLICATE_TERMINAL", payload: { id } }),
    []
  )

  // A fresh object here re-rendered every terminal on each state change.
  const value = useMemo(
    () => ({
      state,
      addTerminal,
      closeTerminal,
      setActiveTerminal,
      duplicateTerminal,
      activeTerminalId: state.activeTerminalId,
    }),
    [state, addTerminal, closeTerminal, setActiveTerminal, duplicateTerminal]
  )

  return (
    <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
  )
}

export function useTerminalStore() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useTerminalStore must be used within TerminalProvider")
  return ctx
}
