import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { app } from "electron"

/**
 * Minimal `.env` reader. A dependency on `dotenv` is not worth it here and the
 * Next server is spawned with an explicit env object anyway.
 */
function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip a single layer of matching quotes, keeping inner ones intact.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export interface ResolvedEnv {
  vars: Record<string, string>
  source: string | null
}

/**
 * Secrets are deliberately NOT bundled into the installer (see
 * DESKTOP_STATUS.md §Keamanan). Resolution order:
 *
 *   1. `%APPDATA%/BridgeMind/.env.local` — the supported production location.
 *   2. The repo `.env.local` — dev only, when running from source.
 *   3. `resources/.env.local` — only exists if someone opted into bundling.
 */
export function resolveRuntimeEnv(projectRoot: string): ResolvedEnv {
  const candidates = [
    join(app.getPath("userData"), ".env.local"),
    ...(app.isPackaged ? [] : [join(projectRoot, ".env.local")]),
    join(process.resourcesPath ?? "", ".env.local"),
  ]

  for (const file of candidates) {
    if (!file || !existsSync(file)) continue
    try {
      return { vars: parseEnvFile(readFileSync(file, "utf8")), source: file }
    } catch {
      // Unreadable file behaves like a missing one — the app still boots, the
      // Supabase/Clerk calls just fail loudly in the UI.
    }
  }

  return { vars: {}, source: null }
}
