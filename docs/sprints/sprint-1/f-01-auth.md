# F-01 Authentication and Authorization Foundation: Engineering Contract

Requirements: FR-01, FR-02, FR-03, FR-04; BR-01, BR-02; NFR-01, NFR-02, NFR-04, NFR-10 · Depends on: none · Contract version: 1.0 · Suggested branch: `feature/F-01-auth-foundation`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Establish secure user identity, session lifecycle management, current-user context propagation, default-deny backend authorization with role guards (`USER`, `ADMIN`), and tenant data isolation filtering by session `user_id`. Also establish a uniform, leak-proof error response shape across the entire API.

**Workflow**

1. The user navigates to `/login` and submits email and password.
2. The server validates input shape via Zod, looks up the user by lowercase email, and verifies status:
   - If user does not exist: executes a dummy bcrypt comparison against a placeholder hash to prevent response-timing user enumeration, then returns generic `401 INVALID_CREDENTIALS`.
   - If user exists but `is_active` is false: returns generic `401 INVALID_CREDENTIALS`.
   - If user exists and is active: compares password hash using `bcrypt.compare`. On mismatch, returns generic `401 INVALID_CREDENTIALS`.
3. On successful authentication:
   - Generate a 32-byte cryptographically secure random session token.
   - Compute SHA-256 hash of the token and store in `sessions` table with `expires_at = NOW() + 8 hours`.
   - Set HTTP cookie `sid`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=28800` (8 hours), and `Secure` when `COOKIE_SECURE=true`.
   - Return 200 OK with the authenticated user profile (`id`, `displayName`, `email`, `role`).
4. On application load, client requests `GET /api/v1/auth/me`. Session middleware verifies token hash, expiry, and active status:
   - If valid: returns current user identity; UI redirects by role (`USER` to `/`, `ADMIN` to `/admin/users`).
   - If invalid or absent: returns `401 UNAUTHENTICATED`; client redirects to `/login`.
5. Every incoming API request passes the middleware pipeline: request ID assignment $\rightarrow$ origin/content-type check $\rightarrow$ session verification $\rightarrow$ declared route role guard $\rightarrow$ Zod schema validation $\rightarrow$ service controller.
6. On logout, client calls `POST /api/v1/auth/logout`. Server deletes session row from database, clears cookie, and returns `204 No Content`. The session token cannot be reused.

**Rules and validation**

- `email`: string, trimmed, lowercase, valid RFC 5322 format, $\le 254$ characters. `password`: non-empty string, $\le 128$ characters.
- Unknown email, incorrect password, and disabled user return the exact same 401 response body and timing profile.
- Rate limiting: maximum 10 failed login attempts per 15 minutes per IP + email tuple; excess attempts return `429 RATE_LIMITED`.
- Passwords stored exclusively as bcrypt hashes with salt rounds $\ge 12$ (NFR-01). Plaintext passwords never stored or logged.
- Default deny: every route is registered with an explicit access level (`public`, `authenticated`, `USER`, `ADMIN`); server refuses to start if any route lacks a declared guard (NFR-02).
- Ownership: all financial queries filter by `session.userId`. Requesting another user's record returns `404 NOT_FOUND` (BR-01, D-03).
- Admin isolation: administrators receive `403 FORBIDDEN` when accessing financial endpoints (BR-02).
- CSRF protection: mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) require `Content-Type: application/json` and verify `Origin` matches the host.

**Permissions**

| Operation | Anonymous | User | Administrator |
|---|---|---|---|
| POST /auth/login, GET /health | Allow | Allow | Allow |
| POST /auth/logout, GET /auth/me | 401 | Allow | Allow |

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| POST /api/v1/auth/login | `{ "email": "alice@example.test", "password": "…" }` | 200 `{ "user": { "id", "displayName", "email", "role" } }` and `Set-Cookie: sid` | 400 VALIDATION_ERROR; 401 INVALID_CREDENTIALS; 403 FORBIDDEN; 415 UNSUPPORTED_MEDIA_TYPE; 429 RATE_LIMITED |
| POST /api/v1/auth/logout | none | 204, cookie cleared | 401 UNAUTHENTICATED; 403 FORBIDDEN; 415 UNSUPPORTED_MEDIA_TYPE |
| GET /api/v1/auth/me | none | 200 `{ "user": { "id", "displayName", "email", "role" } }` | 401 UNAUTHENTICATED |
| GET /api/v1/health | none | 200 `{ "status": "ok" }` after DB ping | 503 `{ "status": "degraded" }` |

- Unknown paths return 404 NOT_FOUND in standard error shape.
- Malformed JSON returns 400 VALIDATION_ERROR.

### 2.2 UI

- **Login Screen (`/login`)**: Email and password inputs; "Log in" button disabled while request is pending. Failure shows generic banner: "Invalid email or password".
- **App Shell**: Top bar with brand logo, role-based navigation links, authenticated user's name, and "Log out" button.
- **Route Guard**: Unauthenticated visitor redirected to `/login`; unauthorized role shows "Not permitted" page; API 401 triggers redirection to `/login` with notification "Your session has expired".

### 2.3 Data

- Tables `users` and `sessions` as defined in System-Level SDS. Migration `0001_users_sessions`.
- Seed data: `admin@example.test` (`ADMIN`), `alice@example.test` (`USER`), `bob@example.test` (`USER`). Passwords hashed with bcrypt cost 12 from `SEED_DEFAULT_PASSWORD`. No plaintext passwords in repository.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-01.1 | Submitting valid active user credentials returns 200 with user profile (`id`, `displayName`, `email`, `role`), excludes password hash, and issues an `HttpOnly`, `SameSite=Lax` `sid` cookie. |
| AC-01.2 | Unknown email, incorrect password, and disabled account each return 401 INVALID_CREDENTIALS with identical bodies and no session cookie. |
| AC-01.3 | Missing, non-string, or malformed email/password returns 400 VALIDATION_ERROR identifying the invalid field. |
| AC-01.4 | `GET /auth/me` with a valid session cookie returns the authenticated identity; without cookie or with an invalid token returns 401 UNAUTHENTICATED. |
| AC-01.5 | `POST /auth/logout` returns 204, clears the session cookie (`Max-Age=0`), and deletes the database session record. Reusing the old cookie returns 401. |
| AC-01.6 | A session token older than 8 hours is rejected with 401 UNAUTHENTICATED and its database record is removed. |
| AC-01.7 | Every protected route returns 401 to anonymous requests. Any route registered without a declared access guard causes the server to halt on startup. |
| AC-01.8 | An Administrator calling User-only financial endpoints and a User calling Administrator-only endpoints receive 403 FORBIDDEN with no sensitive payload. |
| AC-01.9 | A User querying another user's financial record by ID receives 404 NOT_FOUND and zero private data (BR-01, D-03). |
| AC-01.10 | Passwords in the database are valid bcrypt hashes with cost $\ge 12$; no plaintext password exists in seed, source, or test fixtures (NFR-01). |
| AC-01.11 | Forced internal exceptions return 500 INTERNAL_ERROR with a sanitized generic message, `X-Request-Id` header, and zero stack trace, SQL, or file paths (NFR-04). |
| AC-01.12 | The 11th failed login attempt within 15 minutes from the same IP and email returns 429 RATE_LIMITED, even if the correct password is submitted. |
| AC-01.13 | Mutating requests with a mismatched `Origin` return 403 FORBIDDEN; requests with non-JSON content type return 415 UNSUPPORTED_MEDIA_TYPE. |
| AC-01.14 | In the browser: invalid login displays error banner; valid User login lands on Dashboard; valid Admin login lands on Users; logout clears state; back button shows no private data. |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-01.1** | AC-01.1 | A | Seeded database; Alice active | POST `/api/v1/auth/login` with `ALICE@Example.test` and valid password | 200 OK; response contains lowercase email, role `USER`, no `password_hash`; `Set-Cookie` contains `sid` (`HttpOnly`, `SameSite=Lax`); single session row created with hashed token. |
| **TEST-01.2** | AC-01.2 | A | Seeded database; Bob marked `is_active: false` | POST login for `ghost@example.test`, for Alice with wrong password, and for disabled Bob with valid password | Three 401 INVALID_CREDENTIALS responses with identical payloads; no `Set-Cookie` header present. |
| **TEST-01.3** | AC-01.3 | A | Seeded database | POST login with `{}`, `{ email: "bad-mail" }`, `{ email: "a@b.com", password: "" }` | 400 VALIDATION_ERROR naming the failed field. |
| **TEST-01.4** | AC-01.4 | A | Alice logged in | GET `/api/v1/auth/me` with cookie, without cookie, and with forged cookie | First returns 200 with Alice identity; latter two return 401 UNAUTHENTICATED. |
| **TEST-01.5** | AC-01.5 | A | Alice logged in with active cookie | POST `/api/v1/auth/logout`; then GET `/api/v1/auth/me` with old cookie | Logout returns 204, clears cookie; session row deleted; subsequent GET `/auth/me` returns 401. |
| **TEST-01.6** | AC-01.6 | A | Active session with `expires_at` shifted to 1 second in the past | GET `/api/v1/auth/me` | 401 UNAUTHENTICATED; expired session deleted from database. |
| **TEST-01.7** | AC-01.7 | A | Server route registry | Send anonymous request to all registered API endpoints; register test route lacking access declaration | All endpoints return 401 UNAUTHENTICATED; registering route without access declaration throws during server boot. |
| **TEST-01.8** | AC-01.8 | A | Admin and Alice logged in | Admin calls `GET /api/v1/accounts`; Alice calls `GET /api/v1/admin/users` | Both return 403 FORBIDDEN with no domain data. |
| **TEST-01.9** | AC-01.9 | A | Alice owns transaction `txn-alice-salary`; Bob logged in | Bob calls `GET /api/v1/transactions/txn-alice-salary` | 404 NOT_FOUND; zero record data returned. |
| **TEST-01.10** | AC-01.10 | A | Seeded database | Inspect `users.password_hash` in DB; static code search for seed password in codebase | All hashes match `$2b$12$` format; static search finds no plaintext passwords in source or test files. |
| **TEST-01.11** | AC-01.11 | A | Route throwing simulated database crash error with raw SQL | Request crashing route | 500 INTERNAL_ERROR with generic message and `X-Request-Id`; response body contains no SQL, table names, or stack traces. |
| **TEST-01.12** | AC-01.12 | A | Rate limiter configured (10 attempts / 15 min) | Submit 10 wrong-password logins for Alice, then 11th attempt with correct password; submit 1 attempt for Bob | 11th attempt for Alice returns 429 RATE_LIMITED; attempt for Bob returns 401 (independent quota). |
| **TEST-01.13** | AC-01.13 | A | Alice logged in | POST `/api/v1/transactions` with `Origin: https://attacker.example`; POST with `Content-Type: text/plain` | 403 FORBIDDEN; 415 UNSUPPORTED_MEDIA_TYPE; zero database rows created. |
| **TEST-01.14** | AC-01.14 | E | Seeded users Alice and Admin | In browser: submit invalid password; log in as Alice; log out and click browser Back; log in as Admin; open `/admin/users` as Alice | Invalid login shows error alert; Alice lands on `/`; after logout `/login` renders and Back shows no data; Admin lands on `/admin/users`; Alice visiting `/admin/users` sees Not permitted. |

---

## 5. Definition of done (F-01)

- Every AC above has at least one automated test executed on the release commit with results documented.
- Failing-first evidence is retained for AC-01.2, AC-01.7, and AC-01.12.
- Product Definition of Done in [README.md](README.md) is met.

