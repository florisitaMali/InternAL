import type { Department, Student, StudyField } from "../types.js";

const departments: Department[] = [
  { id: "d1", name: "Computer Science", universityName: "Global Tech University" },
  { id: "d2", name: "Engineering", universityName: "Global Tech University" }
];

const studyFields: StudyField[] = [
  { id: "sf1", name: "Software Engineering", departmentId: "d1" },
  { id: "sf2", name: "Data Science", departmentId: "d1" },
  { id: "sf3", name: "Mechanical Engineering", departmentId: "d2" }
];

const students: Student[] = [
  {
    id: "s1",
    fullName: "Alice Johnson",
    email: "alice@gtu.edu",
    role: "STUDENT",
    university: "Global Tech University",
    departmentId: "d1",
    studyFieldId: "sf1",
    studyYear: 3,
    cgpa: 3.8,
    hasCompletedPP: false,
    extendedProfile: {
      description: "Passionate software developer with a focus on web technologies.",
      skills: ["React", "TypeScript", "Node.js"],
      certificates: [],
      languages: ["English"],
      experience: ["Summer internship at TechCorp"],
      hobbies: ["Coding", "Hiking"]
    }
  },
  {
    id: "s2",
    fullName: "Bob Smith",
    email: "bob@gtu.edu",
    role: "STUDENT",
    university: "Global Tech University",
    departmentId: "d1",
    studyFieldId: "sf2",
    studyYear: 2,
    cgpa: 3.5,
    hasCompletedPP: false,
    extendedProfile: {
      description: "",
      skills: [],
      certificates: [],
      languages: [],
      experience: [],
      hobbies: []
    }
  }
];

let nextStudentNumber = 3;

export const store = {
  getStudents(): Student[] {
    return students;
  },
  addStudent(student: Omit<Student, "id" | "role" | "hasCompletedPP">): Student {
    const newStudent: Student = {
      id: `s${nextStudentNumber++}`,
      role: "STUDENT",
      hasCompletedPP: false,
      extendedProfile: {
        description: "",
        skills: [],
        certificates: [],
        languages: [],
        experience: [],
        hobbies: []
      },
      ...student
    };
    students.unshift(newStudent);
    return newStudent;
  },
  getDepartments(): Department[] {
    return departments;
  },
  getStudyFields(): StudyField[] {
    return studyFields;
  },
  getStudentById(studentId: string): Student | undefined {
    return students.find((student) => student.id === studentId);
  },
  updateStudentExtendedProfile(
    studentId: string,
    updates: Pick<NonNullable<Student["extendedProfile"]>, "description" | "languages" | "experience" | "hobbies">
  ): Student | undefined {
    const student = students.find((item) => item.id === studentId);
    if (!student || !student.extendedProfile) {
      return undefined;
    }

    student.extendedProfile.description = updates.description;
    student.extendedProfile.languages = updates.languages;
    student.extendedProfile.experience = updates.experience;
    student.extendedProfile.hobbies = updates.hobbies;
    return student;
  },
  setStudentCv(studentId: string, cvUrl: string): Student | undefined {
    const student = students.find((item) => item.id === studentId);
    if (!student || !student.extendedProfile) {
      return undefined;
    }
    student.extendedProfile.cvUrl = cvUrl;
    return student;
  },
  addStudentCertificate(studentId: string, certificateUrl: string): Student | undefined {
    const student = students.find((item) => item.id === studentId);
    if (!student || !student.extendedProfile) {
      return undefined;
    }
    student.extendedProfile.certificates.push(certificateUrl);
    return student;
  }
};
