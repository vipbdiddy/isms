import type { Comment } from './types.ts';

/** What a like or comment is on, as one string: "ism:<id>" or "loved-one:<id>". */
export const targetKey = (target: { ismId?: string; lovedOneId?: string }): string =>
  target.ismId ? `ism:${target.ismId}` : `loved-one:${target.lovedOneId}`;

/** Likes or comments, grouped by what they're on, in the order given. */
export function byTarget<T extends { ismId?: string; lovedOneId?: string }>(items: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = targetKey(item);
    const list = grouped.get(key);
    if (list) list.push(item);
    else grouped.set(key, [item]);
  }
  return grouped;
}

/**
 * Who liked something, for the line under a memory: "Liked by you", "Liked by Ann and Bob",
 * "Liked by you, Ann and 3 others". `others` are the other people's names ('' when not known).
 */
export function likedByLine(others: readonly string[], mine: boolean): string {
  const people = [...(mine ? ['you'] : []), ...others.map((name) => name || 'someone')];
  if (people.length === 0) return '';
  if (people.length === 1) return `Liked by ${people[0]}`;
  if (people.length <= 3) return `Liked by ${people.slice(0, -1).join(', ')} and ${people[people.length - 1]}`;
  const more = people.length - 2;
  return `Liked by ${people.slice(0, 2).join(', ')} and ${more} others`;
}

/** Comments can be deleted by whoever wrote them and by whoever shared the memory they're on. */
export function canDeleteComment(comment: Comment, userId: string, memoryOwnerId: string | undefined): boolean {
  return !!userId && (comment.authorId === userId || memoryOwnerId === userId);
}

/** Who the viewer knows: their friends, the people in their groups, and those with a public profile. */
export interface Circle {
  userId: string;
  friendIds: ReadonlySet<string>;
  /** Members of the groups the viewer is in. */
  groupmateIds: ReadonlySet<string>;
  publicProfileIds: ReadonlySet<string>;
}

/**
 * Whether the viewer may open someone's profile and see their name on what they share: their own,
 * a friend's, someone in one of their groups, or anyone with a public profile. Everyone else's
 * memories say "Shared by their family". (Names on comments and likes always show.)
 */
export function knowsSharer(personId: string, circle: Circle): boolean {
  if (!circle.userId || !personId) return false;
  return (
    personId === circle.userId ||
    circle.friendIds.has(personId) ||
    circle.groupmateIds.has(personId) ||
    circle.publicProfileIds.has(personId)
  );
}

/** How many likes or comments, for a button: '' for none, '1.2k' for many. */
export function shortCount(n: number): string {
  if (n <= 0) return '';
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
}
