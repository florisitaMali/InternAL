import type { Role, Student, StudentProfileFile } from '@/src/types';

export type CurrentUserResponse = {
  userId: number;
  email: string;
  role: Role;
  linkedEntityId: string | number;
};

export type StudentProfileResponse = {
  studentId: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  universityId: number | null;
  universityName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  fieldId: number | null;
  fieldName: string | null;
  studyYear: number | null;
  cgpa: number | null;
  hasCompletedPp: boolean | null;
  accessStartDate: string | null;
  accessEndDate: string | null;
  description: string | null;
  skills: string | null;
  certificates: string | null;
  languages: string | null;
  experience: string | null;
  hobbies: string | null;
  cvUrl: string | null;
  cvFilename: string | null;
  cvFile: StudentProfileFileResponse | null;
  certificationFiles: StudentProfileFileResponse[] | null;
};

export type StudentProfileFileResponse = {
  certificationId?: number;
  displayName: string;
  storagePath?: string;
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  downloadUrl?: string;
};

export type LoadedAppUser = {
  user: CurrentUserResponse;
  displayName: string;
  studentProfile: Student | null;
};

export type StudentProfileUpdateRequest = {
  description: string;
  skills: string;
  certificates: string;
  languages: string;
  experience: string;
  hobbies: string;
};

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:8080';
}

function normalizeDisplayName(metadataName: string | undefined, email: string): string {
  if (metadataName?.trim()) return metadataName.trim();

  const localPart = email.split('@')[0] || 'User';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchBackendJson<T>(
  path: string,
  accessToken: string
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

async function sendBackendJson<T>(
  path: string,
  accessToken: string,
  method: 'PUT',
  body: unknown
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

async function sendBackendFormData<T>(
  path: string,
  accessToken: string,
  body: FormData
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    });

    const raw = await response.text();
    const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : null;

    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string'
          ? parsed.error
          : `Request failed with status ${response.status}`;
      return { data: null, errorMessage: message };
    }

    return { data: parsed as T, errorMessage: null };
  } catch (e) {
    return {
      data: null,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

async function sendBackendRequest(
  path: string,
  accessToken: string,
  method: 'DELETE'
): Promise<{ ok: boolean; errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as { error?: string }) : null;
      return {
        ok: false,
        errorMessage:
          parsed && typeof parsed.error === 'string'
            ? parsed.error
            : `Request failed with status ${response.status}`,
      };
    }

    return { ok: true, errorMessage: null };
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof Error ? e.message : 'Request failed',
    };
  }
}

export async function fetchCurrentUser(
  accessToken: string
): Promise<{ data: CurrentUserResponse | null; errorMessage: string | null }> {
  return fetchBackendJson<CurrentUserResponse>('/api/me', accessToken);
}

export async function fetchCurrentStudentProfile(
  accessToken: string
): Promise<{ data: StudentProfileResponse | null; errorMessage: string | null }> {
  return fetchBackendJson<StudentProfileResponse>('/api/student/profile', accessToken);
}

export function mapStudentToProfileUpdate(student: Student): StudentProfileUpdateRequest {
  return {
    description: student.extendedProfile?.description || '',
    skills: (student.extendedProfile?.skills || []).join(', '),
    certificates: (student.extendedProfile?.certificates || []).join(', '),
    languages: (student.extendedProfile?.languages || []).join(', '),
    experience: (student.extendedProfile?.experience || []).join(', '),
    hobbies: (student.extendedProfile?.hobbies || []).join(', '),
  };
}

export async function saveCurrentStudentProfile(
  accessToken: string,
  student: Student
): Promise<{ data: Student | null; errorMessage: string | null }> {
  const { data, errorMessage } = await sendBackendJson<StudentProfileResponse>(
    '/api/student/profile',
    accessToken,
    'PUT',
    mapStudentToProfileUpdate(student)
  );

  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not save student profile.' };
  }

  return { data: mapStudentProfileToStudent(data), errorMessage: null };
}

function mapStudentProfileFile(file: StudentProfileFileResponse): StudentProfileFile {
  return {
    certificationId: file.certificationId,
    displayName: file.displayName,
    storagePath: file.storagePath,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    uploadedAt: file.uploadedAt,
    downloadUrl: file.downloadUrl,
  };
}

