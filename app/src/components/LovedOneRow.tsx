import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space } from '../lib/theme';
import { Avatar } from './Avatar';
import type { LovedOne } from '../lib/types';

export function LovedOneRow({ lovedOne, count, mine }: { lovedOne: LovedOne; count: number; mine: boolean }) {
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/loved-one/[id]', params: { id: lovedOne.id } })}>
      <Avatar lovedOne={lovedOne} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{lovedOne.name}</Text>
        <Text style={styles.meta}>
          {[lovedOne.relationship, lovedOne.years].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.meta}>
          {count} {count === 1 ? 'memory' : 'memories'}
          {mine ? `  ·  ${lovedOne.visibility === 'public' ? 'Shared publicly' : 'Private to you'}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 28, color: colors.muted },
});
