-- RUANG FAKTA database additions for the connected Supabase project.
-- The project already contains public.profiles, public.categories and public.videos.
-- Existing videos use user_id (not owner_id), and categories use name/slug/description.
-- This migration adds script storage without replacing or deleting existing data.

create extension if not exists pgcrypto;

create table if not exists public.video_scripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null unique references public.videos(id) on delete cascade,
  opening_hook text,
  body text not null default '',
  closing text,
  research_sources text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.video_scripts enable row level security;

drop policy if exists "Owners can read scripts" on public.video_scripts;
create policy "Owners can read scripts" on public.video_scripts
for select to authenticated using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
);

drop policy if exists "Owners can create scripts" on public.video_scripts;
create policy "Owners can create scripts" on public.video_scripts
for insert to authenticated with check (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
);

drop policy if exists "Owners can update scripts" on public.video_scripts;
create policy "Owners can update scripts" on public.video_scripts
for update to authenticated using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
);

drop policy if exists "Owners can delete scripts" on public.video_scripts;
create policy "Owners can delete scripts" on public.video_scripts
for delete to authenticated using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = (select auth.uid()))
);

grant select, insert, update, delete on public.video_scripts to authenticated;

-- Existing categories and videos are intentionally preserved.
-- Categories are already readable by anon/authenticated.
-- Existing video policies enforce user_id ownership and public published-video reads.
