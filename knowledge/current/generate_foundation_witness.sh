#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

HOSTNAME=$(hostname)

REGISTRY_HEALTH=$(curl -s -u admin:RSOS-2026-SECURE \
http://127.0.0.1:8090/health || true)

REGISTRY_ACTIVE=false
if systemctl is-active --quiet rsos-registry.service; then
  REGISTRY_ACTIVE=true
fi

cat > /opt/rsos/knowledge/current/FOUNDATION_WITNESS.json <<JSON
{
  "witness_version": "foundation-006",
  "timestamp": "${TIMESTAMP}",
  "hostname": "${HOSTNAME}",

  "registry": {
    "service_active": ${REGISTRY_ACTIVE},
    "health": ${REGISTRY_HEALTH}
  },

  "sources": {
    "foundation_status":
      "/opt/rsos/knowledge/current/FOUNDATION_STATUS.json",

    "chatgpt_handoff":
      "/opt/rsos/knowledge/current/CHATGPT_HANDOFF.md",

    "peer_registry":
      "/opt/rsos/knowledge/current/PEER_REGISTRY.json",

    "secure_access_status":
      "/opt/rsos/knowledge/current/SECURE_ACCESS_STATUS.json",

    "witness_registry":
      "/opt/rsos/knowledge/current/WITNESS_REGISTRY.json",

    "foundation_inventory":
      "/opt/rsos/knowledge/current/FOUNDATION_INVENTORY.json",

    "recovery_status":
      "/opt/rsos/knowledge/current/RECOVERY_STATUS.json",

    "recovery_test_report":
      "/opt/rsos/knowledge/current/RECOVERY_TEST_REPORT.json",

    "checkpoint_charlie_status":
      "/opt/rsos/knowledge/current/CHECKPOINT_CHARLIE_STATUS.json",

    "troja_status":
      "/opt/rsos/knowledge/current/TROJA_STATUS.json"
  },

  "audit": {
    "generated_by":
      "generate_foundation_witness.sh",

    "purpose":
      "verified foundation snapshot",

    "verification_state":
      "observed"
  }
}
JSON

echo "FOUNDATION_WITNESS.json updated"
