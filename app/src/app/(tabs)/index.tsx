import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { IsmCard } from '../../components/IsmCard';
import { LovedOneRow } from '../../components/LovedOneRow';
import { Button, Card, Chip, ErrorNote, ScopeToggle, TextButton, styles } from '../../components/ui';
import { feed, lovedOnesToAddTo, visibleIsms } from '../../lib/advice';
import { DONATE_URL } from '../../lib/config';
import { openWebPage } from '../../lib/share';
import { useStore } from '../../lib/store';
import { cardStyle, colors, radius, space } from '../../lib/theme';
import { TOPICS } from '../../lib/topics';
import type { Scope } from '../../lib/types';
import { useScope } from '../../lib/useScope';

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

/** How many feed entries to show at first, and how many more each "Show more" adds. */
const FEED_PAGE = 10;

const FEED_TITLES: Record<Scope, string> = {
  mine: 'Your latest',
  friends: 'Latest from you, your friends and your groups',
  everyone: 'Latest from everyone',
};

/** Why Isms exists, in its maker's words. */
const ORIGIN_STORY =
  'Isms started after my friend Bryce died unexpectedly and left behind seven young kids. I built it so they ' +
  'could still hear his voice — through the stories and advice people who knew him share. When they’re older ' +
  'and facing something hard, they can look up what their dad would have said.';

/**
 * Home, top to bottom: why Isms exists, what you can do, whose wisdom you're looking for (Ask and the
 * topics), then a word for today and the latest from you, your friends and your groups.
 */
