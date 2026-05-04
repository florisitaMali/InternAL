# InternAL — Authentication Implementation

## Overview

Authentication in InternAL follows one rule: **Supabase proves who the user is, Spring Boot decides what they can do.**

- **Supabase Auth** handles login, session creation, and JWT issuance
- **Next.js frontend** signs the user in and sends the JWT in API requests
- **Spring Boot backend** verifies the JWT, resolves the internal account, and enforces role-based access

---

## Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Browser    │     │  Supabase    │     │  Spring Boot     │     │  Supabase    │
│  (Next.js)   │     │  Auth        │     │  Backend         │     │  Database    │
└──────┬───────┘     └──────┬───────┘     └────────┬─────────┘     └──────┬───────┘
       │                    │                      │                      │
  1.   │── Login ──────────►│                      │                      │
       │   (email+password) │                      │                      │
       │                    │                      │                      │
  2.   │◄── JWT ────────────│                      │                      │
       │   (access_token)   │                      │                      │
       │                    │                      │                      │
  3.   │── GET /api/me ────────────────────────────►                      │
       │   Authorization:   │                      │                      │
       │   Bearer <token>   │                      │                      │
       │                    │                      │                      │
       │                    │                 4.   │── Fetch JWKS ───────►│
       │                    │                      │   (on startup only)  │
       │                    │                      │◄─ Public keys ───────│
       │                    │                      │                      │
       │                    │                 5.   │ Verify JWT signature │
       │                    │                      │ (ES256 / JWKS)       │
       │                    │                      │                      │
       │                    │                 6.   │ Check expiration     │
       │                    │                      │                      │
       │                    │                 7.   │ Extract email claim  │
       │                    │                      │                      │
       │                    │                 8.   │── Query useraccount ─►
       │                    │                      │   (user's JWT for    │
       │                    │                      │    RLS compliance)   │
       │                    │                      │◄─ user_id, role, ────│
       │                    │                      │   linked_entity_id   │
       │                    │                      │                      │
       │                    │                 9.   │ Validate role +      │
       │                    │                      │ linked_entity_id     │
       │                    │                      │                      │
       │                    │                10.   │ Build Spring         │
       │                    │                      │ Security principal   │
       │                    │                      │                      │
  11.  │◄── Response ──────────────────────────────│                      │
       │   {userId, email,  │                      │                      │
       │    role, entity}   │                      │                      │
```

### Steps in detail

| Step | What happens | Where |
|------|-------------|-------|
| 1 | User enters email + password | Frontend (LoginPage.tsx) |
| 2 | Supabase validates credentials, returns JWT (access_token) | Supabase Auth |
| 3 | Frontend sends request with `Authorization: Bearer <token>` header | Frontend → Backend |
| 4 | On startup, backend fetches public keys from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` | JwtAuthenticationFilter constructor |
| 5 | JWT signature is verified using the ES256 public key | JwtAuthenticationFilter |
| 6 | Token expiration is checked | JwtAuthenticationFilter |
| 7 | Email is extracted from the JWT `email` claim | JwtAuthenticationFilter.resolveUserIdentifier() |
| 8 | Backend queries Supabase REST API for the useraccount row matching that email. The user's own JWT is passed as the Authorization header to comply with RLS. | UserAccountRepository.findByEmail() |
| 9 | Role and linked_entity_id are validated (must not be null) | JwtAuthenticationFilter |
| 10 | A Spring Security principal is created with ROLE_{role} authority | JwtAuthenticationFilter |
| 11 | The request proceeds to the controller, which can access the authenticated user | SecurityConfig + Controllers |

---

## Key Design Decisions

### Identity resolution: email (MVP)

Currently, the backend resolves users by the `email` claim in the JWT. This matches how the frontend already works.

**To migrate to Supabase user ID (`sub`) later:**
1. Add a `supabase_user_id` column to the `useraccount` table
2. Change `resolveUserIdentifier()` to return `claims.getSubject()`
3. Add `findBySupabaseUserId()` to `UserAccountRepository`

The migration points are documented in the code with `NOTE` comments.

### RLS compliance

