async function handleIncidentRegistryRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
// RSOS-072A INCIDENT REGISTRY

if (
  req.method === "GET" &&
  path === "/runtime/incidents"
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

  const status =
    url.searchParams.get("status");

  const severity =
    url.searchParams.get("severity");

  const incidentType =
    url.searchParams.get("incident_type");

  const limit =
    parseInt(
      url.searchParams.get("limit") || "100",
      10
    );

  const conditions = [
    "tenant_id = $1"
  ];

  const params = [
    auth.user.tenant_id
  ];

  let idx = 2;

  if (status) {
    conditions.push(
      `status = $${idx++}`
    );
    params.push(status);
  }

  if (severity) {
    conditions.push(
      `severity = $${idx++}`
    );
    params.push(severity);
  }

  if (incidentType) {
    conditions.push(
      `incident_type = $${idx++}`
    );
    params.push(incidentType);
  }

  params.push(limit);

  const result = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${idx}
  `, params);

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,
    incident_count: result.rows.length,
    incidents: result.rows
  });
}


// RSOS-071H GET INCIDENT SUMMARY

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/summary$/)
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

  const incident_id = path.split("/")[3];

  const incidentResult = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (incidentResult.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const linksResult = await db.query(`
    SELECT *
    FROM runtime_incident_links
    WHERE tenant_id = $1
      AND incident_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const recoveryRequestIds = linksResult.rows
    .filter(l => l.linked_type === "recovery_request")
    .map(l => l.linked_id);

  let recoveryCount = 0;
  let verificationCount = 0;
  let verifiedCount = 0;

  if (recoveryRequestIds.length > 0) {
    const rr = await db.query(`
      SELECT COUNT(*)::int AS count
      FROM runtime_recovery_requests
      WHERE tenant_id = $1
        AND recovery_request_id = ANY($2::uuid[])
    `, [
      auth.user.tenant_id,
      recoveryRequestIds
    ]);

    recoveryCount = rr.rows[0].count;

    const rv = await db.query(`
      SELECT
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE verification_status = 'verified')::int AS verified_count
      FROM runtime_recovery_verifications
      WHERE tenant_id = $1
        AND recovery_request_id = ANY($2::uuid[])
    `, [
      auth.user.tenant_id,
      recoveryRequestIds
    ]);

    verificationCount = rv.rows[0].count;
    verifiedCount = rv.rows[0].verified_count;
  }

  const lessonsResult = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_incident_lessons
    WHERE tenant_id = $1
      AND incident_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const auditResult = await db.query(`
    SELECT COUNT(*)::int AS count
    FROM runtime_events
    WHERE tenant_id = $1
      AND object_id = $2
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const incident = incidentResult.rows[0];

  const completenessChecks = {
    has_incident: true,
    has_recovery_link: recoveryRequestIds.length > 0,
    has_recovery_request: recoveryCount > 0,
    has_verification: verificationCount > 0,
    has_verified_result: verifiedCount > 0,
    has_lesson: lessonsResult.rows[0].count > 0,
    has_audit_timeline: auditResult.rows[0].count > 0,
    is_closed: incident.status === "closed"
  };

  const passedChecks = Object.values(completenessChecks).filter(Boolean).length;
  const totalChecks = Object.values(completenessChecks).length;

  return send(res, 200, {
    incident_id,
    tenant_id: incident.tenant_id,
    title: incident.title,
    incident_type: incident.incident_type,
    severity: incident.severity,
    status: incident.status,
    created_at: incident.created_at,
    closed_at: incident.closed_at,
    counts: {
      links: linksResult.rows.length,
      recovery_requests: recoveryCount,
      recovery_verifications: verificationCount,
      verified_recoveries: verifiedCount,
      lessons: lessonsResult.rows[0].count,
      audit_events: auditResult.rows[0].count
    },
    case_completeness: {
      passed: passedChecks,
      total: totalChecks,
      ratio: Number((passedChecks / totalChecks).toFixed(3)),
      checks: completenessChecks
    }
  });
}


// RSOS-071 GET INCIDENT CASE

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+$/)
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

  const incident_id = path.split("/")[3];

  const incident = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const links = await db.query(`
    SELECT *
    FROM runtime_incident_links
    WHERE tenant_id = $1
      AND incident_id = $2
    ORDER BY created_at ASC
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  const recoveryRequestIds = links.rows
    .filter(l => l.linked_type === "recovery_request")
    .map(l => l.linked_id);

  let recoveryRequests = [];
  let recoveryVerifications = [];
  let restoredObjects = [];

  if (recoveryRequestIds.length > 0) {
    const rr = await db.query(`
      SELECT *
      FROM runtime_recovery_requests
      WHERE tenant_id = $1
        AND recovery_request_id = ANY($2::uuid[])
      ORDER BY created_at ASC
    `, [
      auth.user.tenant_id,
      recoveryRequestIds
    ]);

    recoveryRequests = rr.rows;

    const rv = await db.query(`
      SELECT *
      FROM runtime_recovery_verifications
      WHERE tenant_id = $1
        AND recovery_request_id = ANY($2::uuid[])
      ORDER BY created_at ASC
    `, [
      auth.user.tenant_id,
      recoveryRequestIds
    ]);

    recoveryVerifications = rv.rows;

    const restoredObjectIds = rv.rows
      .map(v => v.verification_result && v.verification_result.runtime_object_id)
      .filter(Boolean);

    if (restoredObjectIds.length > 0) {
      const ro = await db.query(`
        SELECT *
        FROM runtime_objects
        WHERE tenant_id = $1
          AND object_id = ANY($2::text[])
        ORDER BY created_at ASC
      `, [
        auth.user.tenant_id,
        restoredObjectIds
      ]);

      restoredObjects = ro.rows;
    }
  }

  return send(res, 200, {
    incident: incident.rows[0] || null,
    links: links.rows,
    recovery_requests: recoveryRequests,
    recovery_verifications: recoveryVerifications,
    restored_objects: restoredObjects
  });
}






  return false;
}

module.exports = {
  handleIncidentRegistryRoute
};
