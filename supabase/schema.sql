-- Draw app backend schema.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: uses "if not exists" / idempotent policy drops.

-- 1. Metadata table for saved drawings.
create table if not exists public.drawings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  mode         text not null check (mode in ('free-form', 'mandala', 'tiles', 'mirror')),
  title        text not null default 'Untitled',
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index if not exists drawings_user_id_created_at_idx
  on public.drawings (user_id, created_at desc);

-- 2. Row Level Security: users only see and manage their own rows.
alter table public.drawings enable row level security;

drop policy if exists "Users can read own drawings" on public.drawings;
create policy "Users can read own drawings"
  on public.drawings for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own drawings" on public.drawings;
create policy "Users can insert own drawings"
  on public.drawings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own drawings" on public.drawings;
create policy "Users can delete own drawings"
  on public.drawings for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket for the rendered PNGs (public read, owner-only write).
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', true)
on conflict (id) do nothing;

-- Files are stored under "<user_id>/<uuid>.png"; the first path segment must
-- match the uploader so users can only write/delete within their own folder.
drop policy if exists "Users can upload own files" on storage.objects;
create policy "Users can upload own files"
  on storage.objects for insert
  with check (
    bucket_id = 'drawings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own files" on storage.objects;
create policy "Users can delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'drawings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read for the bucket (bucket is public, but this makes the intent
-- explicit and covers signed clients too).
drop policy if exists "Anyone can read drawing files" on storage.objects;
create policy "Anyone can read drawing files"
  on storage.objects for select
  using (bucket_id = 'drawings');
