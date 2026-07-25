"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
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
  activeTerminalId: string | null
}

type PaneTreeAction =
  | { type: "SPLIT"; payload: { paneId: string; terminalId: string; direction: "horizontal" | "vertical" } }
  | { type: "CLOSE"; payload: { paneId: string; terminalId: string } }
  | { type: "EXPAND"; payload: { paneId: string; terminalId: string } }
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

function findLeaf(node: PaneTerminalNode, terminalId: string): TerminalLeaf | null {
  if (node.type === "leaf" && node.terminalId === terminalId) return node
  if (node.type === "split") {
    for (const child of node.children) {
      const found = findLeaf(child, terminalId)
      if (found) return found
    }
  }
  return null
}

function findParent(
  node: PaneTerminalNode,
  terminalId: string
): TerminalSplit | null {
  if (node.type === "split") {
    for (const child of node.children) {
      if (child.type === "leaf" && child.terminalId === terminalId) return node
      const found = findParent(child, terminalId)
      if (found) return found
    }
  }
  return null
}

function countLeaves(node: PaneTerminalNode): number {
  if (node.type === "leaf") return 1
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

function collectTerminals(node: PaneTerminalNode): { id: string; name: string }[] {
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
  if (node.type === "leaf" && node.terminalId === targetTerminalId) {
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
  if (node.type === "split") {
    return {
      ...node,
      children: node.children.map((child) =>
        splitLeaf(child, targetTerminalId, direction, newTerminalId, newName)
      ),
    }
  }
  return node
}

function removeTerminal(
  node: PaneTerminalNode,
  terminalId: string
): PaneTerminalNode | null {
  if (node.type === "leaf" && node.terminalId === terminalId) return null
  if (node.type === "split") {
    const newChildren = node.children
      .map((child) => removeTerminal(child, terminalId))
      .filter((c): c is PaneTerminalNode => c !== null)

    if (newChildren.length === 0) return null
    if (newChildren.length === 1) return newChildren[0]
    return { ...node, children: newChildren }
  }
  return node
}

function removeExpanded(
  node: PaneTerminalNode,
  excludeTerminalId: string
): PaneTerminalNode | null {
  if (node.type === "leaf" && node.terminalId !== excludeTerminalId) return node
  if (node.type === "leaf") return node
  if (node.type === "split") {
    const newChildren = node.children
      .map((child) => removeExpanded(child, excludeTerminalId))
      .filter((c): c is PaneTerminalNode => c !== null)
    if (newChildren.length === 0) return null
    if (newChildren.length === 1) return newChildren[0]
    return { ...node, children: newChildren }
  }
  return node
}

function expandTerminal(
  node: PaneTerminalNode,
  targetTerminalId: string
): PaneTerminalNode {
  if (node.type === "leaf") return node
  if (node.type === "split") {
    const target = findLeaf(node, targetTerminalId)
    if (!target) return node
    return target
  }
  return node
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
        activeTerminalId: terminalId,
      }
    }

    case "SPLIT": {
      const { paneId, terminalId, direction } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state

      const newTermId = nextTermId()
      const allTerminals = collectTerminals(tree)
      const newName = `Terminal ${String.fromCharCode(65 + allTerminals.length)}`

      const newTree = splitLeaf(tree, terminalId, direction, newTermId, newName)
      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        activeTerminalId: newTermId,
      }
    }

    case "CLOSE": {
      const { paneId, terminalId } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state

      if (countLeaves(tree) <= 1) return state

      const newTree = removeTerminal(tree, terminalId)
      if (!newTree) return state

      const remaining = collectTerminals(newTree)
      const newActive =
        state.activeTerminalId === terminalId
          ? remaining[0]?.id ?? null
          : state.activeTerminalId

      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        activeTerminalId: newActive,
      }
    }

    case "EXPAND": {
      const { paneId, terminalId } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state

      if (tree.type === "leaf" && tree.terminalId === terminalId) return state

      const newTree = expandTerminal(tree, terminalId)
      return {
        ...state,
        trees: { ...state.trees, [paneId]: newTree },
        activeTerminalId: terminalId,
      }
    }

    case "SET_ACTIVE":
      return { ...state, activeTerminalId: action.payload.terminalId }

    default:
      return state
  }
}

interface PaneTerminalContextValue {
  state: PaneTreeState
  initPane: (paneId: string, terminalId: string, name: string) => void
  splitTerminal: (paneId: string, terminalId: string, direction: "horizontal" | "vertical") => void
  closeTerminal: (paneId: string, terminalId: string) => void
  expandTerminal: (paneId: string, terminalId: string) => void
  setActive: (terminalId: string) => void
}

const PaneTerminalContext = createContext<PaneTerminalContextValue | null>(null)

export function PaneTerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(paneReducer, {
    trees: {},
    activeTerminalId: null,
  })

  const initPane = useCallback(
    (paneId: string, terminalId: string, name: string) =>
      dispatch({ type: "INIT_PANE", payload: { paneId, terminalId, name } }),
    []
  )

  const splitTerminal = useCallback(
    (paneId: string, terminalId: string, direction: "horizontal" | "vertical") =>
      dispatch({ type: "SPLIT", payload: { paneId, terminalId, direction } }),
    []
  )

  const closeTerminal = useCallback(
    (paneId: string, terminalId: string) =>
      dispatch({ type: "CLOSE", payload: { paneId, terminalId } }),
    []
  )

  const expand = useCallback(
    (paneId: string, terminalId: string) =>
      dispatch({ type: "EXPAND", payload: { paneId, terminalId } }),
    []
  )

  const setActive = useCallback(
    (terminalId: string) =>
      dispatch({ type: "SET_ACTIVE", payload: { terminalId } }),
    []
  )

  return (
    <PaneTerminalContext.Provider
      value={{
        state,
        initPane,
        splitTerminal,
        closeTerminal,
        expandTerminal: expand,
        setActive,
      }}
    >
      {children}
    </PaneTerminalContext.Provider>
  )
}

export function usePaneTerminalStore() {
  const ctx = useContext(PaneTerminalContext)
  if (!ctx) throw new Error("usePaneTerminalStore must be used within PaneTerminalProvider")
  return ctx
}

export { collectTerminals, countLeaves }
