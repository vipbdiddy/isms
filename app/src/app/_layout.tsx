import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { KeyboardRoot } from '../components/KeyboardAware';
import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

function Root() {
  const { ready } = useStore();
  // Load the icons before showing anything, so they don't pop in. If they fail, carry on without them.
  const [iconsLoaded, iconsError] = useFonts(Ionicons.font);
  if (!ready || (!iconsLoaded && !iconsError)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="loved-one/[id]" options={{ title: '' }} />
      <Stack.Screen name="loved-one/edit" options={{ presentation: 'modal', title: 'Loved one' }} />
      <Stack.Screen name="loved-one/comments" options={{ title: 'Comments' }} />
      <Stack.Screen name="loved-one/invite" options={{ title: 'Invite people to remember' }} />
      <Stack.Screen name="choose" options={{ presentation: 'modal', title: 'Who is it about?' }} />
      <Stack.Screen name="ism/edit" options={{ presentation: 'modal', title: 'Add a memory' }} />
      <Stack.Screen name="ism/[id]" options={{ title: '' }} />
      <Stack.Screen name="person/[id]" options={{ title: '' }} />
      <Stack.Screen name="group/[id]" options={{ title: '' }} />
      <Stack.Screen name="account" options={{ presentation: 'modal', title: 'Account' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="review" options={{ title: 'Review shared memories' }} />
      <Stack.Screen name="auth-callback" options={{ title: 'Signing in' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <KeyboardRoot>
      <StoreProvider>
        <StatusBar style="dark" />
        <Root />
      </StoreProvider>
    </KeyboardRoot>
  );
}
