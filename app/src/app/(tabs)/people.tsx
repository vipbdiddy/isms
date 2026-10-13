import { router } from 'expo-router';
import { RefreshControl, ScrollView, Text } from 'react-native';

import { LovedOneRow } from '../../components/LovedOneRow';
import { Button, Empty, styles } from '../../components/ui';
import { canSee, canSeeLovedOne, sharedWithMyGroup } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function People() {
  const { lovedOnes, isms, userId, viewer, friendIds, loading, refresh } = useStore();
  const add = () => router.push(userId ? '/loved-one/edit' : '/account');
  const visible = lovedOnes.filter((l) => canSeeLovedOne(l, viewer));
  const mine = visible.filter((l) => l.ownerId === userId);
  const friends = visible.filter((l) => friendIds.has(l.ownerId));
  const groups = visible.filter((l) => l.ownerId !== userId && !friendIds.has(l.ownerId) && sharedWithMyGroup(l, viewer));
  const others = visible.filter(
    (l) => l.ownerId !== userId && !friendIds.has(l.ownerId) && !sharedWithMyGroup(l, viewer),
  );
  const countFor = (id: string) =>
    isms.filter((i) => i.lovedOneId === id && canSee(i, lovedOnes.find((l) => l.id === id), viewer)).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}>
      <Button title={userId ? 'Add a loved one' : 'Sign in to add a loved one'} icon="add" onPress={add} />

      <Text style={styles.subheading}>Yours</Text>
      {mine.length === 0 ? (
        <Empty title="Add the people you miss, the things they always used to say, and the stories you tell about them." />
      ) : (
        mine.map((l) => <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} />)
      )}

      {friends.length > 0 && (
        <>
          <Text style={styles.subheading}>From your friends</Text>
          {friends.map((l) => (
            <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} />
          ))}
        </>
      )}

      {groups.length > 0 && (
        <>
          <Text style={styles.subheading}>From your groups</Text>
          {groups.map((l) => (
            <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} />
          ))}
        </>
      )}

      <Text style={styles.subheading}>Shared by other families</Text>
      {others.map((l) => (
        <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} />
      ))}
    </ScrollView>
  );
}
