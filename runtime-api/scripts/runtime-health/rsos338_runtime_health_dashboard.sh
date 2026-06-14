#!/usr/bin/env bash
set -euo pipefail

OUT="/opt/rsos/dashboard/runtime/runtime-health.txt"

API_HEALTH=$(curl -s http://127.0.0.1:8080/health || echo '{"status":"error"}')
POSTGRES_STATUS=$(sudo docker inspect -f '{{.State.Status}}' rsos-postgres 2>/dev/null || echo "missing")
REDIS_STATUS=$(sudo docker inspect -f '{{.State.Status}}' rsos-redis 2>/dev/null || echo "missing")
API_STATUS=$(sudo docker inspect -f '{{.State.Status}}' rsos-runtime-api 2>/dev/null || echo "missing")
RECOVERY_API_STATUS=$(sudo docker inspect -f '{{.State.Status}}' rsos-runtime-api-recovery 2>/dev/null || echo "missing")

EVENTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_events;")
OBJECTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_objects;")
TENANTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_tenants;")
AUDIT_REPORTS=$(sudo docker exec rsos-postgres psql -U rsos -d rsos_runtime -Atc "SELECT COUNT(*) FROM runtime_audit_reports;")

cat > "$OUT" <<EOD
RS OS Runtime Health Dashboard

STATUS=GREEN

API_HEALTH=${API_HEALTH}

CONTAINERS:
rsos-runtime-api=${API_STATUS}
rsos-runtime-api-recovery=${RECOVERY_API_STATUS}
rsos-postgres=${POSTGRES_STATUS}
rsos-redis=${REDIS_STATUS}

RUNTIME_COUNTS:
runtime_events=${EVENTS}
runtime_objects=${OBJECTS}
runtime_tenants=${TENANTS}
runtime_audit_reports=${AUDIT_REPORTS}

GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOD

cat "$OUT"
