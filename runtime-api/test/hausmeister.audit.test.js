'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPERATIONS,
  createHausmeisterRuntimeAdapter,
} = require('../src/adapters/hausmeister-runtime-adapter');

test('accepted observation creates attributable adapter audit record', async () => {
  const records = [];

  const adapter = createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => ({
        observation_id: 'obs-audit-1',
        ...input,
      }),
    },
    measurementPort: {
      create: async (input) => input,
    },
    auditPort: {
      record: async (entry) => {
        records.push(entry);
      },
    },
    clock: () => new Date('2026-08-16T10:30:00Z'),
  });

  await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-operator',
    },
    body: {
      observation_text: 'Runtime available',
    },
  });

  assert.equal(records.length, 1);

  assert.equal(records[0].tenant_id, 'tenant-a');
  assert.equal(records[0].actor_id, 'hausmeister-operator');
  assert.equal(records[0].operation, OPERATIONS.OBSERVE);
  assert.equal(records[0].object_id, 'obs-audit-1');

  assert.deepEqual(records[0].authority, {
    remediation: false,
    approval: false,
    orchestrationExecution: false,
  });
});

test('blocked tenant override performs no persistence and no audit write', async () => {
  let observationCalls = 0;
  let measurementCalls = 0;
  let auditCalls = 0;

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
      record: async () => {
        auditCalls += 1;
      },
    },
  });

  await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-a',
    },
    body: {
      tenant_id: 'tenant-b',
      observation_text: 'attempt',
    },
  });

  assert.equal(observationCalls, 0);
  assert.equal(measurementCalls, 0);
  assert.equal(auditCalls, 0);
});

test('finding audit retains no remediation authority', async () => {
  const records = [];

  const adapter = createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => input,
    },
    measurementPort: {
      create: async (input) => input,
    },
    auditPort: {
      record: async (entry) => {
        records.push(entry);
      },
    },
  });

  await adapter.execute({
    operation: OPERATIONS.REPORT_FINDING,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-operator',
    },
    body: {
      finding: 'Review required',
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].authority.remediation, false);
  assert.equal(records[0].authority.approval, false);
  assert.equal(
    records[0].authority.orchestrationExecution,
    false
  );
});
