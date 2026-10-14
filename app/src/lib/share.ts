import * as WebBrowser from 'expo-web-browser';
import { Platform, Share } from 'react-native';

/**
 * Shares a message (an invitation with a link): the phone's share sheet, or a browser's when it has one.
 * Browsers without one (most computers) copy the message instead, to paste into an email or text.
 */
export async function shareMessage(message: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
        // Some browsers turn sharing down (inside another app, say). Copy it instead.
      }
    }
    if (!nav?.clipboard) throw new Error('This browser can’t share or copy');
    await nav.clipboard.writeText(message);
    return 'copied';
  }
  const result = await Share.share({ message });
  return result.action === Share.sharedAction ? 'shared' : 'cancelled';
}

/** Opens a page on the web: inside the app on phones, in a new tab in a browser. */
export function openWebPage(url: string) {
  return WebBrowser.openBrowserAsync(url).catch((e) => console.warn('Could not open', url, e));
}
