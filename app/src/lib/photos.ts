import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { newId } from './ids';
import { supabase } from './supabase';

const BUCKET = 'photos';
/** Photo links stay valid this long; the app asks for fresh ones each time it loads. */
const LINK_SECONDS = 60 * 60 * 24;

export interface PickedPhoto {
  /** For showing the photo before it's saved. */
  previewUri: string;
  /** JPEG bytes, base64-encoded, for uploading. */
  base64: string;
}

/** Let the person pick a square photo. Returns undefined if they cancel. */
export async function pickPhoto(): Promise<PickedPhoto | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: true,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  // On the web the picked photo can come back as a data URI instead of separate base64.
  const base64 = asset.base64 ?? (asset.uri.startsWith('data:') ? asset.uri.slice(asset.uri.indexOf(',') + 1) : undefined);
  if (!base64) throw new Error('Couldn’t read that photo. Try another one.');
  return { previewUri: asset.uri, base64 };
}

/** Upload a photo into the person's own folder and return its storage path. */
export async function uploadPhoto(userId: string, base64: string): Promise<string> {
  const path = `${userId}/${newId()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function deletePhoto(path: string | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('Could not delete photo', error);
}

/** Short-lived links for the photos this person is allowed to see, keyed by storage path. */
export async function photoLinks(paths: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error) {
    console.warn('Could not load photos', error);
    return links;
  }
  for (const item of data) if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
  return links;
}
