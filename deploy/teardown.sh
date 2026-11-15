#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Pangtao — Google Cloud Run & Cloud SQL Teardown Script
# ==============================================================================
# Usage:
#   ./deploy/teardown.sh
#
# Environment Variables (Optional):
#   PROJECT_ID   GCP Project ID (defaults to active gcloud config project)
#   REGION       GCP Region (default: asia-southeast1)
#   DRY_RUN      Set DRY_RUN=1 to print all gcloud commands without executing
#
# WHAT THIS SCRIPT DOES
#   Deletes everything deploy/deploy.sh created (Cloud Run service + job, Cloud
#   SQL, Artifact Registry, secrets, service account) to stop billing.
#
# ⚠️ DESTRUCTIVE: all Cloud SQL data is permanently lost. You must type the
#    project ID to confirm. Preview first with:  DRY_RUN=1 ./deploy/teardown.sh
#
# REFERENCES
#   - gcloud run services delete  : https://cloud.google.com/sdk/gcloud/reference/run/services/delete
#   - gcloud sql instances delete : https://cloud.google.com/sdk/gcloud/reference/sql/instances/delete
#   - gcloud secrets delete       : https://cloud.google.com/sdk/gcloud/reference/secrets/delete
#
# ⭐ IMPORTANT: the resource names below MUST match deploy/deploy.sh. If you
#    rename anything there, rename it here too.
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
# Keep identical to REGION in deploy/deploy.sh.
REGION="${REGION:-asia-southeast1}"

run_cmd() {
  # Same logging as deploy/deploy.sh: quoted arguments, --password= redacted.
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

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Resource names (must match deploy/deploy.sh)
# ------------------------------------------------------------------------------
REPO_NAME="pangtao"
SQL_INSTANCE="pangtao-pg"
SERVICE_NAME="pangtao"
MIGRATE_JOB_NAME="pangtao-migrate"
SA_NAME="pangtao-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

SECRET_DB_URL="pangtao-database-url"
SECRET_SEED_PASS="pangtao-seed-password"

echo "=================================================================="
echo "WARNING: This will permanently delete Pangtao resources in:"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "Resources to be deleted:"
echo "  - Cloud Run Service : ${SERVICE_NAME}"
echo "  - Cloud Run Job     : ${MIGRATE_JOB_NAME}"
echo "  - Cloud SQL Instance: ${SQL_INSTANCE} (ALL DATABASE DATA WILL BE LOST)"
echo "  - Artifact Registry : ${REPO_NAME}"
echo "  - Secrets           : ${SECRET_DB_URL}, ${SECRET_SEED_PASS}"
echo "  - Service Account   : ${SA_EMAIL}"
echo "=================================================================="

# ------------------------------------------------------------------------------
# Safety confirmation (skipped only in DRY_RUN)
# ------------------------------------------------------------------------------
if [ "$DRY_RUN" != "1" ]; then
  read -r -p "Type the project ID (${PROJECT_ID}) to confirm deletion: " CONFIRM_PROJECT
  if [ "$CONFIRM_PROJECT" != "$PROJECT_ID" ]; then
    echo "Aborted: confirmation did not match ${PROJECT_ID}."
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Delete resources (each `|| true` so one missing resource does not stop the rest)
# ------------------------------------------------------------------------------
run_cmd gcloud run services delete "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud run jobs delete "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud sql instances delete "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud artifacts repositories delete "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DB_URL" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_SEED_PASS" --project "$PROJECT_ID" --quiet || true
# Remove the project-level role granted by deploy.sh, so no deleted:serviceAccount
# entry is left behind in the project IAM policy.
run_cmd gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --project "$PROJECT_ID" --quiet || true
run_cmd gcloud iam service-accounts delete "$SA_EMAIL" --project "$PROJECT_ID" --quiet || true

echo "Teardown completed."
