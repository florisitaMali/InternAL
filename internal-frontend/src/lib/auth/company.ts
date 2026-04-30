import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import type { CompanyProfileFromApi, Opportunity, OpportunityApplicationStats } from '@/src/types';
import {
  formatDeadline,
  formatDurationCodeLabel,
  formatPostedDisplay,
  normalizePostedAtFromApi,
  formatWorkTypeLabel,
  responsibilitiesFromNiceToHave,
} from '@/src/lib/opportunityFormat';

type ApiOpportunityItem = {
  id: number;
  companyId: number;
  companyName: string | null;
  title: string | null;
  description: string | null;
  requiredSkills: string[] | null;
  requiredExperience: string | null;
  deadline: string | null;
  startDate?: string | null;
  targetUniversityIds: number[] | null;
  targetUniversities?: { universityId: number; name: string }[] | null;
  type: string | null;
  location: string | null;
  isPaid: boolean | null;
  workMode: string | null;
  skillMatchCount: number | null;
  positionCount?: number | null;
  workType?: string | null;
  duration?: string | null;
  salaryMonthly?: number | null;
  niceToHave?: string | null;
  draft?: boolean | null;
  postedAt?: string | null;
};

type CompanyOpportunitiesResponse = {
  opportunities: ApiOpportunityItem[];
};

type CompanyOpportunityDetailResponse = {
  opportunity: ApiOpportunityItem;
  applicationStats: {
    total: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
};

function getApiBaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
  return u.replace(/\/+$/, '');
}

function normalizeBearerToken(accessToken: string): string | null {
  const t = accessToken.trim();
  return t.length > 0 ? t : null;
}

function parseBackendErrorMessage(
  parsed: unknown,
  fallback: string
): string {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const o = parsed as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof o.detail === 'string' && o.detail.trim()) return o.detail;
  return fallback;
}


function mapOpportunity(item: ApiOpportunityItem): Opportunity {
  const workType = item.workType ?? undefined;
  const duration = item.duration ?? undefined;
  const niceToHave = item.niceToHave ?? undefined;
  const postedAt = normalizePostedAtFromApi(item.postedAt);
  const exp = item.requiredExperience?.trim();
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    companyName: item.companyName || 'Unknown company',
    title: item.title || 'Untitled opportunity',
    description: item.description || '',
    requiredSkills: item.requiredSkills || [],
    requiredExperience: item.requiredExperience || undefined,
    deadline: item.deadline || undefined,
    startDate: item.startDate || undefined,
    targetUniversities: item.targetUniversities ?? undefined,
    targetUniversityIds:
      item.targetUniversities?.length
        ? item.targetUniversities.map((t) => String(t.universityId))
        : (item.targetUniversityIds || []).map(String),
    type: item.type || undefined,
    location: item.location || undefined,
    isPaid: item.isPaid,
    workMode: item.workMode || undefined,
    skillMatchCount: item.skillMatchCount ?? 0,
    positionCount: item.positionCount ?? undefined,
    workType,
    duration,
    salaryMonthly: item.salaryMonthly ?? undefined,
    niceToHave,
    draft: item.draft === true,
    jobTypeLabel: formatWorkTypeLabel(workType),
    durationLabel: formatDurationCodeLabel(duration),
    startDateLabel: item.startDate ? formatDeadline(item.startDate) : undefined,
    responsibilities: responsibilitiesFromNiceToHave(niceToHave),
    requirements: exp ? exp.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : undefined,
    postedAt,
    postedLabel: postedAt ? formatPostedDisplay(postedAt) : undefined,
  };
}

