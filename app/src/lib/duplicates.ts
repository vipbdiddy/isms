import type { LovedOne } from './types.ts';

/** What someone types when adding a loved one; enough to tell whether they're already here. */
export interface LovedOneDraft {
  name: string;
  years?: string;
  obituary?: string;
}

/**
 * Words that say how someone was related or addressed rather than who they were,
 * so "Grandma Ruth" and "Ruth Hadley" can still be recognized as the same Ruth.
 */
const TITLES = new Set(
  (
    'grandma grandpa grandmother grandfather granny grammy gramma grampa gramps gran nana nanna papa pappy ' +
    'pop pops poppa poppy mom mother mama momma mommy mum mummy dad father daddy aunt auntie aunty uncle ' +
    'cousin sister brother sis bro great big little mr mrs ms miss mister dr doctor rev reverend pastor ' +
    'sr jr ii iii iv the my our'
  ).split(' '),
);

/** Common obituary words that say nothing about who someone was. */
const OBITUARY_FILLER = new Set(
  (
    'the and was were her his she him their they with for from that this who had has have are been will ' +
    'also all many one two three four five six seven eight nine ten years year age aged old passed away ' +
    'died death peacefully surrounded survived preceded born beloved loving loved family families ' +
    'children grandchildren great husband wife son sons daughter daughters brother brothers sister sisters ' +
    'mother father parents friends friend home life lived married funeral service services memorial held ' +
    'church will lieu flowers donations may made our its into over after before when where which while ' +
    'not but out about more most other some such than then there these those through very'
  ).split(' '),
);

/** Lower case, without accents or punctuation, so "José O'Neil" and "jose oneil" compare equal. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameWords(name: string): string[] {
  return plain(name)
    .split(' ')
    .filter((w) => w && !TITLES.has(w) && !/^\d+$/.test(w));
}

/** "E" matches "Ellen", so middle initials don't hide a match. */
const sameWord = (a: string, b: string) =>
  a === b || (a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b));

/**
 * 'strong' when two or more real names line up ("Ruth Hadley" and "Ruth Ellen Hadley"),
 * 'weak' when only one does ("Grandma Ruth" and "Ruth Hadley").
 */
function compareNames(a: string[], b: string[]): 'strong' | 'weak' | 'none' {
  if (a.length === 0 || b.length === 0) return 'none';
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (!shorter.every((w) => longer.some((other) => sameWord(w, other)))) return 'none';
  const realNames = shorter.filter((w) => w.length > 1).length;
  return realNames >= 2 ? 'strong' : realNames === 1 ? 'weak' : 'none';
}

function yearsIn(text?: string): Set<string> {
  return new Set(text?.match(/\b(1[89]\d\d|20\d\d)\b/g) ?? []);
}

/** The same when one list of years contains the other ("2018" and "1931 – 2018"). */
function compareYears(a: Set<string>, b: Set<string>): 'same' | 'different' | 'unknown' {
  if (a.size === 0 || b.size === 0) return 'unknown';
  const [fewer, more] = a.size <= b.size ? [a, b] : [b, a];
  return [...fewer].every((y) => more.has(y)) ? 'same' : 'different';
}

function obituaryWords(text?: string): Set<string> {
  if (!text) return new Set();
  return new Set(plain(text).split(' ').filter((w) => w.length > 2 && !OBITUARY_FILLER.has(w)));
}

/** How much of the shorter obituary also appears in the longer one, from 0 to 1. */
function obituaryOverlap(a: Set<string>, b: Set<string>): number {
  const smaller = Math.min(a.size, b.size);
  if (smaller < 8) return 0;
  const [few, many] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const w of few) if (many.has(w)) shared++;
  return shared / smaller;
}

/**
 * People already in Ism's who look like the one being added: the same name with the same years
 * or a similar obituary, the same full name, or the same obituary. Different years rule a match out.
 * Best matches first.
 */
export function findPossibleDuplicates(draft: LovedOneDraft, candidates: LovedOne[], limit = 3): LovedOne[] {
  const name = nameWords(draft.name);
  const years = yearsIn(draft.years);
  const obituary = obituaryWords(draft.obituary);

  return candidates
    .map((lovedOne) => {
      const names = compareNames(name, nameWords(lovedOne.name));
      const sameYears = compareYears(years, yearsIn(lovedOne.years));
      const overlap = obituaryOverlap(obituary, obituaryWords(lovedOne.obituary));
      if (sameYears === 'different') return null;
      const sameObituary = overlap >= 0.85;
      const similarObituary = overlap >= 0.6;
      const match =
        sameObituary ||
        names === 'strong' ||
        (names === 'weak' && (sameYears === 'same' || similarObituary));
      if (!match) return null;
      const score =
        (sameObituary ? 4 : similarObituary ? 2 : 0) +
        (sameYears === 'same' ? 2 : 0) +
        (names === 'strong' ? 2 : names === 'weak' ? 1 : 0);
      return { lovedOne, score };
    })
    .filter((m): m is { lovedOne: LovedOne; score: number } => m !== null)
    .sort((a, b) => b.score - a.score || b.lovedOne.createdAt - a.lovedOne.createdAt)
    .slice(0, limit)
    .map((m) => m.lovedOne);
}
