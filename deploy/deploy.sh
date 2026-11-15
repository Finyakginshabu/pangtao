#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Pangtao — Idempotent Google Cloud Run Deployment Script (Lab 5, #25)
# ==============================================================================
# Usage:
#   ./deploy/deploy.sh [--demo]
#
#   --demo  also seed the demo users (admin/alice/bob) after migrating, so the
#           service can be logged into for the demo. Without it the database is
#           migrated but left empty.
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to active gcloud config project)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES  (one-time / manual first setup; safe to re-run)
#   Creates every cloud resource the app needs and does the first deployment:
#   1 enable APIs     2 Artifact Registry  3 Cloud SQL instance  4 database
#   5 runtime SA+IAM  6 DB user + DATABASE_URL secret  7 seed password
#   8 build image     9 migrate+seed job   10 Cloud Run service
#   After this, routine releases are done by GitHub Actions (deploy.yml ->
#   deploy/release.sh), which only UPDATES these resources.
#
# ⭐ IMPORTANT
#   - Idempotent: existing resources/secrets are reused, never overwritten
#     (a re-run does not replace credentials).
#   - Passwords are generated with openssl and live only in Secret Manager;
#     they are never printed (run_cmd redacts --password=...).
#   - Preview first with:  DRY_RUN=1 ./deploy/deploy.sh   (no gcloud calls)
#   - Run from the REPO ROOT (step 8 builds the root Dockerfile).
#   - Offline test: deploy/tests/test_deploy_stub.sh
#
# REFERENCES
#   - gcloud run deploy : https://cloud.google.com/sdk/gcloud/reference/run/deploy
#   - Cloud Run jobs    : https://cloud.google.com/run/docs/create-jobs
#   - Cloud SQL + Run   : https://cloud.google.com/sql/docs/postgres/connect-run
#   - Secret Manager    : https://cloud.google.com/secret-manager/docs
#   - Artifact Registry : https://cloud.google.com/artifact-registry/docs/docker
#
# ⭐ ADAPTED FOR PANGTAO
#   Resource names, secrets, the database URL, the migrate/seed commands and the
#   container port below match this repository. If you rename anything here,
#   rename it in deploy/release.sh, deploy/teardown.sh, deploy/tests/* and
#   .github/workflows/deploy.yml too — otherwise later steps cannot find the
#   resource.
# ==============================================================================

# ------------------------------------------------------------------------------
# Settings & argument parsing
# ------------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-0}"
# CHANGE ME: default region if your group uses another one.
REGION="${REGION:-asia-southeast1}"
SEED_DEMO_DATA="false"

for arg in "$@"; do
  case "$arg" in
    --demo)
      SEED_DEMO_DATA="true"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--demo]" >&2
      exit 1
      ;;
  esac
done

# Helper: prints the command (DRY_RUN=1) or prints then executes it.
# ⭐ IMPORTANT: --password=... is redacted in the log; keep this behaviour.
run_cmd() {
  # Log the command without exposing generated database credentials.
  local arg
  if [ "$DRY_RUN" = "1" ]; then
    printf '[DRY_RUN] '
  else
    printf '+ '
  fi
  for arg in "$@"; do
    case "$arg" in
      --password=*) printf '%s ' '--password=<REDACTED>' ;;
      *) printf '%q ' "$arg" ;;
    esac
  done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then
    "$@"
  fi
}

# Resolve the GCP project: $PROJECT_ID, else the active gcloud project.
if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    echo "Run: gcloud config set project YOUR_PROJECT_ID" >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Resource names (pangtao-*). Used by deploy.yml / release.sh / teardown.sh and
# the lab guide's later steps; keep them in sync everywhere.
# CHANGE ME: rename only if your group uses its own naming.
# ------------------------------------------------------------------------------
REPO_NAME="pangtao"
SQL_INSTANCE="pangtao-pg"
DB_NAME="pangtao_db"
DB_USER="pangtao"
SERVICE_NAME="pangtao"
MIGRATE_JOB_NAME="pangtao-migrate"
SA_NAME="pangtao-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

# Secret Manager secret names (values are never stored in this repo).
#   DATABASE_URL           read by the server and by the migrate job
#   SEED_DEFAULT_PASSWORD  read by prisma/seed.ts (demo users); --demo only
SECRET_DB_URL="pangtao-database-url"
SECRET_SEED_PASS="pangtao-seed-password"

GENERATED_SEED_PASSWORD=""

echo "=================================================================="
echo "Pangtao Cloud Run Deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Demo    : ${SEED_DEMO_DATA}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# ==============================================================================
# 1. Enable required GCP APIs
# ==============================================================================
run_cmd gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID"

