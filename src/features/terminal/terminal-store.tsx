"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import type { SplitDirection } from "@/types"

export interface TerminalTab {
  id: string
  name: string
}

interface TerminalState {
  terminals: TerminalTab[]
  activeTerminalId: string
}

type TerminalAction =
  | { type: "ADD_TERMINAL"; payload: { id: string; name: string; afterId?: string; direction?: SplitDirection } }
  | { type: "CLOSE_TERMINAL"; payload: { id: string } }
  | { type: "SET_ACTIVE"; payload: { id: string } }
  | { type: "DUPLICATE_TERMINAL"; payload: { id: string } }

let counter = 0
function nextId() {
  return `term-${++counter}`
}

function generateName(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  return `Terminal ${letters[index % 26]}`
}

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case "ADD_TERMINAL": {
      const { id, name, afterId, direction } = action.payload
      const newTerminal: TerminalTab = { id, name }
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

      return { terminals, activeTerminalId: id }
    }

    case "CLOSE_TERMINAL": {
      const { id } = action.payload
      const idx = state.terminals.findIndex((t) => t.id === id)
      const remaining = state.terminals.filter((t) => t.id !== id)

      if (remaining.length === 0) {
        const newId = nextId()
        return {
          terminals: [{ id: newId, name: "Terminal A" }],
          activeTerminalId: newId,
        }
      }

      let newActiveId = state.activeTerminalId
      if (state.activeTerminalId === id) {
        const nextIdx = Math.min(idx, remaining.length - 1)
        newActiveId = remaining[nextIdx].id
      }

      return { terminals: remaining, activeTerminalId: newActiveId }
    }

    case "SET_ACTIVE": {
      return { ...state, activeTerminalId: action.payload.id }
    }

    case "DUPLICATE_TERMINAL": {
      const { id } = action.payload
      const source = state.terminals.find((t) => t.id === id)
      if (!source) return state
      const newId = nextId()
      const idx = state.terminals.findIndex((t) => t.id === id)
      const terminals = [...state.terminals]
      terminals.splice(idx + 1, 0, { id: newId, name: `${source.name} (copy)` })
      return { terminals, activeTerminalId: newId }
    }

    default:
      return state
  }
}

const initialId = nextId()
const initialState: TerminalState = {
  terminals: [{ id: initialId, name: "Terminal A" }],
  activeTerminalId: initialId,
}

interface TerminalContextValue {
  state: TerminalState
  addTerminal: (afterId?: string, direction?: SplitDirection) => string
  closeTerminal: (id: string) => void
  setActiveTerminal: (id: string) => void
  duplicateTerminal: (id: string) => void
  activeTerminalId: string
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialState)

  const addTerminal = (afterId?: string, direction?: SplitDirection) => {
    const id = nextId()
    const name = generateName(state.terminals.length)
    dispatch({ type: "ADD_TERMINAL", payload: { id, name, afterId, direction } })
    return id
  }

  const closeTerminal = (id: string) => dispatch({ type: "CLOSE_TERMINAL", payload: { id } })
  const setActiveTerminal = (id: string) => dispatch({ type: "SET_ACTIVE", payload: { id } })
  const duplicateTerminal = (id: string) =>
    dispatch({ type: "DUPLICATE_TERMINAL", payload: { id } })

  return (
    <TerminalContext.Provider
      value={{
        state,
        addTerminal,
        closeTerminal,
        setActiveTerminal,
        duplicateTerminal,
        activeTerminalId: state.activeTerminalId,
      }}
    >
      {children}
    </TerminalContext.Provider>
  )
}

export function useTerminalStore() {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error("useTerminalStore must be used within TerminalProvider")
  return ctx
}
