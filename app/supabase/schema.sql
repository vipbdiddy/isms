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
begin
  if me is null then
    raise exception 'Sign in first';
  end if;
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

-- Which of your contacts use Ism's. The app sends the SHA-256 of each contact's lower-case email
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

-- Kindness review --------------------------------------------------------------------
-- Shared memories that might hurt, accuse or embarrass someone wait for a reviewer at Ism's
-- before anyone else can see them, and so does anything three people report. Memories nobody
-- else can see are never looked at.
--
-- Each quote, story and loved one has a review status:
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

-- People can change everything about their own quotes, stories and loved ones except the review status.
revoke update on public.isms from anon, authenticated;
grant update (loved_one_id, kind, title, text, context, topics, keep_private) on public.isms to authenticated;
revoke update on public.loved_ones from anon, authenticated;
grant update (name, relationship, years, about, obituary, photo_path, visibility) on public.loved_ones to authenticated;

-- Reports: anyone who can see a shared quote, story or loved one can report it. It's hidden from
-- them straight away, and from everyone once three people have reported it, until a reviewer looks.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ism_id uuid references public.isms (id) on delete cascade,
  loved_one_id uuid references public.loved_ones (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((ism_id is null) <> (loved_one_id is null))
);

create unique index if not exists reports_once_per_ism on public.reports (reporter_id, ism_id) where ism_id is not null;
create unique index if not exists reports_once_per_loved_one on public.reports (reporter_id, loved_one_id)
  where loved_one_id is not null;

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
      not i.keep_private and (l.visibility = 'public' or (l.visibility = 'friends' and public.is_my_friend(l.owner_id)))
    into item_owner, current_status, shared_with_me
    from public.isms i join public.loved_ones l on l.id = i.loved_one_id
    where i.id = target_ism;
  else
    select l.owner_id, l.review_status,
      l.visibility = 'public' or (l.visibility = 'friends' and public.is_my_friend(l.owner_id))
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

-- What's waiting for a reviewer: held memories that are shared, and anything shared that's been reported.
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
  else
    raise exception 'Unknown kind: %', item_kind;
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.report_content(uuid, uuid, text) from public, anon;
revoke all on function public.content_to_review() from public, anon;
revoke all on function public.review_content(text, uuid, boolean) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.report_content(uuid, uuid, text) to authenticated;
grant execute on function public.content_to_review() to authenticated;
grant execute on function public.review_content(text, uuid, boolean) to authenticated;

-- Who can see what ----------------------------------------------------------------
-- Same rule as canSee() in src/lib/advice.ts: you see everything of your own; other people's
-- loved ones when they're shared with everyone, or with friends and you're their friend; never a
-- quote or story kept private; nothing waiting for or removed by a reviewer; and nothing you reported.

alter table public.loved_ones enable row level security;
alter table public.isms enable row level security;
alter table public.saved_isms enable row level security;
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.contact_lookups enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;

drop policy if exists "read own or shared loved ones" on public.loved_ones;
create policy "read own or shared loved ones" on public.loved_ones
  for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or (
      review_status in ('ok', 'approved')
      and (visibility = 'public' or (visibility = 'friends' and public.is_my_friend(owner_id)))
      and not exists (
        select 1 from public.reports r where r.reporter_id = auth.uid() and r.loved_one_id = loved_ones.id
      )
    )
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
      and review_status in ('ok', 'approved')
      and not exists (select 1 from public.reports r where r.reporter_id = auth.uid() and r.ism_id = isms.id)
      -- Its loved one must be visible to you too (that rule is checked for this lookup as well).
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

-- You can see your own profile and the names of people you're friends with or have a request open with.
-- Finding other people goes through search_people and find_people_from_contacts instead.
drop policy if exists "read own and connected profiles" on public.profiles;
create policy "read own and connected profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_connected_to_me(id));

-- You can change your own name and whether people can find you, and nothing else.
drop policy if exists "change own name" on public.profiles;
create policy "change own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (display_name, discoverable) on public.profiles to authenticated;

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
-- profile, friendships and reports go with it (the tables cascade); the app removes their photos first.

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
