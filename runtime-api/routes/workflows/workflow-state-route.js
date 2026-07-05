async function handleWorkflowStateRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path.startsWith("/runtime/workflows/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;
    const workflow_id = path.split("/").pop();

    const jobsResult = await db.query(`
      SELECT
        job_id,
        object_id,
        execution_type,
        parent_job_id,
        workflow_id,
        chain_position,
        status,
        retry_count,
        last_error,
        created_at,
        started_at,
        completed_at,
        failed_at
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
        AND workflow_id = $2
      ORDER BY chain_position ASC, created_at ASC
    `, [
      tenant_id,
      workflow_id
    ]);

    const jobs = jobsResult.rows;

    const counts = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    let workflow_status = "unknown";

    if (jobs.length === 0) {
      workflow_status = "not_found";
    } else if ((counts.failed_permanent || 0) > 0) {
      workflow_status = "failed";
    } else if ((counts.running || 0) > 0) {
      workflow_status = "running";
    } else if ((counts.pending || 0) > 0 || (counts.failed || 0) > 0) {
      workflow_status = "blocked_or_pending";
    } else if (jobs.every(j => j.status === "completed")) {
      workflow_status = "completed";
    } else {
      workflow_status = "mixed";
    }

    return send(res, 200, {
      workflow: {
        workflow_id,
        status: workflow_status,
        counts,
        job_count: jobs.length,
        jobs
      }
    });
  }

  return false;
}

module.exports = {
  handleWorkflowStateRoute
};
