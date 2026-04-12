import type { SupabaseClient } from '@supabase/supabase-js';

export async function getBrowserAccessToken(client: SupabaseClient): Promise<string | null> {
  let {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    const { data: refreshed } = await client.auth.refreshSession();
    session = refreshed.session ?? null;
  }
  return session?.access_token ?? null;
}
