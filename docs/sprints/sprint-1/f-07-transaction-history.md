# F-07 Transaction History: Engineering Contract

Requirements: FR-17, FR-25; BR-01 · Depends on: F-05, F-06 · Contract version: 1.1 (see [version history](README.md#5-contract-version-history)) · Suggested branch: `feature/F-07-transaction-history`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Allow users to inspect a complete chronological log of their financial transactions in newest-first order, paginated, displaying transaction metadata (date, kind, source account, total amount, memo) and individual allocation lines.

**Workflow**

1. The user navigates to `/transactions`.
2. The UI calls `GET /api/v1/transactions?limit=50&offset=0`.
3. The server authenticates the caller (`USER` role) and queries the user's non-voided transactions ordered by `txn_date DESC, created_at DESC`.
4. The response includes the paginated list with total count and nested allocation lines.
5. The user can click an entry to open `/transactions/:id` for detailed line inspection.

**Rules and validation**

- **BR-01 (Ownership Isolation)**: The transaction query filters strictly by `session.userId`. Transactions belonging to other users are never returned. Directly querying another user's transaction ID returns `404 NOT_FOUND`.
- **Pagination**: Default limit is 50, maximum limit is 100. Offset must be $\ge 0$. Exceeding limit returns `400 VALIDATION_ERROR`.
- **Chronological Ordering**: Transactions are ordered primarily by `txn_date DESC`, and secondarily by `created_at DESC`.
- **Voided transactions (BR-12)**: History lists non-voided transactions only in Sprint 1, because nothing can void a transaction until F-13 (Edit and void, Sprint 2). F-13 owns BR-12 and extends this list to show voided transactions marked as voided.
- Amounts in the API are integer satang; UI renders formatted Thai Baht.

**Permissions:** User only. Administrator receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET /api/v1/transactions?limit&offset | none | 200 `{ items: [ { id, kind, accountId, accountName, txnDate, totalAmount, memo, lines: [ { id, targetAccountId, targetAccountName, amount, note } ] } ], total, limit, offset }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN |
| GET /api/v1/transactions/:id | none | 200 `{ transaction: { id, kind, accountId, accountName, txnDate, totalAmount, memo, lines } }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND |

### 2.2 UI

- **Screen (`/transactions`)**: Table or list of transactions displaying Date, Source Account, Kind badge (Payment / Receipt / Opening Balance), Memo, Total Amount, and expandable allocation lines.
- **Pagination Controls**: Previous/Next page controls, page size selector, and item counter (e.g. "Showing 1–4 of 4").
- **Shared States**: Skeleton rows during fetch, empty-state illustration ("No transactions recorded yet. Record your first transaction"), and error banner with Retry button.

### 2.3 Data

- Queries `transactions` joined with `accounts` (source name) and `allocation_lines` joined with `accounts` (target name). No new tables or migrations; uses the schema defined in the System-Level SDS.
- Supported by the database index `transactions_user_id_txn_date_created_at_idx` on `transactions (user_id, txn_date DESC, created_at DESC)`, created by F-03 migration `20261111213027_accounts_ledger`.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-07.1 | Querying `GET /api/v1/transactions` returns a user's transactions ordered newest-first with correct totals, account names, and nested allocation lines. |
| AC-07.2 | Pagination functions correctly: submitting `limit` and `offset` returns the appropriate slice and accurate `total` count. |
| AC-07.3 | Querying a specific transaction by ID via `GET /api/v1/transactions/:id` returns its complete details. |
| AC-07.4 | Attempting to access a transaction ID belonging to another user returns 404 NOT_FOUND (no data leakage). |
| AC-07.5 | An Administrator calling transaction history endpoints receives 403 FORBIDDEN; anonymous caller receives 401 UNAUTHENTICATED. |
| AC-07.6 | In the browser, the history screen displays all 4 demo transactions with correct formatted amounts, expandable split lines, and handles empty and error states. |
| AC-07.7 | A negative `offset` or a `limit` above 100 returns 400 VALIDATION_ERROR and no items. |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-07.1** | AC-07.1 | A | Alice has 4 demo transactions recorded (opening balance, salary receipt, credit card purchase, card repayment) | GET `/api/v1/transactions` | 200 OK; array of 4 transactions ordered with newest date first; each item contains nested lines with target account names. |
| **TEST-07.2** | AC-07.2 | A | Alice has 4 transactions | GET `/api/v1/transactions?limit=2&offset=2` | 200 OK; returns items 3 and 4; `total: 4`, `limit: 2`, `offset: 2`. Submitting `limit=101` returns 400 VALIDATION_ERROR. |
| **TEST-07.3** | AC-07.3 | A | Alice has transaction `txn-card-charge` | GET `/api/v1/transactions/{txn-card-charge}` | 200 OK; returns single transaction object with 2 allocation lines (Dining and Groceries). |
| **TEST-07.4** | AC-07.4 | A | Bob logged in; Alice has transaction `txn-alice-salary` | Bob calls `GET /api/v1/transactions/{txn-alice-salary}` | 404 NOT_FOUND; zero transaction details returned. |
| **TEST-07.5** | AC-07.5 | A | Admin logged in | Admin calls `GET /api/v1/transactions` | 403 FORBIDDEN; no transaction records returned. |
| **TEST-07.6** | AC-07.6 | E | Alice logged in with 4 transactions | Open `/transactions` in browser; click on multi-line card purchase row | History table renders 4 rows; card purchase expands to reveal Dining 700.00 ฿ and Groceries 500.00 ฿ lines. |
| **TEST-07.7** | AC-07.5 | A | Seeded database; no session cookie | Anonymous calls `GET /api/v1/transactions` and `GET /api/v1/transactions/{txn-card-charge}` | Both return 401 UNAUTHENTICATED; zero records returned. |
| **TEST-07.8** | AC-07.7 | A | Alice logged in | GET `/api/v1/transactions?offset=-1`; then GET `/api/v1/transactions?limit=101` | Each returns 400 VALIDATION_ERROR; no items returned. |
| **TEST-07.9** | AC-07.6 | E | Alice logged in | Open `/transactions` with no transactions recorded; then open it while the history request fails, and press Retry once it succeeds | The empty state shows "No transactions recorded yet"; the failed request shows the error banner with a Retry button, and Retry renders the history. |

---

## 5. Definition of done (F-07)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-07.4 (cross-user access isolation).
- TEST-07.4 also discharges F-01 AC-01.9 / TEST-01.9, whose verification moved here in f-01 v1.1.
- Query performance verified: index `transactions_user_id_txn_date_created_at_idx` utilized in query execution plan.
- Product Definition of Done in [README.md](README.md) is met.

