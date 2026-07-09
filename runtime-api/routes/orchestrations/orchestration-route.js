const { enforceGovernanceDecisionGate } = require("../../modules/governance/governance-enforcement-service");

async function handleOrchestrationRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send
}) {
    // CREATE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path === "/runtime/orchestrations") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = auth.user.tenant_id;

      const source_event_type = body.source_event_type;
      const source_object_id = body.source_object_id || null;
      const orchestration_type = body.orchestration_type;
      const payload = body.payload || {};

      if (!source_event_type || !orchestration_type) {
        return send(res, 400, {
          error: "missing_required_orchestration_fields"
        });
      }

      const orchestration_id =
        "orch-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      await db.query(`
        INSERT INTO runtime_orchestrations (
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
      `, [
        orchestration_id,
        tenant_id,
        source_event_type,
        source_object_id,
        orchestration_type,
        JSON.stringify(payload),
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_object_id,
        event_type: "runtime.orchestration.created",
        message: `Orchestration created: ${orchestration_type}`
      });

      return send(res, 200, {
        created: true,
        orchestration: {
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status: "pending",
          payload,
          created_by
        }
      });
    }



    // APPROVE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/approve/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/approve/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "pending") {
        return send(res, 409, {
          error: "orchestration_not_pending",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const approved_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'approved',
          approved_by = $1,
          approved_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        approved_by,
        tenant_id,
        orchestration_id
      ]);

      const approvedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: approvedOrchestration.source_object_id,
        event_type: "runtime.orchestration.approved",
        message: `Orchestration approved: ${approvedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        approved: true,
        orchestration: approvedOrchestration
      });
    }


    // EXECUTE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/execute/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/execute/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "approved") {
        return send(res, 409, {
          error: "orchestration_not_approved",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const governanceGate = await enforceGovernanceDecisionGate({
        db,
        tenant_id,
        object_id: orchestration.source_object_id
      });

      if (!governanceGate.allowed) {
        await writeEvent({
          tenant_id,
          object_id: orchestration.source_object_id,
          event_type:
            governanceGate.status === "blocked"
              ? "runtime.governance.gate.blocked"
              : "runtime.governance.gate.review_required",
          message: `Orchestration execution governance gate: ${governanceGate.reason}`
        });

        return send(res, 403, governanceGate);
      }

      await writeEvent({
        tenant_id,
        object_id: orchestration.source_object_id,
        event_type: "runtime.governance.gate.allowed",
        message: `Orchestration execution governance gate: ${governanceGate.reason}`
      });

      const executed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'executed',
          executed_by = $1,
          executed_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        executed_by,
        tenant_id,
        orchestration_id
      ]);

      const executedOrchestration = updateResult.rows[0];

      let recommendationRefreshJob = null;

      if (executedOrchestration.orchestration_type === "LEARNING_RESPONSE") {
        const refresh_job_id =
          "job-" + Date.now();

        await db.query(`
          INSERT INTO runtime_execution_jobs (
            job_id,
            tenant_id,
            object_id,
            status,
            requested_by,
            execution_type,
            payload,
            available_at,
            priority,
            workflow_id,
            chain_position
          )
          VALUES ($1,$2,$3,'pending',$4,$5,$6,now(),$7,$8,0)
        `, [
          refresh_job_id,
          tenant_id,
          executedOrchestration.source_object_id,
          executed_by,
          "orchestration.LEARNING_RESPONSE.refresh_recommendations",
          JSON.stringify({
            orchestration_id: executedOrchestration.orchestration_id,
            orchestration_type: executedOrchestration.orchestration_type,
            source_event_type: executedOrchestration.source_event_type,
            source_object_id: executedOrchestration.source_object_id,
            payload: executedOrchestration.payload
          }),
          100,
          refresh_job_id
        ]);

        recommendationRefreshJob = {
          job_id: refresh_job_id,
          object_id: executedOrchestration.source_object_id,
          execution_type: "orchestration.LEARNING_RESPONSE.refresh_recommendations",
          status: "pending"
        };

        await writeEvent({
          tenant_id,
          object_id: executedOrchestration.source_object_id,
          event_type: "runtime.orchestration.recommendation_refresh_requested",
          message: "Recommendation refresh requested by orchestration"
        });
      }

      await writeEvent({
        tenant_id,
        object_id: executedOrchestration.source_object_id,
        event_type: "runtime.orchestration.executed",
        message: `Orchestration executed: ${executedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        executed: true,
        orchestration: executedOrchestration,
        recommendation_refresh_requested: recommendationRefreshJob !== null,
        recommendation_refresh_job: recommendationRefreshJob
      });
    }


    // COMPLETE RUNTIME ORCHESTRATION

    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/complete/")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path.replace("/runtime/orchestrations/complete/", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const existingResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (existingResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = existingResult.rows[0];

      if (orchestration.status !== "executed") {
        return send(res, 409, {
          error: "orchestration_not_executed",
          orchestration_id,
          current_status: orchestration.status
        });
      }

      const completed_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const updateResult = await db.query(`
        UPDATE runtime_orchestrations
        SET
          status = 'completed',
          completed_by = $1,
          completed_at = now()
        WHERE tenant_id = $2
          AND orchestration_id = $3
        RETURNING *
      `, [
        completed_by,
        tenant_id,
        orchestration_id
      ]);

      const completedOrchestration = updateResult.rows[0];

      await writeEvent({
        tenant_id,
        object_id: completedOrchestration.source_object_id,
        event_type: "runtime.orchestration.completed",
        message: `Orchestration completed: ${completedOrchestration.orchestration_type}`
      });

      return send(res, 200, {
        completed: true,
        orchestration: completedOrchestration
      });
    }


    // GET ORCHESTRATION RULES

    if (req.method === "GET" && path === "/runtime/orchestration-rules") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          rule_id,
          tenant_id,
          rule_name,
          source_event_type,
          orchestration_type,
          enabled,
          payload_template,
          created_by,
          created_at
        FROM runtime_orchestration_rules
        WHERE tenant_id = $1
        ORDER BY rule_name ASC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        rule_count: result.rows.length,
        enabled_count: result.rows.filter(r => r.enabled).length,
        disabled_count: result.rows.filter(r => !r.enabled).length,
        rules: result.rows
      });
    }


    // GET ORCHESTRATION TRACE

    if (req.method === "GET" && path.startsWith("/runtime/orchestrations/") && path.endsWith("/trace")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const orchestration_id = decodeURIComponent(
        path
          .replace("/runtime/orchestrations/", "")
          .replace("/trace", "")
      );

      if (!orchestration_id) {
        return send(res, 400, {
          error: "missing_orchestration_id"
        });
      }

      const orchestrationResult = await db.query(`
        SELECT *
        FROM runtime_orchestrations
        WHERE tenant_id = $1
          AND orchestration_id = $2
        LIMIT 1
      `, [
        tenant_id,
        orchestration_id
      ]);

      if (orchestrationResult.rows.length === 0) {
        return send(res, 404, {
          error: "orchestration_not_found",
          orchestration_id
        });
      }

      const orchestration = orchestrationResult.rows[0];

      const payload = orchestration.payload || {};
      const rule_id = payload.rule_id || null;

      let rule = null;

      if (rule_id) {
        const ruleResult = await db.query(`
          SELECT *
          FROM runtime_orchestration_rules
          WHERE tenant_id = $1
            AND rule_id = $2
          LIMIT 1
        `, [
          tenant_id,
          rule_id
        ]);

        rule = ruleResult.rows[0] || null;
      }

      const jobsResult = await db.query(`
        SELECT
          job_id,
          object_id,
          execution_type,
          status,
          requested_by,
          worker_id,
          payload,
          created_at,
          started_at,
          completed_at,
          last_error
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND (
            object_id = $2
            OR payload::text LIKE $3
          )
        ORDER BY created_at DESC
      `, [
        tenant_id,
        orchestration.source_object_id,
        `%${orchestration_id}%`
      ]);

      const recommendationsResult = await db.query(`
        SELECT
          recommendation_id,
          object_id,
          recommendation_type,
          priority,
          status,
          reason,
          evidence,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_job_id,
          executed_at
        FROM runtime_recommendations
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY created_at DESC
      `, [
        tenant_id,
        orchestration.source_object_id
      ]);

      const auditResult = await db.query(`
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
          AND (
            event_type LIKE 'runtime.orchestration.%'
            OR event_type LIKE 'runtime.recommendations.%'
            OR event_type LIKE 'runtime.training.%'
            OR event_type LIKE 'runtime.learning.%'
          )
        ORDER BY created_at ASC
      `, [
        tenant_id,
        orchestration.source_object_id
      ]);

      return send(res, 200, {
        tenant_id,
        orchestration_id,
        source_object_id: orchestration.source_object_id,
        orchestration,
        rule,
        jobs: {
          job_count: jobsResult.rows.length,
          items: jobsResult.rows
        },
        recommendations: {
          recommendation_count: recommendationsResult.rows.length,
          items: recommendationsResult.rows
        },
        audit: {
          event_count: auditResult.rows.length,
          events: auditResult.rows
        }
      });
    }

    // GET RUNTIME ORCHESTRATIONS

    if (req.method === "GET" && path === "/runtime/orchestrations") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;

      const result = await db.query(`
        SELECT
          orchestration_id,
          tenant_id,
          source_event_type,
          source_object_id,
          orchestration_type,
          status,
          payload,
          created_by,
          created_at,
          approved_by,
          approved_at,
          executed_by,
          executed_at,
          completed_by,
          completed_at
        FROM runtime_orchestrations
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        orchestration_count: result.rows.length,
        pending_count: result.rows.filter(row => row.status === "pending").length,
        approved_count: result.rows.filter(row => row.status === "approved").length,
        executed_count: result.rows.filter(row => row.status === "executed").length,
        completed_count: result.rows.filter(row => row.status === "completed").length,
        cancelled_count: result.rows.filter(row => row.status === "cancelled").length,
        orchestrations: result.rows
      });
    }


  return false;
}

module.exports = {
  handleOrchestrationRoute
};
