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
| FR-25 | F-07 | 1 | AC-07.3 / TEST-07.3 · A |
| BR-01 | F-01 (all routes), F-03, F-07, F-08 | 1 | AC-01.x, 03.x, 07.x, 08.x · A (cross-user access); AC-01.9 verified by TEST-07.4 (f-01 v1.1) |
| BR-02 | F-01 (all routes), F-02, F-03, F-07, F-08 | 1 | AC-01.x, 02.x, 03.x, 07.x, 08.x · A (admin denied financial data) |
| BR-03 | F-02 | 1 | AC-02.x · A |
| BR-04 | F-04, F-05, F-06 | 1 | AC-04.x, 05.x, 06.x · U, A |
| BR-05 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-06 | F-05, F-06 (subset); F-10, F-11 (rest) | 1, 2 | AC-05.x, 06.x · U, A; extended in Sprint 2 |
| BR-07 | F-03, F-05, F-06 | 1 | AC-03.x, 05.x, 06.x · U, A |
| BR-08 | F-08 | 1 | AC-08.x · U, A |
| BR-09 | F-05, F-08 | 1 | AC-05.x, 08.x · A, E |
| BR-10 | F-05, F-06 | 1 | AC-05.x, 06.x · U, A |
| BR-11 | F-04, F-12 | 1, 2 | AC-04.x · A; management in Sprint 2 |
| BR-12 | F-13 | 2 | Contract in Sprint 2 · A |
| BR-13 | F-02 | 1 | AC-02.x · A |
| BR-14 | F-09 | 2 | Contract in Sprint 2 · A |
| BR-15 | F-15 | 3 | Contract in Sprint 3 · A |
| BR-16 | F-05, F-06 | 1 | AC-05.10, AC-06.4 / TEST-05.10, TEST-06.4 · A |
| NFR-01 | F-01 | 1 | AC-01.x · A |
| NFR-02 | F-01 (all routes) | 1, re-run in 2, 3 | AC-01.x · A route-list test |
| NFR-03 | F-03 | 1, re-run in 2 | AC-03.x · U, A invariant test |
| NFR-04 | F-01 | 1 | AC-01.x · A |
| NFR-05 | F-19 (local run verified in Sprint 1; Docker in Lab 5) | 1 local, Lab 5 Docker | README run-through; Lab 5 evidence |
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
| v1.3 | 12 Nov 2026 | System-Level SDS §1 corrected to match the code: services call Prisma directly (no separate repository layer), the route guard is `access(...)`, the repository layout lists `tests/unit`, `tests/helpers` and `scripts/`, the runtime is Node.js 20 or later, and brute-force limiting counts failed attempts only (as SRS NFR-10 and F-01 state). Feature inventory and sprint README list BR-01 for F-07, matching the F-07 contract and this matrix. F-01 contract v1.4: §2.2 aligned with web app route guarding (Administrator on User page redirected to `/admin/users`, API 401 redirects to `/login`). §3 below added with actual Sprint 1 test results. Product DoD 1.1 and F-01 contract 1.3–1.4 (sprint README §5): results are recorded in the PR and, from Lab 5, in CI; the committed per-feature evidence folder is removed and kept in git history. No requirement added or dropped. FR-08 is traced to F-03 (accounts and balances API) and F-08 (income/expense totals), and the verification record names the feature baseline plus this documentation commit rather than `cec8b61` alone | Pending teammate review |

All assumptions and decisions (A-01–A-04, D-01–D-07) are fully resolved and agreed by the team; zero open items remain.

## 3. Sprint 1 verification results

Actual tests and results for every Sprint 1 acceptance criterion. Automated test names start with their test ID, for example `TEST-03.3 (AC-03.3): …`, so each row can be found by searching the file for the ID.

**Tested version:** `sprint-1-staging` at commit `cec8b61` (merge of PR #12), 12 Nov 2026, plus this documentation and verification commit on `docs/sprint-1-align-contracts` (its head commit is recorded in the PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 44 passed, 0 failed, 0 skipped, service-layer line coverage 98.41%, build succeeded, `npx playwright test` 4 passed, 0 failed, 0 skipped (TEST-02.4 end-to-end added). **F-04:** branch `feature/F-04-opening-balance`, failing-first commit `f03c53a`, implementation commit `d831c3d`, plus the UI/E2E/traceability commit at this PR's head (recorded in the F-04 PR description per DoD 1.1). Commands: `npm run verify` on that tree: lint and type-check clean, `npm test` 60 passed, 0 failed, 0 skipped, service-layer line coverage 97.13%, build succeeded, `npx playwright test` 5 passed, 0 failed, 0 skipped (the extra F-04 spec covers the §2.2 dialog at desktop and 360 px; it is not part of the contract STS). Update this table and the tested version whenever a feature merges into staging.

| AC | Test | Level | Actual test file | Result |
|---|---|---|---|---|
| AC-01.1 to AC-01.8 | TEST-01.1 to TEST-01.8 | A | `tests/api/auth.api.test.ts` | PASS |
| AC-01.9 | TEST-07.4 (f-01 v1.1) | A | Not written yet: arrives with F-07 | NOT VERIFIED |
| AC-01.10 to AC-01.13 | TEST-01.10 to TEST-01.13 | A | `tests/api/auth.api.test.ts` | PASS |
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
| AC-05.x to AC-08.x | TEST-05.x to TEST-08.x | per contract | Not written yet | NOT IMPLEMENTED (F-05 to F-08) |

**Status by feature:** F-01, F-02, F-03 and F-04 are implemented (F-04 is on `feature/F-04-opening-balance`, pending merge into `sprint-1-staging`). F-01 is not Done until TEST-07.4 passes (AC-01.9). F-05 to F-08 are not started. Nothing is released on `main` yet.

**Where results are recorded:** in each feature PR description (tested commit, counts, AC-to-test table, failing-test and implementation commits) and, from Lab 5, in the CI run on that PR. Earlier per-feature output files are in git history (sprint README §5, DoD 1.1).
