import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COMMUNITY_OWNER } from '../lib/seed';
import { useStore } from '../lib/store';
import { cardStyle, colors, space } from '../lib/theme';
import { timeAgo } from '../lib/time';
import type { LovedOne } from '../lib/types';
import { Avatar } from './Avatar';
import { ReactionCounts } from './Reactions';
import { SharedBy } from './SharedBy';

/** Who can see your own loved one, in a few words. */
export function sharedWithLabel(lovedOne: Pick<LovedOne, 'visibility'>, groupName?: string): string {
  switch (lovedOne.visibility) {
    case 'private':
      return 'Only you';
    case 'friends':
      return 'Shared with friends';
    case 'group':
      return groupName ? `Shared with ${groupName}` : 'Shared with a group';
    case 'public':
      return 'Shared with everyone';
  }
}

/**
 * A loved one in a list. The last line says how many memories they have (`count`) and who shared them.
 * In the feed, `at` says when they were added instead, and their likes and comments are counted.
 */
export function LovedOneRow({ lovedOne, count, at }: { lovedOne: LovedOne; count?: number; at?: number }) {
  const { userId, getGroup } = useStore();
  const mine = lovedOne.ownerId === userId;
  const example = lovedOne.ownerId === COMMUNITY_OWNER;
  const memories = count === undefined ? undefined : `${count} ${count === 1 ? 'memory' : 'memories'}`;
  const when = at !== undefined && !example ? timeAgo(at) : undefined;
  const group = lovedOne.groupId ? getGroup(lovedOne.groupId) : undefined;

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
        {mine ? (
          <Text style={[styles.meta, styles.note]}>
            {[memories, when ? 'Added by you' : sharedWithLabel(lovedOne, group?.name), when].filter(Boolean).join('  ·  ')}
          </Text>
        ) : (
          <SharedBy
            lovedOne={lovedOne}
            after={[memories, when].filter(Boolean).map((part) => `  ·  ${part}`).join('')}
            style={{ ...styles.meta, ...styles.note }}
          />
        )}
        {at !== undefined && !example ? <ReactionCounts target={{ lovedOneId: lovedOne.id }} /> : null}
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
