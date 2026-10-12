import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { cardStyle, colors, radius, space } from '../lib/theme';
import { TOPICS } from '../lib/topics';
import type { KindFilter, Scope, Visibility } from '../lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Horizontal (or wrapping) row of topic chips with multi-select. */
export function TopicPicker({
  selected,
  onToggle,
  wrap,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  wrap?: boolean;
}) {
  const chips = TOPICS.map((t) => (
    <Chip key={t.id} label={t.label} selected={selected.includes(t.id)} onPress={() => onToggle(t.id)} />
  ));
  if (wrap) return <View style={styles.wrapRow}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollRow}>
      {chips}
    </ScrollView>
  );
}

/** A row of mutually exclusive options, like iOS's segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map(([option, label]) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option }}
          style={[styles.segmentItem, value === option && styles.segmentItemActive]}>
          <Text style={[styles.segmentText, value === option && styles.segmentTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const SCOPES = [
  ['mine', 'Mine'],
  ['friends', 'Friends'],
  ['everyone', 'Everyone'],
] as const;

export function ScopeToggle({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return <Segmented options={SCOPES} value={value} onChange={onChange} />;
}

const KINDS = [
  ['all', 'All'],
  ['quote', 'Quotes'],
  ['story', 'Stories'],
] as const;

export function KindToggle({ value, onChange }: { value: KindFilter; onChange: (k: KindFilter) => void }) {
  return <Segmented options={KINDS} value={value} onChange={onChange} />;
}

const VISIBILITIES = [
  ['private', 'Just me'],
  ['friends', 'Friends'],
  ['public', 'Everyone'],
] as const;

const VISIBILITY_HINTS: Record<Visibility, string> = {
  private: 'Only you can see them and their memories.',
  friends: 'You and your friends on Ism’s can see them and their memories.',
  public: 'Anyone using Ism’s can see them and their memories, even people who aren’t signed in.',
};

/** Who can see a loved one, with a line explaining the choice. */
export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Who can see their memories?</Text>
      <Segmented options={VISIBILITIES} value={value} onChange={onChange} />
      <Text style={styles.hint}>
        {VISIBILITY_HINTS[value]}
        {value === 'private'
          ? ''
          : ' You can still keep single quotes or stories private. Anything that might hurt someone is checked by Ism’s before others see it.'}
      </Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  /** A compact button that sits beside other things, like "Add friend" in a list. */
  small?: boolean;
}) {
  const textColor = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        small && styles.buttonSmall,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
      ]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={textColor} /> : null}
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: textColor }]}>{title}</Text>
    </Pressable>
  );
}

/** A small text-only action, like "Change" or "Show me another". */
export function TextButton({ title, onPress, color = colors.accent }: { title: string; onPress: () => void; color?: string }) {
  return (
    <Text style={[styles.textButton, { color }]} onPress={onPress} accessibilityRole="button" suppressHighlighting>
      {title}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        {...input}
        style={[styles.input, input.multiline && styles.inputMultiline, input.style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  heading: { fontSize: 24, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  subheading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: space.md,
  },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  card: { ...cardStyle, padding: space.lg, gap: space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scrollRow: { gap: space.sm, paddingRight: space.lg },
  segment: { flexDirection: 'row', backgroundColor: colors.accentSoft, borderRadius: radius.pill, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.card, boxShadow: '0 1px 3px rgba(30, 58, 58, 0.12)' },
  segmentText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  segmentTextActive: { color: colors.accent, fontWeight: '700' },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  buttonSecondary: { backgroundColor: colors.accentSoft },
  buttonDanger: { backgroundColor: colors.dangerSoft },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 14, gap: 6 },
  buttonTextSmall: { fontSize: 14 },
  textButton: { fontSize: 15, fontWeight: '600', paddingVertical: space.xs },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  confirmBox: { ...cardStyle, gap: space.md, padding: space.lg, borderColor: colors.danger },
  emptyTitle: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 22 },
});

/** A destructive button that asks "are you sure?" in place, so it works the same on phones and the web. */
export function DangerButton({
  title,
  message,
  confirmTitle,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmTitle: string;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button title={title} variant="danger" onPress={() => setAsking(true)} />;
  return (
    <View style={styles.confirmBox}>
      <Text style={styles.body}>{message}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={() => setAsking(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={confirmTitle} variant="danger" onPress={onConfirm} />
        </View>
      </View>
    </View>
  );
}
