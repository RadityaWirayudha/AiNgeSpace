/**
 * Menampilkan kolom nyata keempat tabel PurpSpace seperti yang dilihat
 * PostgREST — sumber kebenaran saat kode dan file migrasi tidak sepakat.
 *
 * Project Supabase ini dipakai bersama banyak aplikasi lain, jadi outputnya
 * disaring; tanpa filter, spec-nya memuat puluhan tabel yang tidak relevan.
 */
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
})
const spec = await res.json()

const ours = Object.entries(spec.definitions ?? {})
  .filter(([name]) => /purpspace|aingespace/.test(name))
  .sort(([a], [b]) => a.localeCompare(b))

if (ours.length === 0) console.log("tidak ada tabel purpspace/aingespace di spec")

for (const [name, def] of ours) {
  console.log(`\n${name}`)
  for (const [col, meta] of Object.entries(def.properties ?? {})) {
    const required = (def.required ?? []).includes(col) ? "not null" : ""
    console.log(`   ${col.padEnd(26)} ${(meta.format ?? meta.type).padEnd(28)} ${required}`)
  }
}
