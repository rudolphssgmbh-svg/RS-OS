async function handleCreateRuntimeObjectRoute({
  req,
  res,
  db,
  send,
  readBody,
  requireRole,
  writeEvent
}) {
  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const authUser = auth.user;
  const tenant_id = authUser.tenant_id;
  const body = await readBody(req);

  const object_id =
    body.object_id ||
    `obj-${Date.now()}`;

  const runtime_type =
    body.runtime_type ||
    "runtime.object.generic";

  const state =
    body.state ||
    "created";

  const priority =
    body.priority ||
    "normal";

  const risk_score =
    Number.isInteger(body.risk_score)
      ? body.risk_score
      : 0;

  await db.query(`
    INSERT INTO runtime_objects
    (
      object_id,
      runtime_type,
      state,
      priority,
      risk_score,
      tenant_id
    )
    VALUES ($1,$2,$3,$4,$5,$6)
  `, [
    object_id,
    runtime_type,
    state,
    priority,
    risk_score,
    tenant_id
  ]);

  await writeEvent({
    event_type: "runtime.object.created",
    object_id,
    message: "Runtime object created",
    tenant_id
  });

  return send(res, 201, {
    created: true,
    object: {
      object_id,
      runtime_type,
      state,
      priority,
      risk_score,
      tenant_id
    }
  });
}

module.exports = { handleCreateRuntimeObjectRoute };
