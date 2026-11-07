# Pangtao: Software Requirements Specification

Related documents: [Feature inventory](features.md) · [Requirements traceability](traceability.md) · [System-Level SDS](system-sds.md) · [Three-sprint plan](sprints/plan.md)

## 1. Stakeholder problem and context

People who juggle cash, bank accounts, a credit card and informal loans struggle to see what they own, what they owe and where their money goes. Pangtao is a multi-user web application in which each person keeps private financial accounts and records every money movement as a dated transaction split into allocation lines. The context is personal finance for individuals in Thailand, in a single currency (Thai baht, THB). The platform operator (Administrator) controls who may use the platform but never sees anyone’s finances.

## 2. Actors

| Actor | Responsibilities | Restrictions |
|---|---|---|
| User | Owns accounts; records opening balances and transactions; views balances, loans, summaries, history, favorites | Sees and changes only their own data |
| Administrator | Lists users; enables or disables users; (later) creates user accounts | Cannot view or modify any financial record or summary; cannot disable self |

## 3. Scope and exclusions

**In scope:** login/logout with roles; five account types; opening balances; payments/charges and received money with allocation lines; loans given and taken; transfers; corrections; history, search and filters; favorites and duplicate; balances, outstanding loans, income/expense and category summaries, monthly report; administrator user management.

**Out of scope:** period or shared budgets, recurring transactions, bank integration, multiple currencies, receipt attachments, CSV import/export, native mobile apps, self-registration, password recovery, email verification, multiple roles per account, real payment services.

## 4. Domain concepts and core accounting rules

| Account type | Examples | What its balance means |
|---|---|---|
| Cash | Wallet, bank account | Money held |
| Loan Taken | Credit card, borrowed money | Outstanding debt owed by the user |
| Loan Given | Money lent to someone | Amount owed to the user |
| Income | Salary, interest earned | Running total earned (acts as a category) |
| Expense | Dining, groceries, electricity, telecom | Running total spent (acts as a category) |

A transaction has one **source account** and one or more **allocation lines**. There are two forms: a **Payment/charge** (source is a Cash or Loan Taken account) and a **Receipt** (source is the Cash account that receives the money). The source effect is: Payment from Cash reduces the balance by the total; Payment from Loan Taken (card charge) increases the debt by the total; Receipt increases the Cash balance by the total.

| Form | Line allocated to | Meaning | Effect on target | Counted as | Sprint |
|---|---|---|---|---|---|
| Payment | Expense account | Spending | Expense total + line | Expense | 1 |
| Payment | Loan Taken account | Repay borrowed money or card | Debt − line | Not expense | 1 |
| Payment | Loan Given account | Lend to someone | Owed-to-you + line | Not expense | 2 |
| Payment | Another Cash account | Transfer out | Balance + line | Not expense | 2 |
| Receipt | Income account | Earnings | Income total + line | Income | 1 |
| Receipt | Loan Given account | Repayment received | Owed-to-you − line | Not income | 2 |
| Receipt | Loan Taken account | New borrowing | Debt + line | Not income | 2 |
| Receipt | Another Cash account | Transfer in | Other balance − line | Not income | 2 |

In Sprint 1 a Loan Taken (card) source accepts Expense lines only, and Loan Taken repayment lines are accepted from a Cash source only. An **opening balance** sets an account’s starting amount and is neither income nor expense.

## 5. Functional requirements

| ID | Requirement (observable behavior) |
|---|---|
| FR-01 | An active user logs in with email and password; the system starts a session and returns the user’s identity. Invalid credentials get one generic rejection. |
| FR-02 | A logged-in user logs out; the session ends immediately and any later request using it is rejected. |
| FR-03 | The client can retrieve the current user’s id, name and role from the server. |
| FR-04 | The backend enforces the role/permission matrix in System-Level SDS §5 and the ownership rule in BR-01 on every protected operation: a caller may perform only the operations allowed to their role and may access only their own financial records; another user’s record is answered as not found, and an Administrator is denied every financial record and summary (BR-02). |
| FR-05 | An Administrator lists users with email, name, role and status, without any financial data. |
| FR-06 | An Administrator enables or disables a user; a disabled user cannot log in and their sessions end. |
| FR-07 | An Administrator creates a user account with an initial password. |
| FR-08 | A User views their accounts grouped by type, each with its current balance (cash held, debt, amount owed to them, income/expense totals). |
| FR-09 | A User creates, renames and archives accounts of the five types, each with an optional subtype valid for its type (for example wallet or bank for Cash, credit card or other for Loan Taken). |
| FR-10 | A User records an opening balance (amount and date) for a Cash, Loan Taken or Loan Given account. |
| FR-11 | A User corrects or removes an opening balance. |
| FR-12 | A User records a payment or charge: source account, date, total, optional memo and one or more allocation lines, each with an optional note. |
| FR-13 | A User records received money into a Cash account: date, total, optional memo and one or more allocation lines, each with an optional note. |
| FR-14 | A User records loans given and taken: lending, borrowing, repaying loans taken and receiving repayments of loans given. |
| FR-15 | A User transfers money between their own Cash accounts using an allocation line on either form. |
| FR-16 | A User edits or voids a transaction; balances and summaries update accordingly. |
| FR-17 | A User views transaction history, newest first, paginated, showing date, source, total, memo and lines with their notes. |
| FR-18 | A User searches and filters history by date range, account, category, text and amount range. |
| FR-19 | A User marks or unmarks a transaction as favorite and lists favorites. |
| FR-20 | A User selects Duplicate on a transaction to open a new editable transaction pre-filled with the same details; nothing is saved until submitted. |
| FR-21 | A User views an overview of outstanding loans (owed by and to them) and credit card debt. |
| FR-22 | A User views total income, total expense and net for a date range (default: current month). |
| FR-23 | A User views spending per expense account for a date range, with share of total. |
| FR-24 | A User views a monthly income-versus-expense report for a chosen year. |
| FR-25 | A User opens one transaction and views its complete detail: kind, source account, date, total, memo and every allocation line with target account and note. |

