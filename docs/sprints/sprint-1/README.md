# Sprint 1 Engineering Contracts and Definition of Done

CPE 334 Project Deliverable 1 · Sprint 1 · Baseline v1.0 · 7 November 2026

Related documents: [SRS](../../srs.md) · [Feature inventory](../../features.md) · [Requirements traceability](../../traceability.md) · [System-Level SDS](../../system-sds.md) · [Three-sprint plan](../plan.md)

---

## 1. Sprint 1 Overview and Scope

Sprint 1 delivers a secure, tested, and verifiable vertical slice of Pangtao (Theme 7: Personal Money and Expense Logging System). It establishes the engineering foundation (system architecture, authentication/authorization, PostgreSQL database schema with migrations, and seeding) along with core double-entry accounting mechanics: opening balances, split transactions (payments/charges and receipts), derived balance calculations, transaction history, and date-ranged income/expense summaries.

### Sprint 1 Feature Inventory

| ID | Feature Name | Contract Document | Linked Requirements | Primary Role |
|---|---|---|---|---|
| **F-01** | Authentication & Authorization Foundation | [f-01-auth.md](f-01-auth.md) | FR-01–04; BR-01, 02; NFR-01, 02, 04, 10 | Public / All |
| **F-02** | Admin User Management | [f-02-admin-users.md](f-02-admin-users.md) | FR-05, 06; BR-02, 03, 13 | Administrator |
| **F-03** | Accounts and Balances | [f-03-accounts-balances.md](f-03-accounts-balances.md) | FR-08; BR-01, 07; NFR-03 | User |
| **F-04** | Opening Balance | [f-04-opening-balance.md](f-04-opening-balance.md) | FR-10; BR-04, 10, 11, 14 | User |
| **F-05** | Payment and Charge | [f-05-payment-charge.md](f-05-payment-charge.md) | FR-12; BR-04–07, 09, 10, 14, 16 | User |
| **F-06** | Received Money | [f-06-received-money.md](f-06-received-money.md) | FR-13; BR-04–07, 10, 14, 16 | User |
| **F-07** | Transaction History | [f-07-transaction-history.md](f-07-transaction-history.md) | FR-17, 25; BR-01 | User |
| **F-08** | Income and Expense Summary | [f-08-income-expense-summary.md](f-08-income-expense-summary.md) | FR-22; BR-01, 08, 09 | User |

---

## 2. Engineering Conventions and Standards

### 2.1 Money & Exact Satang Representation (NFR-03)
- All monetary amounts in the API boundary and PostgreSQL database are stored and exchanged as **integer satang** ($1\text{ THB} = 100\text{ satang}$).
- No floating-point data types (`FLOAT`, `DOUBLE`, `REAL`) or arithmetic are used for money in any layer.
- Amounts are strictly positive integers $\le 10,000,000,000$ ($100,000,000.00\text{ THB}$), except opening balance amounts which may be $0$.
- UI formatting renders amounts in THB with commas and 2 decimals (e.g. `1,250.50 ฿`). Negative balances show an explicit minus sign and a descriptive label ("Negative balance"), never relying on color alone.

### 2.2 Security, Identity, and Access Conventions
- **Sessions & Storage**: 32-byte cryptographically random tokens; only SHA-256 token hashes are stored in the database. Tokens expire after 8 hours (`SESSION_TTL_HOURS = 8`).
- **Cookie Security**: Cookie `sid` is issued with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` (when `COOKIE_SECURE=true`).
- **Password Hashing (NFR-01)**: Passwords are hashed using bcrypt with salt rounds $\ge 12$. Plaintext passwords never touch database rows, application logs, or source/test fixtures.
- **Default Deny (NFR-02)**: Every API route requires explicit authentication and role declarations. Unauthenticated requests receive HTTP 401.
- **Multi-Tenant Ownership Isolation (BR-01, D-03)**: Every database query for financial records filters by `WHERE user_id = session.userId`. Querying a resource ID owned by another user returns HTTP 404 (`NOT_FOUND`) to prevent IDOR enumeration.
- **Administrator Segregation (BR-02)**: Administrators can view and manage user accounts (`is_active`), but are rejected with HTTP 403 (`FORBIDDEN`) on all financial endpoints.
- **CSRF & Body Verification**: State-mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`) must declare `Content-Type: application/json` for any body (415 otherwise, including a body with no Content-Type) and must carry an `Origin` header matching the host (403 when missing or mismatched).

### 2.3 Uniform Safe Error Structure (NFR-04)
All error responses across all endpoints adhere strictly to the uniform JSON envelope:
```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human readable summary of the rejection",
    "details": [
      {
        "field": "fieldName",
        "issue": "Specific failure rationale"
      }
    ]
  }
}
```
Internal server errors (HTTP 500) return a generic message and attach an `X-Request-Id` response header. Database queries, stack traces, and filesystem paths are never leaked to clients.

