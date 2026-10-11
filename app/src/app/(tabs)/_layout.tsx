import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { colors } from '../../lib/theme';

const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.ink },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('☀') }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', headerTitle: 'What would they say?', tabBarIcon: icon('✎') }} />
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: icon('❝') }} />
      <Tabs.Screen name="people" options={{ title: 'Loved ones', tabBarIcon: icon('♥') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