# ==============================================================================
# 2. Create Artifact Registry repository (idempotent)
#    Stores the container images (deploy.yml pushes one per commit SHA).
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID"
  run_cmd gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location "$REGION" --description="Pangtao container repository" --project "$PROJECT_ID"
else
  if ! gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud artifacts repositories create "$REPO_NAME" \
      --repository-format=docker \
      --location "$REGION" \
      --description="Pangtao container repository" \
      --project "$PROJECT_ID"
  fi
fi

# ==============================================================================
# 3. Create Cloud SQL for PostgreSQL 16 instance (idempotent)
#    Pangtao uses PostgreSQL 16 (prisma/schema.prisma), so POSTGRES_16 stays.
#    ⭐ IMPORTANT: keep `--edition=enterprise` (lowercase) — required by
#       db-f1-micro on POSTGRES_16 and asserted by deploy/tests/test_deploy_stub.sh.
#    ⭐ IMPORTANT: keep `--no-storage-auto-increase` — auto-increase raises the
#       bill without warning; 10 GB is plenty for the lab data.
#       Creating the instance takes several minutes and costs money until
#       deploy/teardown.sh is run.
#    CHANGE ME: --database-version / --tier for a different database.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region="$REGION" --storage-size=10GB --storage-type=SSD --no-storage-auto-increase --backup-start-time=03:00 --project "$PROJECT_ID"
else
  if ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud sql instances create "$SQL_INSTANCE" \
      --database-version=POSTGRES_16 \
      --edition=enterprise \
      --tier=db-f1-micro \
      --region="$REGION" \
      --storage-size=10GB \
      --storage-type=SSD \
      --no-storage-auto-increase \
      --backup-start-time=03:00 \
      --project "$PROJECT_ID"
  fi
fi

# ==============================================================================
# 4. Create Database (idempotent)
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
else
  if ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
  fi
fi

# ==============================================================================
# 5. Create Dedicated Runtime Service Account & IAM bindings (idempotent)
#    The app runs as this account with least privilege. Here it only gets
#    cloudsql.client (connect to the DB); access to individual secrets is
#    granted later, per secret, after they exist.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID"
  run_cmd gcloud iam service-accounts create "$SA_NAME" --display-name="Pangtao Cloud Run Service Account" --project "$PROJECT_ID"
else
  if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
    run_cmd gcloud iam service-accounts create "$SA_NAME" \
      --display-name="Pangtao Cloud Run Service Account" \
      --project "$PROJECT_ID"
  fi
fi

run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --quiet

# ==============================================================================
# 6. Create DB User & Store DATABASE_URL in Secret Manager (only if the secret
#    does not exist yet)
#    ⭐ IMPORTANT: the DB user's password and the password inside DATABASE_URL
#       must be the same value (checked by test_deploy_stub.sh). Never echo it.
#    The URL uses the Cloud SQL Unix socket that Cloud Run mounts at
#    /cloudsql/PROJECT:REGION:INSTANCE (Prisma reads it from `host=`).
#    connection_limit=3 keeps one instance under db-f1-micro's connection cap.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"
  run_cmd gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)"
  run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<GENERATED_HEX_PASSWORD>" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
else
  if ! gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID" >/dev/null 2>&1; then
    DB_PASS="$(openssl rand -hex 24)"
    if gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)" | grep -qx "$DB_USER"; then
      run_cmd gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
    else
      run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
    fi
    DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}&schema=public&connection_limit=3"
    run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
    printf "%s" "$DB_URL_VALUE" | gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
  fi
fi

# ==============================================================================
# 7. Create SEED_DEFAULT_PASSWORD in Secret Manager when --demo is passed
#    prisma/seed.ts requires it (admin@example.test, alice@example.test,
#    bob@example.test). Read it later with:
#      gcloud secrets versions access latest --secret=<name>
# ==============================================================================
JOB_SECRETS="DATABASE_URL=${SECRET_DB_URL}:latest"
if [ "$SEED_DEMO_DATA" = "true" ]; then
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID"
    run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
    run_cmd gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
  else
    if ! gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID" >/dev/null 2>&1; then
      GENERATED_SEED_PASSWORD="$(openssl rand -base64 16 | tr -d '/+=' | cut -c1-14)Aa1!"
      run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
      printf "%s" "$GENERATED_SEED_PASSWORD" | gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
    fi
  fi
  JOB_SECRETS="${JOB_SECRETS},SEED_DEFAULT_PASSWORD=${SECRET_SEED_PASS}:latest"
fi

# ------------------------------------------------------------------------------
# Secret access (per secret, NOT project-wide)
# ⭐ IMPORTANT: test_deploy_stub.sh fails if a project-wide secretAccessor
#    binding is added — keep access limited to this app's own secrets.
# ------------------------------------------------------------------------------
# Grant access only to this app's secrets, after they exist.
RUNTIME_SECRETS=("$SECRET_DB_URL")
if [ "$SEED_DEMO_DATA" = "true" ]; then
  RUNTIME_SECRETS+=("$SECRET_SEED_PASS")
