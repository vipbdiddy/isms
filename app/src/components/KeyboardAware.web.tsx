import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';

// Browsers keep what you're typing above the keyboard themselves, so on the web these are plain.
// See KeyboardAware.tsx for phones.

export function KeyboardRoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function KeyboardScroll(props: ScrollViewProps) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} />;
}

export function KeyboardAware({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}

export function useKeyboardShown(): boolean {
  return false;
}
