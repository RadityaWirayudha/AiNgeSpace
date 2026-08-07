"use client"

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
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
  /** Share of the parent each child takes, as fractions summing to 1. Parallel
   *  to `children`, so anything that edits one has to edit the other. */
  sizes: number[]
}

export type PaneTerminalNode = TerminalLeaf | TerminalSplit

interface PaneTreeState {
  trees: Record<string, PaneTerminalNode>
  /** Per pane: terminal temporarily filling the pane. Purely a view flag. */
  maximized: Record<string, string | null>
  /** Per pane: how many terminals have ever existed, for stable naming. */
  nameSeq: Record<string, number>
  activeTerminalId: string | null
  /** Which terminal's title is being edited. Lives here rather than in the leaf
   *  component because the rename shortcut fires from a global key listener,
   *  which has no way to reach one component's local state. */
  renamingTerminalId: string | null
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
  | { type: "SET_RENAMING"; payload: { terminalId: string | null } }
  | { type: "DUPLICATE"; payload: { paneId: string; terminalId: string } }
  | { type: "SET_ACTIVE"; payload: { terminalId: string } }
  | { type: "INIT_PANE"; payload: { paneId: string; terminalId: string; name: string } }
  | { type: "HYDRATE_PANES"; payload: { panes: HydratedPane[] } }
  | {
      type: "RESIZE_SPLIT"
      payload: { paneId: string; nodeId: string; sizes: number[] }
    }
  | { type: "DISPOSE_PANES"; payload: { paneIds: string[] } }

/** One pane restored from the database, ready to be dropped into `trees`. */
export interface HydratedPane {
  paneId: string
  tree: PaneTerminalNode
  /** `purpspace_panes.name_seq` — how far "Terminal A, B, C…" had got. */
  nameSeq?: number
}

let termCounter = 0
function nextTermId() {
  return `bm-term-${++termCounter}`
}

let nodeCounter = 0
function nextNodeId() {
  return `node-${++nodeCounter}`
}

const TERM_ID_RE = /^bm-term-(\d+)$/
const NODE_ID_RE = /^node-(\d+)$/

/**
 * Pushes both counters past every id in a restored tree.
 *
 * They are module state and start at zero on every page load, so a tree that
 * comes back from the database already holding `bm-term-5` would hand the next
 * split `bm-term-1` — an id that is already in the tree. Two leaves would then
 * share one PTY, and closing either would tear the shell out from under the
 * other. Called from the reducer rather than left to the caller, because a
 * caller that forgets produces a bug that only shows up after a reload.
 */
function reserveIds(node: PaneTerminalNode): void {
  const nodeMatch = NODE_ID_RE.exec(node.id)
  if (nodeMatch) nodeCounter = Math.max(nodeCounter, Number(nodeMatch[1]))

  if (node.type === "leaf") {
    const termMatch = TERM_ID_RE.exec(node.terminalId)
    if (termMatch) termCounter = Math.max(termCounter, Number(termMatch[1]))
    return
  }
  for (const child of node.children) reserveIds(child)
}

/**
 * The tree a brand new pane starts with.
 *
 * Exported so a pane can be written to the database at the moment it is
 * created: the row needs the tree, and the tree needs ids from the same
 * counters everything else draws from.
 */
export function makeInitialTree(name = "Terminal A"): TerminalLeaf {
  return { type: "leaf", id: nextNodeId(), terminalId: nextTermId(), name }
}

/** Matches the CHECK constraint's ceiling and the reducer's recursive walkers. */
const MAX_TREE_DEPTH = 8

/**
 * Shape check for a `purpspace_panes.tree` value.
 *
 * The API validates this with zod on the way in, but a row written by an older
 * build — or edited by hand in the Supabase dashboard — must not be able to
 * crash the recursive walkers here. Deliberately zod-free: this runs in the
 * browser on every load, and importing the schema module would pull zod into
 * the client bundle with it.
 */
export function parseTree(value: unknown, depth = 0): PaneTerminalNode | null {
  if (depth >= MAX_TREE_DEPTH) return null
  if (typeof value !== "object" || value === null) return null

  const node = value as Record<string, unknown>
  if (typeof node.id !== "string" || node.id.length === 0) return null

  if (node.type === "leaf") {
    if (typeof node.terminalId !== "string" || node.terminalId.length === 0) {
      return null
    }
    if (typeof node.name !== "string" || node.name.trim().length === 0) {
      return null
    }
    return {
      type: "leaf",
      id: node.id,
      terminalId: node.terminalId,
      name: node.name,
    }
  }

  if (node.type !== "split") return null
  if (node.direction !== "horizontal" && node.direction !== "vertical") {
    return null
  }
  if (!Array.isArray(node.children) || !Array.isArray(node.sizes)) return null
  // Parallel arrays: a length mismatch is the desync that makes every child
  // wear its neighbour's width.
  if (node.children.length < 2) return null
  if (node.children.length !== node.sizes.length) return null

  const children: PaneTerminalNode[] = []
  for (const child of node.children) {
    const parsed = parseTree(child, depth + 1)
    if (!parsed) return null
    children.push(parsed)
  }

  const sizes = node.sizes.map((size) =>
    typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 0
  )
  if (sizes.some((size) => size === 0)) return null

  return {
    type: "split",
    id: node.id,
    direction: node.direction,
    children,
    sizes: normalizeSizes(sizes),
  }
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

/** Fractions that always sum to 1, so `flexGrow` stays a true percentage no
 *  matter how many children were added or removed along the way. */
function normalizeSizes(sizes: number[]): number[] {
  if (sizes.length === 0) return sizes
  const safe = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0))
  const total = safe.reduce((sum, s) => sum + s, 0)
  if (total <= 0) return sizes.map(() => 1 / sizes.length)
  return safe.map((s) => s / total)
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
      sizes: [0.5, 0.5],
    }
  }
  return {
    ...node,
    children: node.children.map((child) =>
      splitLeaf(child, targetTerminalId, direction, newTerminalId, newName)
    ),
  }
}

