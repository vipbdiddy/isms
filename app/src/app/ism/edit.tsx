import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { Button, DangerButton, ErrorNote, Field, Segmented, TopicPicker, styles } from '../../components/ui';
import { detectTopics } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import type { EntryKind } from '../../lib/types';

const KINDS = [
  ['quote', 'A quote'],
  ['story', 'A story'],
] as const;

export default function EditIsm() {
  const params = useLocalSearchParams<{ lovedOneId: string; id?: string; kind?: EntryKind }>();
  const { lovedOneId, id } = params;
  const { getLovedOne, isms, addIsm, updateIsm, deleteIsm, userId } = useStore();
  const lovedOne = getLovedOne(lovedOneId);
  const existing = id ? isms.find((i) => i.id === id) : undefined;

  const [kind, setKind] = useState<EntryKind>(existing?.kind ?? (params.kind === 'story' ? 'story' : 'quote'));
  const [title, setTitle] = useState(existing?.title ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const [context, setContext] = useState(existing?.context ?? '');
  const [topics, setTopics] = useState<string[]>(existing?.topics ?? []);
  const [keepPrivate, setKeepPrivate] = useState(existing?.keepPrivate ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  if (!lovedOne || lovedOne.ownerId !== userId || (existing && existing.ownerId !== userId)) return null;

  // Until they pick topics themselves, suggest some from what they've typed.
  const story = kind === 'story';
  const suggested = topics.length === 0 ? detectTopics(`${story ? title : context} ${text}`) : [];
  const noun = story ? 'story' : 'quote';

  const save = async () => {
    const fields = {
      kind,
      lovedOneId: lovedOne.id,
      title: story ? title.trim() || undefined : undefined,
      text: text.trim(),
      context: story ? undefined : context.trim() || undefined,
      topics: topics.length ? topics : suggested,
      keepPrivate,
    };
    setSaving(true);
    setError(undefined);
    try {
      if (existing) await updateIsm(existing.id, fields);
      else await addIsm(fields);
      router.back();
    } catch (e) {
      console.warn('Could not save', e);
      setError('Couldn’t save. Check your connection and try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Segmented options={KINDS} value={kind} onChange={setKind} />
      {story ? (
        <>
          <Text style={styles.muted}>A memory of {lovedOne.name}, as long as you like</Text>
          <Field label="Title (optional)" placeholder="The night the boat died" value={title} onChangeText={setTitle} />
          <Field
            label="The story"
            placeholder="Tell it the way you'd tell it at the kitchen table…"
            value={text}
            onChangeText={setText}
            multiline
            style={{ minHeight: 240 }}
          />
        </>
      ) : (
        <>
          <Text style={styles.muted}>Something {lovedOne.name} always used to say</Text>
          <Field
            label="In their words"
            placeholder="“If you're scared, do it scared.”"
            value={text}
            onChangeText={setText}
            multiline
          />
          <Field
            label="When they'd say it (optional)"
            placeholder="Every time I was nervous before a game…"
            value={context}
            onChangeText={setContext}
            multiline
          />
        </>
      )}

      <Text style={styles.label}>When would this help someone?</Text>
      <TopicPicker
        wrap
        selected={topics.length ? topics : suggested}
        onToggle={(t) => {
          const current = topics.length ? topics : suggested;
          setTopics(current.includes(t) ? current.filter((x) => x !== t) : [...current, t]);
        }}
      />
      {suggested.length > 0 && <Text style={styles.hint}>We guessed these from the words — tap to change.</Text>}

      {lovedOne.visibility === 'public' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Keep this one private</Text>
            <Text style={styles.hint}>{lovedOne.name} is shared publicly. Turn this on to keep just this {noun} to yourself.</Text>
          </View>
          <Switch value={keepPrivate} onValueChange={setKeepPrivate} trackColor={{ true: colors.sage }} />
        </View>
      )}

      {error ? <ErrorNote message={error} /> : null}
      <Button title={saving ? 'Saving…' : existing ? 'Save' : 'Add'} onPress={save} disabled={!text.trim() || saving} />
      {existing && (
        <DangerButton
          title="Delete"
          message={`Delete this ${noun}? This can't be undone.`}
          confirmTitle="Delete"
          onConfirm={async () => {
            try {
              await deleteIsm(existing.id);
              router.back();
            } catch (e) {
              console.warn('Could not delete', e);
              setError('Couldn’t delete. Check your connection and try again.');
            }
          }}
        />
      )}
    </ScrollView>
  );
}
