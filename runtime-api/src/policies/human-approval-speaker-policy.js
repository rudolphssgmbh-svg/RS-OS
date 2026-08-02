'use strict';

/**
 * RSOS HERMES human approval speaker policy.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * RUNTIME ACTIVATION: NOT APPROVED
 * DATABASE EXECUTION: NOT APPROVED
 *
 * This module is pure policy logic. It performs no I/O, no database access,
 * no workflow mutation and no runtime activation.
 */

const DECISIONS = Object.freeze({
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DEFERRED: 'DEFERRED',
  MORE_INFORMATION: 'MORE_INFORMATION',
  CANCELLED: 'CANCELLED',
  AMBIGUOUS: 'AMBIGUOUS',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
});

const OUTCOMES = Object.freeze({
  ALLOWED_WITH_CONTROLS: 'ALLOWED_WITH_CONTROLS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  BLOCKED: 'BLOCKED',
});

const REASON_CODES = Object.freeze({
  POLICY_DRAFT_SHADOW_ONLY: 'POLICY_DRAFT_SHADOW_ONLY',
  REQUEST_MISSING: 'REQUEST_MISSING',
  IDENTITY_MISSING: 'IDENTITY_MISSING',
  IDENTITY_UNVERIFIED: 'IDENTITY_UNVERIFIED',
  APPROVER_ROLE_MISSING: 'APPROVER_ROLE_MISSING',
  APPROVER_ROLE_UNAUTHORIZED: 'APPROVER_ROLE_UNAUTHORIZED',
  TENANT_MISSING: 'TENANT_MISSING',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  REQUEST_EXPIRED: 'REQUEST_EXPIRED',
  REQUEST_REVOKED: 'REQUEST_REVOKED',
  REQUEST_NOT_PRESENTABLE: 'REQUEST_NOT_PRESENTABLE',
  SCOPE_HASH_MISSING: 'SCOPE_HASH_MISSING',
  SCOPE_HASH_MISMATCH: 'SCOPE_HASH_MISMATCH',
  DECISION_MISSING: 'DECISION_MISSING',
  DECISION_UNSUPPORTED: 'DECISION_UNSUPPORTED',
  DECISION_AMBIGUOUS: 'DECISION_AMBIGUOUS',
  SILENCE_OR_TIMEOUT: 'SILENCE_OR_TIMEOUT',
  EXPLICIT_CONFIRMATION_REQUIRED: 'EXPLICIT_CONFIRMATION_REQUIRED',
  CONFIRMATION_LEVEL_INSUFFICIENT: 'CONFIRMATION_LEVEL_INSUFFICIENT',
  TRANSCRIPT_HASH_MISSING: 'TRANSCRIPT_HASH_MISSING',
  AUDIT_PATH_UNAVAILABLE: 'AUDIT_PATH_UNAVAILABLE',
  SHADOW_MODE_NO_CONTINUATION: 'SHADOW_MODE_NO_CONTINUATION',
  HERMES_NO_APPROVAL_AUTHORITY: 'HERMES_NO_APPROVAL_AUTHORITY',
  HERMES_NO_EXECUTION_AUTHORITY: 'HERMES_NO_EXECUTION_AUTHORITY',
  HERMES_NO_WORKFLOW_MUTATION: 'HERMES_NO_WORKFLOW_MUTATION',
  POLICY_ALLOWED_FOR_RECORD_ONLY: 'POLICY_ALLOWED_FOR_RECORD_ONLY',
});

const TERMINAL_BLOCK_DECISIONS = new Set([
  DECISIONS.AMBIGUOUS,
  DECISIONS.EXPIRED,
  DECISIONS.REVOKED,
]);

const SUPPORTED_DECISIONS = new Set(Object.values(DECISIONS));

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pushReason(reasons, code) {
  if (!reasons.includes(code)) reasons.push(code);
}

function baseResult() {
  return {
    outcome: OUTCOMES.BLOCKED,
    allowedToPresent: false,
    allowedToRecord: false,
    allowedToContinueWorkflow: false,
    runtimeMode: 'SHADOW',
    reasonCodes: [REASON_CODES.POLICY_DRAFT_SHADOW_ONLY],
  };
}

