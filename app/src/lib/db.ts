import { supabase } from './supabase';
import type {
  Comment,
  CreateGroupResult,
  FriendRequestResult,
  Friendship,
  Group,
  GroupInviteResult,
  GroupMember,
  Ism,
  IsmInput,
  Like,
  LovedOne,
  LovedOneInput,
  PersonResult,
  Profile,
  ReviewItem,
  ReviewStatus,
  Target,
  Visibility,
} from './types';

// Rows as they're stored in Supabase (see supabase/schema.sql).
interface LovedOneRow {
  id: string;
  owner_id: string;
  name: string;
  relationship: string;
  years: string | null;
  about: string | null;
  obituary: string | null;
  photo_path: string | null;
  visibility: Visibility;
  group_id: string | null;
  review_status: ReviewStatus;
  created_at: string;
}

interface IsmRow {
  id: string;
  owner_id: string;
  loved_one_id: string;
  kind: 'quote' | 'story';
  title: string | null;
  text: string;
  context: string | null;
  topics: string[];
  keep_private: boolean;
  review_status: ReviewStatus;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  discoverable: boolean;
  public_profile: boolean;
}

interface GroupRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

interface GroupMemberRow {
  group_id: string;
  user_id: string;
  status: GroupMember['status'];
  invited_by: string | null;
  created_at: string;
}

interface LikeRow {
  user_id: string;
  ism_id: string | null;
  loved_one_id: string | null;
}

interface CommentRow {
  id: string;
  author_id: string;
  ism_id: string | null;
  loved_one_id: string | null;
  body: string;
  review_status: ReviewStatus;
  created_at: string;
}

interface PersonRow {
  id: string;
  display_name: string;
  mutual_friends: number;
  relationship: PersonResult['relationship'];
}

interface ReviewRow {
  item_kind: ReviewItem['kind'];
  item_id: string;
  loved_one_id: string;
  loved_one_name: string;
  owner_name: string;
  title: string | null;
  body: string;
  context: string | null;
  visibility: Visibility;
  review_status: ReviewStatus;
  report_count: number;
  reasons: string[];
  created_at: string;
}

interface FriendshipRow {
  requester: string;
  addressee: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

const toLovedOne = (r: LovedOneRow): LovedOne => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  relationship: r.relationship,
  years: orUndefined(r.years),
  about: orUndefined(r.about),
  obituary: orUndefined(r.obituary),
  photoPath: orUndefined(r.photo_path),
  visibility: r.visibility,
  groupId: orUndefined(r.group_id),
  reviewStatus: r.review_status,
  createdAt: Date.parse(r.created_at),
});

const toIsm = (r: IsmRow): Ism => ({
  id: r.id,
  ownerId: r.owner_id,
  lovedOneId: r.loved_one_id,
  kind: r.kind,
  title: orUndefined(r.title),
  text: r.text,
  context: orUndefined(r.context),
  topics: r.topics,
  keepPrivate: r.keep_private,
  reviewStatus: r.review_status,
  createdAt: Date.parse(r.created_at),
});

const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  authorId: r.author_id,
  ismId: orUndefined(r.ism_id),
  lovedOneId: orUndefined(r.loved_one_id),
  body: r.body,
  reviewStatus: r.review_status,
  createdAt: Date.parse(r.created_at),
});

const toPerson = (r: PersonRow): PersonResult => ({
  id: r.id,
  displayName: r.display_name,
  mutualFriends: r.mutual_friends,
  relationship: r.relationship,
});

const lovedOneColumns = (input: Partial<LovedOneInput> & { photoPath?: string | null }) => {
  const row: Partial<LovedOneRow> = {};
  if ('name' in input) row.name = input.name;
  if ('relationship' in input) row.relationship = input.relationship;
  if ('years' in input) row.years = input.years ?? null;
  if ('about' in input) row.about = input.about ?? null;
  if ('obituary' in input) row.obituary = input.obituary ?? null;
  if ('visibility' in input) row.visibility = input.visibility;
  if ('groupId' in input) row.group_id = input.groupId ?? null;
  if ('photoPath' in input) row.photo_path = input.photoPath ?? null;
  return row;
};

