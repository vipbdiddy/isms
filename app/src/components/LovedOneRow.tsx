import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../lib/store';
import { cardStyle, colors, space } from '../lib/theme';
import type { LovedOne, Visibility } from '../lib/types';
import { Avatar } from './Avatar';

export const SHARED_WITH: Record<Visibility, string> = {
  private: 'Only you',
  friends: 'Shared with friends',
  public: 'Shared with everyone',
};

/**
 * A loved one in a list. The last line says how many memories they have and who shared them,
 * unless `note` replaces it (the feed uses it for "Shared by Ann · 2 days ago").
 */
export function LovedOneRow({ lovedOne, count, note }: { lovedOne: LovedOne; count?: number; note?: string }) {
  const { userId, sharedBy } = useStore();
  const mine = lovedOne.ownerId === userId;
  const details = [
    count === undefined ? undefined : `${count} ${count === 1 ? 'memory' : 'memories'}`,
    mine ? SHARED_WITH[lovedOne.visibility] : sharedBy(lovedOne.ownerId),
  ].filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/loved-one/[id]', params: { id: lovedOne.id } })}>
      <Avatar lovedOne={lovedOne} size={52} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{lovedOne.name}</Text>
        {lovedOne.relationship || lovedOne.years ? (
          <Text style={styles.meta}>{[lovedOne.relationship, lovedOne.years].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <Text style={[styles.meta, styles.note]}>{note ?? details.join('  ·  ')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted },
  note: { color: colors.accent, fontWeight: '500' },
});
