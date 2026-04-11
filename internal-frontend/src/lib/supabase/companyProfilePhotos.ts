import type { SupabaseClient } from '@supabase/supabase-js';

/** Matches the bucket layout: `company/logo/...` and `company/cover/...`. */
export const COMPANY_PROFILE_PHOTOS_BUCKET = 'company_profile_photos';

const MAX_BYTES = 5 * 1024 * 1024;

function extensionForFile(file: File): string {
  const fromName = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase().replace(/[^a-z0-9.]/g, '')
    : '';
  if (fromName && fromName.length <= 6 && fromName.startsWith('.')) {
    return fromName;
  }
  if (file.type === 'image/png') return '.png';
  if (file.type === 'image/jpeg' || file.type === 'image/jpg') return '.jpg';
  if (file.type === 'image/webp') return '.webp';
  if (file.type === 'image/gif') return '.gif';
  return '.img';
}

/**
 * Uploads to `company/{logo|cover}/{companyId}{ext}` with upsert.
 * Bucket should allow authenticated uploads and public (or signed) reads for the returned URL to work in `<img>`.
 */
export async function uploadCompanyProfilePhoto(
  supabase: SupabaseClient,
  kind: 'logo' | 'cover',
  companyId: number,
  file: File
): Promise<{ publicUrl: string | null; errorMessage: string | null }> {
  if (!file.type.startsWith('image/')) {
    return { publicUrl: null, errorMessage: 'Please choose an image file.' };
  }
  if (file.size > MAX_BYTES) {
    return { publicUrl: null, errorMessage: 'Image must be 5 MB or smaller.' };
  }
  const folder = kind === 'logo' ? 'logo' : 'cover';
  const ext = extensionForFile(file);
  const objectPath = `company/${folder}/${companyId}${ext}`;

  const { error } = await supabase.storage
    .from(COMPANY_PROFILE_PHOTOS_BUCKET)
    .upload(objectPath, file, {
      upsert: true,
      // Short CDN TTL; browsers still key strongly on URL — we also append ?v= below.
      cacheControl: '120',
      contentType: file.type || 'application/octet-stream',
    });

  if (error) {
    return { publicUrl: null, errorMessage: error.message };
  }

  const { data } = supabase.storage.from(COMPANY_PROFILE_PHOTOS_BUCKET).getPublicUrl(objectPath);
  const base = data.publicUrl;
  const sep = base.includes('?') ? '&' : '?';
  // Same object path after upsert keeps the same path; without a new query string the browser shows a cached image.
  const publicUrl = `${base}${sep}v=${Date.now()}`;
  return { publicUrl, errorMessage: null };
}

/**
 * Extra cache-bust for display when the stored URL string did not change (e.g. old rows) — bump `rev` after a photo save.
 */
export function profileImageDisplayUrl(url: string | null | undefined, displayRev: number): string {
  if (!url?.trim()) return '';
  const u = url.trim();
  const sep = u.includes('?') ? '&' : '?';
  return `${u}${sep}d=${displayRev}`;
}
