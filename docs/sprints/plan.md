# Pangtao: Three-Sprint Plan

Related documents: [SRS](../srs.md) · [Feature inventory](../features.md) · [Requirements traceability](../traceability.md) · [System-Level SDS](../system-sds.md)

## 1. Sprint overview

| Sprint | Goal | Features | Dependencies | Completion outcome | Checkpoint |
|---|---|---|---|---|---|
| 1 | Small working domain slice with authentication, permissions and persistence | F-01 to F-08 | None | A User logs in, records an opening balance, salary, a card purchase and a card repayment, then sees balances, card debt, summary and history; an Administrator disables a user; rule-rejection and access tests pass; tagged release on main | Deliverable 1, 8 Nov |
| Lab 5 (from the Sprint 1 release) | Ship it | F-19 | Sprint 1 release | Docker, CI gate, GCP deployment with persistence | 15 Nov |
| 2 | Core expansion | F-09 to F-13 | Sprint 1 release; F-09 before F-10; F-05 and F-06 before F-10, F-11, F-13 | Accounts manageable; all eight allocation kinds give correct balances; transactions editable and voidable; opening balances manageable; outstanding loans overview; regression suite green; deployed increment | Deliverable 2, 29 Nov |
| 3 | Remaining features and hardening | F-14 to F-18 | Sprint 2; F-07 before F-14 and F-15; F-08 before F-16; F-18 last | Search and filter, favorites and duplicate, category summaries and monthly report, administrator account creation; performance, usability and failure handling verified; final report and demo | Progress 29 Nov (F-14 and F-15 implemented, contracts for F-16 to F-18, remaining-work list); complete 13 Dec |

## 2. Sprint 1 scope

**Included:** F-01 to F-08. Transactions support Payment lines to Expense accounts (from a Cash or card source), Payment lines to a Loan Taken account as repayment (from a Cash source), and Receipt lines to Income accounts. Accounts are seeded.

**Deferred:** account management, lending and borrowing, transfers, edit and void, opening-balance management, search, favorites, duplicate, category summaries, reports and administrator account creation. Because the balance and allocation engine is written once for the full matrix in SRS section 4 (srs.md), Sprint 2 mostly extends its allowed-target table and adds screens.

**Reproducible demo sequence (Alice, seeded):**

1. Log in as Alice; the dashboard shows all balances at 0.00.
2. Record an opening balance of 50,000.00 on Bank Account dated in the past.
3. Receive 30,000.00 into Bank Account allocated to Salary.
4. Charge 1,200.00 on Credit Card with two lines: Dining 700.00 and Groceries 500.00.
5. Pay 800.00 from Bank Account allocated to the Credit Card (repayment).
6. Expected: Bank 79,200.00; Credit Card debt 400.00; income 30,000.00; expense 1,200.00; history shows 4 entries.
7. Rejection: submit a 1,200.00 charge whose lines add up to 1,000.00; it is refused and nothing is saved.
8. Forbidden: Bob requests Alice’s transaction (404); the Administrator requests transactions (403); after logout, GET /auth/me returns 401.

**Build order and pairing.** (1) Schema, seed and F-01; (2) F-03 with the balance engine; (3) F-05 and F-06 on the shared transaction service; (4) F-07, F-08, F-04 and F-02. Each feature gets its contract and failing tests first, then implementation; both students rotate the driver role and review each other’s pull requests, so neither owns only specifications or only code. If time runs short, F-08 and F-02 are the smallest features and the first candidates for a disclosed carry-over; F-01, F-03, F-05, F-06 and F-07 form the minimum slice.

## 3. Branches and releases

`main` (accepted releases) ← `sprint-N-staging` ← `feature/F-NN-short-name` or `fix/...`. Each feature branch starts from the current staging branch and merges by teammate-reviewed pull request. A reviewed release pull request moves staging into main and is tagged: v0.1.0 (Sprint 1), v0.2.0 (Sprint 2), v1.0.0 (final). Lab work is kept in `docs/labs/` and identified separately from feature work.

## 4. Risks

| Risk | Mitigation |
|---|---|
| Sprint 2 competes with Labs 5 to 7 and the exam period | Administrator account creation moved to Sprint 3; Sprint 2 is mostly extension of one shared engine |
| Wrong money arithmetic | Integer satang; derived balances; invariant test over every saved transaction |
| Private data leaks between users or to the Administrator | Default-deny middleware, ownership filter and composite foreign keys, plus the route-list test (NFR-02) and cross-user tests in every sprint |
| Date errors near midnight | BR-10 uses APP_TIMEZONE; boundary tests around midnight |
| Lab 7 needs an approved change to an implemented rule | Propose a change to a Sprint 1 rule (for example BR-04 or BR-10) to the TA after the Sprint 1 release |
