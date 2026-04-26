# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InternAL is an internship management platform connecting Universities, Students, PPAs (Professional Practice Advisors), and Companies. It is a full-stack app with a Java Spring Boot backend and a Next.js frontend, both authenticated via Supabase JWTs.

## Commands

### Backend (Java/Maven — `internal-backend/`)

```bash
cd internal-backend
mvn spring-boot:run          # Run dev server (port 8080)
mvn clean package            # Build executable JAR
mvn test                     # Run tests
```

### Frontend (Next.js — `internal-frontend/`)

```bash
cd internal-frontend
npm install                  # Install dependencies
npm run dev                  # Dev server (port 3000)
npm run build                # Static export → dist/
npm run lint                 # ESLint + TypeScript check (next lint && tsc --noEmit)
```

### Full-stack local dev

Run both commands simultaneously in separate terminals: `mvn spring-boot:run` (backend) and `npm run dev` (frontend).

## Environment Variables

Defined in the root `.env` file (see `.env.example`). Key vars:

| Variable | Used By | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous key |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Backend base URL (default: `http://localhost:8080`) |
| `SUPABASE_URL` | Backend | Supabase project URL |
| `SUPABASE_JWT_SECRET` | Backend | Used to derive JWKS endpoint for JWT validation |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Service role for file storage operations |
| `APP_FILE_ENCRYPTION_KEY` | Backend | AES-256-GCM key for file encryption (base64 or plain text) |
| `SUPABASE_STORAGE_BUCKET` | Backend | Supabase Storage bucket name |
| `FRONTEND_URL` | Backend | Allowed CORS origin |

## Architecture

### Tech Stack

- **Backend**: Java 17, Spring Boot 3.2, Spring Security, Maven
- **Frontend**: Next.js 15 (App Router, static export), React 19, TypeScript 5, Tailwind CSS 4
- **Auth**: Supabase (JWT provider + JWKS validation)
- **Database**: Supabase PostgreSQL (accessed from backend)
- **File Storage**: Supabase Storage with AES-256-GCM encryption at the application layer

### Authentication Flow

1. Users log in via the Supabase JS client on the frontend (email/password)
2. Supabase returns a JWT access token
3. Frontend sends the JWT as a `Bearer` token on all backend requests
4. `JwtAuthenticationFilter.java` validates the JWT against Supabase's JWKS endpoint and injects the user into the Spring Security context
5. `SecurityConfig.java` enforces role-based access per endpoint pattern (`/api/student/**`, `/api/ppa/**`, `/api/company/**`, `/api/admin/**`)

### Roles

| Role | Dashboard | Capabilities |
|---|---|---|
| `STUDENT` | `StudentDashboard.tsx` | View/edit profile, upload CV, apply to opportunities |
| `PPA` | `PPADashboard.tsx` | Review and approve/reject student applications |
| `COMPANY` | `CompanyDashboard.tsx` | Post internship opportunities, review applications |
| `UNIVERSITY_ADMIN` | `UniversityAdminDashboard.tsx` | Manage departments, import students via CSV |

### Frontend Structure

The main entry point is `internal-frontend/src/app/page.tsx`, which checks Supabase auth status, loads the user's role from the backend, and routes to the appropriate role-specific dashboard component.

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Role-based dashboard and feature components
├── lib/
│   ├── api.ts              # HTTP helpers (sendBackendJson, sendBackendFile, etc.)
│   ├── auth/userAccount.ts # Backend API calls for user/student profile data
│   └── supabase/client.ts  # Supabase client singleton
└── types/index.ts          # Shared TypeScript interfaces
```

### Backend Structure

```
src/main/java/com/internaal/
├── config/                 # Spring configuration beans
├── controller/             # REST endpoints (Student, Application, HealthCheck, ExceptionHandler)
├── dto/                    # Request/Response data transfer objects
├── entity/                 # JPA entities (UserAccount, Role)
├── repository/             # Data access layer (Supabase/JPA)
├── security/               # JwtAuthenticationFilter, SecurityConfig
└── service/                # Business logic (ApplicationService, StudentProfileFileService)
```

### File Upload/Encryption

`StudentProfileFileService.java` handles all file operations:
- Validates file type (PDF magic bytes), extension, and size (max 5 MB)
- Encrypts file with AES-256-GCM (random IV prepended to ciphertext)
- Uploads encrypted bytes to Supabase Storage under `students/{id}/cv/{timestamp}-{uuid}-{filename}`

### Key Architectural Notes

- The `internal-backend/` directory contains leftover TypeScript/Express files (`src/index.ts`, `package.json`). These are **not used** — only the Spring Boot application is active.
- The frontend is configured as a **static export** (`output: 'export'` in `next.config.js`), so no Node.js server is needed after build. Output goes to `dist/`.
- Application status progresses: `WAITING` → `PENDING` → `APPROVED` / `REJECTED`, controlled by PPA and Company approvals tracked via `isApprovedByPPA` and `isApprovedByCompany` flags.
