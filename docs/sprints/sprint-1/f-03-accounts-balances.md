# F-03 Accounts and Balances: Engineering Contract

Requirements: FR-08; BR-01, BR-07; NFR-03 · Depends on: F-01 · Contract version: 1.0 · Suggested branch: `feature/F-03-accounts-balances`

Shared conventions, error codes and the Product Definition of Done are in [README.md](README.md).

---

## 1. Feature design

**Purpose.** Provide authenticated users with a comprehensive overview of their accounts and exact current balances derived dynamically by a centralized balance engine from non-voided transactions and allocation lines, ensuring zero data drift and strict integer-satang arithmetic.

**Workflow**

1. The User navigates to the Dashboard (`/`).
2. The UI requests `GET /api/v1/accounts`.
3. The server authenticates the caller (`USER` role) and executes the balance engine against all non-voided transactions and allocation lines belonging to `session.userId`.
4. Balances are calculated per account type:
   - **Cash Accounts**:
     $$\text{Balance} = \text{Opening} + \sum \text{Receipts (Source)} - \sum \text{Payments (Source)} + \sum \text{Transfers In} - \sum \text{Transfers Out}$$
   - **Loan Taken Accounts (Debt)**:
     $$\text{Balance (Debt)} = \text{Opening} + \sum \text{Card Charges (Source)} + \sum \text{Borrowing Lines} - \sum \text{Repayment Lines}$$
   - **Loan Given Accounts (Owed to User)**:
     $$\text{Balance (Owed)} = \text{Opening} + \sum \text{Lending Lines} - \sum \text{Repayment Received Lines}$$
   - **Income Accounts**:
     $$\text{Total} = \sum \text{Receipt Lines targeting this account}$$
   - **Expense Accounts**:
     $$\text{Total} = \sum \text{Payment Lines targeting this account}$$
5. The API returns accounts organized with their computed integer-satang balance and opening balance metadata.
6. The UI groups accounts into sections (Cash, Debts, Owed to Me) and formats amounts in THB.

**Rules and validation**

- **BR-01 (Ownership Isolation)**: Only accounts belonging to the authenticated user are returned. Accessing another user's account returns `404 NOT_FOUND`.
- **BR-07 (Derived Balances)**: Balances are never statically stored in an `account.balance` column. They are derived purely from transaction events. Voided transactions (`voided_at IS NOT NULL`) are strictly excluded.
- **NFR-03 (Exact Satang Arithmetic)**: All calculations occur in integer satang ($1\text{ THB} = 100\text{ satang}$). No floating-point operations.
- **Decision D-02**: Negative balances are permitted (e.g. overdrawn cash or overpaid credit card) and rendered clearly with an explicit minus sign and a "Negative balance" label.
- Accounts are returned in deterministic order: `CASH`, `LOAN_TAKEN`, `LOAN_GIVEN`, `INCOME`, `EXPENSE`, then alphabetically by account name.

**Permissions:** User only. Administrator receives 403, anonymous receives 401.

---

## 2. Specifications

### 2.1 API

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| GET /api/v1/accounts | none | 200 `{ items: [ { id, name, type, subtype, isArchived, balance, openingBalance } ] }` | 401 UNAUTHENTICATED; 403 FORBIDDEN |

- `balance`: integer satang.
- `openingBalance`: `null` or `{ transactionId, amount, date }`. (Always `null` for Income and Expense accounts).

### 2.2 UI

- **Dashboard Screen (`/`)**: Displays categorized balance cards:
  - **Cash**: Wallets and bank accounts.
  - **Debts (Loan Taken)**: Outstanding credit card balances.
  - **Owed to Me (Loan Given)**: Personal loans given out.
- **Formatting**: Currency shown as `12,345.67 ฿`. Negative values show `-1,234.50 ฿` with text label.
- **Shared States**: Skeleton cards during loading, empty-state placeholder in sections without accounts, and an error banner with Retry button.

### 2.3 Data

