# Pangtao: Feature Inventory

Related documents: [SRS](srs.md) · [Requirements traceability](traceability.md) · [System-Level SDS](system-sds.md) · [Three-sprint plan](sprints/plan.md)

## 1. Feature inventory

| ID | Feature | Description | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-01 | Authentication and authorization foundation | Login, logout, current user, sessions, role and ownership enforcement, safe errors, rate limiting and CSRF checks | FR-01–04; BR-01, 02; NFR-01, 02, 04, 10 | none | 1 |
| F-02 | Admin user management | List users; enable/disable with session revocation | FR-05, 06; BR-02, 03, 13 | F-01 | 1 |
| F-03 | Accounts and balances | View seeded accounts with derived balances; balance engine | FR-08; BR-01, 07; NFR-03 | F-01 | 1 |
| F-04 | Opening balance | Record dated opening balance per account | FR-10; BR-04, 10, 11, 14 | F-03 | 1 |
| F-05 | Payment and charge | Payment form with allocation lines (Expense, Loan Taken repayment) | FR-12; BR-04–07, 09, 10, 14, 16 | F-03 | 1 |
| F-06 | Received money | Receipt form with allocation lines (Income) | FR-13; BR-04–07, 10, 14, 16 | F-03 | 1 |
| F-07 | Transaction history | Paginated newest-first history and single-transaction detail | FR-17, 25; BR-01 | F-05, F-06 | 1 |
| F-08 | Income and expense summary | Totals and net for a date range | FR-22; BR-01, 08, 09 | F-05, F-06 | 1 |
| F-09 | Account management | Create, rename, archive accounts with valid subtypes | FR-09; BR-14 | F-03 | 2 |
| F-10 | Loans | Lend, borrow, repay, receive repayment; outstanding overview | FR-14, 21; BR-06 | F-05, F-06, F-09 | 2 |
| F-11 | Transfers | Transfer lines between Cash accounts | FR-15; BR-06 | F-05, F-06 | 2 |
| F-12 | Opening balance management | Correct or remove opening balance | FR-11; BR-11 | F-04 | 2 |
| F-13 | Edit and void transactions | Corrections with recalculated balances | FR-16; BR-12 | F-05, F-06 | 2 |
| F-14 | Search and filter | Filter history by date, account, category, text, amount | FR-18 | F-07 | 3 |
| F-15 | Favorites and duplicate | Favorite flag and list; duplicate into new editable form | FR-19, 20; BR-15 | F-07 | 3 |
| F-16 | Category summaries and reports | Spending per category; monthly report | FR-23, 24 | F-08 | 3 |
| F-17 | Admin create user | Create user account with initial password | FR-07 | F-02 | 3 |
| F-18 | Product hardening | Performance, full usability states, failure handling, regression | NFR-07, 08 | all | 3 |
| F-19 | Delivery pipeline | Docker, CI/CD, GCP deployment, durability, coverage gate | NFR-05, 06, 09 | F-01–F-08 | Lab 5 |

The inventory contains 19 deliverable features covering all 25 FRs, 16 BRs and 10 NFRs. F-18 and F-19 are cross-cutting system responsibilities and map only to NFRs. The Requirements column lists what each feature implements; cross-cutting rules (BR-01, BR-02, NFR-08) are also verified by other features, as [traceability.md](traceability.md) shows.
