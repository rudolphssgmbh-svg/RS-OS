async function handleWorkerRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  writeEvent,
  generateRecommendationsForObject
}) {

  async function updateWorkflowState(
    workflowId,
    tenant_id,
    object_id
  ) {
    const statsResult = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE status = 'completed'
        )::int AS completed,
        COUNT(*) FILTER (
          WHERE status = 'failed_permanent'
        )::int AS failed,
        COUNT(*) FILTER (
          WHERE action = 'compensation.run'
            AND status = 'completed'
        )::int AS compensated,
        COUNT(*) FILTER (
          WHERE status IN (
            'pending',
            'running',
            'failed'
          )
        )::int AS active
      FROM runtime_execution_jobs
      WHERE workflow_id = $1
    `, [workflowId]);
  
    const stats = statsResult.rows[0];
  
    let workflowStatus = 'running';
  
    if (
      Number(stats.failed) > 0 &&
      Number(stats.compensated) > 0
    ) {
      workflowStatus = 'compensated';
    } else if (
      Number(stats.failed) > 0 &&
      Number(stats.completed) > 0
    ) {
      workflowStatus = 'partial_failed';
    } else if (
      Number(stats.failed) > 0
    ) {
      workflowStatus = 'failed';
    } else if (
      Number(stats.active) === 0
    ) {
      workflowStatus = 'completed';
    }
  
    await db.query(`
      INSERT INTO runtime_workflow_instances (
        workflow_id,
        tenant_id,
        object_id,
        status,
        job_count,
        completed_count,
        failed_count,
        compensated_count,
        updated_at,
        completed_at
      )
      VALUES (
        $1,$2,$3,$4,
        $5,$6,$7,$8,
        NOW(),
        CASE
          WHEN $4 IN (
            'completed',
            'failed',
            'compensated',
            'partial_failed'
          )
          THEN NOW()
          ELSE NULL
        END
      )
      ON CONFLICT (workflow_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        job_count = EXCLUDED.job_count,
        completed_count = EXCLUDED.completed_count,
        failed_count = EXCLUDED.failed_count,
        compensated_count = EXCLUDED.compensated_count,
        updated_at = NOW(),
        completed_at = EXCLUDED.completed_at
    `, [
      workflowId,
      tenant_id,
      object_id,
      workflowStatus,
      Number(stats.total),
      Number(stats.completed),
      Number(stats.failed),
      Number(stats.compensated)
    ]);
  
    return workflowStatus;
  }

    // RUNTIME WORKER V4 - LEASE LOCKING

    if (req.method === "POST" && path === "/runtime/worker/run") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = auth.user.tenant_id;
      const worker_id = `worker-${Date.now()}`;

      await db.query("BEGIN");

      const nextJobResult = await db.query(`
        SELECT *
        FROM runtime_execution_jobs
        WHERE tenant_id = $1
          AND (
            status = 'pending'
            OR (
              status = 'failed'
              AND COALESCE(retry_count, 0) < 3
            )
            OR (
              status = 'running'
              AND lock_expires_at IS NOT NULL
              AND lock_expires_at < NOW()
            )
          )
          AND COALESCE(scheduled_for, available_at, NOW()) <= NOW()
        ORDER BY
          priority ASC,
          COALESCE(scheduled_for, created_at) ASC,
          created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `, [tenant_id]);

      if (nextJobResult.rows.length === 0) {

        await db.query("COMMIT");

        return send(res, 200, {
          worker: "idle",
          pending_jobs: 0
        });
      }

      const job = nextJobResult.rows[0];

      await db.query(`
        UPDATE runtime_execution_jobs
        SET
          status = 'running',
          started_at = COALESCE(started_at, NOW()),
          locked_at = NOW(),
          lock_expires_at = NOW() + interval '60 seconds',
          worker_id = $2,
          last_error = NULL
        WHERE job_id = $1
      `, [
        job.job_id,
        worker_id
      ]);

      await db.query("COMMIT");

      try {

        if (job.execution_type === "diagnostic.fail") {
          throw new Error("Simulated diagnostic failure");
        }

        if (
          job.execution_type ===
          "orchestration.LEARNING_RESPONSE.refresh_recommendations"
        ) {
          await writeEvent({
            event_type: "runtime.recommendations.refresh.started",
            object_id: job.object_id,
            message: "Recommendation refresh started by orchestration worker",
            tenant_id
          });

          const refreshResult = await generateRecommendationsForObject({
            tenant_id,
            object_id: job.object_id,
            requested_by: "orchestration-worker"
          });

          const refreshPayload = job.payload || {};
          const orchestrationId = refreshPayload.orchestration_id || null;

          let completedOrchestration = null;

          if (orchestrationId) {
            const orchestrationCompleteResult = await db.query(`
              UPDATE runtime_orchestrations
              SET
                status = 'completed',
                completed_by = $1,
                completed_at = now()
              WHERE tenant_id = $2
                AND orchestration_id = $3
                AND status = 'executed'
              RETURNING *
            `, [
              worker_id,
              tenant_id,
              orchestrationId
            ]);

            if (orchestrationCompleteResult.rows.length > 0) {
              completedOrchestration = orchestrationCompleteResult.rows[0];

              await writeEvent({
                event_type: "runtime.orchestration.completed",
                object_id: completedOrchestration.source_object_id,
                message:
                  `Orchestration automatically completed by worker: ${completedOrchestration.orchestration_type}`,
                tenant_id
              });
            }
          }

          await writeEvent({
            event_type: "runtime.recommendations.refresh.completed",
            object_id: job.object_id,
            message:
              `Recommendation refresh completed: generated=${refreshResult.generated_count}, skipped=${refreshResult.skipped_duplicate_count}`,
            tenant_id
          });
        }

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = 'completed',
            completed_at = NOW(),
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $2
        `, [
          job.job_id,
          worker_id
        ]);

        // WORKFLOW DAG V1
        const dagPayload = job.payload || {};
        const dag = dagPayload.dag || {};
        const edges = Array.isArray(dag.edges) ? dag.edges : [];

        let nextTypes = [];

        if (job.next_execution_type) {
          nextTypes.push(job.next_execution_type);
        }

        for (const edge of edges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "success"
          ) {

            if (Array.isArray(edge.to)) {
              nextTypes.push(...edge.to);
            } else if (edge.to) {
              nextTypes.push(edge.to);
            }
          }
        }

        nextTypes = [...new Set(nextTypes)];

        for (const nextType of nextTypes) {

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          // DAG V2 dependency resolution

          const dependencyRows = await db.query(`
            SELECT from_execution_type
            FROM runtime_workflow_dependencies
            WHERE workflow_id = $1
              AND to_execution_type = $2
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          const requiredParents = dependencyRows.rows.map(
            r => r.from_execution_type
          );

          const completedRows = await db.query(`
            SELECT DISTINCT execution_type
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND status = 'completed'
          `, [
            job.workflow_id || job.job_id
          ]);

          const completedTypes = completedRows.rows.map(
            r => r.execution_type
          );

          const allSatisfied = requiredParents.every(
            p => completedTypes.includes(p)
          );

          if (!allSatisfied) {

            await writeEvent({
              event_type: "runtime.workflow.waiting_dependencies",
              object_id: job.object_id,
              message: `Waiting dependencies for ${nextType}`,
              tenant_id
            });

            continue;
          }

          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND action = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-dag-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            dagPayload,
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.dag_job_created",
            object_id: job.object_id,
            message: `DAG job created: ${nextJobId} -> ${nextType}`,
            tenant_id
          });
        }

        await writeEvent({
          event_type: "runtime.execution.completed",
          object_id: job.object_id,
          message: `Execution completed by ${worker_id}`,
          tenant_id
        });

        // WORKFLOW TERMINAL STATE ENGINE V1

        const workflowId =
          job.workflow_id || job.job_id;

        const statsResult = await db.query(`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE status = 'completed'
            )::int AS completed,
            COUNT(*) FILTER (
              WHERE status = 'failed_permanent'
            )::int AS failed,
            COUNT(*) FILTER (
              WHERE action = 'compensation.run'
                AND status = 'completed'
            )::int AS compensated,
            COUNT(*) FILTER (
              WHERE status IN (
                'pending',
                'running',
                'failed'
              )
            )::int AS active
          FROM runtime_execution_jobs
          WHERE workflow_id = $1
        `, [workflowId]);

        const stats = statsResult.rows[0];

        let workflowStatus = 'running';

        if (
          Number(stats.failed) > 0 &&
          Number(stats.compensated) > 0
        ) {
          workflowStatus = 'compensated';

        } else if (
          Number(stats.failed) > 0 &&
          Number(stats.completed) > 0
        ) {
          workflowStatus = 'partial_failed';

        } else if (
          Number(stats.failed) > 0
        ) {
          workflowStatus = 'failed';

        } else if (
          Number(stats.active) === 0
        ) {
          workflowStatus = 'completed';
        }

        await db.query(`
          INSERT INTO runtime_workflow_instances (
            workflow_id,
            tenant_id,
            object_id,
            status,
            job_count,
            completed_count,
            failed_count,
            compensated_count,
            updated_at,
            completed_at
          )
          VALUES (
            $1,$2,$3,$4,
            $5,$6,$7,$8,
            NOW(),
            CASE
              WHEN $4 IN (
                'completed',
                'failed',
                'compensated',
                'partial_failed'
              )
              THEN NOW()
              ELSE NULL
            END
          )
          ON CONFLICT (workflow_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            job_count = EXCLUDED.job_count,
            completed_count = EXCLUDED.completed_count,
            failed_count = EXCLUDED.failed_count,
            compensated_count =
              EXCLUDED.compensated_count,
            updated_at = NOW(),
            completed_at = EXCLUDED.completed_at
        `, [
          workflowId,
          tenant_id,
          job.object_id,
          workflowStatus,
          Number(stats.total),
          Number(stats.completed),
          Number(stats.failed),
          Number(stats.compensated)
        ]);

        await writeEvent({
          event_type: "runtime.workflow.state_updated",
          object_id: job.object_id,
          message:
            `Workflow state updated: ${workflowStatus}`,
          tenant_id
        });

        return send(res, 200, {
          worker: "completed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          workflow_status: workflowStatus
        });

      } catch (workerErr) {

        const retryCount = Number(job.retry_count || 0) + 1;
        const finalStatus = retryCount >= 3
          ? "failed_permanent"
          : "failed";

        await db.query(`
          UPDATE runtime_execution_jobs
          SET
            status = $2,
            retry_count = $3,
            failed_at = NOW(),
            last_error = $4,
            locked_at = NULL,
            lock_expires_at = NULL
          WHERE job_id = $1
            AND worker_id = $5
        `, [
          job.job_id,
          finalStatus,
          retryCount,
          workerErr.message,
          worker_id
        ]);

        await writeEvent({
          event_type: "runtime.execution.failed",
          object_id: job.object_id,
          message: `Execution failed by ${worker_id}: ${workerErr.message}`,
          tenant_id
        });

        // DAG FAILURE ROUTING V1
        const failureDagPayload = job.payload || {};
        const failureDag = failureDagPayload.dag || {};
        const failureEdges = Array.isArray(failureDag.edges) ? failureDag.edges : [];

        let failureTargets = [];

        for (const edge of failureEdges) {
          const condition = edge.condition || "success";

          if (
            edge.from === job.execution_type &&
            condition === "failed"
          ) {
            if (Array.isArray(edge.to)) {
              failureTargets.push(...edge.to);
            } else if (edge.to) {
              failureTargets.push(edge.to);
            }
          }
        }

        failureTargets = [...new Set(failureTargets)];

        for (const nextType of failureTargets) {
          const existingJob = await db.query(`
            SELECT job_id
            FROM runtime_execution_jobs
            WHERE workflow_id = $1
              AND action = $2
            LIMIT 1
          `, [
            job.workflow_id || job.job_id,
            nextType
          ]);

          if (existingJob.rows.length > 0) {
            continue;
          }

          const nextJobId = `job-${Date.now()}-${Math.random()
            .toString(16)
            .slice(2, 8)}`;

          await db.query(`
            INSERT INTO runtime_execution_jobs (
              job_id,
              tenant_id,
              object_id,
              execution_type,
              status,
              payload,
              workflow_id,
              parent_job_id,
              chain_position,
              requested_by,
              created_at
            )
            VALUES (
              $1,$2,$3,$4,
              'pending',
              $5,
              $6,
              $7,
              $8,
              'workflow-engine',
              NOW()
            )
          `, [
            nextJobId,
            tenant_id,
            job.object_id,
            nextType,
            JSON.stringify(job.payload || {}),
            job.workflow_id || job.job_id,
            job.job_id,
            Number(job.chain_position || 0) + 1
          ]);

          await writeEvent({
            event_type: "runtime.workflow.failure_routing",
            object_id: job.object_id,
            message: `Failure route created: ${nextType}`,
            tenant_id
          });
        }

        await updateWorkflowState(
          job.workflow_id || job.job_id,
          tenant_id,
          job.object_id
        );

        return send(res, 500, {
          worker: "failed",
          worker_id,
          job_id: job.job_id,
          object_id: job.object_id,
          execution_type: job.execution_type,
          retry_count: retryCount,
          final_status: finalStatus,
          error: workerErr.message
        });
      }
    }

  return false;
}

module.exports = {
  handleWorkerRoute
};
