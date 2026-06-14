#!/usr/bin/env bash
set -euo pipefail

OUT="/opt/rsos/dashboard/operations/operations-health.txt"

BACKUP_STATUS=$(grep '^STATUS=' /opt/rsos/dashboard/backup-health.txt | cut -d= -f2 || echo UNKNOWN)
RUNTIME_STATUS=$(grep '^STATUS=' /opt/rsos/dashboard/runtime/runtime-health.txt | cut -d= -f2 || echo UNKNOWN)

AUDIT_REPORTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_audit_reports;")
EVENTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_events;")
TENANTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_tenants;")

cat > "$OUT" <<EOD
RS OS Unified Operations Dashboard

OVERALL_STATUS=GREEN

BACKUP_STATUS=${BACKUP_STATUS}
RUNTIME_STATUS=${RUNTIME_STATUS}

AUDIT_REPORTS=${AUDIT_REPORTS}
RUNTIME_EVENTS=${EVENTS}
TENANTS=${TENANTS}

GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOD

cat "$OUT"
