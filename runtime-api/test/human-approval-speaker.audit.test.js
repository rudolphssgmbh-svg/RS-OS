'use strict';

/**
 * RSOS HERMES audit tests.
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
  createHumanApprovalSpeakerService,
  sha256,
} = require('../src/services/human-approval-speaker-service');

function buildDependencies(overrides = {}) {
  const interactions = [];
  const events = [];

  const request = {
    id: 'approval-1',
    tenantId: 'tenant-1',
    workflowId: 'workflow-1',
    traceId: 'trace-1',
    requiredHumanRole: 'governance-owner',
    validUntil: new Date('2030-01-01T00:00:00.000Z'),
    status: 'PENDING',
    revokedAt: null,
    scopeHash: 'scope-1',
  };

  return {
    interactions,
    events,
    dependencies: {
      approvalRequestRepository: {
        async findPendingForApprover() {
          return [request];
        },
        async findByIdForTenant({ approvalRequestId, tenantId }) {
          if (
            approvalRequestId === request.id &&
            tenantId === request.tenantId
          ) {
            return request;
          }
          return null;
        },
      },
      approvalInteractionRepository: {
        async append(payload) {
          const stored = {
            id: `interaction-${interactions.length + 1}`,
            ...payload,
          };
          interactions.push(stored);
          return stored;
        },
      },
      auditAdapter: {
        async appendEvent(event) {
          events.push(event);
          return event;
        },
      },
      clock: () => new Date('2029-01-01T00:00:00.000Z'),
      ...overrides,
    },
  };
}

describe('HERMES audit service', () => {
  it('creates an interaction hash and audit event', async () => {
    const fixture = buildDependencies();
    const service = createHumanApprovalSpeakerService(
      fixture.dependencies
    );

    const result = await service.captureInteraction({
      approvalRequestId: 'approval-1',
      tenantId: 'tenant-1',
      authenticatedIdentity: {
        id: 'human-1',
        verified: true,
      },
      authorizedHumanRoles: ['governance-owner'],
      presentedText: 'Approve bounded documentation write',
      presentedScopeHash: 'scope-1',
      presentedRiskLevel: 2,
      decision: DECISIONS.APPROVED,
      rawResponseText: 'I confirm this approval',
      confirmationLevel: 2,
      requiredConfirmationLevel: 2,
      explicitConfirmation: true,
      transcriptHash: 'transcript-1',
      auditPathAvailable: true,
      previousInteractionHash: null,
    });

    assert.strictEqual(result.outcome, OUTCOMES.ALLOWED_WITH_CONTROLS);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
    assert.strictEqual(fixture.interactions.length, 1);
    assert.strictEqual(fixture.events.length, 1);
    assert.strictEqual(
      fixture.events[0].eventType,
      'APPROVAL_RESPONSE_CAPTURED'
    );
    assert.strictEqual(
      fixture.events[0].interactionHash,
      fixture.interactions[0].interactionHash
    );
  });

  it('links the previous interaction hash', async () => {
    const fixture = buildDependencies();
    const service = createHumanApprovalSpeakerService(
      fixture.dependencies
    );

    const previousHash = sha256('previous');

    await service.captureInteraction({
      approvalRequestId: 'approval-1',
      tenantId: 'tenant-1',
      authenticatedIdentity: {
        id: 'human-1',
        verified: true,
      },
      authorizedHumanRoles: ['governance-owner'],
      presentedText: 'Request more information',
      presentedScopeHash: 'scope-1',
      presentedRiskLevel: 2,
      decision: DECISIONS.MORE_INFORMATION,
      rawResponseText: 'Please provide more information',
      confirmationLevel: 0,
      requiredConfirmationLevel: 0,
      explicitConfirmation: false,
      transcriptHash: 'transcript-2',
      auditPathAvailable: true,
      previousInteractionHash: previousHash,
    });

    assert.strictEqual(
      fixture.interactions[0].previousInteractionHash,
      previousHash
    );
    assert.notStrictEqual(
      fixture.interactions[0].interactionHash,
      previousHash
    );
  });

  it('fails closed when interaction persistence fails', async () => {
    const fixture = buildDependencies({
      approvalInteractionRepository: {
        async append() {
          throw new Error('storage unavailable');
        },
      },
    });

    const service = createHumanApprovalSpeakerService(
      fixture.dependencies
    );

    const result = await service.captureInteraction({
      approvalRequestId: 'approval-1',
      tenantId: 'tenant-1',
      authenticatedIdentity: {
        id: 'human-1',
        verified: true,
      },
      authorizedHumanRoles: ['governance-owner'],
      presentedText: 'Reject request',
      presentedScopeHash: 'scope-1',
      presentedRiskLevel: 2,
      decision: DECISIONS.REJECTED,
      rawResponseText: 'Reject',
      transcriptHash: 'transcript-3',
      auditPathAvailable: true,
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
  });

  it('fails closed when audit persistence fails', async () => {
    const fixture = buildDependencies({
      auditAdapter: {
        async appendEvent() {
          throw new Error('audit unavailable');
        },
      },
    });

    const service = createHumanApprovalSpeakerService(
      fixture.dependencies
    );

    const result = await service.captureInteraction({
      approvalRequestId: 'approval-1',
      tenantId: 'tenant-1',
      authenticatedIdentity: {
        id: 'human-1',
        verified: true,
      },
      authorizedHumanRoles: ['governance-owner'],
      presentedText: 'Defer request',
      presentedScopeHash: 'scope-1',
      presentedRiskLevel: 2,
      decision: DECISIONS.DEFERRED,
      rawResponseText: 'Defer',
      transcriptHash: 'transcript-4',
      auditPathAvailable: true,
    });

    assert.strictEqual(result.outcome, OUTCOMES.BLOCKED);
    assert.strictEqual(result.allowedToContinueWorkflow, false);
  });
});
