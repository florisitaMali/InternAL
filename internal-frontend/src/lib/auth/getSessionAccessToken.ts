import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

/**
 * Returns a non-empty Supabase JWT for API calls. Tries refresh when the
 * session is missing or expired so company profile / opportunities requests
 * still send a valid Bearer token.
 */
export async function getSessionAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const fromSession = session?.access_token?.trim();
  if (fromSession) return fromSession;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) return null;
  const t = refreshed.session?.access_token?.trim();
  return t && t.length > 0 ? t : null;
}
