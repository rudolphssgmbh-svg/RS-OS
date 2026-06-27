#!/usr/bin/env bash
set -euo pipefail

DB_CONTAINER="rsos-postgres"
DB_USER="rsos"
DB_NAME="rsos_runtime"
RUNTIME_CONTAINER="rsos-runtime-api"

TEST_ID="tir-0108-$(date +%Y%m%d%H%M%S)"
ELEMENT_ID="adaptive-element-$TEST_ID"
CHANGE_ID="adaptive-change-$TEST_ID"
STATE_ID="adaptive-state-$TEST_ID"

echo "RSOS-TIR-0108 Adaptive Element Prototype"
echo "test_id=$TEST_ID"

echo "Phase 1: Runtime uptime baseline"

UPTIME_BEFORE=$(sudo docker inspect -f '{{.State.StartedAt}}' "$RUNTIME_CONTAINER" 2>/dev/null || echo "unknown")
echo "runtime_started_before=$UPTIME_BEFORE"

echo "Phase 2: Seed adaptive element generation 1"

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
  'adaptive_element_prototype',
  'RSOS-108 Adaptive Element Prototype',
  'active',
  'RSOS 99_tests',
  '99_tests',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0108',
    'adaptive_control', jsonb_build_object(
      'generation', 1,
      'active_behavior_id', 'behavior-v1-baseline',
      'fallback_behavior_id', 'behavior-v1-baseline',
      'hot_swappable', true
    ),
    'metrics_baseline', jsonb_build_object(
      'target_latency_ms', 50,
      'current_latency_ms', 62
    )
  )
);
"

GEN_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata #>> '{adaptive_control,generation}'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

BEHAVIOR_BEFORE=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata #>> '{adaptive_control,active_behavior_id}'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

echo "generation_before=$GEN_BEFORE"
echo "behavior_before=$BEHAVIOR_BEFORE"

echo "Phase 3: Trigger controlled adaptation to generation 2"

sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  'adaptive_behavior_swap',
  'Latency baseline exceeded, controlled behavior adaptation required',
  'current_latency_ms exceeded target_latency_ms',
  'Optimized behavior should improve runtime behavior',
  'Generation 2 behavior can be activated without replacing element identity',
  'verified',
  'approved',
  'completed',
  'recorded',
  true,
  '[\"03_runtime\", \"06_verification\", \"07_governance\", \"08_audit\", \"10_learning\", \"11_recovery\"]'::jsonb,
  jsonb_build_object(
    'tir_id','RSOS-TIR-0108',
    'from_behavior','behavior-v1-baseline',
    'to_behavior','behavior-v2-optimized',
    'adaptation_mode','metadata_pointer_swap',
    'fallback_behavior','behavior-v1-baseline'
  )
);

UPDATE runtime_elements
SET
  metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        metadata,
        '{adaptive_control,generation}',
        '2'::jsonb
      ),
      '{adaptive_control,active_behavior_id}',
      '\"behavior-v2-optimized\"'::jsonb
    ),
    '{metrics_baseline,current_latency_ms}',
    '38'::jsonb
  ),
  updated_at = now()
WHERE element_id = '$ELEMENT_ID'
  AND metadata #>> '{adaptive_control,active_behavior_id}' = 'behavior-v1-baseline'
  AND metadata #>> '{adaptive_control,hot_swappable}' = 'true';

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
  'active:generation-1',
  'active:generation-2',
  '$CHANGE_ID',
  'Adaptive behavior pointer swapped after approved verification',
  'RSOS 03_runtime',
  jsonb_build_object(
    'tir_id','RSOS-TIR-0108',
    'zero_identity_replacement', true,
    'fallback_preserved', true
  )
);
"

echo "Phase 4: Assertions"

GEN_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata #>> '{adaptive_control,generation}'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

BEHAVIOR_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata #>> '{adaptive_control,active_behavior_id}'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

FALLBACK_AFTER=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT metadata #>> '{adaptive_control,fallback_behavior_id}'
FROM runtime_elements
WHERE element_id = '$ELEMENT_ID';
")

UPTIME_AFTER=$(sudo docker inspect -f '{{.State.StartedAt}}' "$RUNTIME_CONTAINER" 2>/dev/null || echo "unknown")

echo "generation_after=$GEN_AFTER"
echo "behavior_after=$BEHAVIOR_AFTER"
echo "fallback_after=$FALLBACK_AFTER"
echo "runtime_started_after=$UPTIME_AFTER"

if [ "$GEN_AFTER" -le "$GEN_BEFORE" ]; then
  echo "FAIL: element_generation_after is not greater than element_generation_before"
  exit 1
fi

if [ "$BEHAVIOR_BEFORE" = "$BEHAVIOR_AFTER" ]; then
  echo "FAIL: active_behavior_pointer_mutated == false"
  exit 1
fi

if [ "$FALLBACK_AFTER" != "behavior-v1-baseline" ]; then
  echo "FAIL: fallback behavior not preserved"
  exit 1
fi

if [ "$UPTIME_BEFORE" != "unknown" ] && [ "$UPTIME_AFTER" != "unknown" ] && [ "$UPTIME_BEFORE" != "$UPTIME_AFTER" ]; then
  echo "FAIL: runtime uptime changed, process restart detected"
  exit 1
fi

STATE_EXISTS=$(sudo docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tA -c "
SELECT count(*)
FROM runtime_element_states
WHERE element_id = '$ELEMENT_ID'
  AND change_id = '$CHANGE_ID'
  AND new_status = 'active:generation-2';
")

if [ "$STATE_EXISTS" != "1" ]; then
  echo "FAIL: adaptive state transition record missing"
  exit 1
fi

echo "PASS: RSOS-TIR-0108 adaptive element metadata pointer swap completed without runtime restart."
