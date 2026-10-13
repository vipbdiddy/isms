import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { likedByLine, shortCount } from '../lib/social';
import { useStore } from '../lib/store';
import { colors, space } from '../lib/theme';
import type { Target } from '../lib/types';
import { openPerson } from './SharedBy';

/** The heart: like a quote, story or loved one, with how many people did. */
export function LikeButton({ target }: { target: Target }) {
  const { likesOn, likedByMe, toggleLike } = useStore();
  const count = likesOn(target).length;
  const liked = likedByMe(target);
  return (
    <Pressable
      onPress={() => {
        if (!toggleLike(target)) router.push('/account');
      }}
      hitSlop={10}
      style={styles.action}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={`${liked ? 'Unlike' : 'Like'}${count ? `, ${count} ${count === 1 ? 'like' : 'likes'}` : ''}`}>
      <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.heart : colors.muted} />
      <Text style={[styles.count, liked && { color: colors.heart }]}>{shortCount(count)}</Text>
    </Pressable>
  );
}

/** The speech bubble: how many comments, opening them. */
export function CommentButton({ target, onPress }: { target: Target; onPress: () => void }) {
  const { commentsOn } = useStore();
  const count = commentsOn(target).length;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.action}
      accessibilityRole="button"
      accessibilityLabel={count ? `${count} ${count === 1 ? 'comment' : 'comments'}` : 'Comment'}>
      <Ionicons name="chatbubble-outline" size={21} color={colors.muted} />
      <Text style={styles.count}>{shortCount(count)}</Text>
    </Pressable>
  );
}

/** "Liked by you, Ann and 2 others", with the names opening their profiles when there are few. */
export function LikedBy({ target }: { target: Target }) {
  const { likesOn, userId, nameOf } = useStore();
  const likes = likesOn(target);
  const others = likes.filter((l) => l.userId !== userId);
  const mine = others.length < likes.length;
  if (likes.length === 0) return null;
  const people = [...(mine ? [{ id: userId, name: 'you' }] : []), ...others.map((l) => ({ id: l.userId, name: nameOf(l.userId) }))];
  if (people.length > 3) {
    return <Text style={styles.likedBy}>{likedByLine(others.map((l) => nameOf(l.userId)), mine)}</Text>;
  }
  // Up to three people: each name opens their profile.
  return (
    <Text style={styles.likedBy}>
      {'Liked by '}
      {people.map((person, i) => (
        <Text key={person.id}>
          {i === 0 ? '' : i === people.length - 1 ? ' and ' : ', '}
          {person.id === userId ? (
            'you'
          ) : (
            <Text style={styles.name} onPress={() => openPerson(person.id)} accessibilityRole="link">
              {person.name || 'someone'}
            </Text>
          )}
        </Text>
      ))}
    </Text>
  );
}

/** Small counts for a list row: "♥ 3   💬 2". Nothing when there are none. */
export function ReactionCounts({ target }: { target: Target }) {
  const { likesOn, commentsOn } = useStore();
  const likes = likesOn(target).length;
  const comments = commentsOn(target).length;
  if (!likes && !comments) return null;
  return (
    <View style={styles.counts}>
      {likes ? (
        <View style={styles.countItem}>
          <Ionicons name="heart" size={13} color={colors.heart} />
          <Text style={styles.smallCount}>{shortCount(likes)}</Text>
        </View>
      ) : null}
      {comments ? (
        <View style={styles.countItem}>
          <Ionicons name="chatbubble" size={12} color={colors.muted} />
          <Text style={styles.smallCount}>{shortCount(comments)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingRight: space.sm, minWidth: 44 },
  count: { fontSize: 14, fontWeight: '600', color: colors.muted, minWidth: 8 },
  likedBy: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  name: { fontWeight: '700', color: colors.ink },
  counts: { flexDirection: 'row', gap: space.md },
  countItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  smallCount: { fontSize: 12, color: colors.muted, fontWeight: '600' },
});
