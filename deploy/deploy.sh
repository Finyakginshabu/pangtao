#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Pangtao — Google Cloud Run provisioning and first deployment (Lab 5, #25)
# ==============================================================================
# Usage:
#   ./deploy/deploy.sh [--demo] [--force-image] [--seed-once]
#
#   --demo         seed the demo users (admin/alice/bob) on the FIRST deployment
#                  only (the migrate job must not exist yet). Ignored on re-runs;
#                  use --seed-once to seed again.
#   --force-image  rebuild :latest from this working tree and redeploy even when
#                  the Cloud Run service already exists. That replaces the image
#                  a release deployed, so use it only on purpose.
#   --seed-once    seed the demo users explicitly (the migrate job must exist).
#                  Runs migrate + seed once, then detaches the seed secret again.
#                  It resets the three seed users.
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to active gcloud config project)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES  (provisioning is idempotent; safe to re-run)
#   1 enable APIs     2 Artifact Registry  3 Cloud SQL instance  4 database
#   5 runtime SA+IAM  6 DB user + DATABASE_URL secret
#   7 build image     8 migrate job       9 optional one-off seed
#   10 Cloud Run service
#   Steps 7-10 are skipped when the service already exists (unless
#   --force-image), so a re-run never rolls the service back to the local
#   working tree. Routine releases are done by release.sh, which the deploy
#   workflow (#27, TBD) calls with an image built from the commit.
#
# ⭐ IMPORTANT
#   - Existing resources/secrets are reused, never overwritten; a secret counts
#     as done only when it has an ENABLED version, so a failed `versions add`
#     is repaired on the next run.
#   - A failed gcloud *read* (quota, expired token, missing permission) is an
#     error, never "resource missing": otherwise a re-run could rotate the DB
#     password or skip the re-run guard.
#   - Passwords are generated with openssl and live only in Secret Manager;
#     they are never printed (run_cmd redacts --password=...).
#   - The one-off seed detaches SEED_DEFAULT_PASSWORD in a trap (EXIT/INT/TERM),
#     so Ctrl-C or a failed reset still leaves the job migrate-only.
#   - Preview first with:  DRY_RUN=1 ./deploy/deploy.sh   (no gcloud calls)
#   - Run from the REPO ROOT (step 7 builds the root Dockerfile).
#   - Offline test: deploy/tests/test_deploy_stub.sh
#   - ⚠️ Cloud SQL keeps a deleted instance's name reserved for up to a week.
#     After deploy/teardown.sh, either wait, or change SQL_INSTANCE below.
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
#   .github/workflows/deploy.yml (when #27 adds it) too.
# ==============================================================================

# ------------------------------------------------------------------------------
# Settings & argument parsing
# ------------------------------------------------------------------------------
DRY_RUN="${DRY_RUN:-0}"
# CHANGE ME: default region if your group uses another one.
REGION="${REGION:-asia-southeast1}"
SEED_DEMO_DATA="false"
FORCE_IMAGE="false"
SEED_ONCE="false"
SEEDED="false"

for arg in "$@"; do
  case "$arg" in
    --demo)        SEED_DEMO_DATA="true" ;;
    --force-image) FORCE_IMAGE="true" ;;
    --seed-once)   SEED_ONCE="true" ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--demo] [--force-image] [--seed-once]" >&2
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
# Resource names (pangtao-*). Used by release.sh / teardown.sh / the tests and
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
#   SEED_DEFAULT_PASSWORD  read by prisma/seed.ts; attached only while seeding
SECRET_DB_URL="pangtao-database-url"
SECRET_SEED_PASS="pangtao-seed-password"

GENERATED_SEED_PASSWORD=""

echo "=================================================================="
echo "Pangtao Cloud Run provisioning"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Demo    : ${SEED_DEMO_DATA}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# ==============================================================================
# Helpers
# ==============================================================================

