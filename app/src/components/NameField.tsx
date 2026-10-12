import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useStore } from '../lib/store';
import { space } from '../lib/theme';
import { Button, ErrorNote, Field } from './ui';

/**
 * Your name. Signed in, it's the name friends see (kept in your account) and it's used to say hi;
 * signed out, it only stays on this phone.
 */
export function NameField({ label = 'Your name', onSaved }: { label?: string; onSaved?: () => void }) {
  const { userId, profile, setMyName, settings, updateSettings } = useStore();
  const saved = userId ? (profile?.displayName ?? '') : settings.displayName;
  // Someone who typed a first name before signing in starts from it.
  const [draft, setDraft] = useState(saved || settings.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // Pick up the name once the profile has loaded.
  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const name = draft.trim();
  const changed = name !== saved.trim();

  const save = async () => {
    if (!changed) return;
    setError(undefined);
    if (!userId) {
      updateSettings({ displayName: name });
      onSaved?.();
      return;
    }
    setSaving(true);
    try {
      await setMyName(name);
      updateSettings({ displayName: name });
      onSaved?.();
    } catch (e) {
      console.warn('Could not save name', e);
      setError('Couldn’t save your name. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: space.sm }}>
      <Field
        label={label}
        placeholder={userId ? 'The name your friends know you by' : 'So we can say hi'}
        hint={userId ? 'People find you and see you by this name. Your email address is never shown.' : undefined}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={save}
        returnKeyType="done"
        autoComplete="name"
        maxLength={60}
      />
      {error ? <ErrorNote message={error} /> : null}
      {changed && (userId ? name.length > 0 : true) ? (
        <Button title={saving ? 'Saving…' : 'Save name'} onPress={save} disabled={saving} />
      ) : null}
    </View>
  );
}
