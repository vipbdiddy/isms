import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

// Browsers keep what you're typing above the keyboard themselves, so on the web these are plain.
// See KeyboardAware.tsx for phones.

export function KeyboardRoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function KeyboardScroll(props: ScrollViewProps) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} />;
}

export function useKeyboardShown(): boolean {
  return false;
}