/**
 * The previous implementation mapped then filtered, which silently desynced
 * `sizes` from `children`: dropping child 0 left every remaining pane wearing
 * its former neighbour's width. Indices are tracked explicitly instead, and the
 * survivors are renormalised so the split still adds up to a full pane.
 */
function removeTerminal(
  node: PaneTerminalNode,
  terminalId: string
): PaneTerminalNode | null {
  if (node.type === "leaf") {
    return node.terminalId === terminalId ? null : node
  }

  const children: PaneTerminalNode[] = []
  const sizes: number[] = []
  const even = 1 / node.children.length
  let changed = false

  node.children.forEach((child, i) => {
    const next = removeTerminal(child, terminalId)
    if (next !== child) changed = true
    if (next === null) return
    children.push(next)
    sizes.push(node.sizes[i] ?? even)
  })

  if (children.length === 0) return null
  // Collapse a split that has been reduced to a single child; that child brings
  // its own sizes with it, so nothing needs redistributing here.
  if (children.length === 1) return children[0]
  if (!changed) return node
  return { ...node, children, sizes: normalizeSizes(sizes) }
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

function resizeSplit(
  node: PaneTerminalNode,
  nodeId: string,
  sizes: number[]
): PaneTerminalNode {
  if (node.type === "leaf") return node
  if (node.id === nodeId) {
    // A stale drag that finished after the tree changed shape would otherwise
    // write an array of the wrong length and desync sizes from children.
    if (sizes.length !== node.children.length) return node
    return { ...node, sizes: normalizeSizes(sizes) }
  }
  let changed = false
  const children = node.children.map((child) => {
    const next = resizeSplit(child, nodeId, sizes)
    if (next !== child) changed = true
    return next
  })
  return changed ? { ...node, children } : node
}

function omitKeys<T>(
  source: Record<string, T>,
  keys: readonly string[]
): Record<string, T> {
  const next: Record<string, T> = {}
  const drop = new Set(keys)
  for (const [key, value] of Object.entries(source)) {
    if (!drop.has(key)) next[key] = value
  }
  return next
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

    case "HYDRATE_PANES": {
      const { panes } = action.payload
      if (panes.length === 0) return state

      // Every pane in a workspace lands in one dispatch on purpose. The
      // provider's GC runs on each change to `trees` and disposes any instance
      // that is not in one of them, so hydrating pane by pane would sweep away
      // the terminals of panes whose response had not arrived yet.
      const trees = { ...state.trees }
      const maximized = { ...state.maximized }
      const nameSeq = { ...state.nameSeq }

      for (const pane of panes) {
        reserveIds(pane.tree)
        trees[pane.paneId] = pane.tree
        // Maximize is a view flag, not layout — a restored pane opens whole.
        maximized[pane.paneId] = null
        nameSeq[pane.paneId] = Math.max(
          pane.nameSeq ?? 1,
          countLeaves(pane.tree)
        )
      }

      const firstTerminal = collectTerminals(panes[0].tree)[0]?.id ?? null

      return {
        ...state,
        trees,
        maximized,
        nameSeq,
        // Same rule as INIT_PANE: loading a workspace in the background must
        // not pull the caret out of the terminal being typed in.
        activeTerminalId: state.activeTerminalId ?? firstTerminal,
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
        renamingTerminalId:
          state.renamingTerminalId === terminalId
            ? null
            : state.renamingTerminalId,
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
      // The edit always ends, even when the name is rejected — otherwise
      // blurring an empty field left the input open with no way to close it.
      const renamingTerminalId =
        state.renamingTerminalId === terminalId ? null : state.renamingTerminalId

      if (!tree || !trimmed) {
        if (renamingTerminalId === state.renamingTerminalId) return state
        return { ...state, renamingTerminalId }
      }
      return {
        ...state,
        trees: { ...state.trees, [paneId]: renameLeaf(tree, terminalId, trimmed) },
        renamingTerminalId,
      }
    }

    case "SET_RENAMING": {
      const { terminalId } = action.payload
      if (state.renamingTerminalId === terminalId) return state
      return { ...state, renamingTerminalId: terminalId }
    }

    case "SET_ACTIVE": {
      if (state.activeTerminalId === action.payload.terminalId) return state
      return { ...state, activeTerminalId: action.payload.terminalId }
    }

    case "RESIZE_SPLIT": {
      const { paneId, nodeId, sizes } = action.payload
      const tree = state.trees[paneId]
      if (!tree) return state
      const newTree = resizeSplit(tree, nodeId, sizes)
      if (newTree === tree) return state
      return { ...state, trees: { ...state.trees, [paneId]: newTree } }
    }

    case "DISPOSE_PANES": {
      const { paneIds } = action.payload
      const doomed = paneIds.filter((id) => id in state.trees)
      if (doomed.length === 0) return state

      const gone = new Set<string>()
      for (const paneId of doomed) {
        for (const t of collectTerminals(state.trees[paneId])) gone.add(t.id)
      }

      return {
        trees: omitKeys(state.trees, doomed),
        maximized: omitKeys(state.maximized, doomed),
        nameSeq: omitKeys(state.nameSeq, doomed),
        activeTerminalId:
          state.activeTerminalId && gone.has(state.activeTerminalId)
            ? null
            : state.activeTerminalId,
        renamingTerminalId:
          state.renamingTerminalId && gone.has(state.renamingTerminalId)
            ? null
            : state.renamingTerminalId,
      }
    }

    default:
      return state
  }
}

export interface PaneTerminalActions {
  initPane: (paneId: string, terminalId: string, name: string) => void
  hydratePanes: (panes: HydratedPane[]) => void
  splitTerminal: (
    paneId: string,
    terminalId: string,
    direction: "horizontal" | "vertical"
  ) => void
  closeTerminal: (paneId: string, terminalId: string) => void
  duplicateTerminal: (paneId: string, terminalId: string) => void
  toggleMaximize: (paneId: string, terminalId: string) => void
  renameTerminal: (paneId: string, terminalId: string, name: string) => void
  setRenaming: (terminalId: string | null) => void
  setActive: (terminalId: string) => void
  resizeSplitNode: (paneId: string, nodeId: string, sizes: number[]) => void
  disposePanes: (paneIds: string[]) => void
}

interface PaneTerminalContextValue extends PaneTerminalActions {
  state: PaneTreeState
}

/**
 * State and actions are separate contexts because they change on wildly
 * different schedules: the action bag is created once, while `state` changes on
 * every keystroke that moves focus. Merged, a single `SET_ACTIVE` re-rendered
 * every leaf in every pane.
 */
const PaneTerminalStateContext = createContext<PaneTreeState | null>(null)
const PaneTerminalActionsContext = createContext<PaneTerminalActions | null>(null)

export function PaneTerminalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(paneReducer, {
    trees: {},
    maximized: {},
    nameSeq: {},
    activeTerminalId: null,
    renamingTerminalId: null,
  })

  const actions = useMemo<PaneTerminalActions>(
    () => ({
      initPane: (paneId, terminalId, name) =>
        dispatch({ type: "INIT_PANE", payload: { paneId, terminalId, name } }),
      hydratePanes: (panes) =>
        dispatch({ type: "HYDRATE_PANES", payload: { panes } }),
      splitTerminal: (paneId, terminalId, direction) =>
        dispatch({ type: "SPLIT", payload: { paneId, terminalId, direction } }),
      closeTerminal: (paneId, terminalId) =>
        dispatch({ type: "CLOSE", payload: { paneId, terminalId } }),
      duplicateTerminal: (paneId, terminalId) =>
        dispatch({ type: "DUPLICATE", payload: { paneId, terminalId } }),
      toggleMaximize: (paneId, terminalId) =>
        dispatch({ type: "TOGGLE_MAXIMIZE", payload: { paneId, terminalId } }),
      renameTerminal: (paneId, terminalId, name) =>
        dispatch({ type: "RENAME", payload: { paneId, terminalId, name } }),
      setRenaming: (terminalId) =>
        dispatch({ type: "SET_RENAMING", payload: { terminalId } }),
      setActive: (terminalId) =>
        dispatch({ type: "SET_ACTIVE", payload: { terminalId } }),
      resizeSplitNode: (paneId, nodeId, sizes) =>
        dispatch({ type: "RESIZE_SPLIT", payload: { paneId, nodeId, sizes } }),
      disposePanes: (paneIds) =>
        dispatch({ type: "DISPOSE_PANES", payload: { paneIds } }),
    }),
    []
  )

  // Read at GC time rather than closed over, so a terminal created between the
  // effect firing and the dynamic import resolving is not mistaken for garbage.
  const treesRef = useRef(state.trees)
  useEffect(() => {
    treesRef.current = state.trees
  })

  // Before the first pane initialises, `trees` is empty for reasons that have
  // nothing to do with terminals dying; arming on the first non-empty tree
  // keeps that render from wiping instances the slots are still creating.
  const gcArmed = useRef(false)

  useEffect(() => {
    if (Object.keys(state.trees).length > 0) gcArmed.current = true
    if (!gcArmed.current) return

    // Imported lazily to keep xterm out of the server bundle and out of the
    // initial chunk; the slots already load this module on mount.
    void import("./terminal-instances").then((registry) => {
      const alive = new Set<string>()
      for (const tree of Object.values(treesRef.current)) {
        for (const t of collectTerminals(tree)) alive.add(t.id)
      }
      registry.disposeInstancesExcept(alive)
    })
  }, [state.trees])

  return (
    <PaneTerminalActionsContext.Provider value={actions}>
      <PaneTerminalStateContext.Provider value={state}>
        {children}
      </PaneTerminalStateContext.Provider>
    </PaneTerminalActionsContext.Provider>
  )
}

export function usePaneTerminalState(): PaneTreeState {
  const state = useContext(PaneTerminalStateContext)
  if (!state) {
    throw new Error(
      "usePaneTerminalState must be used within PaneTerminalProvider"
    )
  }
  return state
}

export function usePaneTerminalActions(): PaneTerminalActions {
  const actions = useContext(PaneTerminalActionsContext)
  if (!actions) {
    throw new Error(
      "usePaneTerminalActions must be used within PaneTerminalProvider"
    )
  }
  return actions
}

/** Both halves at once. Convenient, but it re-renders on every state change —
 *  prefer the split hooks anywhere inside the terminal grid. */
export function usePaneTerminalStore(): PaneTerminalContextValue {
  const state = usePaneTerminalState()
  const actions = usePaneTerminalActions()
  return useMemo(() => ({ state, ...actions }), [state, actions])
}

export { collectTerminals, countLeaves, findLeaf, terminalName }
