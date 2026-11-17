import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '../lib/store';
import { space } from '../lib/theme';

/** A quote's or story's picture, full size on black. Tapping anywhere, or the cross, closes it. */
export default function PictureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isms, getLovedOne, loaded } = useStore();
  const insets = useSafeAreaInsets();
  const ism = isms.find((i) => i.id === id);
  const lovedOne = ism ? getLovedOne(ism.lovedOneId) : undefined;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const what = ism?.kind === 'story' ? 'story' : 'quote';

  return (
    <View style={local.screen}>
      <StatusBar style="light" />
      {ism?.pictureUri ? (
        <Pressable style={local.fill} onPress={close} accessible={false}>
          <Image
            source={{ uri: ism.pictureUri }}
            style={local.fill}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessibilityLabel={lovedOne ? `Picture with a ${what} about ${lovedOne.name}` : `Picture with a ${what}`}
          />
        </Pressable>
      ) : (
        <View style={[local.fill, local.center]}>
          <Text style={local.message}>{loaded ? 'We couldn’t find this picture.' : 'Loading…'}</Text>
        </View>
      )}
      <Pressable
        onPress={close}
        hitSlop={12}
        style={[local.close, { top: insets.top + space.sm }]}
        accessibilityRole="button"
        accessibilityLabel="Close">
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  message: { color: '#fff', fontSize: 16, textAlign: 'center' },
  close: {
    position: 'absolute',
    right: space.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});
