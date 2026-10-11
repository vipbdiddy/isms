import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { StoreProvider, useStore } from '../lib/store';
import { colors } from '../lib/theme';

function Root() {
  const { ready } = useStore();
  if (!ready) {
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
        headerTitleStyle: { color: colors.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="loved-one/[id]" options={{ title: '' }} />
      <Stack.Screen name="loved-one/edit" options={{ presentation: 'modal', title: 'Loved one' }} />
      <Stack.Screen name="ism/edit" options={{ presentation: 'modal', title: 'Add a memory' }} />
      <Stack.Screen name="account" options={{ presentation: 'modal', title: 'Account' }} />
      <Stack.Screen name="auth-callback" options={{ title: 'Signing in' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Root />
    </StoreProvider>
  );
}