- Table `accounts` as defined in System-Level SDS. Migration `0002_accounts`.
- Seed data for Alice and Bob:
  - Cash: Wallet (`WALLET`), Bank Account (`BANK`).
  - Loan Taken: Credit Card (`CREDIT_CARD`).
  - Income: Salary, Interest Earned.
  - Expense: Dining, Groceries, Electricity, Telecom.

---

## 3. Acceptance criteria

| AC | Observable outcome |
|---|---|
| AC-03.1 | Querying `GET /api/v1/accounts` for a newly seeded user returns exactly their nine accounts in specified order, with `balance = 0` and `openingBalance = null`, and zero accounts belonging to other users. |
| AC-03.2 | An anonymous caller receives 401 UNAUTHENTICATED and an Administrator receives 403 FORBIDDEN, with no account data returned. |
| AC-03.3 | The balance engine accurately calculates balances for opening balance, salary receipt, credit card purchase, and card repayment, while strictly ignoring voided transactions. |
| AC-03.4 | Invariant holds to the exact satang: across any combination of transactions, total net worth ($\text{Cash} + \text{Loan Given} - \text{Debt}$) equals total opening balances plus total income minus total expenses (NFR-03). |
| AC-03.5 | An in-memory pure calculation function and a production SQL aggregation query produce identical balance figures for the same ledger dataset. |
| AC-03.6 | In the browser, the Dashboard renders grouped accounts with formatted THB figures, negative balance alerts when applicable, loading skeletons, and error retry states. |

---

## 4. Software test specification

| Test | AC | Level | Precondition and input | Action | Expected result |
|---|---|---|---|---|---|
| **TEST-03.1** | AC-03.1 | A | Seeded database; Alice logged in | GET `/api/v1/accounts` | 200 OK; array of 9 accounts; type ordering Cash $\rightarrow$ Loan Taken $\rightarrow$ Loan Given $\rightarrow$ Income $\rightarrow$ Expense; all `balance: 0`; none belong to Bob. |
| **TEST-03.2** | AC-03.2 | A | Seeded database; Admin logged in | GET `/api/v1/accounts` anonymously and as Admin | Anonymous: 401 UNAUTHENTICATED; Admin: 403 FORBIDDEN; zero account data exposed. |
| **TEST-03.3** | AC-03.3 | U, A | Ledger events for Alice:<br>1. Bank opening: 50,000.00 THB<br>2. Receipt into Bank from Salary: 30,000.00 THB<br>3. Card charge: 1,200.00 THB (Dining 700.00, Groceries 500.00)<br>4. Payment from Bank to Card: 800.00 THB<br>5. Voided payment from Bank: 5,000.00 THB | Compute derived balances via engine | Bank: `7920000` (79,200.00 THB); Credit Card debt: `40000` (400.00 THB); Salary: `3000000` (30,000.00 THB); Dining: `70000` (700.00 THB); Groceries: `50000` (500.00 THB); voided payment has zero balance impact. |
| **TEST-03.4** | AC-03.4 | U, A | Database loaded with TEST-03.3 events | Read all account balances and compute accounting invariant | Net worth ($79,200 - 400 = 78,800.00\text{ THB}$) equals Openings ($50,000.00$) + Income ($30,000.00$) - Expenses ($1,200.00$) $= 78,800.00\text{ THB}$ with zero satang discrepancy. |
| **TEST-03.5** | AC-03.5 | A | Arbitrary seeded transaction mix in PostgreSQL | Query balances via SQL aggregation query and compare against pure service calculation | Output balances match exactly on every account. |
| **TEST-03.6** | AC-03.6 | E | Seeded database; Alice logged in | Open Dashboard in browser; simulate API error; inspect rendered sections | Dashboard renders Cash, Debts, and Owed-to-Me cards with `0.00 ฿`; simulated error shows banner with Retry button; empty sections display placeholder text. |

---

## 5. Definition of done (F-03)

- Every AC above has an executed automated test with results documented.
- Failing-first evidence is retained for AC-03.3 and AC-03.4.
- Pure engine is unit tested without database dependencies; invariant check is re-run during sprint staging integration.
- Product Definition of Done in [README.md](README.md) is met.

