import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardStyle, colors, space } from '../lib/theme';
import { Avatar } from './Avatar';
import { openPerson } from './SharedBy';

/**
 * Someone in a list of people: their initial, name and a note, with an action beside or below.
 * With `personId`, tapping them opens their profile.
 */
export function PersonRow({
  name,
  note,
  action,
  children,
  personId,
}: {
  name: string;
  note?: string;
  /** Shown to the right, like an "Add friend" button. */
  action?: ReactNode;
  /** Shown underneath, like Accept and Decline. */
  children?: ReactNode;
  personId?: string;
}) {
  const top = (
    <>
      <Avatar lovedOne={{ name: name || '?' }} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{name || 'Someone'}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {action}
    </>
  );
  return (
    <View style={styles.person}>
      {personId ? (
        <Pressable
          style={({ pressed }) => [styles.top, pressed && { opacity: 0.8 }]}
          onPress={() => openPerson(personId, name)}
          accessibilityRole="link"
          accessibilityHint="Opens their profile">
          {top}
        </Pressable>
      ) : (
        <View style={styles.top}>{top}</View>
      )}
      {children}
    </View>
  );
}

export const mutualFriendsNote = (n: number) => (n > 0 ? `${n} mutual ${n === 1 ? 'friend' : 'friends'}` : undefined);

const styles = StyleSheet.create({
  person: { ...cardStyle, padding: space.md, gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
