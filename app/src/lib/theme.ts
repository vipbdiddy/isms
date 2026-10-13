/** A soft teal-green palette: calm and light, never somber. */
export const colors = {
  background: '#F2F7F6',
  card: '#FFFFFF',
  ink: '#1E3A3A',
  muted: '#6A8584',
  accent: '#2A7F75',
  accentSoft: '#DCEFEC',
  sage: '#4F9473',
  sageSoft: '#E3F1EA',
  border: '#DDE9E7',
  danger: '#C2554F',
  dangerSoft: '#FBECEA',
  /** A liked heart. */
  heart: '#D9615B',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 10, md: 16, pill: 999 };

/** A gentle lift for cards, instead of heavy borders. */
export const cardStyle = {
  backgroundColor: colors.card,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
  boxShadow: '0 2px 8px rgba(30, 58, 58, 0.06)',
} as const;
