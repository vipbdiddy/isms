import type { ReactNode } from 'react';
import type { ScrollViewProps } from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
  KeyboardProvider,
  useKeyboardState,
} from 'react-native-keyboard-controller';

// Keeping what you're typing above the keyboard on phones. Browsers do it themselves, so the web
// version (KeyboardAware.web.tsx) is plain.

/**
 * Around the whole app. On Android the app draws behind the status and navigation bars, which the
 * keyboard library is told, so it doesn't make room for them a second time.
 */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      {children}
    </KeyboardProvider>
  );
}

/** How far above the keyboard the line you're typing on stays. */
const ABOVE_KEYBOARD = 32;

/**
 * A screen of text boxes that scrolls: the box you're typing in moves up above the keyboard, and keeps
 * the line you're on in view as it grows.
 */
export function KeyboardScroll(props: ScrollViewProps) {
  return <KeyboardAwareScrollView bottomOffset={ABOVE_KEYBOARD} keyboardShouldPersistTaps="handled" {...props} />;
}

/** A full-screen area whose bottom (like a comment box) stays above the keyboard. */
export function KeyboardAware({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      {children}
    </KeyboardAvoidingView>
  );
}

/** Whether the keyboard is showing. */
export function useKeyboardShown(): boolean {
  return useKeyboardState((state) => state.isVisible);
}
