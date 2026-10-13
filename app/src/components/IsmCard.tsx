import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isShared } from '../lib/advice';
import { COMMUNITY_OWNER } from '../lib/seed';
import { useStore } from '../lib/store';
import { cardStyle, colors, radius, space } from '../lib/theme';
import { timeAgo } from '../lib/time';
import { topicLabel } from '../lib/topics';
import type { Ism } from '../lib/types';
import { Avatar } from './Avatar';
import { CommentButton, LikeButton } from './Reactions';
import { ReportPanel, ReviewNote } from './ReportPanel';
import { SharedBy } from './SharedBy';

/** Stories longer than this start collapsed. */
const PREVIEW_CHARS = 280;

/** Opens a quote or story on its own, with its comments. */
export const openIsm = (id: string) => router.push({ pathname: '/ism/[id]', params: { id } });

/**
 * A quote or story. `showTime` adds when it was shared, for the feed; `showAuthor` false hides whose it
 * is, on that person's own page. `inPost` is for its own page: the whole story, and no comment button
 * (the comments are right below).
 */
export function IsmCard({
  ism,
  showAuthor = true,
  showTime = false,
  inPost = false,
}: {
  ism: Ism;
  showAuthor?: boolean;
  showTime?: boolean;
  inPost?: boolean;
}) {
  const { getLovedOne, savedIsmIds, toggleSaved, userId, report } = useStore();
  const [expanded, setExpanded] = useState(inPost);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const lovedOne = getLovedOne(ism.lovedOneId);
  const mine = ism.ownerId === userId;
  const example = ism.ownerId === COMMUNITY_OWNER;
  const canReport = !!userId && !mine && !example;
  const saved = savedIsmIds.has(ism.id);
  const story = ism.kind === 'story';
  const long = story && ism.text.length > PREVIEW_CHARS && !inPost;
  const when = showTime && !example ? ` · ${timeAgo(ism.createdAt)}` : undefined;
  const target = { ismId: ism.id };

  if (reported) {
    return (
      <View style={[styles.card, styles.reported]}>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.sage} />
        <Text style={styles.reportedText}>
          Thanks for letting us know. It’s hidden for you now, and someone at Ism’s will take a look.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/loved-one/[id]', params: { id: ism.lovedOneId } })}>
      {mine && lovedOne && isShared(ism, lovedOne) ? <ReviewNote status={ism.reviewStatus} /> : null}
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
          {lovedOne && (showAuthor || showTime) ? (
            example ? (
              <Text style={styles.credit}>An example</Text>
            ) : (
              <SharedBy lovedOne={lovedOne} own={when ? 'Added by you' : undefined} after={when} style={styles.credit} />
            )
          ) : null}
          {ism.topics.length > 0 ? <Text style={styles.topics}>{ism.topics.map(topicLabel).join(' · ')}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {example ? null : (
          <>
            <LikeButton target={target} />
            {inPost ? null : <CommentButton target={target} onPress={() => openIsm(ism.id)} />}
          </>
        )}
        <View style={{ flex: 1 }} />
        {canReport && !reporting ? (
          <Pressable
            onPress={() => setReporting(true)}
            hitSlop={10}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel="Report">
            <Ionicons name="flag-outline" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            if (!toggleSaved(ism.id)) router.push('/account');
          }}
          hitSlop={10}
          style={styles.icon}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? colors.accent : colors.muted} />
        </Pressable>
      </View>
      {reporting ? (
        <ReportPanel
          onCancel={() => setReporting(false)}
          onReport={async (reason) => {
            await report({ ismId: ism.id }, reason);
            setReported(true);
          }}
        />
      ) : null}
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    marginTop: space.xs,
  },
  icon: { padding: 4 },
  reported: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sageSoft, borderColor: colors.sageSoft },
  reportedText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
});
