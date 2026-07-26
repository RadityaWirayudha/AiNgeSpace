"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"

export interface TerminalLeaf {
  type: "leaf"
  id: string
  terminalId: string
  name: string
}

export interface TerminalSplit {
  type: "split"
  id: string
  direction: "horizontal" | "vertical"
  children: PaneTerminalNode[]
}

export type PaneTerminalNode = TerminalLeaf | TerminalSplit

interface PaneTreeState {
  trees: Record<string, PaneTerminalNode>
  /** Per pane: terminal temporarily filling the pane. Purely a view flag. */
  maximized: Record<string, string | null>
  /** Per pane: how many terminals have ever existed, for stable naming. */
  nameSeq: Record<string, number>
  activeTerminalId: string | null
}

type PaneTreeAction =
  | {
      type: "SPLIT"
      payload: {
        paneId: string
        terminalId: string
        direction: "horizontal" | "vertical"
      }
    }
  | { type: "CLOSE"; payload: { paneId: string; terminalId: string } }
  | { type: "TOGGLE_MAXIMIZE"; payload: { paneId: string; terminalId: string } }
  | { type: "RENAME"; payload: { paneId: string; terminalId: string; name: string } }
  | { type: "DUPLICATE"; payload: { paneId: string; terminalId: string } }
  | { type: "SET_ACTIVE"; payload: { terminalId: string } }
  | { type: "INIT_PANE"; payload: { paneId: string; terminalId: string; name: string } }

let termCounter = 0
function nextTermId() {
  return `bm-term-${++termCounter}`
}

let nodeCounter = 0
function nextNodeId() {
  return `node-${++nodeCounter}`
}

