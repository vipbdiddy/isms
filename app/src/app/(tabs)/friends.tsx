import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import { NameField } from '../../components/NameField';
import { PersonRow, mutualFriendsNote } from '../../components/PersonRow';
import { openGroup } from '../../components/SharedBy';
import { Button, Card, ErrorNote, Field, TextButton, styles } from '../../components/ui';
import { contactsAvailable } from '../../lib/contacts';
import { useStore } from '../../lib/store';
import { cardStyle, colors, radius, space } from '../../lib/theme';
import type { FriendRequestResult, Group, PersonResult, Relationship } from '../../lib/types';

const WEBSITE = 'https://vipbdiddy.github.io/isms/';

/** Wait this long after the last letter typed before searching. */
const SEARCH_DELAY_MS = 300;

/** What to tell someone when a request didn't simply go through, and how they now stand. */
function outcome(result: FriendRequestResult): { relationship?: Relationship; message?: string } {
  switch (result.result) {
    case 'sent':
    case 'already_sent':
      return { relationship: 'sent' };
    case 'now_friends':
    case 'already_friends':
      return { relationship: 'friends', message: `You and ${result.name} are now friends.` };
    case 'need_name':
      return { message: 'Add your name first, so they know who’s asking.' };
    case 'too_many':
      return { message: 'You have lots of requests waiting. Try again once some are answered.' };
    case 'self':
    case 'not_found':
      return { message: 'That person can’t be added right now.' };
  }
}

type ContactsState =
  | { step: 'start' }
  | { step: 'explain' }
  | { step: 'looking' }
  | { step: 'found'; people: PersonResult[] }
  | { step: 'denied' };

