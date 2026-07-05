async function handleKnowledgeRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  // RSOS-054B Knowledge API - Create
  if (req.method === "POST" && path === "/runtime/knowledge") {
    const auth = requireRole(req, [
      "runtime_admin",
      "governance",
      "system_admin"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const body = await readBody(req);

    const tenant_id =
      body.tenant_id && auth.user.scope === "global"
        ? body.tenant_id
        : auth.user.tenant_id;

    const knowledge_id =
      body.knowledge_id ||
      "kn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const knowledge_type = body.knowledge_type;
    const parent_knowledge_id = body.parent_knowledge_id || null;
    const title = body.title;
    const description = body.description || null;
    const language_code = body.language_code || "de";
    const version = body.version || 1;
    const status = body.status || "active";
    const source = body.source || "manual";

    const content =
      typeof body.content === "string"
        ? body.content
        : JSON.stringify(body.content || {});

    if (!tenant_id || !knowledge_type || !title) {
      send(res, 400, {
        error: "missing_required_knowledge_fields",
        required: [
          "tenant_id",
          "knowledge_type",
          "title"
        ]
      });
      return true;
    }

    const existingResult = await db.query(`
      SELECT knowledge_id
      FROM runtime_knowledge
      WHERE knowledge_id = $1
      LIMIT 1
    `, [knowledge_id]);

    if (existingResult.rows.length > 0) {
      send(res, 409, {
        error: "knowledge_already_exists",
        knowledge_id
      });
      return true;
    }

    const created_by =
      auth.user.operator_id || auth.user.username || "runtime_admin";

    const insertResult = await db.query(`
      INSERT INTO runtime_knowledge (
        knowledge_id,
        tenant_id,
        object_id,
        knowledge_type,
        parent_knowledge_id,
        title,
        description,
        content,
        source,
        language_code,
        version,
        status,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      knowledge_id,
      tenant_id,
      body.object_id || null,
      knowledge_type,
      parent_knowledge_id,
      title,
      description,
      content,
      source,
      language_code,
      version,
      status,
      created_by
    ]);

    await writeEvent({
      event_type: "runtime.knowledge.created",
      object_id: knowledge_id,
      tenant_id,
      message: "Knowledge created: " + title
    });

    send(res, 200, {
      created: true,
      knowledge: insertResult.rows[0]
    });
    return true;
  }

  // RSOS-054B Knowledge API - List
  if (req.method === "GET" && path === "/runtime/knowledge") {
    const auth = requireRole(req, [
      "runtime_admin",
      "governance",
      "auditor",
      "system_admin"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const urlObj = new URL(req.url, "http://localhost");

    const tenant_id =
      urlObj.searchParams.get("tenant_id") && auth.user.scope === "global"
        ? urlObj.searchParams.get("tenant_id")
        : auth.user.tenant_id;

    const knowledge_type = urlObj.searchParams.get("knowledge_type");
    const parent_knowledge_id = urlObj.searchParams.get("parent_knowledge_id");

    const params = [tenant_id];
    let where = "WHERE tenant_id = $1";

    if (knowledge_type) {
      params.push(knowledge_type);
      where += " AND knowledge_type = $" + params.length;
    }

    if (parent_knowledge_id) {
      params.push(parent_knowledge_id);
      where += " AND parent_knowledge_id = $" + params.length;
    }

    const result = await db.query(`
      SELECT
        knowledge_id,
        tenant_id,
        object_id,
        knowledge_type,
        parent_knowledge_id,
        title,
        description,
        content,
        source,
        language_code,
        version,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
      FROM runtime_knowledge
      ${where}
      ORDER BY created_at ASC, title ASC
    `, params);

    send(res, 200, {
      tenant_id,
      count: result.rows.length,
      items: result.rows
    });
    return true;
  }

  // RSOS-054B Knowledge API - Detail
  if (req.method === "GET" && path.startsWith("/runtime/knowledge/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "governance",
      "auditor",
      "system_admin"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const knowledge_id = decodeURIComponent(
      path.replace("/runtime/knowledge/", "")
    );

    if (!knowledge_id) {
      send(res, 400, {
        error: "missing_knowledge_id"
      });
      return true;
    }

    const result = await db.query(`
      SELECT *
      FROM runtime_knowledge
      WHERE knowledge_id = $1
      LIMIT 1
    `, [knowledge_id]);

    if (result.rows.length === 0) {
      send(res, 404, {
        error: "knowledge_not_found",
        knowledge_id
      });
      return true;
    }

    const knowledge = result.rows[0];

    if (auth.user.scope !== "global" && knowledge.tenant_id !== auth.user.tenant_id) {
      send(res, 403, {
        error: "tenant_scope_violation"
      });
      return true;
    }

    const childrenResult = await db.query(`
      SELECT
        knowledge_id,
        knowledge_type,
        title,
        description,
        language_code,
        status,
        created_at
      FROM runtime_knowledge
      WHERE tenant_id = $1
        AND parent_knowledge_id = $2
      ORDER BY created_at ASC, title ASC
    `, [
      knowledge.tenant_id,
      knowledge.knowledge_id
    ]);

    send(res, 200, {
      knowledge,
      children: {
        count: childrenResult.rows.length,
        items: childrenResult.rows
      }
    });
    return true;
  }

  return false;
}

module.exports = {
  handleKnowledgeRoute
};
