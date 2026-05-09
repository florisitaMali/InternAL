import type { StudentProfileResponse } from '@/src/lib/auth/userAccount';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

export type ViewerApiSegment = 'company' | 'ppa' | 'admin';

export async function fetchViewerStudentProfile(
  accessToken: string,
  segment: ViewerApiSegment,
  studentId: number
): Promise<{ data: StudentProfileResponse | null; errorMessage: string | null }> {
  const t = accessToken.trim();
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  const path = `/api/${segment}/students/${studentId}/profile`;
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const raw = await response.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      let msg = `Request failed with status ${response.status}`;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
        const e = (parsed as { error?: unknown }).error;
        if (typeof e === 'string' && e.trim()) msg = e.trim();
      }
      return { data: null, errorMessage: msg };
    }
    return { data: parsed as StudentProfileResponse, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}
