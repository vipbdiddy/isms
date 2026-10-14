import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO = require('../../assets/logo.png');
/** The logo image's width over its height. */
const ASPECT = 912 / 600;

/** The Isms logo: the word, with its halo and swoosh. */
export function Logo({ height, style }: { height: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      style={[{ height, width: Math.round(height * ASPECT) }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Isms"
    />
  );
}
