# F-04 Opening Balance: Engineering Contract

Requirements: FR-10; BR-04, BR-11, BR-14 · Depends on: F-03 · Contract version: 1.1 (see [version history](README.md#5-contract-version-history)) · Suggested branch: `feature/F-04-opening-balance`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Allow a user to record an initial opening balance for an existing asset or liability account (Cash, Loan Taken, or Loan Given) with an explicit calendar date, establishing the baseline amount without misclassifying it as income or expense.

**Workflow**

1. On the Dashboard (`/`), the user clicks "Set opening balance" on an eligible account card that does not yet have one.
2. The user inputs an amount (in THB, $\ge 0$) and a date ($\le$ today Bangkok time) in a modal dialog and submits.
3. The server authenticates the caller (`USER` role) and checks:
   - Target account exists and belongs to `session.userId`.
   - Target account is not archived (BR-14).
   - Target account type is `CASH`, `LOAN_TAKEN`, or `LOAN_GIVEN` (Income and Expense accounts are rejected).
   - Target account does not already possess an active opening balance.
4. The server creates a record in `transactions` with `kind = 'OPENING_BALANCE'`, `account_id = targetAccountId`, `total_amount = amount`, `txn_date = date`, and zero allocation lines.
5. The UI modal closes, the account card updates to reflect the new derived balance, and the "Set opening balance" action is replaced with opening balance details.

**Rules and validation**

- **BR-04 (Valid Amounts)**: Amount must be an integer satang value $\ge 0$ and $\le 10,000,000,000$ ($100,000,000.00\text{ THB}$). An opening balance is the only transaction kind permitted to have an amount of 0.
- **BR-10 (Calendar Date)**: Date must be a valid calendar date `YYYY-MM-DD` not later than today in Bangkok time (`Asia/Bangkok`).
- **BR-11 (Single Opening Balance & Allowed Account Types)**:
  - Only accounts of type `CASH`, `LOAN_TAKEN`, and `LOAN_GIVEN` can have an opening balance. Submissions for `INCOME` or `EXPENSE` accounts return `400 VALIDATION_ERROR`.
  - An account has at most one opening balance. A second submission returns `409 OPENING_BALANCE_EXISTS`.
- **Decision D-05**: Modeled as distinct transaction kind `OPENING_BALANCE`, ensuring it is excluded from income and expense summaries by construction (BR-08).
- **BR-01 (Ownership)**: Only the account owner may record an opening balance. Cross-user attempts return `404 NOT_FOUND`.
- **BR-14 (Archived Accounts)**: Archived accounts cannot be used in new transactions. Submissions for an archived account return `400 VALIDATION_ERROR` and save nothing; the Dashboard withholds the "Set opening balance" action on archived rows. Archived accounts keep their existing history (F-09 owns the lifecycle).

**Permissions:** User only. Administrator receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| POST /api/v1/accounts/:id/opening-balance | `{ "amount": 5000000, "date": "2026-11-01" }` | 201 `{ "transaction": { "id", "kind": "OPENING_BALANCE", "accountId", "txnDate", "totalAmount" } }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND; 409 OPENING_BALANCE_EXISTS; 415 UNSUPPORTED_MEDIA_TYPE |

- `amount`: integer satang, $\ge 0$.
- `date`: `YYYY-MM-DD`, $\le$ today Bangkok time.
- If `:id` is unknown or owned by another user: returns 404 NOT_FOUND.
- If the account is archived: returns 400 VALIDATION_ERROR.
- Ownership, archived, account-type, date and duplicate checks run in one database transaction with the insert, so a rejected request writes nothing.

### 2.2 UI

- **Dashboard Card**: Cards for Cash, Loan Taken, and Loan Given accounts without an opening balance render a "Set opening balance" button; archived accounts never render it.
- **Dialog / Modal**: Amount input with satang conversion, date picker defaulting to today (Bangkok). Inline validation displays error if amount is negative or date is future. An API 401 while saving redirects to `/login` (F-01 §2.2).
- **Post-Submission**: The dialog closes, the card balance updates immediately, and the button is replaced by text showing the recorded opening balance.

### 2.3 Data

- Stored in `transactions` with `kind = 'OPENING_BALANCE'`, `total_amount = amount`, `txn_date = date`, and `account_id = :id`. No rows created in `allocation_lines`. No new tables or migrations; uses the `transactions` table from the System-Level SDS.
- Database partial unique index:
  `CREATE UNIQUE INDEX unique_active_opening_balance ON transactions (account_id) WHERE kind = 'OPENING_BALANCE' AND voided_at IS NULL;`

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-04.1 | Setting a valid opening balance on a Cash account returns 201 and immediately increases its derived balance by that satang amount. |
| AC-04.2 | Setting a valid opening balance on a Loan Taken account returns 201 and establishes the outstanding debt baseline. |
| AC-04.3 | An opening balance of 0 satang is accepted and returns 201. |
| AC-04.4 | Submitting an opening balance on an account that already has one returns 409 OPENING_BALANCE_EXISTS and leaves the existing balance unchanged. |
| AC-04.5 | Submitting an opening balance on an Income or Expense account returns 400 VALIDATION_ERROR. |
| AC-04.6 | Specifying a date in the future (Bangkok time) returns 400 FUTURE_DATE_NOT_ALLOWED. |
| AC-04.7 | Negative amounts or amounts exceeding $100,000,000.00\text{ THB}$ return 400 VALIDATION_ERROR. |
| AC-04.8 | Attempting to set an opening balance on another user’s account returns 404 NOT_FOUND; Administrator caller receives 403 FORBIDDEN; anonymous receives 401. |
| AC-04.9 | Setting a valid opening balance on a Loan Given account returns 201 and establishes the amount owed to the user baseline. |
| AC-04.10 | Submitting an opening balance on an archived account returns 400 VALIDATION_ERROR and saves nothing; the Dashboard withholds the "Set opening balance" action on archived rows (BR-14). |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-04.1** | AC-04.1 | A | Seeded database; Alice logged in; Bank Account has 0 balance | POST `/api/v1/accounts/{bankId}/opening-balance` with `{ amount: 5000000, date: "2026-11-01" }` | 201 Created; GET `/api/v1/accounts` shows Bank Account balance `5000000` ($50,000.00\text{ THB}$). |
| **TEST-04.2** | AC-04.2 | A | Seeded database; Alice logged in; Credit Card has 0 balance | POST `/api/v1/accounts/{cardId}/opening-balance` with `{ amount: 1500000, date: "2026-11-01" }` | 201 Created; GET `/api/v1/accounts` shows Credit Card debt `1500000` ($15,000.00\text{ THB}$). |
| **TEST-04.3** | AC-04.3 | U, A | Seeded database; Alice logged in; Wallet has 0 balance | POST `/api/v1/accounts/{walletId}/opening-balance` with `{ amount: 0, date: "2026-11-01" }` | 201 Created; Wallet balance remains 0; opening balance transaction recorded. |
| **TEST-04.4** | AC-04.4 | A | Bank Account already has opening balance (TEST-04.1) | Submit second opening balance with `{ amount: 1000000, date: "2026-11-02" }` | 409 OPENING_BALANCE_EXISTS; database retains original $50,000.00\text{ THB}$ opening balance. |
| **TEST-04.5** | AC-04.5 | A | Alice logged in; Salary account (`INCOME`) | POST opening balance to Salary account | 400 VALIDATION_ERROR; no transaction created. |
| **TEST-04.6** | AC-04.6 | U, A | Alice logged in; Bank Account | POST opening balance with date tomorrow (Bangkok time) | 400 FUTURE_DATE_NOT_ALLOWED; nothing saved. |
| **TEST-04.7** | AC-04.7 | A | Alice logged in | POST opening balance with `{ amount: -100 }` and `{ amount: 10000000001 }` | 400 VALIDATION_ERROR for both requests. |
| **TEST-04.8** | AC-04.8 | A | Bob logged in; Alice’s Bank Account ID | Bob calls POST opening balance on Alice’s bank; Admin calls it; anonymous calls it | Bob receives 404 NOT_FOUND; Admin receives 403 FORBIDDEN; Anonymous receives 401 UNAUTHENTICATED. Alice's account unchanged. |
| **TEST-04.9** | AC-04.9 | A | Seeded database; Alice logged in; Loan Given account has 0 balance | POST `/api/v1/accounts/{loanGivenId}/opening-balance` with `{ amount: 2000000, date: "2026-11-01" }` | 201 Created; GET `/api/v1/accounts` shows the Loan Given balance `2000000` ($20,000.00\text{ THB}$). |
| **TEST-04.10** | AC-04.10 | A, E | Seeded database; Alice logged in; Wallet archived directly in the database | API: POST `/api/v1/accounts/{walletId}/opening-balance` with `{ amount: 100000, date: "2026-11-01" }`. E2E: load the Dashboard while Wallet is archived | API: 400 VALIDATION_ERROR, no transaction created. E2E: Wallet row is visible but has no "Set opening balance" action, while an active account still does. |

---

## 5. Definition of done (F-04)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-04.4 (duplicate prevention), AC-04.5 (account type restriction) and AC-04.10 (archived accounts).
- Opening balance integration with balance derivation is verified via F-03 integration suite.
- Product Definition of Done in [README.md](README.md) is met.
