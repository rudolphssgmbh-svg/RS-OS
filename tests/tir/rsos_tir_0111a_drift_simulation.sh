#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

TEST_ID="tir-0111a-drift-$(date +%Y%m%d%H%M%S)"
ELEMENT_A="element-model-a-$TEST_ID"
CHANGE_A="change-model-a-$TEST_ID"
CHANGE_B="change-model-b-$TEST_ID"

echo "RSOS-TIR-0111A Drift Simulation"
echo "test_id=$TEST_ID"

echo "Phase 1: Seed Model A"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id, tenant_id, element_type, name, status, owner, source_module, metadata
) VALUES (
  '$ELEMENT_A',
  'tenant-rsos-test',
  'tabula_rasa_model',
  'Model A Historical Baseline',
  'active',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object('model','A','confidence',90,'risk_score',10,'chain_id','Chain-A')
);

INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_A',
  'tenant-rsos-test',
  '$ELEMENT_A',
  'baseline_model_a',
  'Historical baseline for drift simulation',
  'Model A observed stable',
  'System state considered valid',
  'Model A is valid',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"08_audit\"]'::jsonb,
  jsonb_build_object('model','A','confidence',90,'risk_score',10,'chain_id','Chain-A')
);
"

HASH_A=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(digest(
  coalesce(string_agg(change_id || ':' || metadata::text, '|' ORDER BY change_id), ''),
  'sha256'
),'hex')
FROM runtime_element_changes
WHERE metadata->>'chain_id' = 'Chain-A'
  AND element_id = '$ELEMENT_A';
")

echo "hash_model_a=$HASH_A"

echo "Phase 2: Create isolated Model B with drift"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_B',
  'tenant-rsos-test',
  '$ELEMENT_A',
  'tabula_rasa_model_b',
  'Simulated drift for isolated recheck',
  'Fresh observation differs from Model A',
  'Model drift detected',
  'Model B may replace or adjust Model A',
  'verified',
  'pending',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"06_verification\", \"07_governance\", \"08_audit\", \"10_learning\"]'::jsonb,
  jsonb_build_object('model','B','confidence',60,'risk_score',45,'chain_id','Chain-B','model_a_reference','Chain-A')
);
"

echo "Phase 3: Delta calculation"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
WITH a AS (
  SELECT
    (metadata->>'confidence')::int AS confidence,
    (metadata->>'risk_score')::int AS risk_score
  FROM runtime_element_changes
  WHERE change_id = '$CHANGE_A'
),
b AS (
  SELECT
    (metadata->>'confidence')::int AS confidence,
    (metadata->>'risk_score')::int AS risk_score
  FROM runtime_element_changes
  WHERE change_id = '$CHANGE_B'
),
delta AS (
  SELECT
    abs(a.confidence - b.confidence) AS confidence_delta,
    abs(a.risk_score - b.risk_score) AS risk_delta,
    greatest(abs(a.confidence - b.confidence), abs(a.risk_score - b.risk_score)) AS max_delta
  FROM a,b
)
SELECT
  confidence_delta,
  risk_delta,
  max_delta,
  CASE
    WHEN max_delta <= 2 THEN 'D0'
    WHEN max_delta <= 10 THEN 'D1'
    WHEN max_delta <= 35 THEN 'D2'
    WHEN max_delta > 35 THEN 'D3'
    ELSE 'D4'
  END AS delta_category
FROM delta;
"

echo "Phase 4: Zero-deletion recheck"

HASH_A_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(digest(
  coalesce(string_agg(change_id || ':' || metadata::text, '|' ORDER BY change_id), ''),
  'sha256'
),'hex')
FROM runtime_element_changes
WHERE metadata->>'chain_id' = 'Chain-A'
  AND element_id = '$ELEMENT_A';
")

if [ "$HASH_A" != "$HASH_A_AFTER" ]; then
  echo "FAIL: Model A hash changed"
  exit 1
fi

echo "PASS: Drift simulation completed. Model A unchanged, Model B isolated, delta generated."
