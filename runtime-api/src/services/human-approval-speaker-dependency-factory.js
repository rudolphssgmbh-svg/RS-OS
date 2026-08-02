'use strict';
const { OUTCOMES, SERVICE_REASON_CODES, createHumanApprovalSpeakerService } = require('./human-approval-speaker-service');
const DEPENDENCY_REASON_CODES = Object.freeze({
  REPOSITORY_ADAPTERS_NOT_BOUND: 'REPOSITORY_ADAPTERS_NOT_BOUND',
  DEPENDENCY_FACTORY_SHADOW_ONLY: 'DEPENDENCY_FACTORY_SHADOW_ONLY',
});
function createUnavailableService() {
  const blocked = async () => ({
    outcome: OUTCOMES.BLOCKED,
    runtimeMode: 'SHADOW',
    allowedToContinueWorkflow: false,
    reasonCodes: [
      DEPENDENCY_REASON_CODES.REPOSITORY_ADAPTERS_NOT_BOUND,
      DEPENDENCY_REASON_CODES.DEPENDENCY_FACTORY_SHADOW_ONLY,
      SERVICE_REASON_CODES.SERVICE_SHADOW_ONLY,
    ],
  });
  return Object.freeze({ listPendingApprovals: blocked, getApprovalForPresentation: blocked, captureInteraction: blocked });
}
function createHumanApprovalSpeakerRuntimeService(dependencies = {}) {
  const { approvalRequestRepository, approvalInteractionRepository, auditAdapter, clock } = dependencies;
  if (!approvalRequestRepository || !approvalInteractionRepository || !auditAdapter) return createUnavailableService();
  return createHumanApprovalSpeakerService({ approvalRequestRepository, approvalInteractionRepository, auditAdapter, clock });
}
module.exports = { DEPENDENCY_REASON_CODES, createUnavailableService, createHumanApprovalSpeakerRuntimeService };
