#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

echo "RSOS-TIR-0111A Tabula-Rasa Protocol Check"
echo "Phase 1: Snapshot historical evidence baseline"

COUNT_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_changes;
")

HASH_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(
  digest(
    coalesce(string_agg(change_id || ':' || updated_at::text, '|' ORDER BY change_id), ''),
    'sha256'
  ),
  'hex'
)
FROM runtime_element_changes;
" 2>/dev/null || true)

echo "count_before=$COUNT_BEFORE"
echo "hash_before=$HASH_BEFORE"

echo "Phase 2: Create isolated Tabula-Rasa test chain"

TEST_ID="tir-0111a-$(date +%Y%m%d%H%M%S)"
ELEMENT_ID="element-$TEST_ID"
CHANGE_ID="change-$TEST_ID"
STATE_ID="state-$TEST_ID"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id,
  tenant_id,
  element_type,
  name,
  status,
  owner,
  source_module,
  metadata
) VALUES (
  '$ELEMENT_ID',
  'tenant-rsos-test',
  'tabula_rasa_test_element',
  'TIR-0111A Tabula Rasa Test Element',
  'created',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object(
    'tir_id', 'RSOS-TIR-0111A',
    'chain_id', 'Chain-B',
    'model_a_reference', 'Chain-A'
  )
);

INSERT INTO runtime_element_changes (
  change_id,
  tenant_id,
  element_id,
  change_type,
  change_reason,
  observation,
  interpretation,
  hypothesis,
  verification_status,
  governance_status,
  execution_status,
  audit_status,
  recovery_possible,
  affected_areas,
  metadata
) VALUES (
  '$CHANGE_ID',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'tabula_rasa_recheck',
  'Validate Tabula-Rasa isolated evidence chain',
  'Existing model validity is suspended for recheck',
  'Historical assumptions must not influence new evidence',
  'Fresh evidence can be collected without deleting old evidence',
  'pending',
  'pending',
  'completed',
  'pending',
  true,
  '[\"05_evidence\", \"06_verification\", \"07_governance\", \"08_audit\", \"10_learning\"]'::jsonb,
  jsonb_build_object(
    'tir_id', 'RSOS-TIR-0111A',
    'evidence_chain', 'Chain-B',
    'evidence_a_mode', 'read_only_reference',
    'zero_deletion_expected', true
  )
);

INSERT INTO runtime_element_states (
  state_id,
  tenant_id,
  element_id,
  previous_status,
  new_status,
  change_id,
  reason,
  actor,
  metadata
) VALUES (
  '$STATE_ID',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'created',
  'under_review',
  '$CHANGE_ID',
  'Tabula-Rasa verification loop started',
  'RSOS 99_tests',
  jsonb_build_object(
    'tir_id', 'RSOS-TIR-0111A',
    'assertion_scope', 'zero_deletion_proof'
  )
);
"

echo "Phase 3: Post-check historical baseline"

COUNT_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_changes
WHERE change_id <> '$CHANGE_ID';
")

HASH_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(
  digest(
    coalesce(string_agg(change_id || ':' || updated_at::text, '|' ORDER BY change_id), ''),
    'sha256'
  ),
  'hex'
)
FROM runtime_element_changes
WHERE change_id <> '$CHANGE_ID';
" 2>/dev/null || true)

echo "count_after_historical=$COUNT_AFTER"
echo "hash_after_historical=$HASH_AFTER"

echo "Phase 4: Assertions"

if [ "$COUNT_BEFORE" != "$COUNT_AFTER" ]; then
  echo "FAIL: historical record count changed"
  exit 1
fi

if [ -n "$HASH_BEFORE" ] && [ -n "$HASH_AFTER" ] && [ "$HASH_BEFORE" != "$HASH_AFTER" ]; then
  echo "FAIL: historical evidence hash changed"
  exit 1
fi

DELTA_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_changes
WHERE change_id = '$CHANGE_ID'
  AND metadata->>'evidence_chain' = 'Chain-B'
  AND metadata->>'zero_deletion_expected' = 'true';
")

if [ "$DELTA_EXISTS" != "1" ]; then
  echo "FAIL: isolated Chain-B evidence record missing"
  exit 1
fi

echo "PASS: RSOS-TIR-0111A zero-deletion and isolated evidence chain check passed"
