import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import type { Application, DashboardStats, Department, Student, StudyField } from '@/src/types';

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

async function postJson<T>(path: string, accessToken: string, body: unknown): Promise<{ data: T | null; errorMessage: string | null }> {
  const t = accessToken.trim();
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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

type AdminDepartmentRow = { departmentId: number; name: string; universityName: string | null };
type AdminStudyFieldRow = { fieldId: number; name: string; departmentId: number };
export type AdminStudentRow = {
  studentId: number;
  fullName: string | null;
  email: string | null;
  universityName: string | null;
  departmentId: number | null;
  studyFieldId: number | null;
  studyYear: number | null;
  cgpa: number | null;
  studyFieldName?: string | null;
  applicationCount?: number | null;
  applicationStatus?: string | null;
};
type AdminStatsRow = { totalStudents: number; totalDepartments: number; totalStudyFields: number; ppaApprovers: number };
type AdminCompanyRow = { companyId: number; name: string; industry: string | null };
type AdminOpportunityRow = {
  opportunityId: number;
  title: string | null;
  companyName: string | null;
  deadline: string | null;
  type: string | null;
};

export function mapAdminStudentToStudent(row: AdminStudentRow): Student {
  return {
    id: String(row.studentId),
    fullName: row.fullName || '—',
    email: row.email || '',
    role: 'STUDENT',
    university: row.universityName || '',
    departmentName: row.departmentId != null ? String(row.departmentId) : undefined,
    studyFieldName: row.studyFieldId != null ? String(row.studyFieldId) : undefined,
    studyYear: row.studyYear ?? 1,
    cgpa: row.cgpa ?? 0,
    hasCompletedPP: false,
  };
}

export async function fetchAdminDepartments(
  accessToken: string
): Promise<{ data: Department[] | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchJson<AdminDepartmentRow[]>('/api/admin/departments', accessToken);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load departments.' };
  }
  const mapped: Department[] = data.map((d) => ({
    id: String(d.departmentId),
    name: d.name || '—',
    universityName: d.universityName || '',
  }));
  return { data: mapped, errorMessage: null };
}

export async function fetchAdminStudyFields(
  accessToken: string,
  departmentId?: string
): Promise<{ data: StudyField[] | null; errorMessage: string | null }> {
  const q =
    departmentId && departmentId.trim() !== ''
      ? `/api/admin/study-fields?departmentId=${encodeURIComponent(departmentId)}`
      : '/api/admin/study-fields';
  const { data, errorMessage } = await fetchJson<AdminStudyFieldRow[]>(q, accessToken);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load study fields.' };
  }
  const mapped: StudyField[] = data.map((f) => ({
    id: String(f.fieldId),
    name: f.name || '—',
    departmentId: String(f.departmentId),
  }));
  return { data: mapped, errorMessage: null };
}

export async function fetchAdminStudents(
  accessToken: string
): Promise<{ data: Student[] | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchJson<AdminStudentRow[]>('/api/admin/students', accessToken);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load students.' };
  }
  return { data: data.map(mapAdminStudentToStudent), errorMessage: null };
}

export async function fetchAdminDashboardStats(
  accessToken: string
): Promise<{ data: DashboardStats | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchJson<AdminStatsRow>('/api/admin/dashboard/stats', accessToken);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load stats.' };
  }
  return {
    data: {
      totalStudents: data.totalStudents,
      totalDepartments: data.totalDepartments,
      totalStudyFields: data.totalStudyFields,
      ppaApprovers: data.ppaApprovers,
    },
    errorMessage: null,
  };
}

/** PPA count is returned as fourth stat from API; exposed for dashboards that need it. */
export async function fetchAdminDashboardStatsRaw(
  accessToken: string
): Promise<{ data: AdminStatsRow | null; errorMessage: string | null }> {
  return fetchJson<AdminStatsRow>('/api/admin/dashboard/stats', accessToken);
}

export async function createAdminStudent(
  accessToken: string,
  payload: {
    fullName: string;
    email: string;
    departmentId: number;
    studyFieldId: number;
    studyYear: number;
    cgpa: number;
  }
): Promise<{ data: Student | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postJson<AdminStudentRow>('/api/admin/students', accessToken, payload);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not create student.' };
  }
  return { data: mapAdminStudentToStudent(data), errorMessage: null };
}

export async function fetchAdminCompanies(
  accessToken: string,
  limit = 10
): Promise<{ data: AdminCompanyRow[] | null; errorMessage: string | null }> {
  return fetchJson<AdminCompanyRow[]>(`/api/admin/companies?limit=${limit}`, accessToken);
}

export async function fetchAdminOpportunities(
  accessToken: string,
  limit = 100
): Promise<{ data: AdminOpportunityRow[] | null; errorMessage: string | null }> {
  return fetchJson<AdminOpportunityRow[]>(`/api/admin/opportunities?limit=${limit}`, accessToken);
}

export async function fetchAdminApplications(
  accessToken: string
): Promise<{ data: ApplicationResponse[] | null; errorMessage: string | null }> {
  return fetchJson<ApplicationResponse[]>('/api/admin/applications', accessToken);
}

export function mapApplicationResponseToApplication(row: ApplicationResponse): Application {
  const type =
    row.applicationType === 'PROFESSIONAL_PRACTICE' || row.applicationType === 'INDIVIDUAL_GROWTH'
      ? row.applicationType
      : 'PROFESSIONAL_PRACTICE';
  const status =
    row.status === 'APPROVED' || row.status === 'REJECTED' || row.status === 'PENDING' || row.status === 'WAITING'
      ? row.status
      : 'PENDING';
  return {
    id: row.applicationId != null ? String(row.applicationId) : '—',
    studentId: row.studentId != null ? String(row.studentId) : '—',
    studentName: row.studentName?.trim() || '—',
    companyId: row.companyId != null ? String(row.companyId) : '—',
    companyName: row.companyName || '—',
    opportunityId: row.opportunityId != null ? String(row.opportunityId) : '—',
    opportunityTitle: row.opportunityTitle || '—',
    type,
    isApprovedByPPA: row.isApprovedByPPA ?? undefined,
    isApprovedByCompany: row.isApprovedByCompany ?? undefined,
    createdAt: row.createdAt || '—',
    status,
  };
}
