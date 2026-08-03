/**
 * IPC channel names shared by main and preload. Strings live in one place so a
 * typo cannot silently produce a listener that never fires.
 *
 * This is a `const enum` on purpose. The preload runs with `sandbox: true`,
 * where `require` is a polyfill that resolves `electron` plus a couple of Node
 * built-ins and nothing else — a relative `require("./channels")` throws
 * "module not found: ./channels" (verified against Electron 43), the
 * `contextBridge` call never runs, and `window.bridgemind` ends up silently
 * undefined. A const enum is inlined by tsc and its import erased, so the
 * emitted preload is self-contained while both sides still read one definition.
 *
 * Keep `isolatedModules` off in tsconfig.electron.json — it disables the
 * inlining this depends on.
 */
export const enum CH {
  terminalCreate = "bm:terminal:create",
  terminalWrite = "bm:terminal:write",
  terminalResize = "bm:terminal:resize",
  terminalKill = "bm:terminal:kill",
  terminalData = "bm:terminal:data",
  terminalExit = "bm:terminal:exit",
  openExternal = "bm:shell:open-external",
  chooseDirectory = "bm:dialog:choose-directory",
  probeDirectory = "bm:fs:probe-directory",
  deepLink = "bm:deep-link",
}
