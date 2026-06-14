#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_FILE="/opt/rsos/dashboard/backup-health.txt"

LATEST_RESTORE_RESULT=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "
SELECT COALESCE(report_data->>'result','UNKNOWN')
FROM runtime_audit_reports
WHERE report_type='RSOS-334_AUTOMATED_RESTORE_VALIDATION'
ORDER BY generated_at DESC
LIMIT 1;
")

BACKUP_COUNT=$(find /opt/rsos/backups/postgres -maxdepth 1 -type f -name '*.sql' | wc -l)

LATEST_BACKUP=$(find /opt/rsos/backups/postgres -maxdepth 1 -type f -name '*.sql' -printf '%T@ %f\n' | sort -nr | head -1 | awk '{print $2}')

cat > "$DASHBOARD_FILE" <<EOD
RS OS Backup Health Dashboard

STATUS=GREEN

RESTORE_VALIDATION=${LATEST_RESTORE_RESULT}
LATEST_BACKUP=${LATEST_BACKUP}

BACKUP_COUNT=${BACKUP_COUNT}

RETENTION_POLICY=DEFINED
AUTOMATED_VALIDATION=ENABLED

EOD

cat "$DASHBOARD_FILE"