function validateRequestContext(input) {
  const result = baseResult();
  const reasons = result.reasonCodes;

  if (!input || typeof input !== 'object') {
    pushReason(reasons, REASON_CODES.REQUEST_MISSING);
    return result;
  }

  const {
    request,
    authenticatedIdentity,
    authorizedHumanRoles,
    tenantId,
    presentedScopeHash,
    now = new Date(),
    auditPathAvailable = false,
  } = input;

  if (!request || typeof request !== 'object') {
    pushReason(reasons, REASON_CODES.REQUEST_MISSING);
    return result;
  }

  if (!authenticatedIdentity) {
    pushReason(reasons, REASON_CODES.IDENTITY_MISSING);
    return result;
  }

  if (authenticatedIdentity.verified !== true) {
    pushReason(reasons, REASON_CODES.IDENTITY_UNVERIFIED);
    return result;
  }

  if (!request.requiredHumanRole) {
    pushReason(reasons, REASON_CODES.APPROVER_ROLE_MISSING);
    return result;
  }

  const roleSet = new Set(Array.isArray(authorizedHumanRoles) ? authorizedHumanRoles : []);
  if (!roleSet.has(request.requiredHumanRole)) {
    pushReason(reasons, REASON_CODES.APPROVER_ROLE_UNAUTHORIZED);
    return result;
  }

  if (!tenantId || !request.tenantId) {
    pushReason(reasons, REASON_CODES.TENANT_MISSING);
    return result;
  }

  if (tenantId !== request.tenantId) {
    pushReason(reasons, REASON_CODES.TENANT_MISMATCH);
    return result;
  }

  const currentTime = asDate(now);
  const validUntil = asDate(request.validUntil);

  if (!currentTime || !validUntil || currentTime >= validUntil) {
    pushReason(reasons, REASON_CODES.REQUEST_EXPIRED);
    return result;
  }

  if (request.status === 'REVOKED' || request.revokedAt) {
    pushReason(reasons, REASON_CODES.REQUEST_REVOKED);
    return result;
  }

  if (!request.scopeHash || !presentedScopeHash) {
    pushReason(reasons, REASON_CODES.SCOPE_HASH_MISSING);
    return result;
  }

  if (request.scopeHash !== presentedScopeHash) {
    pushReason(reasons, REASON_CODES.SCOPE_HASH_MISMATCH);
    return result;
  }

  if (!auditPathAvailable) {
    pushReason(reasons, REASON_CODES.AUDIT_PATH_UNAVAILABLE);
    return result;
  }

  result.outcome = OUTCOMES.ALLOWED_WITH_CONTROLS;
  result.allowedToPresent = true;
  result.allowedToRecord = true;
  pushReason(reasons, REASON_CODES.POLICY_ALLOWED_FOR_RECORD_ONLY);
  pushReason(reasons, REASON_CODES.SHADOW_MODE_NO_CONTINUATION);
  pushReason(reasons, REASON_CODES.HERMES_NO_WORKFLOW_MUTATION);

  return result;
}

function evaluateCapturedDecision(input) {
  const result = validateRequestContext(input);
  const reasons = result.reasonCodes;

  if (result.outcome === OUTCOMES.BLOCKED) return result;

  const {
    decision,
    rawResponseText,
    confirmationLevel = 0,
    requiredConfirmationLevel = 0,
    explicitConfirmation = false,
    transcriptHash,
    timeout = false,
    silence = false,
  } = input;

  if (silence || timeout) {
    result.outcome = OUTCOMES.BLOCKED;
    result.allowedToRecord = true;
    pushReason(reasons, REASON_CODES.SILENCE_OR_TIMEOUT);
    return result;
  }

  if (!decision) {
    result.outcome = OUTCOMES.REVIEW_REQUIRED;
    pushReason(reasons, REASON_CODES.DECISION_MISSING);
    return result;
  }

  if (!SUPPORTED_DECISIONS.has(decision)) {
    result.outcome = OUTCOMES.BLOCKED;
    pushReason(reasons, REASON_CODES.DECISION_UNSUPPORTED);
    return result;
  }

  if (TERMINAL_BLOCK_DECISIONS.has(decision)) {
    result.outcome = OUTCOMES.BLOCKED;
    pushReason(reasons, REASON_CODES.DECISION_AMBIGUOUS);
    return result;
  }

  if (!rawResponseText || !rawResponseText.trim()) {
    result.outcome = OUTCOMES.REVIEW_REQUIRED;
    pushReason(reasons, REASON_CODES.DECISION_MISSING);
    return result;
  }

  if (!transcriptHash) {
    result.outcome = OUTCOMES.BLOCKED;
    pushReason(reasons, REASON_CODES.TRANSCRIPT_HASH_MISSING);
    return result;
  }

  if (decision === DECISIONS.APPROVED) {
    if (!explicitConfirmation) {
      result.outcome = OUTCOMES.REVIEW_REQUIRED;
      pushReason(reasons, REASON_CODES.EXPLICIT_CONFIRMATION_REQUIRED);
      return result;
    }

    if (confirmationLevel < requiredConfirmationLevel) {
      result.outcome = OUTCOMES.REVIEW_REQUIRED;
      pushReason(reasons, REASON_CODES.CONFIRMATION_LEVEL_INSUFFICIENT);
      return result;
    }

    pushReason(reasons, REASON_CODES.HERMES_NO_APPROVAL_AUTHORITY);
    pushReason(reasons, REASON_CODES.HERMES_NO_EXECUTION_AUTHORITY);
  }

  result.outcome = OUTCOMES.ALLOWED_WITH_CONTROLS;
  result.allowedToRecord = true;
  result.allowedToContinueWorkflow = false;
  pushReason(reasons, REASON_CODES.SHADOW_MODE_NO_CONTINUATION);

  return result;
}

function assertNoContinuation(result) {
  if (!result || result.allowedToContinueWorkflow !== false) {
    throw new Error(REASON_CODES.HERMES_NO_WORKFLOW_MUTATION);
  }
  return true;
}

module.exports = {
  DECISIONS,
  OUTCOMES,
  REASON_CODES,
  validateRequestContext,
  evaluateCapturedDecision,
  assertNoContinuation,
};
