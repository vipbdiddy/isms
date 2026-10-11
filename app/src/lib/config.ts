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
