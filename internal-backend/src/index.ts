import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { store } from "./data/store.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const uploadDir = path.resolve("uploads");
const maxUploadBytes = 5 * 1024 * 1024;

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(
  cors({
    origin: allowedOrigin
  })
);
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

const createStudentSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  university: z.string().min(1),
  departmentId: z.string().min(1),
  studyFieldId: z.string().min(1),
  studyYear: z.coerce.number().int().min(1).max(6),
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/students", (_req, res) => {
  res.json(store.getStudents());
});

app.post("/api/students", (req, res) => {
  const parseResult = createStudentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Invalid student payload",
      errors: parseResult.error.flatten()
    });
    return;
  }

  const created = store.addStudent(parseResult.data);
  res.status(201).json(created);
});

app.get("/api/departments", (_req, res) => {
  res.json(store.getDepartments());
});

app.get("/api/study-fields", (_req, res) => {
  res.json(store.getStudyFields());
});

app.get("/api/students/:id/profile", (req, res) => {
  const student = store.getStudentById(req.params.id);
  if (!student) {
    res.status(404).json({ message: "Student not found" });
    return;
  }
  res.json(student);
});

app.patch("/api/students/:id/profile", (req, res) => {
  const parseResult = updateStudentProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Invalid profile payload",
      errors: parseResult.error.flatten()
    });
    return;
  }

  const updated = store.updateStudentExtendedProfile(req.params.id, parseResult.data);
  if (!updated) {
    res.status(404).json({ message: "Student not found" });
    return;
  }
  res.json(updated);
});

app.post("/api/students/:id/profile/cv", (req, res) => {
  const parseResult = uploadPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Invalid upload payload",
      errors: parseResult.error.flatten()
    });
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

  let cvUrl = "";
  try {
    cvUrl = writeBase64File(parseResult.data).fileUrl;
  } catch (error) {
    if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
      res.status(400).json({ message: "File too large. Max size is 5MB." });
      return;
    }
    res.status(500).json({ message: "Failed to save CV file" });
    return;
  }

  const updated = store.setStudentCv(req.params.id, cvUrl);
  if (!updated) {
    res.status(404).json({ message: "Student not found" });
    return;
  }

  res.status(201).json({ cvUrl, student: updated });
});

app.post("/api/students/:id/profile/certificates", (req, res) => {
  const parseResult = uploadPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      message: "Invalid upload payload",
      errors: parseResult.error.flatten()
    });
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

  let certificateUrl = "";
  try {
    certificateUrl = writeBase64File(parseResult.data).fileUrl;
  } catch (error) {
    if (error instanceof Error && error.message === "FILE_TOO_LARGE") {
      res.status(400).json({ message: "File too large. Max size is 5MB." });
      return;
    }
    res.status(500).json({ message: "Failed to save certificate file" });
    return;
  }

  const updated = store.addStudentCertificate(req.params.id, certificateUrl);
  if (!updated) {
    res.status(404).json({ message: "Student not found" });
    return;
  }

  res.status(201).json({ certificateUrl, student: updated });
});

app.get("/api/dashboard/stats", (_req, res) => {
  res.json({
    totalStudents: store.getStudents().length,
    totalDepartments: store.getDepartments().length,
    totalStudyFields: store.getStudyFields().length
  });
});

app.listen(port, () => {
  console.log(`Internal backend running on http://localhost:${port}`);
});
