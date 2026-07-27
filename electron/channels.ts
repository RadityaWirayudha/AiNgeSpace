/** IPC channel names shared by main and preload. Strings live in one place so a
 *  typo cannot silently produce a listener that never fires. */
export const CH = {
  terminalCreate: "bm:terminal:create",
  terminalWrite: "bm:terminal:write",
  terminalResize: "bm:terminal:resize",
  terminalKill: "bm:terminal:kill",
  terminalData: "bm:terminal:data",
  terminalExit: "bm:terminal:exit",
  openExternal: "bm:shell:open-external",
} as const
