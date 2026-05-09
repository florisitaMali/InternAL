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

/**
 * Prefer for POST/PUT/PATCH/DELETE to the Java API: calls {@link refreshSession} first so the
 * outbound Bearer token matches the current Supabase session even when React props/refs still
 * hold an older access token string (which can surface as Spring Security’s anonymous 401 on writes).
 */
export async function getAccessTokenForMutatingApi(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (!error && refreshed.session?.access_token?.trim()) {
    return refreshed.session.access_token.trim();
  }
  return getSessionAccessToken();
}
