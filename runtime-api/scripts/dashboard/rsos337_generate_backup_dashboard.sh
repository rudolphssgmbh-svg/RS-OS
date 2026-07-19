#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")" &&
    pwd
)"

COMMON_LIBRARY="${RSOS_DASHBOARD_COMMON:-$SCRIPT_DIR/../lib/rsos-dashboard-status.sh}"
DASHBOARD_ROOT="${RSOS_DASHBOARD_ROOT:-/opt/rsos/dashboard}"
BACKUP_DIR="${RSOS_BACKUP_DIR:-/opt/rsos/backups/postgres}"
OUT="$DASHBOARD_ROOT/backup-health.txt"

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

canonical_path() {
  local value="${1:-}"

  if [[ -z "$value" ]]; then
    return 1
  fi

  realpath -m -- "$value" 2>/dev/null
}

LATEST_RESTORE_RESULT="$(
  db_scalar "
    SELECT COALESCE(report_data ->> 'result', 'UNKNOWN')
    FROM runtime_audit_reports
    WHERE report_type = 'RSOS-334_AUTOMATED_RESTORE_VALIDATION'
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

LATEST_RESTORE_REPORT_STATUS="$(
  db_scalar "
    SELECT COALESCE(report_status, 'UNKNOWN')
    FROM runtime_audit_reports
    WHERE report_type = 'RSOS-334_AUTOMATED_RESTORE_VALIDATION'
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

LATEST_VALIDATED_BACKUP="$(
  db_scalar "
    SELECT COALESCE(report_data ->> 'backup_file', '')
    FROM runtime_audit_reports
    WHERE report_type = 'RSOS-334_AUTOMATED_RESTORE_VALIDATION'
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

LATEST_RESTORE_GENERATED_AT="$(
  db_scalar "
    SELECT COALESCE(generated_at::text, '')
    FROM runtime_audit_reports
    WHERE report_type = 'RSOS-334_AUTOMATED_RESTORE_VALIDATION'
    ORDER BY generated_at DESC, report_id DESC
    LIMIT 1;
  "
)"

BACKUP_LIST_FILE="$(mktemp)"
trap 'rm -f "$BACKUP_LIST_FILE"' EXIT

BACKUP_DIRECTORY_STATUS="UNKNOWN"
INVENTORY_STATUS="UNKNOWN"
BACKUP_COUNT="0"
LATEST_BACKUP=""

if [[ -d "$BACKUP_DIR" ]] &&
   [[ -r "$BACKUP_DIR" ]] &&
   find "$BACKUP_DIR" \
     -maxdepth 1 \
     -type f \
     -name '*.sql' \
     -print \
     > "$BACKUP_LIST_FILE" 2>/dev/null; then

  BACKUP_DIRECTORY_STATUS="GREEN"

  BACKUP_COUNT="$(
    wc -l < "$BACKUP_LIST_FILE" |
      tr -d '[:space:]'
  )"

  if [[ "$BACKUP_COUNT" =~ ^[0-9]+$ ]] &&
     (( BACKUP_COUNT > 0 )); then

    INVENTORY_STATUS="GREEN"

    LATEST_BACKUP="$(
      find "$BACKUP_DIR" \
        -maxdepth 1 \
        -type f \
        -name '*.sql' \
        -printf '%T@ %f\n' \
        2>/dev/null |
        sort -nr |
        head -n 1 |
        sed 's/^[^ ]* //' || true
    )"

    if [[ -z "$LATEST_BACKUP" ]]; then
      INVENTORY_STATUS="UNKNOWN"
    fi
  else
    INVENTORY_STATUS="RED"
  fi
fi

LATEST_BACKUP_PATH=""

if [[ -n "$LATEST_BACKUP" ]]; then
  LATEST_BACKUP_PATH="$BACKUP_DIR/$LATEST_BACKUP"
fi

RESTORE_STATUS="$(
  result_to_status "${LATEST_RESTORE_RESULT:-UNKNOWN}"
)"

VALIDATED_BACKUP_MATCH="UNKNOWN"
VALIDATION_TARGET_STATUS="UNKNOWN"

if [[ -n "$LATEST_BACKUP_PATH" ]] &&
   [[ -n "$LATEST_VALIDATED_BACKUP" ]]; then

  if [[ "$(canonical_path "$LATEST_VALIDATED_BACKUP")" ==         "$(canonical_path "$LATEST_BACKUP_PATH")" ]]; then
    VALIDATED_BACKUP_MATCH="YES"
    VALIDATION_TARGET_STATUS="GREEN"
  else
    VALIDATED_BACKUP_MATCH="NO"
    VALIDATION_TARGET_STATUS="REVIEW_REQUIRED"
  fi
