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
      aingespace_users: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      aingespace_workspaces: {
        Row: {
          id: string
          clerk_user_id: string
          name: string
          github_repo: string
          github_branch: string
          local_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          name: string
          github_repo: string
          github_branch?: string
          local_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          name?: string
          github_repo?: string
          github_branch?: string
          local_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      aingespace_terminals: {
        Row: {
          id: string
          workspace_id: string
          name: string
          layout: Json
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          layout?: Json
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          layout?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aingespace_terminals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "aingespace_workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      aingespace_github_connections: {
        Row: {
          id: string
          clerk_user_id: string
          github_user_id: string
          github_username: string
          access_token: string
          created_at: string
        }
        Insert: {
          id?: string
          clerk_user_id: string
          github_user_id: string
          github_username: string
          access_token: string
          created_at?: string
        }
        Update: {
          id?: string
          clerk_user_id?: string
          github_user_id?: string
          github_username?: string
          access_token?: string
          created_at?: string
        }
        Relationships: []
      }
      aingespace_ai_sessions: {
        Row: {
          id: string
          workspace_id: string
          provider: string
          model: string
          prompt: string
          response: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          provider: string
          model: string
          prompt: string
          response?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          provider?: string
          model?: string
          prompt?: string
          response?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aingespace_ai_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "aingespace_workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      aingespace_environment_variables: {
        Row: {
          id: string
          workspace_id: string
          key: string
          value: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          key: string
          value: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          key?: string
          value?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aingespace_environment_variables_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "aingespace_workspaces"
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
