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

  if (!object) {
    send(res, 200, {
      decision: "no_object"
    });
    return true;
  }

  const allowed = object.risk_score < 70;

  send(res, 200, {
    decision: allowed ? "allowed" : "blocked",
    governance_state: allowed
      ? "baseline_clear"
      : "operator_approval_required",
    risk_score: object.risk_score,
    evaluated_object: object.object_id
  });

  return true;
}

module.exports = {
  handleGovernanceEvaluateRoute
};
