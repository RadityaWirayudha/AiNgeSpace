import { z } from "zod"
import type { Json } from "@/types/database"

/**
 * The persisted shape of a pane's terminal tree.
 *
 * This mirrors `PaneTerminalNode` in `src/features/terminal/pane-terminal-store.tsx`
 * exactly, so a row from `panes_aingespace.tree` can be dropped straight into
 * `state.trees[paneId]` with no translation layer. The two definitions have to
 * move together — anything added to the reducer's node type belongs here too.
 *
 * Validated on the server rather than trusted because `tree` is the one column
 * the client writes wholesale. The database only checks that it is an object
 * carrying a "type" key; the recursive shape is checked here, where a rejection
 * can say which part of the tree was wrong.
 */

const leafSchema = z.object({
  type: z.literal("leaf"),
  id: z.string().min(1).max(64),
  terminalId: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(255),
})

export type PersistedLeaf = z.infer<typeof leafSchema>

export interface PersistedSplit {
  type: "split"
  id: string
  direction: "horizontal" | "vertical"
  children: PersistedNode[]
  sizes: number[]
}

export type PersistedNode = PersistedLeaf | PersistedSplit

/** Guards against a hand-crafted payload nesting deeply enough to blow the
 *  stack in the reducer's recursive walkers. Eight splits is already far past
 *  anything usable on screen. */
const MAX_DEPTH = 8

const splitSchema: z.ZodType<PersistedSplit> = z.lazy(() =>
  z
    .object({
      type: z.literal("split"),
      id: z.string().min(1).max(64),
      direction: z.enum(["horizontal", "vertical"]),
      children: z.array(nodeSchema).min(2).max(16),
      sizes: z.array(z.number().positive().finite()).min(2).max(16),
    })
    // `children` and `sizes` are parallel arrays in the reducer, and a length
    // mismatch is exactly the desync that RESIZE_SPLIT guards against at
    // runtime. Rejecting it at the boundary keeps it out of the database.
    .refine((node) => node.children.length === node.sizes.length, {
      message: "children dan sizes harus sama panjang",
    })
)

const nodeSchema: z.ZodType<PersistedNode> = z.lazy(() =>
  z.union([leafSchema, splitSchema])
)

function depthOf(node: PersistedNode): number {
  if (node.type === "leaf") return 1
  return 1 + Math.max(...node.children.map(depthOf))
}

function collectTerminalIds(node: PersistedNode, out: string[]): string[] {
  if (node.type === "leaf") out.push(node.terminalId)
  else for (const child of node.children) collectTerminalIds(child, out)
  return out
}

export const treeSchema = nodeSchema
  .refine((node) => depthOf(node) <= MAX_DEPTH, {
    message: `Pohon terminal terlalu dalam (maksimal ${MAX_DEPTH} tingkat)`,
  })
  // A duplicated terminalId would make two leaves share one PTY, and closing
  // either would tear the shell out from under the other.
  .refine(
    (node) => {
      const ids = collectTerminalIds(node, [])
      return new Set(ids).size === ids.length
    },
    { message: "terminalId dalam satu pane harus unik" }
  )

/**
 * A validated node is JSON by construction, but its interface has no index
 * signature, so TypeScript will not widen it to `Json` on its own. The cast is
 * confined here rather than repeated at every call site.
 */
export function treeToJson(node: PersistedNode): Json {
  return node as unknown as Json
}
