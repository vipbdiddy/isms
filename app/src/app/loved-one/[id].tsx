import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { IsmCard } from '../../components/IsmCard';
import { Button, Empty, KindToggle, styles } from '../../components/ui';
import { canSee, canSeeLovedOne, matchesKind } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { cardStyle, colors, space } from '../../lib/theme';
import type { KindFilter, Visibility } from '../../lib/types';

const OWN_STATUS: Record<Visibility, string> = {
  private: 'Private. Only you can see their quotes and stories.',
  friends: 'Shared with your friends. They can see their quotes and stories.',
  public: 'Shared with everyone. Anyone using Ism’s can see their quotes and stories.',
};

/** Obituaries longer than this start collapsed. */
const OBITUARY_PREVIEW_LINES = 5;

export default function LovedOneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLovedOne, isms, userId, viewer, sharedBy } = useStore();
  const [kind, setKind] = useState<KindFilter>('all');
  const [obituaryOpen, setObituaryOpen] = useState(false);
  const lovedOne = getLovedOne(id);

  if (!lovedOne || !canSeeLovedOne(lovedOne, viewer)) {
    return <Empty title="We couldn't find this person." />;
  }

  const mine = lovedOne.ownerId === userId;
  const theirs = isms.filter((i) => i.lovedOneId === id && canSee(i, lovedOne, viewer));
  const shown = theirs.filter((i) => matchesKind(i, kind));
  const add = (k: 'quote' | 'story') =>
    router.push({ pathname: '/ism/edit', params: { lovedOneId: lovedOne.id, kind: k } });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: lovedOne.name,
          headerRight: mine
            ? () => (
                <Text
                  style={{ color: colors.accent, fontSize: 16 }}
                  onPress={() => router.push({ pathname: '/loved-one/edit', params: { id: lovedOne.id } })}>
                  Edit
                </Text>
              )
            : undefined,
        }}
      />
      <View style={local.header}>
        <Avatar lovedOne={lovedOne} size={120} />
        <Text style={local.name}>{lovedOne.name}</Text>
        <Text style={styles.muted}>{[lovedOne.relationship, lovedOne.years].filter(Boolean).join(' · ')}</Text>
        {lovedOne.about ? <Text style={[styles.body, { textAlign: 'center' }]}>{lovedOne.about}</Text> : null}
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          {mine ? OWN_STATUS[lovedOne.visibility] : `${sharedBy(lovedOne.ownerId)}.`}
        </Text>
      </View>

      {lovedOne.obituary ? (
        <View style={local.obituary}>
          <Text style={styles.subheading}>Obituary</Text>
          <Text style={local.obituaryText} numberOfLines={obituaryOpen ? undefined : OBITUARY_PREVIEW_LINES}>
            {lovedOne.obituary}
          </Text>
          <Text style={local.more} onPress={() => setObituaryOpen((o) => !o)}>
            {obituaryOpen ? 'Show less' : 'Read the full obituary'}
          </Text>
        </View>
      ) : null}

      {mine && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Quote" icon="add" onPress={() => add('quote')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Story" icon="add" onPress={() => add('story')} />
          </View>
        </View>
      )}

      {theirs.length > 0 && <KindToggle value={kind} onChange={setKind} />}

      {shown.length === 0 ? (
        <Empty
          title={
            theirs.length === 0
              ? 'Nothing here yet. What did they always tell you? What story do you tell about them?'
              : kind === 'quote'
                ? 'No quotes yet.'
                : 'No stories yet.'
          }
        />
      ) : (
        shown.map((ism) => (
          <View key={ism.id} style={{ gap: 4 }}>
            <IsmCard ism={ism} showAuthor={false} />
            {mine && (
              <Text
                style={[styles.muted, { textAlign: 'right', color: colors.accent }]}
                onPress={() => router.push({ pathname: '/ism/edit', params: { lovedOneId: lovedOne.id, id: ism.id } })}>
                {ism.keepPrivate && lovedOne.visibility !== 'private' ? 'Private · ' : ''}Edit
              </Text>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  header: { alignItems: 'center', gap: space.sm },
  name: { fontSize: 28, fontWeight: '700', color: colors.ink, textAlign: 'center', letterSpacing: -0.4 },
  obituary: { ...cardStyle, padding: space.lg, gap: space.sm },
  obituaryText: { fontSize: 16, lineHeight: 25, color: colors.ink },
  more: { fontSize: 14, fontWeight: '600', color: colors.accent },
});
