import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { newId } from './ids';
import { supabase } from './supabase';
import type { SavedPicture } from './types';

const BUCKET = 'photos';
/** Photo links stay valid this long; the app asks for fresh ones each time it loads. */
const LINK_SECONDS = 60 * 60 * 24;

export interface PickedPhoto {
  /** For showing the photo before it's saved. */
  previewUri: string;
  /** JPEG bytes, base64-encoded, for uploading. */
  base64: string;
  /** Its size in pixels, once made smaller. */
  width: number;
  height: number;
}

/** Longest side, in pixels, of a loved one's photo (shown small) and of a picture with a memory. */
const PHOTO_LONGEST = 1024;
const PICTURE_LONGEST = 1600;

/**
 * Makes a picked image a JPEG no bigger than `longest` pixels on its longest side, ready to upload. Phones'
 * cameras take far bigger pictures than a screen shows, and the bigger the file the slower it loads.
 */
async function shrink(uri: string, longest: number, noun: 'photo' | 'picture'): Promise<PickedPhoto> {
  try {
    const image = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = image;
    const scale = Math.min(1, longest / Math.max(width, height));
    const sized =
      scale < 1
        ? await ImageManipulator.manipulate(image)
            .resize(width >= height ? { width: Math.round(width * scale) } : { height: Math.round(height * scale) })
            .renderAsync()
        : image;
    const saved = await sized.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) throw new Error('No image data');
    return { previewUri: saved.uri, base64: saved.base64, width: saved.width, height: saved.height };
  } catch (e) {
    console.warn(`Could not make the ${noun} smaller`, e);
    throw new Error(`Couldn’t use that ${noun}. Try another one.`);
  }
}

/** Let the person pick a square photo. Returns undefined if they cancel. */
export async function pickPhoto(): Promise<PickedPhoto | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
  if (result.canceled) return undefined;
  return shrink(result.assets[0].uri, PHOTO_LONGEST, 'photo');
}

/** Let the person pick a picture, whatever its shape. Returns undefined if they cancel. */
export async function pickPicture(): Promise<PickedPhoto | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
  if (result.canceled) return undefined;
  return shrink(result.assets[0].uri, PICTURE_LONGEST, 'picture');
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

/** Upload a picture for a quote or story into the person's own folder. */
export async function uploadPicture(userId: string, picture: PickedPhoto): Promise<SavedPicture> {
  return { path: await uploadPhoto(userId, picture.base64), width: picture.width, height: picture.height };
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
