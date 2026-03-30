export type Role = 'UNIVERSITY_ADMIN' | 'PPA' | 'STUDENT' | 'COMPANY';

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

export interface Student extends User {
  university: string;
  studyYear: number;
  cgpa: number;
  hasCompletedPP: boolean;
  extendedProfile?: {
    description: string;
    skills: string[];
    certificates: string[];
    languages: string[];
    experience: string[];
    hobbies: string[];
    cvUrl?: string;
  };
}

export interface PPA extends User {
  supervisedFieldIds: string[];
}

export interface Company {
  id: string;
  name: string;
  email: string;
  industry: string;
  description: string;
}

export interface Opportunity {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  requiredSkills: string[];
  requiredExperience: string;
  deadline: string;
  targetUniversityIds: string[];
  type?: 'PROFESSIONAL_PRACTICE' | 'INDIVIDUAL_GROWTH';
  location?: string;
  isPaid?: boolean;
  workMode?: 'Remote' | 'On-site' | 'Hybrid';
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
}