# True when a gcloud error message means "the resource does not exist".
# gcloud words this differently per API: "NOT_FOUND:" (gRPC), "Cannot find
# service [...] in region [...]" (Cloud Run), "HTTPError 404: ... does not
# exist" (Cloud SQL). Permission, quota, auth and API-disabled errors match none
# of these and are treated as hard failures.
is_not_found() {
  case "$1" in
    *NOT_FOUND*|*"not found"*|*"Not Found"*|*"Cannot find"*|*"could not be found"*|*"does not exist"*|*"HTTPError 404"*)
      return 0 ;;
  esac
  return 1
}

# Run a read-only gcloud command that answers "does this exist?".
#   0 = it exists
#   1 = it does not exist (gcloud said NOT_FOUND)
#   exits 1 for anything else (expired token, quota, missing permission, API not
#   yet enabled). Treating those as "missing" would rotate the DB password or
#   bypass the re-run guard, so they must stop the script instead.
gcloud_read() {
  local what="$1"; shift
  local output status
  output="$("$@" 2>&1)" || status=$?
  if [ "${status:-0}" -eq 0 ]; then
    return 0
  fi
  if is_not_found "$output"; then
    return 1
  fi
  printf 'ERROR: could not check %s:\n%s\n' "$what" "$output" >&2
  printf '%s\n' 'Fix the error above (permissions, quota, login) and re-run.' >&2
  exit 1
}

# ------------------------------------------------------------------------------
# What already exists? A dry run assumes a first deployment so it prints every
# command.
# ------------------------------------------------------------------------------
SERVICE_EXISTS="false"
JOB_EXISTS="false"
if [ "$DRY_RUN" != "1" ]; then
  if gcloud_read "Cloud Run service ${SERVICE_NAME}" \
    gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID"; then
    SERVICE_EXISTS="true"
  fi
  if gcloud_read "Cloud Run job ${MIGRATE_JOB_NAME}" \
    gcloud run jobs describe "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID"; then
    JOB_EXISTS="true"
  fi
fi
echo "Service exists: ${SERVICE_EXISTS} | Migrate job exists: ${JOB_EXISTS}"

# True when the secret exists AND has an ENABLED version. A secret whose
# `versions add` failed (partial run) is treated as missing, so the next run
# repairs it instead of leaving an empty secret that breaks `:latest`.
# ⭐ Only a successful, empty list (or NOT_FOUND) means "no version". Any other
#    failure must stop the script: otherwise a quota/permission error on a
#    re-run would reset the production DB password while the running service
#    keeps the old DATABASE_URL.
secret_has_version() {
  local name="$1" output status
  output="$(gcloud secrets versions list "$name" \
    --filter='state=ENABLED' --limit=1 --format='value(name)' \
    --project "$PROJECT_ID" 2>&1)" || status=$?
  if [ "${status:-0}" -ne 0 ]; then
    if is_not_found "$output"; then
      return 1
    fi
    printf 'ERROR: could not list versions of secret %s:\n%s\n' "$name" "$output" >&2
    printf '%s\n' 'Fix the error above (permissions, quota, login) and re-run.' >&2
    exit 1
  fi
  [ -n "$output" ]
}

# Create the DB user (or reset its password) and store the matching DATABASE_URL.
# The password inside the URL is the DB user's password (asserted by the tests).
ensure_db_secret() {
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"
    run_cmd gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)"
    run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<GENERATED_HEX_PASSWORD>" --project "$PROJECT_ID"
    run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
    run_cmd gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
    return 0
  fi
  if secret_has_version "$SECRET_DB_URL"; then
    return 0
  fi
  local db_pass db_url users
  db_pass="$(openssl rand -hex 24)"
  # Read the user list before rotating anything: if this fails (permission,
  # quota), stop instead of resetting a password the running service cannot see.
  users="$(gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)" 2>&1)" || {
    printf 'ERROR: could not list Cloud SQL users of %s:\n%s\n' "$SQL_INSTANCE" "$users" >&2
    exit 1
  }
  if printf '%s\n' "$users" | grep -qx "$DB_USER"; then
    run_cmd gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$db_pass" --project "$PROJECT_ID"
  else
    run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$db_pass" --project "$PROJECT_ID"
  fi
  # The Cloud SQL Unix socket that Cloud Run mounts at /cloudsql/PROJECT:REGION:INSTANCE.
  db_url="postgresql://${DB_USER}:${db_pass}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}&schema=public&connection_limit=3"
  if ! gcloud_read "secret ${SECRET_DB_URL}" \
    gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"; then
    run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  fi
  printf "%s" "$db_url" | gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
}

