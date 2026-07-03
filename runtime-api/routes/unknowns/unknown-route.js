async function handleUnknownRoute({
  req,
  res,
  path,
  db,
  crypto,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
if (req.method === "POST" && path === "/runtime/unknowns") {
  const authUser = verifyToken(req);

  if (!authUser) {
    return send(res, 401, {
      error: "unauthorized",
      message: "JWT token required"
    });
  }

  const body = await readBody(req);

  const tenant_id = authUser.tenant_id;
  const related_object_type = body.related_object_type || null;
  const related_object_id = body.related_object_id || null;
  const unknown_type = body.unknown_type;
  const title = body.title;
  const description = body.description || null;
  const risk_level = body.risk_level || null;
  const status = body.status || "open";
  const dependency_type = body.dependency_type || null;
  const dependency_reference = body.dependency_reference || null;
  const created_by = authUser.operator_id || authUser.role || "runtime_user";

  if (!tenant_id) {
    return send(res, 400, {
      error: "validation_error",
      message: "tenant_id required"
    });
  }

  if (!unknown_type || !title) {
    return send(res, 400, {
      error: "validation_error",
      message: "unknown_type and title required"
    });
  }

  const unknown_id =
    "00000000-0000-4009-8000-" +
    crypto.randomBytes(6).toString("hex");

  await db.query(`
    INSERT INTO runtime_unknowns (
      unknown_id,
      tenant_id,
      related_object_type,
      related_object_id,
      unknown_type,
      title,
      description,
      risk_level,
      status,
      created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [
    unknown_id,
    tenant_id,
    related_object_type,
    related_object_id,
    unknown_type,
    title,
    description,
    risk_level,
    status,
    created_by
  ]);

  let dependency_id = null;

  if (dependency_type) {
    dependency_id =
      "00000000-0000-4010-8000-" +
      crypto.randomBytes(6).toString("hex");

    await db.query(`
      INSERT INTO runtime_unknown_dependencies (
        dependency_id,
        tenant_id,
        unknown_id,
        dependency_type,
        dependency_reference
      )
      VALUES ($1,$2,$3,$4,$5)
    `, [
      dependency_id,
      tenant_id,
      unknown_id,
      dependency_type,
      dependency_reference
    ]);
  }

  await writeEvent({
    tenant_id,
    object_id: unknown_id,
    event_type: "runtime.unknown.created",
    message: JSON.stringify({
      unknown_id,
      unknown_type,
      title,
      risk_level,
      status,
      dependency_id
    })
  });

  return send(res, 201, {
    unknown: {
      unknown_id,
      tenant_id,
      related_object_type,
      related_object_id,
      unknown_type,
      title,
      description,
      risk_level,
      status,
      dependency_id,
      dependency_type,
      dependency_reference,
      created_by
    }
  });
}

if (req.method === "GET" && path === "/runtime/unknowns") {
  const authUser = verifyToken(req);

  if (!authUser) {
    return send(res, 401, {
      error: "unauthorized",
      message: "JWT token required"
    });
  }

  const urlObj = new URL(req.url, "http://localhost");
  const tenant_id = authUser.tenant_id;

  if (!tenant_id) {
    return send(res, 400, {
      error: "validation_error",
      message: "tenant_id required"
    });
  }

  const result = await db.query(`
    SELECT
      u.unknown_id,
      u.tenant_id,
      u.related_object_type,
      u.related_object_id,
      u.unknown_type,
      u.title,
      u.description,
      u.risk_level,
      u.status,
      u.created_at,
      u.created_by,
      COALESCE(
        json_agg(
          json_build_object(
            'dependency_id', d.dependency_id,
            'dependency_type', d.dependency_type,
            'dependency_reference', d.dependency_reference
          )
        ) FILTER (WHERE d.dependency_id IS NOT NULL),
        '[]'
      ) AS dependencies
    FROM runtime_unknowns u
    LEFT JOIN runtime_unknown_dependencies d
      ON d.unknown_id = u.unknown_id
    WHERE u.tenant_id = $1
    GROUP BY u.unknown_id
    ORDER BY u.created_at DESC
    LIMIT 100
  `, [
    tenant_id
  ]);

  return send(res, 200, {
    unknowns: result.rows
  });
}





  return false;
}

module.exports = {
  handleUnknownRoute
};
