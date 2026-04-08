import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { store } from "./data/store.js";
import { getSupabase } from "./data/supabase.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:4000";
const uploadDir = path.resolve("uploads");
const maxUploadBytes = 5 * 1024 * 1024;

// ── Upload dir ────────────────────────────────────────────────────────────────

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// ── Validation schemas ─────────────────────────────────────────────────────────

const createStudentSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  university: z.string().min(1),
  departmentId: z.string().min(1),
  studyFieldId: z.string().min(1),
  studyYear: z.coerce.number().int().min(1).max(5),
  cgpa: z.coerce.number().min(0).max(4)
});

const updateStudentProfileSchema = z.object({
  description: z.string(),
  languages: z.array(z.string()),
  experience: z.array(z.string()),
  hobbies: z.array(z.string())
});

const uploadPayloadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1)
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function writeBase64File(payload: z.infer<typeof uploadPayloadSchema>): { fileUrl: string } {
  const timestamp = Date.now();
  const safeName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${timestamp}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(payload.contentBase64, "base64");

  if (buffer.byteLength > maxUploadBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  fs.writeFileSync(filePath, buffer);
  return { fileUrl: `/uploads/${fileName}` };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/test-supabase", async (_req, res) => {
  const { data, error } = await getSupabase().from("student").select("*").limit(1);
  if (error) {
    res.status(500).json({ connected: false, error: error.message });
    return;
  }
  res.json({ connected: true, data });
});

// Students
app.get("/api/students", async (_req, res, next) => {
  try {
    res.json(await store.getStudents());
  } catch (err) {
    next(err);
  }
});

app.post("/api/students", async (req, res, next) => {
  const parseResult = createStudentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid student payload", errors: parseResult.error.flatten() });
    return;
  }
  try {
    const created = await store.addStudent(parseResult.data);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Error && err.message === "University not found") {
      res.status(400).json({ message: "University not found" });
      return;
    }
    next(err);
  }
});

// Departments
app.get("/api/departments", async (_req, res, next) => {
  try {
    res.json(await store.getDepartments());
  } catch (err) {
    next(err);
  }
});

// Study fields
app.get("/api/study-fields", async (_req, res, next) => {
  try {
    res.json(await store.getStudyFields());
  } catch (err) {
    next(err);
  }
});

// Student profile
app.get("/api/students/:id/profile", async (req, res, next) => {
  try {
    const student = await store.getStudentById(req.params.id);
    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }
    res.json(student);
  } catch (err) {
    next(err);
  }
});

app.patch("/api/students/:id/profile", async (req, res, next) => {
  const parseResult = updateStudentProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid profile payload", errors: parseResult.error.flatten() });
    return;
  }
  try {
    const updated = await store.updateStudentExtendedProfile(req.params.id, parseResult.data);
    if (!updated) {
      res.status(404).json({ message: "Student not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// CV upload
app.post("/api/students/:id/profile/cv", async (req, res, next) => {
  const parseResult = uploadPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid upload payload", errors: parseResult.error.flatten() });
    return;
  }
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ];
  if (!allowedMimeTypes.includes(parseResult.data.mimeType)) {
    res.status(400).json({ message: "Invalid CV file type" });
    return;
  }
  try {
    const { fileUrl: cvUrl } = writeBase64File(parseResult.data);
    const updated = await store.setStudentCv(req.params.id, cvUrl);
    if (!updated) {
      res.status(404).json({ message: "Student not found" });
      return;
    }
    res.status(201).json({ cvUrl, student: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "FILE_TOO_LARGE") {
      res.status(400).json({ message: "File too large. Max size is 5MB." });
      return;
    }
    next(err);
  }
});

// Certificate upload
app.post("/api/students/:id/profile/certificates", async (req, res, next) => {
  const parseResult = uploadPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ message: "Invalid upload payload", errors: parseResult.error.flatten() });
    return;
  }
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png"
  ];
  if (!allowedMimeTypes.includes(parseResult.data.mimeType)) {
    res.status(400).json({ message: "Invalid certificate file type" });
    return;
  }
  try {
    const { fileUrl: certificateUrl } = writeBase64File(parseResult.data);
    const updated = await store.addStudentCertificate(req.params.id, certificateUrl);
    if (!updated) {
      res.status(404).json({ message: "Student not found" });
      return;
    }
    res.status(201).json({ certificateUrl, student: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "FILE_TOO_LARGE") {
      res.status(400).json({ message: "File too large. Max size is 5MB." });
      return;
    }
    next(err);
  }
});

// Dashboard stats
app.get("/api/dashboard/stats", async (_req, res, next) => {
  try {
    const [students, departments, studyFields] = await Promise.all([
      store.getStudents(),
      store.getDepartments(),
      store.getStudyFields()
    ]);
    res.json({
      totalStudents: students.length,
      totalDepartments: departments.length,
      totalStudyFields: studyFields.length
    });
  } catch (err) {
    next(err);
  }
});

// ── Error handler ──────────────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Internal backend running on http://localhost:${port}`);
});