# Create the seed password secret if it has no ENABLED version.
ensure_seed_secret() {
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID"
    run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
    run_cmd gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
    return 0
  fi
  if secret_has_version "$SECRET_SEED_PASS"; then
    return 0
  fi
  GENERATED_SEED_PASSWORD="$(openssl rand -base64 16 | tr -d '/+=' | cut -c1-14)Aa1!"
  if ! gcloud_read "secret ${SECRET_SEED_PASS}" \
    gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID"; then
    run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
  fi
  printf "%s" "$GENERATED_SEED_PASSWORD" | gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
}

# Detach the seed secret from the migrate job and revoke the per-secret binding.
# Runs on success, on a failed seed job, and from the EXIT/INT/TERM trap, so an
# interrupted run (Ctrl-C during `jobs execute --wait`, a failing reset command)
# can never leave the job with seed args — a later release would re-seed and
# re-enable disabled users (deployment.md §3).
SEED_SECRET_ATTACHED="false"
seed_detach() {
  if [ "$SEED_SECRET_ATTACHED" != "true" ]; then
    return 0
  fi
  SEED_SECRET_ATTACHED="false"
  # Clear the traps first: cleanup must run once, even if it fails part-way.
  trap - EXIT INT TERM
  run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
    --remove-secrets=SEED_DEFAULT_PASSWORD \
    --args="--,sh,-c,npx prisma migrate deploy" \
    --region "$REGION" --project "$PROJECT_ID" --quiet || true
  run_cmd gcloud secrets remove-iam-policy-binding "$SECRET_SEED_PASS" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet || true
}

# Seed once: attach the seed password to the migrate job, run migrate + seed,
# then ALWAYS detach it and reset the job to migrate-only (even on failure), so
# no later release re-seeds or resets the seed users (deployment.md §2, §3).
seed_demo_users() {
  echo "Seeding the demo users once (npx prisma db seed)..."
  ensure_seed_secret
  # From here the job carries the seed password: clean up on ANY exit.
  SEED_SECRET_ATTACHED="true"
  trap 'seed_detach' EXIT
  trap 'seed_detach; exit 130' INT TERM
  run_cmd gcloud secrets add-iam-policy-binding "$SECRET_SEED_PASS" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet
  run_cmd gcloud run jobs update "$MIGRATE_JOB_NAME" \
    --update-secrets "SEED_DEFAULT_PASSWORD=${SECRET_SEED_PASS}:latest" \
    --args="--,sh,-c,npx prisma migrate deploy && npx prisma db seed" \
    --region "$REGION" --project "$PROJECT_ID" --quiet
  local failed="false"
  run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
    --region "$REGION" --wait --project "$PROJECT_ID" || failed="true"
  seed_detach
  if [ "$failed" = "true" ]; then
    echo "ERROR: seeding failed; the migrate job was reset to migrate-only." >&2
    exit 1
  fi
  SEEDED="true"
}

print_summary() {
  local url
  if [ "$DRY_RUN" = "1" ]; then
    url="https://${SERVICE_NAME}-<hash>-as.a.run.app"
  else
    url="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
  fi
  printf '\n'
  printf '%s\n' "=================================================================="
  printf '%s\n' "Deployment Completed!"
  printf '%s\n' "Service URL    : ${url}"
  printf '%s\n' "Health Check   : ${url}/api/v1/health   (runs SELECT 1, proves the DB works)"
  if [ "$SEEDED" = "true" ]; then
    printf '%s\n' "Demo Users     : admin@example.test, alice@example.test, bob@example.test"
    printf '%s\n' "Demo Password  : Stored in Secret Manager: ${SECRET_SEED_PASS} (not printed)."
  else
    printf '%s\n' "Demo Users     : not seeded by this run (--demo seeds only the first deployment;"
    printf '%s\n' "                 use --seed-once to seed or re-seed them)."
  fi
  printf '%s\n' "=================================================================="
}

