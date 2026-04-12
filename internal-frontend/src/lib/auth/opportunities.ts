import type { Opportunity } from '@/src/types';

type StudentOpportunityResponseItem = {
  id: number;
  companyId: number;
  companyName: string | null;
  title: string | null;
  description: string | null;
  requiredSkills: string[] | null;
  requiredExperience: string | null;
  deadline: string | null;
  targetUniversityIds: number[] | null;
  type: string | null;
  location: string | null;
  isPaid: boolean | null;
  workMode: string | null;
  skillMatchCount: number | null;
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
    targetUniversityIds: (item.targetUniversityIds || []).map(String),
    type: item.type || undefined,
    location: item.location || undefined,
    isPaid: item.isPaid,
    workMode: item.workMode || undefined,
    skillMatchCount: item.skillMatchCount ?? 0,
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
    if (filters.isPaid !== undefined) params.set('isPaid', String(filters.isPaid));
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
