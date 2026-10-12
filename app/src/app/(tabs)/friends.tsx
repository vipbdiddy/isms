import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { NameField } from '../../components/NameField';
import { Button, Card, ErrorNote, Field, TextButton, styles } from '../../components/ui';
import { useStore } from '../../lib/store';
import { cardStyle, colors, space } from '../../lib/theme';
import type { FriendRequestResult } from '../../lib/types';

const WEBSITE = 'https://vipbdiddy.github.io/isms/';

/** Friend codes are 8 letters and numbers; people may type them with spaces or dashes. */
const cleanCode = (code: string) => code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

function describe(outcome: FriendRequestResult): { text: string; good: boolean } {
  switch (outcome.result) {
    case 'sent':
      return { text: `Request sent to ${outcome.name}. You’ll be friends once they accept.`, good: true };
    case 'now_friends':
      return { text: `You and ${outcome.name} are now friends.`, good: true };
    case 'already_sent':
      return { text: `You already asked ${outcome.name}. It’s waiting for them to accept.`, good: true };
    case 'already_friends':
      return { text: `You and ${outcome.name} are already friends.`, good: true };
    case 'self':
      return { text: 'That’s your own code. Ask your friend for theirs.', good: false };
    case 'need_name':
      return { text: 'Add your name first, so they know who’s asking.', good: false };
    case 'not_found':
      return { text: 'No one has that code. Check it and try again.', good: false };
  }
}