async function fetchBackendJson<T>(path: string, accessToken: string): Promise<{ data: T | null; errorMessage: string | null }> {
  const token = normalizeBearerToken(accessToken);
  if (!token) {
    return { data: null, errorMessage: 'Not signed in. Refresh the page or sign in again.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : null;
    if (!response.ok) {
      return {
        data: null,
        errorMessage: parseBackendErrorMessage(parsed, `Request failed with status ${response.status}`),
      };
    }
    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

async function sendBackendJson<T>(
  path: string,
  accessToken: string,
  method: 'PUT',
  body: unknown
): Promise<{ data: T | null; errorMessage: string | null }> {
  const token = normalizeBearerToken(accessToken);
  if (!token) {
    return { data: null, errorMessage: 'Not signed in. Refresh the page or sign in again.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : null;
    if (!response.ok) {
      return {
        data: null,
        errorMessage: parseBackendErrorMessage(parsed, `Request failed with status ${response.status}`),
      };
    }
    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return { data: null, errorMessage: e instanceof Error ? e.message : 'Request failed' };
  }
}

export async function fetchCompanyProfile(
  accessToken: string
): Promise<{ data: CompanyProfileFromApi | null; errorMessage: string | null }> {
  return fetchBackendJson<CompanyProfileFromApi>('/api/company/profile', accessToken);
}

export type CompanyProfileUpdatePayload = {
  name?: string;
  location?: string;
  description?: string;
  website?: string;
  industry?: string;
  employeeCount?: number | null;
  foundedYear?: number | null;
  specialties?: string;
  logoUrl?: string;
  coverUrl?: string;
};

export async function updateCompanyProfile(
  accessToken: string,
  body: CompanyProfileUpdatePayload
): Promise<{ data: CompanyProfileFromApi | null; errorMessage: string | null }> {
  return sendBackendJson<CompanyProfileFromApi>('/api/company/profile', accessToken, 'PUT', body);
}

export async function fetchCompanyApplications(
  accessToken: string
): Promise<{ data: ApplicationResponse[] | null; errorMessage: string | null }> {
  return fetchBackendJson<ApplicationResponse[]>('/api/company/applications', accessToken);
}

export async function fetchCompanyOpportunities(
  accessToken: string
): Promise<{ data: Opportunity[] | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchBackendJson<CompanyOpportunitiesResponse>(
    '/api/company/opportunities',
    accessToken
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load opportunities.' };
  }
  return { data: (data.opportunities || []).map(mapOpportunity), errorMessage: null };
}

export async function fetchCompanyOpportunityDetail(
  accessToken: string,
  opportunityId: string
): Promise<{ data: Opportunity | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchBackendJson<CompanyOpportunityDetailResponse>(
    `/api/company/opportunities/${encodeURIComponent(opportunityId)}`,
    accessToken
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load opportunity.' };
  }
  const opp = mapOpportunity(data.opportunity);
  const stats: OpportunityApplicationStats = {
    total: data.applicationStats.total,
    inReview: data.applicationStats.inReview,
    approved: data.applicationStats.approved,
    rejected: data.applicationStats.rejected,
  };
  return { data: { ...opp, applicationStats: stats }, errorMessage: null };
}

export async function fetchStudentOpportunityDetail(
  accessToken: string,
  opportunityId: string
): Promise<{ data: Opportunity | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchBackendJson<CompanyOpportunityDetailResponse>(
    `/api/student/opportunities/${encodeURIComponent(opportunityId)}`,
    accessToken
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load opportunity.' };
  }
  const opp = mapOpportunity(data.opportunity);
  const stats: OpportunityApplicationStats = {
    total: data.applicationStats.total,
    inReview: data.applicationStats.inReview,
    approved: data.applicationStats.approved,
    rejected: data.applicationStats.rejected,
  };
  return { data: { ...opp, applicationStats: stats }, errorMessage: null };
}

export async function fetchStudentCompanyProfile(
  accessToken: string,
  companyId: string
): Promise<{ data: CompanyProfileFromApi | null; errorMessage: string | null }> {
  return fetchBackendJson<CompanyProfileFromApi>(
    `/api/student/companies/${encodeURIComponent(companyId)}/profile`,
    accessToken
  );
}

export async function fetchStudentCompanyOpportunities(
  accessToken: string,
  companyId: string
): Promise<{ data: Opportunity[] | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchBackendJson<CompanyOpportunitiesResponse>(
    `/api/student/companies/${encodeURIComponent(companyId)}/opportunities`,
    accessToken
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load opportunities.' };
  }
  return { data: (data.opportunities || []).map(mapOpportunity), errorMessage: null };
}
