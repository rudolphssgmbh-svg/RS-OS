#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
OUT="$DASHBOARD_ROOT/runtime/runtime-health.txt"

source "$COMMON_LIBRARY"

require_dashboard_orchestrator

RUN_ID="$(dashboard_run_id)"
GENERATED_AT="$(dashboard_generated_at)"

mkdir -p "$(dirname "$OUT")"

container_state() {
  local container="$1"

  sudo docker inspect \
    -f '{{.State.Status}}' \
    "$container" \
    2>/dev/null || printf '%s\n' "missing"
}

required_container_status() {
  case "${1:-missing}" in
    running)
      printf '%s\n' "GREEN"
      ;;
    missing)
      printf '%s\n' "UNKNOWN"
      ;;
    *)
      printf '%s\n' "RED"
      ;;
  esac
}

db_count() {
  local table="$1"

  sudo docker exec rsos-postgres \
    psql -U rsos -d rsos_runtime -X -Atc \
    "SELECT COUNT(*) FROM ${table};" \
    2>/dev/null || printf '%s\n' "UNKNOWN"
}

API_HEALTH="$(
  curl -fsS http://127.0.0.1:8080/health \
    2>/dev/null || true
)"

if [[ -z "$API_HEALTH" ]]; then
  API_HEALTH='{"status":"unknown"}'
  API_STATUS="UNKNOWN"
elif [[ "$API_HEALTH" == *'"status":"ok"'* ]] &&
     [[ "$API_HEALTH" == *'"runtime":"healthy"'* ]] &&
     [[ "$API_HEALTH" == *'"database":"connected"'* ]]; then
  API_STATUS="GREEN"
else
  API_STATUS="RED"
fi

POSTGRES_STATE="$(container_state rsos-postgres)"
REDIS_STATE="$(container_state rsos-redis)"
RUNTIME_API_STATE="$(container_state rsos-runtime-api)"
RECOVERY_API_STATE="$(container_state rsos-runtime-api-recovery)"

POSTGRES_STATUS="$(required_container_status "$POSTGRES_STATE")"
REDIS_STATUS="$(required_container_status "$REDIS_STATE")"
RUNTIME_API_STATUS="$(required_container_status "$RUNTIME_API_STATE")"

case "$RECOVERY_API_STATE" in
  running)
    RECOVERY_STATUS="GREEN"
    ;;
  exited)
    RECOVERY_STATUS="REVIEW_REQUIRED"
    ;;
  missing)
    RECOVERY_STATUS="UNKNOWN"
    ;;
  *)
    RECOVERY_STATUS="REVIEW_REQUIRED"
    ;;
esac

EVENTS="$(db_count runtime_events)"
OBJECTS="$(db_count runtime_objects)"
TENANTS="$(db_count runtime_tenants)"
AUDIT_REPORTS="$(db_count runtime_audit_reports)"

if [[ "$EVENTS" =~ ^[0-9]+$ ]] &&
   [[ "$OBJECTS" =~ ^[0-9]+$ ]] &&
   [[ "$TENANTS" =~ ^[0-9]+$ ]] &&
   [[ "$AUDIT_REPORTS" =~ ^[0-9]+$ ]]; then
  COUNTS_STATUS="GREEN"
else
  COUNTS_STATUS="UNKNOWN"
fi

CORE_STATUS="$(
  worst_status \
    "$API_STATUS" \
    "$POSTGRES_STATUS" \
    "$REDIS_STATUS" \
    "$RUNTIME_API_STATUS" \
    "$COUNTS_STATUS"
)"

OVERALL_STATUS="$(
  worst_status \
    "$CORE_STATUS" \
    "$RECOVERY_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

cat > "$TEMP_FILE" <<EOD
RS OS Runtime Health Dashboard

STATUS=${OVERALL_STATUS}
CORE_STATUS=${CORE_STATUS}
RECOVERY_STATUS=${RECOVERY_STATUS}
RECOVERY_CONTRACT=UNRESOLVED
COUNTS_STATUS=${COUNTS_STATUS}

API_STATUS=${API_STATUS}
API_HEALTH=${API_HEALTH}

CONTAINERS:
rsos-runtime-api=${RUNTIME_API_STATE}
rsos-runtime-api-recovery=${RECOVERY_API_STATE}
rsos-postgres=${POSTGRES_STATE}
rsos-redis=${REDIS_STATE}

RUNTIME_COUNTS:
runtime_events=${EVENTS}
runtime_objects=${OBJECTS}
runtime_tenants=${TENANTS}
runtime_audit_reports=${AUDIT_REPORTS}

RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
