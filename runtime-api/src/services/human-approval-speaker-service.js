'use strict';

/**
 * RSOS HERMES human approval speaker service.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * RUNTIME ACTIVATION: NOT APPROVED
 * DATABASE EXECUTION: NOT APPROVED
 *
 * This service composes pure policy evaluation with injected repositories
 * and audit adapters. It does not own approval authority, execution authority
 * or workflow continuation.
 */

const crypto = require('crypto');

const {
  DECISIONS,
  OUTCOMES,
  REASON_CODES,
  validateRequestContext,
  evaluateCapturedDecision,
  assertNoContinuation,
} = require('../policies/human-approval-speaker-policy');

const SERVICE_REASON_CODES = Object.freeze({
  INVALID_DEPENDENCIES: 'INVALID_DEPENDENCIES',
  REQUEST_NOT_FOUND: 'REQUEST_NOT_FOUND',
  REQUEST_NOT_AVAILABLE: 'REQUEST_NOT_AVAILABLE',
  INTERACTION_INPUT_INVALID: 'INTERACTION_INPUT_INVALID',
  AUDIT_WRITE_FAILED: 'AUDIT_WRITE_FAILED',
  INTERACTION_WRITE_FAILED: 'INTERACTION_WRITE_FAILED',
  SERVICE_SHADOW_ONLY: 'SERVICE_SHADOW_ONLY',
});

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : canonicalJson(value))
    .digest('hex');
}

function requireFunction(object, name) {
  if (!object || typeof object[name] !== 'function') {
    throw new Error(`${SERVICE_REASON_CODES.INVALID_DEPENDENCIES}:${name}`);
  }
}

