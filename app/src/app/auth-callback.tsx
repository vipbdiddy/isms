import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';

import { Button, ErrorNote, styles } from '../components/ui';
import { colors } from '../lib/theme';
import { useAuthLink } from '../lib/useAuthLink';

/** Where confirmation emails and social sign-in send people back into the app (isms://auth-callback, or .../app/auth-callback on the web). */
export default function AuthCallback() {
  const status = useAuthLink();

  useEffect(() => {
    if (status.state === 'done') router.dismissTo('/');
  }, [status.state]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {status.state === 'failed' ? (
        <>
          <Text style={styles.heading}>That didn’t work</Text>
          <ErrorNote message={status.error} />
          <Button title="Back to sign in" onPress={() => router.replace('/account')} />
        </>
      ) : (
        <>
          <Text style={styles.heading}>Signing you in…</Text>
          <ActivityIndicator color={colors.accent} />
        </>
      )}
    </ScrollView>
  );
}