export default function Home() {
  const {
    isms,
    lovedOnes,
    viewer,
    userId,
    friendIds,
    groups,
    savedIsmIds,
    notice,
    dismissNotice,
    isAdmin,
    reviewCount,
    loadError,
    loading,
    refresh,
  } = useStore();
  const [scope, setScope] = useScope();
  const [offset, setOffset] = useState(0);
  const [shown, setShown] = useState(FEED_PAGE);

  const pool = useMemo(() => visibleIsms(isms, lovedOnes, viewer, scope), [isms, lovedOnes, viewer, scope]);
  const items = useMemo(() => feed(isms, lovedOnes, viewer, scope), [isms, lovedOnes, viewer, scope]);
  const own = lovedOnes.filter((l) => l.ownerId === userId);
  // Same word all day, unless they ask for another.
  const todays = pool.length ? pool[(dayNumber() + offset) % pool.length] : undefined;
  const saved = isms.filter((i) => savedIsmIds.has(i.id));

  // The three things to do. With only one loved one to choose from, skip straight to it.
  const signIn = () => router.push('/account');
  const addLovedOne = () => (userId ? router.push('/loved-one/edit') : signIn());
  const shareMemory = () => {
    if (!userId) return signIn();
    const addable = lovedOnesToAddTo(lovedOnes, isms, viewer);
    if (addable.length === 1) return router.push({ pathname: '/ism/edit', params: { lovedOneId: addable[0].id } });
    router.push({ pathname: '/choose', params: { for: 'story' } });
  };
  const inviteSomeone = () => {
    if (!userId) return signIn();
    if (own.length === 1) return router.push({ pathname: '/loved-one/invite', params: { id: own[0].id } });
    router.push({ pathname: '/choose', params: { for: 'invite' } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}>
      {notice ? (
        <View style={local.banner}>
          <Text style={[styles.body, { flex: 1 }]}>{notice}</Text>
          <TextButton title="OK" onPress={dismissNotice} />
        </View>
      ) : null}
      {loadError ? <ErrorNote message={loadError} /> : null}
      {isAdmin && reviewCount > 0 ? (
        <View style={local.banner}>
          <Text style={[styles.body, { flex: 1 }]}>
            {reviewCount === 1 ? '1 shared memory is' : `${reviewCount} shared memories are`} waiting for your review.
          </Text>
          <TextButton title="Review" onPress={() => router.push('/review')} />
        </View>
      ) : null}

      <View style={local.story}>
        <Text style={local.storyHeading}>Why Isms</Text>
        <Text style={local.storyText}>{ORIGIN_STORY}</Text>
        <Pressable
          onPress={() => openWebPage(DONATE_URL)}
          hitSlop={8}
          style={local.donate}
          accessibilityRole="link"
          accessibilityHint="Opens a page about donating. It’s never required.">
          <Ionicons name="heart-outline" size={15} color={colors.accent} />
          <Text style={local.donateText}>Help keep Isms free</Text>
        </Pressable>
      </View>

      <View style={{ gap: space.sm }}>
        <Button title="Add a loved one" icon="add" onPress={addLovedOne} />
        <Button title="Share a story or quote" icon="create-outline" variant="secondary" onPress={shareMemory} />
        <Button title="Invite someone who knew them" icon="mail-outline" variant="secondary" onPress={inviteSomeone} />
      </View>

      <Text style={local.question}>Whose wisdom are you looking for today?</Text>
      <Pressable
        style={({ pressed }) => [local.ask, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/ask')}
        accessibilityRole="button">
        <View style={local.askIcon}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={local.askTitle}>What would they say?</Text>
          <Text style={styles.muted}>Tell us what you’re going through, and find what they’d tell you.</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.accent} />
      </Pressable>
      <View style={styles.wrapRow}>
        {TOPICS.map((t) => (
          <Chip key={t.id} label={t.label} onPress={() => router.push({ pathname: '/ask', params: { topic: t.id } })} />
        ))}
      </View>

      <View style={{ marginTop: space.md }}>
        <ScopeToggle
          value={scope}
          onChange={(next) => {
            setScope(next);
            setShown(FEED_PAGE);
          }}
        />
      </View>

      <Text style={styles.subheading}>A word for today</Text>
      {todays ? (
        <>
          <IsmCard ism={todays} />
          {pool.length > 1 ? (
            <View style={{ alignItems: 'center' }}>
              <TextButton title="Show me another" onPress={() => setOffset((o) => o + 1)} />
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.muted}>
          {own.length
            ? 'None of their quotes or stories are here yet. Share one above, or switch to Everyone.'
            : 'Nothing here yet. Add someone you miss above, or switch to Everyone to read what other families shared.'}
        </Text>
      )}

      {userId && scope !== 'mine' && friendIds.size === 0 && groups.length === 0 ? (
        <Card style={{ backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }}>
          <Text style={[styles.body, { fontWeight: '600' }]}>Share memories with friends</Text>
          <Text style={styles.body}>
            Add family and friends on Isms. You’ll see the loved ones they share with friends here, and they’ll see
            yours.
          </Text>
          <Button title="Add a friend" icon="person-add-outline" onPress={() => router.push('/friends')} />
        </Card>
      ) : null}

      {items.length > 0 && (
        <>
          <Text style={styles.subheading}>{FEED_TITLES[scope]}</Text>
          {items.slice(0, shown).map((item) =>
            item.type === 'ism' ? (
              <IsmCard key={item.id} ism={item.ism} showTime />
            ) : (
              <LovedOneRow key={item.id} lovedOne={item.lovedOne} at={item.at} />
            ),
          )}
          {items.length > shown ? (
            <Button title="Show more" variant="secondary" onPress={() => setShown((n) => n + FEED_PAGE)} />
          ) : null}
        </>
      )}

      {saved.length > 0 && (
        <>
          <Text style={styles.subheading}>Saved</Text>
          {saved.map((ism) => (
            <IsmCard key={ism.id} ism={ism} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 14,
    backgroundColor: colors.sageSoft,
  },
  story: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  storyHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  storyText: { fontSize: 16, lineHeight: 24, color: colors.ink },
  donate: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingTop: space.xs },
  donateText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  question: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.2, marginTop: space.md },
  ask: { ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  askIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
});
