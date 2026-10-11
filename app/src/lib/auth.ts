import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { readAuthLink } from './authLink';
import type { SocialProvider } from './config';
import { supabase } from './supabase';

/** Where links in sign-in emails and social sign-in send people back to: isms://<path>. */
const backToApp = (path: 'auth-callback' | 'reset-password') => Linking.createURL(path);

// A link back into the app carries a one-time code. On Android both the browser hand-off and the
// app's own link handling can see the same link, so each code is exchanged for a session only once.
const exchanges = new Map<string, Promise<void>>();
function exchangeCodeOnce(code: string): Promise<void> {
  let pending = exchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) throw error;
    });
    exchanges.set(code, pending);
  }
  return pending;
}

/** Sign in with the code from a link back into the app (an email link or social sign-in). */
export { readAuthLink };

export async function finishAuthLink(link: { code?: string; error?: string }) {
  if (link.error) throw new Error(link.error);
  if (!link.code) throw new Error('That link didn’t include a sign-in. Ask for a new one.');
  await exchangeCodeOnce(link.code);
}

/**
 * Sign in with Google, Apple or Facebook in the phone's browser, then come back to the app.
 * Returns false if the person closed the browser without finishing.
 */
export async function signInWithProvider(provider: SocialProvider): Promise<boolean> {
  const redirectTo = backToApp('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await finishAuthLink(readAuthLink(result.url));
  return true;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/**
 * Returns true when the account is ready to use, false when the person must first open the
 * confirmation link we emailed them (only when "Confirm email" is on in Supabase).
 */
export async function signUpWithEmail(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: backToApp('auth-callback') },
  });
  if (error) throw error;
  // With email confirmation on, Supabase answers an existing address with a user that has no
  // identities (and sends nothing), so say so instead of waiting for an email that won't come.
  if (!data.session && data.user?.identities?.length === 0) throw new Error('User already registered');
  return data.session !== null;
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: backToApp('auth-callback') },
  });
  if (error) throw error;
}

/** Email a link that opens the app's "choose a new password" screen. */
export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: backToApp('reset-password') });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Turn Supabase's error messages into something a person can act on. */
export function friendlyAuthError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Check them, or reset your password.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: open the link we sent you.';
  if (/already registered|already been registered/i.test(message)) return 'There’s already an account with that email. Sign in instead.';
  if (/password should be at least/i.test(message)) return 'Use a password with at least 6 characters.';
  if (/should be different from the old password/i.test(message)) return 'Choose a password you haven’t used before.';
  if (/expired|invalid.*(otp|token)|otp_expired/i.test(message)) return 'That link has expired or was already used. Ask for a new one.';
  if (/code verifier|flow state|pkce/i.test(message)) return 'Open the link on the same phone where you asked for it.';
  if (/not authorized|error sending/i.test(message)) return 'We couldn’t send the email right now. Please try again later.';
  if (/rate limit/i.test(message)) return 'Too many tries. Wait a minute and try again.';
  if (/network|fetch/i.test(message)) return 'Couldn’t reach the server. Check your connection and try again.';
  return message;
}

/** Permanently delete the signed-in account, its photos, and everything it added. */
export async function deleteAccount(userId: string) {
  const photos = supabase.storage.from('photos');
  const { data: files } = await photos.list(userId, { limit: 1000 });
  if (files?.length) await photos.remove(files.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}
