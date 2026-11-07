# Pangtao (Personal Money and Expense Logging System)

Pangtao is a full-stack personal finance and ledger web application built for **CPE 334 (Semester 1/2026)** under **Theme 7: Personal Money and Expense Logging System**.

It provides individual users with isolated, private double-entry accounting: tracking cash, bank balances, credit card debt, income, and expenses with strict satang-level precision and derived balances.

---

## Architecture & Tech Stack

* **Frontend**: React 18, TypeScript, Vite, React Router, TanStack Query.
* **Backend**: Node.js 20, Express, TypeScript, Zod schema validation.
* **Database & ORM**: PostgreSQL 16, Prisma ORM with managed SQL migrations.
* **Security & Auth**: HTTP-only session cookies, SHA-256 session token hashing, bcrypt password hashing (cost 12), default-deny role authorization (`USER`, `ADMIN`), and CSRF protection.
* **Testing**: Vitest + Supertest (unit & API integration) and Playwright (end-to-end browser journeys).

---

## 6-Step Quickstart Guide (NFR-05)

Follow these 6 steps to run the application and seed demo data on a clean environment:

1. **Install dependencies**:
   ```powershell
   npm install
   ```

2. **Configure environment variables**:
   ```powershell
   cp .env.example .env
   ```

3. **Start PostgreSQL database** (via Docker):
   ```powershell
   docker compose up -d
   ```

4. **Run database migrations**:
   ```powershell
   npm run db:migrate
   ```

5. **Seed initial synthetic accounts**:
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

The seed script loads three deterministic testing accounts (passwords sourced from `SEED_DEFAULT_PASSWORD`, defaulting to `Password123!`):

| Email | Role | Default Password | Permissions / Accessible Views |
|---|---|---|---|
| `alice@example.test` | `USER` | `Password123!` | Private user ledger, Dashboard, Transactions, Summary |
| `bob@example.test` | `USER` | `Password123!` | Independent private user ledger (tenant-isolated from Alice) |
| `admin@example.test` | `ADMIN` | `Password123!` | User account administration (`/admin/users`), strictly excluded from financial records |

---

## Verification & Automated Test Commands

Run automated tests against the running PostgreSQL database:

* **Run all Unit and API Integration tests** (Supertest + Vitest):
  ```powershell
  npm test
  ```

* **Run Playwright End-to-End browser tests**:
  ```powershell
  npx playwright test
  ```

* **Type-check TypeScript**:
  ```powershell
  npx tsc --noEmit -p server/tsconfig.json
  npx tsc --noEmit -p web/tsconfig.json
  ```
