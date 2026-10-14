/** The Supabase project that stores accounts, loved ones, quotes, stories and photos. */
export const SUPABASE_URL = 'https://bxuvjyinsaekyufrewxs.supabase.co';
/** The publishable key is meant to ship inside the app; the database rules decide what it can do. */
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_1pnPu08yeb6mIn_S5jC1eQ_2vqdLC43';

/**
 * Social sign-in buttons to show. Add a provider here only after switching it on in
 * Supabase → Authentication → Sign In / Providers, or its button will lead to an error.
 */
export const SOCIAL_PROVIDERS: SocialProvider[] = ['google'];

export type SocialProvider = 'google' | 'apple' | 'facebook';

/** The website, with the privacy policy and terms. */
export const WEBSITE = 'https://vipbdiddy.github.io/isms/';
/** The web version of the app. Links to a page in it (like a loved one's) work for anyone, signed in or not. */
export const WEB_APP_URL = 'https://vipbdiddy.github.io/isms/app';
/**
 * Where "Help keep Isms free" goes: a page on the website that explains donations. When a real donation
 * link (say, from Stripe) is ready, it goes on that page, so the app doesn't need an update.
 */
export const DONATE_URL = 'https://vipbdiddy.github.io/isms/donate';
