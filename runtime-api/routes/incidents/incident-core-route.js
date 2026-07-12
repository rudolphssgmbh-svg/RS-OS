async function handleIncidentCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
// RSOS-071 CREATE INCIDENT

if (
  req.method === "POST" &&
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

  const body = await readBody(req);

  const result = await db.query(`
    INSERT INTO runtime_incidents (
      tenant_id,
      title,
      description,
      incident_type,
      severity,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [
    auth.user.tenant_id,
    body.title,
    body.description || null,
    body.incident_type || "generic",
    body.severity || "medium",
    auth.user.operator_id
  ]);

  return send(res, 201, result.rows[0]);
}


// RSOS-071 LINK INCIDENT

if (
  req.method === "POST" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/links$/)
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
  const body = await readBody(req);

  const result = await db.query(`
    INSERT INTO runtime_incident_links (
      tenant_id,
      incident_id,
      linked_type,
      linked_id,
      relation_type,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `, [
    auth.user.tenant_id,
    incident_id,
    body.linked_type,
    body.linked_id,
    body.relation_type || "related",
    auth.user.operator_id
  ]);

  return send(res, 201, result.rows[0]);
}



// RSOS-071E UPDATE INCIDENT STATUS

if (
  req.method === "PATCH" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/status$/)
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
  const body = await readBody(req);

  const allowedStatuses = [
    "open",
    "triage",
    "contained",
    "recovery_requested",
    "recovery_in_progress",
    "verification_pending",
    "verified",
    "closed",
    "cancelled",
    "rejected"
  ];

  if (!body.status || !allowedStatuses.includes(body.status)) {
    return send(res, 400, {
      error: "validation_error",
      message: "invalid incident status",
      allowed_statuses: allowedStatuses
    });
  }

  const existing = await db.query(`
    SELECT *
    FROM runtime_incidents
    WHERE tenant_id = $1
      AND incident_id = $2
    LIMIT 1
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  if (existing.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const oldStatus = existing.rows[0].status;

  if (body.status === "closed") {

    const governanceCheck = await db.query(`
        WITH latest_decision AS (
          SELECT
            decision_id,
            revision_number
          FROM runtime_governance_decisions
          WHERE tenant_id = $1
            AND object_id = $2
          ORDER BY
            revision_number DESC,
            decision_id DESC
          LIMIT 1
        ),
        current_approval AS (
          SELECT
            approval_id,
            approval_status,
            decision_id
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND object_id = $2
            AND decision_id = (
              SELECT decision_id
              FROM latest_decision
            )
          LIMIT 1
        )
        SELECT
          EXISTS (
            SELECT 1
            FROM latest_decision
          ) AS has_decision,

          EXISTS (
            SELECT 1
            FROM current_approval
          ) AS has_approval,

          (
            SELECT decision_id
            FROM latest_decision
          ) AS decision_id,

          (
            SELECT revision_number
            FROM latest_decision
          ) AS revision_number,

          (
            SELECT approval_id
            FROM current_approval
          ) AS approval_id,

          (
            SELECT approval_status
            FROM current_approval
          ) AS approval_status,

          EXISTS (
            SELECT 1
            FROM runtime_risks
            WHERE tenant_id = $1
              AND object_id = $2
          ) AS has_residual_risk,

          EXISTS (
            SELECT 1
            FROM runtime_incident_lessons
            WHERE tenant_id = $1
              AND incident_id = $2::uuid
          ) AS has_lesson
      `, [
      auth.user.tenant_id,
      incident_id
    ]);

    const checks = governanceCheck.rows[0];

    const governanceReady =
      checks.has_decision &&
      checks.has_approval &&
      checks.has_residual_risk &&
      checks.has_lesson;

    if (!governanceReady) {
      return send(res, 409, {
        error: "governance_incomplete",
        message: "incident cannot be closed before governance requirements are complete",
        governance_ready: false,
        checks
      });
    }
  }

  const result = await db.query(`
    UPDATE runtime_incidents
    SET status = $1,
        updated_by = $2,
        updated_at = now(),
        closed_at = CASE
          WHEN $1 = 'closed' AND status <> 'closed' THEN now()
          ELSE closed_at
        END
    WHERE tenant_id = $3
      AND incident_id = $4
    RETURNING *
  `, [
    body.status,
    auth.user.operator_id,
    auth.user.tenant_id,
    incident_id
  ]);

  await writeEvent({
    tenant_id: auth.user.tenant_id,
    object_id: incident_id,
    event_type: "runtime.incident.status.changed",
    message: JSON.stringify({
      incident_id,
      old_status: oldStatus,
      new_status: body.status,
      reason: body.reason || null,
      changed_by: auth.user.operator_id
    }),
    created_by: auth.user.operator_id
  });

  return send(res, 200, {
    incident: result.rows[0],
    old_status: oldStatus,
    new_status: body.status
  });
}



// RSOS-071F GET INCIDENT TIMELINE

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/timeline$/)
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

  if (incident.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "incident not found"
    });
  }

  const events = await db.query(`
    SELECT *
    FROM runtime_events
    WHERE tenant_id = $1
      AND object_id = $2
    ORDER BY created_at ASC
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  return send(res, 200, {
    incident: incident.rows[0],
    event_count: events.rows.length,
    events: events.rows
  });
}



// RSOS-071G CREATE INCIDENT LESSON

if (
  req.method === "POST" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/lessons$/)
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
  const body = await readBody(req);

  const result = await db.query(`
    INSERT INTO runtime_incident_lessons (
      tenant_id,
      incident_id,
      lesson_type,
      lesson_summary,
      root_cause,
      prevention_action,
      improvement_action,
      responsible_user,
      status,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `, [
    auth.user.tenant_id,
    incident_id,
    body.lesson_type || "improvement",
    body.lesson_summary,
    body.root_cause || null,
    body.prevention_action || null,
    body.improvement_action || null,
    body.responsible_user || null,
    body.status || "open",
    auth.user.operator_id
  ]);

  await writeEvent({
    tenant_id: auth.user.tenant_id,
    object_id: incident_id,
    event_type: "runtime.incident.lesson.created",
    message: JSON.stringify({
      incident_id,
      lesson_id: result.rows[0].lesson_id,
      lesson_type: result.rows[0].lesson_type,
      lesson_summary: result.rows[0].lesson_summary,
      created_by: auth.user.operator_id
    }),
    created_by: auth.user.operator_id
  });

  return send(res, 201, result.rows[0]);
}


// RSOS-071G GET INCIDENT LESSONS

if (
  req.method === "GET" &&
  path.match(/^\/runtime\/incidents\/[^/]+\/lessons$/)
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

  const result = await db.query(`
    SELECT *
    FROM runtime_incident_lessons
    WHERE tenant_id = $1
      AND incident_id = $2
    ORDER BY created_at ASC
  `, [
    auth.user.tenant_id,
    incident_id
  ]);

  return send(res, 200, {
    incident_id,
    lesson_count: result.rows.length,
    lessons: result.rows
  });
}













  return false;
}

module.exports = {
  handleIncidentCoreRoute
};
