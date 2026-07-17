-- Draw app backend schema.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: uses "if not exists" / idempotent policy drops.

-- 1. Metadata table for saved drawings.
create table if not exists public.drawings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  mode         text not null check (mode in ('free-form', 'mandala', 'tiles', 'mirror', 'line-art')),
  title        text not null default 'Untitled',
  storage_path text not null,
  created_at   timestamptz not null default now()
);

create index if not exists drawings_user_id_created_at_idx
  on public.drawings (user_id, created_at desc);

-- Keep the mode check current when new modes are added (the "if not exists"
-- table create above won't alter an existing constraint, so re-apply it here).
alter table public.drawings drop constraint if exists drawings_mode_check;
alter table public.drawings add constraint drawings_mode_check
  check (mode in ('free-form', 'mandala', 'tiles', 'mirror', 'line-art'));

-- 2. Row Level Security: users only see and manage their own rows.
alter table public.drawings enable row level security;

-- Shared gallery: anyone (including anonymous guests) can read every drawing.
-- Insert/delete below stay owner-only, so users can only add or remove their own.
drop policy if exists "Users can read own drawings" on public.drawings;
drop policy if exists "Anyone can read drawings" on public.drawings;
create policy "Anyone can read drawings"
  on public.drawings for select
  using (true);

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

-- 4. Metadata table for the shared template library: line art drawn in the
-- template creator, which anyone can then colour in.
create table if not exists public.linearts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- The symmetry mode it was drawn in, and the settings to replicate strokes
  -- the same way while colouring (only mandala reads `sectors` today).
  mode         text not null check (mode in ('free-form', 'mandala', 'tiles', 'mirror')),
  sectors      int not null default 6,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- The library lists newest first, across every user.
create index if not exists linearts_created_at_idx
  on public.linearts (created_at desc);

-- 5. Row Level Security: the library is public to read, owner-only to change.
alter table public.linearts enable row level security;

-- Shared library: anyone (including anonymous guests) can read every template,
-- so line art drawn on one device is colourable by every visitor.
drop policy if exists "Anyone can read linearts" on public.linearts;
create policy "Anyone can read linearts"
  on public.linearts for select
  using (true);

-- Insert/delete stay owner-only, so a visitor can only add or remove their own
-- templates and cannot wipe the shared library.
drop policy if exists "Users can insert own linearts" on public.linearts;
create policy "Users can insert own linearts"
  on public.linearts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own linearts" on public.linearts;
create policy "Users can delete own linearts"
  on public.linearts for delete
  using (auth.uid() = user_id);

-- 6. Storage bucket for the template PNGs (public read, owner-only write).
insert into storage.buckets (id, name, public)
values ('linearts', 'linearts', true)
on conflict (id) do nothing;

-- Same "<user_id>/<uuid>.png" layout as drawings: the first path segment must
-- match the uploader.
drop policy if exists "Users can upload own linearts" on storage.objects;
create policy "Users can upload own linearts"
  on storage.objects for insert
  with check (
    bucket_id = 'linearts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own lineart files" on storage.objects;
create policy "Users can delete own lineart files"
  on storage.objects for delete
  using (
    bucket_id = 'linearts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can read lineart files" on storage.objects;
create policy "Anyone can read lineart files"
  on storage.objects for select
  using (bucket_id = 'linearts');
