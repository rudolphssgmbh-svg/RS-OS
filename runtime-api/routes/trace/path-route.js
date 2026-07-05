async function handlePathRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  // GET EXECUTION PATH BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/execution/path/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const object_id = decodeURIComponent(
      path.replace("/runtime/execution/path/", "")
    );

    if (!object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const result = await db.query(`
      SELECT
        job_id,
        object_id,
        action,
        status,
        requested_by,
        result_message,
        execution_type,
        payload,
        worker_id,
        retry_count,
        last_error,
        failed_at,
        scheduled_for,
        available_at,
        started_at,
        completed_at,
        created_at,
        workflow_id,
        parent_job_id,
        next_execution_type,
        chain_position
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
        AND object_id = $2
      ORDER BY created_at ASC
    `, [
      auth.user.tenant_id,
      object_id
    ]);

    const executions = result.rows;

    const latestExecution =
      executions.length > 0
        ? executions[executions.length - 1]
        : null;

    send(res, 200, {
      object_id,
      tenant_id: auth.user.tenant_id,
      job_count: executions.length,
      latest_status: latestExecution ? latestExecution.status : null,
      latest_execution_type: latestExecution ? latestExecution.execution_type : null,
      latest_worker_id: latestExecution ? latestExecution.worker_id : null,
      executions
    });
    return true;
  }

  // GET GOVERNANCE PATH BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/governance/path/")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor",
      "governance"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const object_id = decodeURIComponent(
      path.replace("/runtime/governance/path/", "")
    );

    if (!object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const decisionsResult = await db.query(`
      SELECT
        decision_id,
        object_id,
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
      FROM runtime_governance_decisions
      WHERE tenant_id = $1
        AND object_id = $2
      ORDER BY created_at ASC
    `, [
      auth.user.tenant_id,
      object_id
    ]);

    const decisionIds = decisionsResult.rows.map(d => d.decision_id);

    let approvals = [];

    if (decisionIds.length > 0) {
      const approvalsResult = await db.query(`
        SELECT
          approval_id,
          decision_id,
          object_id,
          approval_status,
          reason,
          requested_by,
          decided_by,
          created_at
        FROM runtime_governance_approvals
        WHERE tenant_id = $1
          AND decision_id = ANY($2)
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        decisionIds
      ]);

      approvals = approvalsResult.rows;
    }

    const latestDecision =
      decisionsResult.rows.length > 0
        ? decisionsResult.rows[decisionsResult.rows.length - 1]
        : null;

    const latestApproval =
      approvals.length > 0
        ? approvals[approvals.length - 1]
        : null;

    send(res, 200, {
      object_id,
      tenant_id: auth.user.tenant_id,
      decision_count: decisionsResult.rows.length,
      approval_count: approvals.length,
      latest_status: latestDecision ? latestDecision.governance_status : null,
      latest_approval_status: latestApproval ? latestApproval.approval_status : null,
      decisions: decisionsResult.rows,
      approvals
    });
    return true;
  }

  // GET AUDIT PATH BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/audit/path/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const object_id = decodeURIComponent(
      path.replace("/runtime/audit/path/", "")
    );

    if (!object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const result = await db.query(`
      SELECT
        event_id,
        event_type,
        object_id,
        message,
        audit_hash,
        previous_hash,
        created_at
      FROM runtime_events
      WHERE tenant_id = $1
        AND object_id = $2
      ORDER BY created_at ASC
    `, [
      auth.user.tenant_id,
      object_id
    ]);

    send(res, 200, {
      object_id,
      tenant_id: auth.user.tenant_id,
      event_count: result.rows.length,
      timeline: result.rows
    });
    return true;
  }

  return false;
}

module.exports = {
  handlePathRoute
};
