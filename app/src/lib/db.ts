import { supabase } from './supabase';
import type {
  FriendRequestResult,
  Friendship,
  Ism,
  IsmInput,
  LovedOne,
  LovedOneInput,
  PersonResult,
  Profile,
  ReviewItem,
  ReviewStatus,
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

/** Everything this person may see: their own loved ones and every family's shared ones. */
export async function fetchAll(userId: string | null) {
  const [lovedOnes, isms, saved] = await Promise.all([
    supabase.from('loved_ones').select('*').order('created_at'),
    supabase.from('isms').select('*').order('created_at', { ascending: false }),
    userId ? supabase.from('saved_isms').select('ism_id') : Promise.resolve({ data: [], error: null }),
  ]);
  if (lovedOnes.error) throw lovedOnes.error;
  if (isms.error) throw isms.error;
  if (saved.error) throw saved.error;
  return {
    lovedOnes: (lovedOnes.data as LovedOneRow[]).map(toLovedOne),
    isms: (isms.data as IsmRow[]).map(toIsm),
    savedIsmIds: (saved.data as { ism_id: string }[]).map((r) => r.ism_id),
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
 * Your own profile, the names of the people you're connected to, your friends and friend requests,
 * and whether you review shared memories.
 */
export async function fetchFriends(userId: string) {
  const [profiles, friendships, admin] = await Promise.all([
    supabase.from('profiles').select('id, display_name, discoverable'),
    supabase.from('friendships').select('requester, addressee, status, created_at').order('created_at', { ascending: false }),
    supabase.rpc('is_admin'),
  ]);
  if (profiles.error) throw profiles.error;
  if (friendships.error) throw friendships.error;
  const rows = profiles.data as ProfileRow[];
  const mine = rows.find((r) => r.id === userId);
  return {
    me: mine ? { id: mine.id, displayName: mine.display_name, discoverable: mine.discoverable } : null,
    isAdmin: admin.data === true,
    others: rows.filter((r) => r.id !== userId).map((r): Profile => ({ id: r.id, displayName: r.display_name })),
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

export async function updateMyProfile(userId: string, changes: { displayName?: string; discoverable?: boolean }) {
  const row: Partial<ProfileRow> = {};
  if (changes.displayName !== undefined) row.display_name = changes.displayName;
  if (changes.discoverable !== undefined) row.discoverable = changes.discoverable;
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
