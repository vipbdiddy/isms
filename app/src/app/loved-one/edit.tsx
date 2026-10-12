import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { SHARED_WITH } from '../../components/LovedOneRow';
import { Button, DangerButton, ErrorNote, Field, TextButton, VisibilityPicker, styles } from '../../components/ui';
import { canSeeLovedOne } from '../../lib/advice';
import { findPossibleDuplicates } from '../../lib/duplicates';
import { pickPhoto, type PickedPhoto } from '../../lib/photos';
import { COMMUNITY_OWNER } from '../../lib/seed';
import { useStore } from '../../lib/store';
import { cardStyle, colors, space } from '../../lib/theme';
import type { LovedOne, Visibility } from '../../lib/types';

export default function EditLovedOne() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getLovedOne, addLovedOne, updateLovedOne, deleteLovedOne, userId, lovedOnes, viewer } = useStore();
  const existing = id ? getLovedOne(id) : undefined;
  const editable = !existing || existing.ownerId === userId;

  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [years, setYears] = useState(existing?.years ?? '');
  const [about, setAbout] = useState(existing?.about ?? '');
  const [obituary, setObituary] = useState(existing?.obituary ?? '');
  // undefined: keep the current photo; null: remove it; a PickedPhoto: replace it.
  const [photo, setPhoto] = useState<PickedPhoto | null>();
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  // People they've said "No, this is someone else" to.
  const [notThem, setNotThem] = useState<string[]>([]);

  // When adding someone new, look for them among the people already here that this person may see.
  const lookalikes = useMemo(
    () =>
      existing
        ? []
        : findPossibleDuplicates(
            { name, years, obituary },
            lovedOnes.filter(
              (l) => l.ownerId !== COMMUNITY_OWNER && !notThem.includes(l.id) && canSeeLovedOne(l, viewer),
            ),
          ),
    [existing, name, years, obituary, lovedOnes, notThem, viewer],
  );

  if (!editable || !userId) return null;

  const photoUri = photo === null ? undefined : (photo?.previewUri ?? existing?.photoUri);

  const choosePhoto = async () => {
    try {
      const picked = await pickPhoto();
      if (picked) setPhoto(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that photo.');
    }
  };

  const save = async () => {
    const fields = {
      name: name.trim(),
      relationship: relationship.trim(),
      years: years.trim() || undefined,
      about: about.trim() || undefined,
      obituary: obituary.trim() || undefined,
      visibility,
    };
    setSaving(true);
    setError(undefined);
    try {
      if (existing) {
        await updateLovedOne(existing.id, fields, photo);
        router.back();
      } else {
        const created = await addLovedOne(fields, photo ?? undefined);
        router.replace({ pathname: '/loved-one/[id]', params: { id: created.id } });
      }
    } catch (e) {
      console.warn('Could not save loved one', e);
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Pressable onPress={choosePhoto} accessibilityRole="button" accessibilityLabel="Choose a photo">
          <Avatar lovedOne={{ name: name || '?', photoUri }} size={112} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ color: colors.accent, fontWeight: '600' }} onPress={choosePhoto}>
            {photoUri ? 'Change photo' : 'Add a photo'}
          </Text>
          {photoUri ? (
            <Text style={{ color: colors.muted }} onPress={() => setPhoto(null)}>
              Remove
            </Text>
          ) : null}
        </View>
      </View>
      <Field label="Name" placeholder="What you called them — Grandma Jo, Pops…" value={name} onChangeText={setName} />
      <Field label="Relationship" placeholder="Grandmother, best friend, dad…" value={relationship} onChangeText={setRelationship} />
      <Field label="Years (optional)" placeholder="1950 – 2022" value={years} onChangeText={setYears} />
      <Field
        label="About them (optional)"
        placeholder="A line or two about who they were"
        value={about}
        onChangeText={setAbout}
        multiline
      />
      <Field
        label="Obituary (optional)"
        placeholder="Paste or write their obituary"
        value={obituary}
        onChangeText={setObituary}
        multiline
        style={{ minHeight: 160 }}
      />

      <VisibilityPicker value={visibility} onChange={setVisibility} />

      {lookalikes.length > 0 && (
        <LookalikeCard
          people={lookalikes}
          userId={userId}
          onOpen={(id) => router.replace({ pathname: '/loved-one/[id]', params: { id } })}
          onNotThem={() => setNotThem((ids) => [...ids, ...lookalikes.map((l) => l.id)])}
        />
      )}

      {error ? <ErrorNote message={error} /> : null}
      <Button title={saving ? 'Saving…' : existing ? 'Save' : 'Add'} onPress={save} disabled={!name.trim() || saving} />
      {existing && (
        <DangerButton
          title="Remove"
          message={`Remove ${existing.name}? This deletes them and every quote and story you added for them.`}
          confirmTitle="Remove"
          onConfirm={async () => {
            try {
              await deleteLovedOne(existing.id);
              router.dismissAll();
            } catch (e) {
              console.warn('Could not remove loved one', e);
              setError('Couldn’t remove them. Check your connection and try again.');
            }
          }}
        />
      )}
    </ScrollView>
  );
}

/** "Is this who you're looking for?": people already in Ism's who look like the one being added. */
function LookalikeCard({
  people,
  userId,
  onOpen,
  onNotThem,
}: {
  people: LovedOne[];
  userId: string;
  onOpen: (id: string) => void;
  onNotThem: () => void;
}) {
  const { sharedBy } = useStore();
  const one = people.length === 1;
  return (
    <View style={local.card} accessibilityRole="alert">
      <Text style={local.title}>{one ? 'Is this who you’re looking for?' : 'Is one of these who you’re looking for?'}</Text>
      {people.map((person) => {
        const mine = person.ownerId === userId;
        return (
          <View key={person.id} style={local.person}>
            <Avatar lovedOne={person} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={local.name}>{person.name}</Text>
              {person.relationship || person.years ? (
                <Text style={styles.muted}>{[person.relationship, person.years].filter(Boolean).join(' · ')}</Text>
              ) : null}
              <Text style={local.whose}>
                {mine ? `You already added them · ${SHARED_WITH[person.visibility]}` : sharedBy(person.ownerId)}
              </Text>
              <TextButton title={mine ? 'Yes, open their page' : 'Yes, see their memories'} onPress={() => onOpen(person.id)} />
            </View>
          </View>
        );
      })}
      <Button title={one ? 'No, this is someone else' : 'No, none of these'} variant="secondary" onPress={onNotThem} />
    </View>
  );
}

const local = StyleSheet.create({
  card: { ...cardStyle, padding: space.lg, gap: space.md, borderColor: colors.accent, backgroundColor: colors.accentSoft },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  person: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  whose: { fontSize: 13, color: colors.accent, fontWeight: '500' },
});
