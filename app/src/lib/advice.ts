import { TOPICS } from './topics.ts';
import type { Ism, KindFilter, LovedOne, Scope } from './types.ts';

/** Who is looking: their id ('' when signed out) and the ids of their friends. */
export interface Viewer {
  userId: string;
  friendIds: ReadonlySet<string>;
}

/**
 * Whether someone may see a loved one: always their own; otherwise only if the family shared them
 * with everyone, or with their friends and the viewer is one. Mirrors the rules in supabase/schema.sql.
 */
export function canSeeLovedOne(lovedOne: LovedOne, viewer: Viewer): boolean {
  if (lovedOne.ownerId === viewer.userId) return true;
  if (lovedOne.visibility === 'public') return true;
  return lovedOne.visibility === 'friends' && viewer.friendIds.has(lovedOne.ownerId);
}

/** Whether someone may see an ism: always their own; otherwise only if its loved one is shared with them. */
export function canSee(ism: Ism, lovedOne: LovedOne | undefined, viewer: Viewer): boolean {
  if (ism.ownerId === viewer.userId) return true;
  return !!lovedOne && !ism.keepPrivate && canSeeLovedOne(lovedOne, viewer);
}

/** Whether something added by `ownerId` belongs in a scope. Each scope includes the one before it. */
export function inScope(ownerId: string, viewer: Viewer, scope: Scope): boolean {
  if (scope === 'everyone' || ownerId === viewer.userId) return true;
  return scope === 'friends' && viewer.friendIds.has(ownerId);
}

export function visibleIsms(isms: Ism[], lovedOnes: LovedOne[], viewer: Viewer, scope: Scope): Ism[] {
  const byId = new Map(lovedOnes.map((l) => [l.id, l]));
  return isms.filter(
    (ism) => canSee(ism, byId.get(ism.lovedOneId), viewer) && inScope(ism.ownerId, viewer, scope),
  );
}

/** One entry in the home feed: a new quote or story, or a newly added loved one. */
export type FeedItem =
  | { type: 'ism'; id: string; at: number; ism: Ism }
  | { type: 'lovedOne'; id: string; at: number; lovedOne: LovedOne };

/** Everything in a scope that the viewer may see, newest first. */
export function feed(isms: Ism[], lovedOnes: LovedOne[], viewer: Viewer, scope: Scope): FeedItem[] {
  const people: FeedItem[] = lovedOnes
    .filter((l) => canSeeLovedOne(l, viewer) && inScope(l.ownerId, viewer, scope))
    .map((l) => ({ type: 'lovedOne', id: `loved-one-${l.id}`, at: l.createdAt, lovedOne: l }));
  const memories: FeedItem[] = visibleIsms(isms, lovedOnes, viewer, scope).map((ism) => ({
    type: 'ism',
    id: `ism-${ism.id}`,
    at: ism.createdAt,
    ism,
  }));
  return [...memories, ...people].sort((a, b) => b.at - a.at);
}

export function matchesKind(ism: Ism, filter: KindFilter): boolean {
  return filter === 'all' || ism.kind === filter;
}

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
}

/** Guess which topics a free-text description of someone's situation touches on. */
export function detectTopics(situation: string): string[] {
  let text = normalize(situation);
  const found = new Set<string>();
  // Longest phrases first, removing each match, so "broke up" doesn't also count as "broke".
  for (const [kw, topicId] of KEYWORDS) {
    if (text.includes(` ${kw} `)) {
      found.add(topicId);
      text = text.replaceAll(` ${kw} `, ' | ');
    }
  }
  return TOPICS.map((t) => t.id).filter((id) => found.has(id));
}

const KEYWORDS: [string, string][] = TOPICS.flatMap((t) =>
  t.keywords.map((kw): [string, string] => [kw, t.id]),
).sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);

const STOP_WORDS = new Set(
  ('a about after again all am an and any are as at be because been being but by can could did do does ' +
    'doing don dont for from had has have having he her here hers him his how i im if in into is it its ' +
    'ive just know like me more my myself no not now of off on once only or other our out over own really ' +
    'same she should so some such than that the their them then there these they this those through to too ' +
    'under up very was we were what when where which while who why will with would you your feel feeling ' +
    'going get got want need today right thing things think').split(' '),
);

function meaningfulWords(text: string): Set<string> {
  return new Set(
    normalize(text)
      .trim()
      .split(' ')
      .map((w) => w.replace(/'/g, ''))
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

export interface AdviceMatch {
  ism: Ism;
  score: number;
}

/**
 * Rank isms for someone's situation. Topic matches (picked or detected) weigh most;
 * shared words between the situation and the ism or its story break ties.
 */
export function findAdvice(
  situation: string,
  pickedTopics: string[],
  isms: Ism[],
  userId: string,
): AdviceMatch[] {
  const topics = new Set([...pickedTopics, ...detectTopics(situation)]);
  const words = meaningfulWords(situation);
  if (topics.size === 0 && words.size === 0) return [];

  return isms
    .map((ism) => {
      let score = ism.topics.filter((t) => topics.has(t)).length * 3;
      const ismWords = meaningfulWords(`${ism.title ?? ''} ${ism.text} ${ism.context ?? ''}`);
      for (const w of words) if (ismWords.has(w)) score += 1;
      return { ism, score };
    })
    .filter((m) => m.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.ism.ownerId === userId) - Number(a.ism.ownerId === userId) ||
        b.ism.createdAt - a.ism.createdAt,
    );
}
