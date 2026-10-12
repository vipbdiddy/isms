import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Empty, ErrorNote, styles } from '../components/ui';
import { useStore } from '../lib/store';
import { cardStyle, colors, radius, space } from '../lib/theme';
import { timeAgo } from '../lib/time';
import type { ReviewItem } from '../lib/types';

const KIND_LABELS = { ism: 'Quote or story', loved_one: 'Loved one' } as const;

/** Reviewers only: shared memories held for their words, or reported by people who saw them. */
export default function ReviewScreen() {
  const { isAdmin, loadReviewItems, review } = useStore();
  const [items, setItems] = useState<ReviewItem[]>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      setItems(await loadReviewItems());
    } catch (e) {
      console.warn('Could not load the review list', e);
      setError('Couldn’t load the review list. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [loadReviewItems]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return <Empty title="Only reviewers can see this page." />;

  const decide = async (item: ReviewItem, allow: boolean) => {
    setError(undefined);
    try {
      await review(item, allow);
      setItems((list) => list?.filter((i) => i.id !== item.id));
    } catch (e) {
      console.warn('Could not save the decision', e);
      setError('Couldn’t save that. Check your connection and try again.');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}>
      <Text style={styles.muted}>
        These are shared with friends or everyone, and only their owner can see them until you decide. Allow anything
        kind or harmless. Remove anything that could hurt, accuse or embarrass someone, even if it’s true.
      </Text>
      {error ? <ErrorNote message={error} /> : null}
      {items?.length === 0 ? (
        <Empty title="Nothing waiting. Memories that might hurt someone, and anything people report, will show up here." />
      ) : null}
      {items?.map((item) => (
        <View key={item.id} style={local.card}>
          <Text style={local.kind}>{KIND_LABELS[item.kind]}</Text>
          <Text style={local.whose}>
            {item.kind === 'ism' ? `About ${item.lovedOneName}` : item.lovedOneName} · shared by{' '}
            {item.ownerName || 'someone'} with {item.visibility === 'public' ? 'everyone' : 'their friends'} ·{' '}
            {timeAgo(item.createdAt)}
          </Text>
          {item.title ? <Text style={local.title}>{item.title}</Text> : null}
          {item.body ? <Text style={styles.body}>{item.kind === 'ism' && !item.title ? `“${item.body}”` : item.body}</Text> : null}
          {item.context ? <Text style={[styles.muted, { fontStyle: 'italic' }]}>{item.context}</Text> : null}
          <View style={local.why}>
            <Ionicons name={item.reportCount ? 'flag-outline' : 'search-outline'} size={16} color={colors.danger} />
            <Text style={local.whyText}>
              {item.reportCount
                ? `Reported by ${item.reportCount} ${item.reportCount === 1 ? 'person' : 'people'}` +
                  (item.reasons.length ? `: ${[...new Set(item.reasons)].join(', ')}` : '')
                : 'Held because some of its words can be hurtful'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Allow" icon="checkmark" onPress={() => decide(item, true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Remove" icon="eye-off-outline" variant="danger" onPress={() => decide(item, false)} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  card: { ...cardStyle, padding: space.lg, gap: space.sm },
  kind: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  whose: { fontSize: 13, color: colors.accent, fontWeight: '500' },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  why: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerSoft,
  },
  whyText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.danger },
});
