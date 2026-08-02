'use strict';

/**
 * RSOS HERMES security tests.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * DATABASE ACCESS: FORBIDDEN
 * NETWORK ACCESS: FORBIDDEN
 * APPLICATION EXECUTION: NOT APPROVED
 */

const assert = require('assert');

const {
  OUTCOMES,
  REASON_CODES,
  validateRequestContext,
} = require('../src/policies/human-approval-speaker-policy');

function request(overrides = {}) {
  return {
    tenantId: 'tenant-a',
    requiredHumanRole: 'governance-owner',
    validUntil: new Date('2030-01-01T00:00:00.000Z'),
    status: 'PENDING',
    revokedAt: null,
    scopeHash: 'scope-a',
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    request: request(),
    tenantId: 'tenant-a',
    authenticatedIdentity: {
      id: 'human-a',
      verified: true,
    },
    authorizedHumanRoles: ['governance-owner'],
    presentedScopeHash: 'scope-a',
    auditPathAvailable: true,
    now: new Date('2029-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('HERMES security policy', () => {
  it('blocks an unverified identity', () => {
    const result = validateRequestContext({
      ...context(),
      authenticatedIdentity: {
        id: 'human-a',
        verified: false,
      },
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.IDENTITY_UNVERIFIED));
  });

  it('blocks an unauthorized human role', () => {
    const result = validateRequestContext({
      ...context(),
      authorizedHumanRoles: ['viewer'],
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(
      result.reasonCodes.includes(
        REASON_CODES.APPROVER_ROLE_UNAUTHORIZED
      )
    );
  });

  it('blocks cross-tenant access', () => {
    const result = validateRequestContext({
      ...context(),
      tenantId: 'tenant-b',
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.TENANT_MISMATCH));
  });

  it('blocks a changed scope hash', () => {
    const result = validateRequestContext({
      ...context(),
      presentedScopeHash: 'scope-b',
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.SCOPE_HASH_MISMATCH));
  });

  it('blocks when the audit path is unavailable', () => {
    const result = validateRequestContext({
      ...context(),
      auditPathAvailable: false,
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.AUDIT_PATH_UNAVAILABLE));
  });

  it('never authorizes workflow continuation', () => {
    const result = validateRequestContext(context());

    assert.strictEqual(result.outcome, OUTCOMES.ALLOWED_WITH_CONTROLS);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert(result.reasonCodes.includes(REASON_CODES.SHADOW_MODE_NO_CONTINUATION));
  });
});
