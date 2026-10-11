import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { insertIsm, insertLovedOne } from './db';
import { uploadPhoto } from './photos';
import type { Ism, LovedOne, Settings } from './types';

/** Where the app kept everything before accounts existed. */
export const LEGACY_KEY = 'still-with-me/v1';

interface LegacyState {
  settings?: Settings;
  lovedOnes?: (LovedOne & { photoUri?: string })[];
  isms?: Ism[];
}

export async function readLegacy(): Promise<LegacyState | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as LegacyState) : null;
  } catch {
    return null;
  }
}

async function photoBase64(uri: string): Promise<string | undefined> {
  try {
    if (uri.startsWith('data:')) return uri.slice(uri.indexOf(',') + 1);
    if (Platform.OS !== 'web' && uri.startsWith('file:')) return await new File(uri).base64();
  } catch (e) {
    console.warn('Could not read saved photo', e);
  }
  return undefined;
}

/**
 * Move loved ones, quotes and stories saved on this device (before accounts) into the signed-in
 * account, then clear them from the device. Returns how many loved ones moved.
 */
export async function moveDeviceDataToAccount(userId: string): Promise<number> {
  const legacy = await readLegacy();
  const lovedOnes = legacy?.lovedOnes ?? [];
  if (lovedOnes.length === 0) return 0;

  let moved = 0;
  let remaining = [...lovedOnes];
  for (const old of lovedOnes) {
    const base64 = old.photoUri ? await photoBase64(old.photoUri) : undefined;
    const photoPath = base64 ? await uploadPhoto(userId, base64).catch(() => undefined) : undefined;
    const created = await insertLovedOne({
      name: old.name,
      relationship: old.relationship,
      years: old.years,
      about: old.about,
      obituary: old.obituary,
      visibility: old.visibility,
      photoPath,
    });
    for (const ism of (legacy?.isms ?? []).filter((i) => i.lovedOneId === old.id)) {
      await insertIsm({
        lovedOneId: created.id,
        kind: ism.kind ?? 'quote',
        title: ism.title,
        text: ism.text,
        context: ism.context,
        topics: ism.topics,
        keepPrivate: ism.keepPrivate,
      });
    }
    moved++;
    // Forget each one as soon as it's moved, so a failure part-way doesn't move it twice next time.
    remaining = remaining.filter((l) => l.id !== old.id);
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify({ ...legacy, lovedOnes: remaining }));
    if (old.photoUri?.startsWith('file:')) {
      try {
        new File(old.photoUri).delete();
      } catch {}
    }
  }
  return moved;
}
