import { useState } from 'react';
import { Text, View } from 'react-native';

import { sameSharingAsLovedOne } from '../lib/advice';
import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import type { Ism, LovedOne, Visibility } from '../lib/types';
import { Button, Chip, ErrorNote, Field, Segmented, styles } from './ui';

const VISIBILITIES = [
  ['private', 'Just me'],
  ['friends', 'Friends'],
  ['group', 'A group'],
  ['public', 'Everyone'],
] as const;

/**
 * Who can see a loved one: just you, your friends, one of your groups, or everyone, with a line
 * explaining the choice. Their quotes and stories start the same. Choosing a group shows your groups,
 * and lets you make a new one.
 */
export function SharingPicker({
  visibility,
  groupId,
  onChange,
}: {
  visibility: Visibility;
  groupId?: string;
  onChange: (visibility: Visibility, groupId?: string) => void;
}) {
  const { groups, createGroup } = useStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const group = groups.find((g) => g.id === groupId);

  const choose = (next: Visibility) => {
    setError(undefined);
    // With only one group, there's nothing to pick.
    if (next === 'group') onChange('group', group?.id ?? (groups.length === 1 ? groups[0].id : undefined));
    else onChange(next, undefined);
  };

  const create = async () => {
    setCreating(true);
    setError(undefined);
    try {
      const result = await createGroup(name.trim());
      if (result.result === 'created') {
        onChange('group', result.id);
        setNaming(false);
        setName('');
      } else {
        setError(
          result.result === 'need_name'
            ? 'Add your name first (in Settings), so the people you invite know who you are.'
            : result.result === 'too_many'
              ? 'You’ve made a lot of groups. Delete one you don’t use first.'
              : 'Give the group a name.',
        );
      }
    } catch (e) {
      console.warn('Could not make the group', e);
      setError('Couldn’t make the group. Check your connection and try again.');
    } finally {
      setCreating(false);
    }
  };

  const hint =
    visibility === 'private'
      ? 'Only you can see them and their memories.'
      : visibility === 'friends'
        ? 'You and your friends on Isms can see them and their memories.'
        : visibility === 'group'
          ? group
            ? `Everyone in ${group.name} can see them and their memories.`
            : 'Pick one of your groups, or make one for your family.'
          : 'Anyone using Isms can see them and their memories, even people who aren’t signed in.';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Who can see them?</Text>
      <Segmented options={VISIBILITIES} value={visibility} onChange={choose} />
      {visibility === 'group' ? (
        <View style={{ gap: space.sm, marginTop: space.xs }}>
          {groups.length > 0 ? (
            <View style={styles.wrapRow}>
              {groups.map((g) => (
                <Chip key={g.id} label={g.name} selected={g.id === groupId} onPress={() => onChange('group', g.id)} />
              ))}
              {naming ? null : <Chip label="+ New group" onPress={() => setNaming(true)} />}
            </View>
          ) : (
            <Text style={styles.muted}>
              You’re not in any groups yet. Make one for your family, then invite them from the group’s page.
            </Text>
          )}
          {naming || groups.length === 0 ? (
            <View style={{ gap: space.sm }}>
              <Field
                label="New group’s name"
                placeholder="The Lee family, Grandma’s grandkids…"
                value={name}
                onChangeText={setName}
                maxLength={60}
                onSubmitEditing={create}
                returnKeyType="done"
              />
              <Button
                title={creating ? 'Making it…' : 'Make the group'}
                icon="people-outline"
                variant="secondary"
                onPress={create}
                disabled={!name.trim() || creating}
              />
            </View>
          ) : null}
          {error ? <ErrorNote message={error} /> : null}
        </View>
      ) : null}
      <Text style={styles.hint}>
        {hint}
        {visibility === 'private'
          ? ' You can still share a quote or story of theirs with others, who’ll see whose it is.'
          : ' You can share each quote or story differently too. Anything that might hurt someone is checked by Isms before others see it.'}
      </Text>
    </View>
  );
}

const POST_VISIBILITIES = [
  ['private', 'Just me'],
  ['friends', 'Friends'],
  ['group', 'Groups'],
  ['public', 'Everyone'],
] as const;

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Who can see a quote or story: just you, your friends, one or more of your groups, or everyone. It
 * starts as the same people who can see its loved one; a line says who that is, and when it reaches
 * people who can't see the loved one's page.
 */
export function PostSharingPicker({
  lovedOne,
  noun,
  visibility,
  groupIds,
  onChange,
}: {
  lovedOne: LovedOne;
  /** "quote" or "story". */
  noun: string;
  visibility: Visibility;
  groupIds: string[];
  onChange: (visibility: Visibility, groupIds: string[]) => void;
}) {
  const { groups } = useStore();
  const chosen = groups.filter((g) => groupIds.includes(g.id));
  const same = sameSharingAsLovedOne(lovedOne, visibility, groupIds);

  const choose = (next: Visibility) => {
    if (next !== 'group') return onChange(next, []);
    // Start with the loved one's group, or the only group there is.
    const start = groupIds.length
      ? groupIds
      : lovedOne.groupId
        ? [lovedOne.groupId]
        : groups.length === 1
          ? [groups[0].id]
          : [];
    onChange('group', start);
  };
  const toggle = (id: string) =>
    onChange('group', groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id]);

  const who =
    visibility === 'private'
      ? 'Only you.'
      : visibility === 'friends'
        ? 'You and your friends on Isms.'
        : visibility === 'group'
          ? chosen.length
            ? `Everyone in ${listNames(chosen.map((g) => g.name))}.`
            : 'Pick one or more of your groups.'
          : 'Anyone using Isms, even people who aren’t signed in.';
  const wider = visibility !== 'private' && !same && lovedOne.visibility !== 'public';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Who can see this {noun}?</Text>
      <Segmented options={POST_VISIBILITIES} value={visibility} onChange={choose} />
      {visibility === 'group' ? (
        groups.length > 0 ? (
          <View style={[styles.wrapRow, { marginTop: space.xs }]}>
            {groups.map((g) => (
              <Chip key={g.id} label={g.name} selected={groupIds.includes(g.id)} onPress={() => toggle(g.id)} />
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>You’re not in any groups yet. Make one from the Friends tab.</Text>
        )
      ) : null}
      <Text style={styles.hint}>
        {who}
        {same ? ` The same as ${lovedOne.name}.` : ''}
        {wider ? ` They’ll see ${lovedOne.name}’s name and photo with it, but not the rest of their page.` : ''}
        {visibility !== 'private' ? ' Anything that might hurt someone is checked by Isms before others see it.' : ''}
      </Text>
    </View>
  );
}

/** Who can see a quote or story shared on its own ("Only you", "Friends", group names, "Everyone"); undefined when it's like its loved one. */
export function postSharingLabel(
  ism: Pick<Ism, 'visibility' | 'groupIds'>,
  groupName: (id: string) => string | undefined,
): string | undefined {
  switch (ism.visibility) {
    case 'private':
      return 'Only you';
    case 'friends':
      return 'Friends';
    case 'group': {
      const names = (ism.groupIds ?? []).map(groupName).filter((n) => n !== undefined);
      return names.length ? listNames(names) : 'Groups';
    }
    case 'public':
      return 'Everyone';
    default:
      return undefined;
  }
}
