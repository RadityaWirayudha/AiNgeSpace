"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Plus, LayoutGrid, AlertTriangle, X } from "lucide-react"
import { PurpSpaceSidebar } from "@/components/PurpSpaceSidebar"
import { Pane } from "@/components/Pane"
import {
  CreateWorkspaceDialog,
  type WorkspaceDraft,
} from "@/components/CreateWorkspaceDialog"
import { EnvVarsDialog } from "@/components/EnvVarsDialog"
import {
  PaneTerminalProvider,
  usePaneTerminalStore,
  countLeaves,
  makeInitialTree,
  parseTree,
  type HydratedPane,
  type PaneTerminalNode,
} from "@/features/terminal/pane-terminal-store"
import {
  PaneTerminalManager,
  TerminalHotkeys,
} from "@/features/terminal/PaneTerminalManager"
import { ShortcutsDialogProvider } from "@/components/KeyboardShortcutsDialog"
import { newUuid } from "@/lib/uuid"
import { folderName } from "@/lib/workspace/paths"
import { cn } from "@/lib/utils"
import { useTreeSync } from "./use-tree-sync"
import {
  ApiError,
  createPane,
  deletePane,
  deleteWorkspace as deleteWorkspaceRow,
  fetchPanes,
  fetchWorkspaces,
  renameWorkspace as renameWorkspaceRow,
  reorderWorkspaces as reorderWorkspaceRows,
  updatePane,
} from "./workspace-api"

interface PaneData {
  id: string
  title: string
  status: "running" | "idle" | "warning" | "error"
  pinned?: boolean
  agentCount?: number
  /** False when no row stands behind this pane — either its workspace is
   *  local-only, or the insert failed. Nothing is written back for it. */
  persisted: boolean
}

interface WorkspaceData {
  id: string
  name: string
  panes: PaneData[]
  agentIds: string[]
  /** Panes load on first activation, not with the workspace list. */
  panesLoaded: boolean
  /** False for a workspace created while the API was unreachable. It lives in
   *  this tab only and disappears on reload. */
  persisted: boolean
}

/** Keeps panes roughly square: the old layout was pinned to two columns, so a
 *  single pane rendered at half width with dead space beside it, and six panes
 *  produced three cramped rows. */
function gridFor(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1"
  if (count === 2) return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1"
  if (count <= 4) return "grid-cols-1 grid-rows-4 md:grid-cols-2 md:grid-rows-2"
  if (count <= 6) return "grid-cols-2 grid-rows-3 lg:grid-cols-3 lg:grid-rows-2"
  return "grid-cols-2 grid-rows-4 lg:grid-cols-4 lg:grid-rows-2"
}

function EmptyState({
  onCreate,
  /** With every workspace closed there is nothing to add a pane *to*, so the
   *  call to action has to change with it. */
  variant = "pane",
}: {
  onCreate: () => void
  variant?: "pane" | "workspace"
}) {
  const isPane = variant === "pane"
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="size-10 rounded-md border border-bm-border bg-bm-pane flex items-center justify-center">
        <LayoutGrid className="size-4 text-bm-text-dim" />
      </div>
      <div>
        <p className="text-[13px] text-bm-text font-medium">
          {isPane ? "No panes yet" : "No workspaces"}
        </p>
        <p className="text-[11px] text-bm-text-secondary mt-1 max-w-xs">
          {isPane
            ? "This workspace is empty. Add a pane to start a terminal and attach agents to it."
            : "Create a workspace to pick a repository, a pane layout, and the agents that run in it."}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 h-7 px-3 rounded-sm border border-bm-border bg-bm-pane-header text-[11px] text-bm-text hover:border-bm-live/40 hover:text-bm-text transition-colors"
      >
        <Plus className="size-3" />
        {isPane ? "Add pane" : "New workspace"}
      </button>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center gap-2">
      <span className="size-3.5 rounded-full border-2 border-bm-border border-t-bm-text-secondary animate-spin" />
      <span className="text-[11px] text-bm-text-dim">Memuat workspace…</span>
    </div>
  )
}

