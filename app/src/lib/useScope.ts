import { useState } from 'react';

import { useStore } from './store';
import type { Scope } from './types';

/** Per-screen scope that starts at the user's default until they flip it. */
export function useScope(): [Scope, (scope: Scope) => void] {
  const { settings } = useStore();
  const [picked, setPicked] = useState<Scope | null>(null);
  return [picked ?? settings.defaultScope, setPicked];
}
