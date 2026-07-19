#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
REPO_ROOT="${RSOS_REPO_ROOT:-/opt/rsos}"
OUT="$DASHBOARD_ROOT/master/master-dashboard.txt"

source "$COMMON_LIBRARY"

require_dashboard_orchestrator

RUN_ID="$(dashboard_run_id)"
GENERATED_AT="$(dashboard_generated_at)"

mkdir -p "$(dirname "$OUT")"

BACKUP_FILE="$DASHBOARD_ROOT/backup-health.txt"
RUNTIME_FILE="$DASHBOARD_ROOT/runtime/runtime-health.txt"
AUDIT_FILE="$DASHBOARD_ROOT/audit/audit-report-dashboard.txt"
TENANT_FILE="$DASHBOARD_ROOT/tenant/tenant-dashboard.txt"
OPERATIONS_FILE="$DASHBOARD_ROOT/operations/operations-health.txt"
GOVERNANCE_FILE="$DASHBOARD_ROOT/governance/governance-health.txt"
UNIFIED_FILE="$DASHBOARD_ROOT/unified/unified-dashboard.txt"

BACKUP_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$BACKUP_FILE" STATUS UNKNOWN)"
)"

RESTORE_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$BACKUP_FILE" RESTORE_STATUS UNKNOWN)"
)"

RUNTIME_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$RUNTIME_FILE" STATUS UNKNOWN)"
)"

AUDIT_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$AUDIT_FILE" STATUS UNKNOWN)"
)"

TENANT_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$TENANT_FILE" STATUS UNKNOWN)"
)"

OPERATIONS_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$OPERATIONS_FILE" OVERALL_STATUS UNKNOWN)"
)"

GOVERNANCE_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$GOVERNANCE_FILE" OVERALL_STATUS UNKNOWN)"
)"

UNIFIED_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$UNIFIED_FILE" OVERALL_STATUS UNKNOWN)"
)"

AUDIT_REPORTS="$(
  read_dashboard_value \
    "$AUDIT_FILE" \
    AUDIT_REPORTS_TOTAL \
    UNKNOWN
)"

RUNTIME_EVENTS="$(
  read_dashboard_value \
    "$RUNTIME_FILE" \
    runtime_events \
    UNKNOWN
)"

TENANTS="$(
  read_dashboard_value \
    "$TENANT_FILE" \
    TENANTS_TOTAL \
    UNKNOWN
)"

if [[ "$AUDIT_REPORTS" =~ ^[0-9]+$ ]] &&
   [[ "$RUNTIME_EVENTS" =~ ^[0-9]+$ ]] &&
   [[ "$TENANTS" =~ ^[0-9]+$ ]]; then
  COUNTS_STATUS="GREEN"
else
  COUNTS_STATUS="UNKNOWN"
fi

SNAPSHOT_STATUS="$(
  snapshot_consistency_status \
    "$RUN_ID" \
    "$GENERATED_AT" \
    "$BACKUP_FILE" \
    "$RUNTIME_FILE" \
    "$AUDIT_FILE" \
    "$TENANT_FILE" \
    "$OPERATIONS_FILE" \
    "$GOVERNANCE_FILE" \
    "$UNIFIED_FILE"
)"

GITHUB_COMMIT="UNKNOWN"
GITHUB_COMMIT_FULL="UNKNOWN"
GIT_REFERENCE_STATUS="UNKNOWN"

if GITHUB_COMMIT_FULL="$(
  git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null
)"; then
  GITHUB_COMMIT="$(
    git -C "$REPO_ROOT" rev-parse --short=12 HEAD 2>/dev/null
  )"
  GIT_REFERENCE_STATUS="GREEN"
fi

WORKTREE_STATE="UNKNOWN"
WORKTREE_STATUS="UNKNOWN"
WORKTREE_INCLUDED_IN_EXECUTIVE_STATUS="YES"

if WORKTREE_OUTPUT="$(
  git -C "$REPO_ROOT" status --porcelain=v1 2>/dev/null
)"; then
  if [[ -n "$WORKTREE_OUTPUT" ]]; then
    WORKTREE_STATE="DIRTY"
    WORKTREE_STATUS="REVIEW_REQUIRED"
  else
    WORKTREE_STATE="CLEAN"
    WORKTREE_STATUS="GREEN"
  fi
fi

CRONTAB_TEXT="$(
  crontab -l 2>/dev/null || true
)"

CRONJOBS="$(
  printf '%s\n' "$CRONTAB_TEXT" |
    awk 'NF && $1 !~ /^#/ { count++ } END { print count + 0 }'
)"

LEGACY_DASHBOARD_CRON_COUNT="$(
  printf '%s\n' "$CRONTAB_TEXT" |
    grep -Ec \
      'rsos(337_generate_backup_dashboard|338_runtime_health_dashboard|340_operations_dashboard|343_audit_report_dashboard|345_governance_dashboard|351_unified_dashboard|356_master_dashboard|360_tenant_dashboard)\.sh' \
    || true
)"

