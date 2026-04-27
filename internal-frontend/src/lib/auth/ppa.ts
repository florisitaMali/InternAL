import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import { type AdminStudentRow } from '@/src/lib/auth/admin';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

async function fetchJson<T>(path: string, accessToken: string): Promise<{ data: T | null; errorMessage: string | null }> {
  const t = accessToken.trim();
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
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
    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchPpaApplications(
  accessToken: string
): Promise<{ data: ApplicationResponse[] | null; errorMessage: string | null }> {
  return fetchJson<ApplicationResponse[]>('/api/ppa/applications', accessToken);
}

export async function fetchPpaStudents(
  accessToken: string
): Promise<{ data: AdminStudentRow[] | null; errorMessage: string | null }> {
  return fetchJson<AdminStudentRow[]>('/api/ppa/students', accessToken);
}
