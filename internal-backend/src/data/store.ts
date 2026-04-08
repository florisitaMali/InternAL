import { getSupabase } from "./supabase.js";
import type { Department, Student, StudyField } from "../types.js";

// Extended profile is not yet in Supabase — stored in-memory per session.
// Replace this map with a DB table when ready.
const _extendedProfiles = new Map<string, NonNullable<Student["extendedProfile"]>>();

function getExtendedProfile(studentId: string): NonNullable<Student["extendedProfile"]> {
  return _extendedProfiles.get(studentId) ?? {
    description: "",
    skills: [],
    certificates: [],
    languages: [],
    experience: [],
    hobbies: [],
    cvUrl: undefined
  };
}

export const store = {
  // ── Students ──────────────────────────────────────────────────────────────

  async getStudents(): Promise<Student[]> {
    const { data, error } = await getSupabase()
      .from("student")
      .select(`
        student_id,
        full_name,
        email,
        study_year,
        cgpa,
        has_completed_pp,
        university:university_id ( university_id, name ),
        department:department_id ( department_id, name ),
        studyfield:field_id ( field_id, name )
      `)
      .order("student_id", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.student_id),
      fullName: row.full_name,
      email: row.email,
      role: "STUDENT" as const,
      university: row.university?.name ?? "",
      universityId: String(row.university?.university_id ?? ""),
      departmentId: String(row.department?.department_id ?? ""),
      studyFieldId: String(row.studyfield?.field_id ?? ""),
      studyYear: row.study_year,
      cgpa: Number(row.cgpa),
      hasCompletedPP: row.has_completed_pp ?? false,
      extendedProfile: getExtendedProfile(String(row.student_id))
    }));
  },

  async addStudent(
    input: Pick<Student, "fullName" | "email" | "university" | "studyYear" | "cgpa"> & {
      departmentId: string;
      studyFieldId: string;
    }
  ): Promise<Student> {
    const supabase = getSupabase();

    // Resolve university_id by name
    const { data: uniRow, error: uniError } = await supabase
      .from("university")
      .select("university_id")
      .eq("name", input.university)
      .single();

    if (uniError || !uniRow) throw new Error("University not found");

    const { data, error } = await supabase
      .from("student")
      .insert({
        full_name: input.fullName,
        email: input.email,
        university_id: uniRow.university_id,
        department_id: Number(input.departmentId),
        field_id: Number(input.studyFieldId),
        study_year: input.studyYear,
        cgpa: input.cgpa,
        has_completed_pp: false
      })
      .select(`
        student_id,
        full_name,
        email,
        study_year,
        cgpa,
        has_completed_pp,
        university:university_id ( university_id, name ),
        department:department_id ( department_id, name ),
        studyfield:field_id ( field_id, name )
      `)
      .single();

    if (error) throw error;

    return {
      id: String(data.student_id),
      fullName: data.full_name,
      email: data.email,
      role: "STUDENT",
      university: (data.university as any)?.name ?? "",
      universityId: String((data.university as any)?.university_id ?? ""),
      departmentId: String((data.department as any)?.department_id ?? ""),
      studyFieldId: String((data.studyfield as any)?.field_id ?? ""),
      studyYear: data.study_year,
      cgpa: Number(data.cgpa),
      hasCompletedPP: data.has_completed_pp ?? false,
      extendedProfile: getExtendedProfile(String(data.student_id))
    };
  },

  async getStudentById(studentId: string): Promise<Student | undefined> {
    const { data, error } = await getSupabase()
      .from("student")
      .select(`
        student_id,
        full_name,
        email,
        study_year,
        cgpa,
        has_completed_pp,
        university:university_id ( university_id, name ),
        department:department_id ( department_id, name ),
        studyfield:field_id ( field_id, name )
      `)
      .eq("student_id", Number(studentId))
      .single();

    if (error || !data) return undefined;

    return {
      id: String(data.student_id),
      fullName: data.full_name,
      email: data.email,
      role: "STUDENT",
      university: (data.university as any)?.name ?? "",
      universityId: String((data.university as any)?.university_id ?? ""),
      departmentId: String((data.department as any)?.department_id ?? ""),
      studyFieldId: String((data.studyfield as any)?.field_id ?? ""),
      studyYear: data.study_year,
      cgpa: Number(data.cgpa),
      hasCompletedPP: data.has_completed_pp ?? false,
      extendedProfile: getExtendedProfile(studentId)
    };
  },

  async updateStudentExtendedProfile(
    studentId: string,
    updates: Pick<NonNullable<Student["extendedProfile"]>, "description" | "languages" | "experience" | "hobbies">
  ): Promise<Student | undefined> {
    const student = await this.getStudentById(studentId);
    if (!student) return undefined;

    const existing = getExtendedProfile(studentId);
    const updated = { ...existing, ...updates };
    _extendedProfiles.set(studentId, updated);

    return { ...student, extendedProfile: updated };
  },

  async setStudentCv(studentId: string, cvUrl: string): Promise<Student | undefined> {
    const student = await this.getStudentById(studentId);
    if (!student) return undefined;

    const existing = getExtendedProfile(studentId);
    const updated = { ...existing, cvUrl };
    _extendedProfiles.set(studentId, updated);

    return { ...student, extendedProfile: updated };
  },

  async addStudentCertificate(studentId: string, certificateUrl: string): Promise<Student | undefined> {
    const student = await this.getStudentById(studentId);
    if (!student) return undefined;

    const existing = getExtendedProfile(studentId);
    const updated = { ...existing, certificates: [...existing.certificates, certificateUrl] };
    _extendedProfiles.set(studentId, updated);

    return { ...student, extendedProfile: updated };
  },

  // ── Departments ───────────────────────────────────────────────────────────

  async getDepartments(): Promise<Department[]> {
    const { data, error } = await getSupabase()
      .from("department")
      .select("department_id, name, code, university:university_id ( name )")
      .order("department_id");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.department_id),
      name: row.name,
      universityName: row.university?.name ?? ""
    }));
  },

  // ── Study Fields ──────────────────────────────────────────────────────────

  async getStudyFields(): Promise<StudyField[]> {
    const { data, error } = await getSupabase()
      .from("studyfield")
      .select("field_id, name, department_id")
      .order("field_id");

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.field_id),
      name: row.name,
      departmentId: String(row.department_id)
    }));
  }
};