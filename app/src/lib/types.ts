/** Who can see a loved one's memories: only you, your friends too, or everyone. */
export type Visibility = 'private' | 'friends' | 'public';

/** Whose words to draw from: only your own loved ones, your friends' too, or everything shared with you. */
export type Scope = 'mine' | 'friends' | 'everyone';

/**
 * Whether others may see something shared. Words that might be hurtful wait for a reviewer ('pending');
 * a reviewer either allows them ('approved') or hides them from everyone but their owner ('removed').
 */
export type ReviewStatus = 'ok' | 'pending' | 'approved' | 'removed';

export interface LovedOne {
  id: string;
  ownerId: string;
  name: string;
  relationship: string;
  /** Free-form, e.g. "1941 – 2019". */
  years?: string;
  about?: string;
  /** Where the profile photo is kept in storage. */
  photoPath?: string;
  /** A link the app can show the photo from (fetched for photoPath, or bundled for examples). */
  photoUri?: string;
  obituary?: string;
  /** Public loved ones (and their isms) are visible to every user of the app; friends-only ones to the owner's friends. */
  visibility: Visibility;
  /** Missing for the bundled examples, which are always fine. */
  reviewStatus?: ReviewStatus;
  createdAt: number;
}

/** A short saying in their words, or a longer story about them. */
export type EntryKind = 'quote' | 'story';

/** Which kinds of entries to show. */
export type KindFilter = 'all' | EntryKind;

export interface Ism {
  id: string;
  kind: EntryKind;
  ownerId: string;
  lovedOneId: string;
  /** Stories only: a short title, e.g. "The summer we drove to Memphis". */
  title?: string;
  /** For a quote, the words as they used to say it; for a story, the story itself. */
  text: string;
  /** Quotes only: when or why they'd say it. */
  context?: string;
  topics: string[];
  /** Keeps a single ism private even when the loved one is shared. */
  keepPrivate?: boolean;
  reviewStatus?: ReviewStatus;
  createdAt: number;
}

/** The fields a person fills in for a loved one. */
export type LovedOneInput = Omit<LovedOne, 'id' | 'ownerId' | 'createdAt' | 'photoPath' | 'photoUri' | 'reviewStatus'>;
/** The fields a person fills in for a quote or story. */
export type IsmInput = Omit<Ism, 'id' | 'ownerId' | 'createdAt' | 'reviewStatus'>;

export interface Settings {
  displayName: string;
  defaultScope: Scope;
}

/** The name other people see. */
export interface Profile {
  id: string;
  displayName: string;
  /** Your own profile only: whether others can find you by name or in their contacts. */
  discoverable?: boolean;
}

/** How you stand with someone: friends, you asked them, they asked you, or neither. */
export type Relationship = 'friends' | 'sent' | 'received' | 'none';

/** Someone found by name or in your contacts. */
export interface PersonResult {
  id: string;
  displayName: string;
  mutualFriends: number;
  relationship: Relationship;
}

/** A friend, or a request to be friends that hasn't been answered yet. */
export interface Friendship {
  /** The other person. */
  otherId: string;
  status: 'pending' | 'accepted';
  /** True when they asked you; false when you asked them. */
  incoming: boolean;
  createdAt: number;
}

/** What happened when you asked someone to be friends. */
export type FriendRequestResult =
  | { result: 'not_found' | 'self' | 'need_name' | 'too_many' }
  | { result: 'sent' | 'already_sent' | 'already_friends' | 'now_friends'; name: string };

/** Something shared that's waiting for a reviewer: held for its words, or reported. */
export interface ReviewItem {
  kind: 'ism' | 'loved_one';
  id: string;
  lovedOneId: string;
  lovedOneName: string;
  ownerName: string;
  title?: string;
  body: string;
  context?: string;
  visibility: Visibility;
  reviewStatus: ReviewStatus;
  reportCount: number;
  reasons: string[];
  createdAt: number;
}
