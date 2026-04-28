# Internal Backend

Simple Express + TypeScript API for the internal frontend.

## Run locally

Backend runs on `http://localhost:4000` by default.

## Environment variables

- `PORT` (optional): API port, default `4000`
- `FRONTEND_ORIGIN` (optional): CORS origin, default `http://localhost:3000`

## Endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `GET /api/departments`
- `GET /api/study-fields`
- `GET /api/dashboard/stats`
- `GET /api/students/:id/profile`
- `PATCH /api/students/:id/profile`
- `POST /api/students/:id/profile/cv` (JSON payload with base64 file content)
- `POST /api/students/:id/profile/certificates` (JSON payload with base64 file content)

## File uploads

- Uploaded files are stored in `internal-backend/uploads/`
- Files are exposed via `/uploads/<filename>`
- Max file size: `5MB`
- Upload payload format:
  - `fileName`: original file name
  - `mimeType`: file MIME type
  - `contentBase64`: base64-encoded file content
