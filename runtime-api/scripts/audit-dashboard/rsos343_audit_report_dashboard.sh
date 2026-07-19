#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
OUT="$DASHBOARD_ROOT/audit/audit-report-dashboard.txt"

source "$COMMON_LIBRARY"

require_dashboard_orchestrator

RUN_ID="$(dashboard_run_id)"
GENERATED_AT="$(dashboard_generated_at)"

mkdir -p "$(dirname "$OUT")"

db_scalar() {
  local sql="$1"

  sudo docker exec rsos-postgres \
    psql -U rsos -d rsos_runtime -X -Atc "$sql" \
    2>/dev/null || true
}

TOTAL="$(
  db_scalar "
    SELECT COUNT(*)
    FROM runtime_audit_reports;
  "
)"

FAILED_TOTAL="$(
  db_scalar "
    SELECT COUNT(*)
    FROM runtime_audit_reports
    WHERE lower(report_status) IN ('failed', 'error', 'rejected');
  "
)"

LATEST_TYPE="$(
  db_scalar "
    SELECT COALESCE(report_type, 'UNKNOWN')
    FROM runtime_audit_reports
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

LATEST_STATUS_RAW="$(
  db_scalar "
    SELECT COALESCE(report_status, 'UNKNOWN')
    FROM runtime_audit_reports
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

LATEST_GENERATED_AT="$(
  db_scalar "
    SELECT COALESCE(generated_at::text, '')
    FROM runtime_audit_reports
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

if [[ "$TOTAL" =~ ^[0-9]+$ ]] && (( TOTAL > 0 )); then
  COUNT_STATUS="GREEN"
  LATEST_STATUS="$(result_to_status "${LATEST_STATUS_RAW:-UNKNOWN}")"
else
  COUNT_STATUS="UNKNOWN"
  LATEST_STATUS="UNKNOWN"
fi

OVERALL_STATUS="$(
  worst_status \
    "$COUNT_STATUS" \
    "$LATEST_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

cat > "$TEMP_FILE" <<EOD
RS OS Audit Report Dashboard

STATUS=${OVERALL_STATUS}
COUNT_STATUS=${COUNT_STATUS}
LATEST_AUDIT_STATUS=${LATEST_STATUS}

AUDIT_REPORTS_TOTAL=${TOTAL:-UNKNOWN}
FAILED_AUDIT_REPORTS_TOTAL=${FAILED_TOTAL:-UNKNOWN}
LATEST_AUDIT_REPORT=${LATEST_TYPE:-UNKNOWN}
LATEST_AUDIT_REPORT_STATUS=${LATEST_STATUS_RAW:-UNKNOWN}
LATEST_AUDIT_REPORT_GENERATED_AT=${LATEST_GENERATED_AT:-UNKNOWN}

RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
