import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentComposer, CommentList } from '../../components/Comments';
import { KeyboardAware } from '../../components/KeyboardAware';
import { LovedOneRow } from '../../components/LovedOneRow';
import { LikedBy } from '../../components/Reactions';
import { Empty, styles } from '../../components/ui';
import { canSeeLovedOne } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors, space } from '../../lib/theme';

/** Comments on a loved one: kind words and memories for their family. */
export default function LovedOneComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getLovedOne, viewer, loaded } = useStore();
  const insets = useSafeAreaInsets();
  const lovedOne = getLovedOne(id);

  if (!lovedOne || !canSeeLovedOne(lovedOne, viewer)) {
    return <Empty title={loaded ? 'We couldn’t find this person.' : 'Loading…'} />;
  }
  const target = { lovedOneId: lovedOne.id };

  return (
    <KeyboardAware>
      <Stack.Screen options={{ title: 'Comments' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LovedOneRow lovedOne={lovedOne} />
        <LikedBy target={target} />
        <Text style={styles.muted}>A kind word for their family, or a memory of {lovedOne.name}.</Text>
        <CommentList target={target} memoryOwnerId={lovedOne.ownerId} />
      </ScrollView>
      <View style={[local.composer, { paddingBottom: space.md + insets.bottom }]}>
        <CommentComposer target={target} />
      </View>
    </KeyboardAware>
  );
}

const local = StyleSheet.create({
  composer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
