import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { canDeleteComment } from '../lib/social';
import { useStore } from '../lib/store';
import { colors, radius, space } from '../lib/theme';
import { timeAgo } from '../lib/time';
import type { Comment, Target } from '../lib/types';
import { Avatar } from './Avatar';
import { NameField } from './NameField';
import { ReportPanel, ReviewNote } from './ReportPanel';
import { openPerson } from './SharedBy';
import { Button, ErrorNote, TextButton, styles as ui } from './ui';

/** The longest comment the database accepts. */
const MAX_COMMENT = 1000;

/** The comments on a quote, story or loved one, oldest first. `memoryOwnerId` may delete any of them. */
export function CommentList({ target, memoryOwnerId }: { target: Target; memoryOwnerId: string }) {
  const { commentsOn, userId } = useStore();
  const comments = commentsOn(target);
  if (comments.length === 0) {
    return <Text style={ui.muted}>{userId ? 'No comments yet. Be the first to say something kind.' : 'No comments yet.'}</Text>;
  }
  return (
    <View style={{ gap: space.md }}>
      {comments.map((comment) => (
        <CommentRow key={comment.id} comment={comment} memoryOwnerId={memoryOwnerId} />
      ))}
    </View>
  );
}

function CommentRow({ comment, memoryOwnerId }: { comment: Comment; memoryOwnerId: string }) {
  const { userId, nameOf, deleteComment, reportComment } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string>();
  const mine = comment.authorId === userId;
  const name = nameOf(comment.authorId) || (mine ? 'You' : 'Someone');
  const canDelete = canDeleteComment(comment, userId, memoryOwnerId);
  const canReport = !!userId && !mine;

  if (reported) {
    return (
      <View style={[styles.bubble, { flexDirection: 'row', gap: space.sm, alignItems: 'center' }]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.sage} />
        <Text style={[ui.body, { flex: 1 }]}>Thanks. It’s hidden for you now, and someone at Ism’s will take a look.</Text>
      </View>
    );
  }

  const remove = async () => {
    setError(undefined);
    try {
      await deleteComment(comment);
    } catch (e) {
      console.warn('Could not delete comment', e);
      setError('Couldn’t delete it. Check your connection and try again.');
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={() => openPerson(comment.authorId)} accessibilityRole="link" accessibilityLabel={name}>
        <Avatar lovedOne={{ name }} size={34} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.bubble}>
          <Text style={styles.meta}>
            <Text style={styles.author} onPress={() => openPerson(comment.authorId)} accessibilityRole="link">
              {name}
            </Text>
            {` · ${timeAgo(comment.createdAt)}`}
          </Text>
          <Text style={ui.body}>{comment.body}</Text>
        </View>
        {mine ? <ReviewNote status={comment.reviewStatus} /> : null}
        {confirming ? (
          <View style={styles.actions}>
            <Text style={ui.muted}>Delete this comment?</Text>
            <TextButton title="Cancel" color={colors.muted} onPress={() => setConfirming(false)} />
            <TextButton title="Delete" color={colors.danger} onPress={remove} />
          </View>
        ) : canDelete || (canReport && !reporting) ? (
          <View style={styles.actions}>
            {canDelete ? <TextButton title="Delete" color={colors.muted} onPress={() => setConfirming(true)} /> : null}
            {canReport && !reporting ? <TextButton title="Report" color={colors.muted} onPress={() => setReporting(true)} /> : null}
          </View>
        ) : null}
        {reporting ? (
          <ReportPanel
            onCancel={() => setReporting(false)}
            onReport={async (reason) => {
              await reportComment(comment, reason);
              setReported(true);
            }}
          />
        ) : null}
        {error ? <ErrorNote message={error} /> : null}
      </View>
    </View>
  );
}

/** Where people write a comment. Asks them to sign in, or to choose a name, first. */
export function CommentComposer({ target }: { target: Target }) {
  const { userId, profile, addComment } = useStore();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  if (!userId) return <Button title="Sign in to comment" variant="secondary" onPress={() => router.push('/account')} />;
  if (!profile) return null;
  if (!profile.displayName.trim()) {
    return (
      <View style={{ gap: space.sm }}>
        <Text style={ui.body}>Add your name first, so people know who’s commenting.</Text>
        <NameField />
      </View>
    );
  }

  const body = text.trim();
  const send = async () => {
    if (!body || sending) return;
    setSending(true);
    setError(undefined);
    // Empty the box straight away, so anything typed while this one posts isn't wiped when it's done.
    setText('');
    try {
      await addComment(target, body);
    } catch (e) {
      console.warn('Could not comment', e);
      setText((typed) => typed || body);
      const message = String((e as { message?: unknown } | null)?.message ?? '');
      setError(
        /a lot of comments/.test(message)
          ? 'You’ve written a lot of comments. Try again in a little while.'
          : 'Couldn’t post your comment. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={`Comment as ${profile.displayName.trim().split(/\s+/)[0]}…`}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_COMMENT}
          accessibilityLabel="Write a comment"
        />
        <Pressable
          onPress={send}
          disabled={!body || sending}
          hitSlop={8}
          style={[styles.send, (!body || sending) && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Post comment">
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      {sending ? <Text style={ui.hint}>Posting…</Text> : null}
      {error ? <ErrorNote message={error} /> : null}
      {text.length > MAX_COMMENT - 100 ? <Text style={ui.hint}>{MAX_COMMENT - text.length} characters left</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  meta: { fontSize: 13, color: colors.muted },
  author: { fontWeight: '700', color: colors.ink },
  actions: { flexDirection: 'row', gap: space.lg, alignItems: 'center', paddingLeft: space.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingLeft: space.lg,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 6, maxHeight: 140 },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
