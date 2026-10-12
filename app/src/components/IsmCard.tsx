import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../lib/store';
import { cardStyle, colors, radius, space } from '../lib/theme';
import { timeAgo } from '../lib/time';
import { topicLabel } from '../lib/topics';
import type { Ism } from '../lib/types';
import { Avatar } from './Avatar';

/** Stories longer than this start collapsed. */
const PREVIEW_CHARS = 280;

/**
 * A quote or story. `showTime` adds when it was shared, for the feed;
 * `showAuthor` false hides whose it is, on that person's own page.
 */
export function IsmCard({ ism, showAuthor = true, showTime = false }: { ism: Ism; showAuthor?: boolean; showTime?: boolean }) {
  const { getLovedOne, savedIsmIds, toggleSaved, sharedBy } = useStore();
  const [expanded, setExpanded] = useState(false);
  const lovedOne = getLovedOne(ism.lovedOneId);
  const saved = savedIsmIds.has(ism.id);
  const story = ism.kind === 'story';
  const long = story && ism.text.length > PREVIEW_CHARS;
  const byWhom = sharedBy(ism.ownerId);
  const when = showTime && byWhom !== 'An example' ? timeAgo(ism.createdAt) : undefined;
  const credit = [byWhom ?? (when ? 'Added by you' : undefined), when].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/loved-one/[id]', params: { id: ism.lovedOneId } })}>
      {story ? (
        <>
          <Text style={styles.kind}>Story</Text>
          {ism.title ? <Text style={styles.title}>{ism.title}</Text> : null}
          <Text style={styles.storyText} numberOfLines={long && !expanded ? 6 : undefined}>
            {ism.text}
          </Text>
          {long && (
            <Text style={styles.more} onPress={() => setExpanded((e) => !e)}>
              {expanded ? 'Show less' : 'Read the whole story'}
            </Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.quote}>“{ism.text}”</Text>
          {ism.context ? <Text style={styles.context}>{ism.context}</Text> : null}
        </>
      )}
      <View style={styles.footer}>
        {showAuthor && lovedOne ? <Avatar lovedOne={lovedOne} size={36} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          {showAuthor && lovedOne ? (
            <Text style={styles.author}>
              {story ? 'About ' : ''}
              {lovedOne.name}
            </Text>
          ) : null}
          {credit && (showAuthor || showTime) ? <Text style={styles.credit}>{credit}</Text> : null}
          {ism.topics.length > 0 ? <Text style={styles.topics}>{ism.topics.map(topicLabel).join(' · ')}</Text> : null}
        </View>
        <Pressable
          onPress={() => {
            if (!toggleSaved(ism.id)) router.push('/account');
          }}
          hitSlop={12}
          style={styles.heart}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={24} color={saved ? colors.accent : colors.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...cardStyle, padding: space.lg, gap: space.sm },
  kind: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: colors.sage,
    backgroundColor: colors.sageSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    overflow: 'hidden',
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  storyText: { fontSize: 16, lineHeight: 24, color: colors.ink },
  more: { fontSize: 14, fontWeight: '600', color: colors.accent },
  quote: { fontSize: 19, lineHeight: 27, fontWeight: '500', color: colors.ink, letterSpacing: -0.1 },
  context: { fontSize: 14, color: colors.muted, fontStyle: 'italic', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  author: { fontSize: 14, fontWeight: '600', color: colors.ink },
  credit: { fontSize: 12, color: colors.accent, fontWeight: '500' },
  topics: { fontSize: 12, color: colors.muted },
  heart: { padding: 2 },
});
