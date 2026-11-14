# Pangtao: Requirements Traceability

Related documents: [SRS](srs.md) · [Feature inventory](features.md) · [System-Level SDS](system-sds.md) · [Three-sprint plan](sprints/plan.md)

## 1. Requirements-to-feature-to-sprint traceability

AC and test IDs follow the convention AC-NN.k and TEST-NN.k, where NN is the feature number. Test levels: U unit, A API/database integration, E end-to-end. Sprint 1 IDs are fixed in Part E; later-sprint rows get contracts before implementation.

| Requirement | Feature | Sprint | Planned verification |
|---|---|---|---|
| FR-01 | F-01 | 1 | AC-01.x / TEST-01.x · A, E |
| FR-02 | F-01 | 1 | AC-01.x / TEST-01.x · A, E |
| FR-03 | F-01 | 1 | AC-01.x / TEST-01.x · A |
| FR-04 | F-01 | 1 | AC-01.x / TEST-01.x · A (role and ownership) |
| FR-05 | F-02 | 1 | AC-02.x / TEST-02.x · A |
| FR-06 | F-02 | 1 | AC-02.x / TEST-02.x · A, E |
| FR-07 | F-17 | 3 | Contract in Sprint 3 · A |
| FR-08 | F-03, F-08 | 1 | AC-03.x / TEST-03.x · U, A, E (accounts and balances API); AC-08.x / TEST-08.x · U, A, E (income/expense totals) |
| FR-09 | F-09 | 2 | Contract in Sprint 2 · A, E |
| FR-10 | F-04 | 1 | AC-04.x / TEST-04.x · U, A |
| FR-11 | F-12 | 2 | Contract in Sprint 2 · A |
| FR-12 | F-05 | 1 | AC-05.x / TEST-05.x · U, A, E |
| FR-13 | F-06 | 1 | AC-06.x / TEST-06.x · U, A, E |
| FR-14 | F-10 | 2 | Contract in Sprint 2 · U, A, E |
| FR-15 | F-11 | 2 | Contract in Sprint 2 · U, A |
| FR-16 | F-13 | 2 | Contract in Sprint 2 · U, A, E |
| FR-17 | F-07 | 1 | AC-07.x / TEST-07.x · A, E |
| FR-18 | F-14 | 3 | Contract in Sprint 3 · A |
| FR-19 | F-15 | 3 | Contract in Sprint 3 · A |
| FR-20 | F-15 | 3 | Contract in Sprint 3 · A, E |
| FR-21 | F-10 | 2 | Contract in Sprint 2 · A |
| FR-22 | F-08 | 1 | AC-08.x / TEST-08.x · U, A, E |
| FR-23 | F-16 | 3 | Contract in Sprint 3 · A |
| FR-24 | F-16 | 3 | Contract in Sprint 3 · A |
| FR-25 | F-07 | 1 | AC-07.3 / TEST-07.3 · A; detail screen checked end to end |
| BR-01 | F-01 (all routes), F-03, F-07, F-08 | 1 | AC-01.x, 03.x, 07.x, 08.x · A (cross-user access); AC-01.9 verified by TEST-07.4 (f-01 v1.1) |
| BR-02 | F-01 (all routes), F-02, F-03, F-07, F-08 | 1 | AC-01.x, 02.x, 03.x, 07.x, 08.x · A (admin denied financial data) |
| BR-03 | F-02 | 1 | AC-02.x · A |
| BR-04 | F-04, F-05, F-06 | 1 | AC-04.x, 05.x, 06.x · U, A |
| BR-05 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-06 | F-05, F-06 (subset); F-10, F-11 (rest) | 1, 2 | AC-05.x (incl. AC-05.6, AC-05.13), 06.x · U, A; extended in Sprint 2 |
| BR-07 | F-03, F-05, F-06 | 1 | AC-03.x, 05.x, 06.x · U, A |
| BR-08 | F-08 | 1 | AC-08.x · U, A |
| BR-09 | F-05, F-08 | 1 | AC-05.x, 08.x · A, E |
| BR-10 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-11 | F-04, F-12 | 1, 2 | AC-04.x · A; management in Sprint 2 |
| BR-12 | F-13 | 2 | Contract in Sprint 2 · A; until then F-07 history lists non-voided transactions only (f-07 1.1) |
| BR-13 | F-02 | 1 | AC-02.x · A |
| BR-14 | F-04, F-05, F-06 (archived rule), F-09 (lifecycle) | 1, 2 | AC-04.10 · A, E; AC-05.12 / TEST-05.12 · A (archived source); AC-05.13 · U, A (archived target, BR-06); AC-06.10 / TEST-06.10 · A (archived receiving account); lifecycle in Sprint 2 |
| BR-15 | F-15 | 3 | Contract in Sprint 3 · A |
| BR-16 | F-05, F-06 | 1 | AC-05.10, AC-06.4 / TEST-05.10, TEST-06.4 · A |
| NFR-01 | F-01 | 1 | AC-01.x · A |
| NFR-02 | F-01 (all routes) | 1, re-run in 2, 3 | AC-01.x · A route-list test |
| NFR-03 | F-03 | 1, re-run in 2 | AC-03.x · U, A invariant test |
| NFR-04 | F-01 | 1 | AC-01.x · A |
| NFR-05 | F-19 (local run verified in Sprint 1; Docker in Lab 5 #23) | 1 local, Lab 5 Docker | README run-through; clean-clone container run (§3, Lab 5 #23) |
| NFR-06 | F-19 (local restart check in Sprint 1; redeploy in Lab 5) | 1 local, Lab 5 | Restart check; Lab 5 evidence |
| NFR-07 | F-18 | 3 | Timing script |
| NFR-08 | F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08 (Sprint 1 screens), F-18 (all) | 1 (built screens), 3 | E checks plus checklist |
| NFR-09 | F-19 | 1 local, Lab 5 CI | Coverage report; CI runs |
| NFR-10 | F-01 | 1 | AC-01.6, AC-01.12, AC-01.13 / TEST-01.6, TEST-01.12, TEST-01.13 · A |

## 2. Coverage and change status

Baseline v1.0 contains 25 FR, 16 BR and 10 NFR. Every one is mapped to a feature or system responsibility and a sprint. Sprint 1 carries 13 FR (FR-01–06, 08, 10, 12, 13, 17, 22, 25), Sprint 2 carries 6 (FR-09, 11, 14, 15, 16, 21) and Sprint 3 carries 6 (FR-07, 18, 19, 20, 23, 24). **Uncovered requirements: none.**

| Version | Date | Change | Approved |
|---|---|---|---|
| v1.0 | 7 Nov 2026 | Initial baseline | Team |
| v1.1 | 10 Nov 2026 | F-01 contract v1.1: AC-01.9 verification moved to F-07 (TEST-07.4); no requirement added or dropped | Teammate review, PR #10 (approved and merged) |
| v1.2 | 11 Nov 2026 | F-03 contract v1.1: F-03 creates the full ledger schema (accounts, transactions, allocation_lines); AC-03.4 invariant wording made explicit for Loan Taken openings; no requirement added or dropped | Teammate review, PR #12 (approved and merged) |
| v1.3 | 12 Nov 2026 | System-Level SDS §1 corrected to match the code: services call Prisma directly (no separate repository layer), the route guard is `access(...)`, the repository layout lists `tests/unit`, `tests/helpers` and `scripts/`, the runtime is Node.js 20 or later, and brute-force limiting counts failed attempts only (as SRS NFR-10 and F-01 state). Feature inventory and sprint README list BR-01 for F-07, matching the F-07 contract and this matrix. F-01 contract v1.4: §2.2 aligned with web app route guarding (Administrator on User page redirected to `/admin/users`, API 401 redirects to `/login`). §3 below added with actual Sprint 1 test results. Product DoD 1.1 and F-01 contract 1.3–1.4 (sprint README §5): results are recorded in the PR and, from Lab 5, in CI; the committed per-feature evidence folder is removed and kept in git history. No requirement added or dropped. FR-08 is traced to F-03 (accounts and balances API) and F-08 (income/expense totals), and the verification record names the feature baseline plus this documentation commit rather than `cec8b61` alone | Teammate review, PR #13 (approved and merged) |
| v1.4 | 13 Nov 2026 | F-07 contract v1.1: TEST-07.9 (E) added for the empty and error states of AC-07.6; history lists non-voided transactions until F-13 delivers BR-12; real index name `transactions_user_id_txn_date_created_at_idx` in §2.3 and §5. No requirement added or dropped | Teammate review, PR #17 (approved and merged) |
| v1.5 | 13 Nov 2026 | F-08 contract 1.0: AC-08.1–AC-08.9 verified at unit, API and E2E levels; §3 records the F-08 failing-first and implementation commits. No requirement added or dropped | Teammate review, PR #18 (changes requested, addressed, approved and merged) |
| v1.6 | 14 Nov 2026 | F-01 contract v1.5 (Lab 5): the AC-01.12 counter is stored in the new `login_attempts` table and, behind Cloud Run, keyed by the client IP from `X-Forwarded-For` (`TRUST_PROXY`); expired windows are deleted on every login attempt. System-Level SDS §1, §2 (table and ER diagram), §6 and §7 updated to match, and §7 no longer claims Zod validation of the environment. §3 gains the Lab 5 tested version, and its status line now records the Sprint 1 release on `main` (PR #20). No requirement added or dropped | Teammate review, PR #29 (changes requested, addressed, approved and merged) |
| v1.7 | 15 Nov 2026 | Lab 5 #23 (containerize): System-Level SDS §7 lists `APP_PORT` and the `GIT_SHA` default and marks `LOG_LEVEL` as reserved, and §8 now says `docker compose up -d` starts PostgreSQL only while `--profile app` adds the `migrate` job and the app container. NFR-05 evidence names the clean-clone container run, and §3 gains the Lab 5 #23 tested version. No requirement added or dropped | Pending teammate review |

All assumptions and decisions (A-01–A-04, D-01–D-07) are fully resolved and agreed by the team; zero open items remain.

## 3. Sprint 1 verification results

Actual tests and results for every Sprint 1 acceptance criterion. Automated test names start with their test ID, for example `TEST-03.3 (AC-03.3): …`, so each row can be found by searching the file for the ID.

**Tested version:** `sprint-1-staging` at commit `cec8b61` (merge of PR #12), 12 Nov 2026, plus this documentation and verification commit on `docs/sprint-1-align-contracts` (its head commit is recorded in the PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 44 passed, 0 failed, 0 skipped, service-layer line coverage 98.41%, build succeeded, `npx playwright test` 4 passed, 0 failed, 0 skipped (TEST-02.4 end-to-end added). **F-04:** branch `feature/F-04-opening-balance`, failing-first commit `f03c53a`, implementation commit `d831c3d`, UI/E2E/traceability commit `1fa5afa`, review failing-first commit `968d5f9`, plus the review-fix commit at this PR's head (recorded in the F-04 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 61 passed, 0 failed, 0 skipped, service-layer line coverage 98.13% (`opening-balance.service.ts` 97.05%), build succeeded, `npx playwright test` 7 passed, 0 failed, 0 skipped (the extra F-04 spec covers the §2.2 dialog at desktop and 360 px, the archived-row rule and the expired-session redirect; it is not part of the contract STS). **F-05:** branch `feature/F-05-payment-charge`, contract 1.2 commit `1645b2d`, failing-first commit `f3b0a32`, implementation commit at this PR's head (recorded in the F-05 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 82 passed, 0 failed, 0 skipped, service-layer line coverage 98.62% (`transaction.service.ts` and `allocation.rules.ts` 100%), build succeeded, `npx playwright test` 9 passed, 0 failed, 0 skipped. **F-06:** branch `feature/F-06-received-money`, contract 1.2 commit `b26ea54`, failing-first commit `ccac71a`, implementation commit at this PR's head (recorded in the F-06 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 98 passed, 0 failed, 0 skipped, service-layer line coverage 98.7% (`transaction.service.ts` and `allocation.rules.ts` 100%), build succeeded, `npx playwright test` 10 passed, 0 failed, 0 skipped. On Windows the E2E run was made with `TEMP`/`TMP` outside `%TEMP%`, because Playwright otherwise stalls deleting the browser profile after the tests pass (all specs; fixed separately on `chore/playwright-temp-dir`). **F-07:** branch `feature/F-07-transaction-history`, contract 1.1 commit `64e4b0d`, failing-first commit `4a8d6fe`, implementation commit at this PR's head (recorded in the F-07 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 109 passed, 0 failed, 0 skipped, service-layer line coverage 98.86% (`transaction.service.ts` 100%), build succeeded, `npx playwright test` 14 passed, 0 failed, 0 skipped. **F-08:** branch `feature/F-08-income-expense-summary`, contract 1.0, failing-first commit `bb79797`, implementation commit at this PR's head (recorded in the F-08 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 125 passed, 0 failed, 0 skipped, service-layer line coverage 98.95% (`summary.service.ts` and `summary.engine.ts` 100%), build succeeded, `npx playwright test` 19 passed, 0 failed, 0 skipped. Extra F-08 coverage beyond TEST-08.7: the dashboard widget, cache refresh after a new payment, inline custom-range validation, the skeleton/error/retry states, the 360 px layout, and a parity test that runs the pure engine and the SQL aggregation over the same ledger. On Windows, a terminal opened as `c:\…` made v8 count every source file twice (once at 0%) and fail the 80% gate although all tests passed; `vitest.config.ts` now pins the root to an uppercase drive letter, and the run above was made from `c:\…`. Update this table and the tested version whenever a feature merges into staging.

**Lab 5 tested version (#22, cloud readiness):** branch `chore/lab5-cloud-ready`, failing-first commits `9e5398a` and `915a37c`, implementation commit `f25fbc1`, plus the review-fix commit at the head of PR #29 (recorded in the PR description per DoD 1.1). Commands on that tree: lint and type-check clean, `npm test` 131 passed, 0 failed, 0 skipped, service-layer line coverage 99.01% (`login-attempt.service.ts` 100%), build succeeded, `npx playwright test` 19 passed, 0 failed, 0 skipped.

**Lab 5 tested version (#23, containerize):** branch `chore/lab5-containerize`, image commits `09de27b` and `78d0339`, plus the review-fix commit at the head of its PR (documentation, `.dockerignore` and comments; recorded in the PR description). Commands on that tree: lint and type-check clean, `npm test` 131 passed, 0 failed, 0 skipped, service-layer line coverage 99.01%, build succeeded, `npx playwright test` 19 passed, 0 failed, 0 skipped in each of the last four full runs (two earlier full runs each failed TEST-08.7 with Prisma P2028 before the development database was re-seeded; not reproduced since, tracked in #31). C-03: a fresh clone of `78d0339` with only `SEED_DEFAULT_PASSWORD` set in `.env` ran `GIT_SHA=$(git rev-parse HEAD) docker compose --profile app up -d --build` (`GIT_SHA` only labels the build; without it the log shows `commit local`); `migrate` exited 0 after applying migrations and seeding, `app` became healthy and logged `[production] commit 78d0339…`, `GET /api/v1/health` returned `{"status":"ok"}`, a seeded user logged in (200) and `/` served the web app. The image runs as `node` (uid 1000) and contains no `.env`, `tests`, `docs` or `.git`. After the review fix, a `docker build --target build` with planted `server/.env.local`, `web/.env.production` and `server/planted.pem` showed none of them in the build stage and nothing inlined into `web/dist`.

| AC | Test | Level | Actual test file | Result |
|---|---|---|---|---|
| AC-01.1 to AC-01.8 | TEST-01.1 to TEST-01.8 | A | `tests/api/auth.api.test.ts` | PASS |
| AC-01.9 | TEST-07.4 (f-01 v1.1) | A | `tests/api/transaction-history.api.test.ts` | PASS; failing-first `4a8d6fe` |
| AC-01.10 to AC-01.13 | TEST-01.10 to TEST-01.13 | A | `tests/api/auth.api.test.ts` | PASS; extra AC-01.12 cases (f-01 v1.5): behind a proxy and across a restart, failing-first `9e5398a`; window expiry and reset on success, failing-first `915a37c` |
| AC-01.14 | TEST-01.14 | E | `tests/e2e/auth.spec.ts` | PASS |
| AC-02.1 to AC-02.3 | TEST-02.1 to TEST-02.3 | A | `tests/api/admin.api.test.ts` | PASS |
| AC-02.4 | TEST-02.4 | A, E | `tests/api/admin.api.test.ts` and `tests/e2e/admin-users.spec.ts` | PASS at both levels |
| AC-02.5 to AC-02.7 | TEST-02.5 to TEST-02.7 | A | `tests/api/admin.api.test.ts` | PASS |
| AC-02.8 | TEST-02.8 | E | `tests/e2e/admin-users.spec.ts` | PASS |
| AC-02.9 | TEST-02.9 | A | `tests/api/admin.api.test.ts` | PASS |
| AC-03.1, AC-03.2 | TEST-03.1, TEST-03.2 | A | `tests/api/accounts.api.test.ts` | PASS |
| AC-03.3, AC-03.4 | TEST-03.3, TEST-03.4 | U, A | `tests/unit/balance.engine.test.ts` and `tests/api/accounts.api.test.ts` | PASS at both levels |
| AC-03.5 | TEST-03.5 | A | `tests/api/accounts.api.test.ts` | PASS |
| AC-03.6 | TEST-03.6 | E | `tests/e2e/dashboard.spec.ts` | PASS |
| AC-04.1, AC-04.2 | TEST-04.1, TEST-04.2 | A | `tests/api/opening-balance.api.test.ts` | PASS |
| AC-04.3 | TEST-04.3 | U, A | `tests/unit/opening-balance.test.ts` and `tests/api/opening-balance.api.test.ts` | PASS at both levels |
| AC-04.4 | TEST-04.4 | A | `tests/api/opening-balance.api.test.ts` | PASS; failing-first `f03c53a`, implementation `d831c3d` |
| AC-04.5 | TEST-04.5 | A | `tests/api/opening-balance.api.test.ts` | PASS; failing-first `f03c53a`, implementation `d831c3d` |
| AC-04.6 | TEST-04.6 | U, A | `tests/unit/opening-balance.test.ts` and `tests/api/opening-balance.api.test.ts` | PASS at both levels |
| AC-04.7 to AC-04.9 | TEST-04.7 to TEST-04.9 | A | `tests/api/opening-balance.api.test.ts` | PASS |
| AC-04.10 | TEST-04.10 | A, E | `tests/api/opening-balance.api.test.ts` and `tests/e2e/opening-balance.spec.ts` | PASS at both levels; failing-first `968d5f9` |
| AC-05.1 to AC-05.3 | TEST-05.1 to TEST-05.3 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-05.4 | TEST-05.4 | U, A | `tests/unit/allocation.rules.test.ts` and `tests/api/transactions.api.test.ts` | PASS at both levels; failing-first `f3b0a32` |
| AC-05.5 | TEST-05.5 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-05.6 | TEST-05.6 | A | `tests/api/transactions.api.test.ts` | PASS; failing-first `f3b0a32` |
| AC-05.7, AC-05.8 | TEST-05.7, TEST-05.8 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-05.9 | TEST-05.9 | E | `tests/e2e/transactions.spec.ts` | PASS |
| AC-05.10, AC-05.11 | TEST-05.10, TEST-05.11 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-05.12 | TEST-05.12 | A | `tests/api/transactions.api.test.ts` | PASS; failing-first `f3b0a32` |
| AC-05.13 | TEST-05.13 | U, A | `tests/unit/allocation.rules.test.ts` and `tests/api/transactions.api.test.ts` | PASS at both levels |
| AC-06.1, AC-06.2 | TEST-06.1, TEST-06.2 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-06.3 | TEST-06.3 | U, A | `tests/unit/allocation.rules.test.ts` and `tests/api/transactions.api.test.ts` | PASS at both levels; failing-first `ccac71a` |
| AC-06.4 | TEST-06.4 | A | `tests/api/transactions.api.test.ts` | PASS; failing-first `ccac71a` |
| AC-06.5, AC-06.6 | TEST-06.5, TEST-06.6 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-06.7 | TEST-06.7 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-06.8 | TEST-06.8 | E | `tests/e2e/transactions.spec.ts` | PASS |
| AC-06.9 | TEST-06.9 | A | `tests/api/transactions.api.test.ts` | PASS |
| AC-06.10 | TEST-06.10 | A | `tests/api/transactions.api.test.ts` | PASS; failing-first `ccac71a` |
| AC-06.11 | TEST-06.11 | U, A | `tests/unit/allocation.rules.test.ts` and `tests/api/transactions.api.test.ts` | PASS at both levels; failing-first `ccac71a` |
| AC-07.1 to AC-07.3 | TEST-07.1 to TEST-07.3 | A | `tests/api/transaction-history.api.test.ts` | PASS |
| AC-07.4 | TEST-07.4 | A | `tests/api/transaction-history.api.test.ts` | PASS; failing-first `4a8d6fe` (fails on the owner's 200 control, not on the missing route's 404) |
| AC-07.5 | TEST-07.5, TEST-07.7 | A | `tests/api/transaction-history.api.test.ts` | PASS |
| AC-07.6 | TEST-07.6, TEST-07.9 | E | `tests/e2e/transaction-history.spec.ts` | PASS |
| AC-07.7 | TEST-07.8 | A | `tests/api/transaction-history.api.test.ts` | PASS |
| AC-08.1, AC-08.2 | TEST-08.1 | A | `tests/api/summary.api.test.ts` | PASS |
| AC-08.3 | TEST-08.2, TEST-08.6 | U, A | `tests/unit/summary.engine.test.ts` and `tests/api/summary.api.test.ts` | PASS at both levels; failing-first `bb79797` |
| AC-08.4 | TEST-08.3 | A | `tests/api/summary.api.test.ts` | PASS |
| AC-08.5 | TEST-08.4 | A | `tests/api/summary.api.test.ts` | PASS |
| AC-08.6 | TEST-08.5 | A | `tests/api/summary.api.test.ts` | PASS |
| AC-08.7 | TEST-08.7 | E | `tests/e2e/summary.spec.ts` | PASS |
| AC-08.8 | TEST-08.8 | A | `tests/api/summary.api.test.ts` | PASS |
| AC-08.9 | TEST-08.9 | A | `tests/api/summary.api.test.ts` | PASS |

**Status by feature:** F-01 to F-08 are implemented, merged into `sprint-1-staging` (F-08 through PR #18) and released on `main` through the Sprint 1 release PR #20 (`bec5575`); F-07's TEST-07.4 passes, which completes F-01 AC-01.9. `sprint-2-staging` starts from that release. Lab 5 changes (from #22) target `sprint-2-staging` and reach `main` through the release pipeline (#27).

**Where results are recorded:** in each feature PR description (tested commit, counts, AC-to-test table, failing-test and implementation commits) and, once CI runs on pull requests (Lab 5 #24), in the CI run on that PR. Earlier per-feature output files are in git history (sprint README §5, DoD 1.1).
