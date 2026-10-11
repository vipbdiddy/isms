import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Avatar } from '../../components/Avatar';
import { Button, DangerButton, ErrorNote, Field, styles } from '../../components/ui';
import { pickPhoto, type PickedPhoto } from '../../lib/photos';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function EditLovedOne() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getLovedOne, addLovedOne, updateLovedOne, deleteLovedOne, userId } = useStore();
  const existing = id ? getLovedOne(id) : undefined;
  const editable = !existing || existing.ownerId === userId;

  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [years, setYears] = useState(existing?.years ?? '');
  const [about, setAbout] = useState(existing?.about ?? '');
  const [obituary, setObituary] = useState(existing?.obituary ?? '');
  // undefined: keep the current photo; null: remove it; a PickedPhoto: replace it.
  const [photo, setPhoto] = useState<PickedPhoto | null>();
  const [isPublic, setIsPublic] = useState(existing?.visibility === 'public');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

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
      visibility: isPublic ? ('public' as const) : ('private' as const),
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Share their memories with everyone</Text>
          <Text style={styles.hint}>
            Off: only you can see them. On: anyone using the app can see their profile, quotes and stories. You can
            keep single quotes or stories private.
          </Text>
        </View>
        <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.sage }} />
      </View>

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
