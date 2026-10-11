import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../lib/theme';
import type { LovedOne } from '../lib/types';

/** Their photo if there is one, otherwise the first letter of their name. */
export function Avatar({ lovedOne, size = 48 }: { lovedOne: Pick<LovedOne, 'name' | 'photoUri'>; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (lovedOne.photoUri) {
    return <Image source={{ uri: lovedOne.photoUri }} style={[round, styles.photo]} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[round, styles.placeholder]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{lovedOne.name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { backgroundColor: colors.border },
  placeholder: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: colors.accent },
});
