/**
 * RSOS-060 Source Routes
 * Extracted from server.js.
 * No domain logic changes.
 */

async function handleRsos060SourcesRoutes(ctx) {
  const {
    req,
    res,
    path,
    db,
    crypto,
    verifyToken,
    readBody,
    writeEvent,
    send
  } = ctx;

    if (req.method === "POST" && path === "/runtime/sources") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const body = await readBody(req);

      const tenant_id = authUser.tenant_id;
      const source_type = body.source_type;
      const title = body.title || null;
      const description = body.description || null;
      const source_url = body.source_url || null;
      const jurisdiction = body.jurisdiction || null;
      const source_owner = body.source_owner || null;
      const trust_level = body.trust_level || null;
      const status = body.status || "active";
      const created_by = authUser.operator_id || authUser.role || "runtime_user";

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      if (!source_type) {
        return send(res, 400, {
          error: "validation_error",
          message: "source_type required"
        });
      }

      const source_id =
        "00000000-0000-4001-8000-" +
        crypto.randomBytes(6).toString("hex");

      await db.query(`
        INSERT INTO runtime_sources (
          source_id,
          tenant_id,
          source_type,
          title,
          description,
          source_url,
          jurisdiction,
          source_owner,
          trust_level,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        source_id,
        tenant_id,
        source_type,
        title,
        description,
        source_url,
        jurisdiction,
        source_owner,
        trust_level,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id,
        object_id: source_id,
        event_type: "runtime.source.created",
        message: JSON.stringify({
          source_id,
          source_type,
          title,
          jurisdiction,
          trust_level,
          status
        })
      });

      return send(res, 201, {
        source: {
          source_id,
          tenant_id,
          source_type,
          title,
          description,
          source_url,
          jurisdiction,
          source_owner,
          trust_level,
          status,
          created_by
        }
      });
    }

    if (req.method === "GET" && path === "/runtime/sources") {
      const authUser = verifyToken(req);

      if (!authUser) {
        return send(res, 401, {
          error: "unauthorized",
          message: "JWT token required"
        });
      }

      const urlObj = new URL(req.url, "http://localhost");
      const tenant_id =
        urlObj.searchParams.get("tenant_id") && authUser.scope === "global"
          ? urlObj.searchParams.get("tenant_id")
          : authUser.tenant_id;
      const status = urlObj.searchParams.get("status");

      if (!tenant_id) {
        return send(res, 400, {
          error: "validation_error",
          message: "tenant_id required"
        });
      }

      const params = [tenant_id];
      let where = "WHERE tenant_id = $1";

      if (status) {
        params.push(status);
        where += " AND status = $2";
      }

      const result = await db.query(`
        SELECT
          source_id,
          tenant_id,
          source_type,
          title,
          description,
          source_url,
          jurisdiction,
          source_owner,
          trust_level,
          status,
          created_at,
          created_by
        FROM runtime_sources
        ${where}
        ORDER BY created_at DESC
        LIMIT 100
      `, params);

      return send(res, 200, {
        sources: result.rows
      });
    }



  return false;
}

module.exports = {
  handleRsos060SourcesRoutes
};
