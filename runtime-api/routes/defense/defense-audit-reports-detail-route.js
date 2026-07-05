async function handleDefenseAuditReportsDetailRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path.startsWith("/runtime/audit-reports/")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const report_id = path.replace("/runtime/audit-reports/", "");
    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      SELECT *
      FROM runtime_audit_reports
      WHERE report_id = $1
        AND tenant_id = $2
      LIMIT 1
    `, [
      report_id,
      tenant_id
    ]);

    if (result.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "audit report not found"
      });
    }

    return send(res, 200, {
      audit_report: result.rows[0]
    });
  }

  return false;
}

module.exports = {
  handleDefenseAuditReportsDetailRoute
};
