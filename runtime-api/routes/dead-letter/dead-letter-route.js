async function handleDeadLetterRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "GET" && path === "/runtime/dead-letter") {
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
        job_id,
        object_id,
        execution_type,
        status,
        retry_count,
        last_error,
        failed_at,
        created_at
      FROM runtime_execution_jobs
      WHERE tenant_id = $1
        AND status = 'failed_permanent'
      ORDER BY failed_at DESC NULLS LAST, created_at DESC
    `, [tenant_id]);

    return send(res, 200, {
      dead_letter: {
        count: result.rows.length,
        jobs: result.rows
      }
    });
  }

  if (req.method === "POST" && path === "/runtime/dead-letter/requeue") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;
    const body = await readBody(req);
    const job_id = body.job_id;

    if (!job_id) {
      return send(res, 400, {
        error: "missing_job_id"
      });
    }

    const result = await db.query(`
      UPDATE runtime_execution_jobs
      SET
        status = 'pending',
        retry_count = 0,
        last_error = NULL,
        failed_at = NULL
      WHERE job_id = $1
        AND tenant_id = $2
        AND status = 'failed_permanent'
      RETURNING
        job_id,
        object_id,
        execution_type,
        status,
        retry_count
    `, [
      job_id,
      tenant_id
    ]);

    if (result.rows.length === 0) {
      return send(res, 404, {
        error: "dead_letter_job_not_found",
        job_id
      });
    }

    const job = result.rows[0];

    await writeEvent({
      event_type: "runtime.dead_letter.requeued",
      object_id: job.object_id,
      message: `Dead letter job requeued: ${job.job_id}`,
      tenant_id
    });

    return send(res, 200, {
      requeued: true,
      job
    });
  }

  return false;
}

module.exports = {
  handleDeadLetterRoute
};