fi

CRONTAB_TEXT="$(
  crontab -l 2>/dev/null || true
)"

RESTORE_CRON_LINE="$(
  printf '%s\n' "$CRONTAB_TEXT" |
    grep -F 'rsos334_restore_validation.sh' |
    head -n 1 || true
)"

AUTOMATED_VALIDATION="DISABLED"
AUTOMATION_STATUS="REVIEW_REQUIRED"
AUTOMATION_TARGET="UNKNOWN"
AUTOMATION_TARGET_STATUS="UNKNOWN"

if [[ -n "$RESTORE_CRON_LINE" ]]; then
  AUTOMATED_VALIDATION="ENABLED"
  AUTOMATION_STATUS="GREEN"

  AUTOMATION_TARGET="$(
    printf '%s\n' "$RESTORE_CRON_LINE" |
      sed -nE \
        's#.*rsos334_restore_validation\.sh[[:space:]]+([^[:space:]]+).*#\1#p'
  )"

  if [[ -z "$AUTOMATION_TARGET" ]]; then
    AUTOMATION_TARGET="UNKNOWN"
    AUTOMATION_TARGET_STATUS="UNKNOWN"
  elif [[ ! -f "$AUTOMATION_TARGET" ]]; then
    AUTOMATION_TARGET_STATUS="RED"
  elif [[ -z "$LATEST_BACKUP_PATH" ]]; then
    AUTOMATION_TARGET_STATUS="UNKNOWN"
  elif [[ "$(canonical_path "$AUTOMATION_TARGET")" ==           "$(canonical_path "$LATEST_BACKUP_PATH")" ]]; then
    AUTOMATION_TARGET_STATUS="GREEN"
  else
    AUTOMATION_TARGET_STATUS="REVIEW_REQUIRED"
  fi
fi

RETENTION_POLICY="UNVERIFIED"
RETENTION_STATUS="REVIEW_REQUIRED"

OVERALL_STATUS="$(
  worst_status \
    "$BACKUP_DIRECTORY_STATUS" \
    "$INVENTORY_STATUS" \
    "$RESTORE_STATUS" \
    "$VALIDATION_TARGET_STATUS" \
    "$AUTOMATION_STATUS" \
    "$AUTOMATION_TARGET_STATUS" \
    "$RETENTION_STATUS"
)"

TEMP_FILE="$(mktemp "${OUT}.tmp.XXXXXX")"

cat > "$TEMP_FILE" <<EOD
RS OS Backup Health Dashboard

STATUS=${OVERALL_STATUS}
BACKUP_DIRECTORY_STATUS=${BACKUP_DIRECTORY_STATUS}
BACKUP_INVENTORY_STATUS=${INVENTORY_STATUS}
RESTORE_STATUS=${RESTORE_STATUS}
VALIDATION_TARGET_STATUS=${VALIDATION_TARGET_STATUS}
AUTOMATION_STATUS=${AUTOMATION_STATUS}
AUTOMATION_TARGET_STATUS=${AUTOMATION_TARGET_STATUS}
RETENTION_STATUS=${RETENTION_STATUS}

RESTORE_VALIDATION=${LATEST_RESTORE_RESULT:-UNKNOWN}
RESTORE_REPORT_STATUS=${LATEST_RESTORE_REPORT_STATUS:-UNKNOWN}
LATEST_VALIDATED_BACKUP=${LATEST_VALIDATED_BACKUP:-UNKNOWN}
VALIDATED_BACKUP_MATCH=${VALIDATED_BACKUP_MATCH}
LATEST_RESTORE_GENERATED_AT=${LATEST_RESTORE_GENERATED_AT:-UNKNOWN}

LATEST_BACKUP=${LATEST_BACKUP:-UNKNOWN}
LATEST_BACKUP_PATH=${LATEST_BACKUP_PATH:-UNKNOWN}
BACKUP_COUNT=${BACKUP_COUNT}

AUTOMATED_VALIDATION=${AUTOMATED_VALIDATION}
AUTOMATION_TARGET=${AUTOMATION_TARGET}
RETENTION_POLICY=${RETENTION_POLICY}

RUN_ID=${RUN_ID}
GENERATED_AT=${GENERATED_AT}
EOD

mv "$TEMP_FILE" "$OUT"
cat "$OUT"
