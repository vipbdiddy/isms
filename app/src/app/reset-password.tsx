import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';

import { Button, ErrorNote, Field, styles } from '../components/ui';
import { friendlyAuthError, setNewPassword } from '../lib/auth';
import { colors } from '../lib/theme';
import { useAuthLink } from '../lib/useAuthLink';

/** Opened by the link in a password-reset email (isms://reset-password). */
export default function ResetPassword() {
  const status = useAuthLink();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  if (status.state === 'working') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Opening your reset link…</Text>
        <ActivityIndicator color={colors.accent} />
      </ScrollView>
    );
  }

  if (status.state === 'failed') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>That link didn’t work</Text>
        <ErrorNote message={status.error} />
        <Button title="Ask for a new link" onPress={() => router.replace('/account')} />
      </ScrollView>
    );
  }

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await setNewPassword(password);
      setSaved(true);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{saved ? 'Password changed' : 'Choose a new password'}</Text>
      {saved ? (
        <>
          <Text style={styles.body}>You're signed in. Use your new password next time.</Text>
          <Button title="Done" onPress={() => router.dismissTo('/')} />
        </>
      ) : (
        <>
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint="At least 6 characters."
          />
          {error ? <ErrorNote message={error} /> : null}
          <Button
            title={busy ? 'Saving…' : 'Save new password'}
            onPress={save}
            disabled={password.length < 6 || busy}
          />
        </>
      )}
    </ScrollView>
  );
}
