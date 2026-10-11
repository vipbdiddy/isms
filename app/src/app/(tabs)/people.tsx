import { router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { LovedOneRow } from '../../components/LovedOneRow';
import { Button, Empty, styles } from '../../components/ui';
import { canSee } from '../../lib/advice';
import { useStore } from '../../lib/store';

export default function People() {
  const { lovedOnes, isms, userId } = useStore();
  const add = () => router.push(userId ? '/loved-one/edit' : '/account');
  const mine = lovedOnes.filter((l) => l.ownerId === userId);
  const shared = lovedOnes.filter((l) => l.ownerId !== userId && l.visibility === 'public');
  const countFor = (id: string) =>
    isms.filter((i) => i.lovedOneId === id && canSee(i, lovedOnes.find((l) => l.id === id), userId)).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Button title={userId ? '+ Add a loved one' : 'Sign in to add a loved one'} onPress={add} />

      <Text style={styles.subheading}>Yours</Text>
      {mine.length === 0 ? (
        <Empty title="Add the people you miss, the things they always used to say, and the stories you tell about them." />
      ) : (
        mine.map((l) => <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} mine />)
      )}

      <Text style={styles.subheading}>Shared by other families</Text>
      {shared.map((l) => (
        <LovedOneRow key={l.id} lovedOne={l} count={countFor(l.id)} mine={false} />
      ))}
    </ScrollView>
  );
}
