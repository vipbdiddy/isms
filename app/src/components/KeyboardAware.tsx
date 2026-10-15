import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { KeyboardController, KeyboardEvents, KeyboardProvider } from 'react-native-keyboard-controller';

import { colors } from '../lib/theme';

// Keeping what you're typing above the keyboard on phones. Browsers do it themselves, so the web
// version (KeyboardAware.web.tsx) is plain.

/**
 * Around the whole app. Android apps now draw behind the status and navigation bars (the keyboard
 * library is told so), so the screen no longer gets shorter when the keyboard opens, and anything at
 * the bottom ended up behind it. Instead the app ends where the keyboard begins, on every screen: a
 * box at the bottom, like the comment box, sits just above the keyboard, and a scrolling screen brings
 * the box you're typing in into view (Android does that when a scroll view gets shorter, and keeps the
 * line you're on in view as you type).
 */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge>
      <EndAtKeyboard>{children}</EndAtKeyboard>
    </KeyboardProvider>
  );
}

function EndAtKeyboard({ children }: { children: ReactNode }) {
  // Behind the keyboard as it slides in, so it matches the screens.
  return (
    <View style={{ flex: 1, paddingBottom: useKeyboardHeight(), backgroundColor: colors.background }}>{children}</View>
  );
}

/**
 * How much of the screen the keyboard covers, from the bottom edge: its full height as soon as it
 * starts to open (or changes size, like switching to emoji), and 0 as soon as it starts to close.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(() => (KeyboardController.isVisible() ? KeyboardController.state().height : 0));
  useEffect(() => {
    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', (e) => setHeight(e.height)),
      KeyboardEvents.addListener('keyboardWillHide', () => setHeight(0)),
      KeyboardEvents.addListener('keyboardDidHide', () => setHeight(0)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);
  return height;
}

/** A scrolling screen with text boxes. Taps on buttons work while the keyboard is up. */
export function KeyboardScroll(props: ScrollViewProps) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} />;
}

/** Whether the keyboard is showing. */
export function useKeyboardShown(): boolean {
  return useKeyboardHeight() > 0;
}
