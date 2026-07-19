#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
OUT="$DASHBOARD_ROOT/unified/unified-dashboard.txt"

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

BACKUP_STATUS="$(
  normalize_status \
    "$(read_dashboard_value "$BACKUP_FILE" STATUS UNKNOWN)"
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
    "$GOVERNANCE_FILE"
)"

OVERALL_STATUS="$(
  worst_status \
    "$BACKUP_STATUS" \
    "$RUNTIME_STATUS" \
    "$AUDIT_STATUS" \
    "$TENANT_STATUS" \
    "$OPERATIONS_STATUS" \
    "$GOVERNANCE_STATUS" \
    "$COUNTS_STATUS" \
    "$SNAPSHOT_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

cat > "$TEMP_FILE" <<EOD
RS OS Unified Dashboard

OVERALL_STATUS=${OVERALL_STATUS}
BACKUP_STATUS=${BACKUP_STATUS}
RUNTIME_STATUS=${RUNTIME_STATUS}
AUDIT_STATUS=${AUDIT_STATUS}
TENANT_STATUS=${TENANT_STATUS}
OPERATIONS_STATUS=${OPERATIONS_STATUS}
GOVERNANCE_STATUS=${GOVERNANCE_STATUS}
COUNTS_STATUS=${COUNTS_STATUS}
SNAPSHOT_STATUS=${SNAPSHOT_STATUS}

AUDIT_REPORTS=${AUDIT_REPORTS}
RUNTIME_EVENTS=${RUNTIME_EVENTS}
TENANTS=${TENANTS}

RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
