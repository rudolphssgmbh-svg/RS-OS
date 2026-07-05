async function handleUnifiedTraceRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  getTraceObject,
  getTraceAudit,
  getTraceGovernance,
  getTraceExecution,
  getTraceRelations,
  getTraceRecommendations
}) {
  if (!(req.method === "GET" && path.startsWith("/runtime/trace/"))) {
    return false;
  }

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
    path.replace("/runtime/trace/", "")
  );

  if (!object_id) {
    send(res, 400, {
      error: "missing_object_id"
    });
    return true;
  }

  const objectResult = await getTraceObject({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const auditResult = await getTraceAudit({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const governanceResult = await getTraceGovernance({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const executionResult = await getTraceExecution({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const relationResult = await getTraceRelations({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const recommendationResult = await getTraceRecommendations({
    db,
    tenant_id: auth.user.tenant_id,
    object_id,
    mode: "compact"
  });

  const latestRecommendation =
    recommendationResult.rows.length > 0
      ? recommendationResult.rows[0]
      : null;

  const latestGovernance =
    governanceResult.rows.length > 0
      ? governanceResult.rows[0]
      : null;

  const latestExecution =
    executionResult.rows.length > 0
      ? executionResult.rows[0]
      : null;

  send(res, 200, {
    object_id,
    tenant_id: auth.user.tenant_id,
    exists_in_runtime_objects: objectResult.rows.length > 0,
    runtime_object: objectResult.rows[0] || null,
    audit: {
      event_count: auditResult.rows[0].event_count
    },
    governance: {
      decision_count: governanceResult.rows.length,
      latest_status: latestGovernance ? latestGovernance.governance_status : null,
      latest_created_at: latestGovernance ? latestGovernance.created_at : null
    },
    execution: {
      job_count: executionResult.rows.length,
      latest_status: latestExecution ? latestExecution.status : null,
      latest_execution_type: latestExecution ? latestExecution.execution_type : null,
      latest_worker_id: latestExecution ? latestExecution.worker_id : null
    },
    graph: {
      relation_count: relationResult.rows.length,
      relations: relationResult.rows
    },
    recommendations: {
      recommendation_count: recommendationResult.rows.length,
      open_count: recommendationResult.rows.filter(r => r.status === "open").length,
      approved_count: recommendationResult.rows.filter(r => r.status === "approved").length,
      executed_count: recommendationResult.rows.filter(r => r.status === "executed").length,
      rejected_count: recommendationResult.rows.filter(r => r.status === "rejected").length,
      latest_recommendation_type: latestRecommendation ? latestRecommendation.recommendation_type : null,
      latest_status: latestRecommendation ? latestRecommendation.status : null,
      latest_recommendation_id: latestRecommendation ? latestRecommendation.recommendation_id : null,
      recommendations: recommendationResult.rows
    }
  });

  return true;
}

module.exports = {
  handleUnifiedTraceRoute
};
