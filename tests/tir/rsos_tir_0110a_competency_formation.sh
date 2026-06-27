#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

TEST_ID="tir-0110a-$(date +%Y%m%d%H%M%S)"
ELEMENT_ID="competency-element-$TEST_ID"
CHANGE_POS="competency-positive-$TEST_ID"
CHANGE_NEG="competency-negative-$TEST_ID"
CHANGE_UNVERIFIED="competency-unverified-$TEST_ID"

echo "RSOS-TIR-0110A Competency Formation Test"
echo "test_id=$TEST_ID"

echo "Phase 1: Seed element with potential and base competency"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id, tenant_id, element_type, name, status, owner, source_module, metadata
) VALUES (
  '$ELEMENT_ID',
  'tenant-rsos-test',
  'competency_test_element',
  'RSOS-110A Competency Formation Element',
  'active',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0110A',
    'context','diagnosis',
    'potential', 1.0,
    'competency', 50,
    'unverified_experience_count', 0,
    'verified_positive_count', 0,
    'verified_negative_count', 0
  )
);
"

K_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT (metadata->>'competency')::int
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

echo "competency_before=$K_BEFORE"

echo "Phase 2: Positive verified evidence increases competency"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_POS',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'competency_evidence_positive',
  'Positive verified evidence for diagnosis context',
  'Element produced correct diagnosis result',
  'Positive effect confirmed',
  'Competency should increase',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"06_verification\", \"10_learning\"]'::jsonb,
  jsonb_build_object('context','diagnosis','effect','positive','delta_k',10)
);

UPDATE runtime_elements
SET metadata = jsonb_set(
  jsonb_set(metadata, '{competency}', to_jsonb(((metadata->>'competency')::int + 10))),
  '{verified_positive_count}',
  to_jsonb(((metadata->>'verified_positive_count')::int + 1))
),
updated_at = now()
WHERE element_id = '$ELEMENT_ID';
"

K_AFTER_POS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT (metadata->>'competency')::int
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

echo "competency_after_positive=$K_AFTER_POS"

echo "Phase 3: Unverified evidence does not change competency"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_UNVERIFIED',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'competency_evidence_unverified',
  'Unverified experience must not change competency',
  'Element reported possible success',
  'Effect not verified',
  'Competency must remain unchanged',
  'pending',
  'pending',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"06_verification\"]'::jsonb,
  jsonb_build_object('context','diagnosis','effect','unknown','delta_k',0)
);

UPDATE runtime_elements
SET metadata = jsonb_set(
  metadata,
  '{unverified_experience_count}',
  to_jsonb(((metadata->>'unverified_experience_count')::int + 1))
),
updated_at = now()
WHERE element_id = '$ELEMENT_ID';
"

K_AFTER_UNVERIFIED=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT (metadata->>'competency')::int
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

echo "competency_after_unverified=$K_AFTER_UNVERIFIED"

echo "Phase 4: Negative verified evidence decreases competency"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_NEG',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'competency_evidence_negative',
  'Negative verified evidence for diagnosis context',
  'Element produced incorrect diagnosis result',
  'Negative effect confirmed',
  'Competency should decrease',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"06_verification\", \"10_learning\"]'::jsonb,
  jsonb_build_object('context','diagnosis','effect','negative','delta_k',-15)
);

UPDATE runtime_elements
SET metadata = jsonb_set(
  jsonb_set(metadata, '{competency}', to_jsonb(((metadata->>'competency')::int - 15))),
  '{verified_negative_count}',
  to_jsonb(((metadata->>'verified_negative_count')::int + 1))
),
updated_at = now()
WHERE element_id = '$ELEMENT_ID';
"

K_AFTER_NEG=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT (metadata->>'competency')::int
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

echo "competency_after_negative=$K_AFTER_NEG"

echo "Phase 5: Assertions"

if [ "$K_AFTER_POS" -le "$K_BEFORE" ]; then
  echo "FAIL: positive verified evidence did not increase competency"
  exit 1
fi

if [ "$K_AFTER_UNVERIFIED" != "$K_AFTER_POS" ]; then
  echo "FAIL: unverified evidence changed competency"
  exit 1
fi

if [ "$K_AFTER_NEG" -ge "$K_AFTER_UNVERIFIED" ]; then
  echo "FAIL: negative verified evidence did not decrease competency"
  exit 1
fi

echo "PASS: RSOS-TIR-0110A competency formation verified."
