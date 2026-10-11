import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, space } from '../lib/theme';
import { TOPICS } from '../lib/topics';
import type { KindFilter, Scope } from '../lib/types';

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
  ['mine', 'My loved ones'],
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

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
      ]}>
      <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextAlt, variant === 'danger' && { color: colors.danger }]}>
        {title}
      </Text>
    </Pressable>
  );
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
  heading: { fontSize: 22, fontWeight: '700', color: colors.ink },
  subheading: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: space.md },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  scrollRow: { gap: space.sm, paddingRight: space.lg },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 14, color: colors.muted, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '700' },
  button: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonTextAlt: { color: colors.accent },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.muted },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  error: { fontSize: 14, color: colors.danger, lineHeight: 20 },
  confirmBox: { gap: space.md, padding: space.lg, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.card },
  emptyTitle: { fontSize: 16, color: colors.muted, textAlign: 'center' },
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
