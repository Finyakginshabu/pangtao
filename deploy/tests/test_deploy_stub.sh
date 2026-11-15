#!/usr/bin/env bash
# Offline regression checks: every gcloud and openssl call is a local stub.
# ==============================================================================
# WHAT THIS TEST DOES (no real GCP calls, no cost)
#   Puts fake `gcloud` / `openssl` first on PATH and runs deploy/deploy.sh in
#   these scenarios, asserting on the recorded commands:
#     first_run   : nothing exists        -> everything is created, no seed
#     rerun       : service + job exist   -> no build, no rollout, no new creds
#     rerun_force : + --force-image       -> build + rollout, no new creds
#     partial     : DB secret has no version -> password reset + version added
#     job_exists  : service missing, job exists + --demo -> seed is SKIPPED
#     job-fail    : migration fails       -> script exits 1, service NOT deployed
#     demo        : first run + --demo    -> seed once, then job reset and the
#                                            seed secret detached + revoked
#     seed_once   : --seed-once           -> seed only, no build/rollout
#   It also checks: `--edition=enterprise`, `--no-storage-auto-increase`, no
#   project-wide secretAccessor role, DB password == password inside DATABASE_URL,
#   and that no password/secret value leaks into the output. Finally DRY_RUN=1
#   must make zero gcloud calls.
#
# HOW TO RUN (repo root, needs bash):  bash deploy/tests/test_deploy_stub.sh
#   Prints `PASS: <scenario>` per scenario; any `FAIL ...` exits non-zero.
#   Run it after every edit of deploy/deploy.sh (and after the 5.2 dry run).
#
# ⭐ CHANGE ME: if you rename resources in deploy/deploy.sh (e.g. the secret
#    names pangtao-database-url / pangtao-seed-password, the DB user `pangtao`),
#    update the matching strings below.
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
export TEST_STATE_DIR
TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin"

# --- Fake `openssl` (deterministic "random" values) ---------------------------
cat > "$TEST_STATE_DIR/bin/openssl" <<'STUB'
#!/usr/bin/env bash
if [ "$2" = "-hex" ]; then
  printf '%s\n' '0123456789abcdef0123456789abcdef0123456789abcdef'
else
  printf '%s\n' 'TESTONLYGENERATEDPASSWORD'
fi
STUB

# --- Fake `gcloud`: logs each call (password redacted), answers per STUB_* -----
cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
redacted=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > "$TEST_STATE_DIR/sql-pass"
      redacted+=("--password=<REDACTED>") ;;
    *) redacted+=("$arg") ;;
  esac
done
printf '%s\n' "${redacted[*]}" >> "$GCLOUD_LOG"

if [ "${1:-} ${2:-}" = 'config get-value' ]; then
  echo stub-gcp-project
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'run services describe' ]; then
  # "missing" only until this run deploys the service; the summary reads it back.
  if [ "${STUB_SERVICE:-present}" = missing ] && ! grep -q '^run deploy ' "$GCLOUD_LOG" 2>/dev/null; then
    exit 1
  fi
  echo https://pangtao-stub.example.invalid
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'run jobs describe' ]; then
  if [ "${STUB_JOB:-present}" = missing ]; then exit 1; fi
  echo pangtao-migrate
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'run jobs execute' ]; then
  if [ "${STUB_JOB_FAIL:-0}" = 1 ]; then exit 1; fi
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions list' ]; then
  name="${4:-}"
  value='version'
  if [ "$name" = pangtao-database-url ]; then value="${STUB_DB_SECRET:-version}"; fi
  if [ "$name" = pangtao-seed-password ]; then value="${STUB_SEED_SECRET:-version}"; fi
  case "$value" in absent|no-version) exit 1 ;; esac
  echo 1
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'secrets describe' ]; then
  name="${3:-}"
  value='present'
  if [ "$name" = pangtao-database-url ]; then value="${STUB_DB_SECRET:-version}"; fi
  if [ "$name" = pangtao-seed-password ]; then value="${STUB_SEED_SECRET:-version}"; fi
  if [ "$value" = absent ]; then exit 1; fi
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'secrets versions add' ]; then
  cat > "$TEST_STATE_DIR/payload-${4}"
  exit 0
fi

if [ "${1:-} ${2:-} ${3:-}" = 'sql users list' ]; then
  if [ "${STUB_USER_EXISTS:-0}" = 1 ]; then printf 'postgres\npangtao\n'; else echo postgres; fi
  exit 0
