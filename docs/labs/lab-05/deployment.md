# Pangtao Deployment (Lab 5)

How Pangtao is built, configured, deployed and released. Covers R-02 and R-04 of the Lab 5 handout so far. Sections marked _TBD_ are filled in by the issue named next to them.

| Item | Value |
|---|---|
| Repository | `Finyakginshabu/pangtao` (public, R-12) |
| Release branch | `main` (only `main` deploys); integration branch `sprint-2-staging` |
| Container image | _TBD (#23)_ |
| Public URL | _TBD (#25)_ |
| Running commit | _TBD (#27)_ |

## 1. Stack

Reference stack from the Student Guide, with these differences:

| Area | Choice | Difference from the starter kit, and why |
|---|---|---|
| Shutdown | SIGTERM handler in `server/src/index.ts` | The server stops accepting connections, finishes in-flight requests and closes the database pool, within Cloud Run's 10-second limit after SIGTERM |
| Client IP | `TRUST_PROXY=1` on Cloud Run | Cloud Run's front end appends the client address to `X-Forwarded-For`; trusting one hop makes the login rate limit (AC-01.12) count per real client. Unset elsewhere, so a client cannot forge its address |
| Hosting | Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL 16, Secret Manager, GitHub Actions | Same as the kit |

Nothing the app needs is kept only in the container (R-04): sessions, the failed-login counter (`login_attempts`, F-01 v1.5) and all ledger data live in PostgreSQL, and there are no uploaded files. Because the login limit is stored in the database, it holds across restarts and across several Cloud Run instances.

## 2. Environment variables

Every setting is read from the environment (R-02). `.env.example` lists them with placeholder values only; `.env` is git-ignored.

| Variable | Purpose | Secret? | Local value from | Cloud value from |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | `.env` | Secret Manager _(#25)_ |
| `SEED_DEFAULT_PASSWORD` | Password of the synthetic seed users (admin, alice, bob). Seed and tests refuse to run without it | **Yes** | `.env` | Secret Manager, migrate/seed job only _(#25)_ |
| `NODE_ENV` | `production` serves the SPA, forces secure cookies and turns off the localhost CSRF exception | No | `.env` | `production` |
| `PORT` | HTTP listen port | No | `.env` (8080) | Injected by Cloud Run (8080) |
| `TRUST_PROXY` | Proxy hops to trust for the client IP in the login rate limit (AC-01.12). Unset means `X-Forwarded-For` is ignored | No | Empty (the app is reached directly) | `1` (Cloud Run's front end appends the client IP) |
| `SESSION_TTL_HOURS` | Session lifetime | No | `.env` | Default 8 |
| `COOKIE_SECURE` | Secure cookie flag outside production (always on in production) | No | `.env` | Not needed |
| `BCRYPT_COST` | bcrypt rounds (≥ 12, NFR-01) | No | `.env` | Default 12 |
| `APP_TIMEZONE` | Day boundaries for transaction dates (BR-10) | No | `.env` | Default `Asia/Bangkok` |
| `LOG_LEVEL` | Reserved; not read by the code yet | No | `.env` | Not set |
| `TEST_DATABASE_URL` | Optional test database (tests and CI only) | Local: no | `.env` | CI only _(#24)_ |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local PostgreSQL container | Local only | `.env` | Not used (Cloud SQL) |

## 3. Commands

### Local development (README quickstart)

```powershell
npm install
cp .env.example .env          # then set SEED_DEFAULT_PASSWORD
docker compose up -d          # PostgreSQL only
npm run db:migrate
npm run db:seed
npm run dev:server            # API :8080
npm run dev:web               # UI  :3000
```

### Test

```powershell
npm run verify                # lint, type-check, unit + API with coverage gate, build, E2E
```

### Build and run the production build without Docker

```powershell
npm run build
$env:NODE_ENV = "production"; node server/dist/index.js   # serves the API and web/dist on :8080
```

### Migrate and seed

| Where | Command |
|---|---|
| Local dev | `npm run db:migrate` (creates migrations) · `npm run db:seed` |
| Cloud Run job | `npx prisma migrate deploy` on every release; `npx prisma db seed` once, after the first deploy |

The seed is idempotent but **resets the three seed users** (password hash from `SEED_DEFAULT_PASSWORD`, `isActive = true`) each time it runs. On Cloud Run it would undo a user disabled through the admin screen, so the release pipeline runs `migrate deploy` only _(job set-up in #25, pipeline in #27)_. Migrations must stay additive so an earlier image can still run after a rollback.

## 4. GCP resources _(TBD, #21 and #25)_

| Resource | Name |
|---|---|
| Project ID | |
| Region | |
| Artifact Registry repository | |
| Cloud SQL instance / database / user | |
| Secret Manager secrets | |
| Cloud Run service | |
| Cloud Run migration job | |
| Runtime service account | |
| Deploy service account (Workload Identity Federation) | |

## 5. Release procedure _(TBD, #27)_

## 6. Finding the running commit _(TBD, #27)_