The `useraccount` table has an RLS policy that only allows authenticated users to read their own row (matched by email). The backend passes the user's JWT (not the anon key) as the `Authorization` header when querying Supabase, so RLS is satisfied.

The `apikey` header always uses the anon key — it identifies the project. The `Authorization` header carries the user's identity for RLS.

### Role source of truth

Role always comes from `useraccount.role` in the database. It is never trusted from the frontend or directly from JWT claims.

### Supabase REST API (no JDBC)

The backend connects to Supabase via its REST API, not a direct PostgreSQL connection. This keeps the architecture simple and avoids managing database connection pools.

---

## File Structure

```
internal-backend/src/main/java/com/internaal/
├── security/
│   ├── JwtAuthenticationFilter.java   ← Token verification + user resolution
│   └── SecurityConfig.java           ← Route protection rules
├── entity/
│   ├── Role.java                     ← UNIVERSITY_ADMIN, PPA, STUDENT, COMPANY
│   └── UserAccount.java              ← POJO (not JPA — no direct DB connection)
├── repository/
│   └── UserAccountRepository.java    ← Queries Supabase REST API
├── controller/
│   └── HealthCheckController.java    ← /api/health (public) + /api/me (auth'd)
└── config/
    └── DatabaseConfig.java           ← RestTemplate + Supabase config beans
```




## Error Responses

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| No token provided | 403 | Forbidden (Spring Security default) |
| Invalid/malformed token | 401 | `{"error": "Token validation failed"}` |
| Bad signature | 401 | `{"error": "Invalid token signature"}` |
| Expired token | 401 | `{"error": "Token expired"}` |
| No email in token | 401 | `{"error": "No user identifier in token"}` |
| No matching useraccount | 403 | `{"error": "No matching account found"}` |
| Account has no role | 403 | `{"error": "Account has no role assigned"}` |
| Account has no linked entity | 403 | `{"error": "Account has no linked entity"}` |
| Valid but wrong role for endpoint | 403 | Forbidden (Spring Security default) |

---

## Environment Variables

Both frontend and backend read from a shared `.env` file at the project root. See `.env.example` for the full template:

```env
# Frontend Environment Variables (Next.js)
NEXT_PUBLIC_SUPABASE_URL=                          # Supabase project URL (e.g. https://<ref>.supabase.co)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=      # Supabase anon/public key
NEXT_PUBLIC_API_BASE_URL=                          # Backend URL (e.g. http://localhost:8080)

# Backend Environment Variables (Spring Boot)
SERVER_PORT=8080                                   # Backend server port
SUPABASE_URL=                                      # Same as NEXT_PUBLIC_SUPABASE_URL
SUPABASE_JWT_SECRET=                               # Not used in MVP (using JWKS instead)
SUPABASE_DB_USER=postgres                          # Not used in MVP (using REST API)
SUPABASE_DB_PASSWORD=                              # Not used in MVP (using REST API)
FRONTEND_URL=                                      # Frontend URL for CORS (e.g. http://localhost:3000)
```

**Note:** The backend currently reads `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from this file. The DB credentials (`SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`) and `SUPABASE_JWT_SECRET` are not used in the MVP since we connect via Supabase REST API and verify tokens via JWKS.

### How each app loads the `.env`

- **Backend** loads via `spring.config.import=optional:file:../.env[.properties]` in `application.properties`
- **Frontend** loads via `dotenv` in `next.config.js`, which reads `../.env` relative to the frontend directory

---

## Testing

### With Postman

1. Log in on the frontend
2. DevTools → Application → Local Storage → `sb-<ref>-auth-token` → copy `access_token`
3. In Postman: `GET http://localhost:8080/api/me` with header `Authorization: Bearer <token>`

### Expected test results

| Test | Expected |
|------|----------|
| `/api/health` without token | 200 — `{"status": "connected"}` |
| `/api/me` without token | 403 |
| `/api/me` with garbage token | 401 — `{"error": "Token validation failed"}` |
| `/api/me` with expired token | 401 — `{"error": "Token expired"}` |
| `/api/me` with valid token + valid account | 200 — `{userId, email, role, linkedEntityId}` |
