import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { IsmCard } from '../../components/IsmCard';
import { LovedOneRow } from '../../components/LovedOneRow';
import { Button, Card, Chip, ErrorNote, ScopeToggle, TextButton, styles } from '../../components/ui';
import { feed, visibleIsms } from '../../lib/advice';
import { COMMUNITY_OWNER } from '../../lib/seed';
import { useStore } from '../../lib/store';
import { colors, space } from '../../lib/theme';
import { timeAgo } from '../../lib/time';
import { TOPICS } from '../../lib/topics';
import type { Scope } from '../../lib/types';
import { useScope } from '../../lib/useScope';

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

/** How many feed entries to show at first, and how many more each "Show more" adds. */
const FEED_PAGE = 10;

const FEED_TITLES: Record<Scope, string> = {
  mine: 'Your latest',
  friends: 'Latest from you and your friends',
  everyone: 'Latest from everyone',
};

export default function Home() {
  const {
    isms,
    lovedOnes,
    viewer,
    userId,
    profile,
    friendIds,
    settings,
    savedIsmIds,
    sharedBy,
    notice,
    dismissNotice,
    loadError,
    loading,
    refresh,
  } = useStore();
  const [scope, setScope] = useScope();
  const [offset, setOffset] = useState(0);
  const [shown, setShown] = useState(FEED_PAGE);

  const pool = useMemo(() => visibleIsms(isms, lovedOnes, viewer, scope), [isms, lovedOnes, viewer, scope]);
  const items = useMemo(() => feed(isms, lovedOnes, viewer, scope), [isms, lovedOnes, viewer, scope]);
  const hasOwn = lovedOnes.some((l) => l.ownerId === userId);
  // Same word all day, unless they ask for another.
  const todays = pool.length ? pool[(dayNumber() + offset) % pool.length] : undefined;
  const saved = isms.filter((i) => savedIsmIds.has(i.id));
  const firstName = (profile?.displayName || settings.displayName).trim().split(/\s+/)[0];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}>
      <Text style={styles.heading}>{firstName ? `Hi ${firstName}.` : 'Hi there.'}</Text>
      {notice ? (
        <View style={banner}>
          <Text style={[styles.body, { flex: 1 }]}>{notice}</Text>
          <TextButton title="OK" onPress={dismissNotice} />
        </View>
      ) : null}
      {loadError ? <ErrorNote message={loadError} /> : null}
      <ScopeToggle
        value={scope}
        onChange={(next) => {
          setScope(next);
          setShown(FEED_PAGE);
        }}
      />

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
        <Card>
          <Text style={styles.body}>
            {!userId
              ? 'Sign in to add someone you miss, the things they always used to say, and the stories you tell about them. Or switch to Everyone to read what other families shared.'
              : hasOwn
                ? "You haven't added any of their quotes or stories yet."
                : 'Start by adding someone you miss, then the things they always used to say and the stories you tell about them.'}
          </Text>
          <Button
            title={!userId ? 'Sign in or create an account' : hasOwn ? 'Go to your loved ones' : 'Add a loved one'}
            onPress={() => router.push(!userId ? '/account' : hasOwn ? '/people' : '/loved-one/edit')}
          />
        </Card>
      )}

      {userId && scope !== 'mine' && friendIds.size === 0 ? (
        <Card style={{ backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }}>
          <Text style={[styles.body, { fontWeight: '600' }]}>Share memories with friends</Text>
          <Text style={styles.body}>
            Add family and friends on Ism’s. You’ll see the loved ones they share with friends here, and they’ll see
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
              <LovedOneRow
                key={item.id}
                lovedOne={item.lovedOne}
                note={[
                  sharedBy(item.lovedOne.ownerId) ?? 'Added by you',
                  item.lovedOne.ownerId === COMMUNITY_OWNER ? undefined : timeAgo(item.at),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ),
          )}
          {items.length > shown ? (
            <Button title="Show more" variant="secondary" onPress={() => setShown((n) => n + FEED_PAGE)} />
          ) : null}
        </>
      )}

      <Text style={styles.subheading}>What's on your mind?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {TOPICS.map((t) => (
          <Chip key={t.id} label={t.label} onPress={() => router.push({ pathname: '/browse', params: { topic: t.id } })} />
        ))}
      </View>

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

const banner = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: space.md,
  padding: space.md,
  borderRadius: 14,
  backgroundColor: colors.sageSoft,
};
