import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space } from '../lib/theme';
import { Button, Chip, ErrorNote, styles } from './ui';

const REASONS = ['Hurtful or unkind', 'Not true', 'About me or my family', 'Something else'];

/** Asks why something is being reported, then sends it. */
export function ReportPanel({ onReport, onCancel }: { onReport: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState<string>();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  const send = async () => {
    if (!reason) return;
    setSending(true);
    setError(undefined);
    try {
      await onReport(reason);
    } catch (e) {
      console.warn('Could not report', e);
      setError('Couldn’t send the report. Check your connection and try again.');
      setSending(false);
    }
  };

  return (
    <View style={local.panel}>
      <Text style={[styles.body, { fontWeight: '600' }]}>Why are you reporting this?</Text>
      <View style={styles.wrapRow}>
        {REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Text style={styles.hint}>It will be hidden for you right away, and someone at Isms will take a look.</Text>
      {error ? <ErrorNote message={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={sending ? 'Sending…' : 'Report'} variant="danger" onPress={send} disabled={!reason || sending} />
        </View>
      </View>
    </View>
  );
}

/** Says that the owner's shared memory is waiting for a review, or was hidden from others. */
export function ReviewNote({ status }: { status?: string }) {
  if (status !== 'pending' && status !== 'removed') return null;
  const waiting = status === 'pending';
  return (
    <View style={[local.note, !waiting && { backgroundColor: colors.dangerSoft }]}>
      <Ionicons
        name={waiting ? 'time-outline' : 'eye-off-outline'}
        size={16}
        color={waiting ? colors.accent : colors.danger}
      />
      <Text style={[local.noteText, !waiting && { color: colors.danger }]}>
        {waiting
          ? 'Waiting for a quick review. Only you can see it until then.'
          : 'Hidden from others: Isms found it might be hurtful. Only you can see it.'}
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  note: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.accent, fontWeight: '500' },
});