function PurpSpaceInner() {
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("")
  const [activePaneId, setActivePaneId] = useState<string | null>(null)
  const [expandedPaneId, setExpandedPaneId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [envWorkspaceId, setEnvWorkspaceId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Monotonic counter instead of Date.now(): two panes added in the same
  // millisecond used to collide on the same React key. Only local-only ids go
  // through it now — anything persisted gets a uuid the row will carry too.
  const localSeq = useRef(0)

  const {
    state: paneTermState,
    disposePanes,
    hydratePanes,
  } = usePaneTerminalStore()

  // Mirrors of state read from callbacks that must not be re-created on every
  // change. Declared above `useTreeSync` so its effects see the current values:
  // effects run in the order their hooks were called.
  const workspacesRef = useRef(workspaces)
  const activeWorkspaceIdRef = useRef(activeWorkspaceId)
  useEffect(() => {
    workspacesRef.current = workspaces
    activeWorkspaceIdRef.current = activeWorkspaceId
  })

  const reportError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setNotice("Sesi berakhir. Masuk lagi agar perubahan tersimpan.")
      return
    }
    setNotice("Perubahan terakhir belum tersimpan ke server.")
  }, [])

  const findPane = useCallback((paneId: string) => {
    for (const ws of workspacesRef.current) {
      const pane = ws.panes.find((p) => p.id === paneId)
      if (pane) return { workspace: ws, pane }
    }
    return null
  }, [])

  const isSavable = useCallback(
    (paneId: string) => {
      const found = findPane(paneId)
      return !!found && found.workspace.persisted && found.pane.persisted
    },
    [findPane]
  )

  const { markSaved } = useTreeSync({
    trees: paneTermState.trees,
    nameSeq: paneTermState.nameSeq,
    isSavable,
    onError: reportError,
  })

  /** Flags a pane as unbacked after its insert failed, so the tree sync stops
   *  aiming writes at a row that was never created. */
  const markPaneLocal = useCallback((paneId: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => ({
        ...ws,
        panes: ws.panes.map((p) =>
          p.id === paneId ? { ...p, persisted: false } : p
        ),
      }))
    )
  }, [])

  /* ----------------------------------------------------------------
     LOADING
  -----------------------------------------------------------------*/

  useEffect(() => {
    let cancelled = false

    fetchWorkspaces()
      .then((rows) => {
        if (cancelled) return
        setWorkspaces(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            panes: [],
            agentIds: row.agent_ids,
            panesLoaded: false,
            persisted: true,
          }))
        )
        setActiveWorkspaceId(rows[0]?.id ?? "")
      })
      .catch((error) => {
        if (cancelled) return
        // Signed out or offline. The sidebar still works; nothing persists.
        reportError(error)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reportError])

  const loadingPanes = useRef(new Set<string>())

  const loadPanes = useCallback(
    async (workspaceId: string) => {
      if (loadingPanes.current.has(workspaceId)) return
      loadingPanes.current.add(workspaceId)

      try {
        const rows = await fetchPanes(workspaceId)
        const hydrated: HydratedPane[] = []
        const panes: PaneData[] = []
        const agentIds =
          workspacesRef.current.find((ws) => ws.id === workspaceId)?.agentIds ??
          []

        for (const row of rows) {
          // A row whose tree cannot be read is skipped rather than allowed to
          // take the whole workspace down with it.
          const tree = parseTree(row.tree)
          if (!tree) continue
          hydrated.push({ paneId: row.id, tree, nameSeq: row.name_seq })
          panes.push({
            id: row.id,
            title: row.title,
            // Nothing in the schema tracks liveness — a restored pane is idle
            // until its shell says otherwise.
            status: "idle",
            pinned: row.pinned,
            agentCount: agentIds.length,
            persisted: true,
          })
        }

        // Every tree in one dispatch, before any of these panes render. The
        // provider disposes terminal instances that are missing from `trees` on
        // each change, so a staggered hydration would sweep away the panes
        // whose response had not arrived yet.
        hydratePanes(hydrated)
        // These trees came *from* the database; recording them stops the sync
        // effect writing back the rows it just read.
        for (const item of hydrated) markSaved(item.paneId, item.tree)

        setWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === workspaceId ? { ...ws, panes, panesLoaded: true } : ws
          )
        )
        if (activeWorkspaceIdRef.current === workspaceId) {
          setActivePaneId(panes[0]?.id ?? null)
        }
      } catch (error) {
        reportError(error)
      } finally {
        loadingPanes.current.delete(workspaceId)
      }
    },
    [hydratePanes, markSaved, reportError]
  )

  useEffect(() => {
    if (!activeWorkspaceId) return
    const ws = workspaces.find((w) => w.id === activeWorkspaceId)
    if (!ws || ws.panesLoaded || !ws.persisted) return
    void loadPanes(activeWorkspaceId)
  }, [activeWorkspaceId, workspaces, loadPanes])

  /* ----------------------------------------------------------------
     MUTATIONS
  -----------------------------------------------------------------*/

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId)
  const panes = activeWorkspace?.panes ?? []

  const buildPane = useCallback(
    (
      workspace: Pick<WorkspaceData, "id" | "persisted" | "agentIds">,
      title: string
    ): { pane: PaneData; tree: PaneTerminalNode } => {
      localSeq.current += 1
      return {
        pane: {
          // A local-only pane deliberately does not look like a uuid: it must
          // never be mistaken for a row id in a later request.
          id: workspace.persisted ? newUuid() : `local-${localSeq.current}`,
          title,
          status: "idle",
          agentCount: workspace.agentIds.length,
          persisted: workspace.persisted,
        },
        tree: makeInitialTree(),
      }
    },
    []
  )

  const handleWorkspaceCreated = useCallback(
    (draft: WorkspaceDraft) => {
      // The folder name, not the whole path: a pane title has a few dozen
      // pixels, and "C:\Users\me\projects\api · pane 1" would be all prefix.
      const folder = folderName(draft.workingDir)
      const created = Array.from({ length: draft.terminalCount }, (_, i) =>
        buildPane(
          { id: draft.id, persisted: draft.persisted, agentIds: draft.agentIds },
          folder ? `${folder} · pane ${i + 1}` : `Pane ${i + 1}`
        )
      )

      const newWs: WorkspaceData = {
        id: draft.id,
        name: draft.name,
        panes: created.map((c) => c.pane),
        agentIds: draft.agentIds,
        panesLoaded: true,
        persisted: draft.persisted,
      }

      hydratePanes(
        created.map((c) => ({ paneId: c.pane.id, tree: c.tree, nameSeq: 1 }))
      )
      for (const c of created) markSaved(c.pane.id, c.tree)

      setWorkspaces((prev) => [...prev, newWs])
      setActiveWorkspaceId(newWs.id)
      setActivePaneId(newWs.panes[0]?.id ?? null)
      setExpandedPaneId(null)

      if (!draft.persisted) return
      created.forEach((c, index) => {
        void createPane({
          id: c.pane.id,
          workspaceId: draft.id,
          title: c.pane.title,
          position: index,
          tree: c.tree,
          nameSeq: 1,
        }).catch((error) => {
          markPaneLocal(c.pane.id)
          reportError(error)
        })
      })
    },
    [buildPane, hydratePanes, markSaved, markPaneLocal, reportError]
  )

  /** Adding a pane works on any workspace, so the sidebar's per-row `+` can
   *  target a workspace without first making it active. */
  const addPaneTo = useCallback(
    (workspaceId: string) => {
      const ws = workspacesRef.current.find((w) => w.id === workspaceId)
      if (!ws) return

      const position = ws.panes.length
      const { pane, tree } = buildPane(ws, `Pane ${position + 1}`)

      hydratePanes([{ paneId: pane.id, tree, nameSeq: 1 }])
      markSaved(pane.id, tree)

      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId ? { ...w, panes: [...w.panes, pane] } : w
        )
      )
      // Selection is state, not a side effect of the updater — setting it
      // inside the map callback fired twice under StrictMode.
      setActiveWorkspaceId(workspaceId)
      setActivePaneId(pane.id)
      setExpandedPaneId(null)

      if (!ws.persisted) return
      void createPane({
        id: pane.id,
        workspaceId,
        title: pane.title,
        position,
        tree,
        nameSeq: 1,
      }).catch((error) => {
        markPaneLocal(pane.id)
        reportError(error)
      })
    },
    [buildPane, hydratePanes, markSaved, markPaneLocal, reportError]
  )

  const addPane = useCallback(
    () => addPaneTo(activeWorkspaceId),
    [addPaneTo, activeWorkspaceId]
  )

  const closePane = useCallback(
    (workspaceId: string, paneId: string) => {
      const found = findPane(paneId)

      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === workspaceId
            ? { ...ws, panes: ws.panes.filter((p) => p.id !== paneId) }
            : ws
        )
      )
      // Terminals deliberately outlive unmounting — that is what keeps a shell
      // running through a split or a workspace switch — so closing the pane is
      // the moment its trees have to be released, or the PTYs live forever.
      disposePanes([paneId])
      // A closed pane must not stay expanded or keep selection.
      setExpandedPaneId((cur) => (cur === paneId ? null : cur))
      setActivePaneId((cur) => (cur === paneId ? null : cur))

      if (found?.pane.persisted && found.workspace.persisted) {
        void deletePane(paneId).catch(reportError)
      }
    },
    [disposePanes, findPane, reportError]
  )

  const renameWorkspace = useCallback(
    (workspaceId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const ws = workspacesRef.current.find((w) => w.id === workspaceId)

      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, name: trimmed } : w))
      )

      if (ws?.persisted) {
        void renameWorkspaceRow(workspaceId, trimmed).catch(reportError)
      }
    },
    [reportError]
  )

  const deleteWorkspace = useCallback(
    (workspaceId: string) => {
      const index = workspaces.findIndex((ws) => ws.id === workspaceId)
      if (index < 0) return
      const doomed = workspaces[index]
      const next = workspaces.filter((ws) => ws.id !== workspaceId)
      setWorkspaces(next)
      // Every pane in the workspace goes with it, shells included.
      disposePanes(doomed.panes.map((p) => p.id))
      // Closing the active workspace has to hand focus to a survivor, or the
      // grid renders empty with no obvious way back.
      if (activeWorkspaceId === workspaceId) {
        const fallback = next[Math.min(index, next.length - 1)]
        setActiveWorkspaceId(fallback?.id ?? "")
        setActivePaneId(fallback?.panes[0]?.id ?? null)
        setExpandedPaneId(null)
      }

      if (doomed.persisted) {
        // Pane and env-var rows follow via ON DELETE CASCADE.
        void deleteWorkspaceRow(workspaceId).catch(reportError)
      }
    },
    [workspaces, activeWorkspaceId, disposePanes, reportError]
  )

  /** The sidebar hands back the full id list in its new order; ids it does not
   *  know about (a workspace created mid-drag) keep their relative position at
   *  the end rather than being dropped. */
  const reorderWorkspaces = useCallback(
    (orderedIds: string[]) => {
      const prev = workspacesRef.current
      const byId = new Map(prev.map((ws) => [ws.id, ws]))
      const next = orderedIds
        .map((id) => byId.get(id))
        .filter((ws): ws is WorkspaceData => ws !== undefined)
      const seen = new Set(next.map((ws) => ws.id))
      for (const ws of prev) if (!seen.has(ws.id)) next.push(ws)

      setWorkspaces(next)

      // Deliberately outside the state updater: React runs updaters twice under
      // StrictMode, and a request is not something to fire twice.
      //
      // Local-only workspaces have no sort_order to write. Leaving them out
      // keeps the remaining ids in the same relative order, which is all
      // sort_order encodes.
      const persistedIds = next.filter((ws) => ws.persisted).map((ws) => ws.id)
      if (persistedIds.length > 0) {
        void reorderWorkspaceRows(persistedIds).catch(reportError)
      }
    },
    [reportError]
  )

  const togglePin = useCallback(
    (paneId: string) => {
      const found = findPane(paneId)
      if (!found) return
      const pinned = !found.pane.pinned

      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === found.workspace.id
            ? {
                ...ws,
                panes: ws.panes.map((p) =>
                  p.id === paneId ? { ...p, pinned } : p
                ),
              }
            : ws
        )
      )

      if (found.workspace.persisted && found.pane.persisted) {
        void updatePane(paneId, { pinned }).catch(reportError)
      }
    },
    [findPane, reportError]
  )

  /** A local-only workspace has no row for env vars to hang off, so the dialog
   *  would open onto a 404. Saying so is more useful than showing it. */
  const openEnvVars = useCallback((workspaceId: string) => {
    const ws = workspacesRef.current.find((w) => w.id === workspaceId)
    if (!ws) return
    if (!ws.persisted) {
      setNotice(
        "Workspace ini belum tersimpan di server, jadi belum bisa punya environment variable."
      )
      return
    }
    setEnvWorkspaceId(workspaceId)
  }, [])

  const envWorkspaceName =
    workspaces.find((ws) => ws.id === envWorkspaceId)?.name ?? ""

  const sidebarWorkspaces = useMemo(
    () =>
      workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        // Count was a hand-maintained field that drifted from reality the
        // moment a pane was added or closed.
        count: ws.panes.length,
        panes: ws.panes.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
      })),
    [workspaces]
  )

  const visiblePanes = expandedPaneId
    ? panes.filter((p) => p.id === expandedPaneId)
    : panes

  return (
    <div className="flex h-screen bg-bm-bg overflow-hidden">
      <PurpSpaceSidebar
        workspaces={sidebarWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        activePaneId={activePaneId}
        onSelect={(id) => {
          setActiveWorkspaceId(id)
          const ws = workspaces.find((w) => w.id === id)
          setActivePaneId(ws?.panes[0]?.id ?? null)
          setExpandedPaneId(null)
        }}
        onSelectPane={(wsId, paneId) => {
          setActiveWorkspaceId(wsId)
          setActivePaneId(paneId)
          setExpandedPaneId(null)
        }}
        onCreateWorkspace={() => setDialogOpen(true)}
        onAddPane={addPaneTo}
        onClosePane={closePane}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        onOpenEnvVars={openEnvVars}
        onReorderWorkspaces={reorderWorkspaces}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Persistence failures are the one thing the grid cannot show on its
            own: the layout still works, it just is not being written down. */}
        {notice && (
          <div className="flex items-center gap-2 px-3 h-7 shrink-0 border-b border-bm-border bg-bm-pane-header">
            <AlertTriangle className="size-3 text-bm-warning shrink-0" />
            <span className="text-[11px] text-bm-text-secondary truncate">
              {notice}
            </span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Tutup pesan"
              className="ml-auto shrink-0 size-4 rounded-sm flex items-center justify-center text-bm-text-dim hover:text-bm-text transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : workspaces.length === 0 ? (
          <EmptyState variant="workspace" onCreate={() => setDialogOpen(true)} />
        ) : panes.length === 0 ? (
          <EmptyState onCreate={addPane} />
        ) : (
          <div
            className={cn(
              "grid gap-px flex-1 p-px min-h-0 min-w-0",
              gridFor(visiblePanes.length)
            )}
          >
            {visiblePanes.map((pane) => {
              const tree = paneTermState.trees[pane.id]
              const leafCount = tree ? countLeaves(tree) : 1
              return (
                <Pane
                  key={pane.id}
                  title={pane.title}
                  active={pane.id === activePaneId}
                  activeRing={leafCount <= 1}
                  status={pane.status}
                  pinned={pane.pinned}
                  flush
                  className="h-full min-h-0"
                  expanded={expandedPaneId === pane.id}
                  onToggleExpand={() =>
                    setExpandedPaneId((cur) =>
                      cur === pane.id ? null : pane.id
                    )
                  }
                  onPin={() => togglePin(pane.id)}
                  onClose={() => closePane(activeWorkspaceId, pane.id)}
                  footer={
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-bm-text-dim">»</span>
                        <span className="truncate">auto mode on</span>
                        {!!pane.agentCount && (
                          <span className="text-bm-text-dim shrink-0">
                            · {pane.agentCount} agent
                            {pane.agentCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                      {!pane.persisted && (
                        <span
                          title="Pane ini hanya ada di tab ini dan hilang saat reload."
                          className="shrink-0 text-bm-text-dim"
                        >
                          lokal
                        </span>
                      )}
                    </div>
                  }
                >
                  {/* Selecting a pane happens on mousedown of its body/header so
                      that clicking into a terminal also focuses the pane. */}
                  <div
                    className="w-full h-full"
                    onMouseDown={() => setActivePaneId(pane.id)}
                  >
                    <PaneTerminalManager paneId={pane.id} />
                  </div>
                </Pane>
              )
            })}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleWorkspaceCreated}
      />

      {/* Keyed so each opening starts from a clean slate — including dropping
          any decrypted values the previous one had on screen. */}
      <EnvVarsDialog
        key={envWorkspaceId ?? "closed"}
        open={envWorkspaceId !== null}
        workspaceId={envWorkspaceId}
        workspaceName={envWorkspaceName}
        onClose={() => setEnvWorkspaceId(null)}
      />
    </div>
  )
}

export function PurpSpaceLayout() {
  return (
    <PaneTerminalProvider>
      {/* Hotkeys sit inside both providers because they act on the terminal
          tree and also have to open the shortcuts dialog. */}
      <ShortcutsDialogProvider>
        <TerminalHotkeys />
        <PurpSpaceInner />
      </ShortcutsDialogProvider>
    </PaneTerminalProvider>
  )
}
