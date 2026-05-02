import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

/** Short-lived: token passed from the main app when opening Premium checkout (SPA tab session). */
export const CHECKOUT_ACCESS_TOKEN_KEY = 'internaal_checkout_access_token';

/** After mock premium payment, home page reads this to merge the refreshed student profile. */
export const PREMIUM_STUDENT_PROFILE_KEY = 'internaal_student_after_premium';

export function stashCheckoutAccessToken(token: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  if (token?.trim()) {
    sessionStorage.setItem(CHECKOUT_ACCESS_TOKEN_KEY, token.trim());
  }
}

export function peekCheckoutAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CHECKOUT_ACCESS_TOKEN_KEY)?.trim() || null;
}

export function clearCheckoutAccessToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_ACCESS_TOKEN_KEY);
}

/**
 * Prefer an explicit token (from the logged-in shell), then checkout stash, then Supabase session.
 * Use this for API calls from standalone routes (e.g. /premium) where getSession() can lag behind the parent app.
 */
export async function resolveBackendAccessToken(explicit?: string | null): Promise<string | null> {
  const e = explicit?.trim();
  if (e) return e;
  const peeked = peekCheckoutAccessToken();
  if (peeked) return peeked;
  return getSessionAccessToken();
}

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
  if (!error) {
    const t = refreshed.session?.access_token?.trim();
    if (t) return t;
  }

  const {
    data: { session: sessionAgain },
  } = await supabase.auth.getSession();
  const retry = sessionAgain?.access_token?.trim();
  return retry && retry.length > 0 ? retry : null;
}
