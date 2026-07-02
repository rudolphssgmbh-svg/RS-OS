async function handleIncidentDashboardRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  // RSOS-072E INCIDENT METRICS

if (
  req.method === "GET" &&
  path === "/runtime/incidents/metrics"
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const closureResult = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed_count,
      AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 60)
        FILTER (WHERE closed_at IS NOT NULL) AS avg_minutes_to_close
    FROM runtime_incidents
    WHERE tenant_id = $1
  `, [
    auth.user.tenant_id
  ]);

  const verificationResult = await db.query(`
    SELECT
      COUNT(*)::int AS verified_recovery_count,
      AVG(EXTRACT(EPOCH FROM (v.verified_at - i.created_at)) / 60)
        AS avg_minutes_incident_to_verification,
      AVG(EXTRACT(EPOCH FROM (v.verified_at - r.requested_at)) / 60)
        AS avg_minutes_request_to_verification
    FROM runtime_incidents i
    JOIN runtime_incident_links l
      ON l.tenant_id = i.tenant_id
     AND l.incident_id = i.incident_id
     AND l.linked_type = 'recovery_request'
    JOIN runtime_recovery_requests r
      ON r.tenant_id = l.tenant_id
     AND r.recovery_request_id = l.linked_id
    JOIN runtime_recovery_verifications v
      ON v.tenant_id = r.tenant_id
     AND v.recovery_request_id = r.recovery_request_id
    WHERE i.tenant_id = $1
      AND v.verification_status = 'verified'
      AND v.verified_at IS NOT NULL
  `, [
    auth.user.tenant_id
  ]);

  const closure = closureResult.rows[0];
  const verification = verificationResult.rows[0];

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    closed_count: closure.closed_count,
    verified_recovery_count: verification.verified_recovery_count,
    avg_minutes_to_close: closure.avg_minutes_to_close === null
      ? null
      : Number(Number(closure.avg_minutes_to_close).toFixed(3)),
    avg_minutes_incident_to_verification: verification.avg_minutes_incident_to_verification === null
      ? null
      : Number(Number(verification.avg_minutes_incident_to_verification).toFixed(3)),
    avg_minutes_request_to_verification: verification.avg_minutes_request_to_verification === null
      ? null
      : Number(Number(verification.avg_minutes_request_to_verification).toFixed(3))
  });
}


  // RSOS-072D INCIDENT SEARCH

if (
  req.method === "GET" &&
  path === "/runtime/incidents/search"
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const url = new URL(req.url, "http://localhost");
  const q = url.searchParams.get("q");

  if (!q) {
    return send(res, 400, {
      error: "validation_error",
      message: "q query parameter required"
    });
  }

  const result = await db.query(`
    SELECT DISTINCT
      i.*
    FROM runtime_incidents i
    LEFT JOIN runtime_incident_lessons l
      ON l.tenant_id = i.tenant_id
     AND l.incident_id = i.incident_id
    WHERE i.tenant_id = $1
      AND (
        i.title ILIKE $2
        OR i.description ILIKE $2
        OR l.lesson_summary ILIKE $2
        OR l.root_cause ILIKE $2
        OR l.improvement_action ILIKE $2
      )
    ORDER BY i.created_at DESC
  `, [
    auth.user.tenant_id,
    `%${q}%`
  ]);

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    query: q,
    result_count: result.rows.length,
    incidents: result.rows
  });
}


  // RSOS-072C INCIDENT COMPLETENESS DASHBOARD

if (
  req.method === "GET" &&
  path === "/runtime/incidents/completeness"
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const result = await db.query(`
    SELECT
      i.incident_id,
      i.status,

      EXISTS (
        SELECT 1
        FROM runtime_incident_links l
        WHERE l.tenant_id = i.tenant_id
          AND l.incident_id = i.incident_id
          AND l.linked_type = 'recovery_request'
      ) AS has_recovery_link,

      EXISTS (
        SELECT 1
        FROM runtime_incident_links l
        JOIN runtime_recovery_verifications v
          ON v.tenant_id = l.tenant_id
         AND v.recovery_request_id = l.linked_id
        WHERE l.tenant_id = i.tenant_id
          AND l.incident_id = i.incident_id
          AND l.linked_type = 'recovery_request'
          AND v.verification_status = 'verified'
      ) AS has_verified_result,

      EXISTS (
        SELECT 1
        FROM runtime_incident_lessons lesson
        WHERE lesson.tenant_id = i.tenant_id
          AND lesson.incident_id = i.incident_id
      ) AS has_lesson

    FROM runtime_incidents i
    WHERE i.tenant_id = $1
  `, [
    auth.user.tenant_id
  ]);

  const cases = result.rows;

  const casesTotal = cases.length;

  const fullyComplete = cases.filter(c =>
    c.has_recovery_link &&
    c.has_verified_result &&
    c.has_lesson &&
    c.status === "closed"
  ).length;

  const missingRecoveryLink = cases.filter(c => !c.has_recovery_link).length;
  const missingVerification = cases.filter(c => !c.has_verified_result).length;
  const missingLesson = cases.filter(c => !c.has_lesson).length;
  const missingClosure = cases.filter(c => c.status !== "closed").length;

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    cases_total: casesTotal,
    fully_complete: fullyComplete,
    missing_recovery_link: missingRecoveryLink,
    missing_verification: missingVerification,
    missing_lesson: missingLesson,
    missing_closure: missingClosure,
    completeness_ratio: casesTotal === 0
      ? 1
      : Number((fullyComplete / casesTotal).toFixed(3)),
    cases: cases
  });
}


  // RSOS-072B INCIDENT DASHBOARD SUMMARY

if (
  req.method === "GET" &&
  path === "/runtime/incidents/dashboard"
) {

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const statusResult = await db.query(`
    SELECT status, COUNT(*)::int AS count
    FROM runtime_incidents
    WHERE tenant_id = $1
    GROUP BY status
    ORDER BY status
  `, [
    auth.user.tenant_id
  ]);

  const severityResult = await db.query(`
    SELECT severity, COUNT(*)::int AS count
    FROM runtime_incidents
    WHERE tenant_id = $1
    GROUP BY severity
    ORDER BY severity
  `, [
    auth.user.tenant_id
  ]);

  const typeResult = await db.query(`
    SELECT incident_type, COUNT(*)::int AS count
    FROM runtime_incidents
    WHERE tenant_id = $1
    GROUP BY incident_type
    ORDER BY incident_type
  `, [
    auth.user.tenant_id
  ]);

  const lessonResult = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_incident_lessons
    WHERE tenant_id = $1
  `, [
    auth.user.tenant_id
  ]);

  const openCriticalResult = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND status <> 'closed'
      AND severity = 'critical'
  `, [
    auth.user.tenant_id
  ]);

  const toMap = rows =>
    rows.reduce((acc, row) => {
      acc[row.status || row.severity || row.incident_type] = row.count;
      return acc;
    }, {});

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    total_incidents: statusResult.rows.reduce((sum, r) => sum + r.count, 0),
    by_status: toMap(statusResult.rows),
    by_severity: toMap(severityResult.rows),
    by_type: toMap(typeResult.rows),
    lessons_total: lessonResult.rows[0].count,
    open_critical: openCriticalResult.rows[0].count
  });
}



  return false;
}

module.exports = {
  handleIncidentDashboardRoute
};
