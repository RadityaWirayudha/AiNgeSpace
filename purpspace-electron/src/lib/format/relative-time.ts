const MINUTE = 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const WEEK = DAY * 7
const MONTH = DAY * 30
const YEAR = DAY * 365

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", YEAR],
  ["month", MONTH],
  ["week", WEEK],
  ["day", DAY],
  ["hour", HOUR],
  ["minute", MINUTE],
]

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/**
 * "2 hours ago" from a Postgres `timestamptz`.
 *
 * Only safe to call once data has arrived on the client: it reads the clock, so
 * rendering it during SSR would produce a string the client immediately
 * disagrees with.
 */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return "unknown"

  const seconds = Math.round((then - now) / 1000)
  const magnitude = Math.abs(seconds)

  if (magnitude < MINUTE) return "just now"

  for (const [unit, size] of UNITS) {
    if (magnitude >= size) {
      return formatter.format(Math.round(seconds / size), unit)
    }
  }
  return "just now"
}
