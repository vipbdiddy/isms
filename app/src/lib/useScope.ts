import { useState } from 'react';

import { useStore } from './store';
import type { Scope } from './types';

/**
 * Per-screen scope that starts at the user's default until they flip it.
 * Signed out, only what's shared with everyone can be shown, so it starts there.
 */
export function useScope(): [Scope, (scope: Scope) => void] {
  const { settings, userId } = useStore();
  const [picked, setPicked] = useState<Scope | null>(null);
  return [picked ?? (userId ? settings.defaultScope : 'everyone'), setPicked];
}
