import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IsmCard } from '../../components/IsmCard';
import { LovedOneRow } from '../../components/LovedOneRow';
import { PersonRow } from '../../components/PersonRow';
import { Button, Card, DangerButton, Empty, ErrorNote, Field, TextButton, styles } from '../../components/ui';
import { canSee, canSeeLovedOne } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors, radius, space } from '../../lib/theme';
import type { GroupInviteResult, GroupMember, PersonResult } from '../../lib/types';

/** Back to where they came from, or to the Friends tab when the page was opened from a link. */
const goBack = () => (router.canGoBack() ? router.back() : router.replace('/friends'));

/** How many of the group's latest memories to show at first. */
const LATEST = 5;

/** Wait this long after the last letter typed before searching. */
const SEARCH_DELAY_MS = 300;

/** What to say when an invitation didn't simply go through. */
function inviteMessage(result: GroupInviteResult): string | undefined {
  switch (result.result) {
    case 'invited':
      return undefined;
    case 'already_invited':
      return `${result.name} is already invited.`;
    case 'already_member':
      return `${result.name} is already in the group.`;
    case 'need_name':
      return 'Add your name first (in Settings), so they know who’s inviting them.';
    case 'too_many':
      return 'You have lots of invitations waiting. Try again once some are answered.';
    case 'full':
      return 'This group is full.';
    case 'self':
    case 'not_found':
      return 'That person can’t be invited right now.';
  }
}

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    userId,
    getGroup,
    membersOf,
    nameOf,
    friendships,
    lovedOnes,
    isms,
    viewer,
    groupInvites,
    answerGroupInvite,
    inviteToGroup,
    removeFromGroup,
    leaveGroup,
    deleteGroup,
    renameGroup,
    searchPeople,
    loading,
    loaded,
    refresh,
  } = useStore();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [shown, setShown] = useState(LATEST);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>();
  const latestSearch = useRef(0);

  const group = getGroup(id);
  const members = membersOf(id);
  const me = members.find((m) => m.userId === userId);
  const invite = groupInvites.find((i) => i.group.id === id);
  const owner = group?.ownerId === userId;

  const shared = useMemo(
    () => lovedOnes.filter((l) => l.visibility === 'group' && l.groupId === id && canSeeLovedOne(l, viewer)),
    [lovedOnes, id, viewer],
  );
  const latest = useMemo(() => {
    const byId = new Map(shared.map((l) => [l.id, l]));
    return isms
      .filter((i) => byId.has(i.lovedOneId) && canSee(i, byId.get(i.lovedOneId), viewer))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [shared, isms, viewer]);

  const term = query.trim();
  useEffect(() => {
    const search = ++latestSearch.current;
    if (term.length < 2) {
      setResults(undefined);
      return;
    }
    const timer = setTimeout(() => {
      searchPeople(term).then(
        (found) => search === latestSearch.current && setResults(found),
        (e) => {
          console.warn('Could not search', e);
          if (search === latestSearch.current) setError('Couldn’t search. Check your connection and try again.');
        },
      );
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term, searchPeople]);

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

  if (!group || (!me && !invite)) {
    return <Empty title={loaded ? 'We couldn’t find this group. You may not be in it any more.' : 'Loading…'} />;
  }

  const refreshControl = <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />;

  // Invited, not in it yet: just the invitation.
  if (!me || me.status === 'invited') {
    const from = invite?.invitedBy ? nameOf(invite.invitedBy) : '';
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={refreshControl}>
        <Stack.Screen options={{ title: group.name }} />
        <Card>
          <Text style={styles.heading}>{group.name}</Text>
          <Text style={styles.body}>
            {from || 'Someone'} invited you to join. Members see the loved ones shared with the group, and each other’s
            names.
          </Text>
          <View style={local.row}>
            <View style={{ flex: 1 }}>
              <Button
                title="No thanks"
                variant="secondary"
                onPress={() =>
                  act(async () => {
                    await answerGroupInvite(group.id, false);
                    goBack();
                  }, 'Couldn’t answer.')
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Join" onPress={() => act(() => answerGroupInvite(group.id, true), 'Couldn’t join.')} />
            </View>
          </View>
        </Card>
        {error ? <ErrorNote message={error} /> : null}
      </ScrollView>
    );
  }

  const joined = members.filter((m) => m.status === 'member');
  const invited = members.filter((m) => m.status === 'invited');
  const inGroup = new Set(members.map((m) => m.userId));
  const friendsToInvite = friendships
    .filter((f) => f.status === 'accepted' && !inGroup.has(f.otherId))
    .map((f) => f.otherId)
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const ask = (otherId: string) =>
    act(async () => {
      const result = await inviteToGroup(group.id, otherId);
      const note = inviteMessage(result);
      setMessage(note ?? `Invited ${nameOf(otherId) || ('name' in result ? result.name : 'them')}.`);
    }, 'Couldn’t send the invitation.');

  const memberRow = (m: GroupMember) => {
    const isOwner = m.userId === group.ownerId;
    const you = m.userId === userId;
    const note =
      m.status === 'invited'
        ? `Invited${m.invitedBy ? ` by ${m.invitedBy === userId ? 'you' : nameOf(m.invitedBy) || 'someone'}` : ''}`
        : isOwner
          ? 'Made the group'
          : undefined;
    const canRemove = !you && !isOwner && (owner || (m.status === 'invited' && m.invitedBy === userId));
    return (
      <PersonRow
        key={m.userId}
        personId={you ? undefined : m.userId}
        name={you ? `${nameOf(m.userId) || 'You'} (you)` : nameOf(m.userId)}
        note={note}
        action={
          canRemove ? (
            <TextButton
              title={m.status === 'invited' ? 'Take back' : 'Remove'}
              color={colors.muted}
              onPress={() => act(() => removeFromGroup(group.id, m.userId), 'Couldn’t do that.')}
            />
          ) : undefined
        }
      />
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      <Stack.Screen options={{ title: group.name }} />
      {renaming ? (
        <View style={{ gap: space.sm }}>
          <Field label="Group name" value={newName} onChangeText={setNewName} maxLength={60} autoFocus />
          <View style={local.row}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setRenaming(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Save"
                disabled={!newName.trim()}
                onPress={() =>
                  act(async () => {
                    await renameGroup(group.id, newName.trim());
                    setRenaming(false);
                  }, 'Couldn’t rename the group.')
                }
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <Text style={styles.heading}>{group.name}</Text>
          <Text style={styles.muted}>
            {joined.length} {joined.length === 1 ? 'member' : 'members'}
            {owner ? '  ·  ' : ''}
            {owner ? (
              <TextButton
                title="Rename"
                onPress={() => {
                  setNewName(group.name);
                  setRenaming(true);
                }}
              />
            ) : null}
          </Text>
        </View>
      )}
      {message ? (
        <Text style={[styles.body, { color: colors.sage }]} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}

      <Text style={styles.subheading}>Shared with the group</Text>
      {shared.length === 0 ? (
        <Text style={styles.muted}>
          Nothing yet. Share a loved one with {group.name}, and everyone here can see them and their quotes and stories.
        </Text>
      ) : (
        shared.map((l) => (
          <LovedOneRow
            key={l.id}
            lovedOne={l}
            count={isms.filter((i) => i.lovedOneId === l.id && canSee(i, l, viewer)).length}
          />
        ))
      )}
      <Button
        title="Share a loved one with the group"
        icon="add"
        variant="secondary"
        onPress={() => router.push({ pathname: '/loved-one/edit', params: { groupId: group.id } })}
      />
      <Text style={styles.hint}>
        To share someone you already added, open them, tap Edit, and choose {group.name} under “Who can see their
        memories?”.
      </Text>

      {latest.length > 0 ? (
        <>
          <Text style={styles.subheading}>Latest memories</Text>
          {latest.slice(0, shown).map((ism) => (
            <IsmCard key={ism.id} ism={ism} showTime />
          ))}
          {latest.length > shown ? (
            <Button title="Show more" variant="secondary" onPress={() => setShown((n) => n + LATEST)} />
          ) : null}
        </>
      ) : null}

      <Text style={styles.subheading}>Members</Text>
      {joined.map(memberRow)}
      {invited.length > 0 ? (
        <>
          <Text style={styles.subheading}>Invited</Text>
          {invited.map(memberRow)}
        </>
      ) : null}

      <Text style={styles.subheading}>Invite people</Text>
      <View style={local.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          style={local.searchInput}
          placeholder="Search for people by name"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setMessage(undefined);
            setError(undefined);
          }}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          accessibilityLabel="Search for people to invite"
        />
        {query ? (
          <Ionicons name="close-circle" size={20} color={colors.muted} onPress={() => setQuery('')} accessibilityLabel="Clear" />
        ) : null}
      </View>
      {results !== undefined ? (
        results.length === 0 ? (
          <Text style={styles.muted}>No one called “{term}” yet. They may not have joined, or may have chosen not to be found.</Text>
        ) : (
          results.map((person) => (
            <PersonRow
              key={person.id}
              personId={person.id}
              name={person.displayName}
              note={inGroup.has(person.id) ? 'Already in the group or invited' : undefined}
              action={
                inGroup.has(person.id) ? undefined : (
                  <Button small title="Invite" icon="person-add-outline" onPress={() => ask(person.id)} />
                )
              }
            />
          ))
        )
      ) : friendsToInvite.length > 0 ? (
        friendsToInvite.map((friendId) => (
          <PersonRow
            key={friendId}
            personId={friendId}
            name={nameOf(friendId)}
            note="Your friend"
            action={<Button small title="Invite" icon="person-add-outline" onPress={() => ask(friendId)} />}
          />
        ))
      ) : (
        <Text style={styles.muted}>Search for the people you’d like here. Your friends show up here too.</Text>
      )}

      <View style={{ marginTop: space.lg }}>
        {owner ? (
          <DangerButton
            title="Delete the group"
            message={`Delete ${group.name}? Everyone leaves it, and the loved ones shared with it go back to being private to whoever added them.`}
            confirmTitle="Delete"
            onConfirm={() =>
              act(async () => {
                await deleteGroup(group.id);
                goBack();
              }, 'Couldn’t delete the group.')
            }
          />
        ) : (
          <DangerButton
            title="Leave the group"
            message={`Leave ${group.name}? Loved ones you shared with the group go back to being private, and you’ll stop seeing what others shared here.`}
            confirmTitle="Leave"
            onConfirm={() =>
              act(async () => {
                await leaveGroup(group.id);
                goBack();
              }, 'Couldn’t leave the group.')
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 },
});
