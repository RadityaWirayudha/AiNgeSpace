/**
 * Copies the repo `.env.local` into the packaged app's config directory.
 *
 * The installer intentionally ships no secrets, so a freshly installed
 * PurpSpace has no Supabase/Clerk credentials until this runs once.
 */
import { copyFile, mkdir, access } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { homedir } from "node:os"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = join(root, ".env.local")

function userDataDir() {
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "PurpSpace")
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "PurpSpace")
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "PurpSpace")
}

try {
  await access(source)
} catch {
  console.error(`[desktop:env] no .env.local at ${source}`)
  process.exit(1)
}

const target = join(userDataDir(), ".env.local")
await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
console.log(`[desktop:env] installed -> ${target}`)
console.warn(
  "[desktop:env] this file contains SUPABASE_SERVICE_ROLE_KEY and CLERK_SECRET_KEY — keep it on trusted machines only"
)
