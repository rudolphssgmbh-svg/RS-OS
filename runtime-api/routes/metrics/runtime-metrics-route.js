async function handleRuntimeMetricsRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path === "/runtime/metrics") {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      SELECT
        status,
        COUNT(*)::int AS count
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
      GROUP BY status
      ORDER BY status ASC
    `, [tenant_id]);

    const failedResult = await db.query(`
      SELECT
        COUNT(*)::int AS failed_permanent_count
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
        AND status = 'failed_permanent'
    `, [tenant_id]);

    const recentResult = await db.query(`
      SELECT
        job_id,
        object_id,
        execution_type,
        status,
        retry_count,
        last_error,
        created_at,
        started_at,
        completed_at,
        failed_at
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [tenant_id]);

    return send(res, 200, {
      metrics: {
        jobs_by_status: result.rows,
        failed_permanent_count:
          failedResult.rows[0].failed_permanent_count,
        recent_jobs: recentResult.rows
      }
    });
  }

  return false;
}

module.exports = {
  handleRuntimeMetricsRoute
};
