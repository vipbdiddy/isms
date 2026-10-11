import { supabase } from './supabase';
import type { Ism, IsmInput, LovedOne, LovedOneInput } from './types';

// Rows as they're stored in Supabase (see supabase/schema.sql).
interface LovedOneRow {
  id: string;
  owner_id: string;
  name: string;
  relationship: string;
  years: string | null;
  about: string | null;
  obituary: string | null;
  photo_path: string | null;
  visibility: 'private' | 'public';
  created_at: string;
}

interface IsmRow {
  id: string;
  owner_id: string;
  loved_one_id: string;
  kind: 'quote' | 'story';
  title: string | null;
  text: string;
  context: string | null;
  topics: string[];
  keep_private: boolean;
  created_at: string;
}

const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

const toLovedOne = (r: LovedOneRow): LovedOne => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  relationship: r.relationship,
  years: orUndefined(r.years),
  about: orUndefined(r.about),
  obituary: orUndefined(r.obituary),
  photoPath: orUndefined(r.photo_path),
  visibility: r.visibility,
  createdAt: Date.parse(r.created_at),
});

const toIsm = (r: IsmRow): Ism => ({
  id: r.id,
  ownerId: r.owner_id,
  lovedOneId: r.loved_one_id,
  kind: r.kind,
  title: orUndefined(r.title),
  text: r.text,
  context: orUndefined(r.context),
  topics: r.topics,
  keepPrivate: r.keep_private,
  createdAt: Date.parse(r.created_at),
});

const lovedOneColumns = (input: Partial<LovedOneInput> & { photoPath?: string | null }) => {
  const row: Partial<LovedOneRow> = {};
  if ('name' in input) row.name = input.name;
  if ('relationship' in input) row.relationship = input.relationship;
  if ('years' in input) row.years = input.years ?? null;
  if ('about' in input) row.about = input.about ?? null;
  if ('obituary' in input) row.obituary = input.obituary ?? null;
  if ('visibility' in input) row.visibility = input.visibility;
  if ('photoPath' in input) row.photo_path = input.photoPath ?? null;
  return row;
};

const ismColumns = (input: Partial<IsmInput>) => {
  const row: Partial<IsmRow> = {};
  if ('lovedOneId' in input) row.loved_one_id = input.lovedOneId;
  if ('kind' in input) row.kind = input.kind;
  if ('title' in input) row.title = input.title ?? null;
  if ('text' in input) row.text = input.text;
  if ('context' in input) row.context = input.context ?? null;
  if ('topics' in input) row.topics = input.topics;
  if ('keepPrivate' in input) row.keep_private = input.keepPrivate ?? false;
  return row;
};

/** Everything this person may see: their own loved ones and every family's shared ones. */
export async function fetchAll(userId: string | null) {
  const [lovedOnes, isms, saved] = await Promise.all([
    supabase.from('loved_ones').select('*').order('created_at'),
    supabase.from('isms').select('*').order('created_at', { ascending: false }),
    userId ? supabase.from('saved_isms').select('ism_id') : Promise.resolve({ data: [], error: null }),
  ]);
  if (lovedOnes.error) throw lovedOnes.error;
  if (isms.error) throw isms.error;
  if (saved.error) throw saved.error;
  return {
    lovedOnes: (lovedOnes.data as LovedOneRow[]).map(toLovedOne),
    isms: (isms.data as IsmRow[]).map(toIsm),
    savedIsmIds: (saved.data as { ism_id: string }[]).map((r) => r.ism_id),
  };
}

export async function insertLovedOne(input: LovedOneInput & { photoPath?: string }) {
  const { data, error } = await supabase.from('loved_ones').insert(lovedOneColumns(input)).select().single();
  if (error) throw error;
  return toLovedOne(data as LovedOneRow);
}

export async function patchLovedOne(id: string, patch: Partial<LovedOneInput> & { photoPath?: string | null }) {
  const { data, error } = await supabase.from('loved_ones').update(lovedOneColumns(patch)).eq('id', id).select().single();
  if (error) throw error;
  return toLovedOne(data as LovedOneRow);
}

export async function removeLovedOne(id: string) {
  const { error } = await supabase.from('loved_ones').delete().eq('id', id);
  if (error) throw error;
}

export async function insertIsm(input: IsmInput) {
  const { data, error } = await supabase.from('isms').insert(ismColumns(input)).select().single();
  if (error) throw error;
  return toIsm(data as IsmRow);
}

export async function patchIsm(id: string, patch: Partial<IsmInput>) {
  const { data, error } = await supabase.from('isms').update(ismColumns(patch)).eq('id', id).select().single();
  if (error) throw error;
  return toIsm(data as IsmRow);
}

export async function removeIsm(id: string) {
  const { error } = await supabase.from('isms').delete().eq('id', id);
  if (error) throw error;
}

export async function setSaved(ismId: string, saved: boolean) {
  const { error } = saved
    ? await supabase.from('saved_isms').insert({ ism_id: ismId })
    : await supabase.from('saved_isms').delete().eq('ism_id', ismId);
  if (error) throw error;
}
