import { router } from 'expo-router';
import { Text, type TextStyle } from 'react-native';

import { useStore } from '../lib/store';
import { colors } from '../lib/theme';
import type { LovedOne } from '../lib/types';

/** Opens someone's profile. */
export const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });

/** Opens a group's page. */
export const openGroup = (id: string) => router.push({ pathname: '/group/[id]', params: { id } });

/**
 * "Shared by Ann in Lee family · 2 hr ago": the name opens their profile and the group its page.
 * People whose profile you can't see read "Shared by their family". For your own, shows `own`
 * (or nothing), and `after` either way.
 */
export function SharedBy({
  lovedOne,
  own,
  after,
  style,
}: {
  lovedOne: Pick<LovedOne, 'ownerId' | 'visibility' | 'groupId'>;
  own?: string;
  /** Added at the end, like " · 2 hr ago". */
  after?: string;
  style?: TextStyle;
}) {
  const { userId, knows, nameOf, sharedBy, getGroup } = useStore();
  const { ownerId } = lovedOne;
  const group = lovedOne.visibility === 'group' && lovedOne.groupId ? getGroup(lovedOne.groupId) : undefined;
  const groupLink = group ? (
    <>
      {' in '}
      <Text style={link} onPress={() => openGroup(group.id)} accessibilityRole="link">
        {group.name}
      </Text>
    </>
  ) : null;

  if (ownerId === userId) {
    if (!own && !after) return null;
    return (
      <Text style={style}>
        {own}
        {after}
      </Text>
    );
  }
  const name = nameOf(ownerId);
  if (!knows(ownerId) || !name) {
    return (
      <Text style={style}>
        {sharedBy(ownerId)}
        {groupLink}
        {after}
      </Text>
    );
  }
  return (
    <Text style={style}>
      {'Shared by '}
      <Text style={link} onPress={() => openPerson(ownerId)} accessibilityRole="link">
        {name}
      </Text>
      {groupLink}
      {after}
    </Text>
  );
}

const link: TextStyle = { fontWeight: '700', color: colors.accent };
