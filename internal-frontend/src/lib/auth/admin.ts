import type { ApplicationResponse } from '@/src/lib/auth/opportunities';
import { getAccessTokenForMutatingApi, getSessionAccessToken } from '@/src/lib/auth/getSessionAccessToken';
import type { Application, DashboardStats, Department, Opportunity, PPAApprover, Student, StudyField } from '@/src/types';
import {
  coerceApiDateToIsoString,
  formatDeadline,
  formatDurationCodeLabel,
  formatPostedDisplay,
  formatWorkTypeLabel,
  normalizePostedAtFromApi,
  responsibilitiesFromNiceToHave,
} from '@/src/lib/opportunityFormat';

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

/** Prefer live Supabase session so callers are not stuck with a stale prop/ref token. */
async function bearerForRead(accessToken: string): Promise<string | null> {
  const live = await getSessionAccessToken();
  if (live) return live;
  const t = accessToken.trim();
  return t.length > 0 ? t : null;
}

async function bearerForMutation(accessToken: string): Promise<string | null> {
  const live = await getAccessTokenForMutatingApi();
  if (live) return live;
  const t = accessToken.trim();
  return t.length > 0 ? t : null;
}

async function fetchJson<T>(path: string, accessToken: string): Promise<{ data: T | null; errorMessage: string | null }> {
  const t = await bearerForRead(accessToken);
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
  const t = await bearerForMutation(accessToken);
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

async function putJson<T>(path: string, accessToken: string, body: unknown): Promise<{ data: T | null; errorMessage: string | null }> {
  const t = await bearerForMutation(accessToken);
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'PUT',
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

async function patchJson<T>(path: string, accessToken: string, body: unknown): Promise<{ data: T | null; errorMessage: string | null }> {
  const t = await bearerForMutation(accessToken);
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'PATCH',
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

async function deleteJson(path: string, accessToken: string): Promise<{ errorMessage: string | null }> {
  const t = await bearerForMutation(accessToken);
  if (!t) {
    return { errorMessage: 'Not signed in.' };
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      const raw = await response.text();
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      let msg = `Request failed with status ${response.status}`;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'error' in parsed) {
        const e = (parsed as { error?: unknown }).error;
        if (typeof e === 'string' && e.trim()) msg = e.trim();
      }
      return { errorMessage: msg };
    }
    return { errorMessage: null };
  } catch (e) {
    return { errorMessage: e instanceof Error ? e.message : 'Request failed' };
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
  departmentName?: string | null;
  applicationCount?: number | null;
  applicationStatus?: string | null;
};
type AdminStatsRow = { totalStudents: number; totalDepartments: number; totalStudyFields: number; ppaApprovers: number };
type AdminCompanyRow = { companyId: number; name: string; industry: string | null };
export type AdminOpportunityRow = {
  opportunityId: number;
  companyId: number;
  title: string | null;
  companyName: string | null;
  affiliatedUniversityName: string | null;
  deadline: string | null;
  type: string | null;
  targetUniversityNames: string[] | null;
  description: string | null;
  location: string | null;
  workMode: string | null;
  duration: string | null;
  createdAt: string | null;
  requiredSkills: string[] | null;
  applicantCount: number;
  viewerCollaborationStatus: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k];
    if (v == null) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length) return t;
      continue;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function pickNum(r: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function pickStrList(r: Record<string, unknown>, ...keys: string[]): string[] | null {
  for (const k of keys) {
    const v = r[k];
    if (Array.isArray(v)) {
      return v
        .filter((x) => x != null)
        .map((x) => String(x).trim())
        .filter(Boolean);
    }
    if (typeof v === 'string' && v.trim()) {
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return null;
}

function parseAdminOpportunitySummaryResponse(raw: unknown): AdminOpportunityRow {
  if (!isRecord(raw)) {
    return {
      opportunityId: 0,
      companyId: 0,
      title: null,
      companyName: null,
      affiliatedUniversityName: null,
      deadline: null,
      type: null,
      targetUniversityNames: null,
      description: null,
      location: null,
      workMode: null,
      duration: null,
      createdAt: null,
      requiredSkills: null,
      applicantCount: 0,
      viewerCollaborationStatus: null,
    };
  }
  const r = raw;
  return {
    opportunityId: pickNum(r, 'opportunityId', 'opportunity_id') ?? 0,
    companyId: pickNum(r, 'companyId', 'company_id') ?? 0,
    title: pickStr(r, 'title'),
    companyName: pickStr(r, 'companyName', 'company_name'),
    affiliatedUniversityName: pickStr(r, 'affiliatedUniversityName', 'affiliated_university_name'),
    deadline: pickStr(r, 'deadline') ?? coerceApiDateToIsoString(r.deadline) ?? null,
    type: pickStr(r, 'type'),
    targetUniversityNames: pickStrList(r, 'targetUniversityNames', 'target_university_names'),
    description: pickStr(r, 'description'),
    location: pickStr(r, 'location', 'job_location', 'jobLocation'),
    workMode: pickStr(r, 'workMode', 'work_mode'),
    duration: pickStr(r, 'duration'),
    createdAt: pickStr(r, 'createdAt', 'created_at'),
    requiredSkills: pickStrList(r, 'requiredSkills', 'required_skills'),
    applicantCount: pickNum(r, 'applicantCount', 'applicant_count') ?? 0,
    viewerCollaborationStatus: pickStr(r, 'viewerCollaborationStatus', 'viewer_collaboration_status'),
  };
}

function parseTargetUniversitiesFromDetail(
  raw: unknown
): { universityId: number; name: string; collaborationStatus?: string | null }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: { universityId: number; name: string; collaborationStatus?: string | null }[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const uid = pickNum(item, 'universityId', 'university_id');
    if (uid == null) continue;
    const name = pickStr(item, 'name');
    const collaborationStatus = pickStr(item, 'collaborationStatus', 'collaboration_status');
    out.push({
      universityId: uid,
      name: name ?? `University ${uid}`,
      ...(collaborationStatus != null ? { collaborationStatus } : {}),
    });
  }
  return out.length ? out : null;
}

function parseAdminOpportunityDetailResponse(raw: unknown): AdminOpportunityDetail | null {
  if (!isRecord(raw)) return null;
  const r = raw;
  const targetsRaw = r.targetUniversities ?? r.target_universities;
  const targetUniversities = parseTargetUniversitiesFromDetail(targetsRaw);
  const tidRaw = r.targetUniversityIds ?? r.target_university_ids;
  let targetUniversityIds: number[] | null = null;
  if (Array.isArray(tidRaw)) {
    targetUniversityIds = tidRaw
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((n) => Number.isFinite(n)) as number[];
    if (targetUniversityIds.length === 0) targetUniversityIds = null;
  }

  const deadline = coerceApiDateToIsoString(r.deadline) ?? pickStr(r, 'deadline');
  const startDate =
    coerceApiDateToIsoString(r.startDate) ?? coerceApiDateToIsoString(r.start_date) ?? pickStr(r, 'startDate', 'start_date');
  const postedAtRaw = normalizePostedAtFromApi(r.postedAt ?? r.posted_at);
  const createdAt = pickStr(r, 'createdAt', 'created_at');

  return {
    id: pickNum(r, 'id'),
    companyId: pickNum(r, 'companyId', 'company_id'),
    companyName: pickStr(r, 'companyName', 'company_name'),
    affiliatedUniversityName: pickStr(r, 'affiliatedUniversityName', 'affiliated_university_name'),
    title: pickStr(r, 'title'),
    description: pickStr(r, 'description'),
    requiredSkills: pickStrList(r, 'requiredSkills', 'required_skills'),
    requiredExperience: pickStr(r, 'requiredExperience', 'required_experience'),
    deadline,
    startDate,
    targetUniversityIds,
    targetUniversities,
    type: pickStr(r, 'type'),
    location: pickStr(r, 'location', 'job_location'),
    isPaid: typeof r.isPaid === 'boolean' ? r.isPaid : typeof r.is_paid === 'boolean' ? r.is_paid : null,
    workMode: pickStr(r, 'workMode', 'work_mode'),
    positionCount: pickNum(r, 'positionCount', 'position_count'),
    workType: pickStr(r, 'workType', 'work_type'),
    duration: pickStr(r, 'duration'),
    salaryMonthly: pickNum(r, 'salaryMonthly', 'salary_monthly'),
    niceToHave: pickStr(r, 'niceToHave', 'nice_to_have'),
    draft: typeof r.draft === 'boolean' ? r.draft : typeof r.is_draft === 'boolean' ? r.is_draft : null,
    postedAt: postedAtRaw ?? null,
    skillMatchCount: pickNum(r, 'skillMatchCount', 'skill_match_count'),
    code: pickStr(r, 'code'),
    createdAt,
    applicantCount: pickNum(r, 'applicantCount', 'applicant_count'),
    collaborationSummary: pickStr(r, 'collaborationSummary', 'collaboration_summary'),
    collaborationApproved: parseTargetUniversitiesFromDetail(r.collaborationApproved ?? r.collaboration_approved),
    collaborationRejected: parseTargetUniversitiesFromDetail(r.collaborationRejected ?? r.collaboration_rejected),
    collaborationPending: parseTargetUniversitiesFromDetail(r.collaborationPending ?? r.collaboration_pending),
  };
}

export type AdminOpportunityDetail = {
  id: number | null;
  companyId: number | null;
  companyName: string | null;
  affiliatedUniversityName: string | null;
  title: string | null;
  description: string | null;
  requiredSkills: string[] | null;
  requiredExperience: string | null;
  deadline: string | null;
  startDate: string | null;
  targetUniversityIds: number[] | null;
  targetUniversities: { universityId: number; name: string; collaborationStatus?: string | null }[] | null;
  type: string | null;
  location: string | null;
  isPaid: boolean | null;
  workMode: string | null;
  positionCount: number | null;
  workType: string | null;
  duration: string | null;
  salaryMonthly: number | null;
  niceToHave: string | null;
  draft: boolean | null;
  postedAt: string | null;
  skillMatchCount: number | null;
  code: string | null;
  createdAt: string | null;
  applicantCount: number | null;
  collaborationSummary: string | null;
  collaborationApproved?: { universityId: number; name: string }[] | null;
  collaborationRejected?: { universityId: number; name: string }[] | null;
  collaborationPending?: { universityId: number; name: string }[] | null;
};

/** List card: same shape as student explore cards (subset from admin summary API). */
export function mapAdminOpportunitySummaryToOpportunity(row: AdminOpportunityRow): Opportunity {
  const postedAt = normalizePostedAtFromApi(row.createdAt);
  return {
    id: String(row.opportunityId),
    companyId: String(row.companyId),
    companyName: row.companyName || 'Unknown company',
    affiliatedUniversityName: row.affiliatedUniversityName?.trim() || undefined,
    title: row.title || 'Untitled opportunity',
    description: row.description?.trim() || '',
    requiredSkills: row.requiredSkills ?? [],
    targetUniversityIds: [],
    deadline: row.deadline || undefined,
    type: row.type || undefined,
    location: row.location?.trim() || undefined,
    workMode: row.workMode || undefined,
    duration: row.duration || undefined,
    createdAt: row.createdAt ?? undefined,
    applicantCount: row.applicantCount ?? 0,
    draft: false,
    postedAt,
    postedLabel: postedAt ? formatPostedDisplay(postedAt) : undefined,
    summaryApprovedUniversityNames: row.targetUniversityNames?.filter(Boolean) ?? undefined,
    viewerCollaborationStatus: row.viewerCollaborationStatus ?? undefined,
  };
}

/** Full detail: matches company/student `OpportunityResponseItem` mapping. */
export function mapAdminOpportunityDetailToOpportunity(item: AdminOpportunityDetail): Opportunity {
  const workType = item.workType ?? undefined;
  const duration = item.duration ?? undefined;
  const niceToHave = item.niceToHave ?? undefined;
  const postedAt = normalizePostedAtFromApi(item.postedAt);
  const exp = item.requiredExperience?.trim();
  const deadlineIso = item.deadline ? coerceApiDateToIsoString(item.deadline) ?? item.deadline : undefined;
  const startIso = item.startDate ? coerceApiDateToIsoString(item.startDate) ?? item.startDate : undefined;
  return {
    id: item.id != null ? String(item.id) : '',
    companyId: item.companyId != null ? String(item.companyId) : '',
    companyName: item.companyName || 'Unknown company',
    affiliatedUniversityName: item.affiliatedUniversityName?.trim() || undefined,
    title: item.title || 'Untitled opportunity',
    description: item.description?.trim() || '',
    requiredSkills: item.requiredSkills ?? [],
    requiredExperience: item.requiredExperience || undefined,
    deadline: deadlineIso || undefined,
    startDate: startIso || undefined,
    targetUniversities: item.targetUniversities ?? undefined,
    targetUniversityIds:
      item.targetUniversities?.length
        ? item.targetUniversities.map((t) => String(t.universityId))
        : (item.targetUniversityIds || []).map(String),
    type: item.type || undefined,
    location: item.location?.trim() || undefined,
    isPaid: item.isPaid,
    workMode: item.workMode || undefined,
    skillMatchCount: item.skillMatchCount ?? 0,
    positionCount: item.positionCount ?? undefined,
    workType,
    duration,
    salaryMonthly: item.salaryMonthly ?? undefined,
    niceToHave,
    draft: item.draft === true,
    code: item.code ?? undefined,
    applicantCount: item.applicantCount ?? 0,
    createdAt: item.createdAt ?? undefined,
    jobTypeLabel: formatWorkTypeLabel(workType),
    durationLabel: formatDurationCodeLabel(duration),
    startDateLabel: item.startDate ? formatDeadline(item.startDate) : undefined,
    responsibilities: responsibilitiesFromNiceToHave(niceToHave),
    requirements: exp ? exp.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : undefined,
    postedAt,
    postedLabel: postedAt ? formatPostedDisplay(postedAt) : undefined,
    collaborationSummary: item.collaborationSummary?.trim() || undefined,
    collaborationApproved: item.collaborationApproved ?? undefined,
    collaborationRejected: item.collaborationRejected ?? undefined,
    collaborationPending: item.collaborationPending ?? undefined,
  };
}

type AdminPpaRow = {
  ppaId: number;
  fullName: string | null;
  email: string | null;
  departmentId: number | null;
  departmentName: string | null;
  studyFields: AdminStudyFieldRow[] | null;
};

export function mapAdminStudentToStudent(row: AdminStudentRow): Student {
  const departmentId = row.departmentId != null ? String(row.departmentId) : undefined;
  const studyFieldId = row.studyFieldId != null ? String(row.studyFieldId) : undefined;
  const departmentName = row.departmentName?.trim() || undefined;
  const studyFieldName = row.studyFieldName?.trim() || undefined;
  return {
    id: String(row.studentId),
    fullName: row.fullName || '—',
    email: row.email || '',
    role: 'STUDENT',
    university: row.universityName || '',
    departmentId,
    studyFieldId,
    departmentName: departmentName ?? departmentId,
    studyFieldName: studyFieldName ?? studyFieldId,
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

export async function createAdminDepartment(
  accessToken: string,
  payload: { name: string }
): Promise<{ data: Department | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postJson<AdminDepartmentRow>('/api/admin/departments', accessToken, {
    name: payload.name.trim(),
  });
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not create department.' };
  }
  return {
    data: {
      id: String(data.departmentId),
      name: data.name || '—',
      universityName: data.universityName || '',
    },
    errorMessage: null,
  };
}

export async function createAdminStudyField(
  accessToken: string,
  payload: { name: string; departmentId: number }
): Promise<{ data: StudyField | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postJson<AdminStudyFieldRow>('/api/admin/study-fields', accessToken, {
    name: payload.name.trim(),
    departmentId: payload.departmentId,
  });
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not create study field.' };
  }
  return {
    data: {
      id: String(data.fieldId),
      name: data.name || '—',
      departmentId: String(data.departmentId),
    },
    errorMessage: null,
  };
}

export async function updateAdminDepartment(
  accessToken: string,
  departmentId: number,
  payload: { name: string }
): Promise<{ data: Department | null; errorMessage: string | null }> {
  const { data, errorMessage } = await putJson<AdminDepartmentRow>(
    `/api/admin/departments/${encodeURIComponent(String(departmentId))}`,
    accessToken,
    { name: payload.name.trim() }
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not update department.' };
  }
  return {
    data: {
      id: String(data.departmentId),
      name: data.name || '—',
      universityName: data.universityName || '',
    },
    errorMessage: null,
  };
}

export async function deleteAdminDepartment(
  accessToken: string,
  departmentId: number
): Promise<{ errorMessage: string | null }> {
  return deleteJson(`/api/admin/departments/${encodeURIComponent(String(departmentId))}`, accessToken);
}

export async function updateAdminStudyField(
  accessToken: string,
  fieldId: number,
  payload: { name: string; departmentId: number }
): Promise<{ data: StudyField | null; errorMessage: string | null }> {
  const { data, errorMessage } = await putJson<AdminStudyFieldRow>(
    `/api/admin/study-fields/${encodeURIComponent(String(fieldId))}`,
    accessToken,
    { name: payload.name.trim(), departmentId: payload.departmentId }
  );
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not update study field.' };
  }
  return {
    data: {
      id: String(data.fieldId),
      name: data.name || '—',
      departmentId: String(data.departmentId),
    },
    errorMessage: null,
  };
}

export async function deleteAdminStudyField(
  accessToken: string,
  fieldId: number
): Promise<{ errorMessage: string | null }> {
  return deleteJson(`/api/admin/study-fields/${encodeURIComponent(String(fieldId))}`, accessToken);
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
  options?: { limit?: number; status?: 'all' | 'active' | 'expired' }
): Promise<{ data: AdminOpportunityRow[] | null; errorMessage: string | null }> {
  const limit = options?.limit ?? 100;
  const status = options?.status ?? 'all';
  const { data, errorMessage } = await fetchJson<unknown>(
    `/api/admin/opportunities?limit=${encodeURIComponent(String(limit))}&status=${encodeURIComponent(status)}`,
    accessToken
  );
  if (errorMessage || data == null) {
    return { data: null, errorMessage: errorMessage ?? 'Could not load opportunities.' };
  }
  if (!Array.isArray(data)) {
    return { data: null, errorMessage: 'Invalid opportunities response.' };
  }
  return { data: data.map(parseAdminOpportunitySummaryResponse), errorMessage: null };
}

export async function fetchAdminOpportunityDetail(
  accessToken: string,
  opportunityId: number
): Promise<{ data: AdminOpportunityDetail | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchJson<unknown>(
    `/api/admin/opportunities/${encodeURIComponent(String(opportunityId))}`,
    accessToken
  );
  if (errorMessage || data == null) {
    return { data: null, errorMessage: errorMessage ?? 'Could not load opportunity.' };
  }
  const parsed = parseAdminOpportunityDetailResponse(data);
  if (!parsed) {
    return { data: null, errorMessage: 'Invalid opportunity response.' };
  }
  return { data: parsed, errorMessage: null };
}

export async function patchAdminOpportunityCollaboration(
  accessToken: string,
  opportunityId: number,
  approved: boolean
): Promise<{ data: AdminOpportunityDetail | null; errorMessage: string | null }> {
  const { data, errorMessage } = await patchJson<unknown>(
    `/api/admin/opportunities/${encodeURIComponent(String(opportunityId))}/collaboration`,
    accessToken,
    { approved }
  );
  if (errorMessage || data == null) {
    return { data: null, errorMessage: errorMessage ?? 'Could not update collaboration.' };
  }
  const parsed = parseAdminOpportunityDetailResponse(data);
  if (!parsed) {
    return { data: null, errorMessage: 'Invalid opportunity response.' };
  }
  return { data: parsed, errorMessage: null };
}

export async function fetchAdminApplications(
  accessToken: string
): Promise<{ data: ApplicationResponse[] | null; errorMessage: string | null }> {
  return fetchJson<ApplicationResponse[]>('/api/admin/applications', accessToken);
}

export async function fetchAdminPpas(
  accessToken: string
): Promise<{ data: PPAApprover[] | null; errorMessage: string | null }> {
  const { data, errorMessage } = await fetchJson<AdminPpaRow[]>('/api/admin/ppas', accessToken);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load PP approvers.' };
  }
  const mapped: PPAApprover[] = data.map((p) => ({
    id: String(p.ppaId),
    fullName: p.fullName || '—',
    email: p.email || '',
    departmentId: p.departmentId != null ? String(p.departmentId) : '',
    departmentName: p.departmentName || '—',
    assignedStudyFields: (p.studyFields || []).map((f) => ({
      id: String(f.fieldId),
      name: f.name || '—',
      departmentId: String(f.departmentId),
    })),
  }));
  return { data: mapped, errorMessage: null };
}

type PpaUpsertPayload = {
  fullName: string;
  email: string;
  departmentId: number;
  studyFieldIds: number[];
};

export async function createAdminPpa(
  accessToken: string,
  payload: PpaUpsertPayload
): Promise<{ data: PPAApprover | null; errorMessage: string | null }> {
  const { data, errorMessage } = await postJson<AdminPpaRow>('/api/admin/ppas', accessToken, payload);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not create PP approver.' };
  }
  return {
    data: {
      id: String(data.ppaId),
      fullName: data.fullName || '—',
      email: data.email || '',
      departmentId: data.departmentId != null ? String(data.departmentId) : '',
      departmentName: data.departmentName || '—',
      assignedStudyFields: (data.studyFields || []).map((f) => ({
        id: String(f.fieldId),
        name: f.name || '—',
        departmentId: String(f.departmentId),
      })),
    },
    errorMessage: null,
  };
}

export async function updateAdminPpa(
  accessToken: string,
  ppaId: string,
  payload: PpaUpsertPayload
): Promise<{ data: PPAApprover | null; errorMessage: string | null }> {
  const { data, errorMessage } = await putJson<AdminPpaRow>(`/api/admin/ppas/${encodeURIComponent(ppaId)}`, accessToken, payload);
  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not update PP approver.' };
  }
  return {
    data: {
      id: String(data.ppaId),
      fullName: data.fullName || '—',
      email: data.email || '',
      departmentId: data.departmentId != null ? String(data.departmentId) : '',
      departmentName: data.departmentName || '—',
      assignedStudyFields: (data.studyFields || []).map((f) => ({
        id: String(f.fieldId),
        name: f.name || '—',
        departmentId: String(f.departmentId),
      })),
    },
    errorMessage: null,
  };
}

export async function deleteAdminPpa(
  accessToken: string,
  ppaId: string
): Promise<{ errorMessage: string | null }> {
  return deleteJson(`/api/admin/ppas/${encodeURIComponent(ppaId)}`, accessToken);
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
