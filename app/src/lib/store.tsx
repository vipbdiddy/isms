import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Viewer } from './advice';
import * as db from './db';
import { contactEmailHashes } from './contacts';
import { moveDeviceDataToAccount, readLegacy } from './migrate';
import { deletePhoto, photoLinks, uploadPhoto, type PickedPhoto } from './photos';
import { COMMUNITY_OWNER, SEED_ISMS, SEED_LOVED_ONES } from './seed';
import { byTarget, knowsSharer, targetKey, type Circle } from './social';
import { supabase } from './supabase';
import type {
  Comment,
  CreateGroupResult,
  FriendRequestResult,
  Friendship,
  Group,
  GroupInviteResult,
  GroupMember,
  Ism,
  IsmInput,
  Like,
  LovedOne,
  LovedOneInput,
  PersonResult,
  Profile,
  ReviewItem,
  Settings,
  Target,
} from './types';

const SETTINGS_KEY = 'isms/settings';
/** Hearts on the example families, which live in the app rather than the database. */
const SAVED_EXAMPLES_KEY = 'isms/saved-examples';

const DEFAULT_SETTINGS: Settings = { displayName: '', defaultScope: 'friends' };

/** Coming back to the app reloads when the last load is older than this. */
const STALE_AFTER_MS = 60_000;

/** How long a reported memory stays on screen (showing a thank-you) before it disappears. */
const REPORTED_FADE_MS = 4000;

const isExample = (id: string) => id.startsWith('seed-');

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  AsyncStorage.setItem(key, JSON.stringify(value)).catch((e) => console.warn(`Could not save ${key}`, e));
}

