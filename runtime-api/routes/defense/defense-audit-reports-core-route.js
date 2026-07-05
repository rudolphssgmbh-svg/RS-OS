async function handleDefenseAuditReportsCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/audit-reports/generate") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const body = await readBody(req);
    const tenant_id = body.tenant_id || auth.user.tenant_id;
    const actor_id = auth.user.username || auth.user.operator_id || "system";

    const period_start = body.period_start || new Date().toISOString().slice(0, 10);
    const period_end = body.period_end || period_start;
    const report_type = body.report_type || "defense_recovery_audit";

    const metricsResult = await db.query(`
      SELECT *
      FROM runtime_defense_metrics
      WHERE tenant_id = $1
        AND metric_date BETWEEN $2::date AND $3::date
      ORDER BY metric_date ASC
    `, [
      tenant_id,
      period_start,
      period_end
    ]);

    const stateResult = await db.query(`
      SELECT *
      FROM runtime_defense_state
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [
      tenant_id
    ]);

    const quarantineResult = await db.query(`
      SELECT *
      FROM runtime_quarantine_queue
      WHERE tenant_id = $1
        AND created_at::date BETWEEN $2::date AND $3::date
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id,
      period_start,
      period_end
    ]);

    const recoveryResult = await db.query(`
      SELECT *
      FROM runtime_recovery_requests
      WHERE tenant_id = $1
        AND created_at::date BETWEEN $2::date AND $3::date
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id,
      period_start,
      period_end
    ]);

    const verificationResult = await db.query(`
      SELECT *
      FROM runtime_recovery_verifications
      WHERE tenant_id = $1
        AND created_at::date BETWEEN $2::date AND $3::date
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id,
      period_start,
      period_end
    ]);

    const report_data = {
      report_context: {
        report_type,
        tenant_id,
        period_start,
        period_end,
        generated_by: actor_id
      },
      executive_summary: {
        purpose: "Defense and recovery audit evidence snapshot",
        closure_ready: verificationResult.rows.some(v => v.closure_status === "closed"),
        recovery_completed: recoveryResult.rows.some(r => r.execution_status === "completed"),
        open_quarantine_count: quarantineResult.rows.filter(q => q.status === "open").length
      },
      metrics: metricsResult.rows,
      defense_state: stateResult.rows[0] || null,
      quarantines: quarantineResult.rows,
      recovery_requests: recoveryResult.rows,
      recovery_verifications: verificationResult.rows
    };

    const result = await db.query(`
      INSERT INTO runtime_audit_reports (
        tenant_id,
        report_type,
        report_period_start,
        report_period_end,
        generated_by,
        report_data
      )
      VALUES ($1,$2,$3::date,$4::date,$5,$6)
      RETURNING *
    `, [
      tenant_id,
      report_type,
      period_start,
      period_end,
      actor_id,
      JSON.stringify(report_data)
    ]);

    const report = result.rows[0];

    await writeEvent({
      event_type: "runtime.audit_report.generated",
      object_id: report.report_id,
      message: `Audit report generated: ${report.report_id}`,
      tenant_id
    });

    return send(res, 201, {
      audit_report: report
    });
  }

  if (req.method === "GET" && path === "/runtime/audit-reports") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      SELECT
        report_id,
        tenant_id,
        report_type,
        report_period_start,
        report_period_end,
        report_status,
        generated_by,
        generated_at,
        created_at
      FROM runtime_audit_reports
      WHERE tenant_id = $1
      ORDER BY generated_at DESC
      LIMIT 100
    `, [
      tenant_id
    ]);

    return send(res, 200, {
      audit_reports: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseAuditReportsCoreRoute
};
