import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';

import { NameField } from '../components/NameField';
import { Button, DangerButton, ErrorNote, ScopeToggle, styles } from '../components/ui';
import { deleteAccount, signOut } from '../lib/auth';
import { useStore } from '../lib/store';
import { colors, space } from '../lib/theme';

export default function SettingsScreen() {
  const { settings, updateSettings, session, userId, profile, setDiscoverable, isAdmin, reviewCount } = useStore();
  const [error, setError] = useState<string>();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isAdmin && (
        <>
          <Text style={styles.subheading}>Reviewing</Text>
          <Button
            title={reviewCount ? `Review shared memories (${reviewCount})` : 'Review shared memories'}
            icon="shield-checkmark-outline"
            variant="secondary"
            onPress={() => router.push('/review')}
          />
        </>
      )}

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
      {profile ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Let people find me</Text>
            <Text style={styles.hint}>
              Others can find you by your name, or in their contacts by your email address. Turn this off to only add
              friends yourself.
            </Text>
          </View>
          <Switch
            value={profile.discoverable !== false}
            onValueChange={(on) =>
              setDiscoverable(on).catch((e) => {
                console.warn('Could not save', e);
                setError('Couldn’t save that. Check your connection and try again.');
              })
            }
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.card}
            accessibilityLabel="Let people find me"
          />
        </View>
      ) : null}
      <Text style={styles.muted}>
        Everything you add is private until you share a loved one with your friends or with everyone. Even then, you
        can keep single quotes or stories private. Shared memories that might hurt someone are checked by Ism’s before
        others can see them. Other people see your name, never your email address.
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
