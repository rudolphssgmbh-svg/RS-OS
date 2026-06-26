#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"

TEST_ID="tir-0111b-$(date +%Y%m%d%H%M%S)"
ELEMENT_ID="element-feedback-$TEST_ID"
CHANGE_A="change-model-a-$TEST_ID"
CHANGE_B="change-model-b-$TEST_ID"
CHANGE_L="change-learning-$TEST_ID"
STATE_A="state-model-a-$TEST_ID"
STATE_B="state-model-b-$TEST_ID"

echo "RSOS-TIR-0111B Feedback Loop Test"
echo "test_id=$TEST_ID"

echo "Phase 1: Seed Model A and Model B"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_elements (
  element_id, tenant_id, element_type, name, status, owner, source_module, metadata
) VALUES (
  '$ELEMENT_ID',
  'tenant-rsos-test',
  'tabula_rasa_feedback_model',
  'TIR-0111B Feedback Loop Model',
  'active',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object('tir_id','RSOS-TIR-0111B','active_model','A')
);

INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_A',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'model_a_baseline',
  'Historical Model A baseline',
  'Model A was previously valid',
  'Model A is current baseline',
  'Model A remains reference evidence',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"05_evidence\", \"08_audit\"]'::jsonb,
  jsonb_build_object('model','A','model_status','active','confidence',90,'risk_score',10,'chain_id','Chain-A')
);

INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_B',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'model_b_candidate',
  'D2 delta detected by Tabula-Rasa drift simulation',
  'Fresh evidence differs from Model A',
  'D2 macro drift requires model adjustment',
  'Model B should become approved candidate',
  'verified',
  'pending',
  'completed',
  'recorded',
  true,
  '[\"06_verification\", \"07_governance\", \"10_learning\"]'::jsonb,
  jsonb_build_object('model','B','model_status','candidate','confidence',72,'risk_score',28,'chain_id','Chain-B','delta_category','D2','model_a_reference','Chain-A')
);
"

HASH_A_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(digest(
  coalesce(string_agg(change_id || ':' || metadata::text, '|' ORDER BY change_id), ''),
  'sha256'
),'hex')
FROM runtime_element_changes
WHERE change_id = '$CHANGE_A';
")

echo "hash_model_a_before=$HASH_A_BEFORE"

echo "Phase 2: Governance approves Model B and archives Model A by state records"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_states (
  state_id, tenant_id, element_id, previous_status, new_status, change_id, reason, actor, metadata
) VALUES (
  '$STATE_A',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'active',
  'archived',
  '$CHANGE_A',
  'Model A archived after D2 Tabula-Rasa feedback loop',
  'RSOS 07_governance',
  jsonb_build_object('tir_id','RSOS-TIR-0111B','model','A','archive_mode','non_destructive')
);

INSERT INTO runtime_element_states (
  state_id, tenant_id, element_id, previous_status, new_status, change_id, reason, actor, metadata
) VALUES (
  '$STATE_B',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'candidate',
  'approved',
  '$CHANGE_B',
  'Model B approved as adjusted model after D2 delta',
  'RSOS 07_governance',
  jsonb_build_object('tir_id','RSOS-TIR-0111B','model','B','approved_from_delta','D2')
);

UPDATE runtime_elements
SET
  status = 'active',
  metadata = metadata || jsonb_build_object(
    'active_model','B',
    'previous_model','A',
    'feedback_loop','TIR-0111B',
    'governance_result','approved'
  ),
  updated_at = now()
WHERE element_id = '$ELEMENT_ID';
"

echo "Phase 3: Learning records adaptation"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO runtime_element_changes (
  change_id, tenant_id, element_id, change_type, change_reason,
  observation, interpretation, hypothesis,
  verification_status, governance_status, execution_status, audit_status,
  recovery_possible, affected_areas, metadata
) VALUES (
  '$CHANGE_L',
  'tenant-rsos-test',
  '$ELEMENT_ID',
  'learning_feedback_loop',
  'Learning records D2 model adaptation',
  'Model B approved, Model A archived non-destructively',
  'D2 drift can be handled by model adjustment',
  'Future D2 cases may follow the same controlled path',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"08_audit\", \"10_learning\", \"01_configuration\"]'::jsonb,
  jsonb_build_object(
    'tir_id','RSOS-TIR-0111B',
    'learning_type','d2_feedback_loop',
    'model_a','$CHANGE_A',
    'model_b','$CHANGE_B',
    'result','model_adjusted'
  )
);
"

echo "Phase 4: Assertions"

HASH_A_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT encode(digest(
  coalesce(string_agg(change_id || ':' || metadata::text, '|' ORDER BY change_id), ''),
  'sha256'
),'hex')
FROM runtime_element_changes
WHERE change_id = '$CHANGE_A';
")

if [ "$HASH_A_BEFORE" != "$HASH_A_AFTER" ]; then
  echo "FAIL: Model A evidence mutated"
  exit 1
fi

APPROVED_B=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_states
WHERE change_id = '$CHANGE_B'
  AND new_status = 'approved'
  AND metadata->>'approved_from_delta' = 'D2';
")

ARCHIVED_A=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_states
WHERE change_id = '$CHANGE_A'
  AND new_status = 'archived'
  AND metadata->>'archive_mode' = 'non_destructive';
")

LEARNING_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*) FROM runtime_element_changes
WHERE change_id = '$CHANGE_L'
  AND change_type = 'learning_feedback_loop'
  AND metadata->>'result' = 'model_adjusted';
")

ACTIVE_MODEL=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata->>'active_model'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

if [ "$APPROVED_B" != "1" ]; then
  echo "FAIL: Model B was not approved"
  exit 1
fi

if [ "$ARCHIVED_A" != "1" ]; then
  echo "FAIL: Model A was not archived non-destructively"
  exit 1
fi

if [ "$LEARNING_EXISTS" != "1" ]; then
  echo "FAIL: Learning feedback record missing"
  exit 1
fi

if [ "$ACTIVE_MODEL" != "B" ]; then
  echo "FAIL: active_model is not B"
  exit 1
fi

echo "PASS: RSOS-TIR-0111B feedback loop completed. Model B approved, Model A archived non-destructively, learning recorded."
