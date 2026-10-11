-- Ism's database. Paste this whole file into Supabase → SQL Editor → New query, and press Run.
-- It is safe to run again: it only creates what doesn't exist yet and replaces the policies.

-- Loved ones -----------------------------------------------------------------

create table if not exists public.loved_ones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  relationship text not null default '',
  years text,
  about text,
  obituary text,
  -- Path inside the "photos" storage bucket, e.g. "<owner id>/<uuid>.jpg".
  photo_path text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

create index if not exists loved_ones_owner_idx on public.loved_ones (owner_id);
create index if not exists loved_ones_public_idx on public.loved_ones (visibility) where visibility = 'public';

-- Quotes and stories -----------------------------------------------------------

create table if not exists public.isms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loved_one_id uuid not null references public.loved_ones (id) on delete cascade,
  kind text not null default 'quote' check (kind in ('quote', 'story')),
  title text,
  text text not null check (length(trim(text)) > 0),
  context text,
  topics text[] not null default '{}',
  keep_private boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists isms_loved_one_idx on public.isms (loved_one_id);
create index if not exists isms_owner_idx on public.isms (owner_id);

-- Saved (♥) quotes and stories, per person -------------------------------------

create table if not exists public.saved_isms (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ism_id uuid not null references public.isms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, ism_id)
);

-- Who can see what ----------------------------------------------------------------
-- Same rule as canSee() in src/lib/advice.ts: you see everything of your own; other people's
-- loved ones only when their family shared them, and never a quote or story kept private.

alter table public.loved_ones enable row level security;
alter table public.isms enable row level security;
alter table public.saved_isms enable row level security;

drop policy if exists "read own or shared loved ones" on public.loved_ones;
create policy "read own or shared loved ones" on public.loved_ones
  for select to anon, authenticated
  using (visibility = 'public' or owner_id = auth.uid());

drop policy if exists "add own loved ones" on public.loved_ones;
create policy "add own loved ones" on public.loved_ones
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "change own loved ones" on public.loved_ones;
create policy "change own loved ones" on public.loved_ones
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "remove own loved ones" on public.loved_ones;
create policy "remove own loved ones" on public.loved_ones
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "read own or shared isms" on public.isms;
create policy "read own or shared isms" on public.isms
  for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or (
      not keep_private
      and exists (
        select 1 from public.loved_ones l
        where l.id = isms.loved_one_id and l.visibility = 'public'
      )
    )
  );

drop policy if exists "add isms to own loved ones" on public.isms;
create policy "add isms to own loved ones" on public.isms
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.loved_ones l where l.id = loved_one_id and l.owner_id = auth.uid())
  );

drop policy if exists "change own isms" on public.isms;
create policy "change own isms" on public.isms
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.loved_ones l where l.id = loved_one_id and l.owner_id = auth.uid())
  );

drop policy if exists "remove own isms" on public.isms;
create policy "remove own isms" on public.isms
  for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "manage own saved" on public.saved_isms;
create policy "manage own saved" on public.saved_isms
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Photos ------------------------------------------------------------------------------
-- A private bucket: the app asks for short-lived links, and only for photos the person may see.
-- Each person uploads into a folder named after their user id.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "read own or shared photos" on storage.objects;
create policy "read own or shared photos" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.loved_ones l
        where l.photo_path = storage.objects.name and l.visibility = 'public'
      )
    )
  );

drop policy if exists "upload own photos" on storage.objects;
create policy "upload own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "replace own photos" on storage.objects;
create policy "replace own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "remove own photos" on storage.objects;
create policy "remove own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deleting an account ----------------------------------------------------------------
-- Lets a signed-in person delete their own account. Their loved ones, quotes, stories and
-- hearts go with it (the tables cascade); the app removes their photos first.

create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