function createHumanApprovalSpeakerService(dependencies) {
  const {
    approvalRequestRepository,
    approvalInteractionRepository,
    auditAdapter,
    clock = () => new Date(),
  } = dependencies || {};

  requireFunction(approvalRequestRepository, 'findPendingForApprover');
  requireFunction(approvalRequestRepository, 'findByIdForTenant');
  requireFunction(approvalInteractionRepository, 'append');
  requireFunction(auditAdapter, 'appendEvent');

  async function listPendingApprovals(context) {
    const {
      tenantId,
      authenticatedIdentity,
      authorizedHumanRoles,
      limit = 50,
    } = context || {};

    if (!tenantId || !authenticatedIdentity || authenticatedIdentity.verified !== true) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        approvals: [],
        reasonCodes: [
          !tenantId ? REASON_CODES.TENANT_MISSING : REASON_CODES.IDENTITY_UNVERIFIED,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    const approvals = await approvalRequestRepository.findPendingForApprover({
      tenantId,
      approverIdentity: authenticatedIdentity.id,
      authorizedHumanRoles: Array.isArray(authorizedHumanRoles)
        ? authorizedHumanRoles
        : [],
      now: clock(),
      limit: Math.min(Math.max(Number(limit) || 1, 1), 100),
      shadowMode: true,
    });

    return {
      outcome: OUTCOMES.ALLOWED_WITH_CONTROLS,
      runtimeMode: 'SHADOW',
      approvals: Array.isArray(approvals) ? approvals : [],
      allowedToContinueWorkflow: false,
      reasonCodes: [
        REASON_CODES.POLICY_ALLOWED_FOR_RECORD_ONLY,
        REASON_CODES.SHADOW_MODE_NO_CONTINUATION,
        SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
      ],
    };
  }

  async function getApprovalForPresentation(input) {
    const {
      approvalRequestId,
      tenantId,
      authenticatedIdentity,
      authorizedHumanRoles,
      presentedScopeHash,
      auditPathAvailable = false,
    } = input || {};

    const request = await approvalRequestRepository.findByIdForTenant({
      approvalRequestId,
      tenantId,
      shadowMode: true,
    });

    if (!request) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        request: null,
        allowedToPresent: false,
        allowedToRecord: false,
        allowedToContinueWorkflow: false,
        reasonCodes: [
          SERVICE_REASON_CODES.REQUEST_NOT_FOUND,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    const policyResult = validateRequestContext({
      request,
      authenticatedIdentity,
      authorizedHumanRoles,
      tenantId,
      presentedScopeHash,
      now: clock(),
      auditPathAvailable,
    });

    assertNoContinuation(policyResult);

    return {
      ...policyResult,
      request: policyResult.allowedToPresent ? request : null,
      runtimeMode: 'SHADOW',
    };
  }

  async function captureInteraction(input) {
    const {
      approvalRequestId,
      tenantId,
      authenticatedIdentity,
      authorizedHumanRoles,
      presentedText,
      presentedScopeHash,
      presentedRiskLevel,
      decision,
      rawResponseText,
      confirmationLevel = 0,
      requiredConfirmationLevel = 0,
      explicitConfirmation = false,
      transcriptHash,
      timeout = false,
      silence = false,
      channel = 'WEB',
      language = 'de-DE',
      auditPathAvailable = false,
      previousInteractionHash = null,
    } = input || {};

    if (!approvalRequestId || !tenantId || !presentedText || !presentedScopeHash) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        interaction: null,
        allowedToContinueWorkflow: false,
        reasonCodes: [
          SERVICE_REASON_CODES.INTERACTION_INPUT_INVALID,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    const request = await approvalRequestRepository.findByIdForTenant({
      approvalRequestId,
      tenantId,
      shadowMode: true,
    });

    if (!request) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        interaction: null,
        allowedToContinueWorkflow: false,
        reasonCodes: [
          SERVICE_REASON_CODES.REQUEST_NOT_FOUND,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    const policyResult = evaluateCapturedDecision({
      request,
      authenticatedIdentity,
      authorizedHumanRoles,
      tenantId,
      presentedScopeHash,
      now: clock(),
      auditPathAvailable,
      decision,
      rawResponseText,
      confirmationLevel,
      requiredConfirmationLevel,
      explicitConfirmation,
      transcriptHash,
      timeout,
      silence,
    });

    assertNoContinuation(policyResult);

    const occurredAt = clock();
    const interactionPayload = {
      approvalRequestId,
      tenantId,
      workflowId: request.workflowId,
      traceId: request.traceId,
      channel,
      speakerRole: 'HERMES',
      language,
      presentedText,
      presentedScopeHash,
      presentedRiskLevel,
      presentedAt: occurredAt,
      rawResponseText: rawResponseText || null,
      interpretedDecision: decision || null,
      confirmationLevel,
      identityVerified: Boolean(
        authenticatedIdentity && authenticatedIdentity.verified === true
      ),
      approverIdentity:
        authenticatedIdentity && authenticatedIdentity.id
          ? authenticatedIdentity.id
          : null,
      transcriptHash: transcriptHash || null,
      previousInteractionHash,
      runtimeMode: 'SHADOW',
      continuationEligible: false,
      policyOutcome: policyResult.outcome,
      policyReasonCodes: policyResult.reasonCodes,
    };

    interactionPayload.interactionHash = sha256({
      ...interactionPayload,
      previousInteractionHash,
    });

    let interaction;
    try {
      interaction = await approvalInteractionRepository.append(
        interactionPayload
      );
    } catch (error) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        interaction: null,
        allowedToContinueWorkflow: false,
        reasonCodes: [
          SERVICE_REASON_CODES.INTERACTION_WRITE_FAILED,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    try {
      await auditAdapter.appendEvent({
        eventType: 'APPROVAL_RESPONSE_CAPTURED',
        tenantId,
        workflowId: request.workflowId,
        traceId: request.traceId,
        approvalRequestId,
        interactionId: interaction.id,
        speakerRole: 'HERMES',
        approverIdentity: interactionPayload.approverIdentity,
        decision: interactionPayload.interpretedDecision,
        policyOutcome: policyResult.outcome,
        policyReasonCodes: policyResult.reasonCodes,
        interactionHash: interactionPayload.interactionHash,
        transcriptHash: interactionPayload.transcriptHash,
        occurredAt,
        runtimeMode: 'SHADOW',
        continuationEligible: false,
      });
    } catch (error) {
      return {
        outcome: OUTCOMES.BLOCKED,
        runtimeMode: 'SHADOW',
        interaction,
        allowedToContinueWorkflow: false,
        reasonCodes: [
          SERVICE_REASON_CODES.AUDIT_WRITE_FAILED,
          SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
        ],
      };
    }

    return {
      ...policyResult,
      runtimeMode: 'SHADOW',
      interaction,
      allowedToContinueWorkflow: false,
      reasonCodes: [
        ...policyResult.reasonCodes,
        SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
      ],
    };
  }

  return Object.freeze({
    listPendingApprovals,
    getApprovalForPresentation,
    captureInteraction,
  });
}

module.exports = {
  DECISIONS,
  OUTCOMES,
  REASON_CODES,
  SERVICE_REASON_CODES,
  canonicalJson,
  sha256,
  createHumanApprovalSpeakerService,
};
