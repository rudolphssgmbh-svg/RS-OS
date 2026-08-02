'use strict';

/**
 * RSOS HERMES contract tests.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * DATABASE ACCESS: FORBIDDEN
 * NETWORK ACCESS: FORBIDDEN
 * APPLICATION EXECUTION: NOT APPROVED
 */

const assert = require('assert');

const {
  DECISIONS,
  OUTCOMES,
  REASON_CODES,
  validateRequestContext,
  evaluateCapturedDecision,
} = require('../src/policies/human-approval-speaker-policy');

function baseRequest(overrides = {}) {
  return {
    tenantId: 'tenant-1',
    requiredHumanRole: 'governance-owner',
    validUntil: new Date('2030-01-01T00:00:00.000Z'),
    status: 'PENDING',
    revokedAt: null,
    scopeHash: 'scope-hash-1',
    workflowId: 'workflow-1',
    traceId: 'trace-1',
    ...overrides,
  };
}

function baseContext(overrides = {}) {
  return {
    request: baseRequest(),
    tenantId: 'tenant-1',
    authenticatedIdentity: {
      id: 'human-1',
      verified: true,
    },
    authorizedHumanRoles: ['governance-owner'],
    presentedScopeHash: 'scope-hash-1',
    auditPathAvailable: true,
    now: new Date('2029-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('HERMES contract policy', () => {
  it('blocks a missing request', () => {
    const result = validateRequestContext({
      ...baseContext(),
      request: null,
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert(result.reasonCodes.includes(REASON_CODES.REQUEST_MISSING));
  });

  it('blocks an expired request', () => {
    const result = validateRequestContext({
      ...baseContext(),
      request: baseRequest({
        validUntil: new Date('2028-01-01T00:00:00.000Z'),
      }),
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.REQUEST_EXPIRED));
  });

  it('blocks a revoked request', () => {
    const result = validateRequestContext({
      ...baseContext(),
      request: baseRequest({
        status: 'REVOKED',
        revokedAt: new Date('2028-01-01T00:00:00.000Z'),
      }),
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert(result.reasonCodes.includes(REASON_CODES.REQUEST_REVOKED));
  });

  it('blocks silence and timeout', () => {
    for (const input of [
      { silence: true, timeout: false },
      { silence: false, timeout: true },
    ]) {
      const result = evaluateCapturedDecision({
        ...baseContext(),
        decision: DECISIONS.APPROVED,
        rawResponseText: 'approved',
        explicitConfirmation: true,
        confirmationLevel: 2,
        requiredConfirmationLevel: 2,
        transcriptHash: 'transcript-hash',
        ...input,
      });

      assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
      assert.strictEqual(result.allowedToContinueWorkflow, false);
      assert(result.reasonCodes.includes(REASON_CODES.SILENCE_OR_TIMEOUT));
    }
  });

  it('blocks an ambiguous decision', () => {
    const result = evaluateCapturedDecision({
      ...baseContext(),
      decision: DECISIONS.AMBIGUOUS,
      rawResponseText: 'maybe',
      transcriptHash: 'transcript-hash',
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert(result.reasonCodes.includes(REASON_CODES.DECISION_AMBIGUOUS));
  });

  it('requires explicit confirmation for approval', () => {
    const result = evaluateCapturedDecision({
      ...baseContext(),
      decision: DECISIONS.APPROVED,
      rawResponseText: 'approve',
      explicitConfirmation: false,
      confirmationLevel: 2,
      requiredConfirmationLevel: 2,
      transcriptHash: 'transcript-hash',
    });

    assert.strictEqual(result.outcome, OUTCOMES.REVIEW_REQUIRED);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert(
      result.reasonCodes.includes(
        REASON_CODES.EXPLICIT_CONFIRMATION_REQUIRED
      )
    );
  });

  it('records a valid approval in shadow mode without continuation', () => {
    const result = evaluateCapturedDecision({
      ...baseContext(),
      decision: DECISIONS.APPROVED,
      rawResponseText: 'I confirm this approval',
      explicitConfirmation: true,
      confirmationLevel: 2,
      requiredConfirmationLevel: 2,
      transcriptHash: 'transcript-hash',
    });

    assert.strictEqual(result.outcome, OUTCOMES.ALLOWED_WITH_CONTROLS);
    assert.strictEqual(result.allowedToRecord, true);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert.strictEqual(result.runtimeMode, 'SHADOW');
  });
});
