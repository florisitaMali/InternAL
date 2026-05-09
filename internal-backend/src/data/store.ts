import { randomUUID } from "node:crypto";
import type { Department, ExtendedProfile, Student, StudyField } from "../types.js";

type CreateStudentInput = {
  fullName: string;
  email: string;
  university: string;
  departmentId: string;
  studyFieldId: string;
  studyYear: number;
  cgpa: number;
};

type ProfilePatch = {
  description: string;
  languages: string[];
  experience: string[];
  hobbies: string[];
};

const departments: Department[] = [
  { id: "dept-cs", name: "Computer Science", universityName: "Demo University" },
  { id: "dept-ee", name: "Electrical Engineering", universityName: "Demo University" }
];

const studyFields: StudyField[] = [
  { id: "sf-se", name: "Software Engineering", departmentId: "dept-cs" },
  { id: "sf-ds", name: "Data Science", departmentId: "dept-cs" }
];

const students: Student[] = [];

function emptyExtendedProfile(): ExtendedProfile {
  return {
    description: "",
    skills: [],
    certificates: [],
    languages: [],
    experience: [],
    hobbies: []
  };
}

export const store = {
  getStudents(): Student[] {
    return [...students];
  },

  getDepartments(): Department[] {
    return [...departments];
  },

  getStudyFields(): StudyField[] {
    return [...studyFields];
  },

  getStudentById(id: string): Student | undefined {
    return students.find((s) => s.id === id);
  },

  addStudent(input: CreateStudentInput): Student {
    const student: Student = {
      id: randomUUID(),
      fullName: input.fullName,
      email: input.email,
      role: "STUDENT",
      universityId: input.university,
      departmentId: input.departmentId,
      studyFieldId: input.studyFieldId,
      university: input.university,
      studyYear: input.studyYear,
      cgpa: input.cgpa,
      hasCompletedPP: false,
      extendedProfile: emptyExtendedProfile()
    };
    students.push(student);
    return student;
  },

  updateStudentExtendedProfile(id: string, patch: ProfilePatch): Student | undefined {
    const s = students.find((x) => x.id === id);
    if (!s) {
      return undefined;
    }
    const ep = s.extendedProfile ?? emptyExtendedProfile();
    s.extendedProfile = {
      ...ep,
      description: patch.description,
      languages: [...patch.languages],
      experience: [...patch.experience],
      hobbies: [...patch.hobbies]
    };
    return s;
  },

  setStudentCv(id: string, cvUrl: string): Student | undefined {
    const s = students.find((x) => x.id === id);
    if (!s) {
      return undefined;
    }
    const ep = s.extendedProfile ?? emptyExtendedProfile();
    s.extendedProfile = { ...ep, cvUrl };
    return s;
  },

  addStudentCertificate(id: string, certificateUrl: string): Student | undefined {
    const s = students.find((x) => x.id === id);
    if (!s) {
      return undefined;
    }
    const ep = s.extendedProfile ?? emptyExtendedProfile();
    s.extendedProfile = {
      ...ep,
      certificates: [...ep.certificates, certificateUrl]
    };
    return s;
  }
};
