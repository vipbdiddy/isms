import { router } from 'expo-router';
import { Fragment } from 'react';
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
 *
 * `authorId` is who added a quote or story, when that's someone other than whoever added the loved
 * one. Their name always shows (as with comments), or "someone who knew them" until it loads.
 * `groupIds` are the groups a quote or story is shared with on its own; without them, it's the loved
 * one's group.
 */
export function SharedBy({
  lovedOne,
  authorId,
  groupIds,
  own,
  after,
  style,
}: {
  lovedOne: Pick<LovedOne, 'ownerId' | 'visibility' | 'groupId'>;
  authorId?: string;
  groupIds?: string[];
  own?: string;
  /** Added at the end, like " · 2 hr ago". */
  after?: string;
  style?: TextStyle;
}) {
  const { userId, knows, nameOf, sharedBy, getGroup } = useStore();
  const ownerId = authorId ?? lovedOne.ownerId;
  const addedByOther = ownerId !== lovedOne.ownerId;
  // Only the viewer's own groups are known; others aren't named.
  const groups = (groupIds ?? (lovedOne.visibility === 'group' && lovedOne.groupId ? [lovedOne.groupId] : []))
    .map((id) => getGroup(id))
    .filter((g) => g !== undefined);
  const groupLink = groups.length ? (
    <>
      {' in '}
      {groups.map((group, i) => (
        <Fragment key={group.id}>
          {i === 0 ? '' : i === groups.length - 1 ? ' and ' : ', '}
          <Text style={link} onPress={() => openGroup(group.id)} accessibilityRole="link">
            {group.name}
          </Text>
        </Fragment>
      ))}
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
  if (!name || (!addedByOther && !knows(ownerId))) {
    return (
      <Text style={style}>
        {addedByOther ? 'Shared by someone who knew them' : sharedBy(ownerId)}
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
