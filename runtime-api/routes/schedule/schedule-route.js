async function handleScheduleRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (!(req.method === "POST" && path === "/runtime/schedule")) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const tenant_id = auth.user.tenant_id;
  const body = await readBody(req);

  const object_id = body.object_id;
  const execution_type = body.execution_type || "diagnostic.run";
  const payload = body.payload || {};
  const priority = body.priority || 100;
  const delay_seconds = body.delay_seconds || 0;

  const scheduled_for = new Date(
    Date.now() + delay_seconds * 1000
  ).toISOString();

  if (!object_id) {
    send(res, 400, {
      error: "missing_object_id"
    });
    return true;
  }

  const latestGovernanceResult = await db.query(`
    SELECT *
    FROM runtime_governance_decisions
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [
    tenant_id,
    object_id
  ]);

  const latestGovernanceDecision =
    latestGovernanceResult.rows[0] || null;

  if (!latestGovernanceDecision) {
    await writeEvent({
      event_type: "runtime.governance.gate.review_required",
      object_id,
      message: "Schedule gate requires governance check before scheduling",
      tenant_id
    });

    send(res, 403, {
      error: "governance_decision_required",
      gate_status: "review_required",
      object_id,
      tenant_id
    });
    return true;
  }

  if (latestGovernanceDecision.governance_status === "blocked") {
    await writeEvent({
      event_type: "runtime.governance.gate.blocked",
      object_id,
      message: "Scheduling blocked by governance gate",
      tenant_id
    });

    send(res, 403, {
      error: "schedule_blocked_by_governance",
      gate_status: "blocked",
      governance_status: latestGovernanceDecision.governance_status,
      decision_id: latestGovernanceDecision.decision_id,
      object_id,
      tenant_id
    });
    return true;
  }

  if (latestGovernanceDecision.governance_status === "review_required") {
    const approvalResult = await db.query(`
      SELECT *
      FROM runtime_governance_approvals
      WHERE tenant_id = $1
        AND decision_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [
      tenant_id,
      latestGovernanceDecision.decision_id
    ]);

    const approval = approvalResult.rows[0] || null;

    if (!approval) {
      await writeEvent({
        event_type: "runtime.governance.gate.review_required",
        object_id,
        message: "Scheduling requires review before governance gate allows scheduling",
        tenant_id
      });

      send(res, 403, {
        error: "schedule_requires_governance_review",
        gate_status: "review_required",
        governance_status: latestGovernanceDecision.governance_status,
        decision_id: latestGovernanceDecision.decision_id,
        object_id,
        tenant_id
      });
      return true;
    }

    if (approval.approval_status === "rejected") {
      await writeEvent({
        event_type: "runtime.governance.gate.blocked",
        object_id,
        message: "Scheduling rejected by governance approval",
        tenant_id
      });

      send(res, 403, {
        error: "schedule_rejected_by_governance_approval",
        gate_status: "blocked",
        governance_status: latestGovernanceDecision.governance_status,
        approval_status: approval.approval_status,
        decision_id: latestGovernanceDecision.decision_id,
        approval_id: approval.approval_id,
        object_id,
        tenant_id
      });
      return true;
    }

    if (approval.approval_status === "approved") {
      await writeEvent({
        event_type: "runtime.governance.gate.allowed",
        object_id,
        message: "Scheduling allowed by governance approval",
        tenant_id
      });
    }
  }

  await writeEvent({
    event_type: "runtime.governance.gate.allowed",
    object_id,
    message: "Scheduling allowed by governance gate",
    tenant_id
  });

  const job_id = `job-${Date.now()}`;

  const result = await db.query(`
    INSERT INTO runtime_execution_jobs (
      job_id,
      tenant_id,
      object_id,
      execution_type,
      status,
      requested_by,
      payload,
      scheduled_for,
      available_at,
      priority
    )
    VALUES (
      $1, $2, $3, $4, 'pending', $5, $6, $7, $7, $8
    )
    RETURNING
      job_id,
      object_id,
      execution_type,
      status,
      scheduled_for,
      priority
  `, [
    job_id,
    tenant_id,
    object_id,
    execution_type,
    auth.user.username || "runtime_admin",
    JSON.stringify(payload),
    scheduled_for,
    priority
  ]);

  await writeEvent({
    event_type: "runtime.job.scheduled",
    object_id,
    message: `Runtime job scheduled for ${scheduled_for}`,
    tenant_id
  });

  send(res, 200, {
    scheduled: true,
    job: result.rows[0]
  });
  return true;
}

module.exports = {
  handleScheduleRoute
};
