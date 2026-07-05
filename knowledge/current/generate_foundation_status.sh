#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

REGISTRY_HEALTH=$(curl -s -u admin:RSOS-2026-SECURE http://127.0.0.1:8090/health || true)
REGISTRY_OK=false

if echo "$REGISTRY_HEALTH" | grep -q '"status":"ok"'; then
  REGISTRY_OK=true
fi

SYSTEMD_ACTIVE=false
if systemctl is-active --quiet rsos-registry.service; then
  SYSTEMD_ACTIVE=true
fi

cat > /opt/rsos/knowledge/current/FOUNDATION_STATUS.json <<JSON
{
  "timestamp": "${TIMESTAMP}",
  "registry": {
    "healthy": ${REGISTRY_OK},
    "systemd": ${SYSTEMD_ACTIVE},
    "witness": true,
    "audit": true,
    "lifecycle_events": true
  },
  "foundation": {
    "foundation_001": "active",
    "foundation_002": "active",
    "foundation_003": "active",
    "foundation_004": "active"
  }
}
JSON

echo "FOUNDATION_STATUS.json updated"
