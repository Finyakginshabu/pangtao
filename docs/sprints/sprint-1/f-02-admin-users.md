# F-02 Admin User Management: Engineering Contract

Requirements: FR-05, FR-06; BR-03, BR-13 · Depends on: F-01 · Contract version: 1.0 · Suggested branch: `feature/F-02-admin-users`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Allow platform administrators to inspect registered user accounts (excluding private financial data) and activate or deactivate users. Deactivating a user terminates all of their active sessions immediately and prevents subsequent logins.

**Workflow**

1. The Administrator opens the Users screen (`/admin/users`).
2. The UI requests `GET /api/v1/admin/users`. Server verifies the caller has role `ADMIN`, queries all users, and returns profile metadata (excluding password hashes and financial records).
3. The Administrator clicks "Disable" on an active user and confirms the dialog.
4. The server receives `PATCH /api/v1/admin/users/:id` with `{ "isActive": false }`.
5. The server checks self-protection: if `targetUserId === session.userId`, it rejects the request with `409 CANNOT_DISABLE_SELF`.
6. Inside a single database transaction, the server sets `users.is_active = false` and deletes all session rows for `targetUserId`.
7. The disabled user can no longer log in, and any in-flight or subsequent request with an existing session cookie returns `401 UNAUTHENTICATED`.
8. The Administrator may click "Enable" on a disabled user to restore access (`isActive: true`).

**Rules and validation**

- **BR-02 (Admin Isolation)**: Admin can see user profile and account status only; never any account balances or transaction records.
- **BR-03 (No Self-Disabling)**: An administrator cannot disable their own account (`409 CANNOT_DISABLE_SELF`).
- **BR-13 (Session Revocation upon Disabling)**: When a user account is deactivated, all active sessions belonging to that user are deleted from the database in the same transaction, immediately terminating all user sessions.
- Request payload must strictly contain `{ "isActive": boolean }`. Any unexpected fields return `400 VALIDATION_ERROR`.
- Operation is idempotent: deactivating an already deactivated user succeeds without error.
- Non-admin users attempting to call admin endpoints receive `403 FORBIDDEN`.

**Permissions:** Administrator only. User receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET /api/v1/admin/users?limit&offset | none | 200 `{ items: [ { id, email, displayName, role, isActive, createdAt } ], total, limit, offset }` | 401 UNAUTHENTICATED; 403 FORBIDDEN; 400 VALIDATION_ERROR |
| PATCH /api/v1/admin/users/:id | `{ "isActive": false }` | 200 `{ user: { id, email, displayName, role, isActive, createdAt } }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 409 CANNOT_DISABLE_SELF |

- `limit` defaults to 50, maximum 100.
- Payload exposes only non-financial attributes: `id`, `email`, `displayName`, `role`, `isActive`, `createdAt`.

### 2.2 UI

- **Users Screen (`/admin/users`)**: Data table displaying Name, Email, Role, Status (rendered as descriptive text badges "Active" / "Disabled"), and Creation Date.
- **Action Buttons**: Each row contains an "Enable" or "Disable" button with a confirmation modal.
- **Self-Disabling Protection**: The Administrator's own row displays a disabled button with tooltip "You cannot disable your own account".
- **Shared States**: Skeleton table during load, empty-state placeholder, and error banner with Retry button.

### 2.3 Data

- Operates on `users` and `sessions` tables established in F-01. No new tables or migrations required.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-02.1 | The Administrator's query returns all users with non-financial metadata (`id`, `email`, `displayName`, `role`, `isActive`, `createdAt`), ordered by display name, with no password hashes or financial records. |
| AC-02.2 | A User caller receives 403 FORBIDDEN and an anonymous caller receives 401 UNAUTHENTICATED on all admin endpoints. |
| AC-02.3 | Deactivating a user updates `users.is_active` to false, returns 200 OK, and causes subsequent login attempts by that user to return 401 INVALID_CREDENTIALS. |
| AC-02.4 | Deactivating a user immediately purges all of that user's session records from the database; existing cookies for that user return 401 on next request. |
| AC-02.5 | Re-enabling a deactivated user sets `isActive` to true, enabling normal login and session establishment. |
| AC-02.6 | An Administrator attempting to deactivate their own account receives 409 CANNOT_DISABLE_SELF and remains active and authenticated. |
| AC-02.7 | Passing a non-existent UUID returns 404 NOT_FOUND; malformed UUIDs or invalid payload types return 400 VALIDATION_ERROR. |
| AC-02.8 | In the browser, the Administrator can toggle user status with modal confirmation, observe real-time row updates, and see their own action button disabled. |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-02.1** | AC-02.1 | A | Seeded database; Admin logged in | GET `/api/v1/admin/users?limit=10&offset=0` | 200 OK; array containing Admin, Alice, and Bob; fields limited strictly to `id`, `email`, `displayName`, `role`, `isActive`, `createdAt`; payload contains no financial fields (`balance`, `accounts`, `transactions`). |
| **TEST-02.2** | AC-02.2 | A | Seeded database; Alice logged in | Alice calls `GET /api/v1/admin/users` and `PATCH /api/v1/admin/users/{bobId}` | Both return 403 FORBIDDEN; zero user modifications occur. |
| **TEST-02.3** | AC-02.3 | A | Admin logged in; Alice active | Admin calls PATCH `/api/v1/admin/users/{aliceId}` with `{ isActive: false }`; Alice calls POST `/api/v1/auth/login` | PATCH returns 200 with `isActive: false`; Alice login returns 401 INVALID_CREDENTIALS. |
| **TEST-02.4** | AC-02.4 | A, E | Alice has active session cookie `sid_alice`; Admin logged in | Admin calls PATCH `/api/v1/admin/users/{aliceId}` with `{ isActive: false }`; Alice calls GET `/api/v1/auth/me` with `sid_alice` | Alice's request returns 401 UNAUTHENTICATED; database inspection confirms 0 sessions exist for `aliceId`. |
| **TEST-02.5** | AC-02.5 | A | Alice disabled (from TEST-02.3); Admin logged in | Admin calls PATCH `/api/v1/admin/users/{aliceId}` with `{ isActive: true }`; Alice logs in | PATCH returns 200 with `isActive: true`; Alice login succeeds with 200 OK and receives a valid session cookie. |
| **TEST-02.6** | AC-02.6 | A | Admin logged in (`adminId`) | Admin calls PATCH `/api/v1/admin/users/{adminId}` with `{ isActive: false }` | 409 CANNOT_DISABLE_SELF; Admin user in database remains `is_active: true`. |
| **TEST-02.7** | AC-02.7 | A | Admin logged in | Admin calls PATCH with random UUID; malformed UUID `abc-123`; payload `{ isActive: "no" }`; payload `{ isActive: false, role: "ADMIN" }` | First returns 404 NOT_FOUND; remaining three return 400 VALIDATION_ERROR. |
| **TEST-02.8** | AC-02.8 | E | Seeded database; Admin logged in | In browser: open `/admin/users`; disable Bob and confirm; verify status badge updates to Disabled; verify Admin row button is disabled; re-enable Bob | Bob's status toggles visually; Admin row cannot be deactivated; UI shows loading skeleton and handles error retry. |

---

## 5. Definition of done (F-02)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-02.4 (session revocation) and AC-02.6 (self-disabling prohibition).
- Product Definition of Done in [README.md](README.md) is met.

