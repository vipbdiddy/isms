import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentComposer, CommentList } from '../../components/Comments';
import { IsmCard } from '../../components/IsmCard';
import { useKeyboardShown } from '../../components/KeyboardAware';
import { LikedBy } from '../../components/Reactions';
import { Empty, styles } from '../../components/ui';
import { canSee } from '../../lib/advice';
import { COMMUNITY_OWNER } from '../../lib/seed';
import { useStore } from '../../lib/store';
import { colors, space } from '../../lib/theme';

/** A quote or story on its own, with who liked it and its comments. */
export default function IsmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isms, getLovedOne, viewer, loaded } = useStore();
  const insets = useSafeAreaInsets();
  const keyboardShown = useKeyboardShown();
  const ism = isms.find((i) => i.id === id);
  const lovedOne = ism ? getLovedOne(ism.lovedOneId) : undefined;

  if (!ism || !canSee(ism, lovedOne, viewer)) {
    return <Empty title={loaded ? 'We couldn’t find this memory. It may have been deleted or made private.' : 'Loading…'} />;
  }
  const target = { ismId: ism.id };

  // The examples live in the app, not with everyone's memories, so they can't be liked or commented on.
  if (ism.ownerId === COMMUNITY_OWNER) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: lovedOne?.name ?? '' }} />
        <IsmCard ism={ism} inPost />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: lovedOne?.name ?? '' }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <IsmCard ism={ism} showTime inPost />
        <LikedBy target={target} />
        <Text style={styles.subheading}>Comments</Text>
        <CommentList target={target} memoryOwnerIds={lovedOne ? [ism.ownerId, lovedOne.ownerId] : [ism.ownerId]} />
      </ScrollView>
      {/* Above the keyboard, there's no navigation bar to keep clear of. */}
      <View style={[local.composer, { paddingBottom: space.md + (keyboardShown ? 0 : insets.bottom) }]}>
        <CommentComposer target={target} />
      </View>
    </View>
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
