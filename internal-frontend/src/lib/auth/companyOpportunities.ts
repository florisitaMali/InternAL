import type { Opportunity, OpportunityApplicationStats } from '@/src/types';
import {
  formatDeadline,
  formatDurationCodeLabel,
  normalizePostedAtFromApi,
  formatWorkTypeLabel,
  responsibilitiesFromNiceToHave,
} from '@/src/lib/opportunityFormat';

type CompanyOpportunityResponseItem = {
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
  /** ISO-8601 instant from backend {@code created_at} */
  postedAt?: string | null;
};

type CompanyOpportunitiesResponse = {
  opportunities: CompanyOpportunityResponseItem[];
};

type CompanyOpportunityDetailResponse = {
  opportunity: CompanyOpportunityResponseItem;
  applicationStats?: {
    total: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
};

const emptyApplicationStats: OpportunityApplicationStats = {
  total: 0,
  inReview: 0,
  approved: 0,
  rejected: 0,
};

/** Partial body for PUT /api/company/opportunities/{id} (matches backend {@code CompanyOpportunityUpdateRequest}). */
export type CompanyOpportunityUpdateBody = Partial<{
  title: string;
  description: string;
  requiredSkills: string[];
  requirements: string;
  deadline: string;
  startDate: string;
  targetUniversityIds: number[];
  type: string;
  positionCount: number;
  jobLocation: string;
  workplaceType: 'Remote' | 'Hybrid' | 'On-site';
  workType: 'FULL_TIME' | 'PART_TIME';
  duration: string;
  paid: boolean;
  salaryMonthly: number | null;
  niceToHave: string | null;
  draft: boolean;
}>;

export type TargetUniversityOption = {
  universityId: number;
  name: string;
};

export type CompanyOpportunityCreateBody = {
  title: string;
  description: string;
  requiredSkills: string[];
  requirements: string;
  deadline: string;
  /** ISO date (yyyy-MM-dd) */
  startDate: string;
  targetUniversityIds: number[];
  positionCount: number;
  jobLocation: string;
  workplaceType: 'Remote' | 'Hybrid' | 'On-site';
  workType: 'FULL_TIME' | 'PART_TIME';
  duration: string;
  paid: boolean;
  salaryMonthly: number | null;
  niceToHave: string | null;
  draft: boolean;
};

function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function mapItem(item: CompanyOpportunityResponseItem): Opportunity {
  const workType = item.workType ?? undefined;
  const duration = item.duration ?? undefined;
  const niceToHave = item.niceToHave ?? undefined;
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    companyName: item.companyName || 'Company',
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
    postedAt: normalizePostedAtFromApi(item.postedAt),
  };
}

function formatErrorBody(parsed: unknown, status: number): string {
  if (parsed && typeof parsed === 'object') {
    const o = parsed as { error?: string; message?: string; errors?: Record<string, string> };
    if (o.errors && typeof o.errors === 'object') {
      const parts = Object.entries(o.errors).map(([k, v]) => `${k}: ${v}`);
      if (parts.length) return parts.join(' ');
    }
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.error === 'string' && o.error.trim()) return o.error.trim();
  }
  return `Request failed with status ${status}`;
}

export async function fetchCompanyOpportunities(
  accessToken: string
): Promise<{ data: Opportunity[] | null; errorMessage: string | null }> {
  try {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { data: null, errorMessage: 'Missing access token. Try signing out and back in.' };
    }

    const response = await fetch(apiUrl('/api/company/opportunities'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as CompanyOpportunitiesResponse | { error?: string }) : null;

    if (!response.ok) {
      return { data: null, errorMessage: formatErrorBody(parsed, response.status) };
    }

    const payload = parsed as CompanyOpportunitiesResponse | null;
    return {
      data: (payload?.opportunities || []).map(mapItem),
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not load opportunities.',
    };
  }
}

type TargetUniversitiesApiResponse = {
  universities: TargetUniversityOption[];
};

export async function fetchTargetUniversities(
  accessToken: string
): Promise<{ data: TargetUniversityOption[] | null; errorMessage: string | null }> {
  try {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { data: null, errorMessage: 'Missing access token. Try signing out and back in.' };
    }

    const response = await fetch(apiUrl('/api/company/target-universities'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const raw = await response.text();
    const parsed = raw
      ? (JSON.parse(raw) as TargetUniversitiesApiResponse | { error?: string })
      : null;

    if (!response.ok) {
      return { data: null, errorMessage: formatErrorBody(parsed, response.status) };
    }

    const payload = parsed as TargetUniversitiesApiResponse | null;
    const list = payload?.universities;
    if (!Array.isArray(list)) {
      return { data: [], errorMessage: null };
    }
    return { data: list, errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not load universities.',
    };
  }
}

export async function createCompanyOpportunity(
  accessToken: string,
  body: CompanyOpportunityCreateBody
): Promise<{ data: Opportunity | null; errorMessage: string | null }> {
  try {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { data: null, errorMessage: 'Missing access token. Try signing out and back in.' };
    }

    const response = await fetch(apiUrl('/api/company/opportunities'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const raw = await response.text();
    const parsed = raw
      ? (JSON.parse(raw) as CompanyOpportunityDetailResponse | { error?: string; errors?: Record<string, string> })
      : null;

    if (!response.ok) {
      return { data: null, errorMessage: formatErrorBody(parsed, response.status) };
    }

    const detail = parsed as CompanyOpportunityDetailResponse | null;
    if (!detail?.opportunity) {
      return { data: null, errorMessage: 'Invalid response from server.' };
    }
    const stats = detail.applicationStats ?? emptyApplicationStats;
    return {
      data: { ...mapItem(detail.opportunity), applicationStats: stats },
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not create opportunity.',
    };
  }
}

export async function updateCompanyOpportunity(
  accessToken: string,
  opportunityId: string,
  body: CompanyOpportunityUpdateBody
): Promise<{ data: Opportunity | null; errorMessage: string | null }> {
  try {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { data: null, errorMessage: 'Missing access token. Try signing out and back in.' };
    }

    const response = await fetch(apiUrl(`/api/company/opportunities/${encodeURIComponent(opportunityId)}`), {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const raw = await response.text();
    const parsed = raw
      ? (JSON.parse(raw) as CompanyOpportunityDetailResponse | { error?: string; errors?: Record<string, string> })
      : null;

    if (!response.ok) {
      return { data: null, errorMessage: formatErrorBody(parsed, response.status) };
    }

    const detail = parsed as CompanyOpportunityDetailResponse | null;
    if (!detail?.opportunity) {
      return { data: null, errorMessage: 'Invalid response from server.' };
    }
    const stats = detail.applicationStats ?? emptyApplicationStats;
    return {
      data: { ...mapItem(detail.opportunity), applicationStats: stats },
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not update opportunity.',
    };
  }
}
