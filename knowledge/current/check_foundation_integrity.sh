#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/rsos/knowledge/current"

FILES=(
  "FOUNDATION_STATUS.json"
  "FOUNDATION_WITNESS.json"
  "FOUNDATION_WITNESS.sha256"
  "FOUNDATION_INVENTORY.json"
  "PEER_REGISTRY.json"
  "SECURE_ACCESS_STATUS.json"
  "WITNESS_REGISTRY.json"
  "CHATGPT_HANDOFF.md"
  "FOUNDATION_AUDIT_REPORT.json"
  "RECOVERY_STATUS.json"
  "RECOVERY_TEST_REPORT.json"
  "FOUNDATION_MAP.json"
  "CHECKPOINT_CHARLIE_STATUS.json"
  "TROJA_STATUS.json"
)

MISSING=()

for FILE in "${FILES[@]}"; do
  if [ ! -f "${BASE}/${FILE}" ]; then
    MISSING+=("${FILE}")
  fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
  STATUS="pass"
  MISSING_JSON=""
else
  STATUS="fail"
  MISSING_JSON=$(printf '    "%s",\n' "${MISSING[@]}" | sed '$s/,$//')
fi

cat <<JSON
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "integrity": "${STATUS}",
  "checked_files": ${#FILES[@]},
  "missing": [
${MISSING_JSON}
  ]
}
JSON
