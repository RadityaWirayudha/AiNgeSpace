/**
 * The agent catalogue, kept out of the dialog for the same reason the layout
 * presets are: two unrelated places need it. `CreateWorkspaceDialog` renders the
 * list and writes the chosen ids to `purpspace_workspaces.agent_ids`, and
 * `PurpSpaceLayout` reads those ids back to decide what each terminal runs on
 * open. A copy in the dialog would mean the second half silently disagreed with
 * the first the moment either changed.
 *
 * `id` is written to the database, so renaming one orphans every workspace that
 * already chose it. Add new ids; do not repurpose old ones.
 */

import type { LucideIcon } from "lucide-react"
import { Terminal, Bot, Cpu, Sparkles, Zap } from "lucide-react"

export interface AgentOption {
  id: string
  name: string
  provider: string
  model: string
  icon: LucideIcon
  desc: string
  /** Rough cost per turn, shown in the picker. Free text — nothing parses it. */
  tokens: string
  /**
   * Typed into the terminal, followed by Enter, once the shell is up.
   *
   * `null` means this agent has no launcher yet: it is recorded on the workspace
   * and shown in the pane footer, but nothing starts. Only give an agent a
   * command when that command really exists on the machine — a wrong one leaves
   * the user staring at a shell that printed "not recognized" and then sat there.
   */
  command: string | null
}

export const AGENT_OPTIONS: readonly AgentOption[] = [
  {
    id: "opencode",
    name: "Opencode",
    provider: "opencode.ai",
    model: "CLI",
    icon: Terminal,
    desc: "Agen terminal opencode, izin di-auto-approve agar tidak menanyakan tiap langkah.",
    tokens: "sesuai model",
    /**
     * `--dangerously-skip-permissions` is real, despite being absent from
     * `opencode --help`. It is registered as a hidden alias — in the v1.18.11
     * binary on this machine:
     *
     *   .option("yolo",                         {type:"boolean", hidden:true, default:false})
     *   .option("dangerously-skip-permissions", {type:"boolean", hidden:true, default:false})
     *   … auto: args.auto || args.yolo || args["dangerously-skip-permissions"]
     *
     * So it resolves to the same `auto` as `--auto`. Kept in this spelling
     * because it is the one the user actually types, and it survives an
     * opencode upgrade no worse than `--auto` would.
     *
     * Note the hyphens: two ASCII `-`, not the en-dash `–` that a chat client
     * will silently substitute. opencode's parser ignores flags it does not
     * recognise rather than erroring, so an en-dash here would start opencode
     * with permissions still on and give no hint why.
     *
     * One thing it deliberately does not do: rules set to an explicit "deny" in
     * opencode.json stay denied.
     */
    command: "opencode --dangerously-skip-permissions",
  },
  {
    id: "a1",
    name: "Frontline",
    provider: "Anthropic",
    model: "Sonnet 5",
    icon: Bot,
    desc: "Membaca dan mengedit kode UI, menjaga komponen tetap sinkron.",
    tokens: "~4k / turn",
    command: null,
  },
  {
    id: "a2",
    name: "Backline",
    provider: "Anthropic",
    model: "Sonnet 5",
    icon: Cpu,
    desc: "Mengelola layanan, migrasi, dan kontrak API.",
    tokens: "~6k / turn",
    command: null,
  },
  {
    id: "a3",
    name: "Reviewer",
    provider: "Anthropic",
    model: "Haiku 4.5",
    icon: Sparkles,
    desc: "Tinjauan cepat pada diff sebelum masuk.",
    tokens: "~1.5k / turn",
    command: null,
  },
  {
    id: "a4",
    name: "Analyst",
    provider: "Anthropic",
    model: "Opus 4.8",
    icon: Zap,
    desc: "Penalaran mendalam untuk data dan tugas riset.",
    tokens: "~9k / turn",
    command: null,
  },
  {
    id: "a5",
    name: "Watcher",
    provider: "Anthropic",
    model: "Haiku 4.5",
    icon: Terminal,
    desc: "Memantau log dan pipeline, menandai kegagalan.",
    tokens: "~1k / turn",
    command: null,
  },
]

/**
 * The commands to run in a fresh terminal, in catalogue order.
 *
 * Ids that are not in the catalogue are dropped rather than guessed at: they can
 * only come from a workspace row written by an older build, and running an
 * unknown string in someone's shell is not a recoverable mistake.
 */
export function startupCommandsFor(agentIds: readonly string[]): string[] {
  const wanted = new Set(agentIds)
  return AGENT_OPTIONS.filter((a) => wanted.has(a.id) && a.command).map(
    (a) => a.command as string
  )
}
