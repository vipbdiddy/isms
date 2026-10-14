import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LovedOneRow } from '../../components/LovedOneRow';
import { openGroup } from '../../components/SharedBy';
import { Button, Card, Empty, ErrorNote, styles } from '../../components/ui';
import { WEB_APP_URL } from '../../lib/config';
import { shareMessage } from '../../lib/share';
import { useStore } from '../../lib/store';
import { cardStyle, colors, radius, space } from '../../lib/theme';

/**
 * Asking people who knew a loved one to add their memories: a message with a link to the loved one's
 * page, and what the people invited will need to see it.
 */
export default function InviteToRemember() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLovedOne, getGroup, userId, loading } = useStore();
  const [sent, setSent] = useState<'shared' | 'copied'>();
  const [error, setError] = useState<string>();
  const lovedOne = getLovedOne(id);

  if (!lovedOne || lovedOne.ownerId !== userId) {
    return <Empty title={loading ? 'Loading…' : 'We couldn’t find this person.'} />;
  }

  const name = lovedOne.name.trim();
  const message =
    `I’m gathering memories of ${name} on Isms: the things they always used to say, and the stories we tell ` +
    `about them. Would you add one? ${WEB_APP_URL}/loved-one/${lovedOne.id}`;
  const group = lovedOne.groupId ? getGroup(lovedOne.groupId) : undefined;
  const changeSharing = () => router.push({ pathname: '/loved-one/edit', params: { id: lovedOne.id } });

  const share = async () => {
    setError(undefined);
    try {
      const how = await shareMessage(message);
      if (how !== 'cancelled') setSent(how);
    } catch (e) {
      console.warn('Could not share', e);
      setError('Couldn’t share it. Copy the message above and send it yourself.');
    }
  };

  // Private, or closed to others' memories: there's something to change first.
  const blocked = lovedOne.visibility === 'private' || lovedOne.allowContributions === false;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LovedOneRow lovedOne={lovedOne} />
      <Text style={styles.body}>
        Send this to people who knew {name}. They can add the things {name} used to say and the stories they remember,
        so it’s all in one place.
      </Text>

      {lovedOne.visibility === 'private' ? (
        <Card style={local.warning}>
          <Text style={styles.body}>
            Only you can see {name} right now, so the people you invite couldn’t open their page. Choose who can see them
            first: your friends, a group, or everyone.
          </Text>
          <Button title="Choose who can see them" onPress={changeSharing} />
        </Card>
      ) : lovedOne.allowContributions === false ? (
        <Card style={local.warning}>
          <Text style={styles.body}>
            {name}’s page doesn’t let others add memories right now. Turn on “Let others add memories” first.
          </Text>
          <Button title="Change it" onPress={changeSharing} />
        </Card>
      ) : (
        <View style={local.how}>
          <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.body, { flex: 1 }]}>
            {lovedOne.visibility === 'public'
              ? `Anyone with the link can see ${name}. They’ll sign in, or make an account, to add a memory.`
              : lovedOne.visibility === 'friends'
                ? `${name} is shared with your friends. After they join Isms, add each other as friends in the Friends tab, so they can see ${name} and add their memories.`
                : `${name} is shared with ${group?.name ?? 'a group'}. After they join Isms, invite them to the group, so they can see ${name} and add their memories.`}
          </Text>
        </View>
      )}
      {lovedOne.visibility === 'group' && group && !blocked ? (
        <Button title={`Open ${group.name}`} icon="people-outline" variant="secondary" onPress={() => openGroup(group.id)} />
      ) : null}

      {blocked ? null : (
        <>
          <Text style={styles.subheading}>The message</Text>
          <View style={local.message}>
            <Text style={styles.body} selectable>
              {message}
            </Text>
          </View>
          <Button title="Share the invitation" icon="share-outline" onPress={share} />
          {sent ? (
            <Text style={[styles.body, { color: colors.sage }]} accessibilityRole="alert">
              {sent === 'copied'
                ? 'Copied. Paste it into a text or an email.'
                : `Sent. Thank you for gathering ${name}’s memories.`}
            </Text>
          ) : null}
          {error ? <ErrorNote message={error} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  warning: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  how: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  message: { ...cardStyle, padding: space.lg },
});