const ismColumns = (input: Partial<IsmInput>) => {
  const row: Partial<IsmRow> = {};
  if ('lovedOneId' in input) row.loved_one_id = input.lovedOneId;
  if ('kind' in input) row.kind = input.kind;
  if ('title' in input) row.title = input.title ?? null;
  if ('text' in input) row.text = input.text;
  if ('context' in input) row.context = input.context ?? null;
  if ('topics' in input) row.topics = input.topics;
  if ('keepPrivate' in input) row.keep_private = input.keepPrivate ?? false;
  return row;
};

const none = Promise.resolve({ data: [], error: null });

/**
 * Everything this person may see: their own loved ones and every family's shared ones, and (signed in)
 * the likes and comments on them.
 */
export async function fetchAll(userId: string | null) {
  const [lovedOnes, isms, saved, likes, comments] = await Promise.all([
    supabase.from('loved_ones').select('*').order('created_at'),
    supabase.from('isms').select('*').order('created_at', { ascending: false }),
    userId ? supabase.from('saved_isms').select('ism_id') : none,
    userId ? supabase.from('likes').select('user_id, ism_id, loved_one_id').order('created_at', { ascending: false }) : none,
    // Newest first: one request returns at most 1000 rows, so if there are ever more, the oldest are left out.
    userId ? supabase.from('comments').select('*').order('created_at', { ascending: false }) : none,
  ]);
  if (lovedOnes.error) throw lovedOnes.error;
  if (isms.error) throw isms.error;
  if (saved.error) throw saved.error;
  // Likes and comments are extras: if they can't load (say the database is a version behind), the memories still show.
  if (likes.error) console.warn('Could not load likes', likes.error);
  if (comments.error) console.warn('Could not load comments', comments.error);
  return {
    lovedOnes: (lovedOnes.data as LovedOneRow[]).map(toLovedOne),
    isms: (isms.data as IsmRow[]).map(toIsm),
    savedIsmIds: (saved.data as { ism_id: string }[]).map((r) => r.ism_id),
    likes: ((likes.data ?? []) as LikeRow[]).map(
      (r): Like => ({ userId: r.user_id, ismId: orUndefined(r.ism_id), lovedOneId: orUndefined(r.loved_one_id) }),
    ),
    comments: ((comments.data ?? []) as CommentRow[]).map(toComment).reverse(),
  };
}

export async function insertLovedOne(input: LovedOneInput & { photoPath?: string }) {
  const { data, error } = await supabase.from('loved_ones').insert(lovedOneColumns(input)).select().single();
  if (error) throw error;
  return toLovedOne(data as LovedOneRow);
}

export async function patchLovedOne(id: string, patch: Partial<LovedOneInput> & { photoPath?: string | null }) {
  const { data, error } = await supabase.from('loved_ones').update(lovedOneColumns(patch)).eq('id', id).select().single();
  if (error) throw error;
  return toLovedOne(data as LovedOneRow);
}

export async function removeLovedOne(id: string) {
  const { error } = await supabase.from('loved_ones').delete().eq('id', id);
  if (error) throw error;
}

export async function insertIsm(input: IsmInput) {
  const { data, error } = await supabase.from('isms').insert(ismColumns(input)).select().single();
  if (error) throw error;
  return toIsm(data as IsmRow);
}

export async function patchIsm(id: string, patch: Partial<IsmInput>) {
  const { data, error } = await supabase.from('isms').update(ismColumns(patch)).eq('id', id).select().single();
  if (error) throw error;
  return toIsm(data as IsmRow);
}

export async function removeIsm(id: string) {
  const { error } = await supabase.from('isms').delete().eq('id', id);
  if (error) throw error;
}

export async function setSaved(ismId: string, saved: boolean) {
  const { error } = saved
    ? await supabase.from('saved_isms').insert({ ism_id: ismId })
    : await supabase.from('saved_isms').delete().eq('ism_id', ismId);
  if (error) throw error;
}

/**
 * Your own profile, your friends and friend requests, your groups and group invitations, and whether
 * you review shared memories. Other people's names come from fetchNames.
 */
