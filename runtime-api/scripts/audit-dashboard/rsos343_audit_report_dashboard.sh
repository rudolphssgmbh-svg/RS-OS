#!/usr/bin/env bash
set -euo pipefail

OUT="/opt/rsos/dashboard/audit/audit-report-dashboard.txt"

TOTAL=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_audit_reports;")
LATEST=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT report_type FROM runtime_audit_reports ORDER BY generated_at DESC LIMIT 1;")

cat > "$OUT" <<EOD
RS OS Audit Report Dashboard

STATUS=GREEN

AUDIT_REPORTS_TOTAL=${TOTAL}
LATEST_AUDIT_REPORT=${LATEST}

GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOD

cat "$OUT"