## 6. Business rules

| ID | Rule |
|---|---|
| BR-01 | Every account, transaction and summary belongs to exactly one user; a user can access only their own. A request for another user’s record is answered as not found. |
| BR-02 | An Administrator can never read or modify financial records or summaries. |
| BR-03 | An Administrator cannot disable their own account. |
| BR-04 | Every amount is a positive THB value with at most 2 decimal places and at most 100,000,000.00 (an opening balance may be 0). |
| BR-05 | A transaction has at least one allocation line, each line is positive, and the lines sum exactly to the total; otherwise it is rejected and nothing is saved. |
| BR-06 | Line targets must be allowed by the matrix in section 4, differ from the source account, belong to the same user and not be archived. |
| BR-07 | A saved transaction updates every affected balance exactly once per the matrix, atomically; a rejected transaction changes nothing. Balances are always derived from saved transactions. |
| BR-08 | Income and expense summaries count only lines allocated to Income or Expense accounts; transfers, borrowing, lending, loan repayments and opening balances are excluded. |
| BR-09 | A credit card purchase is an expense on the charge date; repaying the card is not an expense. |
| BR-10 | A transaction date is a valid calendar date not later than today (Asia/Bangkok). |
| BR-11 | An account has at most one opening balance; only Cash, Loan Taken and Loan Given accounts can have one; it is dated and never counted as income. |
| BR-12 | Voided transactions are excluded from balances and summaries but stay in history, marked as voided. |
| BR-13 | A disabled user cannot log in, and their active sessions end immediately. |
| BR-14 | Account names are unique per user; archived accounts cannot be used in new transactions but keep their history; an account’s type and subtype cannot change after creation, and a subtype must be valid for its type. |
| BR-15 | Duplicate copies details only; the original is unchanged and the copy is saved only when submitted. |
| BR-16 | A Payment source must be a Cash or Loan Taken account; a Receipt source must be a Cash account. A source of any other type is rejected and nothing is saved. |

## 7. Non-functional requirements

| ID | Requirement (measurable) | Verification | Sprint |
|---|---|---|---|
| NFR-01 | Passwords are stored only as bcrypt hashes (cost ≥ 12); no plaintext in the database, logs or seed files. | API/DB test checks stored value is a bcrypt hash, not the password; code search | 1 |
| NFR-02 | Every API route except login and health rejects unauthenticated requests with 401 and no private data. | Automated test iterating the registered route list | 1 (re-run each sprint) |
| NFR-03 | Amounts are stored as integer satang; for every saved transaction the lines sum to the total and balances equal the sum of effects, with zero rounding error. | Unit tests plus DB integration invariant test | 1 (re-run in 2) |
| NFR-04 | Error responses use one JSON shape and never expose stack traces, SQL or file paths. | API test that forces a server error | 1 |
| NFR-05 | A fresh clone runs with seed data in at most 6 documented steps. | Manual run from a clean clone; Docker in Lab 5 | 1 |
| NFR-06 | Data survives an application restart and, once deployed, a redeployment. | Restart check locally; redeploy evidence in Lab 5 | 1, Lab 5 |
| NFR-07 | p95 latency ≤ 500 ms for balances, a 50-row history page and summaries with 10,000 transactions for one user. | Seeded timing script | 3 |
| NFR-08 | Every form shows field-level validation errors; every screen has loading, empty and error states; usable at 360 px width. | Playwright checks plus manual checklist | 1 (built screens), 3 (all) |
| NFR-09 | Service-layer line coverage ≥ 80%; lint, build and tests pass on every PR. | Coverage report; CI from Lab 5, local results before | 1 local, Lab 5 CI |
| NFR-10 | Login is limited to 10 failed attempts per 15 minutes per IP and email; sessions expire after 8 hours; state-changing requests require `application/json` and a matching `Origin`. Excess attempts return 429; expired sessions and failed origin/content-type checks are rejected without private data. | API tests for rate limiting, expired-session rejection and Origin/content-type checks | 1 |

## 8. Assumptions, decisions and open questions

| ID | Item | Resolution | Status |
|---|---|---|---|
| A-01 | Currency | THB only; no conversion | Decided |
| A-02 | Accounts for Sprint 1 | Seeded demo users and accounts are enough; account management arrives in Sprint 2 | Decided |
| A-03 | Dates | Calendar dates only, no time of day; server timezone Asia/Bangkok | Decided |
| A-04 | Administrator’s view of users | Email, display name, role, status and creation timestamp only; all financial data strictly excluded per principle of least privilege and BR-02 | Decided |
| D-01 | Categories | Income and Expense accounts act as categories; no separate category entity | Decided |
| D-02 | Overdraft and overpayment | Not blocked: cash may go negative and an overpaid card shows a credit balance, as real banks allow. Avoids fragile invariants when editing or voiding past transactions | Decided |
| D-03 | Other user’s record | Returns 404, not 403, so existence is not leaked | Decided |
| D-04 | Corrections | Edit and void only; transactions are never hard-deleted | Decided |
| D-05 | Opening balance | Modeled as its own transaction kind, so it can never be mistaken for income | Decided |
| D-06 | Administrator account creation | Allocated to Sprint 3 (F-17). Seeded accounts and enable/disable (F-02) fully support Sprint 1 and 2, reserving Sprint 2 capacity for core financial expansion and Labs 5–7 | Decided |
| D-07 | Stack | React, Express, PostgreSQL as a modular monolith | Decided |