### 2.4 Error Code Catalog
| HTTP Code | Error Code | Description / Trigger |
|---|---|---|
| **400** | `VALIDATION_ERROR` | Schema validation failure (malformed payload, invalid types, out-of-range values), or the transaction's own account (opening-balance account or payment/receipt source) is archived (BR-14). |
| **400** | `INVALID_ALLOCATION_SUM` | Sum of allocation line amounts does not equal transaction total (BR-05). |
| **400** | `FUTURE_DATE_NOT_ALLOWED` | Date is in the future relative to server `Asia/Bangkok` timezone (BR-10). |
| **400** | `INVALID_TARGET_ACCOUNT` | Line target account is archived, of incompatible type, or matches source (BR-06). |
| **400** | `INVALID_SOURCE_ACCOUNT` | Source account type is not allowed for the transaction form: Payment requires Cash or Loan Taken; Receipt requires Cash (BR-16). |
| **401** | `INVALID_CREDENTIALS` | Unknown email, wrong password, or inactive user on login (FR-01). |
| **401** | `UNAUTHENTICATED` | Missing, expired, or invalid session cookie on protected route (NFR-02). |
| **403** | `FORBIDDEN` | Caller lacks the declared role or cross-origin check failed (FR-04, BR-02). |
| **404** | `NOT_FOUND` | Record does not exist or belongs to another user (BR-01, D-03). |
| **409** | `CANNOT_DISABLE_SELF` | Administrator attempting to deactivate their own user account (BR-03). |
| **409** | `OPENING_BALANCE_EXISTS` | Account already possesses an active opening balance (BR-11). |
| **415** | `UNSUPPORTED_MEDIA_TYPE` | Mutating request with non-JSON Content-Type. |
| **429** | `RATE_LIMITED` | Exceeded 10 failed login attempts within a 15-minute window. |
| **500** | `INTERNAL_ERROR` | Uncaught server exception; sanitized generic response with request ID. |

---

## 3. Software Test Specification (STS) Standards

Tests are categorized into three distinct execution tiers:
1. **Unit Tests (`U`)**: Test pure business logic in complete isolation (zero network, zero database). Examples: pure satang allocation validator, balance calculation engine with mock ledger rows.
2. **API / Database Integration Tests (`A`)**: Test Express routes, middleware, Prisma repositories, and PostgreSQL constraints. Exercised against a live, dedicated test database reset and seeded before test files. Verifies persistence, foreign-key cascades, transaction atomicity, and authorization boundaries.
3. **End-to-End Tests (`E`)**: Automated browser journeys using Playwright. Exercises the complete client-server flow (UI form validation, state transitions, authentication cookies, redirection, error banners).

---

## 4. Product Definition of Done (DoD)

A Sprint 1 feature is defined as **Done** and acceptable for integration into `main` only when all of the following requirements are met:

1. **Contract Baseline**: Feature engineering contract (Feature SDS, UI/API/Data specifications, Acceptance Criteria, and STS) is committed before implementation.
2. **Functional Implementation**: The feature is fully implemented without stubs, temporary mocks, or bypasses.
3. **Automated Verification**:
   - All mapped Acceptance Criteria have corresponding automated tests passing in the CI/local test suite.
   - Core domain business rules retain Test-Driven Development (TDD) evidence: a recorded commit of a failing test followed by implementation and a passing test.
   - Database persistence, transaction rollback on failure, and role/ownership security are verified against PostgreSQL.
   - Zero tests failing or skipped.
   - **Verification record (DoD 1.1):** `npm run verify` (lint, type-check, tests with coverage, build, end-to-end) passes on the tested commit. The PR description records that commit, the pass/fail/skip counts, the AC-to-test table, and for each AC that needs failing-first evidence the failing-test commit and the implementation commit. [traceability.md](../../traceability.md) §3 is updated in the same PR. The release PR into `main` records the same for the release commit. Once CI runs (F-19, Lab 5), the CI run on the PR is the record. Test output is not committed to the repository.
4. **Code Quality & Coverage**:
   - Clean compilation: TypeScript (`tsc --noEmit`) passes with zero errors.
   - Clean linting: ESLint passes with zero warnings.
   - Line coverage across the domain/service layer meets or exceeds **80%** (NFR-09).
5. **Peer Review & Git Discipline**:
   - Developed on a dedicated branch (`feature/F-NN-short-name`) branched from `sprint-1-staging`.
   - Reviewed and approved by the teammate via Pull Request with documented review comments and verification checks (authors do not approve their own PRs).
   - Merged into `sprint-1-staging`, validated via integration tests, and released to `main` via a reviewed release PR tagged `v0.1.0`.
6. **Documentation & Traceability**:
   - Reproduction instructions verified on a fresh environment in $\le 6$ steps (NFR-05).
   - Any incomplete work, edge cases, or deferred items explicitly disclosed.

---

