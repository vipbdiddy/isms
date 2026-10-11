import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as db from './db';
import { moveDeviceDataToAccount, readLegacy } from './migrate';
import { deletePhoto, photoLinks, uploadPhoto, type PickedPhoto } from './photos';
import { SEED_ISMS, SEED_LOVED_ONES } from './seed';
import { supabase } from './supabase';
import type { Ism, IsmInput, LovedOne, LovedOneInput, Settings } from './types';

const SETTINGS_KEY = 'isms/settings';
/** Hearts on the example families, which live in the app rather than the database. */
const SAVED_EXAMPLES_KEY = 'isms/saved-examples';

const DEFAULT_SETTINGS: Settings = { displayName: '', defaultScope: 'mine' };

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
  /** Your own loved ones plus every public one from other families. */
  lovedOnes: LovedOne[];
  /** Everything you may see (filter further with `visibleIsms`). */
  isms: Ism[];
  savedIsmIds: Set<string>;
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
  const refresh = useCallback(async () => {
    const load = ++latestLoad.current;
    setLoading(true);
    try {
      const data = await db.fetchAll(userId || null);
      const withLinks = await withPhotos(data.lovedOnes);
      if (load !== latestLoad.current) return;
      setLovedOnes(withLinks);
      setIsms(data.isms);
      setSavedIds(data.savedIsmIds);
      setLoadError(undefined);
    } catch (e) {
      if (load !== latestLoad.current) return;
      console.warn('Could not load', e);
      setLoadError('Couldn’t load memories. Check your connection and pull down to try again.');
    } finally {
      if (load === latestLoad.current) setLoading(false);
    }
  }, [userId, withPhotos]);

  // Reload whenever someone signs in or out; on sign-in, bring over anything saved on this phone first.
  useEffect(() => {
    if (!ready) return;
    // Don't keep showing the previous account's memories while the new ones load.
    setLovedOnes([]);
    setIsms([]);
    setSavedIds([]);
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

  const store = useMemo<Store>(() => {
    const allLovedOnes = [...lovedOnes, ...SEED_LOVED_ONES];
    const byId = new Map(allLovedOnes.map((l) => [l.id, l]));
    const replaceLovedOne = async (updated: LovedOne) => {
      const [withPhoto] = await withPhotos([updated]);
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
      notice,
      dismissNotice: () => setNotice(undefined),
      refresh,
      getLovedOne: (id) => byId.get(id),

      addLovedOne: async (input, photo) => {
        const owner = requireUser();
        const photoPath = photo ? await uploadPhoto(owner, photo.base64) : undefined;
        const created = await db.insertLovedOne({ ...input, photoPath });
        const [withPhoto] = await withPhotos([created]);
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
        setLovedOnes((list) => list.filter((l) => l.id !== id));
        setIsms((list) => list.filter((i) => i.lovedOneId !== id));
      },

      addIsm: async (input) => {
        requireUser();
        const created = await db.insertIsm(input);
        setIsms((list) => [created, ...list]);
        return created;
      },

      updateIsm: async (id, patch) => {
        requireUser();
        const updated = await db.patchIsm(id, patch);
        setIsms((list) => list.map((i) => (i.id === id ? updated : i)));
      },

      deleteIsm: async (id) => {
        requireUser();
        await db.removeIsm(id);
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
    };
  }, [ready, loading, loadError, session, userId, settings, lovedOnes, isms, savedIds, savedExamples, notice, refresh, requireUser, withPhotos]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
