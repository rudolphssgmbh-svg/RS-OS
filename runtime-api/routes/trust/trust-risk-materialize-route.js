const {
  verifyExecutionTrust
} = require(
  "../../modules/trust/execution-trust-service"
);

const {
  materializeExecutionTrustRisks
} = require(
  "../../modules/trust/" +
  "trust-risk-materialization-service"
);

const MATERIALIZE_PATH =
  "/runtime/execution/trust-risks/materialize";

async function handleTrustRiskMaterializeRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (
    req.method !== "POST" ||
    path !== MATERIALIZE_PATH
  ) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin"
  ]);

  if (!auth.allowed) {
    return send(
      res,
      auth.code,
      auth.response
    );
  }

  const observedAt = new Date();

  const trustResult =
    await verifyExecutionTrust({
      db,
      tenantId:
        auth.user.tenant_id
    });

  const materializationResult =
    await materializeExecutionTrustRisks({
      db,
      trustResult,
      observedAt,
      observedBy:
        auth.user.operator_id ||
        auth.user.username ||
        "system_admin"
    });

  return send(res, 200, {
    action:
      "runtime.execution." +
      "trust-risks.materialize",

    verification:
      trustResult.verification,

    tenant_id:
      auth.user.tenant_id,

    trust_status:
      trustResult.status,

    trust_scope:
      trustResult.scope,

    chain_valid:
      trustResult.chain_valid,

    hashes_valid:
      trustResult.hashes_valid,

    legacy_mode:
      trustResult.legacy_mode,

    anomaly_events:
      trustResult.anomaly_events,

    observed_at:
      observedAt.toISOString(),

    materialized_count:
      materializationResult.materialized_count,

    trust_risks:
      materializationResult.trust_risks
  });
}

module.exports = {
  MATERIALIZE_PATH,
  handleTrustRiskMaterializeRoute
};