export function mapStudentProfileToStudent(profile: StudentProfileResponse): Student {
  return {
    id: String(profile.studentId),
    fullName: profile.fullName || 'Student',
    email: profile.email || '',
    role: 'STUDENT',
    phone: profile.phone || undefined,
    universityId: profile.universityId != null ? String(profile.universityId) : undefined,
    departmentId: profile.departmentId != null ? String(profile.departmentId) : undefined,
    studyFieldId: profile.fieldId != null ? String(profile.fieldId) : undefined,
    university: profile.universityName || 'University not set',
    departmentName: profile.departmentName || undefined,
    studyFieldName: profile.fieldName || undefined,
    studyYear: profile.studyYear ?? 0,
    cgpa: profile.cgpa ?? 0,
    hasCompletedPP: Boolean(profile.hasCompletedPp),
    accessStartDate: profile.accessStartDate || undefined,
    accessEndDate: profile.accessEndDate || undefined,
    extendedProfile: {
      description: profile.description || '',
      skills: parseList(profile.skills),
      certificates: parseList(profile.certificates),
      languages: parseList(profile.languages),
      experience: parseList(profile.experience),
      hobbies: parseList(profile.hobbies),
      cvUrl: profile.cvUrl || undefined,
      cvFilename: profile.cvFilename || undefined,
      cvFile: profile.cvFile ? mapStudentProfileFile(profile.cvFile) : undefined,
      certificationFiles: (profile.certificationFiles || []).map(mapStudentProfileFile),
    },
  };
}

export async function uploadStudentCv(
  accessToken: string,
  file: File
): Promise<{ data: StudentProfileFile | null; errorMessage: string | null }> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, errorMessage } = await sendBackendFormData<StudentProfileFileResponse>(
    '/api/student/profile/cv',
    accessToken,
    formData
  );

  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not upload CV.' };
  }

  return { data: mapStudentProfileFile(data), errorMessage: null };
}

export async function deleteStudentCv(
  accessToken: string
): Promise<{ ok: boolean; errorMessage: string | null }> {
  return sendBackendRequest('/api/student/profile/cv', accessToken, 'DELETE');
}

export async function uploadStudentCertification(
  accessToken: string,
  file: File,
  displayName?: string
): Promise<{ data: StudentProfileFile | null; errorMessage: string | null }> {
  const formData = new FormData();
  formData.append('file', file);
  if (displayName?.trim()) {
    formData.append('displayName', displayName.trim());
  }

  const { data, errorMessage } = await sendBackendFormData<StudentProfileFileResponse>(
    '/api/student/profile/certifications',
    accessToken,
    formData
  );

  if (!data || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not upload certification.' };
  }

  return { data: mapStudentProfileFile(data), errorMessage: null };
}

export async function deleteStudentCertification(
  accessToken: string,
  certificationId: number
): Promise<{ ok: boolean; errorMessage: string | null }> {
  return sendBackendRequest(`/api/student/profile/certifications/${certificationId}`, accessToken, 'DELETE');
}

export async function downloadStudentProfileFile(
  accessToken: string,
  path: string,
  fallbackFilename: string
): Promise<{ errorMessage: string | null }> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const raw = await response.text();
      const parsed = raw ? (JSON.parse(raw) as { error?: string }) : null;
      return {
        errorMessage:
          parsed && typeof parsed.error === 'string'
            ? parsed.error
            : `Request failed with status ${response.status}`,
      };
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fallbackFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    return { errorMessage: null };
  } catch (e) {
    return {
      errorMessage: e instanceof Error ? e.message : 'Could not download file.',
    };
  }
}

export async function loadCurrentAppUser(
  accessToken: string,
  fallbackEmail: string,
  metadataName?: string
): Promise<{ data: LoadedAppUser | null; errorMessage: string | null }> {
  const { data: user, errorMessage } = await fetchCurrentUser(accessToken);
  if (!user || errorMessage) {
    return { data: null, errorMessage: errorMessage || 'Could not load current user.' };
  }

  let displayName = normalizeDisplayName(metadataName, user.email || fallbackEmail);
  let studentProfile: Student | null = null;

  if (user.role === 'STUDENT') {
    const { data: profile, errorMessage: profileError } = await fetchCurrentStudentProfile(accessToken);
    if (!profile || profileError) {
      return {
        data: null,
        errorMessage: profileError || 'Could not load student profile.',
      };
    }

    studentProfile = mapStudentProfileToStudent(profile);
    displayName = studentProfile.fullName || displayName;
  }

  return {
    data: {
      user,
      displayName,
      studentProfile,
    },
    errorMessage: null,
  };
}
