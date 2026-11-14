# Pangtao: System-Level SDS

Related documents: [SRS](srs.md) · [Feature inventory](features.md) · [Requirements traceability](traceability.md) · [Three-sprint plan](sprints/plan.md)

## 1. Architecture and stack

Pangtao is a modular monolith: one backend that also serves the built frontend, with one PostgreSQL database. It has three logical layers but only one application container.

| Layer | Choice | Reason |
|---|---|---|
| UI | React 18 + TypeScript (Vite), React Router, TanStack Query | Mainstream and typed; the query cache gives loading, error and refetch states for free |
| API / application | Node.js 20 or later + Express + TypeScript, Zod validation | One language across the stack; schemas validate every request |
| Persistence | PostgreSQL 16 with Prisma (client and migrations) | ACID transactions, CHECK and foreign-key constraints, BIGINT for money |
| Authentication | bcrypt, database-backed sessions, httpOnly cookie | Logout and user disabling take effect immediately |
| Testing | Vitest + Supertest against a real Postgres; Playwright for end-to-end | Real persistence is exercised; no mock-only database tests |
| Delivery | Docker (multi-stage), GitHub Actions, Cloud Run + Cloud SQL | Cheap, managed, repeatable (set up in Lab 5) |

```
Browser (React single-page app)
   |  HTTPS, JSON under /api/v1, session cookie sid
   v
Express application (one container)
   |-- middleware: request id, logging, session lookup, origin check, role guard, Zod validation
   |-- routes (thin) -> services (business rules and Prisma queries, one DB transaction)
   |-- serves the built React files in production
   v
PostgreSQL: users, sessions, login_attempts, accounts, transactions, allocation_lines
```

**Where each rule is enforced**

| Concern | Enforced in | Notes |
|---|---|---|
| Authentication and role | Middleware: every route declares `access(...)`, built on requireAuth and requireRole | Default deny: a route without a declared role is rejected |
| Ownership | Every service query filters by the session user id; composite foreign keys in the database | Another user’s id behaves as not found |
| Request shape | Zod schemas at the route boundary | Unknown fields rejected |
| Business rules BR-04 to BR-11 | Service layer, inside one database transaction | Pure functions (allocation validator, balance calculator) are unit-tested on their own |
| Integrity | Database constraints (NOT NULL, CHECK, foreign keys, unique) | Last line of defence |
| UI | Convenience only (inline validation, hidden controls) | Never trusted for security or correctness |

Repository layout: `web/` (React), `server/` (routes, services, schemas, middleware), `prisma/` (schema, migrations, seed), `tests/` (unit, api, e2e, helpers), `docs/`. There is no separate repository layer: services call Prisma directly.

