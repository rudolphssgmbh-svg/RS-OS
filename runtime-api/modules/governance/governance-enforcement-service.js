const { evaluateExecutionTrust } = require("../trust/execution-trust-service");

function normalizeGovernanceDecision(trustEvaluation) {
  const autonomousAllowed =
    trustEvaluation &&
    trustEvaluation.autonomous_execution_allowed === true;

  const governanceState =
    trustEvaluation && trustEvaluation.governance_state
      ? trustEvaluation.governance_state
      : "unknown";

  let status = "blocked";
  let reason = "governance_evaluation_missing_or_invalid";

  if (autonomousAllowed) {
    status = "allowed";
    reason = "autonomous_execution_allowed";
  } else if (
    governanceState === "trust_review_required" ||
    governanceState === "review_required"
  ) {
    status = "review_required";
    reason = "governance_requires_human_review";
  } else if (governanceState === "blocked") {
    status = "blocked";
    reason = "governance_blocked_execution";
  }

  return {
    allowed: status === "allowed",
    status,
    reason,
    governance_state: governanceState,
    decision: trustEvaluation ? trustEvaluation.decision : "blocked",
    trust_score: trustEvaluation ? trustEvaluation.trust_score : null,
    trust_level: trustEvaluation ? trustEvaluation.trust_level : "UNKNOWN",
    chain_valid: trustEvaluation ? trustEvaluation.chain_valid : false,
    hashes_valid: trustEvaluation ? trustEvaluation.hashes_valid : false,
    legacy_mode: trustEvaluation ? trustEvaluation.legacy_mode : true,
    autonomous_execution_allowed: autonomousAllowed,
    trust_evaluation: trustEvaluation || null
  };
}

async function enforceGovernanceForExecution(options = {}) {
  const trustEvaluation = await evaluateExecutionTrust(options);
  return normalizeGovernanceDecision(trustEvaluation);
}

module.exports = {
  enforceGovernanceForExecution,
  normalizeGovernanceDecision
};
