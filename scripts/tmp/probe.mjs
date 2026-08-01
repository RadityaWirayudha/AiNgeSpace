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
  "aingespace_users", "aingespace_workspaces", "aingespace_terminals",
  "aingespace_ai_sessions", "aingespace_github_connections",
  "aingespace_environment_variables",
  "workspaces_aingespace", "panes_aingespace",
  "github_connections_aingespace", "env_vars_aingespace",
]

for (const t of tables) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" },
  })
  const range = res.headers.get("content-range")
  console.log(`${t.padEnd(34)} status=${res.status} ${range ? "count=" + range.split("/")[1] : ""}`)
}
