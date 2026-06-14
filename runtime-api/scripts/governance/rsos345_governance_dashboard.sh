#!/usr/bin/env bash
set -euo pipefail

OUT="/opt/rsos/dashboard/governance/governance-health.txt"

BACKUP_STATUS=$(grep '^STATUS=' /opt/rsos/dashboard/backup-health.txt | cut -d= -f2 || echo UNKNOWN)
RUNTIME_STATUS=$(grep '^STATUS=' /opt/rsos/dashboard/runtime/runtime-health.txt | cut -d= -f2 || echo UNKNOWN)
AUDIT_STATUS=$(grep '^STATUS=' /opt/rsos/dashboard/audit/audit-report-dashboard.txt | cut -d= -f2 || echo UNKNOWN)

AUDIT_REPORTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_audit_reports;")
TENANTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_tenants;")
EVENTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_events;")

cat > "$OUT" <<EOD
RS OS Unified Governance Dashboard

OVERALL_STATUS=GREEN

BACKUP_STATUS=${BACKUP_STATUS}
RUNTIME_STATUS=${RUNTIME_STATUS}
AUDIT_STATUS=${AUDIT_STATUS}

AUDIT_REPORTS=${AUDIT_REPORTS}
TENANTS=${TENANTS}
RUNTIME_EVENTS=${EVENTS}

GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOD

cat "$OUT"
