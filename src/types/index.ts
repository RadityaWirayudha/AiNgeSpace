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

export interface Workspace {
  id: string
  name: string
  githubRepo: string
  githubBranch: string
  createdAt: string
}

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
