const {
  verifyExecutionTrust
} = require(
  "../../modules/trust/" +
  "execution-trust-service"
);

const {
  deriveTrustGovernanceRecommendation,
  readTrustRiskLifecycleSummary
} = require(
  "../../modules/governance/" +
  "trust-risk-governance-service"
);

function buildTrustResponse({
  trustResult,
  trustGovernance,
  trustRiskLifecycle
}) {
  return {
    verification:
      trustResult.verification,

    status:
      trustResult.status,

    trust_score:
      trustResult.trust_score,

    chain_valid:
      trustResult.chain_valid,

    hashes_valid:
      trustResult.hashes_valid,

    legacy_mode:
      trustResult.legacy_mode,

    anomaly_events:
      trustResult.anomaly_events,

    trust_level:
      trustGovernance.trust_level,

    recommended_governance:
      trustGovernance
        .recommended_governance,

    governance_state:
      trustGovernance
        .governance_state,

    human_approval_required:
      trustGovernance
        .human_approval_required,

    autonomous_execution_allowed:
      trustGovernance
        .autonomous_execution_allowed,

    reason:
      trustGovernance.reason,

    risk_lifecycle:
      trustRiskLifecycle
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
  if (
    req.method !== "GET" ||
    path !== "/governance/evaluate"
  ) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    send(
      res,
      auth.code,
      auth.response
    );

    return true;
  }

  const result = await db.query(`
    SELECT *
    FROM runtime_objects
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    auth.user.tenant_id
  ]);

  const object =
    result.rows[0];

  const trustResult =
    await verifyExecutionTrust({
      db,

      tenantId:
        auth.user.tenant_id
    });

  const trustRiskLifecycle =
    await readTrustRiskLifecycleSummary({
      db,
      trustResult
    });

  const trustGovernance =
    deriveTrustGovernanceRecommendation(
      trustResult,
      trustRiskLifecycle
    );

  const trustResponse =
    buildTrustResponse({
      trustResult,
      trustGovernance,
      trustRiskLifecycle
    });

  if (!object) {
    send(res, 200, {
      decision:
        "no_object",

      governance_state:
        "no_object_available",

      trust:
        trustResponse
    });

    return true;
  }

  const riskAllowed =
    object.risk_score < 70;

  const trustAllowed =
    trustGovernance
      .recommended_governance ===
      "allowed";

  const allowed =
    riskAllowed &&
    trustAllowed;

  send(res, 200, {
    decision:
      allowed
        ? "allowed"
        : trustGovernance
            .recommended_governance,

    governance_state:
      allowed
        ? trustGovernance
            .governance_state
        : !riskAllowed
          ? "operator_approval_required"
          : trustGovernance
              .governance_state,

    risk_score:
      object.risk_score,

    evaluated_object:
      object.object_id,

    trust:
      trustResponse
  });

  return true;
}

module.exports = {
  buildTrustResponse,
  handleGovernanceEvaluateRoute
};
