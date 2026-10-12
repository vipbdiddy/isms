import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { IsmCard } from '../../components/IsmCard';
import { Empty, Field, KindToggle, ScopeToggle, TopicPicker, styles } from '../../components/ui';
import { matchesKind, visibleIsms } from '../../lib/advice';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import type { KindFilter } from '../../lib/types';
import { useScope } from '../../lib/useScope';

export default function Browse() {
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const { isms, lovedOnes, viewer, getLovedOne, loading, refresh } = useStore();
  const [scope, setScope] = useScope();
  const [topics, setTopics] = useState<string[]>(topic ? [topic] : []);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');

  // Arriving from a topic link on Home narrows to that topic.
  useEffect(() => {
    if (topic) setTopics([topic]);
  }, [topic]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleIsms(isms, lovedOnes, viewer, scope).filter(
      (ism) =>
        matchesKind(ism, kind) &&
        (topics.length === 0 || ism.topics.some((t) => topics.includes(t))) &&
        (!q ||
          `${ism.title ?? ''} ${ism.text} ${ism.context ?? ''} ${getLovedOne(ism.lovedOneId)?.name ?? ''}`.toLowerCase().includes(q)),
    );
  }, [isms, lovedOnes, viewer, scope, kind, topics, search, getLovedOne]);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      data={results}
      keyExtractor={(ism) => ism.id}
      renderItem={({ item }) => <IsmCard ism={item} />}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <ScopeToggle value={scope} onChange={setScope} />
          <KindToggle value={kind} onChange={setKind} />
          <Field label="Search" placeholder="A word, a phrase, a name…" value={search} onChangeText={setSearch} />
          <TopicPicker
            selected={topics}
            onToggle={(id) => setTopics((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))}
          />
        </View>
      }
      ListEmptyComponent={
        <Empty
          title={
            scope === 'everyone'
              ? 'Nothing matches yet.'
              : `Nothing from ${scope === 'mine' ? 'your loved ones' : 'you and your friends'} matches. Add more, or switch to Everyone.`
          }
        />
      }
    />
  );
}
