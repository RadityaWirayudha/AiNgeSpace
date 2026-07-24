-- AiNgeSpace Database Schema
-- Supabase PostgreSQL

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS (contoh tabel user)
-- ============================================
create table public.aingespace_users (
  id text primary key,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aingespace_users enable row level security;

create policy "Users can view their own profile"
  on public.aingespace_users for select
  to authenticated
  using ((select auth.jwt()->>'sub') = id);

create policy "Users can update their own profile"
  on public.aingespace_users for update
  to authenticated
  using ((select auth.jwt()->>'sub') = id);

create policy "Users can insert their own profile"
  on public.aingespace_users for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = id);

-- ============================================
-- WORKSPACES
-- ============================================
create table public.aingespace_workspaces (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text not null,
  name text not null,
  github_repo text not null,
  github_branch text not null default 'main',
  local_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aingespace_workspaces enable row level security;

create policy "Users can view their own workspaces"
  on public.aingespace_workspaces for select
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can insert their own workspaces"
  on public.aingespace_workspaces for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can update their own workspaces"
  on public.aingespace_workspaces for update
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can delete their own workspaces"
  on public.aingespace_workspaces for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

-- ============================================
-- TERMINALS
-- ============================================
create table public.aingespace_terminals (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.aingespace_workspaces(id) on delete cascade,
  name text not null,
  layout jsonb default '{"direction": null, "splitFrom": null}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.aingespace_terminals enable row level security;

create policy "Users can view terminals in their workspaces"
  on public.aingespace_terminals for select
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_terminals.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can insert terminals in their workspaces"
  on public.aingespace_terminals for insert
  to authenticated
  with check (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_terminals.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can update terminals in their workspaces"
  on public.aingespace_terminals for update
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_terminals.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can delete terminals in their workspaces"
  on public.aingespace_terminals for delete
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_terminals.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- ============================================
-- GITHUB CONNECTIONS
-- ============================================
create table public.aingespace_github_connections (
  id uuid primary key default uuid_generate_v4(),
  clerk_user_id text not null,
  github_user_id text not null,
  github_username text not null,
  access_token text not null,
  created_at timestamptz not null default now()
);

alter table public.aingespace_github_connections enable row level security;

create policy "Users can view their own github connections"
  on public.aingespace_github_connections for select
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can insert their own github connections"
  on public.aingespace_github_connections for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can update their own github connections"
  on public.aingespace_github_connections for update
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

create policy "Users can delete their own github connections"
  on public.aingespace_github_connections for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = clerk_user_id);

-- ============================================
-- AI SESSIONS
-- ============================================
create table public.aingespace_ai_sessions (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.aingespace_workspaces(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt text not null,
  response text,
  created_at timestamptz not null default now()
);

alter table public.aingespace_ai_sessions enable row level security;

create policy "Users can view ai sessions in their workspaces"
  on public.aingespace_ai_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_ai_sessions.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can insert ai sessions in their workspaces"
  on public.aingespace_ai_sessions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_ai_sessions.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- ============================================
-- ENVIRONMENT VARIABLES
-- ============================================
create table public.aingespace_environment_variables (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.aingespace_workspaces(id) on delete cascade,
  key text not null,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, key)
);

alter table public.aingespace_environment_variables enable row level security;

create policy "Users can view env vars in their workspaces"
  on public.aingespace_environment_variables for select
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_environment_variables.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can insert env vars in their workspaces"
  on public.aingespace_environment_variables for insert
  to authenticated
  with check (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_environment_variables.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can update env vars in their workspaces"
  on public.aingespace_environment_variables for update
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_environment_variables.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

create policy "Users can delete env vars in their workspaces"
  on public.aingespace_environment_variables for delete
  to authenticated
  using (
    exists (
      select 1 from public.aingespace_workspaces
      where aingespace_workspaces.id = aingespace_environment_variables.workspace_id
      and aingespace_workspaces.clerk_user_id = (select auth.jwt()->>'sub')
    )
  );

-- ============================================
-- INDEXES
-- ============================================
create index idx_aingespace_workspaces_clerk_user_id on public.aingespace_workspaces(clerk_user_id);
create index idx_aingespace_terminals_workspace_id on public.aingespace_terminals(workspace_id);
create index idx_aingespace_github_connections_clerk_user_id on public.aingespace_github_connections(clerk_user_id);
create index idx_aingespace_ai_sessions_workspace_id on public.aingespace_ai_sessions(workspace_id);
create index idx_aingespace_environment_variables_workspace_id on public.aingespace_environment_variables(workspace_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_aingespace_workspaces_updated_at
  before update on public.aingespace_workspaces
  for each row execute function update_updated_at_column();

create trigger update_aingespace_environment_variables_updated_at
  before update on public.aingespace_environment_variables
  for each row execute function update_updated_at_column();

create trigger update_aingespace_users_updated_at
  before update on public.aingespace_users
  for each row execute function update_updated_at_column();
