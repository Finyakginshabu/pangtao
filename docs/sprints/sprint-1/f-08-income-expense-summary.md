# F-08 Income and Expense Summary: Engineering Contract

Requirements: FR-22; BR-01, BR-08, BR-09 · Depends on: F-05, F-06 · Contract version: 1.0 · Suggested branch: `feature/F-08-income-expense-summary`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Provide users with aggregated financial totals for a specified date range (defaulting to the current calendar month), calculating total income, total expenses, and net savings ($Net = Income - Expenses$). Ensures strict compliance with accounting rules by counting only lines targeting Income or Expense accounts, while completely excluding debt repayments, transfers, borrowing, and opening balances.

**Workflow**

1. The user navigates to `/summary` or views the summary widget on the Dashboard (`/`).
2. The UI requests `GET /api/v1/summary/income-expense?from=YYYY-MM-DD&to=YYYY-MM-DD` (defaulting to the first and last day of the current month in Bangkok time).
3. The server authenticates the caller (`USER` role) and executes the summary engine over the user's non-voided transactions within the date window:
   - **Income**: Sum of allocation lines targeting accounts of type `INCOME`.
   - **Expense**: Sum of allocation lines targeting accounts of type `EXPENSE`.
   - **Net**: $\text{Income} - \text{Expense}$.
4. The server returns the calculated totals in integer satang.
5. The UI displays metric cards for Total Income, Total Expenses, and Net, formatted in Thai Baht.

**Rules and validation**

- **BR-08 (Exclusive Summary Classification)**:
  - Income counts **only** allocation lines where `target_account.type == 'INCOME'`.
  - Expenses count **only** allocation lines where `target_account.type == 'EXPENSE'`.
  - Debt repayments (Cash $\rightarrow$ Loan Taken), transfers, loans, and opening balances are **strictly excluded**.
- **BR-09 (Credit Card Rules)**:
  - A card charge is counted as an expense on its transaction date.
  - Paying down a credit card balance from cash is a debt repayment, **not** an expense.
- **BR-01 (Ownership Isolation)**: Only the authenticated user's transactions are aggregated.
- Date parameters must be valid ISO `YYYY-MM-DD` strings. If `from > to`, server returns `400 VALIDATION_ERROR`.

