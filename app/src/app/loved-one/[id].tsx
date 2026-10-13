import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { IsmCard } from '../../components/IsmCard';
import { LikeButton, LikedBy } from '../../components/Reactions';
import { ReportPanel, ReviewNote } from '../../components/ReportPanel';
import { SharedBy, openGroup } from '../../components/SharedBy';
import { Button, Empty, KindToggle, TextButton, styles } from '../../components/ui';
import { canSee, canSeeLovedOne, isShared, matchesKind } from '../../lib/advice';
import { COMMUNITY_OWNER } from '../../lib/seed';
import { useStore } from '../../lib/store';
import { cardStyle, colors, space } from '../../lib/theme';
import type { Group, KindFilter, Visibility } from '../../lib/types';

/** Who can see your own loved one, said on their page. */
function ownStatus(visibility: Visibility, group: Group | undefined) {
  switch (visibility) {
    case 'private':
      return 'Private. Only you can see their quotes and stories.';
    case 'friends':
      return 'Shared with your friends. They can see their quotes and stories.';
    case 'group':
      return group ? (
        <>
          {'Shared with '}
          <Text style={{ fontWeight: '700', color: colors.accent }} onPress={() => openGroup(group.id)}>
            {group.name}
          </Text>
          . Everyone in the group can see their quotes and stories.
        </>
      ) : (
        'Shared with a group.'
      );
    case 'public':
      return 'Shared with everyone. Anyone using Ism’s can see their quotes and stories.';
  }
}

/** Obituaries longer than this start collapsed. */
const OBITUARY_PREVIEW_LINES = 5;

export default function LovedOneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLovedOne, getGroup, isms, userId, viewer, report, commentsOn } = useStore();
  const [kind, setKind] = useState<KindFilter>('all');
  const [obituaryOpen, setObituaryOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const lovedOne = getLovedOne(id);

  if (reported) {
    return (
      <Empty title="Thanks for letting us know. They’re hidden for you now, and someone at Ism’s will take a look.">
        <Button title="Go back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Empty>
    );
  }

  if (!lovedOne || !canSeeLovedOne(lovedOne, viewer)) {
    return <Empty title="We couldn't find this person." />;
  }

  const mine = lovedOne.ownerId === userId;
  const example = lovedOne.ownerId === COMMUNITY_OWNER;
  const canReport = !!userId && !mine && !example;
  const target = { lovedOneId: lovedOne.id };
  const comments = commentsOn(target).length;
  const group = lovedOne.groupId ? getGroup(lovedOne.groupId) : undefined;
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
        {mine ? (
          <Text style={[styles.muted, { textAlign: 'center' }]}>{ownStatus(lovedOne.visibility, group)}</Text>
        ) : example ? (
          <Text style={[styles.muted, { textAlign: 'center' }]}>An example.</Text>
        ) : (
          <SharedBy lovedOne={lovedOne} after="." style={{ ...styles.muted, textAlign: 'center' }} />
        )}
        {canReport && !reporting ? <TextButton title="Report" color={colors.muted} onPress={() => setReporting(true)} /> : null}
      </View>
      {example ? null : (
        <View style={{ gap: space.xs }}>
          <View style={local.reactions}>
            <LikeButton target={target} />
            <Pressable
              onPress={() => router.push({ pathname: '/loved-one/comments', params: { id: lovedOne.id } })}
              hitSlop={8}
              style={local.commentLink}
              accessibilityRole="button">
              <Ionicons name="chatbubble-outline" size={20} color={colors.accent} />
              <Text style={local.commentText}>
                {comments ? `${comments} ${comments === 1 ? 'comment' : 'comments'}` : 'Leave a kind word'}
              </Text>
            </Pressable>
          </View>
          <View style={{ alignItems: 'center' }}>
            <LikedBy target={target} />
          </View>
        </View>
      )}
      {mine && isShared(undefined, lovedOne) ? <ReviewNote status={lovedOne.reviewStatus} /> : null}
      {reporting ? (
        <ReportPanel
          onCancel={() => setReporting(false)}
          onReport={async (reason) => {
            await report({ lovedOneId: lovedOne.id }, reason);
            setReported(true);
          }}
        />
      ) : null}

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
  reactions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xl },
  commentLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  commentText: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
