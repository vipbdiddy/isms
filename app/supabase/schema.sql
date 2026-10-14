-- Isms database. Paste this whole file into Supabase → SQL Editor → New query, and press Run.
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
  -- private: only the owner. friends: the owner's friends too. group: the members of one group
  -- (group_id, added below). public: everyone.
  visibility text not null default 'private',
  created_at timestamptz not null default now()
);

alter table public.loved_ones drop constraint if exists loved_ones_visibility_check;
alter table public.loved_ones add constraint loved_ones_visibility_check
  check (visibility in ('private', 'friends', 'group', 'public'));

create index if not exists loved_ones_owner_idx on public.loved_ones (owner_id);
create index if not exists loved_ones_public_idx on public.loved_ones (visibility) where visibility = 'public';

-- Whether the people who can see a loved one may add their own quotes and stories to them. Whoever
-- added the loved one can turn this off, and can always remove what others added.
alter table public.loved_ones add column if not exists allow_contributions boolean not null default true;

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

-- Profiles: the name other people see ------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  -- From an earlier version that added friends by code; kept so older copies of the app still work.
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

-- Whether other people can find you by name, or in their contacts by your email address.
alter table public.profiles add column if not exists discoverable boolean not null default true;
-- Whether anyone signed in may see your name on what you share with everyone, and open your profile.
-- When it's off, only your friends and the people in your groups can.
alter table public.profiles add column if not exists public_profile boolean not null default false;

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

create index if not exists profiles_name_idx on public.profiles (lower(display_name));

-- Friends ----------------------------------------------------------------------------
-- A row is a request from requester to addressee. It becomes a friendship once accepted.
-- A declined request stays, hidden from both, so the same person can't keep asking: for 30 days
-- their requests quietly go nowhere, and they're never told they were declined.
-- Rows are only written through the functions below.

create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships add column if not exists responded_at timestamptz;
alter table public.friendships drop constraint if exists friendships_status_check;
alter table public.friendships add constraint friendships_status_check
  check (status in ('pending', 'accepted', 'declined'));

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

-- Whether someone is your friend or has a request open with you (so you can see their name).
create or replace function public.is_connected_to_me(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.friendships f
    where f.status <> 'declined'
      and ((f.requester = auth.uid() and f.addressee = other)
        or (f.requester = other and f.addressee = auth.uid()))
  );
$$;

-- How the signed-in person stands with someone: friends, sent (you asked), received (they asked) or none.
-- A request they declined still reads "sent" to you.
create or replace function public.relationship_with(other uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when f.status = 'accepted' then 'friends'
      when f.status = 'pending' and f.requester = auth.uid() then 'sent'
      when f.status = 'pending' then 'received'
      when f.requester = auth.uid() and f.responded_at > now() - interval '30 days' then 'sent'
      else 'none'
    end
    from public.friendships f
    where (f.requester = auth.uid() and f.addressee = other)
       or (f.requester = other and f.addressee = auth.uid())
    limit 1
  ), 'none');
$$;

