-- RUANG FAKTA initial database schema
-- Safe to run on the empty project. All public tables have RLS enabled.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  color text not null default '#64d6c4',
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'idea'
    check (status in ('idea','research','writing','editing','scheduled','published','archived')),
  target_duration_seconds integer check (target_duration_seconds is null or target_duration_seconds > 0),
  scheduled_at timestamptz,
  published_at timestamptz,
  youtube_url text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null unique references public.videos(id) on delete cascade,
  hook text,
  body text,
  outro text,
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists videos_owner_created_idx on public.videos(owner_id, created_at desc);
create index if not exists videos_status_idx on public.videos(status);
create index if not exists videos_scheduled_idx on public.videos(scheduled_at) where scheduled_at is not null;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.videos enable row level security;
alter table public.scripts enable row level security;

-- Categories are reference data; everyone may read them.
drop policy if exists "Categories readable by everyone" on public.categories;
create policy "Categories readable by everyone" on public.categories
  for select to anon, authenticated using (true);

-- Each creator can only access their own profile.
drop policy if exists "Profile owner can read" on public.profiles;
create policy "Profile owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Profile owner can insert" on public.profiles;
create policy "Profile owner can insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Profile owner can update" on public.profiles;
create policy "Profile owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Videos are private to their owner.
drop policy if exists "Owners can read their videos" on public.videos;
create policy "Owners can read their videos" on public.videos
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Owners can create videos" on public.videos;
create policy "Owners can create videos" on public.videos
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners can update their videos" on public.videos;
create policy "Owners can update their videos" on public.videos
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
drop policy if exists "Owners can delete their videos" on public.videos;
create policy "Owners can delete their videos" on public.videos
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Script access follows ownership of the parent video.
drop policy if exists "Owners can read their scripts" on public.scripts;
create policy "Owners can read their scripts" on public.scripts
  for select to authenticated using (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
  );
drop policy if exists "Owners can create scripts" on public.scripts;
create policy "Owners can create scripts" on public.scripts
  for insert to authenticated with check (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
  );
drop policy if exists "Owners can update their scripts" on public.scripts;
create policy "Owners can update their scripts" on public.scripts
  for update to authenticated using (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
  );
drop policy if exists "Owners can delete their scripts" on public.scripts;
create policy "Owners can delete their scripts" on public.scripts
  for delete to authenticated using (
    exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
  );

grant select on public.categories to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.videos, public.scripts to authenticated;

insert into public.categories (name, slug, color) values
  ('Sains & Alam', 'sains-alam', '#64d6c4'),
  ('Misteri Semesta', 'misteri-semesta', '#a78bfa'),
  ('Teknologi', 'teknologi', '#60a5fa'),
  ('Sejarah', 'sejarah', '#e8b66c'),
  ('Fakta Unik', 'fakta-unik', '#f28caa')
on conflict (slug) do nothing;