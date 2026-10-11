import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { IsmCard } from '../../components/IsmCard';
import { Button, Chip, ErrorNote, ScopeToggle, styles } from '../../components/ui';
import { visibleIsms } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors, space } from '../../lib/theme';
import { TOPICS } from '../../lib/topics';
import { useScope } from '../../lib/useScope';

const dayNumber = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);

export default function Today() {
  const { isms, lovedOnes, userId, settings, savedIsmIds, notice, dismissNotice, loadError, loading, refresh } = useStore();
  const [scope, setScope] = useScope();
  const [offset, setOffset] = useState(0);

  const pool = useMemo(() => visibleIsms(isms, lovedOnes, userId, scope), [isms, lovedOnes, userId, scope]);
  const hasOwn = lovedOnes.some((l) => l.ownerId === userId);
  // Same word all day, unless they ask for another.
  const todays = pool.length ? pool[(dayNumber() + offset) % pool.length] : undefined;
  const saved = isms.filter((i) => savedIsmIds.has(i.id));

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}>
      <Text style={styles.heading}>
        {settings.displayName ? `Hi ${settings.displayName}.` : 'Hi there.'} Here's a word for today.
      </Text>
      {notice ? (
        <View style={banner}>
          <Text style={[styles.body, { flex: 1 }]}>{notice}</Text>
          <Text style={{ color: colors.accent, fontWeight: '600' }} onPress={dismissNotice}>
            OK
          </Text>
        </View>
      ) : null}
      {loadError ? <ErrorNote message={loadError} /> : null}
      <ScopeToggle value={scope} onChange={setScope} />

      {todays ? (
        <>
          <IsmCard ism={todays} />
          <Button title="Another one" variant="secondary" onPress={() => setOffset((o) => o + 1)} />
        </>
      ) : (
        <View style={{ gap: 12 }}>
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
        </View>
      )}

      <Text style={styles.subheading}>What's on your mind?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
  borderRadius: 12,
  backgroundColor: colors.sageSoft,
};