export default function Friends() {
  const {
    userId,
    profile,
    friendsError,
    friendships,
    lovedOnes,
    nameOf,
    addFriend,
    answerFriendRequest,
    removeFriend,
    loading,
    refresh,
  } = useStore();
  const [code, setCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; good: boolean }>();
  const [editingName, setEditingName] = useState(false);
  const [error, setError] = useState<string>();

  if (!userId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Share memories with friends</Text>
        <Text style={styles.body}>
          Add your friends and family on Ism’s. They’ll see the loved ones you share with friends, and you’ll see theirs.
        </Text>
        <Button title="Sign in or create an account" onPress={() => router.push('/account')} />
      </ScrollView>
    );
  }

  const refreshControl = <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />;

  if (!profile) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={refreshControl}>
        {friendsError ? <ErrorNote message={friendsError} /> : <Text style={styles.muted}>Loading…</Text>}
      </ScrollView>
    );
  }

  if (!profile.displayName.trim()) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>First, what should friends call you?</Text>
        <Text style={styles.body}>Your friends see this name when you add them, and next to the memories you share.</Text>
        <NameField label="Your name" />
      </ScrollView>
    );
  }

  const incoming = friendships.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = friendships.filter((f) => f.status === 'pending' && !f.incoming);
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => nameOf(a.otherId).localeCompare(nameOf(b.otherId)));
  const cleaned = cleanCode(code);
  const sharedWithYou = (friendId: string) => {
    const n = lovedOnes.filter((l) => l.ownerId === friendId).length;
    return n === 0 ? 'Hasn’t shared anyone with you yet' : `Shares ${n} loved ${n === 1 ? 'one' : 'ones'} with you`;
  };

  const act = async (what: () => Promise<void>, failure: string) => {
    setError(undefined);
    try {
      await what();
    } catch (e) {
      console.warn(failure, e);
      setError(`${failure} Check your connection and try again.`);
    }
  };

  const add = async () => {
    setAdding(true);
    setOutcome(undefined);
    setError(undefined);
    try {
      const result = await addFriend(cleaned);
      setOutcome(describe(result));
      if (result.result !== 'not_found' && result.result !== 'self') setCode('');
    } catch (e) {
      console.warn('Could not send friend request', e);
      setError('Couldn’t send the request. Check your connection and try again.');
    } finally {
      setAdding(false);
    }
  };

  const shareCode = () =>
    Share.share({
      message: `Add me on Ism’s so we can share memories of the people we miss. My friend code is ${profile.friendCode}\n\nGet the app: ${WEBSITE}`,
    }).catch(() => undefined);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      <Text style={styles.muted}>
        Friends see the loved ones you share with Friends, and you see theirs. New memories show up on Home.
      </Text>

      <Card style={{ alignItems: 'center' }}>
        <Text style={styles.subheading}>Your friend code</Text>
        <Text style={local.code} selectable accessibilityLabel={`Your friend code: ${profile.friendCode?.split('').join(' ')}`}>
          {profile.friendCode}
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button title="Share my code" icon="share-outline" onPress={shareCode} />
        </View>
        {editingName ? (
          <View style={{ alignSelf: 'stretch' }}>
            <NameField onSaved={() => setEditingName(false)} />
          </View>
        ) : (
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            Friends see you as <Text style={{ color: colors.ink, fontWeight: '600' }}>{profile.displayName}</Text>.{' '}
            <TextButton title="Change" onPress={() => setEditingName(true)} />
          </Text>
        )}
      </Card>

      <Text style={styles.subheading}>Add a friend</Text>
      <Field
        label="Their friend code"
        placeholder="8 letters and numbers"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setOutcome(undefined);
        }}
        onSubmitEditing={() => cleaned.length >= 8 && add()}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={16}
      />
      <Button
        title={adding ? 'Sending…' : 'Add friend'}
        icon="person-add-outline"
        onPress={add}
        disabled={cleaned.length < 8 || adding}
      />
      {outcome ? (
        <Text style={[styles.body, { color: outcome.good ? colors.sage : colors.danger }]} accessibilityRole="alert">
          {outcome.text}
        </Text>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      {incoming.length > 0 && (
        <>
          <Text style={styles.subheading}>Friend requests</Text>
          {incoming.map((f) => (
            <PersonRow key={f.otherId} name={nameOf(f.otherId)} note="Wants to be friends">
              <View style={local.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Accept"
                    onPress={() => act(() => answerFriendRequest(f.otherId, true), 'Couldn’t accept.')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Decline"
                    variant="secondary"
                    onPress={() => act(() => answerFriendRequest(f.otherId, false), 'Couldn’t decline.')}
                  />
                </View>
              </View>
            </PersonRow>
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <Text style={styles.subheading}>Waiting for them to accept</Text>
          {outgoing.map((f) => (
            <PersonRow key={f.otherId} name={nameOf(f.otherId)} note="Request sent">
              <TextButton
                title="Cancel request"
                color={colors.muted}
                onPress={() => act(() => removeFriend(f.otherId), 'Couldn’t cancel.')}
              />
            </PersonRow>
          ))}
        </>
      )}

      <Text style={styles.subheading}>Your friends</Text>
      {friends.length === 0 ? (
        <Text style={styles.muted}>
          No friends yet. Share your code with family and friends, or add theirs above.
        </Text>
      ) : (
        friends.map((f) => (
          <FriendRow
            key={f.otherId}
            name={nameOf(f.otherId)}
            note={sharedWithYou(f.otherId)}
            onRemove={() => act(() => removeFriend(f.otherId), 'Couldn’t remove them.')}
          />
        ))
      )}
    </ScrollView>
  );
}

function PersonRow({ name, note, children }: { name: string; note: string; children?: ReactNode }) {
  return (
    <View style={local.person}>
      <View style={local.personTop}>
        <Avatar lovedOne={{ name: name || '?' }} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={local.name}>{name || 'Someone'}</Text>
          <Text style={styles.muted}>{note}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function FriendRow({ name, note, onRemove }: { name: string; note: string; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <PersonRow name={name} note={note}>
      {asking ? (
        <View style={{ gap: space.sm }}>
          <Text style={styles.body}>
            Remove {name || 'them'}? You’ll stop seeing each other’s friends-only memories.
          </Text>
          <View style={local.actions}>
            <View style={{ flex: 1 }}>
              <Button title="Keep" variant="secondary" onPress={() => setAsking(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Remove" variant="danger" onPress={onRemove} />
            </View>
          </View>
        </View>
      ) : (
        <TextButton title="Remove friend" color={colors.muted} onPress={() => setAsking(true)} />
      )}
    </PersonRow>
  );
}

const local = StyleSheet.create({
  code: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    marginVertical: space.xs,
  },
  person: { ...cardStyle, padding: space.md, gap: space.sm },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  name: { fontSize: 17, fontWeight: '600', color: colors.ink },
  actions: { flexDirection: 'row', gap: space.sm },
});
