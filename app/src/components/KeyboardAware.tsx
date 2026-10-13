import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

/**
 * A full-screen area whose bottom (like a comment box) stays above the keyboard on phones. It measures
 * how far down the screen it starts (below the header), which the keyboard's position is compared with.
 * Browsers keep the box in view themselves.
 */
export function KeyboardAware({ children }: { children: ReactNode }) {
  const ref = useRef<View>(null);
  const [top, setTop] = useState(0);
  if (Platform.OS === 'web') return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <View ref={ref} style={{ flex: 1 }} onLayout={() => ref.current?.measureInWindow((_x, y) => setTop(y))}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={top}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}