export async function fetchFriends(userId: string) {
  const [mine, friendships, admin, groups, members] = await Promise.all([
    supabase.from('profiles').select('id, display_name, discoverable, public_profile').eq('id', userId).maybeSingle(),
    supabase.from('friendships').select('requester, addressee, status, created_at').order('created_at', { ascending: false }),
    supabase.rpc('is_admin'),
    supabase.from('groups').select('*').order('name'),
    supabase.from('group_members').select('group_id, user_id, status, invited_by, created_at').order('created_at'),
  ]);
  if (mine.error) throw mine.error;
  if (friendships.error) throw friendships.error;
  // Trouble with groups never hides your friends.
  if (groups.error) console.warn('Could not load groups', groups.error);
  if (members.error) console.warn('Could not load group members', members.error);
  const me = mine.data as ProfileRow | null;
  return {
    me: me ? { id: me.id, displayName: me.display_name, discoverable: me.discoverable, publicProfile: me.public_profile } : null,
    isAdmin: admin.data === true,
    groups: ((groups.data ?? []) as GroupRow[]).map(
      (r): Group => ({ id: r.id, name: r.name, ownerId: r.owner_id, createdAt: Date.parse(r.created_at) }),
    ),
    groupMembers: ((members.data ?? []) as GroupMemberRow[]).map(
      (r): GroupMember => ({
        groupId: r.group_id,
        userId: r.user_id,
        status: r.status,
        invitedBy: orUndefined(r.invited_by),
        createdAt: Date.parse(r.created_at),
      }),
    ),
    friendships: (friendships.data as FriendshipRow[]).map(
      (r): Friendship => ({
        otherId: r.requester === userId ? r.addressee : r.requester,
        status: r.status,
        incoming: r.addressee === userId,
        createdAt: Date.parse(r.created_at),
      }),
    ),
  };
}

/** How many people to ask about at once, so the request's address stays short. */
const NAMES_AT_ONCE = 100;

/**
 * The names of these people, and whether their profile is public: only for those whose names you may
 * see (the database decides). Asks a few at a time, so it works however many people there are.
 */
export async function fetchNames(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += NAMES_AT_ONCE) batches.push(unique.slice(i, i + NAMES_AT_ONCE));
  const results = await Promise.all(
    batches.map((batch) => supabase.from('profiles').select('id, display_name, public_profile').in('id', batch)),
  );
  return results.flatMap(({ data, error }) => {
    if (error) throw error;
    return (data as Omit<ProfileRow, 'discoverable'>[]).map(
      (r): Profile => ({ id: r.id, displayName: r.display_name, publicProfile: r.public_profile }),
    );
  });
}

/** People whose name contains `query` (at least 2 letters), if they allow being found. */
export async function searchPeople(query: string) {
  const { data, error } = await supabase.rpc('search_people', { query });
  if (error) throw error;
  return (data as PersonRow[]).map(toPerson);
}

/** People whose email address is one of these SHA-256 hashes, if they allow being found. */
export async function findPeopleFromContacts(emailHashes: string[]) {
  const { data, error } = await supabase.rpc('find_people_from_contacts', { email_hashes: emailHashes });
  if (error) throw error;
  return (data as PersonRow[]).map(toPerson);
}

export async function sendFriendRequestTo(userId: string) {
  const { data, error } = await supabase.rpc('send_friend_request_to', { other_id: userId });
  if (error) throw error;
  return data as FriendRequestResult;
}

export async function answerFriendRequest(requesterId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_to_friend_request', { requester_id: requesterId, accept });
  if (error) throw error;
}

/** Unfriend someone, or take back a request you sent them. */
export async function removeFriend(otherId: string) {
  const { error } = await supabase.rpc('remove_friend', { other_id: otherId });
  if (error) throw error;
}

export async function updateMyProfile(
  userId: string,
  changes: { displayName?: string; discoverable?: boolean; publicProfile?: boolean },
) {
  const row: Partial<ProfileRow> = {};
  if (changes.displayName !== undefined) row.display_name = changes.displayName;
  if (changes.discoverable !== undefined) row.discoverable = changes.discoverable;
  if (changes.publicProfile !== undefined) row.public_profile = changes.publicProfile;
  const { error } = await supabase.from('profiles').update(row).eq('id', userId).select('id').single();
  if (error) throw error;
}

