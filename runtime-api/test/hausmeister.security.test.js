'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPERATIONS,
  OUTCOMES,
  REASON_CODES,
  createHausmeisterRuntimeAdapter,
} = require('../src/adapters/hausmeister-runtime-adapter');

function createAdapter() {
  return createHausmeisterRuntimeAdapter({
    observationPort: {
      create: async (input) => input,
    },
    measurementPort: {
      create: async (input) => input,
    },
    auditPort: {
      record: async () => {},
    },
  });
}

test('unauthenticated execution is blocked', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    body: {
      observation_text: 'test',
    },
  });

  assert.equal(result.outcome, OUTCOMES.BLOCKED);
  assert.deepEqual(result.reasonCodes, [
    REASON_CODES.AUTHENTICATION_REQUIRED,
  ]);
});

test('missing tenant identity is blocked', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      operator_id: 'hausmeister-1',
    },
    body: {
      observation_text: 'test',
    },
  });

  assert.equal(result.outcome, OUTCOMES.BLOCKED);
  assert.deepEqual(result.reasonCodes, [
    REASON_CODES.TENANT_MISSING,
  ]);
});

test('payload tenant override is always blocked', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-a',
      operator_id: 'hausmeister-1',
    },
    body: {
      tenant_id: 'tenant-b',
      observation_text: 'foreign tenant attempt',
    },
  });

  assert.equal(result.outcome, OUTCOMES.BLOCKED);
  assert.deepEqual(result.reasonCodes, [
    REASON_CODES.TENANT_OVERRIDE_FORBIDDEN,
  ]);
});

test('even matching payload tenant is rejected to preserve one authority source', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: OPERATIONS.OBSERVE,
    authUser: {
      tenant_id: 'tenant-a',
    },
    body: {
      tenant_id: 'tenant-a',
      observation_text: 'matching override attempt',
    },
  });

  assert.equal(result.outcome, OUTCOMES.BLOCKED);
  assert.deepEqual(result.reasonCodes, [
    REASON_CODES.TENANT_OVERRIDE_FORBIDDEN,
  ]);
});

test('unsupported operation is blocked', async () => {
  const adapter = createAdapter();

  const result = await adapter.execute({
    operation: 'REPAIR_PRODUCTION',
    authUser: {
      tenant_id: 'tenant-a',
    },
    body: {},
  });

  assert.equal(result.outcome, OUTCOMES.BLOCKED);
  assert.deepEqual(result.reasonCodes, [
    REASON_CODES.OPERATION_UNSUPPORTED,
  ]);
  assert.equal(result.allowedToRemediate, false);
  assert.equal(result.allowedToApprove, false);
  assert.equal(result.allowedToExecuteOrchestration, false);
});
