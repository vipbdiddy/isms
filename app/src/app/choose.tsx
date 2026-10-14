import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { LovedOneRow } from '../components/LovedOneRow';
import { Button, Empty, styles } from '../components/ui';
import { canSee, lovedOnesToAddTo } from '../lib/advice';
import { useStore } from '../lib/store';

/**
 * "Who is it about?": the loved one to add a story or quote to (your own, or someone else's that you may
 * add to), or, with `for=invite`, whose memories to invite people to add.
 */
export default function Choose() {
  const { for: purpose } = useLocalSearchParams<{ for?: string }>();
  const { lovedOnes, isms, viewer, userId, loaded } = useStore();
  const inviting = purpose === 'invite';

  if (!userId) {
    return (
      <Empty title="Sign in first.">
        <Button title="Sign in or create an account" onPress={() => router.replace('/account')} />
      </Empty>
    );
  }

  if (!loaded) return <Empty title="Loading…" />;

  const mine = lovedOnes.filter((l) => l.ownerId === userId);
  const others = inviting ? [] : lovedOnesToAddTo(lovedOnes, isms, viewer).filter((l) => l.ownerId !== userId);
  const pick = (id: string) =>
    inviting
      ? router.replace({ pathname: '/loved-one/invite', params: { id } })
      : router.replace({ pathname: '/ism/edit', params: { lovedOneId: id } });
  const countFor = (id: string) =>
    isms.filter((i) => i.lovedOneId === id && canSee(i, lovedOnes.find((l) => l.id === id), viewer)).length;

  if (mine.length + others.length === 0) {
    return (
      <Empty
        title={
          inviting
            ? 'Add the person you’re remembering first. Then you can invite the people who knew them.'
            : 'Add the person you’re remembering first. Then add the things they always said and the stories you tell.'
        }>
        <Button title="Add a loved one" icon="add" onPress={() => router.replace('/loved-one/edit')} />
      </Empty>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        {inviting ? 'Whose memories would you like people to add?' : 'Who is your story or quote about?'}
      </Text>
      {mine.length > 0 ? (
        <>
          <Text style={styles.subheading}>Yours</Text>
          {mine.map((l) => (
            <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} onPress={() => pick(l.id)} />
          ))}
        </>
      ) : null}
      {others.length > 0 ? (
        <>
          <Text style={styles.subheading}>Shared with you</Text>
          {others.map((l) => (
            <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} onPress={() => pick(l.id)} />
          ))}
        </>
      ) : null}
      <Button title="Someone else" icon="add" variant="secondary" onPress={() => router.replace('/loved-one/edit')} />
    </ScrollView>
  );
}
