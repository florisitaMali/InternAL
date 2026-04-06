export type Role = "UNIVERSITY_ADMIN" | "PPA" | "STUDENT" | "COMPANY";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  universityId?: string;
  departmentId?: string;
  studyFieldId?: string;
}

export interface Student extends User {
  university: string;
  studyYear: number;
  cgpa: number;
  hasCompletedPP: boolean;
  extendedProfile?: ExtendedProfile;
}

export interface ExtendedProfile {
  description: string;
  skills: string[];
  certificates: string[];
  languages: string[];
  experience: string[];
  hobbies: string[];
  cvUrl?: string;
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

export interface DashboardStats {
  totalStudents: number;
  totalDepartments: number;
  totalStudyFields: number;
}