-- How many friends the signed-in person and someone else have in common.
create or replace function public.mutual_friend_count(other uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from (
    select case when f.requester = auth.uid() then f.addressee else f.requester end as friend
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  ) mine
  join (
    select case when f.requester = other then f.addressee else f.requester end as friend
    from public.friendships f
    where f.status = 'accepted' and other in (f.requester, f.addressee)
  ) theirs using (friend);
$$;

-- The shared part of asking someone to be friends. Not callable from the app: it trusts its arguments.
create or replace function public.request_friendship(me uuid, other_id uuid, other_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.friendships%rowtype;
begin
  select * into existing from public.friendships f
  where (f.requester = me and f.addressee = other_id) or (f.requester = other_id and f.addressee = me)
  limit 1;

  if found then
    if existing.status = 'accepted' then
      return jsonb_build_object('result', 'already_friends', 'name', other_name);
    elsif existing.status = 'pending' and existing.requester = other_id then
      -- They already asked you, so asking them back makes you friends.
      update public.friendships set status = 'accepted', responded_at = now()
      where requester = other_id and addressee = me;
      return jsonb_build_object('result', 'now_friends', 'name', other_name);
    elsif existing.status = 'pending' then
      return jsonb_build_object('result', 'already_sent', 'name', other_name);
    elsif existing.requester = me then
      -- They said no. Don't tell, and don't ask them again until 30 days have passed.
      if existing.responded_at > now() - interval '30 days' then
        return jsonb_build_object('result', 'sent', 'name', other_name);
      end if;
      update public.friendships set status = 'pending', created_at = now(), responded_at = null
      where requester = me and addressee = other_id;
      return jsonb_build_object('result', 'sent', 'name', other_name);
    else
      -- You said no to them before, and now you're the one asking.
      delete from public.friendships where requester = other_id and addressee = me;
    end if;
  end if;

  if (select count(*) from public.friendships f where f.requester = me and f.status = 'pending') >= 100 then
    return jsonb_build_object('result', 'too_many');
  end if;

  insert into public.friendships (requester, addressee) values (me, other_id);
  return jsonb_build_object('result', 'sent', 'name', other_name);
end;
$$;

-- Ask someone to be friends: someone you found by name or in your contacts.
create or replace function public.send_friend_request_to(other_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other_name text;
  other_discoverable boolean;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  -- The other person needs to know who's asking.
  if coalesce((select trim(p.display_name) from public.profiles p where p.id = me), '') = '' then
    return jsonb_build_object('result', 'need_name');
  end if;
  if other_id = me then
    return jsonb_build_object('result', 'self');
  end if;

  select p.display_name, p.discoverable into other_name, other_discoverable
  from public.profiles p where p.id = other_id;
  -- People who'd rather not be found can only be asked back by someone they asked.
  if other_name is null or (not other_discoverable and not exists (
    select 1 from public.friendships f where f.requester = other_id and f.addressee = me and f.status = 'pending'
  )) then
    return jsonb_build_object('result', 'not_found');
  end if;

  return public.request_friendship(me, other_id, other_name);
end;
$$;

-- Ask whoever has this friend code to be friends. Used by an earlier version of the app.
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
  other_discoverable boolean;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if coalesce((select trim(p.display_name) from public.profiles p where p.id = me), '') = '' then
    return jsonb_build_object('result', 'need_name');
  end if;

  select p.id, p.display_name, p.discoverable into other_id, other_name, other_discoverable
  from public.profiles p
  where p.friend_code = upper(regexp_replace(code, '[^a-zA-Z0-9]', '', 'g'));
  if other_id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if other_id = me then
    return jsonb_build_object('result', 'self');
  end if;
  -- Same as send_friend_request_to: people who'd rather not be found can only be asked back by someone they asked.
  if not other_discoverable and not exists (
    select 1 from public.friendships f where f.requester = other_id and f.addressee = me and f.status = 'pending'
  ) then
    return jsonb_build_object('result', 'not_found');
  end if;

  return public.request_friendship(me, other_id, other_name);
end;
$$;

create or replace function public.respond_to_friend_request(requester_id uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendships
  set status = case when accept then 'accepted' else 'declined' end, responded_at = now()
  where requester = requester_id and addressee = auth.uid() and status = 'pending';
end;
$$;

-- Unfriend someone, or take back a request you sent. A request they declined stays declined.
create or replace function public.remove_friend(other_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships
  where status <> 'declined'
    and ((requester = auth.uid() and addressee = other_id)
      or (requester = other_id and addressee = auth.uid()));
$$;

-- Find people by name. Only people who allow it, and only their name and how you're connected.
create or replace function public.search_people(query text)
returns table (id uuid, display_name text, mutual_friends int, relationship text)
language sql
stable
security definer
set search_path = ''
as $$
  with term as (
    select lower(trim(query)) as t
  )
  select p.id, p.display_name, public.mutual_friend_count(p.id), public.relationship_with(p.id)
  from public.profiles p, term
  where auth.uid() is not null
    and char_length(term.t) >= 2
    and p.id <> auth.uid()
    and p.discoverable
    and trim(p.display_name) <> ''
    and strpos(lower(p.display_name), term.t) > 0
  order by starts_with(lower(p.display_name), term.t) desc, p.display_name
  limit 20;
$$;

-- How many times a day each person has checked their contacts, to stop anyone trawling for accounts.
create table if not exists public.contact_lookups (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  lookups int not null default 0,
  primary key (user_id, day)
);

-- Which of your contacts use Isms. The app sends the SHA-256 of each contact's lower-case email
-- address, never the addresses themselves, and nothing sent is kept.
create or replace function public.find_people_from_contacts(email_hashes text[])
returns table (id uuid, display_name text, mutual_friends int, relationship text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  used int;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if cardinality(email_hashes) > 5000 then
    raise exception 'Too many contacts at once';
  end if;

  insert into public.contact_lookups as c (user_id, day, lookups)
  values (me, current_date, 1)
  on conflict (user_id, day) do update set lookups = c.lookups + 1
  returning c.lookups into used;
  if used > 10 then
    raise exception 'Too many contact checks today. Try again tomorrow.';
  end if;

  return query
  select p.id, p.display_name, public.mutual_friend_count(p.id), public.relationship_with(p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id <> me
    and p.discoverable
    and trim(p.display_name) <> ''
    and encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') = any(email_hashes)
  order by p.display_name
  limit 200;
end;
$$;

revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.send_friend_request_to(uuid) from public, anon;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.search_people(text) from public, anon;
revoke all on function public.find_people_from_contacts(text[]) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.send_friend_request_to(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.search_people(text) to authenticated;
grant execute on function public.find_people_from_contacts(text[]) to authenticated;
-- Helpers the functions above use; the app can't call them.
revoke all on function public.request_friendship(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.relationship_with(uuid) from public, anon, authenticated;
revoke all on function public.mutual_friend_count(uuid) from public, anon, authenticated;
-- is_my_friend and is_connected_to_me are used by the rules below for everyone, signed in or not;
-- they only ever answer about the person asking, so anyone may call them.
grant execute on function public.is_my_friend(uuid) to anon, authenticated;
grant execute on function public.is_connected_to_me(uuid) to anon, authenticated;

-- Groups -----------------------------------------------------------------------------
-- A group is a circle of people, like a family, that loved ones can be shared with. Whoever makes a
-- group owns it. Members can invite their friends, people in their other groups, and people who let
-- themselves be found; each person invited says yes or no. Saying no works like declining a friend
-- request: it's hidden from everyone, and the group can't invite them again for 30 days.
-- Rows are only written through the functions below.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists groups_owner_idx on public.groups (owner_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- invited: asked and hasn't answered yet. member: in the group. declined: said no.
  status text not null default 'invited' check (status in ('invited', 'member', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- The group a loved one is shared with, when it's shared with a group.
alter table public.loved_ones add column if not exists group_id uuid references public.groups (id) on delete set null;
create index if not exists loved_ones_group_idx on public.loved_ones (group_id) where group_id is not null;

-- Whether the signed-in person is in a group. Only ever answers about yourself.
create or replace function public.is_group_member(target_group uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.group_members m
    where m.group_id = target_group and m.user_id = auth.uid() and m.status = 'member'
  );
$$;

-- Whether someone is in one of your groups or invited to one, or invited you to one (so you can see their name).
create or replace function public.shares_a_group_with_me(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and mine.status = 'member'
        and theirs.user_id = other and theirs.status in ('member', 'invited')
    )
    or exists (
      select 1 from public.group_members m
      where m.user_id = auth.uid() and m.status = 'invited' and m.invited_by = other
    )
  );
$$;

-- Whether something shared this way is shared with the signed-in person: shared with everyone, with
-- friends and they're the owner's friend, or with a group they're in. Same rule as canSeeLovedOne()
-- in src/lib/advice.ts, which also lets owners see their own and checks the kindness review.
create or replace function public.is_shared_with_me(visibility text, owner uuid, shared_group uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select visibility = 'public'
    or (visibility = 'friends' and public.is_my_friend(owner))
    or (visibility = 'group' and shared_group is not null and public.is_group_member(shared_group));
$$;

-- Whether the signed-in person has a name others can see, as they need to before commenting or inviting.
create or replace function public.i_have_a_name()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select trim(p.display_name) <> '' from public.profiles p where p.id = auth.uid()), false);
$$;

-- A loved one is only shared with a group while it says which group. Choosing anything else forgets
-- the group, and losing the group (it was deleted, or its owner left it) makes them private again.
create or replace function public.tidy_group_sharing()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility <> 'group' then
    new.group_id := null;
  elsif new.group_id is null then
    new.visibility := 'private';
  end if;
  return new;
end;
$$;

drop trigger if exists loved_ones_group_sharing on public.loved_ones;
create trigger loved_ones_group_sharing
  before insert or update on public.loved_ones
  for each row execute function public.tidy_group_sharing();

create or replace function public.create_group(group_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  -- Members need to know whose group it is.
  if not public.i_have_a_name() then
    return jsonb_build_object('result', 'need_name');
  end if;
  if char_length(trim(coalesce(group_name, ''))) not between 1 and 60 then
    return jsonb_build_object('result', 'bad_name');
  end if;
  if (select count(*) from public.groups g where g.owner_id = me) >= 50 then
    return jsonb_build_object('result', 'too_many');
  end if;

  insert into public.groups (name, owner_id) values (trim(group_name), me) returning id into new_id;
  insert into public.group_members (group_id, user_id, status, responded_at) values (new_id, me, 'member', now());
  return jsonb_build_object('result', 'created', 'id', new_id);
end;
$$;

create or replace function public.rename_group(target_group uuid, group_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(group_name, ''))) not between 1 and 60 then
    raise exception 'A group''s name is 1 to 60 characters';
  end if;
  update public.groups set name = trim(group_name) where id = target_group and owner_id = auth.uid();
end;
$$;

-- Delete a group you own. Loved ones shared with it become private again (see tidy_group_sharing).
create or replace function public.delete_group(target_group uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.groups where id = target_group and owner_id = auth.uid();
$$;

-- Invite someone to a group you're in.
create or replace function public.invite_to_group(target_group uuid, other_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.group_members%rowtype;
  other_name text;
  other_discoverable boolean;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if not public.is_group_member(target_group) then
    raise exception 'Only members can invite people';
  end if;
  -- The person invited needs to know who's asking.
  if not public.i_have_a_name() then
    return jsonb_build_object('result', 'need_name');
  end if;
  if other_id = me then
    return jsonb_build_object('result', 'self');
  end if;

  select p.display_name, p.discoverable into other_name, other_discoverable
  from public.profiles p where p.id = other_id;
  -- Your friends, people in your groups, and people who let themselves be found.
  if other_name is null
    or (not other_discoverable and not public.is_my_friend(other_id) and not public.shares_a_group_with_me(other_id)) then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into existing from public.group_members m where m.group_id = target_group and m.user_id = other_id;
  if found then
    if existing.status = 'member' then
      return jsonb_build_object('result', 'already_member', 'name', other_name);
    elsif existing.status = 'invited' then
      return jsonb_build_object('result', 'already_invited', 'name', other_name);
    elsif existing.responded_at > now() - interval '30 days' then
      -- They said no. Don't tell, and don't ask them again until 30 days have passed.
      return jsonb_build_object('result', 'invited', 'name', other_name);
    end if;
  end if;

  if (select count(*) from public.group_members m where m.group_id = target_group and m.status <> 'declined') >= 200 then
    return jsonb_build_object('result', 'full');
  end if;
  if (select count(*) from public.group_members m where m.invited_by = me and m.status = 'invited') >= 100 then
    return jsonb_build_object('result', 'too_many');
  end if;

  insert into public.group_members (group_id, user_id, status, invited_by)
  values (target_group, other_id, 'invited', me)
  on conflict (group_id, user_id) do update
    set status = 'invited', invited_by = me, created_at = now(), responded_at = null;
  return jsonb_build_object('result', 'invited', 'name', other_name);
end;
$$;

create or replace function public.respond_to_group_invite(target_group uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_members
  set status = case when accept then 'member' else 'declined' end, responded_at = now()
  where group_id = target_group and user_id = auth.uid() and status = 'invited';
end;
$$;

-- Leave a group. Your loved ones shared with it become private again. Owners delete their group instead.
create or replace function public.leave_group(target_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if exists (select 1 from public.groups g where g.id = target_group and g.owner_id = me) then
    raise exception 'The owner can''t leave their group. Delete it instead.';
  end if;
  update public.loved_ones set group_id = null where owner_id = me and group_id = target_group;
  delete from public.group_members where group_id = target_group and user_id = me and status = 'member';
end;
$$;

-- The owner removes someone from their group or takes back an invitation. Whoever sent an invitation
-- can take it back too. Loved ones the person shared with the group become private again.
create or replace function public.remove_from_group(target_group uuid, other_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  group_owner uuid;
begin
  select g.owner_id into group_owner from public.groups g where g.id = target_group;
  if group_owner is null or other_id = group_owner then
    return;
  end if;
  if me = group_owner then
    update public.loved_ones set group_id = null where owner_id = other_id and group_id = target_group;
    delete from public.group_members where group_id = target_group and user_id = other_id and status <> 'declined';
  else
    delete from public.group_members
    where group_id = target_group and user_id = other_id and status = 'invited' and invited_by = me;
  end if;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.rename_group(uuid, text) from public, anon;
revoke all on function public.delete_group(uuid) from public, anon;
revoke all on function public.invite_to_group(uuid, uuid) from public, anon;
revoke all on function public.respond_to_group_invite(uuid, boolean) from public, anon;
revoke all on function public.leave_group(uuid) from public, anon;
revoke all on function public.remove_from_group(uuid, uuid) from public, anon;
revoke all on function public.i_have_a_name() from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.invite_to_group(uuid, uuid) to authenticated;
grant execute on function public.respond_to_group_invite(uuid, boolean) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_from_group(uuid, uuid) to authenticated;
grant execute on function public.i_have_a_name() to authenticated;
-- Used by the rules below; like is_my_friend, they only ever answer about the person asking.
grant execute on function public.is_group_member(uuid) to anon, authenticated;
grant execute on function public.shares_a_group_with_me(uuid) to anon, authenticated;
grant execute on function public.is_shared_with_me(text, uuid, uuid) to anon, authenticated;

-- Likes and comments ---------------------------------------------------------------------
-- Anyone who can see a quote, story or loved one can like it and comment on it, and sees who else
-- did. Comments go through the kindness review below like everything shared, and whoever shared the
-- memory can delete comments on it.

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ism_id uuid references public.isms (id) on delete cascade,
  loved_one_id uuid references public.loved_ones (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(ism_id, loved_one_id) = 1)
);

create unique index if not exists likes_once_per_ism on public.likes (user_id, ism_id) where ism_id is not null;
create unique index if not exists likes_once_per_loved_one on public.likes (user_id, loved_one_id)
  where loved_one_id is not null;
create index if not exists likes_ism_idx on public.likes (ism_id);
create index if not exists likes_loved_one_idx on public.likes (loved_one_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ism_id uuid references public.isms (id) on delete cascade,
  loved_one_id uuid references public.loved_ones (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  -- See the kindness review below.
  review_status text not null default 'ok' check (review_status in ('ok', 'pending', 'approved', 'removed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(ism_id, loved_one_id) = 1)
);

create index if not exists comments_ism_idx on public.comments (ism_id);
create index if not exists comments_loved_one_idx on public.comments (loved_one_id);
create index if not exists comments_author_idx on public.comments (author_id);

-- At most 30 comments an hour from one person, to keep out spam.
create or replace function public.limit_comments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.comments c
      where c.author_id = new.author_id and c.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''ve written a lot of comments. Try again in a little while.';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_limit on public.comments;
create trigger comments_limit
  before insert on public.comments
  for each row execute function public.limit_comments();

-- People only choose what they like or comment on, and what they write. Who wrote it, when, and its
-- review status are filled in for them.
revoke insert, update on public.likes from anon, authenticated;
grant insert (ism_id, loved_one_id) on public.likes to authenticated;
revoke insert, update on public.comments from anon, authenticated;
grant insert (ism_id, loved_one_id, body) on public.comments to authenticated;

-- Kindness review --------------------------------------------------------------------
-- Shared memories that might hurt, accuse or embarrass someone wait for a reviewer at Isms
-- before anyone else can see them, and so does anything three people report. Memories nobody
-- else can see are never looked at.
--
-- Each quote, story, loved one and comment has a review status:
--   ok        nothing to check
--   pending   might be hurtful: only its owner sees it until a reviewer looks
--   approved  a reviewer looked and allowed it
--   removed   a reviewer hid it from everyone but its owner

-- Words that often come with accusations, abuse, scandal or insults. It flags plenty of harmless
-- things too ("she hated waste"); a reviewer simply allows those.
create or replace function public.might_be_hurtful(content text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(content, '') ~* (
    '\m(' ||
    'abus(e|ed|er|ers|es|ing|ive)|assault(ed|s)?|arrest(ed|s)?|convict(ed|s)?|criminal|felon|fraud|' ||
    'embezzl\w*|steal(s|ing)?|stole|stolen|thie(f|ves)|theft|robb(ed|er|ery)|molest\w*|rape(d|s)?|rapist|' ||
    'pedophile|prison|jail(ed)?|murder(ed|er|s)?|' ||
    '(beat|beats|hit|hits|slapped|punched|kicked|choked|hurt) (me|us|her|him|them|my|his|our|their)|' ||
    'affairs?|cheat(ed|er|ers|ing|s)?|mistress|adulter\w*|illegitimate|' ||
    'addict(ed|s|ion)?|alcoholic|drunk(ard|en)?|junkie|overdos(e|ed)|meth|cocaine|heroin|' ||
    'liars?|lied|crook(ed)?|worthless|pathetic|disgusting|evil|monster|cruel|selfish|hate(d|s|ful)?|' ||
    '(terrible|horrible|awful|bad|lousy|deadbeat|absent) (father|mother|dad|mom|parent|husband|wife|person|man|woman)|' ||
    'bitch(es|y)?|bastard|whore|slut|cunt|retard(ed)?|' ||
    'suicide|killed (himself|herself|themselves)|took (his|her|their) own life' ||
    ')\M'
  );
$$;

alter table public.isms add column if not exists review_status text;
update public.isms
set review_status = case when public.might_be_hurtful(concat_ws(' ', title, text, context)) then 'pending' else 'ok' end
where review_status is null;
alter table public.isms alter column review_status set default 'ok';
alter table public.isms alter column review_status set not null;
alter table public.isms drop constraint if exists isms_review_status_check;
alter table public.isms add constraint isms_review_status_check
  check (review_status in ('ok', 'pending', 'approved', 'removed'));

alter table public.loved_ones add column if not exists review_status text;
update public.loved_ones
set review_status = case when public.might_be_hurtful(concat_ws(' ', name, about, obituary)) then 'pending' else 'ok' end
where review_status is null;
alter table public.loved_ones alter column review_status set default 'ok';
alter table public.loved_ones alter column review_status set not null;
alter table public.loved_ones drop constraint if exists loved_ones_review_status_check;
alter table public.loved_ones add constraint loved_ones_review_status_check
  check (review_status in ('ok', 'pending', 'approved', 'removed'));

-- Checks the words whenever they're added or changed. Only a reviewer (review_content) changes the
-- status otherwise, and the app can't write the column at all (see the grants below).
create or replace function public.set_review_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  words text;
  old_words text;
begin
  if tg_table_name = 'isms' then
    words := concat_ws(' ', new.title, new.text, new.context);
    if tg_op = 'UPDATE' then
      old_words := concat_ws(' ', old.title, old.text, old.context);
    end if;
  elsif tg_table_name = 'comments' then
    words := new.body;
    if tg_op = 'UPDATE' then
      old_words := old.body;
    end if;
  else
    words := concat_ws(' ', new.name, new.about, new.obituary);
    if tg_op = 'UPDATE' then
      old_words := concat_ws(' ', old.name, old.about, old.obituary);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if words is not distinct from old_words then
      return new;
    end if;
    -- Something a reviewer removed stays removed, even when it's edited.
    if old.review_status = 'removed' then
      new.review_status := 'removed';
      return new;
    end if;
  end if;

  new.review_status := case when public.might_be_hurtful(words) then 'pending' else 'ok' end;
  return new;
end;
$$;

drop trigger if exists isms_review_status on public.isms;
create trigger isms_review_status
  before insert or update on public.isms
  for each row execute function public.set_review_status();

drop trigger if exists loved_ones_review_status on public.loved_ones;
create trigger loved_ones_review_status
  before insert or update on public.loved_ones
  for each row execute function public.set_review_status();

drop trigger if exists comments_review_status on public.comments;
create trigger comments_review_status
  before insert or update on public.comments
  for each row execute function public.set_review_status();

-- People can change everything about their own quotes, stories and loved ones except the review status.
revoke update on public.isms from anon, authenticated;
grant update (loved_one_id, kind, title, text, context, topics, keep_private) on public.isms to authenticated;
revoke update on public.loved_ones from anon, authenticated;
grant update (name, relationship, years, about, obituary, photo_path, visibility, group_id, allow_contributions) on public.loved_ones
  to authenticated;

-- Reports: anyone who can see a shared quote, story, loved one or comment can report it. It's hidden
-- from them straight away, and from everyone once three people have reported it, until a reviewer looks.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ism_id uuid references public.isms (id) on delete cascade,
  loved_one_id uuid references public.loved_ones (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.reports add column if not exists comment_id uuid references public.comments (id) on delete cascade;
-- Each report is about one thing. (reports_check is the rule from before comments could be reported.)
alter table public.reports drop constraint if exists reports_check;
alter table public.reports drop constraint if exists reports_one_thing;
alter table public.reports add constraint reports_one_thing check (num_nonnulls(ism_id, loved_one_id, comment_id) = 1);

create unique index if not exists reports_once_per_ism on public.reports (reporter_id, ism_id) where ism_id is not null;
create unique index if not exists reports_once_per_loved_one on public.reports (reporter_id, loved_one_id)
  where loved_one_id is not null;
create unique index if not exists reports_once_per_comment on public.reports (reporter_id, comment_id)
  where comment_id is not null;

-- Reviewers. Added by hand in the SQL editor; the app can't read or change this list.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.report_content(target_ism uuid, target_loved_one uuid, why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item_owner uuid;
  current_status text;
  shared_with_me boolean;
  reporters int;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
  if (target_ism is null) = (target_loved_one is null) then
    raise exception 'Report one thing at a time';
  end if;

  if target_ism is not null then
    select i.owner_id, i.review_status,
      not i.keep_private and public.is_shared_with_me(l.visibility, l.owner_id, l.group_id)
    into item_owner, current_status, shared_with_me
    from public.isms i join public.loved_ones l on l.id = i.loved_one_id
    where i.id = target_ism;
  else
    select l.owner_id, l.review_status, public.is_shared_with_me(l.visibility, l.owner_id, l.group_id)
    into item_owner, current_status, shared_with_me
    from public.loved_ones l
    where l.id = target_loved_one;
  end if;

  -- You can only report something that's shared with you, and not your own.
  if item_owner is null or item_owner = me or not shared_with_me or current_status not in ('ok', 'approved') then
    raise exception 'Nothing to report';
  end if;

  insert into public.reports (reporter_id, ism_id, loved_one_id, reason)
  values (me, target_ism, target_loved_one, left(trim(coalesce(why, '')), 500))
  on conflict do nothing;

  select count(*) into reporters from public.reports r
  where r.resolved_at is null
    and (r.ism_id = target_ism or r.loved_one_id = target_loved_one);
  if reporters >= 3 then
    if target_ism is not null then
      update public.isms set review_status = 'pending' where id = target_ism;
    else
      update public.loved_ones set review_status = 'pending' where id = target_loved_one;
    end if;
  end if;
end;
$$;

-- Report someone else's comment, on anything you can see (your own memories included).
create or replace function public.report_comment(target_comment uuid, why text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  author uuid;
  current_status text;
  on_ism uuid;
  on_loved_one uuid;
  shared_with_me boolean;
  reporters int;
begin
  if me is null then
    raise exception 'Sign in first';
  end if;

  select c.author_id, c.review_status, c.ism_id, c.loved_one_id
  into author, current_status, on_ism, on_loved_one
  from public.comments c where c.id = target_comment;

  -- What it's on has to be yours, or shared with you (the same rule as the policies below).
  if on_ism is not null then
    select i.owner_id = me or (
        not i.keep_private and i.review_status in ('ok', 'approved') and l.review_status in ('ok', 'approved')
        and public.is_shared_with_me(l.visibility, l.owner_id, l.group_id))
    into shared_with_me
    from public.isms i join public.loved_ones l on l.id = i.loved_one_id
    where i.id = on_ism;
  elsif on_loved_one is not null then
    select l.owner_id = me or (
        l.review_status in ('ok', 'approved') and public.is_shared_with_me(l.visibility, l.owner_id, l.group_id))
    into shared_with_me
    from public.loved_ones l
    where l.id = on_loved_one;
  end if;

  if author is null or author = me or not coalesce(shared_with_me, false) or current_status not in ('ok', 'approved') then
    raise exception 'Nothing to report';
  end if;

  insert into public.reports (reporter_id, comment_id, reason)
  values (me, target_comment, left(trim(coalesce(why, '')), 500))
  on conflict do nothing;

  select count(*) into reporters from public.reports r where r.resolved_at is null and r.comment_id = target_comment;
  if reporters >= 3 then
    update public.comments set review_status = 'pending' where id = target_comment;
  end if;
end;
$$;

-- What's waiting for a reviewer: held memories and comments that are shared, and anything shared that's
-- been reported. For a comment, `context` is the quote or story it's on (empty when it's on a loved one).
create or replace function public.content_to_review()
returns table (
  item_kind text,
  item_id uuid,
  loved_one_id uuid,
  loved_one_name text,
  owner_name text,
  title text,
  body text,
  context text,
  visibility text,
  review_status text,
  report_count int,
  reasons text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    select
      'ism'::text, i.id, l.id, l.name, coalesce(p.display_name, ''), i.title, i.text, i.context,
      l.visibility, i.review_status,
      (select count(*)::int from public.reports r where r.ism_id = i.id and r.resolved_at is null),
      array(select r.reason from public.reports r where r.ism_id = i.id and r.resolved_at is null and r.reason <> ''),
      i.created_at
    from public.isms i
    join public.loved_ones l on l.id = i.loved_one_id
    left join public.profiles p on p.id = i.owner_id
    where public.is_admin()
      and l.visibility <> 'private'
      and not i.keep_private
      and (
        i.review_status = 'pending'
        or exists (select 1 from public.reports r where r.ism_id = i.id and r.resolved_at is null)
      )
    union all
    select
      'loved_one'::text, l.id, l.id, l.name, coalesce(p.display_name, ''), null::text,
      concat_ws(E'\n\n', nullif(l.about, ''), nullif(l.obituary, '')), null::text,
      l.visibility, l.review_status,
      (select count(*)::int from public.reports r where r.loved_one_id = l.id and r.resolved_at is null),
      array(select r.reason from public.reports r where r.loved_one_id = l.id and r.resolved_at is null and r.reason <> ''),
      l.created_at
    from public.loved_ones l
    left join public.profiles p on p.id = l.owner_id
    where public.is_admin()
      and l.visibility <> 'private'
      and (
        l.review_status = 'pending'
        or exists (select 1 from public.reports r where r.loved_one_id = l.id and r.resolved_at is null)
      )
    union all
    select
      'comment'::text, c.id, l.id, l.name, coalesce(p.display_name, ''), null::text, c.body,
      case when i.id is null then null else left(concat_ws(': ', nullif(i.title, ''), i.text), 300) end,
      l.visibility, c.review_status,
      (select count(*)::int from public.reports r where r.comment_id = c.id and r.resolved_at is null),
      array(select r.reason from public.reports r where r.comment_id = c.id and r.resolved_at is null and r.reason <> ''),
      c.created_at
    from public.comments c
    left join public.isms i on i.id = c.ism_id
    join public.loved_ones l on l.id = coalesce(c.loved_one_id, i.loved_one_id)
    left join public.profiles p on p.id = c.author_id
    where public.is_admin()
      and l.visibility <> 'private'
      and not coalesce(i.keep_private, false)
      and (
        c.review_status = 'pending'
        or exists (select 1 from public.reports r where r.comment_id = c.id and r.resolved_at is null)
      )
  ) waiting
  order by 13;
$$;

-- A reviewer's decision: allow it (everyone it's shared with can see it) or remove it (only its owner can).
create or replace function public.review_content(item_kind text, item_id uuid, allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only reviewers can do this';
  end if;
  if item_kind = 'ism' then
    update public.isms set review_status = case when allow then 'approved' else 'removed' end where id = item_id;
    update public.reports set resolved_at = now() where ism_id = item_id and resolved_at is null;
  elsif item_kind = 'loved_one' then
    update public.loved_ones set review_status = case when allow then 'approved' else 'removed' end where id = item_id;
    update public.reports set resolved_at = now() where loved_one_id = item_id and resolved_at is null;
  elsif item_kind = 'comment' then
    update public.comments set review_status = case when allow then 'approved' else 'removed' end where id = item_id;
    update public.reports set resolved_at = now() where comment_id = item_id and resolved_at is null;
  else
    raise exception 'Unknown kind: %', item_kind;
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.report_content(uuid, uuid, text) from public, anon;
revoke all on function public.report_comment(uuid, text) from public, anon;
revoke all on function public.content_to_review() from public, anon;
revoke all on function public.review_content(text, uuid, boolean) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.report_content(uuid, uuid, text) to authenticated;
grant execute on function public.report_comment(uuid, text) to authenticated;
grant execute on function public.content_to_review() to authenticated;
grant execute on function public.review_content(text, uuid, boolean) to authenticated;

-- Who can see what ----------------------------------------------------------------
-- Same rule as canSee() in src/lib/advice.ts: you see everything of your own; other people's
-- loved ones when they're shared with everyone, with friends and you're their friend, or with a
-- group you're in; never a quote or story kept private; nothing waiting for or removed by a
-- reviewer; and nothing you reported. Likes and comments go with what they're on.

alter table public.loved_ones enable row level security;
alter table public.isms enable row level security;
alter table public.saved_isms enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.contact_lookups enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

drop policy if exists "read own or shared loved ones" on public.loved_ones;
create policy "read own or shared loved ones" on public.loved_ones
  for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or (
      review_status in ('ok', 'approved')
      and public.is_shared_with_me(visibility, owner_id, group_id)
      and not exists (
        select 1 from public.reports r where r.reporter_id = auth.uid() and r.loved_one_id = loved_ones.id
      )
    )
  );

-- You can only share a loved one with a group you're in.
drop policy if exists "add own loved ones" on public.loved_ones;
create policy "add own loved ones" on public.loved_ones
  for insert to authenticated
  with check (owner_id = auth.uid() and (visibility <> 'group' or public.is_group_member(group_id)));

drop policy if exists "change own loved ones" on public.loved_ones;
create policy "change own loved ones" on public.loved_ones
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (visibility <> 'group' or public.is_group_member(group_id)));

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
      and review_status in ('ok', 'approved')
      and not exists (select 1 from public.reports r where r.reporter_id = auth.uid() and r.ism_id = isms.id)
      -- Its loved one must be visible to you too (that rule is checked for this lookup as well).
      and exists (
        select 1 from public.loved_ones l
        where l.id = isms.loved_one_id
          and public.is_shared_with_me(l.visibility, l.owner_id, l.group_id)
      )
    )
  );

-- Add quotes and stories to your own loved ones, or to someone else's that you can see (the loved ones
-- rule is checked for this lookup too) when they let others add memories.
drop policy if exists "add isms to own loved ones" on public.isms;
drop policy if exists "add isms to loved ones you may add to" on public.isms;
create policy "add isms to loved ones you may add to" on public.isms
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.loved_ones l
      where l.id = loved_one_id and (l.owner_id = auth.uid() or l.allow_contributions)
    )
  );

drop policy if exists "change own isms" on public.isms;
create policy "change own isms" on public.isms
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.loved_ones l
      where l.id = loved_one_id and (l.owner_id = auth.uid() or l.allow_contributions)
    )
  );

-- Remove your own quotes and stories, and anything others added to your loved ones.
drop policy if exists "remove own isms" on public.isms;
drop policy if exists "remove own isms or ones added to own loved ones" on public.isms;
create policy "remove own isms or ones added to own loved ones" on public.isms
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.loved_ones l where l.id = isms.loved_one_id and l.owner_id = auth.uid())
  );

drop policy if exists "manage own saved" on public.saved_isms;
create policy "manage own saved" on public.saved_isms
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- You can see your own profile, and the names of: people you're friends with or have a request open
-- with; people in your groups; anyone whose comments or likes you can see, or quotes and stories they
-- added to someone else's loved one (their name shows with them); and people with a public profile,
-- once something of theirs is shared with you.
-- Finding other people goes through search_people and find_people_from_contacts instead.
drop policy if exists "read own and connected profiles" on public.profiles;
drop policy if exists "read profiles you may see" on public.profiles;
create policy "read profiles you may see" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_connected_to_me(id)
    or public.shares_a_group_with_me(id)
    or exists (select 1 from public.comments c where c.author_id = profiles.id)
    or exists (select 1 from public.likes k where k.user_id = profiles.id)
    or exists (
      select 1 from public.isms i join public.loved_ones l on l.id = i.loved_one_id
      where i.owner_id = profiles.id and l.owner_id <> profiles.id
    )
    or (public_profile and exists (select 1 from public.loved_ones l where l.owner_id = profiles.id))
  );

-- You can change your own name, whether people can find you and whether your profile is public, and nothing else.
drop policy if exists "change own name" on public.profiles;
create policy "change own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (display_name, discoverable, public_profile) on public.profiles to authenticated;

-- Your friends and open requests. Declined requests are hidden from both people.
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select to authenticated
  using (auth.uid() in (requester, addressee) and status <> 'declined');

-- You can see what you reported (so it stays hidden from you). Nobody can write reports directly.
drop policy if exists "see own reports" on public.reports;
create policy "see own reports" on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- Groups you're in or invited to, and who's in them. Invitations are only seen by the person invited
-- and the group's members; declined ones by nobody. Groups change only through the functions above.
drop policy if exists "see own groups" on public.groups;
create policy "see own groups" on public.groups
  for select to authenticated
  using (exists (
    select 1 from public.group_members m
    where m.group_id = groups.id and m.user_id = auth.uid() and m.status in ('member', 'invited')
  ));

drop policy if exists "see members of own groups" on public.group_members;
create policy "see members of own groups" on public.group_members
  for select to authenticated
  using (status <> 'declined' and (user_id = auth.uid() or public.is_group_member(group_id)));

-- Likes: on what you can see (the rules above are checked for these lookups too).
drop policy if exists "see likes on what you can see" on public.likes;
create policy "see likes on what you can see" on public.likes
  for select to authenticated
  using (
    exists (select 1 from public.isms i where i.id = likes.ism_id)
    or exists (select 1 from public.loved_ones l where l.id = likes.loved_one_id)
  );

drop policy if exists "like what you can see" on public.likes;
create policy "like what you can see" on public.likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.isms i where i.id = likes.ism_id)
      or exists (select 1 from public.loved_ones l where l.id = likes.loved_one_id)
    )
  );

drop policy if exists "remove own likes" on public.likes;
create policy "remove own likes" on public.likes
  for delete to authenticated
  using (user_id = auth.uid());

-- Comments: on what you can see. Your own always show to you; other people's only once they've passed
-- the kindness review, and never ones you reported.
drop policy if exists "read comments on what you can see" on public.comments;
create policy "read comments on what you can see" on public.comments
  for select to authenticated
  using (
    (
      exists (select 1 from public.isms i where i.id = comments.ism_id)
      or exists (select 1 from public.loved_ones l where l.id = comments.loved_one_id)
    )
    and (
      author_id = auth.uid()
      or (
        review_status in ('ok', 'approved')
        and not exists (select 1 from public.reports r where r.reporter_id = auth.uid() and r.comment_id = comments.id)
      )
    )
  );

drop policy if exists "comment on what you can see" on public.comments;
create policy "comment on what you can see" on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.i_have_a_name()
    and (
      exists (select 1 from public.isms i where i.id = comments.ism_id)
      or exists (select 1 from public.loved_ones l where l.id = comments.loved_one_id)
    )
  );

-- Delete your own comments, or anyone's on the loved ones, quotes and stories you added, including on
-- quotes and stories others added to your loved ones.
drop policy if exists "remove own comments or comments on own memories" on public.comments;
create policy "remove own comments or comments on own memories" on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from public.isms i where i.id = comments.ism_id and i.owner_id = auth.uid())
    or exists (
      select 1 from public.isms i join public.loved_ones l on l.id = i.loved_one_id
      where i.id = comments.ism_id and l.owner_id = auth.uid()
    )
    or exists (select 1 from public.loved_ones l where l.id = comments.loved_one_id and l.owner_id = auth.uid())
  );

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
          and l.review_status in ('ok', 'approved')
          and public.is_shared_with_me(l.visibility, l.owner_id, l.group_id)
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
-- Lets a signed-in person delete their own account. Their loved ones, quotes, stories, saved memories,
-- likes, comments, profile, friendships, groups and reports go with it (the tables cascade); loved
-- ones other people shared with their groups become private again. The app removes their photos first.

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
