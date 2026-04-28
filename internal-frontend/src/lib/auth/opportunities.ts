import type { Opportunity } from '@/src/types';
import { normalizePostedAtFromApi } from '@/src/lib/opportunityFormat';

type StudentOpportunityResponseItem = {
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
  workType?: string | null;
  duration?: string | null;
  code?: string | null;
  positionCount?: number | null;
  salaryMonthly?: number | null;
  niceToHave?: string | null;
  createdAt?: string | null;
  applicantCount?: number | null;
  draft?: boolean | null;
  postedAt?: string | null;
};

type StudentOpportunitiesResponse = {
  opportunities: StudentOpportunityResponseItem[];
};

export type StudentOpportunityFilters = {
  q?: string;
  skills?: string[];
  type?: string;
  location?: string;
  workMode?: string;
  isPaid?: boolean;
};

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
}

function mapApiDateField(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length >= 3) {
    const y = value[0] as number;
    const m = value[1] as number;
    const d = value[2] as number;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return undefined;
}

function mapOpportunity(item: StudentOpportunityResponseItem): Opportunity {
  return {
    id: String(item.id),
    companyId: String(item.companyId),
    companyName: item.companyName || 'Unknown company',
    title: item.title || 'Untitled opportunity',
    description: item.description || '',
    requiredSkills: item.requiredSkills || [],
    requiredExperience: item.requiredExperience || undefined,
    deadline: item.deadline || undefined,
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
    workType: item.workType ?? undefined,
    duration: item.duration ?? undefined,
    code: item.code ?? undefined,
    positionCount: item.positionCount ?? undefined,
    salaryMonthly: item.salaryMonthly ?? undefined,
    niceToHave: item.niceToHave ?? undefined,
    startDate: mapApiDateField(item.startDate as unknown) ?? item.startDate ?? undefined,
    createdAt: item.createdAt ?? undefined,
    applicantCount: item.applicantCount ?? 0,
    draft: item.draft === true,
    postedAt: normalizePostedAtFromApi(item.postedAt),
  };
}

export async function fetchStudentOpportunities(
  accessToken: string,
  filters: StudentOpportunityFilters = {}
): Promise<{ data: Opportunity[] | null; errorMessage: string | null }> {
  try {
    const params = new URLSearchParams();

    if (filters.q?.trim()) params.set('q', filters.q.trim());
    if (filters.type?.trim()) params.set('type', filters.type.trim());
    if (filters.location?.trim()) params.set('location', filters.location.trim());
    if (filters.workMode?.trim()) params.set('workMode', filters.workMode.trim());
    if (filters.isPaid !== undefined) params.set('paid', String(filters.isPaid));
    (filters.skills || [])
      .map((skill) => skill.trim())
      .filter(Boolean)
      .forEach((skill) => params.append('skills', skill));

    const query = params.toString();
    const response = await fetch(
      `${getApiBaseUrl()}/api/student/opportunities${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as StudentOpportunitiesResponse | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    const payload = parsed as StudentOpportunitiesResponse | null;
    return {
      data: (payload?.opportunities || []).map(mapOpportunity),
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not load opportunities.',
    };
  }
}

export type ApplicationResponse = {
  applicationId: number | null;
  studentId: number | null;
  companyId: number | null;
  opportunityId: number | null;
  applicationType: string | null;
  phoneNumber?: string | null;
  accuracyConfirmed?: boolean | null;
  status: string | null;
  isApprovedByPPA: boolean | null;
  isApprovedByCompany: boolean | null;
  opportunityTitle: string | null;
  companyName: string | null;
  studentName?: string | null;
  createdAt: string | null;
};

export async function fetchStudentApplications(
  accessToken: string
): Promise<{ data: ApplicationResponse[] | null; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/student/applications`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as ApplicationResponse[] | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    return {
      data: (parsed as ApplicationResponse[]) || [],
      errorMessage: null,
    };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Could not load applications.',
    };
  }
}