fi

for word in "$@"; do
  if [ "$word" = describe ]; then
    case "$STUB_MODE" in
      first_run|demo|job-fail) exit 1 ;;
    esac
  fi
done
STUB
chmod +x "$TEST_STATE_DIR/bin/openssl" "$TEST_STATE_DIR/bin/gcloud"
export PATH="$TEST_STATE_DIR/bin:$PATH"
export PROJECT_ID=stub-gcp-project
export REGION=asia-southeast1
export DRY_RUN=0

# --- Run every scenario and assert on what deploy.sh did ------------------------
for MODE in first_run rerun rerun_force partial job_exists job-fail demo seed_once; do
  unset STUB_SERVICE STUB_JOB STUB_DB_SECRET STUB_SEED_SECRET STUB_USER_EXISTS STUB_JOB_FAIL
  args=()
  case "$MODE" in
    first_run)
      export STUB_SERVICE=missing STUB_JOB=missing STUB_DB_SECRET=absent STUB_SEED_SECRET=absent STUB_USER_EXISTS=0 ;;
    rerun)
      export STUB_SERVICE=present STUB_JOB=present STUB_DB_SECRET=version STUB_SEED_SECRET=version STUB_USER_EXISTS=1 ;;
    rerun_force)
      export STUB_SERVICE=present STUB_JOB=present STUB_DB_SECRET=version STUB_SEED_SECRET=version STUB_USER_EXISTS=1
      args+=(--force-image) ;;
    partial)
      export STUB_SERVICE=missing STUB_JOB=missing STUB_DB_SECRET=no-version STUB_SEED_SECRET=absent STUB_USER_EXISTS=1 ;;
    job_exists)
      export STUB_SERVICE=missing STUB_JOB=present STUB_DB_SECRET=version STUB_SEED_SECRET=version STUB_USER_EXISTS=1
      args+=(--demo) ;;
    job-fail)
      export STUB_SERVICE=missing STUB_JOB=missing STUB_DB_SECRET=absent STUB_SEED_SECRET=absent STUB_USER_EXISTS=0 STUB_JOB_FAIL=1 ;;
    demo)
      export STUB_SERVICE=missing STUB_JOB=missing STUB_DB_SECRET=absent STUB_SEED_SECRET=absent STUB_USER_EXISTS=0
      args+=(--demo) ;;
    seed_once)
      export STUB_SERVICE=present STUB_JOB=present STUB_DB_SECRET=version STUB_SEED_SECRET=version STUB_USER_EXISTS=1
      args+=(--seed-once) ;;
  esac
  export STUB_MODE="$MODE"
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-$MODE.log"
  rm -f "$TEST_STATE_DIR/sql-pass" "$TEST_STATE_DIR"/payload-*
  result=0
  bash "$DEPLOY_SCRIPT" "${args[@]}" > "$TEST_STATE_DIR/output" 2>&1 || result=$?
  expected=0
  if [ "$MODE" = job-fail ]; then expected=1; fi
  if [ "$result" -ne "$expected" ]; then
    echo "FAIL $MODE: unexpected exit $result (wanted $expected)"
    cat "$TEST_STATE_DIR/output"
    exit 1
  fi

  # No project-wide secret access, ever.
  if grep -q '^projects add-iam-policy-binding .*roles/secretmanager.secretAccessor' "$GCLOUD_LOG"; then
    echo 'FAIL: runtime has project-wide secret access'; exit 1
  fi

  # Per-scenario expectations.
  case "$MODE" in
    first_run)
      grep -q '^run deploy ' "$GCLOUD_LOG"
      grep -q '^builds submit ' "$GCLOUD_LOG"
      grep -q -- '--edition=enterprise' "$GCLOUD_LOG"
      grep -q -- '--no-storage-auto-increase' "$GCLOUD_LOG"
      grep -q '^sql users create ' "$GCLOUD_LOG"
      grep -q '^secrets add-iam-policy-binding pangtao-database-url ' "$GCLOUD_LOG"
      if grep -q 'db seed' "$GCLOUD_LOG"; then echo 'FAIL: seeded without --demo'; exit 1; fi
      if grep -q '^run jobs update ' "$GCLOUD_LOG"; then echo 'FAIL: updated the job on a first run'; exit 1; fi ;;
    rerun)
      if grep -q '^run deploy ' "$GCLOUD_LOG"; then echo 'FAIL: rerun rolled the service forward/back'; exit 1; fi
      if grep -q '^builds submit ' "$GCLOUD_LOG"; then echo 'FAIL: rerun rebuilt the image'; exit 1; fi
      if grep -Eq '^(secrets create|sql users (create|set-password)) ' "$GCLOUD_LOG"; then
        echo 'FAIL: rerun replaced existing credentials'; exit 1
      fi ;;
    rerun_force)
      grep -q '^run deploy ' "$GCLOUD_LOG"
      grep -q '^builds submit ' "$GCLOUD_LOG"
      if grep -Eq '^(secrets create|sql users (create|set-password)) ' "$GCLOUD_LOG"; then
        echo 'FAIL: --force-image replaced existing credentials'; exit 1
      fi ;;
    partial)
      grep -q '^sql users set-password ' "$GCLOUD_LOG"
      grep -q '^secrets versions add pangtao-database-url' "$GCLOUD_LOG"
      if grep -q '^secrets create pangtao-database-url' "$GCLOUD_LOG"; then
        echo 'FAIL: recreated an existing secret instead of adding a version'; exit 1
      fi ;;
    job_exists)
      grep -q '^run deploy ' "$GCLOUD_LOG"
      if grep -q 'db seed' "$GCLOUD_LOG"; then echo 'FAIL: reseeded although the job already existed'; exit 1; fi
      if grep -q '^secrets add-iam-policy-binding pangtao-seed-password ' "$GCLOUD_LOG"; then
        echo 'FAIL: granted the seed secret although the seed was skipped'; exit 1
      fi ;;
    job-fail)
      if grep -q '^run deploy ' "$GCLOUD_LOG"; then echo 'FAIL: service deployed after migration failure'; exit 1; fi ;;
    demo)
      grep -q '^run jobs update .*db seed' "$GCLOUD_LOG"
      grep -q '^secrets add-iam-policy-binding pangtao-seed-password ' "$GCLOUD_LOG"
      # The seed secret must be detached and its binding revoked afterwards.
      grep -q -- '^run jobs update pangtao-migrate --remove-secrets=SEED_DEFAULT_PASSWORD --args -c,npx prisma migrate deploy' "$GCLOUD_LOG"
      grep -q '^secrets remove-iam-policy-binding pangtao-seed-password ' "$GCLOUD_LOG"
      grep -q '^run deploy ' "$GCLOUD_LOG" ;;
    seed_once)
      grep -q '^run jobs update .*db seed' "$GCLOUD_LOG"
      grep -q -- '^run jobs update pangtao-migrate --remove-secrets=SEED_DEFAULT_PASSWORD --args -c,npx prisma migrate deploy' "$GCLOUD_LOG"
      grep -q '^secrets remove-iam-policy-binding pangtao-seed-password ' "$GCLOUD_LOG"
      if grep -q '^run deploy ' "$GCLOUD_LOG"; then echo 'FAIL: --seed-once rolled out an image'; exit 1; fi
      if grep -q '^builds submit ' "$GCLOUD_LOG"; then echo 'FAIL: --seed-once rebuilt the image'; exit 1; fi ;;
  esac

  # The DB password and the password inside DATABASE_URL must match, and no
  # secret value may reach the output.
  if [ -f "$TEST_STATE_DIR/sql-pass" ]; then
    db_pass="$(cat "$TEST_STATE_DIR/sql-pass")"
    db_url="$(cat "$TEST_STATE_DIR/payload-pangtao-database-url")"
    case "$db_url" in
      "postgresql://pangtao:${db_pass}@"*) ;;
      *) echo 'FAIL: DB password differs from secret'; exit 1 ;;
    esac
    if grep -Fq "$db_pass" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: DB password leaked to output'; exit 1
    fi
  fi
  for secret_file in "$TEST_STATE_DIR"/payload-*; do
    [ -f "$secret_file" ] || continue
    secret_value="$(cat "$secret_file")"
    if [ -n "$secret_value" ] && grep -Fq "$secret_value" "$TEST_STATE_DIR/output"; then
      echo 'FAIL: secret payload leaked to output'; exit 1
    fi
  done
  echo "PASS: $MODE (exit, migration gate, credential handling, secret redaction)"
done

# --- Dry run must not call gcloud at all ------------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/dry-run-calls"
DRY_RUN=1 bash "$DEPLOY_SCRIPT" --demo > "$TEST_STATE_DIR/dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then
  echo 'FAIL: dry run called gcloud'; exit 1
fi
echo 'PASS: dry run makes no gcloud calls'