fi
for secret in "${RUNTIME_SECRETS[@]}"; do
  run_cmd gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet
done

# ==============================================================================
# 8. Build & Push Unified Container Image via Cloud Build
#    Builds the root Dockerfile (run this script from the repo root).
#    Tag `latest` is only for this first manual setup; deploy.yml uses commit SHAs.
#    NOTE: `gcloud builds submit --tag` cannot pass --build-arg, so this first
#    image records GIT_SHA=unknown in its label. The release workflow (#27)
#    builds with GIT_SHA=<commit> so released images record their commit (R-08).
# ==============================================================================
run_cmd gcloud builds submit \
  --tag "$IMAGE_URI" \
  --project "$PROJECT_ID"

# ==============================================================================
# 9. Create/Update & Execute Cloud Run Job for Migration + Non-destructive Seed
#     ⭐ IMPORTANT: if this job fails the script stops BEFORE deploying the
#        service, so a broken migration never reaches users.
#     Command: `npx prisma migrate deploy`. With --demo the first execution
#        also runs `npx prisma db seed`; the job is then left migrate-only so
#        release.sh never re-seeds (deployment.md §3: the seed is idempotent but
#        resets the seed users, which would undo an account disabled through the
#        admin screen).
#     deploy.yml / release.sh later re-run this same job (name: pangtao-migrate).
# ==============================================================================
if [ "$SEED_DEMO_DATA" = "true" ]; then
  JOB_COMMAND="npx prisma migrate deploy && npx prisma db seed"
else
  JOB_COMMAND="npx prisma migrate deploy"
fi

run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --set-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "$JOB_SECRETS" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok,APP_TIMEZONE=Asia/Bangkok" \
  --command "sh" \
  --args "-c,${JOB_COMMAND}" \
  --max-retries 1 \
  --task-timeout 300s \
  --project "$PROJECT_ID"

if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
  --region "$REGION" \
  --wait \
  --project "$PROJECT_ID"; then
  printf '%s\n' "ERROR: Cloud Run migration job '${MIGRATE_JOB_NAME}' failed. Aborting service deployment." >&2
  printf '%s\n' "View job logs with:" >&2
  printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}\" --project \"${PROJECT_ID}\" --limit 50 --format=\"value(textPayload)\"" >&2
  exit 1
fi

# The seed ran once above; leave the job migrate-only for every later release.
if [ "$SEED_DEMO_DATA" = "true" ]; then
  run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
    --args "-c,npx prisma migrate deploy" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --quiet
fi

# ==============================================================================
# 10. Deploy Cloud Run Service
#     --port 8080 equals the Dockerfile's EXPOSE/ENV PORT (server/src/index.ts
#     reads PORT); tune --memory / --cpu / --max-instances for your app.
#     Secrets go in --set-secrets, plain settings in --set-env-vars:
#       TRUST_PROXY=1  Cloud Run's front end appends X-Forwarded-For; the login
#                      rate limit keys on the real client IP (AC-01.12).
#       COOKIE_SECURE=true  the session cookie is HTTPS-only (NODE_ENV=production
#                      already forces this; stated explicitly for clarity).
#     ⚠️ --allow-unauthenticated makes the service public (needed for the demo
#        and Lab 6).
# ==============================================================================
run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "$SA_EMAIL" \
  --add-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest" \
  --set-env-vars "NODE_ENV=production,TRUST_PROXY=1,APP_TIMEZONE=Asia/Bangkok,TZ=Asia/Bangkok,COOKIE_SECURE=true" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --port 8080 \
  --project "$PROJECT_ID"

if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-<hash>-as.a.run.app"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
fi

# ------------------------------------------------------------------------------
# Summary output (URLs; passwords stay in Secret Manager and are not printed)
# ------------------------------------------------------------------------------
printf '\n'
printf '%s\n' "=================================================================="
printf '%s\n' "Deployment Completed!"
printf '%s\n' "Service URL    : ${SERVICE_URL}"
printf '%s\n' "Health Check   : ${SERVICE_URL}/api/v1/health   (runs SELECT 1, proves the DB works)"
if [ "$SEED_DEMO_DATA" = "true" ]; then
  printf '%s\n' "Demo Users     : admin@example.test, alice@example.test, bob@example.test"
  printf '%s\n' "Demo Password  : Stored in Secret Manager: ${SECRET_SEED_PASS} (not printed)."
else
  printf '%s\n' "Demo Users     : none seeded (re-run with --demo to create them)."
fi
printf '%s\n' "=================================================================="
