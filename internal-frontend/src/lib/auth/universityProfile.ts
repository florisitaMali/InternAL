import type { UniversityProfileFromApi } from '@/src/types';
import { getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';

function getApiBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
  return u.replace(/\/+$/, '');
}

export type UniversityProfileUpdatePayload = {
  name: string;
  location: string;
  description: string;
  website: string;
  email: string;
  employeeCount: number | null;
  foundedYear: number | null;
  specialties: string;
  logoUrl: string;
  coverUrl: string;
};

function parseError(parsed: unknown, fallback: string): string {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const o = parsed as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
  if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
  return fallback;
}

function mapProfile(raw: unknown): UniversityProfileFromApi | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const universityId = pickNum(r, 'universityId', 'university_id');
  if (universityId == null) return null;
  return {
    universityId,
    name: pickStr(r, 'name') ?? '',
    location: pickStr(r, 'location'),
    description: pickStr(r, 'description'),
    website: pickStr(r, 'website'),
    email: pickStr(r, 'email'),
    employeeCount: pickNum(r, 'employeeCount', 'employee_count', 'numberOfEmployees', 'number_of_employees'),
    foundedYear: pickNum(r, 'foundedYear', 'founded_year', 'founded'),
    specialties: pickStr(r, 'specialties'),
    logoUrl: pickStr(r, 'logoUrl', 'logo_url', 'profile_photo', 'profilePhoto'),
    coverUrl: pickStr(r, 'coverUrl', 'cover_url', 'cover'),
  };
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function pickNum(r: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
  }
  return null;
}

/** Prefer caller token; avoid refreshSession here (it retriggers app sync and can sign out on flaky /api/me). */
async function resolveBearer(accessToken: string): Promise<string | null> {
  const t = accessToken.trim();
  if (t.length > 0) return t;
  return getSessionAccessToken();
}

export async function fetchUniversityProfile(
  accessToken: string
): Promise<{ data: UniversityProfileFromApi | null; errorMessage: string | null }> {
  const token = await resolveBearer(accessToken);
  if (!token) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/university/profile`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const rawText = await res.text();
    const parsed: unknown = rawText ? JSON.parse(rawText) : null;
    if (!res.ok) {
      return { data: null, errorMessage: parseError(parsed, `Request failed (${res.status})`) };
    }
    const data = mapProfile(parsed);
    if (!data) return { data: null, errorMessage: 'Invalid profile response.' };
    return { data, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function updateUniversityProfile(
  accessToken: string,
  body: UniversityProfileUpdatePayload
): Promise<{ data: UniversityProfileFromApi | null; errorMessage: string | null }> {
  const token = await resolveBearer(accessToken);
  if (!token) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/university/profile`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: body.name,
        location: body.location,
        description: body.description,
        website: body.website,
        email: body.email,
        employeeCount: body.employeeCount,
        foundedYear: body.foundedYear,
        specialties: body.specialties,
        logoUrl: body.logoUrl,
        coverUrl: body.coverUrl,
      }),
    });
    const rawText = await res.text();
    const parsed: unknown = rawText ? JSON.parse(rawText) : null;
    if (!res.ok) {
      return { data: null, errorMessage: parseError(parsed, `Request failed (${res.status})`) };
    }
    const data = mapProfile(parsed);
    if (!data) return { data: null, errorMessage: 'Invalid profile response.' };
    return { data, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}
