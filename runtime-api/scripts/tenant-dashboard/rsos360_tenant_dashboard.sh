#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
OUT="$DASHBOARD_ROOT/tenant/tenant-dashboard.txt"

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

TENANT_TOTAL="$(
  db_scalar "
    SELECT COUNT(*)
    FROM runtime_tenants;
  "
)"

NON_ACTIVE_TENANTS="$(
  db_scalar "
    SELECT COUNT(*)
    FROM runtime_tenants
    WHERE lower(COALESCE(status, 'unknown')) <> 'active';
  "
)"

OVERVIEW_FILE="$(mktemp)"
trap 'rm -f "$OVERVIEW_FILE"' EXIT

if sudo docker exec rsos-postgres \
  psql -U rsos -d rsos_runtime -X -P pager=off -c "
    SELECT
      t.tenant_id,
      t.tenant_name,
      t.tenant_type,
      t.status,
      COUNT(DISTINCT o.object_id) AS objects,
      COUNT(DISTINCT e.event_id) AS events,
      COUNT(DISTINCT m.member_id) AS members
    FROM runtime_tenants t
    LEFT JOIN runtime_objects o
      ON o.tenant_id = t.tenant_id
    LEFT JOIN runtime_events e
      ON e.tenant_id = t.tenant_id
    LEFT JOIN runtime_tenant_members m
      ON m.tenant_id = t.tenant_id
    GROUP BY
      t.tenant_id,
      t.tenant_name,
      t.tenant_type,
      t.status
    ORDER BY t.tenant_name;
  " > "$OVERVIEW_FILE" 2>&1; then
  QUERY_STATUS="GREEN"
else
  QUERY_STATUS="UNKNOWN"
fi

if [[ "$TENANT_TOTAL" =~ ^[0-9]+$ ]] &&
   (( TENANT_TOTAL > 0 )) &&
   [[ "$NON_ACTIVE_TENANTS" =~ ^[0-9]+$ ]]; then
  if (( NON_ACTIVE_TENANTS == 0 )); then
    TENANT_STATE_STATUS="GREEN"
  else
    TENANT_STATE_STATUS="REVIEW_REQUIRED"
  fi
else
  TENANT_STATE_STATUS="UNKNOWN"
fi

OVERALL_STATUS="$(
  worst_status \
    "$QUERY_STATUS" \
    "$TENANT_STATE_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

{
  echo "RS OS Tenant Dashboard"
  echo
  echo "STATUS=${OVERALL_STATUS}"
  echo "QUERY_STATUS=${QUERY_STATUS}"
  echo "TENANT_STATE_STATUS=${TENANT_STATE_STATUS}"
  echo
  echo "TENANTS_TOTAL=${TENANT_TOTAL:-UNKNOWN}"
  echo "NON_ACTIVE_TENANTS=${NON_ACTIVE_TENANTS:-UNKNOWN}"
  echo
  echo "RUN_ID=${RUN_ID}"
  echo "GENERATED_AT=${GENERATED_AT}"
  echo
  echo "TENANT_OVERVIEW:"
  cat "$OVERVIEW_FILE"
} > "$TEMP_FILE"

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
