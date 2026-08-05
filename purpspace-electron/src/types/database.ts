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
      workspaces_purpspace: {
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
      panes_purpspace: {
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
            foreignKeyName: "panes_purpspace_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_purpspace"
            referencedColumns: ["id"]
          }
        ]
      }
      github_connections_purpspace: {
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
      env_vars_purpspace: {
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
            foreignKeyName: "env_vars_purpspace_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_purpspace"
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
