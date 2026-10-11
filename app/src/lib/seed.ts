import type { Ism, LovedOne } from './types';

/**
 * Example public families so "Everyone" isn't empty on first launch.
 * Once the app has a shared backend these come from other users instead.
 */
export const COMMUNITY_OWNER = 'community';

const lovedOne = (
  id: string,
  name: string,
  relationship: string,
  years: string,
  about: string,
  obituary: string,
): LovedOne => ({
  id,
  ownerId: COMMUNITY_OWNER,
  name,
  relationship,
  years,
  about,
  obituary,
  visibility: 'public',
  createdAt: 0,
});

let n = 0;
const ism = (lovedOneId: string, text: string, topics: string[], context?: string): Ism => ({
  id: `seed-ism-${++n}`,
  kind: 'quote',
  ownerId: COMMUNITY_OWNER,
  lovedOneId,
  text,
  context,
  topics,
  createdAt: n,
});

const story = (lovedOneId: string, title: string, text: string, topics: string[]): Ism => ({
  id: `seed-ism-${++n}`,
  kind: 'story',
  ownerId: COMMUNITY_OWNER,
  lovedOneId,
  title,
  text,
  topics,
  createdAt: n,
});

export const SEED_LOVED_ONES: LovedOne[] = [
  lovedOne('seed-ruth', 'Grandma Ruth', 'Grandmother', '1931 – 2018', 'Raised six kids on a farm in Iowa. Never sat down during a holiday dinner.',
    'Ruth Ellen Hadley, 87, of Story County, Iowa, passed away peacefully at home surrounded by family. Born on the family farm in 1931, she married Walter Hadley in 1950 and together they raised six children. Ruth taught Sunday school for forty years, won the county fair pie contest more times than anyone could count, and never let a visitor leave hungry. She is survived by her six children, nineteen grandchildren and eleven great-grandchildren.'),
  lovedOne('seed-earl', 'Pop Earl', 'Father', '1948 – 2021', 'Machinist, fisherman, terrible singer, great dad.',
    'Earl James Whitaker, 73, of Toledo, Ohio, died after a short illness. Earl worked as a machinist at the same shop for 38 years and spent every free weekend on Lake Erie. He coached Little League for two decades and could fix anything with a roll of duct tape. He is survived by his wife of 50 years, Linda, his three children and seven grandchildren.'),
  lovedOne('seed-mae', 'Aunt Mae', 'Aunt', '1960 – 2023', 'Nurse for 35 years. The one everybody called first.',
    'Mae Louise Carter, 63, of Atlanta, Georgia, passed away surrounded by the people she cared for all her life. Mae was a pediatric nurse at Grady Memorial for 35 years and volunteered at the free clinic on weekends. She is survived by her sisters, Joyce and Denise, and a large family of nieces and nephews who called her their second mother.'),
];

export const SEED_ISMS: Ism[] = [
  ism('seed-ruth', "Worry is a rocking chair. Gives you something to do, but it don't get you anywhere.", ['courage', 'hard-times'], 'Whenever any of us paced the kitchen.'),
  ism('seed-ruth', 'Feed people first. Then argue.', ['family', 'forgiveness'], 'Every Thanksgiving, without fail.'),
  ism('seed-ruth', "You don't have to like everybody. You do have to be kind to them.", ['forgiveness', 'everyday']),
  ism('seed-ruth', 'Save a little out of every check, even if it\'s a dollar. Especially if it\'s a dollar.', ['money']),
  ism('seed-ruth', "The ones who love you will wait for you to catch up.", ['grief', 'family', 'love']),
  ism('seed-earl', 'Measure twice, cut once — and that goes for words, too.', ['forgiveness', 'everyday', 'work'], 'From the shop, but he used it for everything.'),
  ism('seed-earl', "Show up early, leave last, and nobody can say you didn't earn it.", ['work', 'self-worth']),
  ism('seed-earl', "Bad days are just the ones that make good stories later.", ['hard-times', 'humor']),
  ism('seed-earl', "Don't ever lend money you need back. Give it, or don't.", ['money', 'family']),
  ism('seed-earl', "If you're scared, do it scared.", ['courage'], 'Said it on my first day of school and again before my wedding.'),
  ism('seed-earl', 'Fish are like problems — they bite when you stop staring at the water.', ['humor', 'hard-times']),
  ism('seed-mae', 'Drink some water and go to bed. Everything looks different in the morning.', ['health', 'hard-times']),
  ism('seed-mae', "Grief is just love with nowhere to go. So give it somewhere to go.", ['grief', 'love'], 'At Uncle Joe\'s service.'),
  ism('seed-mae', "Anybody who makes you feel small isn't big enough for you.", ['self-worth', 'love']),
  ism('seed-mae', 'Kids remember how you made them feel, not what you bought them.', ['parenting', 'money']),
  ism('seed-mae', 'Celebrate the little wins. The big ones are made of them.', ['celebration', 'work']),
  story(
    'seed-ruth',
    'The pie that lost',
    "The one year Grandma's pie didn't win at the county fair, we all expected her to be upset. Instead she walked over to the woman who beat her, asked for the recipe, and the two of them traded recipes by mail for the next twenty years. When I asked her why she wasn't mad, she said, \"Losing just means somebody else has something to teach you.\"",
    ['self-worth', 'forgiveness', 'everyday'],
  ),
  story(
    'seed-earl',
    'The night the boat died',
    "Dad's motor quit two miles out on Lake Erie with a storm coming in. I was eleven and terrified. He didn't raise his voice once. He handed me an oar, said \"Well, we row,\" and sang the worst version of \"Sloop John B\" you ever heard the whole way back. It took three hours. I don't remember being scared after the first ten minutes.",
    ['courage', 'hard-times', 'humor'],
  ),
  story(
    'seed-mae',
    'Her last shift',
    "On her last day before retiring, Aunt Mae stayed four hours past her shift with a little boy whose parents couldn't get there in time. The nurses tried to send her home for her own party. She told them the party could wait, because nobody should wake up scared and alone. We ate cold cake at midnight and she said it was the best party she ever had.",
    ['grief', 'love', 'work'],
  ),
];
