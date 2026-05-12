import type { StudentProfileResponse } from '@/src/lib/auth/userAccount';
import { getSupabaseBrowserClient } from '@/src/lib/supabase/client';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

export type ViewerApiSegment = 'company' | 'ppa' | 'admin';

async function accessTokenAfterRefresh(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  const t = data.session?.access_token?.trim();
  return t && t.length > 0 ? t : null;
}

export async function fetchViewerStudentProfile(
  accessToken: string,
  segment: ViewerApiSegment,
  studentId: number
): Promise<{ data: StudentProfileResponse | null; errorMessage: string | null }> {
  let t = accessToken.trim();
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  const path = `/api/${segment}/students/${studentId}/profile`;
  const url = `${getApiBaseUrl()}${path}`;

  const tryOnce = async (token: string) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const raw = await response.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { response, parsed } as const;
  };

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { response, parsed } = await tryOnce(t);
      if (response.ok) {
        return { data: parsed as StudentProfileResponse, errorMessage: null };
      }
      const authRelated401 = response.status === 401;
      if (attempt === 0 && authRelated401) {
        const refreshed = await accessTokenAfterRefresh();
        if (refreshed && refreshed !== t) {
          t = refreshed;
          continue;
        }
      }
      let msg = `Request failed with status ${response.status}`;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
        const e = (parsed as { error?: unknown }).error;
        if (typeof e === 'string' && e.trim()) msg = e.trim();
      }
      return { data: null, errorMessage: msg };
    }
    return { data: null, errorMessage: 'Request failed' };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}