**Permissions:** User only. Administrator receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET /api/v1/summary/income-expense?from&to | query params: `from=YYYY-MM-DD`, `to=YYYY-MM-DD` | 200 `{ from, to, income, expense, net }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN |

- `income`, `expense`, and `net` are returned as integer satang.
- When `from` or `to` are omitted, server defaults to the current month: `from` = 1st of current month, `to` = today (or last day of month) in Bangkok time.

### 2.2 UI

- **Screen (`/summary`)**:
  - Date Range Picker (presets: "This Month", "Last Month", "Custom").
  - Summary Metric Cards:
    - **Total Income**: Green accent badge (e.g. `+30,000.00 ฿`).
    - **Total Expenses**: Red/Orange accent badge (e.g. `1,200.00 ฿`).
    - **Net Savings**: Signed value with label (e.g. `+28,800.00 ฿` or `-500.00 ฿`).
- **Shared States**: Skeleton metric cards, zero-state for empty date ranges (`0.00 ฿`), and error banner with Retry.

### 2.3 Data

- Aggregated via SQL over `allocation_lines` joined to `accounts` (filtering by account type) and `transactions` (filtering by `user_id`, date range, and `voided_at IS NULL`). No new tables or migrations; uses the schema defined in the System-Level SDS.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-08.1 | Querying the summary endpoint with a valid date range returns accurate `income`, `expense`, and `net` figures in integer satang. |
| AC-08.2 | Salary receipts are included in income; credit card charges are included in expenses on their charge date. |
| AC-08.3 | Opening balances and credit card repayments are excluded from both income and expenses (BR-08, BR-09). |
| AC-08.4 | Voided transactions within the date range are completely ignored by the summary calculation. |
| AC-08.5 | If `from` date is after `to` date, or if dates are malformed, returns 400 VALIDATION_ERROR. |
| AC-08.6 | An Administrator receives 403 FORBIDDEN and an anonymous caller receives 401 UNAUTHENTICATED. |
| AC-08.7 | In the browser, the summary page renders correct income, expense, and net figures for the demo dataset, and updates dynamically when the date range is adjusted. |
| AC-08.8 | Omitting `from` and `to` defaults to the current calendar month in Asia/Bangkok and returns the same totals as an explicit request for that month. |
| AC-08.9 | A User’s summary includes only that user’s transactions; another user’s transactions never affect the totals (BR-01). |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-08.1** | AC-08.1, AC-08.2 | A | Alice's seeded accounts plus the four-transaction demo fixture:<br>- Opening balance: 50,000.00 THB (dated Nov 1)<br>- Salary receipt: 30,000.00 THB (dated Nov 2)<br>- Card charge: 1,200.00 THB (dated Nov 3)<br>- Card repayment: 800.00 THB (dated Nov 4) | GET `/api/v1/summary/income-expense?from=2026-11-01&to=2026-11-30` | 200 OK;<br>- `income`: `3000000` ($30,000.00\text{ THB}$)<br>- `expense`: `120000` ($1,200.00\text{ THB}$)<br>- `net`: `2880000` ($28,800.00\text{ THB}$). |
| **TEST-08.2** | AC-08.3 | U, A | The demo dataset in TEST-08.1 | Verify exclusion of opening balance ($50,000$) and card repayment ($800$) | Neither amount appears in `income` or `expense`. Income is exactly $30,000.00$ and Expense is exactly $1,200.00$. |
| **TEST-08.3** | AC-08.4 | A | Alice has transactions in range, plus one voided expense of 5,000.00 THB | GET `/api/v1/summary/income-expense?from=2026-11-01&to=2026-11-30` | Expense total remains 1,200.00 THB; voided transaction is excluded. |
| **TEST-08.4** | AC-08.5 | A | Alice logged in | GET summary with `from=2026-11-30&to=2026-11-01`; GET summary with `from=bad-date` | Both return 400 VALIDATION_ERROR. |
| **TEST-08.5** | AC-08.6 | A | Admin logged in | Admin calls GET `/api/v1/summary/income-expense` | 403 FORBIDDEN; no financial totals returned. |
| **TEST-08.6** | AC-08.3 | U | Pure unit test for summary aggregation logic | Feed mock allocation rows targeting Income, Expense, Loan Taken, and Cash | Output matches expected sum; non-P&L lines filtered with 100% accuracy. |
| **TEST-08.7** | AC-08.7 | E | Alice logged in with demo dataset | Open `/summary` in browser; inspect rendered cards | Income displays `+30,000.00 ฿`; Expenses display `1,200.00 ฿`; Net displays `+28,800.00 ฿`. Changing date filter triggers re-fetch. |
| **TEST-08.8** | AC-08.8 | A | Alice logged in; demo dataset; server clock fixed to 2026-11-15 Asia/Bangkok | GET `/api/v1/summary/income-expense` with no `from` or `to` | 200 OK; defaults to 2026-11-01 through 2026-11-30 and returns the same totals as TEST-08.1. |
| **TEST-08.9** | AC-08.9 | A | Bob logged in; Alice has the demo dataset | Bob calls `GET /api/v1/summary/income-expense?from=2026-11-01&to=2026-11-30` | 200 OK with Bob's own totals only (income 0, expense 0, net 0); no Alice data is returned. |

---

## 5. Definition of done (F-08)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-08.3 (repayment exclusion from expenses).
- Accounting invariant verified: Net equals Income minus Expense to the exact satang.
- Product Definition of Done in [README.md](README.md) is met.

