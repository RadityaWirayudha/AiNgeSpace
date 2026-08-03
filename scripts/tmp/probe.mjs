import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY

const tables = [
  "purpspace_users", "purpspace_workspaces", "purpspace_terminals",
  "purpspace_ai_sessions", "purpspace_github_connections",
  "purpspace_environment_variables",
  "workspaces_purpspace", "panes_purpspace",
  "github_connections_purpspace", "env_vars_purpspace",
]

for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
  })
  const range = res.headers.get("content-range")
  console.log(`${t.padEnd(34)} status=${res.status} ${range ? "count=" + range.split("/")[1] : ""}`)
}
