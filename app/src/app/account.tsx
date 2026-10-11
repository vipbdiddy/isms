import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';

import { Button, ErrorNote, Field, styles } from '../components/ui';
import {
  friendlyAuthError,
  resendConfirmation,
  sendPasswordReset,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from '../lib/auth';
import { SOCIAL_PROVIDERS, type SocialProvider } from '../lib/config';
import { colors } from '../lib/theme';

/** checkEmail: waiting for the person to open the confirmation link; resetSent: the reset link. */
type Mode = 'signIn' | 'signUp' | 'checkEmail' | 'forgot' | 'resetSent';

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  facebook: 'Continue with Facebook',
};

const TITLES: Record<Mode, string> = {
  signIn: 'Sign in',
  signUp: 'Create your account',
  checkEmail: 'Check your email',
  forgot: 'Reset your password',
  resetSent: 'Check your email',
};

export default function Account() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  const go = (next: Mode) => {
    setMode(next);
    setError(undefined);
    setInfo(undefined);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const cleanEmail = email.trim().toLowerCase();
  // Social sign-in opens the phone's browser and returns to the app; the web version can't do that.
  const providers = Platform.OS === 'web' ? [] : SOCIAL_PROVIDERS;
  const entering = mode === 'signIn' || mode === 'signUp';
  const waiting = mode === 'checkEmail' || mode === 'resetSent';

  const submit = () =>
    run(async () => {
      if (mode === 'signIn') {
        await signInWithEmail(cleanEmail, password);
        done();
      } else if (mode === 'signUp') {
        if (await signUpWithEmail(cleanEmail, password)) done();
        else go('checkEmail');
      } else if (mode === 'forgot') {
        await sendPasswordReset(cleanEmail);
        go('resetSent');
      }
    });

  const canSubmit = cleanEmail.includes('@') && (mode === 'forgot' || password.length >= 6);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{TITLES[mode]}</Text>

      {entering && (
        <Text style={styles.muted}>
          Your loved ones, quotes and stories are saved to your account, so they're safe if you change phones.
        </Text>
      )}

      {entering && providers.length > 0 && (
        <View style={{ gap: 8 }}>
          {providers.map((p) => (
            <Button
              key={p}
              title={PROVIDER_LABELS[p]}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                run(async () => {
                  if (await signInWithProvider(p)) router.dismissTo('/');
                })
              }
            />
          ))}
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 4 }]}>or use your email</Text>
        </View>
      )}

      {mode === 'checkEmail' && (
        <Text style={styles.body}>
          We sent a link to {cleanEmail}. Open it on this phone to finish creating your account. If you open it on a
          computer, come back here afterwards and sign in.
        </Text>
      )}
      {mode === 'resetSent' && (
        <Text style={styles.body}>
          If there's an account for {cleanEmail}, we sent it a link. Open it on this phone to choose a new password.
        </Text>
      )}
      {info ? <Text style={[styles.body, { color: colors.sage }]}>{info}</Text> : null}

      {!waiting && (
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
      )}
      {entering && (
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
          hint={mode === 'signUp' ? 'At least 6 characters.' : undefined}
        />
      )}

      {error ? <ErrorNote message={error} /> : null}

      {!waiting && (
        <Button
          title={busy ? 'One moment…' : { signIn: 'Sign in', signUp: 'Create account', forgot: 'Send reset link' }[mode]}
          onPress={submit}
          disabled={!canSubmit || busy}
        />
      )}

      <View style={{ gap: 12, alignItems: 'center', marginTop: 8 }}>
        {mode === 'signIn' && (
          <>
            <Text style={link} onPress={() => go('signUp')}>
              New here? Create an account
            </Text>
            <Text style={link} onPress={() => go('forgot')}>
              Forgot your password?
            </Text>
          </>
        )}
        {mode === 'signUp' && (
          <Text style={link} onPress={() => go('signIn')}>
            Already have an account? Sign in
          </Text>
        )}
        {mode === 'checkEmail' && (
          <Text
            style={link}
            onPress={() =>
              run(async () => {
                await resendConfirmation(cleanEmail);
                setInfo(`We sent a new link to ${cleanEmail}.`);
              })
            }>
            Send the link again
          </Text>
        )}
        {mode !== 'signIn' && mode !== 'signUp' && (
          <Text style={link} onPress={() => go('signIn')}>
            Back to sign in
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const link = { color: colors.accent, fontSize: 15, fontWeight: '600' as const };
