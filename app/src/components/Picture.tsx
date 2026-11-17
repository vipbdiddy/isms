import { Image, Pressable, StyleSheet } from 'react-native';

import { pictureAspect } from '../lib/pictures';
import { colors, radius } from '../lib/theme';

/**
 * A picture with a quote or story, in its own shape (trimmed if it's very tall or wide). With `onPress`,
 * tapping it opens it, and `label` says what it is to screen readers.
 */
export function Picture({
  uri,
  width,
  height,
  label,
  onPress,
}: {
  uri: string;
  width?: number;
  height?: number;
  label: string;
  onPress?: () => void;
}) {
  const image = (
    <Image
      source={{ uri }}
      style={[local.picture, { aspectRatio: pictureAspect(width, height) }]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      accessible={!onPress}
      accessibilityLabel={onPress ? undefined : label}
    />
  );
  if (!onPress) return image;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityHint="Opens it full size"
      style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {image}
    </Pressable>
  );
}

const local = StyleSheet.create({
  picture: { width: '100%', borderRadius: radius.md, backgroundColor: colors.sageSoft },
});
