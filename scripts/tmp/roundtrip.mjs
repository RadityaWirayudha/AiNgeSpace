/**
 * Uji ujung-ke-ujung: database ini benar-benar bisa dipakai, bukan cuma ada.
 *
 * Menulis satu workspace + satu pane, membacanya kembali, memicu trigger
 * updated_at, lalu MENGHAPUS workspace-nya — yang sekaligus membuktikan
 * ON DELETE CASCADE ke panes berjalan. Baris uji dikenali dari clerk_user_id
 * di bawah dan selalu dibersihkan, termasuk saat langkah tengah gagal.
 */
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
const OWNER = "roundtrip-probe-hapus-aku"

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  })
  const text = await res.text()
  return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : null }
}

const step = (label, ok, extra = "") =>
  console.log(`${ok ? "OK  " : "GAGAL"} ${label.padEnd(46)} ${extra}`)

let failed = 0
let workspaceId = null

try {
  // 1. insert workspace
  const ws = await rest("workspaces_purpspace", {
    method: "POST",
    body: JSON.stringify({
      clerk_user_id: OWNER,
      name: "Roundtrip probe",
      working_dir: "C:\\Users\\user\\2026 3\\AiNgeSpace",
      layout_preset: "l2v",
      agent_ids: ["a1", "a3"],
    }),
  })
  workspaceId = ws.body?.[0]?.id ?? null
  step("insert workspace", ws.ok && !!workspaceId, ws.ok ? `id=${workspaceId}` : JSON.stringify(ws.body))
  if (!ws.ok) throw new Error("insert workspace gagal")

  // 2. kolom yang dipakai kode benar-benar tersimpan apa adanya
  const row = ws.body[0]
  const kept =
    row.working_dir === "C:\\Users\\user\\2026 3\\AiNgeSpace" &&
    row.layout_preset === "l2v" &&
    Array.isArray(row.agent_ids) &&
    row.agent_ids.join(",") === "a1,a3"
  step("working_dir/layout/agent_ids tersimpan utuh", kept, kept ? "" : JSON.stringify(row))
  if (!kept) failed++

  // 3. insert pane yang mereferensikan workspace itu
  const pane = await rest("panes_purpspace", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: workspaceId,
      title: "Pane 1",
      position: 0,
      tree: { type: "leaf", id: "n1", terminalId: "t1", name: "Terminal A" },
    }),
  })
  step("insert pane (FK ke workspace)", pane.ok, pane.ok ? "" : JSON.stringify(pane.body))
  if (!pane.ok) failed++

  // 4. pohon jsonb kembali sebagai objek, bukan string
  const tree = pane.body?.[0]?.tree
  const treeOk = tree && typeof tree === "object" && tree.type === "leaf"
  step("tree jsonb kembali sebagai objek", treeOk, treeOk ? "" : JSON.stringify(tree))
  if (!treeOk) failed++

  // 5. trigger updated_at
  const before = ws.body[0].updated_at
  const patched = await rest(`workspaces_purpspace?id=eq.${workspaceId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Roundtrip probe (diubah)" }),
  })
  const bumped = patched.ok && patched.body?.[0]?.updated_at !== before
  step("trigger set_updated_at jalan", bumped, bumped ? "" : `${before} -> ${patched.body?.[0]?.updated_at}`)
  if (!bumped) failed++

  // 6. index owner: query yang dipakai sidebar
  const list = await rest(
    `workspaces_purpspace?clerk_user_id=eq.${OWNER}&select=id,name,working_dir&order=sort_order.asc,created_at.asc`
  )
  const listed = list.ok && list.body.length === 1
  step("list per clerk_user_id (jalur sidebar)", listed, listed ? "" : JSON.stringify(list.body))
  if (!listed) failed++
} catch (err) {
  failed++
  console.log(`GAGAL ${String(err.message)}`)
} finally {
  // 7. cascade — hapus workspace, pane-nya harus ikut hilang
  if (workspaceId) {
    const del = await rest(`workspaces_purpspace?id=eq.${workspaceId}`, { method: "DELETE" })
    const left = await rest(`panes_purpspace?workspace_id=eq.${workspaceId}&select=id`)
    const cascaded = del.ok && left.ok && left.body.length === 0
    step("delete workspace → pane ikut terhapus (cascade)", cascaded,
      cascaded ? "" : `sisa pane=${JSON.stringify(left.body)}`)
    if (!cascaded) failed++
  }
  // Jaring pengaman kalau insert workspace sempat berhasil di percobaan lain.
  await rest(`workspaces_purpspace?clerk_user_id=eq.${OWNER}`, { method: "DELETE" })
  console.log(failed === 0 ? "\ndatabase terpakai penuh — semua jalur hidup" : `\n${failed} langkah gagal`)
}