export default function Friends() {
  const {
    userId,
    profile,
    friendsError,
    friendships,
    lovedOnes,
    nameOf,
    searchPeople,
    findFromContacts,
    sendFriendRequest,
    answerFriendRequest,
    removeFriend,
    groups,
    groupInvites,
    membersOf,
    answerGroupInvite,
    loading,
    refresh,
  } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>();
  const [contacts, setContacts] = useState<ContactsState>({ step: 'start' });
  // How you stand with people you just asked or answered, before the next reload catches up.
  const [changed, setChanged] = useState<Record<string, Relationship>>({});
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [editingName, setEditingName] = useState(false);
  const latestSearch = useRef(0);

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
        <Text style={styles.body}>
          This is how people find you and see you when you add them, and next to the memories you share.
        </Text>
        <NameField label="Your name" />
      </ScrollView>
    );
  }

  const incoming = friendships.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = friendships.filter((f) => f.status === 'pending' && !f.incoming);
  const friends = friendships
    .filter((f) => f.status === 'accepted')
    .sort((a, b) => nameOf(a.otherId).localeCompare(nameOf(b.otherId)));
  const sharedWithYou = (friendId: string) => {
    const n = lovedOnes.filter((l) => l.ownerId === friendId).length;
    return n === 0 ? 'Hasn’t shared anyone with you yet' : `Shares ${n} loved ${n === 1 ? 'one' : 'ones'} with you`;
  };

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

  const ask = (person: PersonResult) =>
    act(async () => {
      const result = outcome(await sendFriendRequest(person.id));
      if (result.relationship) setChanged((c) => ({ ...c, [person.id]: result.relationship! }));
      if (result.message) setMessage(result.message);
    }, 'Couldn’t send the request.');

  const accept = (otherId: string) =>
    act(async () => {
      await answerFriendRequest(otherId, true);
      setChanged((c) => ({ ...c, [otherId]: 'friends' }));
    }, 'Couldn’t accept.');

  const cancel = (otherId: string) =>
    act(async () => {
      await removeFriend(otherId);
      setChanged((c) => ({ ...c, [otherId]: 'none' }));
    }, 'Couldn’t cancel.');

  const lookInContacts = async () => {
    setError(undefined);
    setContacts({ step: 'looking' });
    try {
      const people = await findFromContacts();
      setContacts(people === null ? { step: 'denied' } : { step: 'found', people });
    } catch (e) {
      console.warn('Could not check contacts', e);
      setContacts({ step: 'start' });
      setError(e instanceof Error && /tomorrow/.test(e.message) ? e.message : 'Couldn’t check your contacts. Try again.');
    }
  };

  const invite = () =>
    Share.share({
      message: `I’m keeping the sayings and stories of the people we miss on Ism’s. Join me so we can share them: ${WEBSITE}`,
    }).catch(() => undefined);

  /** A person found by search or in contacts, with the one thing you can do next. */
  const found = (person: PersonResult) => {
    const relationship = changed[person.id] ?? person.relationship;
    const action =
      relationship === 'friends' ? (
        <View style={local.tag}>
          <Ionicons name="checkmark" size={16} color={colors.sage} />
          <Text style={[local.tagText, { color: colors.sage }]}>Friends</Text>
        </View>
      ) : relationship === 'sent' ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={local.tagText}>Request sent</Text>
          <TextButton title="Cancel" color={colors.muted} onPress={() => cancel(person.id)} />
        </View>
      ) : relationship === 'received' ? (
        <Button small title="Accept" onPress={() => accept(person.id)} />
      ) : (
        <Button small title="Add friend" icon="person-add-outline" onPress={() => ask(person)} />
      );
    return (
      <PersonRow
        key={person.id}
        personId={person.id}
        name={person.displayName}
        note={mutualFriendsNote(person.mutualFriends)}
        action={action}
      />
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}>
      {editingName ? (
        <NameField onSaved={() => setEditingName(false)} />
      ) : (
        <Text style={styles.muted}>
          People see you as <Text style={{ color: colors.ink, fontWeight: '600' }}>{profile.displayName}</Text>.{' '}
          <TextButton title="Change" onPress={() => setEditingName(true)} />
        </Text>
      )}

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
          accessibilityLabel="Search for people by name"
        />
        {query ? (
          <Ionicons name="close-circle" size={20} color={colors.muted} onPress={() => setQuery('')} accessibilityLabel="Clear" />
        ) : null}
      </View>
      {message ? (
        <Text style={[styles.body, { color: colors.sage }]} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      {error ? <ErrorNote message={error} /> : null}
      {results !== undefined &&
        (results.length === 0 ? (
          <Text style={styles.muted}>
            No one called “{term}” yet. They may not have joined, or may have chosen not to be found.
          </Text>
        ) : (
          results.map(found)
        ))}

      {contactsAvailable && results === undefined && (
        <Card>
          {contacts.step === 'start' && (
            <>
              <Text style={[styles.body, { fontWeight: '600' }]}>Find friends from your contacts</Text>
              <Text style={styles.muted}>See which of the people in your phone already use Ism’s.</Text>
              <Button title="Find friends from contacts" icon="people-outline" variant="secondary" onPress={() => setContacts({ step: 'explain' })} />
            </>
          )}
          {contacts.step === 'explain' && (
            <>
              <Text style={[styles.body, { fontWeight: '600' }]}>Before you allow it</Text>
              <Text style={styles.body}>
                Your phone will ask to let Ism’s see your contacts. Ism’s only looks at their email addresses, turns each one
                into a scrambled code on your phone, and checks those codes against people on Ism’s. Your contacts are never
                uploaded or saved.
              </Text>
              <View style={local.row}>
                <View style={{ flex: 1 }}>
                  <Button title="Not now" variant="secondary" onPress={() => setContacts({ step: 'start' })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Continue" onPress={lookInContacts} />
                </View>
              </View>
            </>
          )}
          {contacts.step === 'looking' && <Text style={styles.muted}>Looking through your contacts…</Text>}
          {contacts.step === 'denied' && (
            <>
              <Text style={styles.body}>
                Ism’s can’t see your contacts. If you change your mind, allow it in your phone’s Settings → Apps → Ism’s →
                Permissions, then try again.
              </Text>
              <TextButton title="Try again" onPress={lookInContacts} />
            </>
          )}
          {contacts.step === 'found' && (
            <>
              <Text style={[styles.body, { fontWeight: '600' }]}>From your contacts</Text>
              {contacts.people.length === 0 ? (
                <Text style={styles.muted}>None of your contacts are on Ism’s yet. Invite them below.</Text>
              ) : (
                contacts.people.map(found)
              )}
            </>
          )}
        </Card>
      )}

      {incoming.length > 0 && (
        <>
          <Text style={styles.subheading}>Friend requests</Text>
          {incoming.map((f) => (
            <PersonRow key={f.otherId} personId={f.otherId} name={nameOf(f.otherId)} note="Wants to be friends">
              <View style={local.row}>
                <View style={{ flex: 1 }}>
                  <Button title="Accept" onPress={() => accept(f.otherId)} />
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

      {groupInvites.length > 0 && (
        <>
          <Text style={styles.subheading}>Group invitations</Text>
          {groupInvites.map((invite) => (
            <View key={invite.group.id} style={local.invite}>
              <Pressable onPress={() => openGroup(invite.group.id)} accessibilityRole="link">
                <Text style={local.groupName}>{invite.group.name}</Text>
                <Text style={styles.muted}>
                  {invite.invitedBy ? nameOf(invite.invitedBy) || 'Someone' : 'Someone'} invited you to join
                </Text>
              </Pressable>
              <View style={local.row}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="No thanks"
                    variant="secondary"
                    onPress={() => act(() => answerGroupInvite(invite.group.id, false), 'Couldn’t answer.')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Join"
                    onPress={() => act(() => answerGroupInvite(invite.group.id, true), 'Couldn’t join.')}
                  />
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <Text style={styles.subheading}>Waiting for them to accept</Text>
          {outgoing.map((f) => (
            <PersonRow
              key={f.otherId}
              personId={f.otherId}
              name={nameOf(f.otherId)}
              note="Request sent"
              action={<TextButton title="Cancel" color={colors.muted} onPress={() => cancel(f.otherId)} />}
            />
          ))}
        </>
      )}

      <Text style={styles.subheading}>Your friends</Text>
      {friends.length === 0 ? (
        <Text style={styles.muted}>No friends yet. Search for them above, or invite them to Ism’s.</Text>
      ) : (
        friends.map((f) => (
          <FriendRow
            key={f.otherId}
            id={f.otherId}
            name={nameOf(f.otherId)}
            note={sharedWithYou(f.otherId)}
            onRemove={() => act(() => removeFriend(f.otherId), 'Couldn’t remove them.')}
          />
        ))
      )}

      <Text style={styles.subheading}>Your groups</Text>
      <Text style={styles.muted}>
        A group is a circle like your family. Share a loved one with a group, and everyone in it can see them.
      </Text>
      {groups.map((group) => (
        <GroupRow key={group.id} group={group} members={membersOf(group.id).filter((m) => m.status === 'member').length} />
      ))}
      <NewGroup />

      <Button title="Invite someone to Ism’s" icon="share-outline" variant="secondary" onPress={invite} />
    </ScrollView>
  );
}

function GroupRow({ group, members }: { group: Group; members: number }) {
  return (
    <Pressable
      style={({ pressed }) => [local.group, pressed && { opacity: 0.9 }]}
      onPress={() => openGroup(group.id)}
      accessibilityRole="link">
      <View style={local.groupIcon}>
        <Ionicons name="people" size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={local.groupName}>{group.name}</Text>
        <Text style={styles.muted}>
          {members} {members === 1 ? 'member' : 'members'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

/** "Make a group": a name, then off to the new group's page to invite people. */
function NewGroup() {
  const { createGroup } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) return <Button title="Make a group" icon="people-outline" variant="secondary" onPress={() => setOpen(true)} />;

  const make = async () => {
    setMaking(true);
    setError(undefined);
    try {
      const result = await createGroup(name.trim());
      if (result.result === 'created') {
        setOpen(false);
        setName('');
        openGroup(result.id);
      } else {
        setError(
          result.result === 'too_many'
            ? 'You’ve made a lot of groups. Delete one you don’t use first.'
            : result.result === 'need_name'
              ? 'Add your name first, so the people you invite know who you are.'
              : 'Give the group a name.',
        );
      }
    } catch (e) {
      console.warn('Could not make the group', e);
      setError('Couldn’t make the group. Check your connection and try again.');
    } finally {
      setMaking(false);
    }
  };

  return (
    <Card>
      <Field
        label="Group name"
        placeholder="The Lee family, Grandma’s grandkids…"
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoFocus
        onSubmitEditing={make}
        returnKeyType="done"
      />
      {error ? <ErrorNote message={error} /> : null}
      <View style={local.row}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={making ? 'Making it…' : 'Make it'} onPress={make} disabled={!name.trim() || making} />
        </View>
      </View>
    </Card>
  );
}

function FriendRow({ id, name, note, onRemove }: { id: string; name: string; note: string; onRemove: () => void }) {
  const [asking, setAsking] = useState(false);
  return (
    <PersonRow personId={id} name={name} note={note}>
      {asking ? (
        <View style={{ gap: space.sm }}>
          <Text style={styles.body}>
            Remove {name || 'them'}? You’ll stop seeing each other’s friends-only memories.
          </Text>
          <View style={local.row}>
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
  row: { flexDirection: 'row', gap: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invite: { ...cardStyle, padding: space.md, gap: space.md },
  group: { ...cardStyle, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: { fontSize: 17, fontWeight: '600', color: colors.ink },
  tagText: { fontSize: 14, fontWeight: '600', color: colors.muted },
});
