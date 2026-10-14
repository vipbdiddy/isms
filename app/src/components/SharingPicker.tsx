import { useState } from 'react';
import { Text, View } from 'react-native';

import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import type { Visibility } from '../lib/types';
import { Button, Chip, ErrorNote, Field, Segmented, styles } from './ui';

const VISIBILITIES = [
  ['private', 'Just me'],
  ['friends', 'Friends'],
  ['group', 'A group'],
  ['public', 'Everyone'],
] as const;

/**
 * Who can see a loved one: just you, your friends, one of your groups, or everyone, with a line
 * explaining the choice. Choosing a group shows your groups, and lets you make a new one.
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
      <Text style={styles.label}>Who can see their memories?</Text>
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
          ? ''
          : ' You can still keep single quotes or stories private. Anything that might hurt someone is checked by Isms before others see it.'}
      </Text>
    </View>
  );
}
