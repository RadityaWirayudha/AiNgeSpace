/**
 * Path helpers for the working-folder field.
 *
 * These run in the browser, where `node:path` does not exist and the platform of
 * the machine that will actually run the shell is not knowable — the same
 * workspace can be created from the web build and opened from the desktop one.
 * So separators are read off the string instead of asked of the platform, and
 * nothing here touches the filesystem. Whether a folder exists is decided by the
 * Electron main process (`isDirectory()` in `electron/pty-manager.ts`), which is
 * the only side that can answer it.
 */

const SEPARATORS = /[\\/]+/

/** Backslashes only win when the path has no forward slash to contradict them. */
function separatorOf(path: string): string {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/"
}

export function isAbsolutePath(path: string): boolean {
  return /^(~|[\\/]|[A-Za-z]:[\\/]?)/.test(path)
}

/**
 * How many leading segments are the root and therefore immune to `..`.
 * `"/a"` and `"C:\a"` both split into two segments; only the second may be
 * popped, so `cd ..` at the root stays at the root instead of falling off it.
 */
function rootLength(path: string, segments: string[]): number {
  if (/^\\\\/.test(path)) return 3 // \\server\share
  if (/^[A-Za-z]:/.test(path)) return 1
  if (/^[\\/]/.test(path)) return 1 // the empty segment before the leading slash
  if (segments[0] === "~") return 1
  return 0
}

/** Collapses `.` and `..` without resolving symlinks — there is no disk here. */
export function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ""

  const sep = separatorOf(trimmed)
  const segments = trimmed.split(SEPARATORS)
  const root = rootLength(trimmed, segments)
  const out = segments.slice(0, root)

  for (const segment of segments.slice(root)) {
    if (!segment || segment === ".") continue
    if (segment === "..") {
      if (out.length > root) out.pop()
      continue
    }
    out.push(segment)
  }

  const joined = out.join(sep)
  if (/^\\\\/.test(trimmed)) return `\\${joined}`
  // "C:" alone is a drive-relative path in Windows, which is not what someone
  // typing `cd ..` from "C:\projects" means.
  if (out.length === 1 && /^[A-Za-z]:$/.test(out[0])) return `${out[0]}${sep}`
  return joined || sep
}

/**
 * Descends one named step from `base` — "C:\Users\user" + "Documents".
 *
 * `segment` comes from a directory listing the main process actually read, so
 * there is nothing to sanitise here; the normalisation is only there to keep the
 * separator consistent with whatever `base` already uses.
 */
export function joinPath(base: string, segment: string): string {
  const trimmed = base.trim()
  if (!trimmed) return normalizePath(segment)
  return normalizePath(`${trimmed}${separatorOf(trimmed)}${segment}`)
}

/**
 * Applies a line typed into the working-folder prompt.
 *
 * `current` is the folder shown in the box above the prompt; the box itself is
 * not typeable, so this is the only way to move it by keyboard. "cd
 * ../other-project" resolves against `current` exactly as a shell would, and a
 * line that is not a `cd` is taken as a path in its own right — someone pasting
 * "D:\work\api" into a prompt means to go there.
 *
 * Whether the result exists is not decided here. The Electron main process
 * answers that (`electron/fs-probe.ts`), because it is the only side that can
 * see the disk.
 */
export function applyWorkingDirInput(current: string, input: string): string {
  const typed = input.trim()
  const match = /^cd\b\s*(.*)$/i.exec(typed)
  if (!match) return normalizePath(typed)

  // `cd` with no argument means "go home" in a shell. There is no home to go to
  // from here, so it is treated as "leave it alone" rather than guessing.
  const argument = match[1].trim().replace(/^["']|["']$/g, "")
  if (!argument) return normalizePath(current)
  if (isAbsolutePath(argument)) return normalizePath(argument)

  return joinPath(current, argument)
}

/** The last segment, used for pane titles: "C:\work\api" → "api". */
export function folderName(path: string): string {
  const segments = normalizePath(path).split(SEPARATORS).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * Keeps the tail of a path, which is the part that identifies it. CSS
 * truncation would cut the other end and leave every row reading "C:\Users\…".
 */
export function compactPath(path: string, maxSegments = 3): string {
  const trimmed = path.trim()
  if (!trimmed) return ""

  const sep = separatorOf(trimmed)
  const segments = trimmed.split(SEPARATORS).filter(Boolean)
  if (segments.length <= maxSegments) return trimmed

  return `…${sep}${segments.slice(-maxSegments).join(sep)}`
}