/** "Terminal A".."Terminal Z", then "Terminal AA" — never runs out. */
function terminalName(seq: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let n = seq
  let out = ""
  do {
    out = letters[n % 26] + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Terminal ${out}`
}

function findLeaf(
  node: PaneTerminalNode,
  terminalId: string
): TerminalLeaf | null {
  if (node.type === "leaf") {
    return node.terminalId === terminalId ? node : null
  }
  for (const child of node.children) {
    const found = findLeaf(child, terminalId)
    if (found) return found
  }
  return null
}

function countLeaves(node: PaneTerminalNode): number {
  if (node.type === "leaf") return 1
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

function collectTerminals(
  node: PaneTerminalNode
): { id: string; name: string }[] {
  if (node.type === "leaf") return [{ id: node.terminalId, name: node.name }]
  return node.children.flatMap(collectTerminals)
}

function splitLeaf(
  node: PaneTerminalNode,
  targetTerminalId: string,
  direction: "horizontal" | "vertical",
  newTerminalId: string,
  newName: string
): PaneTerminalNode {
  if (node.type === "leaf") {
    if (node.terminalId !== targetTerminalId) return node
    const newLeaf: TerminalLeaf = {
      type: "leaf",
      id: nextNodeId(),
      terminalId: newTerminalId,
      name: newName,
    }
    return {
      type: "split",
      id: nextNodeId(),
      direction,
      children: [node, newLeaf],
    }
  }
  return {
    ...node,
    children: node.children.map((child) =>
      splitLeaf(child, targetTerminalId, direction, newTerminalId, newName)
    ),
  }
}

function removeTerminal(
  node: PaneTerminalNode,
  terminalId: string
): PaneTerminalNode | null {
  if (node.type === "leaf") {
    return node.terminalId === terminalId ? null : node
  }
  const newChildren = node.children
    .map((child) => removeTerminal(child, terminalId))
    .filter((c): c is PaneTerminalNode => c !== null)

  if (newChildren.length === 0) return null
  // Collapse a split that has been reduced to a single child.
  if (newChildren.length === 1) return newChildren[0]
  return { ...node, children: newChildren }
}

function renameLeaf(
  node: PaneTerminalNode,
  terminalId: string,
  name: string
): PaneTerminalNode {
  if (node.type === "leaf") {
    return node.terminalId === terminalId ? { ...node, name } : node
  }
  return {
    ...node,
    children: node.children.map((child) => renameLeaf(child, terminalId, name)),
  }
}

function paneReducer(
  state: PaneTreeState,
  action: PaneTreeAction
): PaneTreeState {
  switch (action.type) {
    case "INIT_PANE": {
      const { paneId, terminalId, name } = action.payload
      if (state.trees[paneId]) return state
      const leaf: TerminalLeaf = {
        type: "leaf",
        id: nextNodeId(),
        terminalId,
        name,
      }
      return {
        ...state,
        trees: { ...state.trees, [paneId]: leaf },
        maximized: { ...state.maximized, [paneId]: null },
        nameSeq: { ...state.nameSeq, [paneId]: 1 },
        // Only claim focus if nothing else holds it, so mounting a second
        // pane cannot steal the caret out of the terminal being typed in.
        activeTerminalId: state.activeTerminalId ?? terminalId,
      }
    }

    case "SPLIT": {
      const { paneId, terminalId, direction } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state

      const newTermId = nextTermId()
      const seq = state.nameSeq[paneId] ?? countLeaves(tree)
      const newTree = splitLeaf(
        tree,
        terminalId,
        direction,
        newTermId,
        terminalName(seq)
      )

      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        // A split must reveal the new terminal, so drop any maximize.
        maximized: { ...state.maximized, [paneId]: null },
        nameSeq: { ...state.nameSeq, [paneId]: seq + 1 },
        activeTerminalId: newTermId,
      }
    }

    case "DUPLICATE": {
      const { paneId, terminalId } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state
      const source = findLeaf(tree, terminalId)
      if (!source) return state

      const newTermId = nextTermId()
      const seq = state.nameSeq[paneId] ?? countLeaves(tree)
      const newTree = splitLeaf(
        tree,
        terminalId,
        "horizontal",
        newTermId,
        terminalName(seq)
      )

      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        maximized: { ...state.maximized, [paneId]: null },
        nameSeq: { ...state.nameSeq, [paneId]: seq + 1 },
        activeTerminalId: newTermId,
      }
    }

    case "CLOSE": {
      const { paneId, terminalId } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state

      // A pane always keeps at least one terminal.
      if (countLeaves(tree) <= 1) return state

      const newTree = removeTerminal(tree, terminalId)
      if (!newTree) return state

      const remaining = collectTerminals(newTree)
      const stillExists = remaining.some((t) => t.id === state.activeTerminalId)

      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        maximized: {
          ...state.maximized,
          // Closing the maximized terminal must restore the pane.
          [paneId]:
            state.maximized[paneId] === terminalId
              ? null
              : state.maximized[paneId],
        },
        activeTerminalId: stillExists
          ? state.activeTerminalId
          : remaining[0]?.id ?? null,
      }
    }

    case "TOGGLE_MAXIMIZE": {
      const { paneId, terminalId } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state
      // Nothing to maximize against in a single-terminal pane.
      if (countLeaves(tree) <= 1) return state
      if (!findLeaf(tree, terminalId)) return state

      const isMaximized = state.maximized[paneId] === terminalId
      return {
        ...state,
        maximized: {
          ...state.maximized,
          [paneId]: isMaximized ? null : terminalId,
        },
        activeTerminalId: terminalId,
      }
    }

    case "RENAME": {
      const { paneId, terminalId, name } = action.payload
      const tree = state.trees[paneId]
      const trimmed = name.trim()
      if (!tree || !trimmed) return state
      return {
        ...state,
        trees: { ...state.trees, [paneId]: renameLeaf(tree, terminalId, trimmed) },
      }
    }

    case "SET_ACTIVE": {
      if (state.activeTerminalId === action.payload.terminalId) return state
      return { ...state, activeTerminalId: action.payload.terminalId }
    }

    default:
      return state
  }
}

interface PaneTerminalContextValue {
  state: PaneTreeState
  initPane: (paneId: string, terminalId: string, name: string) => void
  splitTerminal: (
    paneId: string,
    terminalId: string,
    direction: "horizontal" | "vertical"
  ) => void
  closeTerminal: (paneId: string, terminalId: string) => void
  duplicateTerminal: (paneId: string, terminalId: string) => void
  toggleMaximize: (paneId: string, terminalId: string) => void
  renameTerminal: (paneId: string, terminalId: string, name: string) => void
  setActive: (terminalId: string) => void
}

const PaneTerminalContext = createContext<PaneTerminalContextValue | null>(null)

export function PaneTerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(paneReducer, {
    trees: {},
    maximized: {},
    nameSeq: {},
    activeTerminalId: null,
  })

  const initPane = useCallback(
    (paneId: string, terminalId: string, name: string) =>
      dispatch({ type: "INIT_PANE", payload: { paneId, terminalId, name } }),
    []
  )

  const splitTerminal = useCallback(
    (
      paneId: string,
      terminalId: string,
      direction: "horizontal" | "vertical"
    ) => dispatch({ type: "SPLIT", payload: { paneId, terminalId, direction } }),
    []
  )

  const closeTerminal = useCallback(
    (paneId: string, terminalId: string) =>
      dispatch({ type: "CLOSE", payload: { paneId, terminalId } }),
    []
  )

  const duplicateTerminal = useCallback(
    (paneId: string, terminalId: string) =>
      dispatch({ type: "DUPLICATE", payload: { paneId, terminalId } }),
    []
  )

  const toggleMaximize = useCallback(
    (paneId: string, terminalId: string) =>
      dispatch({ type: "TOGGLE_MAXIMIZE", payload: { paneId, terminalId } }),
    []
  )

  const renameTerminal = useCallback(
    (paneId: string, terminalId: string, name: string) =>
      dispatch({ type: "RENAME", payload: { paneId, terminalId, name } }),
    []
  )

  const setActive = useCallback(
    (terminalId: string) =>
      dispatch({ type: "SET_ACTIVE", payload: { terminalId } }),
    []
  )

  // Without this the context value is a fresh object every render, so every
  // consumer — including each mounted terminal — re-renders on any keystroke.
  const value = useMemo(
    () => ({
      state,
      initPane,
      splitTerminal,
      closeTerminal,
      duplicateTerminal,
      toggleMaximize,
      renameTerminal,
      setActive,
    }),
    [
      state,
      initPane,
      splitTerminal,
      closeTerminal,
      duplicateTerminal,
      toggleMaximize,
      renameTerminal,
      setActive,
    ]
  )

  return (
    <PaneTerminalContext.Provider value={value}>
      {children}
    </PaneTerminalContext.Provider>
  )
}

export function usePaneTerminalStore() {
  const ctx = useContext(PaneTerminalContext)
  if (!ctx) {
    throw new Error(
      "usePaneTerminalStore must be used within PaneTerminalProvider"
    )
  }
  return ctx
}

export { collectTerminals, countLeaves, findLeaf, terminalName }
