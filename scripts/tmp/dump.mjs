import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/purpspace_workspaces?select=*`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })
console.log(JSON.stringify(await res.json(), null, 2))
