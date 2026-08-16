'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPERATIONS,
  OUTCOMES,
  createHausmeisterRuntimeAdapter,
} = require('../src/adapters/hausmeister-runtime-adapter');

function createAdapter() {
  return createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => ({
        observation_id: 'obs-1',
        ...input,
      }),
    },
    measurementPort: {
      create: async (input) => ({
        measurement_id: 'meas-1',
        ...input,
      }),
    },
    auditPort: {
      record: async () => {},
    },
    clock: () => new Date('2026-08-16T10:00:00Z'),
  });
}

test('Hausmeister exposes only bounded operations', () => {
  assert.deepEqual(Object.values(OPERATIONS), [
    'OBSERVE',
    'MEASURE',
    'REPORT_FINDING',
  ]);
});

test('observation does not grant remediation, approval or execution', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-1',
    },
    body: {
      observation_text: 'Runtime responds normally',
    },
  });

  assert.equal(result.outcome, OUTCOMES.ACCEPTED);
  assert.equal(result.allowedToRemediate, false);
  assert.equal(result.allowedToApprove, false);
  assert.equal(result.allowedToExecuteOrchestration, false);
  assert.equal(result.requiresVerification, true);
});

test('measurement remains separate from verification', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.MEASURE,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-1',
    },
    body: {
      metric_name: 'runtime_response_ms',
      metric_value: 42,
      metric_unit: 'ms',
    },
  });

  assert.equal(result.outcome, OUTCOMES.ACCEPTED);
  assert.equal(result.requiresVerification, true);
  assert.equal(result.allowedToRemediate, false);
});

test('finding is record-only and does not invent JARVIS continuation', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.REPORT_FINDING,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-1',
    },
    body: {
      finding: 'Database latency above observed baseline',
      severity: 'DEGRADED',
    },
  });

  assert.equal(result.outcome, OUTCOMES.ACCEPTED);
  assert.equal(result.coordinationRequested, false);
  assert.equal(result.coordinationImplemented, false);
  assert.equal(result.allowedToExecuteOrchestration, false);
  assert.equal(result.requiresHumanOrGovernedFollowUp, true);
});
