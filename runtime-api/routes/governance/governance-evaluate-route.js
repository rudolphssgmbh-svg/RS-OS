const { verifyExecutionTrust } = require("../../modules/trust/execution-trust-service");

function deriveTrustGovernanceRecommendation(trustResult) {
  if (!trustResult.chain_valid || !trustResult.hashes_valid) {
    return {
      trust_level: "BLOCKED",
      recommended_governance: "blocked",
      human_approval_required: true,
      autonomous_execution_allowed: false,
      reason: "Execution trust chain or hash verification failed"
    };
  }

  if (trustResult.trust_score < 60) {
    return {
      trust_level: "BLOCKED",
      recommended_governance: "blocked",
      human_approval_required: true,
      autonomous_execution_allowed: false,
      reason: "Trust score below blocking threshold"
    };
  }

  if (trustResult.trust_score < 80) {
    return {
      trust_level: "REVIEW_REQUIRED",
      recommended_governance: "review_required",
      human_approval_required: true,
      autonomous_execution_allowed: false,
      reason: "Trust score requires governance review"
    };
  }

  if (trustResult.legacy_mode || trustResult.anomaly_events > 0) {
    return {
      trust_level: "VERIFIED_WITH_LEGACY",
      recommended_governance: "review_required",
      human_approval_required: true,
      autonomous_execution_allowed: false,
      reason: "Trust is valid but legacy or anomaly markers require human review"
    };
  }

  return {
    trust_level: "VERIFIED",
    recommended_governance: "allowed",
    human_approval_required: false,
    autonomous_execution_allowed: true,
    reason: "Execution trust verified without legacy or anomaly markers"
  };
}

async function handleGovernanceEvaluateRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method !== "GET" || path !== "/governance/evaluate") {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const result = await db.query(`
    SELECT *
    FROM runtime_objects
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [auth.user.tenant_id]);

  const object = result.rows[0];

  const trustResult = await verifyExecutionTrust({
    db,
    tenantId: auth.user.tenant_id
  });

  const trustGovernance = deriveTrustGovernanceRecommendation(trustResult);

  if (!object) {
    send(res, 200, {
      decision: "no_object",
      governance_state: "no_object_available",
      trust: {
        verification: trustResult.verification,
        status: trustResult.status,
        trust_score: trustResult.trust_score,
        chain_valid: trustResult.chain_valid,
        hashes_valid: trustResult.hashes_valid,
        legacy_mode: trustResult.legacy_mode,
        anomaly_events: trustResult.anomaly_events,
        trust_level: trustGovernance.trust_level,
        recommended_governance: trustGovernance.recommended_governance,
        reason: trustGovernance.reason
      }
    });
    return true;
  }

  const riskAllowed = object.risk_score < 70;
  const trustAllowed = trustGovernance.recommended_governance === "allowed";

  const allowed = riskAllowed && trustAllowed;

  send(res, 200, {
    decision: allowed ? "allowed" : trustGovernance.recommended_governance,
    governance_state: allowed
      ? "baseline_clear"
      : !riskAllowed
        ? "operator_approval_required"
        : "trust_review_required",
    risk_score: object.risk_score,
    evaluated_object: object.object_id,
    trust: {
      verification: trustResult.verification,
      status: trustResult.status,
      trust_score: trustResult.trust_score,
      chain_valid: trustResult.chain_valid,
      hashes_valid: trustResult.hashes_valid,
      legacy_mode: trustResult.legacy_mode,
      anomaly_events: trustResult.anomaly_events,
      trust_level: trustGovernance.trust_level,
      recommended_governance: trustGovernance.recommended_governance,
      human_approval_required: trustGovernance.human_approval_required,
      autonomous_execution_allowed: trustGovernance.autonomous_execution_allowed,
      reason: trustGovernance.reason
    }
  });

  return true;
}

module.exports = {
  handleGovernanceEvaluateRoute
};
