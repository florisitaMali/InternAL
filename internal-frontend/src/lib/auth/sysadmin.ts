function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, '');
}

export interface AdminUniversityResponse {
  universityId: number;
  name: string;
  email: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
  founded: number | null;
  specialties: string | null;
  numberOfEmployees: number | null;
  logoUrl: string | null;
  coverUrl: string | null;
  isActive: boolean;
  canDelete: boolean;
  departmentCount: number;
  studentCount: number;
}

export interface AdminUniversityListResponse {
  items: AdminUniversityResponse[];
  total: number;
  active: number;
  inactive: number;
}

export interface AdminUniversityCreateRequest {
  name: string;
  email: string;
  location?: string | null;
  description?: string | null;
  website?: string | null;
  founded?: number | null;
  specialties?: string | null;
  numberOfEmployees?: number | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export interface AdminUniversityUpdateRequest {
  name: string;
  location?: string | null;
  description?: string | null;
  website?: string | null;
  founded?: number | null;
  specialties?: string | null;
  numberOfEmployees?: number | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

interface ApiResult<T> {
  data: T | null;
  errorMessage: string | null;
}

async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, accessToken: string, body?: unknown): Promise<ApiResult<T>> {
  const t = accessToken.trim();
  if (!t) {
    return { data: null, errorMessage: 'Not signed in.' };
  }
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${t}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

export function fetchSysAdminUniversities(accessToken: string) {
  return request<AdminUniversityListResponse>('GET', '/api/sysadmin/universities', accessToken);
}

export function createSysAdminUniversity(accessToken: string, body: AdminUniversityCreateRequest) {
  return request<AdminUniversityResponse>('POST', '/api/sysadmin/universities', accessToken, body);
}

export function updateSysAdminUniversity(accessToken: string, universityId: number, body: AdminUniversityUpdateRequest) {
  return request<AdminUniversityResponse>('PUT', `/api/sysadmin/universities/${universityId}`, accessToken, body);
}

export function setSysAdminUniversityActive(accessToken: string, universityId: number, isActive: boolean) {
  return request<AdminUniversityResponse>('PATCH', `/api/sysadmin/universities/${universityId}/status`, accessToken, { isActive });
}

export function deleteSysAdminUniversity(accessToken: string, universityId: number) {
  return request<void>('DELETE', `/api/sysadmin/universities/${universityId}`, accessToken);
}

/* ---------- Companies (US-24) ---------- */

export interface AdminCompanyResponse {
  companyId: number;
  name: string;
  email: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  website: string | null;
  foundedYear: number | null;
  employeeCount: number | null;
  specialties: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  isActive: boolean;
  canDelete: boolean;
  opportunityCount: number;
  applicationCount: number;
  feedbackCount: number;
}

export interface AdminCompanyListResponse {
  items: AdminCompanyResponse[];
  total: number;
  active: number;
  inactive: number;
}

export interface AdminCompanyCreateRequest {
  name: string;
  email: string;
  industry?: string | null;
  location?: string | null;
  description?: string | null;
  website?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  specialties?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export interface AdminCompanyUpdateRequest {
  name: string;
  industry?: string | null;
  location?: string | null;
  description?: string | null;
  website?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  specialties?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
}

export function fetchSysAdminCompanies(accessToken: string) {
  return request<AdminCompanyListResponse>('GET', '/api/sysadmin/companies', accessToken);
}

export function createSysAdminCompany(accessToken: string, body: AdminCompanyCreateRequest) {
  return request<AdminCompanyResponse>('POST', '/api/sysadmin/companies', accessToken, body);
}

export function updateSysAdminCompany(accessToken: string, companyId: number, body: AdminCompanyUpdateRequest) {
  return request<AdminCompanyResponse>('PUT', `/api/sysadmin/companies/${companyId}`, accessToken, body);
}

export function setSysAdminCompanyActive(accessToken: string, companyId: number, isActive: boolean) {
  return request<AdminCompanyResponse>('PATCH', `/api/sysadmin/companies/${companyId}/status`, accessToken, { isActive });
}

export function deleteSysAdminCompany(accessToken: string, companyId: number) {
  return request<void>('DELETE', `/api/sysadmin/companies/${companyId}`, accessToken);
}
