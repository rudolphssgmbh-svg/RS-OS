#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

TEST_ID="tir-0120a-$(date +%Y%m%d%H%M%S)"
TENANT_ELEMENT_ID="tenant-element-$TEST_ID"
VEHICLE_ELEMENT_ID="vehicle-element-$TEST_ID"
REL_ID="tenant-vehicle-rel-$TEST_ID"
CHANGE_ID="tenant-change-$TEST_ID"

echo "RSOS-TIR-0120A Tenant Element Model Test"
echo "test_id=$TEST_ID"

echo "Phase 1: Create tenant as adaptive element"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id, tenant_id, element_type, name, status, owner, source_module, metadata
) VALUES (
  '$TENANT_ELEMENT_ID',
  'tenant-psgarage-test',
  'tenant',
  'PS Garage Test Tenant',
  'active',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0120A',
    'identity', jsonb_build_object(
      'tenant_id','tenant-psgarage-test',
      'name','PS Garage Test Tenant',
      'domain','psgarage-tuebingen.de'
    ),
    'potential', jsonb_build_object(
      'modules', jsonb_build_array('sales','workshop','vehicle_records','documents')
    ),
    'competencies', jsonb_build_object(
      'sales', 50,
      'workshop', 50,
      'audit', 50
    ),
    'behavior', jsonb_build_object(
      'active_processes', jsonb_build_array('vehicle_intake','workshop_order')
    )
  )
);
"

echo "Phase 2: Create related vehicle element"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id, tenant_id, element_type, name, status, owner, source_module, metadata
) VALUES (
  '$VEHICLE_ELEMENT_ID',
  'tenant-psgarage-test',
  'vehicle_record',
  'Tenant Vehicle Record Test',
  'observed',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0120A',
    'vehicle_context','tenant_element_validation'
  )
);
"

echo "Phase 3: Create tenant relationship"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_relationships (
  relationship_id,
  tenant_id,
  source_element_id,
  target_element_id,
  relationship_type,
  status,
  source_module,
  metadata
) VALUES (
  '$REL_ID',
  'tenant-psgarage-test',
  '$TENANT_ELEMENT_ID',
  '$VEHICLE_ELEMENT_ID',
  'owns_context',
  'active',
  '99_tests',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0120A',
    'relationship_layer','tenant_to_vehicle'
  )
);
"

echo "Phase 4: Record tenant change/evidence"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_ID',
  'tenant-psgarage-test',
  '$TENANT_ELEMENT_ID',
  'tenant_element_validation',
  'Validate tenant as adaptive RSOS element',
  'Tenant can own relationships, behavior and competencies',
  'Tenant behaves as universal RSOS element',
  'Tenant element model is valid for PS Garage context',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"00_identity\", \"03_runtime\", \"05_evidence\", \"06_verification\", \"07_governance\"]'::jsonb,
  jsonb_build_object(
    'tir_id','RSOS-TIR-0120A',
    'model','RSOS-120',
    'result','tenant_element_validated'
  )
);
"

echo "Phase 5: Assertions"

TENANT_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_elements
WHERE element_id = '$TENANT_ELEMENT_ID'
  AND element_type = 'tenant'
  AND metadata->'identity'->>'tenant_id' = 'tenant-psgarage-test';
")

REL_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_relationships
WHERE relationship_id = '$REL_ID'
  AND source_element_id = '$TENANT_ELEMENT_ID'
  AND target_element_id = '$VEHICLE_ELEMENT_ID'
  AND relationship_type = 'owns_context';
")

CHANGE_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_changes
WHERE change_id = '$CHANGE_ID'
  AND verification_status = 'verified'
  AND governance_status = 'approved';
")

if [ "$TENANT_EXISTS" != "1" ]; then
  echo "FAIL: tenant element missing"
  exit 1
fi

if [ "$REL_EXISTS" != "1" ]; then
  echo "FAIL: tenant relationship missing"
  exit 1
fi

if [ "$CHANGE_EXISTS" != "1" ]; then
  echo "FAIL: tenant validation change missing"
  exit 1
fi

echo "PASS: RSOS-TIR-0120A tenant element model verified."
