export interface FileNode {
  name: string
  type: "file" | "directory"
  children?: FileNode[]
  path: string
}

export type SplitDirection = "left" | "right" | "up" | "down"

export interface TerminalTab {
  id: string
  name: string
}

// A `Workspace` interface used to sit here describing githubRepo/githubBranch.
// Nothing imported it — the real shape is the database row
// (`WorkspaceRow` in src/features/workspace/workspace-api.ts), and keeping a
// second, drifting definition of the same thing only invited the two to
// disagree. Removed with the GitHub fields it described.

export interface GitHubRepo {
  id: number
  name: string
  fullName: string
  private: boolean
  description: string | null
  updatedAt: string
  language: string | null
  stargazersCount: number
}
