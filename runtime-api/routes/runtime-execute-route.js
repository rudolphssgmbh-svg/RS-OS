const {
  buildEnforcementEvidence,
  enforceGovernanceDecisionGate
} = require("../modules/governance/governance-enforcement-service");

async function handleRuntimeExecuteRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/execute") {

    const executeAuth = requireRole(req, [
      "runtime_admin"
    ]);

    if (!executeAuth.allowed) {
      return send(res, executeAuth.code, executeAuth.response);
    }

    const authUser = executeAuth.user;
    const tenant_id = authUser.tenant_id;

    const body = await readBody(req);

    const job_id = `job-${Date.now()}`;
    const object_id = body.object_id;
    const execution_type = body.execution_type || "runtime.execution";
    const payload = body.payload || {};
    const next_execution_type = body.next_execution_type || null;
    const workflow_id = body.workflow_id || job_id;
    const chain_position = Number(body.chain_position || 0);

    const dag = payload.dag || {};
    const edges = Array.isArray(dag.edges) ? dag.edges : [];

    const graph = {};

    for (const edge of edges) {
      const from = edge.from;
      const targets = Array.isArray(edge.to) ? edge.to : [edge.to];

      if (!from) {
        continue;
      }

      graph[from] = graph[from] || [];

      for (const target of targets) {
        if (target) {
          graph[from].push(target);
        }
      }
    }

    const visiting = new Set();
    const visited = new Set();

    function hasCycle(node) {
      if (visiting.has(node)) {
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visiting.add(node);

      for (const next of graph[node] || []) {
        if (hasCycle(next)) {
          return true;
        }
      }

      visiting.delete(node);
      visited.add(node);

      return false;
    }

    for (const node of Object.keys(graph)) {
      if (hasCycle(node)) {
        return send(res, 400, {
          error: "dag_cycle_detected",
          node
        });
      }
    }

    if (!object_id) {
      return send(res, 400, {
        error: "missing_object_id"
      });
    }

    const governanceGate = await enforceGovernanceDecisionGate({
      db,
      tenant_id,
      object_id
    });

    const enforcementEvidence = buildEnforcementEvidence({
      route: "/runtime/execute",
      action: execution_type,
      job_id,
      enforcementResult: governanceGate
    });

    if (!governanceGate.allowed) {
      await writeEvent({
        event_type:
          governanceGate.status === "blocked"
            ? "runtime.governance.gate.blocked"
            : "runtime.governance.gate.review_required",
        object_id,
        message: `Execution governance gate: ${governanceGate.reason}`,
        tenant_id,
        event_payload: enforcementEvidence
      });

      return send(res, 403, governanceGate);
    }

    await writeEvent({
      event_type: "runtime.governance.gate.allowed",
      object_id,
      message: `Execution governance gate: ${governanceGate.reason}`,
      tenant_id,
      event_payload: enforcementEvidence
    });

    await db.query(`
      INSERT INTO runtime_execution_jobs
      (
        job_id,
        object_id,
        tenant_id,
        execution_type,
        status,
        payload,
        next_execution_type,
        workflow_id,
        chain_position
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      job_id,
      object_id,
      tenant_id,
      execution_type,
      "pending",
      JSON.stringify(payload),
      next_execution_type,
      workflow_id,
      chain_position
    ]);

    await writeEvent({
      event_type: "runtime.execution.started",
      object_id,
      message: `Execution started: ${execution_type}`,
      tenant_id,
      event_payload: enforcementEvidence
    });

    return send(res, 200, {
      execution_started: true,
      job_id,
      object_id,
      execution_type,
      tenant_id
    });
  }

  return false;
}

module.exports = {
  handleRuntimeExecuteRoute
};
