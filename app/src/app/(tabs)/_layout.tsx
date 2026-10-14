import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, router } from 'expo-router';
import { Pressable, useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '../../components/Logo';
import type { IconName } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
  };

/** Home's header: the logo, a little bigger on wide screens. */
function HomeTitle() {
  const { width } = useWindowDimensions();
  return <Logo height={width >= 768 ? 54 : 46} />;
}

function SettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={12}
      style={{ paddingHorizontal: 16 }}
      accessibilityRole="button"
      accessibilityLabel="Settings">
      <Ionicons name="settings-outline" size={22} color={colors.ink} />
    </Pressable>
  );
}

export default function TabsLayout() {
  const { friendships, groupInvites } = useStore();
  const insets = useSafeAreaInsets();
  // Friend requests and group invitations waiting for an answer.
  const requests = friendships.filter((f) => f.status === 'pending' && f.incoming).length + groupInvites.length;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        headerShadowVisible: false,
        headerRight: SettingsButton,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        // A little taller than the default, so the labels have room; the phone's own bottom edge comes on top.
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 60 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: '#fff' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: HomeTitle,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.background, height: 72 + insets.top },
          tabBarIcon: icon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          headerTitle: 'What would they say?',
          tabBarIcon: icon('chatbubble-ellipses-outline', 'chatbubble-ellipses'),
        }}
      />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: icon('search-outline', 'search') }} />
      <Tabs.Screen name="people" options={{ title: 'Loved ones', tabBarIcon: icon('heart-outline', 'heart') }} />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: icon('people-outline', 'people'),
          tabBarBadge: requests > 0 ? requests : undefined,
        }}
      />
    </Tabs>
  );
}
