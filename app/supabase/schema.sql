-- Ism's database. Paste this whole file into Supabase → SQL Editor → New query, and press Run.
-- It is safe to run again: it only creates what doesn't exist yet and replaces the rules and functions.

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
  -- private: only the owner. friends: the owner's friends too. public: everyone.
  visibility text not null default 'private',
  created_at timestamptz not null default now()
);

alter table public.loved_ones drop constraint if exists loved_ones_visibility_check;
alter table public.loved_ones add constraint loved_ones_visibility_check
  check (visibility in ('private', 'friends', 'public'));

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

-- Profiles: the name friends see, and a code to give people who want to add you --

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Google and other sign-ins provide a name. Email sign-ups start without one and choose it in the app,
  -- so nothing from an email address is ever shown to other people.
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), trim(new.raw_user_meta_data ->> 'name'), ''), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Profiles for everyone who signed up before profiles existed.
insert into public.profiles (id, display_name)
select id, left(coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), trim(raw_user_meta_data ->> 'name'), ''), 60)
from auth.users
on conflict (id) do nothing;

alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) <= 60);

-- Friends ----------------------------------------------------------------------------
-- A row is a request from requester to addressee; it becomes a friendship once accepted.
-- Rows are only written through the functions below.

create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

create index if not exists friendships_addressee_idx on public.friendships (addressee);

-- Whether someone is the signed-in person's friend. Only ever answers about yourself.
create or replace function public.is_my_friend(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other)
        or (f.requester = other and f.addressee = auth.uid()))
  );
$$;

-- Whether someone is your friend or has a request pending with you (so you can see their name).
create or replace function public.is_connected_to_me(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f
    where (f.requester = auth.uid() and f.addressee = other)
       or (f.requester = other and f.addressee = auth.uid())
  );
$$;

-- Ask whoever has this friend code to be friends. If they already asked you, you become friends.
create or replace function public.send_friend_request(code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other_id uuid;
  other_name text;
  existing public.friendships%rowtype;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  -- The other person needs to know who's asking.
  if coalesce((select trim(p.display_name) from public.profiles p where p.id = me), '') = '' then
    return jsonb_build_object('result', 'need_name');
  end if;

  select p.id, p.display_name into other_id, other_name
  from public.profiles p
  where p.friend_code = upper(regexp_replace(code, '[^a-zA-Z0-9]', '', 'g'));
  if other_id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if other_id = me then
    return jsonb_build_object('result', 'self');
  end if;

  select * into existing from public.friendships f
  where (f.requester = me and f.addressee = other_id) or (f.requester = other_id and f.addressee = me);
  if found then
    if existing.status = 'accepted' then
      return jsonb_build_object('result', 'already_friends', 'name', other_name);
    elsif existing.requester = other_id then
      update public.friendships set status = 'accepted' where requester = other_id and addressee = me;
      return jsonb_build_object('result', 'now_friends', 'name', other_name);
    else
      return jsonb_build_object('result', 'already_sent', 'name', other_name);
    end if;
  end if;

  insert into public.friendships (requester, addressee) values (me, other_id);
  return jsonb_build_object('result', 'sent', 'name', other_name);
end;
$$;

create or replace function public.respond_to_friend_request(requester_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if accept then
    update public.friendships set status = 'accepted'
    where requester = requester_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships
    where requester = requester_id and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- Unfriend someone, or take back a request you sent.
create or replace function public.remove_friend(other_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where (requester = auth.uid() and addressee = other_id)
     or (requester = other_id and addressee = auth.uid());
$$;

revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
-- is_my_friend and is_connected_to_me are used by the rules below for everyone, signed in or not;
-- they only ever answer about the person asking, so anyone may call them.
grant execute on function public.is_my_friend(uuid) to anon, authenticated;
grant execute on function public.is_connected_to_me(uuid) to anon, authenticated;

-- Who can see what ----------------------------------------------------------------
-- Same rule as canSee() in src/lib/advice.ts: you see everything of your own; other people's
-- loved ones when they're shared with everyone, or with friends and you're their friend; and
-- never a quote or story kept private.

alter table public.loved_ones enable row level security;
alter table public.isms enable row level security;
alter table public.saved_isms enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "read own or shared loved ones" on public.loved_ones;
create policy "read own or shared loved ones" on public.loved_ones
  for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'friends' and public.is_my_friend(owner_id))
  );

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
        where l.id = isms.loved_one_id
          and (l.visibility = 'public' or (l.visibility = 'friends' and public.is_my_friend(l.owner_id)))
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

-- You can see your own profile and the names of people you're friends with or have a request with.
drop policy if exists "read own and connected profiles" on public.profiles;
create policy "read own and connected profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_connected_to_me(id));

-- You can change your own name, and nothing else about your profile.
drop policy if exists "change own name" on public.profiles;
create policy "change own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated
  using (auth.uid() in (requester, addressee));

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
        where l.photo_path = storage.objects.name
          and (l.visibility = 'public' or (l.visibility = 'friends' and public.is_my_friend(l.owner_id)))
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
-- Lets a signed-in person delete their own account. Their loved ones, quotes, stories, hearts,
-- profile and friendships go with it (the tables cascade); the app removes their photos first.

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
