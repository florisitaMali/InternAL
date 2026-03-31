import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/src/types';

export type UserAccountRow = {
  user_id: number;
  email: string;
  role: Role;
  linked_entity_id: number;
};

/**
 * Load UserAccount after Auth.
 * Tries exact email (as Supabase Auth returns it), then lowercase — avoids ILIKE underscore wildcards in emails.
 */
export async function fetchUserAccountByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ data: UserAccountRow | null; errorMessage: string | null; errorCode?: string }> {
  const trimmed = email.trim();
  const variants = Array.from(new Set([trimmed, trimmed.toLowerCase()]));

  for (const addr of variants) {
    const { data, error } = await supabase
      .from('useraccount')
      .select('user_id, email, role, linked_entity_id')
      .eq('email', addr)
      .maybeSingle();

    if (error) {
      return { data: null, errorMessage: error.message, errorCode: error.code };
    }
    if (data) {
      return {
        data: {
          user_id: data.user_id as number,
          email: data.email as string,
          role: data.role as Role,
          linked_entity_id: data.linked_entity_id as number,
        },
        errorMessage: null,
      };
    }
  }

  return { data: null, errorMessage: null };

}
