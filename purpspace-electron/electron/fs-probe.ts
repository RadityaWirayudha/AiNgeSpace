/**
 * Answers "does this folder actually exist?" for the working-folder prompt.
 *
 * The renderer cannot see the disk, so a path typed there is a guess until this
 * module checks it. Being told "no" is not enough to act on, though — someone
 * who typed `cd document` needs to see that the folder is called `Documents`.
 * So a failed probe also reports the deepest ancestor that *does* exist and
 * what is inside it, which is the same thing a file explorer would show.
 */

import { readdir, stat } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, normalize, resolve } from "node:path"
import type { DirectoryProbe, DirectoryProblem } from "../src/types/desktop"

/** Enough to recognise where you are without turning a hint into a file
 *  manager. `more` tells the UI it was cut short. */
const MAX_CHILDREN = 8

/** Guards against a pathological path — `dirname` reaching a fixed point is the
 *  real terminator, this only bounds the damage if it somehow does not. */
const MAX_WALK_UP = 64

/**
 * `~` is not a Windows convention, but the prompt accepts it: one workspace row
 * can be created on the web build and opened on either platform, so the path
 * that arrives here is not guaranteed to have been written by this OS.
 */
function expandHome(input: string): string {
  const trimmed = input.trim()
  if (trimmed === "~") return homedir()
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return join(homedir(), trimmed.slice(2))
  }
  return trimmed
}

/**
 * Sub-folders of `dir`, alphabetically, capped.
 *
 * Files are left out on purpose: this list exists to be `cd`-ed into. Dotfolders
 * go too — the user is being reminded what they have, not audited.
 */
async function childFolders(dir: string): Promise<{ names: string[]; more: boolean }> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const names = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
    return { names: names.slice(0, MAX_CHILDREN), more: names.length > MAX_CHILDREN }
  } catch {
    // Unreadable (permissions, or it vanished between the stat and here). An
    // empty list is honest; the caller still reports the folder it belongs to.
    return { names: [], more: false }
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

/** The deepest ancestor of `path` that exists — where the user really is. */
async function nearestExisting(path: string): Promise<string> {
  let current = path
  for (let depth = 0; depth < MAX_WALK_UP; depth += 1) {
    const parent = dirname(current)
    // `dirname("C:\\")` is `"C:\\"` and `dirname("/")` is `"/"`, so the fixed
    // point is how the walk ends on a path whose root does not exist either.
    if (parent === current) return ""
    if (await isDirectory(parent)) return parent
    current = parent
  }
  return ""
}

function problemFor(err: unknown): DirectoryProblem {
  const code = (err as NodeJS.ErrnoException | null)?.code
  return code === "EACCES" || code === "EPERM" ? "denied" : "missing"
}

export async function probeDirectory(input: unknown): Promise<DirectoryProbe> {
  const raw = typeof input === "string" ? input : ""
  const expanded = expandHome(raw)

  if (!expanded) {
    return { path: "", ok: false, reason: "missing", nearest: "", children: [], more: false }
  }

  // A relative path would be resolved against the main process's cwd, which is
  // wherever the app happened to be launched from and means nothing to the
  // user. Home is the one base they can reason about, and it is what the empty
  // field already shows.
  const path = normalize(isAbsolute(expanded) ? expanded : resolve(homedir(), expanded))

  try {
    const info = await stat(path)
    if (info.isDirectory()) {
      const { names, more } = await childFolders(path)
      return { path, ok: true, reason: null, nearest: path, children: names, more }
    }
    // A file, a socket, a device. Naming the parent still gives them somewhere
    // to go from here.
    const parent = dirname(path)
    const { names, more } = await childFolders(parent)
    return { path, ok: false, reason: "not-directory", nearest: parent, children: names, more }
  } catch (err) {
    const nearest = await nearestExisting(path)
    const { names, more } = nearest
      ? await childFolders(nearest)
      : { names: [], more: false }
    return { path, ok: false, reason: problemFor(err), nearest, children: names, more }
  }
}
