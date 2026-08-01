import type { Database } from "@/types/database"
import type { PaneTerminalNode } from "@/features/terminal/pane-terminal-store"

/**
 * Browser-side wrappers over the workspace and pane route handlers.
 *
 * There is no Supabase client here on purpose. RLS is enabled with no policies,
 * so the anon key returns empty arrays from the browser by design — every read
 * and write goes through a route handler that authorises the Clerk user first.
 */

export type WorkspaceRow =
  Database["public"]["Tables"]["workspaces_aingespace"]["Row"]
export type PaneRow = Database["public"]["Tables"]["panes_aingespace"]["Row"]

/** A route answered, but not with what was asked for. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init?.headers }
      : init?.headers,
  })

  if (!res.ok) {
    // The handlers answer with { error }, but a proxy or a crashed route can
    // return HTML — reading the body defensively keeps the thrown message
    // useful either way.
    let message = res.statusText
    try {
      const body = await res.json()
      if (typeof body?.error === "string") message = body.error
    } catch {
      // Non-JSON body; the status line is all there is.
    }
    throw new ApiError(res.status, message)
  }

  return (await res.json()) as T
}

/* ------------------------------------------------------------------
   WORKSPACES
-------------------------------------------------------------------*/

export function fetchWorkspaces(): Promise<WorkspaceRow[]> {
  return request<WorkspaceRow[]>("/api/workspaces")
}

export function fetchWorkspace(id: string): Promise<WorkspaceRow> {
  return request<WorkspaceRow>(`/api/workspaces/${id}`)
}

export function renameWorkspace(
  id: string,
  name: string
): Promise<WorkspaceRow> {
  return request<WorkspaceRow>(`/api/workspaces/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
}

export function deleteWorkspace(id: string): Promise<void> {
  return request<void>(`/api/workspaces/${id}`, { method: "DELETE" })
}

/** Writes the order the user dragged the sidebar into. */
export function reorderWorkspaces(orderedIds: string[]): Promise<void> {
  return request<void>("/api/workspaces", {
    method: "PATCH",
    body: JSON.stringify({ orderedIds }),
  })
}

/* ------------------------------------------------------------------
   PANES
-------------------------------------------------------------------*/

export function fetchPanes(workspaceId: string): Promise<PaneRow[]> {
  return request<PaneRow[]>(
    `/api/panes?workspaceId=${encodeURIComponent(workspaceId)}`
  )
}

export interface CreatePaneInput {
  /** Minted by the client so the row and its tree share one identity from the
   *  first render — see `newUuid` in `src/lib/uuid.ts`. */
  id: string
  workspaceId: string
  title: string
  position: number
  tree: PaneTerminalNode
  nameSeq: number
}

export function createPane(input: CreatePaneInput): Promise<PaneRow> {
  return request<PaneRow>("/api/panes", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export interface UpdatePaneInput {
  title?: string
  position?: number
  pinned?: boolean
  tree?: PaneTerminalNode
  nameSeq?: number
}

export function updatePane(
  id: string,
  patch: UpdatePaneInput,
  /** Set when the write has to survive the page going away. */
  keepalive = false
): Promise<PaneRow> {
  return request<PaneRow>(`/api/panes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    keepalive,
  })
}

export function deletePane(id: string): Promise<void> {
  return request<void>(`/api/panes/${id}`, { method: "DELETE" })
}

/* ------------------------------------------------------------------
   ENVIRONMENT VARIABLES
-------------------------------------------------------------------*/

/** What the listing returns: keys and timestamps, never ciphertext. */
export interface EnvVarRow {
  id: string
  key: string
  created_at: string
  updated_at: string
}

/** `/decrypt` adds the plaintext — or reports the one row it could not read,
 *  typically a value written under a previous ENCRYPTION_KEY. */
export interface EnvVarValue extends EnvVarRow {
  value: string | null
  error?: "decrypt_failed"
}

export function fetchEnvVars(workspaceId: string): Promise<EnvVarRow[]> {
  return request<EnvVarRow[]>(`/api/env/${encodeURIComponent(workspaceId)}`)
}

/** Kept separate from `fetchEnvVars` so plaintext only crosses the wire when
 *  the user explicitly asks to see it. */
export function fetchEnvValues(workspaceId: string): Promise<EnvVarValue[]> {
  return request<EnvVarValue[]>(
    `/api/env/${encodeURIComponent(workspaceId)}/decrypt`
  )
}

/** Creates or overwrites by key — the route upserts on (workspace_id, key). */
export function saveEnvVar(
  workspaceId: string,
  key: string,
  value: string
): Promise<EnvVarRow> {
  return request<EnvVarRow>(`/api/env/${encodeURIComponent(workspaceId)}`, {
    method: "POST",
    body: JSON.stringify({ key, value }),
  })
}

export function deleteEnvVar(
  workspaceId: string,
  envId: string
): Promise<void> {
  return request<void>(
    `/api/env/${encodeURIComponent(workspaceId)}?id=${encodeURIComponent(envId)}`,
    { method: "DELETE" }
  )
}
