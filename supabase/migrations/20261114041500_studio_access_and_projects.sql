-- Invite-only access: only e-mails on this list can use the studio's data.
create table public.allowed_emails (
  email text primary key check (email = lower(email)),
  is_admin boolean not null default false,
  invited_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- Helpers live outside the exposed API schema.
create schema if not exists private;

create function private.current_email() returns text
language sql stable
set search_path = ''
as $$ select lower(auth.jwt() ->> 'email') $$;

create function private.is_allowed() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.allowed_emails where email = private.current_email()) $$;

create function private.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.allowed_emails where email = private.current_email() and is_admin) $$;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

create policy "Members see their own entry, admins see all"
  on public.allowed_emails for select to authenticated
  using (email = (select private.current_email()) or (select private.is_admin()));

create policy "Admins invite"
  on public.allowed_emails for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins remove invitations"
  on public.allowed_emails for delete to authenticated
  using ((select private.is_admin()) and email <> (select private.current_email()));

-- Cloud projects: the timeline as JSON; media files live in storage.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_updated_idx on public.projects (owner, updated_at desc);
alter table public.projects enable row level security;

create policy "Invited users manage their own projects"
  on public.projects for all to authenticated
  using (owner = (select auth.uid()) and (select private.is_allowed()))
  with check (owner = (select auth.uid()) and (select private.is_allowed()));

-- Private media bucket; each user writes only under a folder named after their user id.
insert into storage.buckets (id, name, public) values ('editor-media', 'editor-media', false);

create policy "Invited users read their own media"
  on storage.objects for select to authenticated
  using (bucket_id = 'editor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_allowed()));

create policy "Invited users upload their own media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'editor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_allowed()));

create policy "Invited users replace their own media"
  on storage.objects for update to authenticated
  using (bucket_id = 'editor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_allowed()));

create policy "Invited users delete their own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'editor-media' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_allowed()));

-- First administrator (run once, with your own address):
-- insert into public.allowed_emails (email, is_admin) values ('you@example.com', true);
