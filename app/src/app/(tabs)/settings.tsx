import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, DangerButton, ErrorNote, Field, ScopeToggle, styles } from '../../components/ui';
import { deleteAccount, signOut } from '../../lib/auth';
import { useStore } from '../../lib/store';

export default function SettingsScreen() {
  const { settings, updateSettings, session, userId } = useStore();
  const [error, setError] = useState<string>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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

      <Field
        label="Your first name"
        placeholder="So we can say hi"
        value={settings.displayName}
        onChangeText={(displayName) => updateSettings({ displayName })}
      />

      <Text style={styles.subheading}>Whose advice to show by default</Text>
      <ScopeToggle value={settings.defaultScope} onChange={(defaultScope) => updateSettings({ defaultScope })} />
      <Text style={styles.muted}>
        "My loved ones" shows only the people you've added. "Everyone" also includes quotes and stories other families
        have chosen to share. You can always flip it on any screen.
      </Text>

      <Text style={styles.subheading}>Privacy</Text>
      <Text style={styles.muted}>
        Everything you add is private unless you mark a loved one as shared. When shared, their profile, quotes and
        stories can be read by others, but you can still keep individual quotes or stories private.
      </Text>

      {error ? <ErrorNote message={error} /> : null}

      {session && (
        <>
          <Text style={styles.subheading}>Delete account</Text>
          <DangerButton
            title="Delete my account"
            message="This permanently deletes your account and every loved one, photo, quote and story you added. It can't be undone."
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
