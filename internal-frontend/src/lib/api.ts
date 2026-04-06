import type { DashboardStats, Department, Student, StudyField } from "@/src/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

type CreateStudentInput = Pick<
  Student,
  "fullName" | "email" | "university" | "departmentId" | "studyFieldId" | "studyYear" | "cgpa"
>;

export const api = {
  getStudents(): Promise<Student[]> {
    return request<Student[]>("/students");
  },
  createStudent(payload: CreateStudentInput): Promise<Student> {
    return request<Student>("/students", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getDepartments(): Promise<Department[]> {
    return request<Department[]>("/departments");
  },
  getStudyFields(): Promise<StudyField[]> {
    return request<StudyField[]>("/study-fields");
  },
  getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>("/dashboard/stats");
  }
};
