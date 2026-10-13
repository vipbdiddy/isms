import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { IsmCard } from '../../components/IsmCard';
import { LovedOneRow } from '../../components/LovedOneRow';
import { openGroup } from '../../components/SharedBy';
import { Button, Card, Empty, ErrorNote, TextButton, styles } from '../../components/ui';
import { canSee, canSeeLovedOne, visibleIsms } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors, space } from '../../lib/theme';
import type { FriendRequestResult, Relationship } from '../../lib/types';

/** How many of their quotes and stories to show at first. */
const PAGE = 10;

/** What to say when a friend request didn't simply go through. */
function requestMessage(result: FriendRequestResult): string | undefined {
  switch (result.result) {
    case 'need_name':
      return 'Add your name first (in Settings), so they know who’s asking.';
    case 'too_many':
      return 'You have lots of requests waiting. Try again once some are answered.';
    case 'self':
    case 'not_found':
      return 'They can’t be added right now.';
    default:
      return undefined;
  }
}

/**
 * Someone's profile: their name, how you're connected, and the loved ones and memories they share with
 * you. Open to themselves, their friends, the people in their groups, and everyone when it's public.
 */
export default function PersonScreen() {
  const { id, name: nameFromLink } = useLocalSearchParams<{ id: string; name?: string }>();
  const {
    userId,
    profile,
    nameOf,
    knows,
    friendships,
    lovedOnes,
    isms,
    viewer,
    groups,
    membersOf,
    sendFriendRequest,
    answerFriendRequest,
    removeFriend,
    loading,
    refresh,
  } = useStore();
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  // How you stand after asking or answering here, before the next reload catches up.
  const [changed, setChanged] = useState<Relationship>();

  const me = id === userId;
  const name = ((me ? profile?.displayName : nameOf(id)) || nameFromLink || '').trim();
  const firstName = name.split(/\s+/)[0] || 'them';
  const open = knows(id);

  const theirLovedOnes = useMemo(
    () => lovedOnes.filter((l) => l.ownerId === id && canSeeLovedOne(l, viewer)),
    [lovedOnes, id, viewer],
  );
  const theirIsms = useMemo(
    () => visibleIsms(isms, lovedOnes, viewer, 'everyone').filter((i) => i.ownerId === id),
    [isms, lovedOnes, viewer, id],
  );
  const together = groups.filter((g) => membersOf(g.id).some((m) => m.userId === id && m.status === 'member'));

  if (!userId) {
    return (
      <Empty title="Sign in to see people’s profiles.">
        <Button title="Sign in or create an account" onPress={() => router.push('/account')} />
      </Empty>
    );
  }
  if (!name && !open) {
    return <Empty title={loading ? 'Loading…' : 'We couldn’t find this person.'} />;
  }

  const friendship = friendships.find((f) => f.otherId === id);
  const relationship: Relationship =
    changed ??
    (friendship?.status === 'accepted' ? 'friends' : friendship ? (friendship.incoming ? 'received' : 'sent') : 'none');

  const act = async (what: () => Promise<void>, failure: string) => {
    setError(undefined);
    setMessage(undefined);
    try {
      await what();
    } catch (e) {
      console.warn(failure, e);
      setError(`${failure} Check your connection and try again.`);
    }
  };

  const ask = () =>
    act(async () => {
      const result = await sendFriendRequest(id);
      const note = requestMessage(result);
      if (note) setMessage(note);
      else setChanged(result.result === 'now_friends' || result.result === 'already_friends' ? 'friends' : 'sent');
    }, 'Couldn’t send the request.');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}>
      <Stack.Screen options={{ title: me ? 'Your profile' : name || 'Profile' }} />
      <View style={local.header}>
        <Avatar lovedOne={{ name: name || '?' }} size={96} />
        <Text style={local.name}>{name || 'Someone'}</Text>
        {together.length > 0 && !me ? (
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            {'In '}
            {together.map((g, i) => (
              <Text key={g.id}>
                {i === 0 ? '' : i === together.length - 1 ? ' and ' : ', '}
                <Text style={local.link} onPress={() => openGroup(g.id)}>
                  {g.name}
                </Text>
              </Text>
            ))}
            {' with you'}
          </Text>
        ) : null}
        {me ? null : relationship === 'friends' ? (
          <View style={local.tag}>
            <Ionicons name="checkmark-circle" size={18} color={colors.sage} />
            <Text style={[local.tagText, { color: colors.sage }]}>Friends</Text>
          </View>
        ) : relationship === 'sent' ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={local.tagText}>Friend request sent</Text>
            <TextButton
              title="Cancel request"
              color={colors.muted}
              onPress={() =>
                act(async () => {
                  await removeFriend(id);
                  setChanged('none');
                }, 'Couldn’t cancel.')
              }
            />
          </View>
        ) : relationship === 'received' ? (
          <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
            <Text style={[styles.body, { textAlign: 'center' }]}>{firstName} wants to be friends.</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Decline"
                  variant="secondary"
                  onPress={() =>
                    act(async () => {
                      await answerFriendRequest(id, false);
                      setChanged('none');
                    }, 'Couldn’t decline.')
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Accept"
                  onPress={() =>
                    act(async () => {
                      await answerFriendRequest(id, true);
                      setChanged('friends');
                    }, 'Couldn’t accept.')
                  }
                />
              </View>
            </View>
          </View>
        ) : (
          <Button small title="Add friend" icon="person-add-outline" onPress={ask} />
        )}
      </View>
      {message ? (
        <Text style={[styles.body, { color: colors.sage, textAlign: 'center' }]} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      {me ? (
        <Card style={{ backgroundColor: colors.sageSoft, borderColor: colors.sageSoft }}>
          <Text style={styles.body}>
            This is your profile.{' '}
            {profile?.publicProfile
              ? 'It’s public: anyone on Ism’s can open it, and sees what you share with them.'
              : 'Your friends and the people in your groups can open it, and see what you share with them.'}
          </Text>
          <TextButton title="Change this in Settings" onPress={() => router.push('/settings')} />
        </Card>
      ) : null}

      {open ? (
        <>
          <Text style={styles.subheading}>{me ? 'Your loved ones' : 'Loved ones they share with you'}</Text>
          {theirLovedOnes.length === 0 ? (
            <Text style={styles.muted}>{me ? 'You haven’t added anyone yet.' : `${firstName} hasn’t shared anyone with you yet.`}</Text>
          ) : (
            theirLovedOnes.map((l) => (
              <LovedOneRow
                key={l.id}
                lovedOne={l}
                count={isms.filter((i) => i.lovedOneId === l.id && canSee(i, l, viewer)).length}
              />
            ))
          )}
          {theirIsms.length > 0 ? (
            <>
              <Text style={styles.subheading}>Quotes and stories</Text>
              {theirIsms.slice(0, shown).map((ism) => (
                <IsmCard key={ism.id} ism={ism} showTime />
              ))}
              {theirIsms.length > shown ? (
                <Button title="Show more" variant="secondary" onPress={() => setShown((n) => n + PAGE)} />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={styles.body}>
            Only {firstName === 'them' ? 'their' : `${firstName}’s`} friends and the people in their groups can see
            their profile.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  header: { alignItems: 'center', gap: space.sm },
  name: { fontSize: 26, fontWeight: '700', color: colors.ink, textAlign: 'center', letterSpacing: -0.3 },
  link: { fontWeight: '700', color: colors.accent },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagText: { fontSize: 15, fontWeight: '600', color: colors.muted },
});
