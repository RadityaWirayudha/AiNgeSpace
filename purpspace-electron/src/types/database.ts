export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      purpspace_workspaces: {
        Row: {
          id: string
          clerk_user_id: string
          name: string
          working_dir: string
          layout_preset: string
          agent_ids: string[]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          name: string
          working_dir: string
          layout_preset?: string
          agent_ids?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          name?: string
          working_dir?: string
          layout_preset?: string
          agent_ids?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purpspace_panes: {
        Row: {
          id: string
          workspace_id: string
          title: string
          position: number
          pinned: boolean
          tree: Json
          name_seq: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          title: string
          position?: number
          pinned?: boolean
          tree: Json
          name_seq?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          position?: number
          pinned?: boolean
          tree?: Json
          name_seq?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purpspace_panes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "purpspace_workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      purpspace_github_connections: {
        Row: {
          id: string
          clerk_user_id: string
          github_user_id: string
          github_username: string
          access_token_encrypted: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          github_user_id: string
          github_username: string
          access_token_encrypted: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          github_user_id?: string
          github_username?: string
          access_token_encrypted?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purpspace_env_vars: {
        Row: {
          id: string
          workspace_id: string
          key: string
          value_encrypted: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          key: string
          value_encrypted: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          key?: string
          value_encrypted?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purpspace_env_vars_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "purpspace_workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
