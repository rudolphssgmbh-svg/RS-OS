async function handleIncidentGovernanceRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
// RSOS-073D INCIDENT GOVERNANCE COMPLETENESS

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/governance\/completeness$/)
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const incident_id = path.split("/")[3];

  const incident = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (incident.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const decisions = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const approvals = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_governance_approvals
    WHERE tenant_id = $1
      AND object_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const risks = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_risks
    WHERE tenant_id = $1
      AND object_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const checks = {
    has_decision: decisions.rows[0].count > 0,
    has_approval: approvals.rows[0].count > 0,
    has_residual_risk: risks.rows[0].count > 0,
    incident_closed: incident.rows[0].status === "closed"
  };

  const governanceReady =
    checks.has_decision &&
    checks.has_approval &&
    checks.has_residual_risk &&
    checks.incident_closed;

  return send(res, 200, {
    incident_id,
    tenant_id: auth.user.tenant_id,
    governance_ready: governanceReady,
    checks,
    counts: {
      decisions: decisions.rows[0].count,
      approvals: approvals.rows[0].count,
      residual_risks: risks.rows[0].count
    }
  });
}


// RSOS-073C CREATE INCIDENT RESIDUAL RISK

if (
  req.method === "POST" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/residual-risk$/)
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const incident_id = path.split("/")[3];
  const body = await readBody(req);

  const incident = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (incident.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const probability = Number(body.probability || 1);
  const damage = Number(body.damage || 1);
  const risk_score = probability * damage;

  const risk_id =
    "risk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const result = await db.query(`
    INSERT INTO runtime_risks (
      risk_id,
      object_id,
      tenant_id,
      title,
      description,
      risk_category,
      risk_state,
      probability,
      damage,
      risk_score,
      created_at,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
    RETURNING *
  `, [
    risk_id,
    incident_id,
    auth.user.tenant_id,
    body.title || "Incident residual risk",
    body.description || null,
    body.risk_category || "incident",
    body.risk_state || "concrete",
    probability,
    damage,
    risk_score
  ]);

  await writeEvent({
    tenant_id: auth.user.tenant_id,
    object_id: incident_id,
    event_type: "runtime.incident.residual_risk.created",
    message: JSON.stringify({
      incident_id,
      risk_id,
      probability,
      damage,
      risk_score,
      created_by: auth.user.operator_id
    }),
    created_by: auth.user.operator_id
  });

  return send(res, 201, {
    incident: incident.rows[0],
    residual_risk: result.rows[0]
  });
}


// RSOS-073B CREATE INCIDENT GOVERNANCE APPROVAL

if (
  req.method === "POST" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/governance-approval$/)
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const incident_id = path.split("/")[3];
  const body = await readBody(req);

  const incident = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (incident.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const latestDecision = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (latestDecision.rows.length === 0) {
    return send(res, 400, {
      error: "validation_error",
      message: "governance decision required before approval"
    });
  }

  const approval_id =
    "appr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const decision = latestDecision.rows[0];

  const allowedApprovalStatuses = [
    "approved",
    "rejected"
  ];

  const approvalStatus =
    body.approval_status || body.status || "approved";

  if (!allowedApprovalStatuses.includes(approvalStatus)) {
    return send(res, 400, {
      error: "validation_error",
      message: "invalid governance approval status",
      allowed_statuses: allowedApprovalStatuses
    });
  }

  const reason =
    body.reason || "Incident governance approval created";

  const result = await db.query(`
    INSERT INTO runtime_governance_approvals (
      approval_id,
      decision_id,
      object_id,
      tenant_id,
      approval_status,
      reason,
      requested_by,
      decided_by,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
    RETURNING *
  `, [
    approval_id,
    decision.decision_id,
    incident_id,
    auth.user.tenant_id,
    approvalStatus,
    reason,
    body.requested_by || incident.rows[0].created_by || auth.user.operator_id,
    auth.user.operator_id
  ]);

  await writeEvent({
    tenant_id: auth.user.tenant_id,
    object_id: incident_id,
    event_type: "runtime.incident.governance_approval.created",
    message: JSON.stringify({
      incident_id,
      decision_id: decision.decision_id,
      approval_id,
      approval_status: approvalStatus,
      reason,
      decided_by: auth.user.operator_id
    }),
    created_by: auth.user.operator_id
  });

  return send(res, 201, {
    incident: incident.rows[0],
    governance_decision: decision,
    governance_approval: result.rows[0]
  });
}


// RSOS-073A CREATE INCIDENT GOVERNANCE REVIEW

if (
  req.method === "POST" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/governance-review$/)
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const incident_id = path.split("/")[3];
  const body = await readBody(req);

  const incident = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (incident.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const decision_id =
    "gov-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

  const allowedGovernanceStatuses = [
    "pending_review",
    "review_required",
    "allowed",
    "blocked"
  ];

  const governance_status =
    body.status || "pending_review";

  if (!allowedGovernanceStatuses.includes(governance_status)) {
    return send(res, 400, {
      error: "validation_error",
      message: "invalid governance decision status",
      allowed_statuses: allowedGovernanceStatuses
    });
  }

  const reason_codes = {
    decision_type: body.decision_type || "incident_governance_review",
    reason: body.reason || "Incident governance review created",
    created_by: auth.user.operator_id
  };

  const result = await db.query(`
    INSERT INTO runtime_governance_decisions (
      decision_id,
      object_id,
      tenant_id,
      governance_status,
      reason_codes,
      risk_count,
      max_risk_score,
      acute_risk_count,
      open_action_count,
      high_open_action_count,
      graph_edge_count,
      audit_event_count,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,0,0,0,0,0,0,0,now())
    RETURNING *
  `, [
    decision_id,
    incident_id,
    auth.user.tenant_id,
    governance_status,
    JSON.stringify(reason_codes)
  ]);

  await writeEvent({
    tenant_id: auth.user.tenant_id,
    object_id: incident_id,
    event_type: "runtime.incident.governance_review.created",
    message: JSON.stringify({
      incident_id,
      decision_id,
      governance_status,
      reason_codes,
      created_by: auth.user.operator_id
    }),
    created_by: auth.user.operator_id
  });

  return send(res, 201, {
    incident: incident.rows[0],
    governance_decision: result.rows[0]
  });
}


// RSOS-072F INCIDENT GOVERNANCE VIEW

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/governance$/)
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const incident_id = path.split("/")[3];

  const decisions = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const approvals = await db.query(`
    SELECT *
    FROM runtime_governance_approvals
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const risks = await db.query(`
    SELECT *
    FROM runtime_risks
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  return send(res, 200, {
    incident_id,

    governance_decisions:
      decisions.rows.length,

    governance_approvals:
      approvals.rows.length,

    latest_decision:
      decisions.rows[0] || null,

    latest_approval:
      approvals.rows[0] || null,

    residual_risk:
      risks.rows[0] || null
  });
}



  return false;
}

module.exports = {
  handleIncidentGovernanceRoute
};
