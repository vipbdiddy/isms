import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../lib/store';
import { colors, fonts, space } from '../lib/theme';
import { topicLabel } from '../lib/topics';
import type { Ism } from '../lib/types';
import { Avatar } from './Avatar';

/** Stories longer than this start collapsed. */
const PREVIEW_CHARS = 280;

export function IsmCard({ ism, showAuthor = true }: { ism: Ism; showAuthor?: boolean }) {
  const { getLovedOne, savedIsmIds, toggleSaved, userId } = useStore();
  const [expanded, setExpanded] = useState(false);
  const lovedOne = getLovedOne(ism.lovedOneId);
  const saved = savedIsmIds.has(ism.id);
  const mine = ism.ownerId === userId;
  const story = ism.kind === 'story';
  const long = story && ism.text.length > PREVIEW_CHARS;

  return (
    <Pressable
      style={styles.card}
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
        {showAuthor && lovedOne ? <Avatar lovedOne={lovedOne} size={32} /> : null}
        <View style={{ flex: 1 }}>
          {showAuthor && lovedOne ? (
            <Text style={styles.author}>
              {story ? 'About ' : '— '}
              {lovedOne.name}
              {mine ? '' : '  ·  shared by their family'}
            </Text>
          ) : null}
          <Text style={styles.topics}>{ism.topics.map(topicLabel).join(' · ')}</Text>
        </View>
        <Pressable
          onPress={() => {
            if (!toggleSaved(ism.id)) router.push('/account');
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}>
          <Text style={[styles.heart, saved && { color: colors.accent }]}>{saved ? '♥' : '♡'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kind: { fontSize: 11, fontWeight: '700', color: colors.sage, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: fonts.quote, fontSize: 20, fontWeight: '700', color: colors.ink },
  storyText: { fontSize: 16, lineHeight: 24, color: colors.ink },
  more: { fontSize: 14, fontWeight: '600', color: colors.accent },
  quote: { fontFamily: fonts.quote, fontSize: 19, lineHeight: 27, color: colors.ink },
  context: { fontSize: 14, color: colors.muted, fontStyle: 'italic', lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  author: { fontSize: 14, fontWeight: '600', color: colors.accent },
  topics: { fontSize: 12, color: colors.muted, marginTop: 2 },
  heart: { fontSize: 24, color: colors.muted },
});
