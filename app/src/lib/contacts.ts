import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { Platform } from 'react-native';

/** Phones have contacts; the web version doesn't. */
export const contactsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/** The most email addresses checked at once (the server refuses more). */
const MAX_EMAILS = 5000;

/** Lower case, without spaces, so the same address always gives the same hash. */
export function normalizeEmail(address: string): string | undefined {
  const email = address.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

/**
 * Asks for permission, then reads the email addresses in the phone's contacts and returns their
 * SHA-256 hashes. Only the hashes leave the phone; names and numbers are never read.
 * Returns null when permission was refused.
 */
export async function contactEmailHashes(): Promise<string[] | null> {
  const { granted } = await requestPermissionsAsync();
  if (!granted) return null;
  const contacts = await Contact.getAllDetails([ContactField.EMAILS] as const);
  const emails = new Set<string>();
  for (const contact of contacts) {
    for (const entry of contact.emails ?? []) {
      const email = entry.address ? normalizeEmail(entry.address) : undefined;
      if (email) emails.add(email);
    }
  }
  return Promise.all(
    [...emails]
      .slice(0, MAX_EMAILS)
      .map(async (email) => (await digestStringAsync(CryptoDigestAlgorithm.SHA256, email)).toLowerCase()),
  );
}
