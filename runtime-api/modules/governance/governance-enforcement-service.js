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

function buildEnforcementEvidence({
  route,
  action,
  job_id = null,
  orchestration_id = null,
  enforcementResult
}) {
  const result = enforcementResult || {};

  return {
    evidence_type: "governance.enforcement",
    route: route || "unknown",
    action: action || "unknown",
    allowed: result.allowed === true,
    status: result.status || "unknown",
    reason: result.reason || "unknown",
    gate_status: result.gate_status || null,
    error: result.error || null,
    tenant_id: result.tenant_id || null,
    object_id: result.object_id || null,
    decision_id: result.decision_id || null,
    approval_id: result.approval_id || null,
    approval_status: result.approval_status || null,
    governance_status: result.governance_status || null,
    job_id,
    orchestration_id,
    created_at: new Date().toISOString()
  };
}

async function enforceGovernanceDecisionGate({
  db,
  tenant_id,
  object_id
}) {
  const latestGovernanceResult = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY
      revision_number DESC,
      decision_id DESC
    LIMIT 1
  `, [
    tenant_id,
    object_id
  ]);

  const latestGovernanceDecision =
    latestGovernanceResult.rows[0] || null;

  if (!latestGovernanceDecision) {
    return {
      allowed: false,
      status: "review_required",
      reason: "governance_decision_required",
      error: "governance_decision_required",
      gate_status: "review_required",
      object_id,
      tenant_id,
      latest_governance_decision: null,
      approval: null
    };
  }

  const sourceGovernanceStatus =
    latestGovernanceDecision.governance_status;

  const governanceStatus =
    sourceGovernanceStatus === "pending_review"
      ? "review_required"
      : sourceGovernanceStatus;

  const canonicalGovernanceStatuses = new Set([
    "allowed",
    "review_required",
    "blocked"
  ]);

  if (!canonicalGovernanceStatuses.has(governanceStatus)) {
    return {
      allowed: false,
      status: "blocked",
      reason: "invalid_governance_decision_status",
      error: "invalid_governance_decision_status",
      gate_status: "blocked",
      governance_status: "blocked",
      source_governance_status: sourceGovernanceStatus,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id,
      latest_governance_decision: latestGovernanceDecision,
      approval: null
    };
  }

  if (governanceStatus === "blocked") {
    return {
      allowed: false,
      status: "blocked",
      reason: "execution_blocked_by_governance",
      error: "execution_blocked_by_governance",
      gate_status: "blocked",
      governance_status: governanceStatus,
      source_governance_status: sourceGovernanceStatus,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id,
      latest_governance_decision: latestGovernanceDecision,
      approval: null
    };
  }

  if (governanceStatus === "review_required") {
    const approvalResult = await db.query(`
      SELECT *
      FROM runtime_governance_approvals
      WHERE tenant_id = $1
        AND decision_id = $2
      ORDER BY
        created_at DESC,
        approval_id DESC
      LIMIT 1
    `, [
      tenant_id,
      latestGovernanceDecision.decision_id
    ]);

    const approval = approvalResult.rows[0] || null;

    if (!approval) {
      return {
        allowed: false,
        status: "review_required",
        reason: "execution_requires_governance_review",
        error: "execution_requires_governance_review",
        gate_status: "review_required",
        governance_status: governanceStatus,
        source_governance_status: sourceGovernanceStatus,
        decision_id: latestGovernanceDecision.decision_id,
        object_id,
        tenant_id,
        latest_governance_decision: latestGovernanceDecision,
        approval: null
      };
    }

    if (approval.approval_status === "rejected") {
      return {
        allowed: false,
        status: "blocked",
        reason: "execution_rejected_by_governance_approval",
        error: "execution_rejected_by_governance_approval",
        gate_status: "blocked",
        governance_status: governanceStatus,
        source_governance_status: sourceGovernanceStatus,
        approval_status: approval.approval_status,
        decision_id: latestGovernanceDecision.decision_id,
        approval_id: approval.approval_id,
        object_id,
        tenant_id,
        latest_governance_decision: latestGovernanceDecision,
        approval
      };
    }

    if (approval.approval_status === "approved") {
      return {
        allowed: true,
        status: "allowed",
        reason: "execution_allowed_by_governance_approval",
        gate_status: "allowed",
        governance_status: governanceStatus,
        source_governance_status: sourceGovernanceStatus,
        approval_status: approval.approval_status,
        decision_id: latestGovernanceDecision.decision_id,
        approval_id: approval.approval_id,
        object_id,
        tenant_id,
        latest_governance_decision: latestGovernanceDecision,
        approval
      };
    }

    return {
      allowed: false,
      status: "blocked",
      reason: "invalid_governance_approval_status",
      error: "invalid_governance_approval_status",
      gate_status: "blocked",
      governance_status: governanceStatus,
      source_governance_status: sourceGovernanceStatus,
      approval_status: approval.approval_status,
      decision_id: latestGovernanceDecision.decision_id,
      approval_id: approval.approval_id,
      object_id,
      tenant_id,
      latest_governance_decision: latestGovernanceDecision,
      approval
    };
  }

  if (governanceStatus === "allowed") {
    return {
      allowed: true,
      status: "allowed",
      reason: "execution_allowed_by_governance_gate",
      gate_status: "allowed",
      governance_status: governanceStatus,
      source_governance_status: sourceGovernanceStatus,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id,
      latest_governance_decision: latestGovernanceDecision,
      approval: null
    };
  }

  return {
    allowed: false,
    status: "blocked",
    reason: "invalid_governance_decision_status",
    error: "invalid_governance_decision_status",
    gate_status: "blocked",
    governance_status: "blocked",
    source_governance_status: sourceGovernanceStatus,
    decision_id: latestGovernanceDecision.decision_id,
    object_id,
    tenant_id,
    latest_governance_decision: latestGovernanceDecision,
    approval: null
  };
}

module.exports = {
  buildEnforcementEvidence,
  enforceGovernanceForExecution,
  enforceGovernanceDecisionGate,
  normalizeGovernanceDecision
};