interface Store {
  /** Settings and sign-in have loaded; the screens can render. */
  ready: boolean;
  /** Quotes and stories are being fetched. */
  loading: boolean;
  /** Why the last fetch failed, if it did. */
  loadError?: string;
  session: Session | null;
  /** The signed-in person's id, or '' when signed out. */
  userId: string;
  settings: Settings;
  /** Your own loved ones, your friends' shared ones, and every public one from other families. */
  lovedOnes: LovedOne[];
  /** Everything you may see (filter further with `visibleIsms`). */
  isms: Ism[];
  savedIsmIds: Set<string>;
  /** The name others see and whether they can find you. Null when signed out or not loaded yet. */
  profile: Profile | null;
  /** Whether you review shared memories that are held or reported. */
  isAdmin: boolean;
  /** Reviewers only: how many shared memories are waiting for a look. */
  reviewCount: number;
  /** Why friends couldn't be loaded, if they couldn't. */
  friendsError?: string;
  /** Your friends and open friend requests, newest first. */
  friendships: Friendship[];
  friendIds: Set<string>;
  /** Who is looking, for the visibility rules in advice.ts. */
  viewer: Viewer;
  /** The name of someone you may see, or '' when it isn't known. */
  nameOf: (userId: string) => string;
  /**
   * Whether you may open someone's profile and see their name on what they share: yourself, your friends,
   * the people in your groups, and anyone with a public profile.
   */
  knows: (userId: string) => boolean;
  /** "Shared by Ann", "Shared by their family" or "An example"; undefined for your own. */
  sharedBy: (ownerId: string) => string | undefined;
  /** Groups you're in, by name. */
  groups: Group[];
  /** Invitations to join a group, waiting for your answer. */
  groupInvites: { group: Group; invitedBy?: string; createdAt: number }[];
  /** A group you're in or are invited to. */
  getGroup: (id: string) => Group | undefined;
  /** Who's in a group you're in, and who's invited, oldest first. */
  membersOf: (groupId: string) => GroupMember[];
  createGroup: (name: string) => Promise<CreateGroupResult>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  /** Owners only. Loved ones shared with it become private again. */
  deleteGroup: (groupId: string) => Promise<void>;
  inviteToGroup: (groupId: string, userId: string) => Promise<GroupInviteResult>;
  answerGroupInvite: (groupId: string, accept: boolean) => Promise<void>;
  /** Your loved ones shared with the group become private again. */
  leaveGroup: (groupId: string) => Promise<void>;
  /** The owner removes someone or takes back an invitation; whoever invited someone can take it back. */
  removeFromGroup: (groupId: string, userId: string) => Promise<void>;
  /** Who liked a quote, story or loved one, newest first. */
  likesOn: (target: Target) => Like[];
  likedByMe: (target: Target) => boolean;
  /** Returns false when the person has to sign in first. */
  toggleLike: (target: Target) => boolean;
  /** Comments on a quote, story or loved one, oldest first. */
  commentsOn: (target: Target) => Comment[];
  addComment: (target: Target, body: string) => Promise<Comment>;
  /** Your own comment, or anyone's on something you shared. */
  deleteComment: (comment: Comment) => Promise<void>;
  /** Report someone else's comment; it disappears for you right away. */
  reportComment: (comment: Comment, reason: string) => Promise<void>;
  /** Shown once after moving memories saved on this phone into the account. */
  notice?: string;
  dismissNotice: () => void;
  refresh: () => Promise<void>;
  getLovedOne: (id: string) => LovedOne | undefined;
  addLovedOne: (input: LovedOneInput, photo?: PickedPhoto) => Promise<LovedOne>;
  /** `photo`: a new photo, `null` to remove it, or undefined to leave it. */
  updateLovedOne: (id: string, patch: Partial<LovedOneInput>, photo?: PickedPhoto | null) => Promise<void>;
  deleteLovedOne: (id: string) => Promise<void>;
  addIsm: (input: IsmInput) => Promise<Ism>;
  updateIsm: (id: string, patch: Partial<IsmInput>) => Promise<void>;
  deleteIsm: (id: string) => Promise<void>;
  /** Returns false when the person has to sign in first. */
  toggleSaved: (ismId: string) => boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  /** People whose name contains `query`, who allow being found. */
  searchPeople: (query: string) => Promise<PersonResult[]>;
  /** Asks for permission, then finds which of your contacts use Ism's. Null when permission was refused. */
  findFromContacts: () => Promise<PersonResult[] | null>;
  sendFriendRequest: (userId: string) => Promise<FriendRequestResult>;
  answerFriendRequest: (otherId: string, accept: boolean) => Promise<void>;
  /** Unfriend someone, or take back a request you sent. */
  removeFriend: (otherId: string) => Promise<void>;
  setMyName: (name: string) => Promise<void>;
  setDiscoverable: (discoverable: boolean) => Promise<void>;
  setPublicProfile: (publicProfile: boolean) => Promise<void>;
  /** Report someone else's quote, story or loved one; it disappears for you right away. */
  report: (target: { ismId?: string; lovedOneId?: string }, reason: string) => Promise<void>;
  /** Reviewers only. */
  loadReviewItems: () => Promise<ReviewItem[]>;
  review: (item: ReviewItem, allow: boolean) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [lovedOnes, setLovedOnes] = useState<LovedOne[]>([]);
  const [isms, setIsms] = useState<Ism[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedExamples, setSavedExamples] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendsError, setFriendsError] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [groupList, setGroupList] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const userId = session?.user.id ?? '';

  // Settings, example hearts and the sign-in all come from the device first.
  useEffect(() => {
    (async () => {
      const [saved, legacy, examples, { data }] = await Promise.all([
        readJson<Settings>(SETTINGS_KEY),
        readLegacy(),
        readJson<string[]>(SAVED_EXAMPLES_KEY),
        supabase.auth.getSession(),
      ]);
      setSettings({ ...DEFAULT_SETTINGS, ...(saved ?? legacy?.settings) });
      setSavedExamples(examples ?? []);
      setSession(data.session);
      setReady(true);
    })().catch((e) => {
      console.warn('Could not start up', e);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const withPhotos = useCallback(async (list: LovedOne[]) => {
    const links = await photoLinks(list.flatMap((l) => (l.photoPath ? [l.photoPath] : [])));
    return list.map((l) => (l.photoPath ? { ...l, photoUri: links.get(l.photoPath) } : l));
  }, []);

  // Only the newest load may update the screen, so a slow one from before a sign-out can't win.
  const latestLoad = useRef(0);
  const lastLoadedAt = useRef(0);
  // Counts changes made on this phone. A load that was already on its way when something was added,
  // changed or removed may not include it, so it's thrown away and loaded again.
  const localChanges = useRef(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(async () => {
    const load = ++latestLoad.current;
    const changesAtStart = localChanges.current;
    setLoading(true);
    try {
      // Friends load separately, so trouble there never hides your own memories.
      const friendsLoad = userId
        ? db.fetchFriends(userId).catch((e: unknown) => {
            console.warn('Could not load friends', e);
            return null;
          })
        : Promise.resolve(null);
      const [data, friends] = await Promise.all([db.fetchAll(userId || null), friendsLoad]);
      const withLinks = await withPhotos(data.lovedOnes);
      const waiting = friends?.isAdmin
        ? await db.contentToReview().then(
            (items) => items.length,
            () => 0,
          )
        : 0;
      if (load !== latestLoad.current) return;
      if (localChanges.current !== changesAtStart) {
        void refreshRef.current();
        return;
      }
      setLovedOnes(withLinks);
      setIsms(data.isms);
      setSavedIds(data.savedIsmIds);
      setLikes(data.likes);
      setComments(data.comments);
      setLoadError(undefined);
      if (friends) {
        setProfile(friends.me);
        setProfiles(friends.others);
        setFriendships(friends.friendships);
        setGroupList(friends.groups);
        setGroupMembers(friends.groupMembers);
        setIsAdmin(friends.isAdmin);
        setReviewCount(waiting);
        setFriendsError(friends.me ? undefined : 'Your friends list isn’t ready yet. Pull down to try again.');
      } else if (userId) {
        setFriendsError('Couldn’t load your friends. Check your connection and pull down to try again.');
      }
      lastLoadedAt.current = Date.now();
    } catch (e) {
      if (load !== latestLoad.current) return;
      console.warn('Could not load', e);
      setLoadError('Couldn’t load memories. Check your connection and pull down to try again.');
    } finally {
      if (load === latestLoad.current) setLoading(false);
    }
  }, [userId, withPhotos]);

  // Coming back to the app after a while picks up what friends shared in the meantime.
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && lastLoadedAt.current > 0 && Date.now() - lastLoadedAt.current > STALE_AFTER_MS) {
        refreshRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  // Reload whenever someone signs in or out; on sign-in, bring over anything saved on this phone first.
  useEffect(() => {
    if (!ready) return;
    // Don't keep showing the previous account's memories while the new ones load.
    setLovedOnes([]);
    setIsms([]);
    setSavedIds([]);
    setProfile(null);
    setProfiles([]);
    setFriendships([]);
    setGroupList([]);
    setGroupMembers([]);
    setLikes([]);
    setComments([]);
    setFriendsError(undefined);
    setIsAdmin(false);
    setReviewCount(0);
    (async () => {
      if (userId) {
        try {
          const moved = await moveDeviceDataToAccount(userId);
          if (moved > 0) {
            setNotice(`Moved ${moved} ${moved === 1 ? 'loved one' : 'loved ones'} from this phone into your account.`);
          }
        } catch (e) {
          console.warn('Could not move device data', e);
        }
      }
      await refresh();
    })();
  }, [ready, userId, refresh]);

  const requireUser = useCallback(() => {
    if (!userId) throw new Error('Sign in first.');
    return userId;
  }, [userId]);

  const friendIds = useMemo(
    () => new Set(friendships.filter((f) => f.status === 'accepted').map((f) => f.otherId)),
    [friendships],
  );
  // The groups you're in, and everyone in them.
  const groupIds = useMemo(
    () => new Set(groupMembers.filter((m) => m.userId === userId && m.status === 'member').map((m) => m.groupId)),
    [groupMembers, userId],
  );
  const groupmateIds = useMemo(
    () =>
      new Set(
        groupMembers
          .filter((m) => m.status === 'member' && m.userId !== userId && groupIds.has(m.groupId))
          .map((m) => m.userId),
      ),
    [groupMembers, groupIds, userId],
  );
  const viewer = useMemo<Viewer>(() => ({ userId, friendIds, groupIds }), [userId, friendIds, groupIds]);
  const circle = useMemo<Circle>(
    () => ({
      userId,
      friendIds,
      groupmateIds,
      publicProfileIds: new Set(profiles.filter((p) => p.publicProfile).map((p) => p.id)),
    }),
    [userId, friendIds, groupmateIds, profiles],
  );
  const likesByTarget = useMemo(() => byTarget(likes), [likes]);
  const commentsByTarget = useMemo(() => byTarget(comments), [comments]);

  const store = useMemo<Store>(() => {
    const allLovedOnes = [...lovedOnes, ...SEED_LOVED_ONES];
    const byId = new Map(allLovedOnes.map((l) => [l.id, l]));
    const names = new Map(profiles.map((p) => [p.id, p.displayName.trim()]));
    if (profile) names.set(profile.id, profile.displayName.trim());
    const nameOf = (id: string) => names.get(id) ?? '';
    const knows = (id: string) => knowsSharer(id, circle);
    const groupsById = new Map(groupList.map((g) => [g.id, g]));
    const changedHere = () => {
      localChanges.current += 1;
    };
    /** Runs a change to groups, then reloads: groups decide what you can see. */
    const thenReload = async <T,>(change: () => Promise<T>) => {
      requireUser();
      const result = await change();
      await refresh();
      return result;
    };
    const replaceLovedOne = async (updated: LovedOne) => {
      const [withPhoto] = await withPhotos([updated]);
      changedHere();
      setLovedOnes((list) => list.map((l) => (l.id === updated.id ? withPhoto : l)));
    };

    return {
      ready,
      loading,
      loadError,
      session,
      userId,
      settings,
      lovedOnes: allLovedOnes,
      isms: [...isms, ...SEED_ISMS],
      savedIsmIds: new Set([...savedIds, ...savedExamples]),
      profile,
      isAdmin,
      reviewCount,
      friendsError,
      friendships,
      friendIds,
      viewer,
      nameOf,
      knows,
      sharedBy: (ownerId) => {
        if (ownerId === userId) return undefined;
        if (ownerId === COMMUNITY_OWNER) return 'An example';
        if (knows(ownerId)) return `Shared by ${nameOf(ownerId) || (friendIds.has(ownerId) ? 'a friend' : 'someone you know')}`;
        return 'Shared by their family';
      },
      groups: groupList.filter((g) => groupIds.has(g.id)),
      groupInvites: groupMembers
        .filter((m) => m.userId === userId && m.status === 'invited' && groupsById.has(m.groupId))
        .map((m) => ({ group: groupsById.get(m.groupId)!, invitedBy: m.invitedBy, createdAt: m.createdAt })),
      getGroup: (id) => groupsById.get(id),
      membersOf: (groupId) => groupMembers.filter((m) => m.groupId === groupId),
      createGroup: (name) => thenReload(() => db.createGroup(name)),
      renameGroup: (groupId, name) => thenReload(() => db.renameGroup(groupId, name)),
      deleteGroup: (groupId) => thenReload(() => db.deleteGroup(groupId)),
      inviteToGroup: (groupId, otherId) => thenReload(() => db.inviteToGroup(groupId, otherId)),
      answerGroupInvite: (groupId, accept) => thenReload(() => db.answerGroupInvite(groupId, accept)),
      leaveGroup: (groupId) => thenReload(() => db.leaveGroup(groupId)),
      removeFromGroup: (groupId, otherId) => thenReload(() => db.removeFromGroup(groupId, otherId)),

      likesOn: (target) => likesByTarget.get(targetKey(target)) ?? [],
      likedByMe: (target) => !!userId && (likesByTarget.get(targetKey(target)) ?? []).some((l) => l.userId === userId),
      toggleLike: (target) => {
        if (!userId) return false;
        const key = targetKey(target);
        const liking = !(likesByTarget.get(key) ?? []).some((l) => l.userId === userId);
        const mine = (l: Like) => l.userId === userId && targetKey(l) === key;
        changedHere();
        setLikes((list) => (liking ? [{ userId, ...target }, ...list] : list.filter((l) => !mine(l))));
        db.setLiked(target, liking).catch((e) => {
          console.warn('Could not save like', e);
          setLikes((list) => (liking ? list.filter((l) => !mine(l)) : [{ userId, ...target }, ...list]));
        });
        return true;
      },
      commentsOn: (target) => commentsByTarget.get(targetKey(target)) ?? [],
      addComment: async (target, body) => {
        requireUser();
        const created = await db.insertComment(target, body);
        changedHere();
        setComments((list) => [...list, created]);
        return created;
      },
      deleteComment: async (comment) => {
        requireUser();
        await db.removeComment(comment.id);
        changedHere();
        setComments((list) => list.filter((c) => c.id !== comment.id));
      },
      reportComment: async (comment, reason) => {
        requireUser();
        await db.reportComment(comment.id, reason);
        changedHere();
        setComments((list) => list.filter((c) => c.id !== comment.id));
      },
      notice,
      dismissNotice: () => setNotice(undefined),
      refresh,
      getLovedOne: (id) => byId.get(id),

      addLovedOne: async (input, photo) => {
        const owner = requireUser();
        const photoPath = photo ? await uploadPhoto(owner, photo.base64) : undefined;
        const created = await db.insertLovedOne({ ...input, photoPath });
        const [withPhoto] = await withPhotos([created]);
        changedHere();
        setLovedOnes((list) => [...list, withPhoto]);
        return withPhoto;
      },

      updateLovedOne: async (id, patch, photo) => {
        const owner = requireUser();
        const old = byId.get(id);
        let photoPath: string | null | undefined;
        if (photo) photoPath = await uploadPhoto(owner, photo.base64);
        else if (photo === null) photoPath = null;
        const updated = await db.patchLovedOne(id, photoPath === undefined ? patch : { ...patch, photoPath });
        if (photoPath !== undefined && old?.photoPath) await deletePhoto(old.photoPath);
        await replaceLovedOne(updated);
      },

      deleteLovedOne: async (id) => {
        requireUser();
        const old = byId.get(id);
        await db.removeLovedOne(id);
        await deletePhoto(old?.photoPath);
        changedHere();
        setLovedOnes((list) => list.filter((l) => l.id !== id));
        setIsms((list) => list.filter((i) => i.lovedOneId !== id));
      },

      addIsm: async (input) => {
        requireUser();
        const created = await db.insertIsm(input);
        changedHere();
        setIsms((list) => [created, ...list]);
        return created;
      },

      updateIsm: async (id, patch) => {
        requireUser();
        const updated = await db.patchIsm(id, patch);
        changedHere();
        setIsms((list) => list.map((i) => (i.id === id ? updated : i)));
      },

      deleteIsm: async (id) => {
        requireUser();
        await db.removeIsm(id);
        changedHere();
        setIsms((list) => list.filter((i) => i.id !== id));
        setSavedIds((list) => list.filter((s) => s !== id));
      },

      toggleSaved: (ismId) => {
        if (isExample(ismId)) {
          const next = savedExamples.includes(ismId)
            ? savedExamples.filter((s) => s !== ismId)
            : [ismId, ...savedExamples];
          setSavedExamples(next);
          writeJson(SAVED_EXAMPLES_KEY, next);
          return true;
        }
        if (!userId) return false;
        const saving = !savedIds.includes(ismId);
        changedHere();
        setSavedIds((list) => (saving ? [ismId, ...list] : list.filter((s) => s !== ismId)));
        db.setSaved(ismId, saving).catch((e) => {
          console.warn('Could not save heart', e);
          setSavedIds((list) => (saving ? list.filter((s) => s !== ismId) : [ismId, ...list]));
        });
        return true;
      },

      updateSettings: (patch) => {
        setSettings((s) => {
          const next = { ...s, ...patch };
          writeJson(SETTINGS_KEY, next);
          return next;
        });
      },

      searchPeople: (query) => db.searchPeople(query),

      findFromContacts: async () => {
        requireUser();
        const hashes = await contactEmailHashes();
        return hashes === null ? null : hashes.length ? db.findPeopleFromContacts(hashes) : [];
      },

      sendFriendRequest: async (otherId) => {
        requireUser();
        const result = await db.sendFriendRequestTo(otherId);
        // A new request or friendship changes what you can see.
        if (result.result === 'sent' || result.result === 'now_friends') await refresh();
        return result;
      },

      answerFriendRequest: async (otherId, accept) => {
        requireUser();
        await db.answerFriendRequest(otherId, accept);
        await refresh();
      },

      removeFriend: async (otherId) => {
        requireUser();
        await db.removeFriend(otherId);
        await refresh();
      },

      setMyName: async (name) => {
        const id = requireUser();
        await db.updateMyProfile(id, { displayName: name });
        setProfile((p) => (p ? { ...p, displayName: name } : p));
      },

      setDiscoverable: async (discoverable) => {
        const id = requireUser();
        await db.updateMyProfile(id, { discoverable });
        setProfile((p) => (p ? { ...p, discoverable } : p));
      },

      setPublicProfile: async (publicProfile) => {
        const id = requireUser();
        await db.updateMyProfile(id, { publicProfile });
        setProfile((p) => (p ? { ...p, publicProfile } : p));
      },

      report: async (target, reason) => {
        requireUser();
        await db.report(target, reason);
        changedHere();
        // Leave it a moment so the thank-you can be read, then hide it everywhere.
        setTimeout(() => {
          if (target.ismId) setIsms((list) => list.filter((i) => i.id !== target.ismId));
          if (target.lovedOneId) {
            setLovedOnes((list) => list.filter((l) => l.id !== target.lovedOneId));
            setIsms((list) => list.filter((i) => i.lovedOneId !== target.lovedOneId));
          }
        }, REPORTED_FADE_MS);
      },

      loadReviewItems: async () => {
        const items = await db.contentToReview();
        setReviewCount(items.length);
        return items;
      },

      review: async (item, allow) => {
        await db.reviewContent(item.kind, item.id, allow);
        setReviewCount((n) => Math.max(0, n - 1));
      },
    };
  }, [
    ready,
    loading,
    loadError,
    session,
    userId,
    settings,
    lovedOnes,
    isms,
    savedIds,
    savedExamples,
    notice,
    profile,
    isAdmin,
    reviewCount,
    profiles,
    friendships,
    friendsError,
    friendIds,
    viewer,
    circle,
    groupList,
    groupMembers,
    groupIds,
    likesByTarget,
    commentsByTarget,
    refresh,
    requireUser,
    withPhotos,
  ]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
