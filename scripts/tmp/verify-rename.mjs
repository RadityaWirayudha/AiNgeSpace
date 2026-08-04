/**
 * Membuktikan migration 003 ikut me-rename constraint, bukan hanya tabel.
 * Caranya: sengaja melanggar tiap CHECK/UNIQUE dan membaca nama constraint di
 * pesan error PostgREST. Semua insert di bawah PASTI gagal, jadi tidak ada baris
 * yang tertulis ke database.
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

const probes = [
  { table: "workspaces_purpspace", expect: "workspaces_purpspace_name_not_blank",
    body: { clerk_user_id: "probe", name: "   ", working_dir: "C:\\tmp" } },
  { table: "workspaces_purpspace", expect: "workspaces_purpspace_working_dir_not_blank",
    body: { clerk_user_id: "probe", name: "probe", working_dir: "   " } },
  { table: "workspaces_purpspace", expect: "workspaces_purpspace_layout_known",
    body: { clerk_user_id: "probe", name: "probe", working_dir: "C:\\tmp", layout_preset: "tidak-ada" } },
  { table: "panes_purpspace", expect: "panes_purpspace_workspace_id_fkey",
    body: { workspace_id: "00000000-0000-0000-0000-000000000000", title: "probe", tree: { type: "leaf" } } },
  { table: "env_vars_purpspace", expect: "env_vars_purpspace_key_format",
    body: { workspace_id: "00000000-0000-0000-0000-000000000000", key: "huruf kecil!", value_encrypted: "ab:cd:ef" } },
  { table: "github_connections_purpspace", expect: "github_connections_purpspace_token_shape",
    body: { clerk_user_id: "probe", github_user_id: "1", github_username: "probe", access_token_encrypted: "bukan-hex" } },
]

let bad = 0
for (const p of probes) {
  const res = await fetch(`${url}/rest/v1/${p.table}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(p.body),
  })
  const text = await res.text()
  const hit = text.includes(p.expect)
  const stale = /aingespace/.test(text)
  if (!hit || stale) bad++
  console.log(
    `${hit ? "OK  " : "GAGAL"} ${p.expect.padEnd(48)} status=${res.status}` +
      (hit && !stale ? "" : `\n      -> ${text.slice(0, 300)}`)
  )
}
console.log(bad === 0 ? "\nsemua constraint sudah bernama _purpspace" : `\n${bad} probe tidak sesuai`)
