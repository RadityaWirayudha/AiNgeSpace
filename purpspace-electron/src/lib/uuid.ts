const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Route handlers use this before touching Supabase. Passing a malformed id
 * straight to `.eq("id", …)` makes PostgreSQL reject the comparison against a
 * uuid column, which surfaces as a 500 for what is really a 404.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/**
 * Ids for rows the client creates optimistically.
 *
 * The pane tree is keyed by pane id in the reducer, so waiting for the server
 * to mint one would mean rendering under a temporary key and re-keying on
 * response — which loses the terminal instances attached to it. Generating the
 * id here instead lets the row and the tree share an identity from the start.
 */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  // `randomUUID` is only exposed in secure contexts, and the desktop build can
  // be pointed at a plain-http address on a LAN. `getRandomValues` is not
  // restricted the same way.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")
}
