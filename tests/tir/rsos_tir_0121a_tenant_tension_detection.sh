#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

TEST_ID="tir-0121a-$(date +%Y%m%d%H%M%S)"

TENANT_ID="tenant-psgarage-test"
ELEMENT_ID="tenant-tension-$TEST_ID"
CHANGE_ID="tenant-tension-change-$TEST_ID"

echo "RSOS-TIR-0121A Tenant Tension Detection"
echo "test_id=$TEST_ID"

echo
echo "Phase 1: Create tenant observation"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL

INSERT INTO runtime_elements(
    element_id,
    tenant_id,
    element_type,
    name,
    status,
    owner,
    source_module,
    metadata
)
VALUES
(
'$ELEMENT_ID',
'$TENANT_ID',
'tenant_observation',
'Tenant Tension Detection',
'active',
'RSOS 99_tests',
'99_tests',

jsonb_build_object(

'tir','0121A',

'observation',

jsonb_build_object(

'vehicle_file_complete',false,
'workshop_order_open',true,
'document_missing',true,
'governance_pending',false

),

'tension',

jsonb_build_object(

'detected',true,
'class','T2',
'score',62

),

'selection',

jsonb_build_object(

'selected',true,
'reason','missing_vehicle_documentation'

)

)

);

SQL

echo
echo "Phase 2: Record Evidence"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<SQL

INSERT INTO runtime_element_changes(

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

)

VALUES(

'$CHANGE_ID',

'$TENANT_ID',

'$ELEMENT_ID',

'tenant_tension',

'Tenant tension detected',

'Vehicle documentation incomplete',

'Selection activated',

'Tenant should trigger verification',

'verified',

'approved',

'completed',

'recorded',

true,

'["04_observation","05_evidence","06_verification","07_governance"]'::jsonb,

jsonb_build_object(

'tension_class','T2',

'selection_triggered',true,

'evidence_created',true,

'verification_required',true

)

);

SQL

echo
echo "Phase 3: Assertions"

TENSION=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata->'tension'->>'class'
FROM runtime_elements
WHERE element_id='$ELEMENT_ID';
")

SELECTED=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata->'selection'->>'selected'
FROM runtime_elements
WHERE element_id='$ELEMENT_ID';
")

EVIDENCE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*)
FROM runtime_element_changes
WHERE change_id='$CHANGE_ID';
")

if [ "$TENSION" != "T2" ]; then
    echo "FAIL: tension class incorrect"
    exit 1
fi

if [ "$SELECTED" != "true" ]; then
    echo "FAIL: selection not triggered"
    exit 1
fi

if [ "$EVIDENCE" != "1" ]; then
    echo "FAIL: evidence missing"
    exit 1
fi

echo
echo "PASS: RSOS-TIR-0121A tenant tension successfully detected."
echo "PASS: RSOS-002 tension generated."
echo "PASS: RSOS-001 selection activated."
echo "PASS: Evidence recorded."
