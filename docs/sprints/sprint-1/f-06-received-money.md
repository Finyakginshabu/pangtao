# F-06 Received Money: Engineering Contract

Requirements: FR-13; BR-04, BR-05, BR-06, BR-07, BR-10 · Depends on: F-03 · Contract version: 1.0 · Suggested branch: `feature/F-06-received-money`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Allow users to record income and funds received into a Cash account (Wallet or Bank Account), split across one or more allocation lines (Income accounts), atomically updating the receiving account's cash balance and the income account totals.

**Workflow**

1. The user navigates to `/transactions/new` and selects the "Receive" tab.
2. The user chooses a receiving Cash account (e.g. Bank Account), calendar date, total amount received, and optional memo.
3. The user adds one or more allocation lines specifying target Income accounts (e.g. Salary, Interest Earned) and their respective amounts.
4. The UI displays the remaining unallocated balance; the submit button is disabled until lines sum exactly to the total amount.
5. On submit, the server validates the payload, ensures the receiving account is `CASH`, ensures target accounts are `INCOME`, verifies the line sum invariant, and persists the record atomically.
6. The user is redirected to Transaction History or Dashboard with updated balances.

**Rules and validation**

- **BR-04 (Positive Satang Amounts)**: Total and line amounts must be positive integer satang $\le 10,000,000,000$ ($100,000,000.00\text{ THB}$).
- **BR-05 (Line Sum Invariant)**: Must have $\ge 1$ allocation line; line amounts must sum exactly to `totalAmount`. Any discrepancy returns `400 VALIDATION_ERROR` with code `INVALID_ALLOCATION_SUM`.
- **BR-06 (Allowed Target Matrix in Sprint 1)**:
  - Source account must be of type `CASH`.
  - Target accounts in Sprint 1 must be of type `INCOME`. (Targeting loan accounts or other cash accounts is introduced in Sprint 2).
  - Target account cannot equal the receiving source account.
  - Accounts must belong to the session user and not be archived.
- **BR-07 (Atomic Balance Effects)**:
  - Receiving Cash account balance increases by `totalAmount`.
  - Each target Income account total increases by its respective line amount.
  - Counted as income in period summaries (BR-08).
- **BR-10 (Calendar Date)**: Date must be a valid date $\le$ today in Bangkok time.

**Permissions:** User only. Administrator receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| POST /api/v1/transactions | `{ kind: "RECEIPT", accountId, txnDate, totalAmount, memo?, lines: [ { targetAccountId, amount, note? } ] }` | 201 `{ transaction: { id, kind, accountId, txnDate, totalAmount, memo, lines } }` | 400 VALIDATION_ERROR; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND |

- When lines do not sum to total: returns 400 with code `INVALID_ALLOCATION_SUM`.
- When receiving account is not Cash: returns 400 with code `INVALID_SOURCE_ACCOUNT`.
- When target account is not Income in Sprint 1: returns 400 with code `INVALID_TARGET_ACCOUNT`.
- When any account belongs to another user: returns 404 NOT_FOUND.

### 2.2 UI

- **Screen (`/transactions/new`)**: Receive tab. Source account dropdown filtered strictly to Cash accounts (Wallet, Bank Account).
- **Line Editor**: Add/remove lines selecting from user's Income accounts. Live indicator shows "Remaining to allocate".
- **Validation Feedback**: Client validation blocks submission if remaining is non-zero. Server validation errors displayed in form field alerts.

### 2.3 Data

- Stored in `transactions` (`kind = 'RECEIPT'`) and `allocation_lines` tables. Cascade delete from transaction to lines.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-06.1 | Submitting a valid receipt into a Cash account allocated to an Income account returns 201, increases the Cash balance by the total, and increases the Income total by the line amount. |
| AC-06.2 | Submitting a multi-line receipt split across multiple Income accounts returns 201 and updates each Income account correctly. |
| AC-06.3 | If allocation lines do not sum to `totalAmount`, request returns 400 INVALID_ALLOCATION_SUM and nothing is saved. |
| AC-06.4 | Submitting a receipt where source account is a Credit Card (`LOAN_TAKEN`) or Expense account returns 400 INVALID_SOURCE_ACCOUNT. |
| AC-06.5 | Submitting a receipt targeting an Expense account in Sprint 1 returns 400 INVALID_TARGET_ACCOUNT. |
| AC-06.6 | Setting a future transaction date returns 400 VALIDATION_ERROR (`FUTURE_DATE_NOT_ALLOWED`). |
| AC-06.7 | Attempting to receive money into an account owned by another user returns 404 NOT_FOUND. |
| AC-06.8 | In the browser, user submits a salary receipt, observes form calculations, and verifies updated Cash balance on the Dashboard. |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-06.1** | AC-06.1 | A | Alice logged in; Bank balance 50,000.00 THB; Salary total 0 | POST `/api/v1/transactions` (kind: RECEIPT, source: Bank, total: 30,000.00 THB, lines: Salary 30,000.00 THB) | 201 Created; GET `/api/v1/accounts` shows Bank balance 80,000.00 THB; Salary total 30,000.00 THB. |
| **TEST-06.2** | AC-06.2 | A | Alice logged in; Wallet balance 0 | POST `/api/v1/transactions` (kind: RECEIPT, source: Wallet, total: 10,500.00 THB, lines: Salary 10,000.00 THB, Interest Earned 500.00 THB) | 201 Created; Wallet balance 10,500.00 THB; Salary and Interest accounts both updated. |
| **TEST-06.3** | AC-06.3 | U, A | Alice logged in | POST `/api/v1/transactions` (kind: RECEIPT, total: 5,000.00 THB, lines: Salary 4,000.00 THB) | 400 VALIDATION_ERROR (`INVALID_ALLOCATION_SUM`); zero records created. |
| **TEST-06.4** | AC-06.4 | A | Alice logged in; Credit Card account ID | POST `/api/v1/transactions` (kind: RECEIPT, source: Credit Card, total: 1,000.00 THB, lines: Salary 1,000.00 THB) | 400 VALIDATION_ERROR (`INVALID_SOURCE_ACCOUNT`); nothing saved. |
| **TEST-06.5** | AC-06.5 | A | Alice logged in; Bank source | POST `/api/v1/transactions` (kind: RECEIPT, source: Bank, total: 1,000.00 THB, lines: Dining 1,000.00 THB) | 400 VALIDATION_ERROR (`INVALID_TARGET_ACCOUNT`); nothing saved. |
| **TEST-06.6** | AC-06.6 | A | Alice logged in | POST `/api/v1/transactions` with tomorrow's date | 400 VALIDATION_ERROR (`FUTURE_DATE_NOT_ALLOWED`). |
| **TEST-06.7** | AC-06.7 | A | Bob logged in; Alice's Bank Account ID | Bob sends POST `/api/v1/transactions` (kind: RECEIPT, source: Alice's Bank, total: 5,000.00 THB) | 404 NOT_FOUND; Alice's account unchanged. |
| **TEST-06.8** | AC-06.8 | E | Alice logged in | In browser, open `/transactions/new`, click Receive tab, choose Bank Account, enter 30,000.00 THB, select Salary, submit | Form submits, redirects; Dashboard shows Bank Account increased by 30,000.00 THB. |

---

## 5. Definition of done (F-06)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-06.3 (line sum mismatch) and AC-06.4 (invalid source type).
- Transaction rollback verified: any validation error aborts the entire database transaction cleanly.
- Product Definition of Done in [README.md](README.md) is met.

