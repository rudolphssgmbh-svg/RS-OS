'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPERATIONS,
  createHausmeisterRuntimeAdapter,
} = require('../src/adapters/hausmeister-runtime-adapter');

test('observation port receives authenticated tenant only', async () => {
  let captured = null;

  const adapter = createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => {
        captured = input;
        return {
          observation_id: 'obs-100',
          ...input,
        };
      },
    },
    measurementPort: {
      create: async (input) => input,
    },
    auditPort: {
      record: async () => {},
    },
  });

  await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-alpha',
      operator_id: 'operator-1',
    },
    body: {
      observation_text: '  service reachable  ',
      confidence: 90,
    },
  });

  assert.equal(captured.tenant_id, 'tenant-alpha');
  assert.equal(captured.created_by, 'operator-1');
  assert.equal(captured.observation_text, 'service reachable');
  assert.equal(captured.confidence, 90);
});

test('measurement port receives bounded runtime measurement contract', async () => {
  let captured = null;

  const adapter = createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => input,
    },
    measurementPort: {
      create: async (input) => {
        captured = input;

        return {
          measurement_id: 'measurement-100',
          ...input,
        };
      },
    },
    auditPort: {
      record: async () => {},
    },
  });

  const result = await adapter.execute({
    operation: OPERATIONS.MEASURE,
    authUser: {
      tenant_id: 'tenant-alpha',
      operator_id: 'operator-1',
    },
    body: {
      metric_name: 'database_latency_ms',
      metric_value: 17,
      metric_unit: 'ms',
      target_value: 20,
      variance_value: -3,
    },
  });

  assert.equal(captured.tenant_id, 'tenant-alpha');
  assert.equal(captured.metric_name, 'database_latency_ms');
  assert.equal(captured.metric_value, 17);
  assert.equal(captured.metric_unit, 'ms');
  assert.equal(captured.target_value, 20);
  assert.equal(captured.variance_value, -3);

  assert.equal(result.requiresVerification, true);
  assert.equal(result.allowedToRemediate, false);
});

test('report finding performs no orchestration activity', async () => {
  let observationCalls = 0;
  let measurementCalls = 0;

  const adapter = createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async () => {
        observationCalls += 1;
      },
    },
    measurementPort: {
      create: async () => {
        measurementCalls += 1;
      },
    },
    auditPort: {
      record: async () => {},
    },
  });

  const result = await adapter.execute({
    operation: OPERATIONS.REPORT_FINDING,
    authUser: {
      tenant_id: 'tenant-alpha',
      operator_id: 'operator-1',
    },
    body: {
      finding: 'Service state requires governed review',
    },
  });

  assert.equal(observationCalls, 0);
  assert.equal(measurementCalls, 0);
  assert.equal(result.coordinationImplemented, false);
  assert.equal(result.allowedToExecuteOrchestration, false);
});
