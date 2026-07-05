async function handleGovernancePolicyRoute({
  req,
  res,
  path,
  db,
  crypto,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
  if (req.method === "POST" && path === "/runtime/governance-policies") {
    const authUser = verifyToken(req);

    if (!authUser) {
      send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
      return true;
    }

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const policy_name = body.policy_name;
    const trust_level = body.trust_level;
    const min_trust_score = body.min_trust_score === undefined ? null : body.min_trust_score;
    const max_trust_score = body.max_trust_score === undefined ? null : body.max_trust_score;
    const governance_decision = body.governance_decision;
    const human_approval_required = body.human_approval_required === false ? false : true;
    const autonomous_execution_allowed = body.autonomous_execution_allowed === true ? true : false;
    const enabled = body.enabled === false ? false : true;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !policy_name || !trust_level || !governance_decision) {
      send(res, 400, {
        error: "validation_error",
        message: "tenant_id, policy_name, trust_level and governance_decision required"
      });
      return true;
    }

    const policy_id =
      "00000000-0000-4025-8000-" +
      crypto.randomBytes(6).toString("hex");

    await db.query(`
      INSERT INTO runtime_governance_policies (
        policy_id,
        tenant_id,
        policy_name,
        trust_level,
        min_trust_score,
        max_trust_score,
        governance_decision,
        human_approval_required,
        autonomous_execution_allowed,
        enabled,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      policy_id,
      tenant_id,
      policy_name,
      trust_level,
      min_trust_score,
      max_trust_score,
      governance_decision,
      human_approval_required,
      autonomous_execution_allowed,
      enabled,
      created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: policy_id,
      event_type: "runtime.governance_policy.created",
      message: JSON.stringify({
        policy_id,
        policy_name,
        trust_level,
        min_trust_score,
        max_trust_score,
        governance_decision,
        human_approval_required,
        autonomous_execution_allowed,
        enabled
      })
    });

    send(res, 201, {
      governance_policy: {
        policy_id,
        tenant_id,
        policy_name,
        trust_level,
        min_trust_score,
        max_trust_score,
        governance_decision,
        human_approval_required,
        autonomous_execution_allowed,
        enabled,
        created_by
      }
    });
    return true;
  }

  if (req.method === "GET" && path === "/runtime/governance-policies") {
    const authUser = verifyToken(req);

    if (!authUser) {
      send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
      return true;
    }

    const tenant_id = authUser.tenant_id;

    if (!tenant_id) {
      send(res, 400, {
        error: "validation_error",
        message: "tenant_id required"
      });
      return true;
    }

    const result = await db.query(`
      SELECT
        policy_id,
        tenant_id,
        policy_name,
        trust_level,
        min_trust_score,
        max_trust_score,
        governance_decision,
        human_approval_required,
        autonomous_execution_allowed,
        enabled,
        created_at,
        created_by
      FROM runtime_governance_policies
      WHERE tenant_id = $1
      ORDER BY min_trust_score ASC, created_at ASC
      LIMIT 100
    `, [
      tenant_id
    ]);

    send(res, 200, {
      governance_policies: result.rows
    });
    return true;
  }

  return false;
}

module.exports = {
  handleGovernancePolicyRoute
};