ORCHESTRATOR_CRON_COUNT="$(
  printf '%s\n' "$CRONTAB_TEXT" |
    grep -Fc 'rsos_dashboard_refresh_all.sh' \
    || true
)"

CRON_STATUS="UNKNOWN"
DASHBOARD_CRON_CONTRACT="MISSING"

if [[ "$ORCHESTRATOR_CRON_COUNT" == "1" ]] &&
   [[ "$LEGACY_DASHBOARD_CRON_COUNT" == "0" ]]; then
  CRON_STATUS="GREEN"
  DASHBOARD_CRON_CONTRACT="SEQUENTIAL"
elif [[ "$ORCHESTRATOR_CRON_COUNT" == "0" ]] &&
     (( LEGACY_DASHBOARD_CRON_COUNT > 0 )); then
  CRON_STATUS="RED"
  DASHBOARD_CRON_CONTRACT="LEGACY_PARALLEL"
elif (( ORCHESTRATOR_CRON_COUNT > 0 )) &&
     (( LEGACY_DASHBOARD_CRON_COUNT > 0 )); then
  CRON_STATUS="RED"
  DASHBOARD_CRON_CONTRACT="MIXED"
elif (( ORCHESTRATOR_CRON_COUNT > 1 )); then
  CRON_STATUS="RED"
  DASHBOARD_CRON_CONTRACT="DUPLICATE_ORCHESTRATORS"
fi

BASELINE_SNAPSHOT="UNKNOWN"
BASELINE_STATUS="REVIEW_REQUIRED"
BASELINE_CONTRACT="UNRESOLVED"
BASELINE_INCLUDED_IN_EXECUTIVE_STATUS="YES"

EXECUTIVE_STATUS="$(
  worst_status \
    "$BACKUP_STATUS" \
    "$RESTORE_STATUS" \
    "$RUNTIME_STATUS" \
    "$AUDIT_STATUS" \
    "$TENANT_STATUS" \
    "$OPERATIONS_STATUS" \
    "$GOVERNANCE_STATUS" \
    "$UNIFIED_STATUS" \
    "$COUNTS_STATUS" \
    "$SNAPSHOT_STATUS" \
    "$GIT_REFERENCE_STATUS" \
    "$WORKTREE_STATUS" \
    "$CRON_STATUS" \
    "$BASELINE_STATUS"
)"

RESULT="$(
  status_to_result "$EXECUTIVE_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

cat > "$TEMP_FILE" <<EOD
RS OS Master Dashboard

EXECUTIVE_STATUS=${EXECUTIVE_STATUS}
RESULT=${RESULT}

BACKUP=${BACKUP_STATUS}
RESTORE=${RESTORE_STATUS}
RUNTIME=${RUNTIME_STATUS}
AUDIT=${AUDIT_STATUS}
TENANT=${TENANT_STATUS}
OPERATIONS=${OPERATIONS_STATUS}
GOVERNANCE=${GOVERNANCE_STATUS}
UNIFIED=${UNIFIED_STATUS}

COUNTS_STATUS=${COUNTS_STATUS}
SNAPSHOT_STATUS=${SNAPSHOT_STATUS}
GIT_REFERENCE_STATUS=${GIT_REFERENCE_STATUS}
CRON_STATUS=${CRON_STATUS}
WORKTREE_STATE=${WORKTREE_STATE}
WORKTREE_STATUS=${WORKTREE_STATUS}
WORKTREE_INCLUDED_IN_EXECUTIVE_STATUS=${WORKTREE_INCLUDED_IN_EXECUTIVE_STATUS}
DASHBOARD_CRON_CONTRACT=${DASHBOARD_CRON_CONTRACT}
LEGACY_DASHBOARD_CRON_COUNT=${LEGACY_DASHBOARD_CRON_COUNT}
ORCHESTRATOR_CRON_COUNT=${ORCHESTRATOR_CRON_COUNT}

AUDIT_REPORTS=${AUDIT_REPORTS}
RUNTIME_EVENTS=${RUNTIME_EVENTS}
TENANTS=${TENANTS}
CRONJOBS=${CRONJOBS}

GITHUB_COMMIT=${GITHUB_COMMIT}
GITHUB_COMMIT_FULL=${GITHUB_COMMIT_FULL}

BASELINE_SNAPSHOT=${BASELINE_SNAPSHOT}
BASELINE_STATUS=${BASELINE_STATUS}
BASELINE_CONTRACT=${BASELINE_CONTRACT}
BASELINE_INCLUDED_IN_EXECUTIVE_STATUS=${BASELINE_INCLUDED_IN_EXECUTIVE_STATUS}

RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
