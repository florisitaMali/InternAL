export type Role = 'UNIVERSITY_ADMIN' | 'PPA' | 'STUDENT' | 'COMPANY' | 'SYSTEM_ADMIN';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  universityId?: string;
  departmentId?: string;
  studyFieldId?: string;
}

export interface University {
  id: string;
  name: string;
  location: string;
  email: string;
}

export interface Department {
  id: string;
  name: string;
  universityName: string;
}

export interface StudyField {
  id: string;
  name: string;
  departmentId: string;
}

export interface StudentProfileFile {
  certificationId?: number;
  displayName: string;
  storagePath?: string;
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt?: string;
  downloadUrl?: string;
  issuer?: string | null;
  issueDate?: string | null;
}

/** Row from `studentproject` included in the student profile API. */
export interface StudentProject {
  projectId: number;
  title: string;
  githubUrl?: string | null;
  description?: string | null;
  skills?: string | null;
}

/** Row from `studentexperience`. */
export interface StudentExperience {
  experienceId: number;
  companyName: string;
  position: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export interface Student extends User {
  university: string;
  departmentName?: string;
  studyFieldName?: string;
  phone?: string;
  studyYear: number;
  cgpa: number;
  hasCompletedPP: boolean;
  /** When false, application type is fixed to individual growth (no PP choice in the form). */
  canApplyForPP?: boolean;
  accessStartDate?: string;
  accessEndDate?: string;
  /** Public or signed URL from `studentprofile.photo`. */
  profilePhotoUrl?: string;
  /** Public URL from `studentprofile.cover_url`. */
  coverPhotoUrl?: string;
  /** Custom banner heading from `studentprofile.banner_title`. */
  bannerTitle?: string;
  projects?: StudentProject[];
  experiences?: StudentExperience[];
  extendedProfile?: {
    description: string;
    skills: string[];
    certificates: string[];
    languages: string[];
    experience: string[];
    hobbies: string[];
    cvUrl?: string;
    cvFilename?: string;
    cvFile?: StudentProfileFile;
    certificationFiles?: StudentProfileFile[];
  };
}

export interface PPA extends User {
  supervisedFieldIds: string[];
}

export interface PPAApprover {
  id: string;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  assignedStudyFields: StudyField[];
}

export interface Company {
  id: string;
  name: string;
  email: string;
  industry: string;
  description: string;
}


/** Company profile returned from GET /api/company/profile */
export interface CompanyProfileFromApi {
  companyId: number;
  name: string;
  location: string | null;
  description: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  foundedYear: number | null;
  specialties: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
}

/** University profile from GET /api/admin/university/profile */
export interface UniversityProfileFromApi {
  universityId: number;
  name: string;
  location: string | null;
  description: string | null;
  website: string | null;
  email: string | null;
  employeeCount: number | null;
  foundedYear: number | null;
  specialties: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
}

/** Aggregates returned with opportunity detail (or a separate summary endpoint). */
export interface OpportunityApplicationStats {
  total: number;
  inReview: number;
  approved: number;
  rejected: number;
}

export interface Opportunity {
  id: string;
  companyId: string;
  companyName: string;
  /** When the employer company is linked to a university in the database (PostgREST embed). */
  affiliatedUniversityName?: string | null;
  title: string;
  description: string;
  requiredSkills: string[];
  requiredExperience?: string;
  deadline?: string;
  /** ISO date; expected role / internship start */
  startDate?: string;
  targetUniversityIds: string[];
  /** From API embed `university(name)`; empty list with no ids means all universities. */
  targetUniversities?: { universityId: number; name: string }[];
  type?: 'PROFESSIONAL_PRACTICE' | 'INDIVIDUAL_GROWTH' | string;
  location?: string;
  isPaid?: boolean | null;
  workMode?: string | null;
  skillMatchCount?: number;
  workType?: string | null;
  duration?: string | null;
  code?: string;
  positionCount?: number | null;
  salaryMonthly?: number | null;
  niceToHave?: string | null;
  createdAt?: string | null;
  applicantCount?: number;
  draft?: boolean;
  /** API-shaped optional fields for company detail view */
  durationLabel?: string;
  jobTypeLabel?: string;
  startDateLabel?: string;
  roleSummary?: string;
  roleAboutExtra?: string;
  responsibilities?: string[];
  requirements?: string[];
  postedAt?: string;
  postedLabel?: string;
  applicationStats?: OpportunityApplicationStats;
}

export type ApplicationType = 'PROFESSIONAL_PRACTICE' | 'INDIVIDUAL_GROWTH';
export type ApplicationStatus = 'NONE' | 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Application {
  id: string;
  studentId: string;
  studentName: string;
  companyId: string;
  companyName: string;
  opportunityId: string;
  opportunityTitle: string;
  type: ApplicationType;
  isApprovedByPPA?: boolean;
  isApprovedByCompany?: boolean;
  createdAt: string;
  status: ApplicationStatus;
  /** Enriched for company “view application” modal. */
  studentEmail?: string;
  studentPhone?: string;
  studentUniversityName?: string;
  studentFacultyName?: string;
  studentFieldName?: string;
  studentStudyYear?: number;
  studentCgpa?: number;
  /** Split from the comma-separated server value. */
  studentSkills?: string[];
  studentCvUrl?: string;
  studentCvFilename?: string;
  opportunityDescription?: string;
  opportunityDeadline?: string;
  opportunityStartDate?: string;
  opportunityLocation?: string;
  opportunityWorkMode?: string;
  opportunityJobTypeLabel?: string;
  opportunityDurationLabel?: string;
  opportunityIsPaid?: boolean;
  opportunitySalaryMonthly?: number | null;
  opportunityTypeLabel?: string;
  opportunityNiceToHave?: string;
  opportunityRequiredSkills?: string[];
}

export interface DashboardStats {
  totalStudents: number;
  totalDepartments: number;
  totalStudyFields: number;
  /** From GET `/api/admin/dashboard/stats` when available */
  ppaApprovers?: number;
}