/** Report someone else's shared quote, story or loved one. It's hidden from you straight away. */
export async function report(target: { ismId?: string; lovedOneId?: string }, reason: string) {
  const { error } = await supabase.rpc('report_content', {
    target_ism: target.ismId ?? null,
    target_loved_one: target.lovedOneId ?? null,
    why: reason,
  });
  if (error) throw error;
}

/** Reviewers only: shared memories held for their words or reported, oldest first. */
export async function contentToReview(): Promise<ReviewItem[]> {
  const { data, error } = await supabase.rpc('content_to_review');
  if (error) throw error;
  return (data as ReviewRow[]).map((r) => ({
    kind: r.item_kind,
    id: r.item_id,
    lovedOneId: r.loved_one_id,
    lovedOneName: r.loved_one_name,
    ownerName: r.owner_name,
    title: orUndefined(r.title),
    body: r.body,
    context: orUndefined(r.context),
    visibility: r.visibility,
    reviewStatus: r.review_status,
    reportCount: r.report_count,
    reasons: r.reasons,
    createdAt: Date.parse(r.created_at),
  }));
}

/** Reviewers only: allow something (everyone it's shared with sees it) or remove it (only its owner does). */
export async function reviewContent(kind: ReviewItem['kind'], id: string, allow: boolean) {
  const { error } = await supabase.rpc('review_content', { item_kind: kind, item_id: id, allow });
  if (error) throw error;
}

// Groups -----------------------------------------------------------------------------

export async function createGroup(name: string) {
  const { data, error } = await supabase.rpc('create_group', { group_name: name });
  if (error) throw error;
  return data as CreateGroupResult;
}

export async function renameGroup(groupId: string, name: string) {
  const { error } = await supabase.rpc('rename_group', { target_group: groupId, group_name: name });
  if (error) throw error;
}

/** The owner only. Loved ones shared with the group become private again. */
export async function deleteGroup(groupId: string) {
  const { error } = await supabase.rpc('delete_group', { target_group: groupId });
  if (error) throw error;
}

export async function inviteToGroup(groupId: string, userId: string) {
  const { data, error } = await supabase.rpc('invite_to_group', { target_group: groupId, other_id: userId });
  if (error) throw error;
  return data as GroupInviteResult;
}

export async function answerGroupInvite(groupId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_to_group_invite', { target_group: groupId, accept });
  if (error) throw error;
}

/** Your loved ones shared with the group become private again. */
export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc('leave_group', { target_group: groupId });
  if (error) throw error;
}

/** The owner removes someone or takes back an invitation; whoever invited someone can take it back too. */
export async function removeFromGroup(groupId: string, userId: string) {
  const { error } = await supabase.rpc('remove_from_group', { target_group: groupId, other_id: userId });
  if (error) throw error;
}

// Likes and comments ---------------------------------------------------------------

/** The column that says what a like or comment is on. */
const targetRow = (target: Target): { ism_id?: string; loved_one_id?: string } =>
  target.ismId !== undefined ? { ism_id: target.ismId } : { loved_one_id: target.lovedOneId };

export async function setLiked(target: Target, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from('likes').insert(targetRow(target));
    // Already liked (say, on another phone) is fine.
    if (error && error.code !== '23505') throw error;
  } else {
    const query = supabase.from('likes').delete();
    const { error } =
      target.ismId !== undefined ? await query.eq('ism_id', target.ismId) : await query.eq('loved_one_id', target.lovedOneId);
    if (error) throw error;
  }
}

export async function insertComment(target: Target, body: string) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ ...targetRow(target), body })
    .select()
    .single();
  if (error) throw error;
  return toComment(data as CommentRow);
}

/** Your own comment, or anyone's on a memory you shared. */
export async function removeComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}

/** Report someone else's comment. It's hidden from you straight away. */
export async function reportComment(id: string, reason: string) {
  const { error } = await supabase.rpc('report_comment', { target_comment: id, why: reason });
  if (error) throw error;
}