# ==============================================================================
# --seed-once: explicit one-off seed against the existing migrate job.
# ==============================================================================
if [ "$SEED_ONCE" = "true" ]; then
  if [ "$DRY_RUN" != "1" ] && [ "$JOB_EXISTS" != "true" ]; then
    echo "Error: Cloud Run job '${MIGRATE_JOB_NAME}' does not exist yet." >&2
    echo "Run the first deployment (./deploy/deploy.sh --demo) before --seed-once." >&2
    exit 1
  fi
  seed_demo_users
  print_summary
  exit 0
fi

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
#    Stores the container images; the deploy workflow (#27) pushes one per SHA.
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
# 6. DB user + DATABASE_URL secret (idempotent; repaired if the secret has no
#    ENABLED version, e.g. after a failed `versions add`)
# ==============================================================================
ensure_db_secret

# Per-secret access (NOT project-wide).
# ⭐ IMPORTANT: test_deploy_stub.sh fails if a project-wide secretAccessor
#    binding is added — keep access limited to this app's own secrets.
run_cmd gcloud secrets add-iam-policy-binding "$SECRET_DB_URL" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project "$PROJECT_ID" --quiet

# ==============================================================================
# Skip the build and rollout when the service already exists: a re-run must not
# replace the digest-pinned image a release deployed with a local build.
# ==============================================================================
if [ "$SERVICE_EXISTS" = "true" ] && [ "$FORCE_IMAGE" != "true" ]; then
  printf '\n'
  printf '%s\n' "Cloud Run service '${SERVICE_NAME}' already exists: skipped the image build,"
  printf '%s\n' "migration and rollout. Provisioning above is idempotent and changed nothing else."
  printf '%s\n' "Use --force-image to rebuild :latest from this working tree and redeploy."
  print_summary
  exit 0
fi

# ==============================================================================
# 7. Build & Push Container Image via Cloud Build
#    deploy/cloudbuild.yaml sets DOCKER_BUILDKIT=1 (the Dockerfile uses cache
#    mounts) and passes GIT_SHA, so the image records its commit (R-08).
#    Tag `latest` is only for the manual first deployment; releases use SHAs.
# ==============================================================================
GIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
if [ "$DRY_RUN" != "1" ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "WARNING: working tree is dirty; the image will be labelled ${GIT_SHA} but contain uncommitted changes." >&2
fi
run_cmd gcloud builds submit \
  --config deploy/cloudbuild.yaml \
  --substitutions "_IMAGE_URI=${IMAGE_URI},_GIT_SHA=${GIT_SHA}" \
  --project "$PROJECT_ID"

# ==============================================================================
# 8. Create/Update & Execute Cloud Run Job for Migration
#     ⭐ IMPORTANT: if this job fails the script stops BEFORE deploying the
#        service, so a broken migration never reaches users.
#     The job stays migrate-only. The seed is a one-off (step 9) so later
#     releases never re-seed (deployment.md §3).
#     ⭐ IMPORTANT: --command /usr/bin/tini (the image's ENTRYPOINT) keeps PID 1
#        and signal forwarding, which deployment.md §1 promises for the job.
#        `sh -c` then runs the migration; --args starts with `--` for tini.
# ==============================================================================
run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --set-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok,APP_TIMEZONE=Asia/Bangkok" \
  --command "/usr/bin/tini" \
  --args="--,sh,-c,npx prisma migrate deploy" \
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

# ==============================================================================
# 9. One-off seed (--demo on the first deployment, or --seed-once)
#    Only when the job did not exist before this run: re-running --demo must
#    never re-enable disabled users or reset their passwords.
# ==============================================================================
if [ "$SEED_DEMO_DATA" = "true" ]; then
  if [ "$JOB_EXISTS" = "true" ]; then
    echo "Migrate job already existed: seed skipped (use --seed-once to seed again)."
  else
    seed_demo_users
  fi
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

print_summary
