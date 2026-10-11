/** Pull a query or fragment parameter out of a URL (React Native's URL has no searchParams). */
function param(url: string, name: string): string | undefined {
  const match = url.match(new RegExp(`[?&#]${name}=([^&#]*)`));
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : undefined;
}

/** What a link back into the app says: a code to sign in with, or why it failed. */
export function readAuthLink(url: string): { code?: string; error?: string } {
  return {
    code: param(url, 'code'),
    error: param(url, 'error_description') ?? param(url, 'error'),
  };
}