## 2. Data model

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ accounts : owns
    users ||--o{ transactions : owns
    accounts ||--o{ transactions : "is source of"
    transactions ||--o{ allocation_lines : has
    accounts ||--o{ allocation_lines : "is target of"
```

| Entity | Key fields | Constraints |
|---|---|---|
| users | id (UUID); email; display_name; password_hash; role (USER or ADMIN); is_active; created_at; updated_at | email unique and stored lower-case |
| sessions | id; token_hash (SHA-256); user_id; created_at; expires_at | Deleted with the user; indexed on user_id and expires_at |
| login_attempts | ip; email; count; reset_at | Primary key (ip, email); CHECK count > 0; indexed on reset_at; rows past reset_at are deleted. No foreign key: unknown emails are counted too |
| accounts | id; user_id; name; type (CASH, LOAN_TAKEN, LOAN_GIVEN, INCOME, EXPENSE); subtype (WALLET, BANK, CREDIT_CARD, OTHER; nullable); is_archived; created_at | UNIQUE (user_id, name); UNIQUE (user_id, id) to support composite foreign keys; CHECK subtype is valid for type |
| transactions | id; user_id; kind (PAYMENT, RECEIPT, OPENING_BALANCE); account_id (source); txn_date (DATE); total_amount (BIGINT satang); memo; is_favorite; voided_at; created_at; updated_at | Composite FK (user_id, account_id) to accounts; CHECK total_amount > 0 unless OPENING_BALANCE, and ≤ 10,000,000,000 (100,000,000.00 THB); partial unique index: one active OPENING_BALANCE per account; index (user_id, txn_date DESC, created_at DESC) |
| allocation_lines | id; transaction_id; user_id; target_account_id; amount (BIGINT); line_no; note | Composite FK (user_id, target_account_id) to accounts; CHECK amount > 0 and ≤ 10,000,000,000; cascade delete from transaction; UNIQUE (transaction_id, line_no) |

**Relationships.** A user has many sessions, accounts and transactions. An account is the source of many transactions and the target of many allocation lines. A transaction has one or more allocation lines (an OPENING_BALANCE has none). Ownership is carried by user_id on accounts, transactions and allocation_lines, and the composite foreign keys make it impossible for a row to reference another user’s account.

**Money.** Amounts are integer satang (1 THB = 100). The API exchanges integer satang and the UI converts for display, so no floating-point arithmetic touches money. The rule that lines sum to the total spans rows, so it is enforced in the service inside the same database transaction and verified by the NFR-03 invariant test.

**Balances are derived, never stored.** One balance service computes them from non-voided transactions, so there is no stored figure that can drift out of date:

| Account type | Balance = |
|---|---|
| Cash | opening + receipts as source − payments as source + payment lines targeting it (transfers in) − receipt lines targeting it (transfers out) |
| Loan Taken (debt) | opening + payments as source (card charges) + receipt lines targeting it (borrowing) − payment lines targeting it (repayments) |
| Loan Given (owed to user) | opening + payment lines targeting it (lending) − receipt lines targeting it (repayments received) |
| Income / Expense (range) | sum of receipt lines / payment lines targeting it, within the date range |

Income and expense summaries read only lines whose target account type is Income or Expense, so transfers, borrowing, lending, repayments and opening balances are excluded by construction (BR-08).

**Setup and seed.** Schema changes are Prisma migrations (`db:migrate`); `db:seed` loads deterministic synthetic data; `db:reset` rebuilds a development database. The seed creates the users admin@example.test (ADMIN), alice@example.test and bob@example.test (USER). Alice and Bob each get Wallet and Bank Account (Cash), Credit Card (Loan Taken), Salary and Interest Earned (Income), and Dining, Groceries, Electricity and Telecom (Expense), with no transactions, so tests and demos start clean. The four-transaction demonstration fixture used by the summary tests (TEST-08.1) is created by test code or documented demo steps, not by the seed. Passwords come from the SEED_DEFAULT_PASSWORD variable, never from committed files. Automated tests run against a separate test database (`<database>_test`, migrated automatically before each run) and reset and reseed it before each test, running files sequentially; the development database is never touched.

## 3. UI structure and conventions

| Screen | Route | Role | Purpose |
|---|---|---|---|
| Login | /login | Anonymous | Email and password sign-in |
| Dashboard | / | User | Balances grouped by account type; current-month income and expense; opening balance action per account |
| Transactions | /transactions | User | Paginated history (filters arrive in Sprint 3) |
| Transaction detail | /transactions/:id | User | One transaction with its allocation lines |
| New transaction | /transactions/new | User | Pay and Receive tabs with an allocation-lines editor |
| Summary | /summary | User | Income, expense and net for a date range |
| Users | /admin/users | Administrator | List users; enable or disable |

Sprint 2 and 3 add Accounts, Loans, Favorites and Reports screens in the same navigation.

**Navigation.** A top bar shows the brand, a role-based menu (User: Dashboard, Transactions, Summary; Administrator: Users), the current user’s name and Log out. A route guard sends unauthenticated visitors to /login and shows a Not permitted page for the wrong role. After login, a User lands on the Dashboard and an Administrator on Users.

**Shared behavior.**

- Validation: inline, field-level messages mirroring server rules; the server remains the authority and its error details are mapped back onto fields.
- Transaction form: shows Remaining to allocate and disables submit until the lines sum to the total.
- Loading: skeleton placeholders. Empty: a message with the next action (for example, Record your first transaction). Error: a banner with Retry.
- A 401 response redirects to login; a 403 shows Not permitted.
- Money is shown as THB with thousands separators and 2 decimals; negative balances show a minus sign and a text label, not colour alone. Dates are ISO in the API and dd MMM yyyy in the UI.
- Layout is responsive down to 360 px width.

## 4. API conventions

- Base path `/api/v1`; JSON; plural resource nouns; GET reads, POST creates, PATCH updates part of a resource.
- IDs are UUID strings, dates are `YYYY-MM-DD`, amounts are integer satang. The client never sends a user id or role; both come from the session.
- Status codes: 200, 201, 204; 400 invalid input or violated business rule (with a specific error code); 401 not logged in; 403 wrong role; 404 not found, including another user’s record; 409 state conflict (for example, a second opening balance); 429 too many login attempts; 500 generic.
- Error body: `error: { code, message, details[] }`, where details name the field and the issue. Unexpected errors return a generic message and an `X-Request-Id` header; the stack trace and SQL stay in server logs only.
- Lists use `limit` (default 50, maximum 100) and `offset`, and return `items`, `total`, `limit`, `offset`. The account list is the exception: it is bounded per user and returns `{ items }` only.

| Method and path | Role | Purpose |
|---|---|---|
| GET /health | none | Readiness check |
| POST /auth/login | none | Start session |
| POST /auth/logout | any logged-in | End session |
| GET /auth/me | any logged-in | Current user |
| GET /accounts | User | Own accounts with balances |
| POST /accounts/:id/opening-balance | User | Record opening balance |
| POST /transactions | User | Create Payment or Receipt with lines |
| GET /transactions | User | History |
| GET /transactions/:id | User | One transaction with lines |
| GET /summary/income-expense?from&to | User | Income, expense, net |
| GET /admin/users | Administrator | List users |
| PATCH /admin/users/:id | Administrator | Enable or disable (isActive) |

Feature contracts give full request, response and error shapes.

## 5. Role and permission matrix

| Operation | Anonymous | User | Administrator | Record scope |
|---|---|---|---|---|
| Log in | Allow | Allow | Allow | Own credentials |
| Log out, view current user | 401 | Allow | Allow | Own session |
| View accounts and balances | 401 | Allow | 403 | Own accounts only |
| Record opening balance | 401 | Allow | 403 | Own accounts only |
| Create or view transactions and history | 401 | Allow | 403 | Own records only; others return 404 |
| View income and expense summary | 401 | Allow | 403 | Own data only |
| List users | 401 | 403 | Allow | All users, non-financial fields only |
| Enable or disable user | 401 | 403 | Allow, but not self | Any other user |

Later features (account management, loans, transfers, edit and void, search, favorites, reports) follow the User rows; administrator user creation follows the Administrator rows. Access is default-deny, and hiding a control in the UI is never treated as authorization.

## 6. Authentication and session design

- **Credentials.** Email (stored lower-case) and password. Passwords are hashed with bcrypt, cost 12. Unknown email, wrong password and disabled account all return the same 401 message, and an unknown email still performs a dummy hash comparison so response time does not reveal which emails exist.
- **Login.** On success the server creates a session with a random 32-byte token, stores only its SHA-256 hash, and sets the `sid` cookie: httpOnly, SameSite=Lax, Secure in production, Max-Age 8 hours. The response returns the user’s identity.
- **Expiry.** Sessions expire 8 hours after login (SESSION_TTL_HOURS). Expired sessions are rejected and deleted.
- **Current user.** Middleware looks up the session by token hash, checks it is unexpired and the user is active, and attaches id and role to the request. `GET /auth/me` returns id, display name, email and role.
- **Logout.** Deletes the session row and clears the cookie (204). The old token is useless afterwards.
- **Disabling a user.** Deletes all of that user’s sessions in the same transaction; the active check on every request is a backstop.
- **Brute force.** Login is limited to 10 failed attempts per 15 minutes per IP and email (429); a successful login clears the count. The count is stored in `login_attempts`, so it survives a restart and is shared by every Cloud Run instance. Behind Cloud Run the IP is the client address from `X-Forwarded-For` (`TRUST_PROXY=1`); without it the header is ignored, so a client cannot forge its address.
- **CSRF.** SameSite=Lax cookie, state-changing requests must be application/json and pass an Origin check, and CORS is not enabled (same origin).
- Passwords and session tokens are never logged.

## 7. Configuration and secrets

| Variable | Local example | Purpose |
|---|---|---|
| NODE_ENV | development | Environment mode |
| PORT | 8080 | HTTP port |
| POSTGRES_USER | postgres | PostgreSQL user (docker-compose) |
| POSTGRES_PASSWORD | postgres | PostgreSQL password (docker-compose) |
| POSTGRES_DB | pangtao_db | PostgreSQL database name (docker-compose) |
| POSTGRES_PORT | 5432 | PostgreSQL host port (docker-compose) |
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/pangtao_db | Database connection URL |
| SESSION_TTL_HOURS | 8 | Session lifetime |
| COOKIE_SECURE | false (true in production) | Secure flag on the cookie |
| BCRYPT_COST | 12 | Password hash cost |
| APP_TIMEZONE | Asia/Bangkok | Defines today for BR-10 |
| SEED_DEFAULT_PASSWORD | set locally, not committed | Password for seeded accounts |
| LOG_LEVEL | info | Log verbosity |
| TRUST_PROXY | unset (1 on Cloud Run) | Proxy hops to trust for the client IP |
| APP_COMMIT | set by the image | Commit the image was built from (Docker build argument GIT_SHA) |

`.env` is git-ignored and `.env.example` with placeholders is committed. The server validates its environment at startup with Zod and refuses to start if a value is missing or invalid. The frontend contains no secrets and calls relative `/api` paths. In production, secrets live in GCP Secret Manager and are injected as environment variables; the image contains none.

## 8. Deployment plan (designed now, set up in Lab 5)

**Local and Docker.** A multi-stage Dockerfile builds web and server and runs as a non-root user. `docker compose up` starts the app and PostgreSQL 16 with a named volume, so data survives restarts. Migrations run with `prisma migrate deploy` as a release step before the new version receives traffic.

| GCP component | Use |
|---|---|
| Artifact Registry | Stores images tagged with the commit SHA |
| Cloud Run | Runs the single application container; readiness via /api/v1/health |
| Cloud SQL for PostgreSQL | Durable database with automated backups, attached through Cloud Run’s Cloud SQL connection |
| Secret Manager | Database password and seed password, injected as environment variables |
| GitHub Actions with Workload Identity Federation | CI on pull requests; on merge to main, build, push, migrate and deploy, with no long-lived cloud keys in GitHub |
| Cloud Logging | Application logs with request ids |

**CI quality gate.** Every pull request runs install, lint, type-check, unit and API tests against a PostgreSQL service container, and build; the Playwright end-to-end suite runs on the staging-to-main release PR. Branch protection requires these checks and one teammate approval before merge. Details will follow the Lab 5 instructions.
