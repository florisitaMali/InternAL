import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. For local dev, set them in internal-frontend/.env.local. For production, set them in the build environment (hosting CI, Docker build args, etc.) and run npm run build again — Next.js bakes these into the client bundle.'
    );
  }

  browserClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

/** Last resort if signOut() leaves a session (browser storage can get out of sync). */
export function clearSupabaseAuthStorage(): void {
  if (typeof window === 'undefined') return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return;
  try {
    const host = new URL(url).hostname;
    const ref = host.split('.')[0];
    if (!ref) return;
    const prefix = `sb-${ref}-`;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
