import { getAccessTokenForMutatingApi, getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import type { CompanyProfileFromApi, Opportunity, UniversityProfileFromApi } from '@/src/types';
import { mapOpportunity, type ApiOpportunityItem } from '@/src/lib/auth/company';
import { universityProfileFromJson } from '@/src/lib/auth/universityProfile';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

/**
 * Resolves a JWT for Java API GETs: live Supabase session, then forced refresh, then caller-supplied fallback.
 * Avoids 401 "Authentication required" when getSession is briefly empty but refresh yields a token.
 */
async function bearer(accessToken: string | null | undefined): Promise<string | null> {
  const passed = (accessToken ?? '').trim();
  let live = await getSessionAccessToken();
  if (live) return live;
  live = await getAccessTokenForMutatingApi();
  if (live) return live;
  return passed.length > 0 ? passed : null;
}

async function bearerMutate(accessToken: string | null | undefined): Promise<string | null> {
  const passed = (accessToken ?? '').trim();
  const live = await getAccessTokenForMutatingApi();
  if (live) return live;
  return passed.length > 0 ? passed : null;
}

function parseErr(parsed: unknown, fallback: string): string {
  if (parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error: string }).error === 'string') {
    return (parsed as { error: string }).error;
  }
  return fallback;
}

export type InstitutionalPartnershipUniversityRow = {
  universityId: number;
  universityName: string;
  status: string;
  requestedByRole: string | null;
  requestedById: number | null;
  canRequest: boolean;
  canAccept: boolean;
  canReject: boolean;
  canEnd: boolean;
};

export type InstitutionalPartnershipCompanyRow = {
  companyId: number;
  companyName: string;
  industry: string | null;
  status: string;
  requestedByRole: string | null;
  requestedById: number | null;
  canRequest: boolean;
  canAccept: boolean;
  canReject: boolean;
  canEnd: boolean;
};

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

function companyProfileFromJson(raw: unknown): CompanyProfileFromApi | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const companyId = pickNum(r, 'companyId', 'company_id');
  if (companyId == null) return null;
  return {
    companyId,
    name: pickStr(r, 'name') ?? '',
    location: pickStr(r, 'location'),
    description: pickStr(r, 'description'),
    website: pickStr(r, 'website'),
    industry: pickStr(r, 'industry'),
    employeeCount: pickNum(r, 'employeeCount', 'employee_count'),
    foundedYear: pickNum(r, 'foundedYear', 'founded_year', 'founded'),
    specialties: pickStr(r, 'specialties'),
    logoUrl: pickStr(r, 'logoUrl', 'logo_url'),
    coverUrl: pickStr(r, 'coverUrl', 'cover_url', 'cover'),
  };
}

export async function fetchCompanyPartnershipUniversities(
  accessToken: string
): Promise<{ data: InstitutionalPartnershipUniversityRow[] | null; errorMessage: string | null }> {
  const t = await bearer(accessToken);
  if (!t) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/company/partnerships/universities`, {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!res.ok) return { data: null, errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
    const o = parsed as { universities?: InstitutionalPartnershipUniversityRow[] };
    return { data: o.universities ?? [], errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchUniversityAdminPartnershipCompanies(
  accessToken: string
): Promise<{ data: InstitutionalPartnershipCompanyRow[] | null; errorMessage: string | null }> {
  const t = await bearer(accessToken);
  if (!t) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/admin/partnerships/companies`, {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!res.ok) return { data: null, errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
    const o = parsed as { companies?: InstitutionalPartnershipCompanyRow[] };
    return { data: o.companies ?? [], errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchCompanyPartnershipUniversityProfile(
  accessToken: string,
  universityId: number
): Promise<{ data: UniversityProfileFromApi | null; errorMessage: string | null }> {
  const t = await bearer(accessToken);
  if (!t) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/company/partnerships/universities/${encodeURIComponent(String(universityId))}/profile`,
      { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!res.ok) return { data: null, errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
    const data = universityProfileFromJson(parsed);
    if (!data) return { data: null, errorMessage: 'Invalid profile response.' };
    return { data, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchUniversityAdminPartnershipCompanyProfile(
  accessToken: string,
  companyId: number
): Promise<{ data: CompanyProfileFromApi | null; errorMessage: string | null }> {
  const t = await bearer(accessToken);
  if (!t) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/admin/partnerships/companies/${encodeURIComponent(String(companyId))}/profile`,
      { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!res.ok) return { data: null, errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
    const data = companyProfileFromJson(parsed);
    if (!data) return { data: null, errorMessage: 'Invalid profile response.' };
    return { data, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchUniversityAdminPartnershipCompanyOpportunities(
  accessToken: string,
  companyId: number
): Promise<{ data: Opportunity[] | null; errorMessage: string | null }> {
  const t = await bearer(accessToken);
  if (!t) return { data: null, errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/admin/partnerships/companies/${encodeURIComponent(String(companyId))}/opportunities`,
      { headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' }, cache: 'no-store' }
    );
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!res.ok) return { data: null, errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
    if (!parsed || typeof parsed !== 'object' || !('opportunities' in parsed)) {
      return { data: null, errorMessage: 'Invalid opportunities response.' };
    }
    const list = (parsed as { opportunities: unknown }).opportunities;
    if (!Array.isArray(list)) {
      return { data: null, errorMessage: 'Invalid opportunities response.' };
    }
    const data = list.map((item) => mapOpportunity(item as ApiOpportunityItem));
    return { data, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function postCompanyPartnershipRequest(
  accessToken: string,
  universityId: number
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/company/partnerships/universities/${encodeURIComponent(String(universityId))}/request`,
      { method: 'POST', headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function postCompanyPartnershipRespond(
  accessToken: string,
  universityId: number,
  approve: boolean
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/company/partnerships/universities/${encodeURIComponent(String(universityId))}/respond`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
        cache: 'no-store',
      }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function deleteCompanyPartnership(
  accessToken: string,
  universityId: number
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/company/partnerships/universities/${encodeURIComponent(String(universityId))}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function postAdminPartnershipRequest(
  accessToken: string,
  companyId: number
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/admin/partnerships/companies/${encodeURIComponent(String(companyId))}/request`,
      { method: 'POST', headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function postAdminPartnershipRespond(
  accessToken: string,
  companyId: number,
  approve: boolean
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/admin/partnerships/companies/${encodeURIComponent(String(companyId))}/respond`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approve }),
        cache: 'no-store',
      }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function deleteAdminPartnership(
  accessToken: string,
  companyId: number
): Promise<{ errorMessage: string | null }> {
  const t = await bearerMutate(accessToken);
  if (!t) return { errorMessage: 'Not signed in.' };
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/api/admin/partnerships/companies/${encodeURIComponent(String(companyId))}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }
    );
    if (res.ok) return { errorMessage: null };
    const raw = await res.text();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return { errorMessage: parseErr(parsed, `Request failed (${res.status})`) };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}
