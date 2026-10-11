export type Visibility = 'private' | 'public';

/** Whose words to draw from: only your own loved ones, or every public family too. */
export type Scope = 'mine' | 'everyone';

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
  /** Public loved ones (and their isms) are visible to every user of the app. */
  visibility: Visibility;
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
  /** Keeps a single ism private even when the loved one is shared publicly. */
  keepPrivate?: boolean;
  createdAt: number;
}

/** The fields a person fills in for a loved one. */
export type LovedOneInput = Omit<LovedOne, 'id' | 'ownerId' | 'createdAt' | 'photoPath' | 'photoUri'>;
/** The fields a person fills in for a quote or story. */
export type IsmInput = Omit<Ism, 'id' | 'ownerId' | 'createdAt'>;

export interface Settings {
  displayName: string;
  defaultScope: Scope;
}
