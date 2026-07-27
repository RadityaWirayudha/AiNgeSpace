/**
 * `output: "standalone"` deliberately leaves out `public/` and `.next/static`
 * because a normal deployment serves them from a CDN. The desktop app has no
 * CDN, so they are copied in here — skipping this step yields a window with the
 * HTML but no CSS, which looks like a broken app rather than a missing step.
 */
import { cp, access, mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const standalone = join(root, ".next", "standalone")

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

if (!(await exists(standalone))) {
  console.error(
    "[prepare-standalone] .next/standalone is missing — run `next build` with output:'standalone' first"
  )
  process.exit(1)
}

const jobs = [
  { from: join(root, ".next", "static"), to: join(standalone, ".next", "static") },
  { from: join(root, "public"), to: join(standalone, "public") },
]

for (const { from, to } of jobs) {
  if (!(await exists(from))) {
    console.warn(`[prepare-standalone] skipped missing ${from}`)
    continue
  }
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to, { recursive: true, force: true })
  console.log(`[prepare-standalone] copied ${from} -> ${to}`)
}

console.log("[prepare-standalone] done")
