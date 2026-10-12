import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { NameField } from '../components/NameField';
import { Button, DangerButton, ErrorNote, ScopeToggle, styles } from '../components/ui';
import { deleteAccount, signOut } from '../lib/auth';
import { useStore } from '../lib/store';

export default function SettingsScreen() {
  const { settings, updateSettings, session, userId } = useStore();
  const [error, setError] = useState<string>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subheading}>Account</Text>
      {session ? (
        <>
          <Text style={styles.body}>Signed in as {session.user.email ?? 'you'}</Text>
          <Button
            title="Sign out"
            variant="secondary"
            onPress={() => signOut().catch(() => setError('Couldn’t sign out. Try again.'))}
          />
        </>
      ) : (
        <>
          <Text style={styles.muted}>Sign in to add your loved ones and keep them safe in your account.</Text>
          <Button title="Sign in or create an account" onPress={() => router.push('/account')} />
        </>
      )}

      <Text style={styles.subheading}>About you</Text>
      <NameField />

      <Text style={styles.subheading}>Whose memories to show at first</Text>
      <ScopeToggle value={settings.defaultScope} onChange={(defaultScope) => updateSettings({ defaultScope })} />
      <Text style={styles.muted}>
        “Mine” shows only the people you’ve added. “Friends” adds what your friends share with you. “Everyone” also
        includes what other families share with everyone. You can always switch on any screen.
      </Text>

      <Text style={styles.subheading}>Privacy</Text>
      <Text style={styles.muted}>
        Everything you add is private until you share a loved one with your friends or with everyone. Even then, you
        can keep single quotes or stories private. Friends see your name, never your email address.
      </Text>

      {error ? <ErrorNote message={error} /> : null}

      {session && (
        <>
          <Text style={styles.subheading}>Delete account</Text>
          <DangerButton
            title="Delete my account"
            message="This permanently deletes your account, your friend list, and every loved one, photo, quote and story you added. It can't be undone."
            confirmTitle="Delete forever"
            onConfirm={() =>
              deleteAccount(userId).catch((e) => {
                console.warn('Could not delete account', e);
                setError('Couldn’t delete your account. Check your connection and try again.');
              })
            }
          />
        </>
      )}
    </ScrollView>
  );
}
