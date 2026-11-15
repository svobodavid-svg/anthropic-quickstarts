import { MEDIA_BUCKET, supabase } from './supabase';

/**
 * Gallery copies in the private `editor-media` bucket, under `<user id>/gallery/`.
 * The provider's own links expire (videos after 48 hours); a copy here does not.
 */
const EXT: Record<string, string> = { 'video/mp4': 'mp4', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const WEEK = 60 * 60 * 24 * 7;

export const cloudEnabled = !!supabase;

export const signedGalleryUrl = async (path: string): Promise<string | null> => {
  if (!supabase) return null;
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, WEEK);
  return data?.signedUrl ?? null;
};

export const saveToCloud = async (
  url: string,
  kind: 'image' | 'video',
  id: string
): Promise<{ path: string; signedUrl: string }> => {
  if (!supabase) throw new Error('Cloud není nastaven.');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Nejste přihlášen.');

  let blob: Blob;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    blob = await res.blob();
  } catch {
    throw new Error('Soubor se nepodařilo stáhnout (odkaz vypršel nebo ho blokuje CORS).');
  }

  const type = blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const path = `${uid}/gallery/${kind}-${id.replace(/[^\w-]/g, '')}.${EXT[type] ?? 'bin'}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { upsert: true, contentType: type });
  if (error) throw new Error(error.message);
  const signedUrl = await signedGalleryUrl(path);
  if (!signedUrl) throw new Error('Nepodařilo se vytvořit odkaz.');
  return { path, signedUrl };
};