## 5. Contract version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 7 Nov 2026 | Initial Sprint 1 contracts (F-01–F-08) |
| 1.1 | 10 Nov 2026 | F-01 (PR #10 review): AC-01.9/TEST-01.9 verification moved to F-07 (TEST-07.4), since no financial record exists before F-05; TEST-01.8, TEST-01.11 and TEST-01.13 documented as running on test-only fixture routes (`NODE_ENV=test`) until F-02/F-03/F-05 deliver the real endpoints; AC-01.13 and §2.2 tightened so a missing `Origin` is 403 and a body without a JSON Content-Type is 415; AC-01.7 boot check defined as a walk of the mounted route table. F-07: DoD notes that TEST-07.4 also discharges AC-01.9. |
| 1.2 | 10 Nov 2026 | F-01 (PR #10 second review): §5 DoD no longer claims every AC is tested in F-01 (AC-01.9 excluded, F-01 Done once TEST-07.4 passes) and links the recorded results in `evidence/f-01/`; failing-first evidence disclosed as retroactive mutation checks because the original F-01 commit was not test-first; §2.3 migration name corrected to the real `20261107163413_init_users_sessions`. |
| F-03 1.1 | 11 Nov 2026 | F-03 (before implementation): §2.3 now has F-03 create `accounts`, `transactions` and `allocation_lines` in one migration, because the balance engine (TEST-03.3, TEST-03.5) and `openingBalance.transactionId` need all three and F-04 to F-08 each state they add no migrations; the placeholder name `0002_accounts` is replaced by the real `20261111213027_accounts_ledger`, and its hand-written CHECK constraints, partial unique index and composite foreign keys are listed. AC-03.4 states that Loan Taken openings count negatively in the invariant (TEST-03.4 figures unchanged). No AC or TEST added or removed. |
| DoD 1.1 and F-01 1.3 | 12 Nov 2026 | Product DoD §4 item 3: verification record defined as the PR description plus traceability §3, then CI from Lab 5 (the handouts ask for results tied to the tested commit, not for committed log files). The per-feature `evidence/` folder and its generator scripts are removed; their content stays in git history at `90a00dd` (F-01), `7dc745f` (F-02) and `de97e76` (F-03). Failing-first evidence is a failing-test commit followed by the implementation commit; a mutation check is used only where no such commit exists, and is disclosed. `npm run verify` and an 80% service-layer coverage threshold in Vitest enforce §4 items 3 and 4 locally until CI. F-01 §5 points to that history instead of the removed folder. F-02: TEST-02.4 gains its end-to-end test (level E was specified but missing). No AC or TEST removed. Pending teammate review. |
| F-01 1.4 | 12 Nov 2026 | F-01 §2.2 aligned with web app route guarding: an Administrator accessing a User page (such as `/`) is redirected to `/admin/users`, and API 401 triggers redirection to `/login` without requiring an expired-session notification banner. No AC or TEST added or removed. |
| F-04 1.1 | 13 Nov 2026 | F-04 (PR review): BR-14 added to the contract — an archived account is rejected with 400 VALIDATION_ERROR, the Dashboard withholds the action on archived rows, and AC-04.10/TEST-04.10 (A, E) cover it. §2.1 states that all checks and the insert run in one database transaction, and §2.2 states that an API 401 while saving redirects to `/login`. No AC or TEST removed. |
| F-05 1.1 and F-06 1.1 | 13 Nov 2026 | BR-14 for transaction sources, decided after the F-04 review: an archived source (F-05) or receiving account (F-06) returns 400 VALIDATION_ERROR and saves nothing, matching F-04; §2.4 `VALIDATION_ERROR` description extended to match. `INVALID_TARGET_ACCOUNT` still covers archived line targets (BR-06). Editorial: the F-04 header and the feature tables in this README and `features.md` now list BR-10 and BR-14 for F-04, and BR-14 for F-05 and F-06; the F-04 version is unchanged. No AC or TEST added or removed; F-05 and F-06 add theirs with the implementation. |
| F-05 1.2 | 13 Nov 2026 | F-05 (before implementation): AC-05.12/TEST-05.12 (A) cover the archived source added in 1.1 (BR-14). AC-05.13/TEST-05.13 (U, A) cover the BR-06 target cases that had no AC: an archived target, the source as its own target, and a target type outside the Sprint 1 matrix. TEST-05.9 now redirects to the Dashboard and checks the Credit Card debt and the stored lines, because Transaction History is F-07, which depends on F-05; F-07 TEST-07.6 covers the History view. Workflow step 6 now names the Dashboard. Editorial: the §2.1 error column lists every code the bullets below it already named. Failing-first evidence extended to AC-05.12. No AC or TEST removed. |
| F-06 1.2 | 13 Nov 2026 | F-06 (before implementation): AC-06.10/TEST-06.10 (A) cover the archived receiving account added in 1.1 (BR-14). AC-06.11/TEST-06.11 (U, A) cover the BR-06 target cases that had no AC: an archived target, the receiving account as its own target, and a target type outside the Sprint 1 receipt matrix. Workflow step 6 now names the Dashboard because Transaction History is F-07, which depends on F-05; F-07 TEST-07.6 covers the History view. Editorial: the §2.1 error column lists every code the bullets below it already named. Failing-first evidence extended to AC-06.10 and AC-06.11. No AC or TEST removed. |

F-01 is at version 1.4, F-03 and F-04 at version 1.1, F-05 and F-06 at version 1.2; all other contracts in this folder are at version 1.0 (F-07 carries a 1.1 cross-reference note only). Later revisions are recorded in this table and in the repository git history.
