import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { finishAuthLink, friendlyAuthError, readAuthLink } from './auth';

type Status = { state: 'working' } | { state: 'done' } | { state: 'failed'; error: string };

/**
 * Finish signing in from a link that opened the app (an email link or social sign-in).
 * The code usually arrives as a route parameter; errors can arrive after a '#', which only the full URL has.
 */
export function useAuthLink(): Status {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const url = Linking.useURL();
  const [status, setStatus] = useState<Status>({ state: 'working' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const fromParams =
      params.code || params.error ? { code: params.code, error: params.error_description ?? params.error } : null;
    const link = fromParams ?? (url ? readAuthLink(url) : null);
    if (!link) return; // The app's link hasn't been read yet.
    started.current = true;
    finishAuthLink(link)
      .then(() => setStatus({ state: 'done' }))
      .catch((e) => setStatus({ state: 'failed', error: friendlyAuthError(e) }));
  }, [params.code, params.error, params.error_description, url]);

  return status;
}
