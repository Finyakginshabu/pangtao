# Pangtao (Personal Money and Expense Logging System)

Pangtao is a full-stack personal finance and ledger web application built for **CPE 334 (Semester 1/2026)** under **Theme 7: Personal Money and Expense Logging System**.

It provides individual users with isolated, private double-entry accounting: tracking cash, bank balances, credit card debt, income, and expenses with strict satang-level precision and derived balances.

---

## Architecture & Tech Stack

* **Frontend**: React 18, TypeScript, Vite, React Router, TanStack Query.
* **Backend**: Node.js 20 or later, Express, TypeScript, Zod schema validation.
* **Database & ORM**: PostgreSQL 16, Prisma ORM with managed SQL migrations.
* **Security & Auth**: HTTP-only session cookies, SHA-256 session token hashing, bcrypt password hashing (cost 12), default-deny role authorization (`USER`, `ADMIN`), and CSRF protection.
* **Testing**: Vitest + Supertest (unit & API integration) and Playwright (end-to-end browser journeys).

---

## 6-Step Quickstart Guide (NFR-05)

Follow these 6 steps to run the application and seed the synthetic demo users on a clean environment:

1. **Install dependencies**:
   ```powershell
   npm install
   ```

2. **Configure environment variables**:
   ```powershell
   cp .env.example .env
   ```
   Then open `.env` and set `SEED_DEFAULT_PASSWORD` to a password of your choice (it is required; the seed script and tests stop with an error if it is empty). `.env` is git-ignored, so the value never reaches the repository.

3. **Start PostgreSQL database** (via Docker):
   ```powershell
   docker compose up -d
   ```

4. **Run database migrations**:
   ```powershell
   npm run db:migrate
   ```

5. **Seed the synthetic users** (admin, alice, bob):
   ```powershell
   npm run db:seed
   ```

6. **Start development servers**:
   * **Backend API** (port 8080):
     ```powershell
     npm run dev:server
     ```
   * **Frontend UI** (port 3000):
     ```powershell
     npm run dev:web
     ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Seeded Demo Accounts

The seed script creates three deterministic synthetic **users**. All of them log in with the `SEED_DEFAULT_PASSWORD` value you set in `.env`. Alice and Bob each get nine financial accounts (Wallet, Bank Account, Credit Card, Salary, Interest Earned, Dining, Groceries, Electricity, Telecom) with no transactions. The Administrator has no financial accounts.

| Email | Role | Permissions / Accessible Views |
|---|---|---|
| `alice@example.test` | `USER` | Private user ledger, Dashboard, Transactions, Summary |
| `bob@example.test` | `USER` | Independent private user ledger (tenant-isolated from Alice) |
| `admin@example.test` | `ADMIN` | User account administration (`/admin/users`), strictly excluded from financial records |

---

## Verification & Automated Test Commands

Tests need PostgreSQL running (`docker compose up -d`). No app server needs to be started for unit and API tests.

* **Run all Unit and API Integration tests** (Supertest + Vitest):
  ```powershell
  npm test
  ```
  API tests run against a separate database, `<your DATABASE_URL database>_test` (e.g. `pangtao_db_test`), which is created and migrated automatically, so your development data is never touched. Override it with `TEST_DATABASE_URL` if needed; its name must end in `_test`. Test files run one at a time because each one resets that database. Other variants: `npm run test:unit`, `npm run test:api`, `npm run test:watch`.

* **Run Playwright End-to-End browser tests** (starts both dev servers automatically and uses the seeded development database, so run `npm run db:seed` first):
  ```powershell
  npx playwright test
  ```

* **Type-check TypeScript**:
  ```powershell
  npx tsc --noEmit -p server/tsconfig.json
  npx tsc --noEmit -p web/tsconfig.json
  ```

* **Lint** (zero warnings allowed) and **coverage** (NFR-09, ≥ 80%):
  ```powershell
  npm run lint
  npm run test:coverage
  ```

* **Run everything before opening a PR** (lint, type-check, tests with coverage, build, end-to-end; stops at the first failure):
  ```powershell
  npm run verify
  ```
