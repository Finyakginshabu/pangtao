# Pangtao Deployment (Lab 5)

How Pangtao is built, configured, deployed and released. Covers R-01, R-02, R-04, R-08 of the Lab 5 handout. Sections marked _TBD_ are filled in by the issue named next to them.

| Item | Value |
|---|---|
| Repository | `Finyakginshabu/pangtao` (public, R-12) |
| Release branch | `main` (only `main` deploys); integration branch `sprint-2-staging` |
| Public URL | _TBD (#25)_ |
| Running commit | _TBD (#27)_ |

## 1. Stack

Reference stack from the Student Guide, with these differences:

| Area | Choice | Difference from the starter kit, and why |
|---|---|---|
| Container | One image (`Dockerfile`) serves the API and the built React app on port 8080 | The kit uses a separate server and nginx client image for compose. Pangtao uses the same image locally, in CI and on Cloud Run, so local runs test exactly what ships |
| Base image | `node:22.23.5-bookworm-slim`, pinned by digest | The kit uses `node:24-alpine`. Debian (glibc) instead of Alpine (musl), because `bcrypt` and the Prisma engines are native binaries. Node 22 LTS instead of 24: the npm 11 bundled with Node 24 warns that the `bcrypt` and Prisma install scripts are not yet approved (`allowScripts`); Node 22's npm 10 runs them without new configuration. The digest pin makes a rebuild of the same commit use the same base; to update it, run `docker buildx imagetools inspect node:22-bookworm-slim` and replace the version and digest in the `Dockerfile` |
| PID 1 and shutdown | `tini`, plus a SIGTERM handler in `server/src/index.ts` | The kit uses a shell entrypoint. `tini` forwards SIGTERM to Node; the server then stops accepting connections, finishes in-flight requests and closes the database pool, within Cloud Run's 10-second limit |
| Runtime deps | Production dependencies only, plus `prisma` and `tsx` | The kit copies all dependencies. `prisma` and `tsx` are listed under `dependencies` because the migrate/seed job runs them from the same image |
| Build | BuildKit (npm cache mounts); build argument `GIT_SHA` | The commit becomes the image label `org.opencontainers.image.revision` and the variable `APP_COMMIT`, which the server prints at startup (R-08). `.git` stays out of the build context |
| Hosting | Artifact Registry, Cloud Run, Cloud SQL for PostgreSQL 16, Secret Manager, GitHub Actions | Same as the kit |

Nothing the app needs is kept only in the container (R-04): sessions, the failed-login counter (`login_attempts`, F-01 v1.5) and all ledger data live in PostgreSQL, and there are no uploaded files. Because the login limit is stored in the database, it holds across restarts and across several Cloud Run instances.

## 2. Environment variables

Every setting is read from the environment (R-02). `.env.example` lists them with placeholder values only; `.env` is git-ignored and excluded from the Docker build context. Under `docker compose --profile app`, each container receives only the variables listed for it in `docker-compose.yml`, filled from `.env`, as the Cloud Run service and job will.

| Variable | Purpose | Secret? | Local value from | Cloud value from |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | `.env`; compose builds it from `POSTGRES_*` with host `postgres` | Secret Manager _(#25)_ |
| `SEED_DEFAULT_PASSWORD` | Password of the synthetic seed users (admin, alice, bob). Seed and tests refuse to run without it | **Yes** | `.env`; compose passes it to `migrate` only | Secret Manager, given only to the one-time seed run after the first deploy (§3) _(#25)_ |
| `NODE_ENV` | `production` serves the SPA, forces secure cookies and turns off the localhost CSRF exception | No | `.env`; the image and compose set `production` | Image default |
| `PORT` | HTTP listen port | No | `.env` (8080); compose fixes 8080 | Injected by Cloud Run (8080) |
| `TRUST_PROXY` | Proxy hops to trust for the client IP in the login rate limit (AC-01.12). Unset, `0` or `false` means `X-Forwarded-For` is ignored; `true` and malformed values stop the server at startup | No | Empty (the app is reached directly) | `1` (Cloud Run's front end appends the client IP) |
| `SESSION_TTL_HOURS` | Session lifetime | No | `.env` | Default 8 |
| `COOKIE_SECURE` | Secure cookie flag outside production (always on in production) | No | `.env` | Not needed |
| `BCRYPT_COST` | bcrypt rounds (≥ 12, NFR-01) | No | `.env` | Default 12 |
| `APP_TIMEZONE` | Day boundaries for transaction dates (BR-10) | No | `.env` | Default `Asia/Bangkok` |
| `APP_COMMIT` | Commit the running build was made from; printed at startup | No | Unset under `npm run dev:server` (nothing is printed); set by the image from `GIT_SHA` under compose | Set by the image from the Docker build argument `GIT_SHA` _(#27)_ |
| `GIT_SHA` | Docker build argument that becomes `APP_COMMIT` | No | `.env` (optional, default `local`) | The pipeline passes the full commit SHA _(#27)_ |
| `LOG_LEVEL` | Reserved; not read by the code yet | No | `.env` | Not set |
| `TEST_DATABASE_URL` | Optional test database (tests and CI only); its name must end in `_test` | No (local or CI throwaway database) | `.env`, or derived from `DATABASE_URL` | CI only _(#24)_ |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local PostgreSQL container | Local only | `.env` | Not used (Cloud SQL) |
| `APP_PORT` | Host port of the production container in compose | No | `.env` | Not used |

## 3. Commands

### Local development (unchanged, README quickstart)

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

### Production container from a clean clone (C-03)

```powershell
git clone https://github.com/Finyakginshabu/pangtao.git
cd pangtao
cp .env.example .env          # set SEED_DEFAULT_PASSWORD; nothing else is required
docker compose --profile app up -d --build
```

This starts three services. Their ports are published on `127.0.0.1` only.

| Service | What it does |
|---|---|
| `postgres` | PostgreSQL 16 with a named volume (`pgdata`) |
| `migrate` | One-off job from the app image: `npx prisma migrate deploy && npx prisma db seed`, then exits |
| `app` | The app image on `http://localhost:8080`, started only after `migrate` succeeds; health check on `/api/v1/health` |

Useful checks:

```powershell
docker compose --profile app ps          # app should be "healthy"
docker compose --profile app logs migrate
curl http://localhost:8080/api/v1/health # {"status":"ok"}
docker compose --profile app down        # stop; add -v to also delete the data volume
```

### Build the image alone

```powershell
docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t pangtao:local .
docker inspect pangtao:local --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
```

### Migrate and seed

| Where | Command |
|---|---|
| Local dev | `npm run db:migrate` (creates migrations) · `npm run db:seed` |
| Compose `migrate` service | `npx prisma migrate deploy && npx prisma db seed` on every `up` |
| Cloud Run job | `npx prisma migrate deploy` on every release; `npx prisma db seed` once, after the first deploy |

The seed is idempotent but **resets the three seed users** (password hash from `SEED_DEFAULT_PASSWORD`, `isActive = true`) each time it runs. That is harmless locally, which is why compose runs it on every `up`. On Cloud Run it would undo a user disabled through the admin screen, so the release pipeline runs `migrate deploy` only _(job set-up in #25, pipeline in #27)_. Migrations must stay additive so an earlier image can still run after a rollback.

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
