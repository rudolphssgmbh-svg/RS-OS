async function handleRelationsGraphRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  // CREATE RELATION
  if (req.method === "POST" && path === "/runtime/relations") {
    const auth = requireRole(req, [
      "runtime_admin",
      "governance"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;

    const source_object_id = body.source_object_id;
    const target_object_id = body.target_object_id;
    const relation_type = body.relation_type;

    if (!source_object_id || !target_object_id || !relation_type) {
      send(res, 400, {
        error: "missing_required_relation_fields"
      });
      return true;
    }

    const relation_id =
      "rel-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    await db.query(`
      INSERT INTO runtime_relations (
        relation_id,
        tenant_id,
        source_object_id,
        target_object_id,
        relation_type
      )
      VALUES ($1,$2,$3,$4,$5)
    `, [
      relation_id,
      tenant_id,
      source_object_id,
      target_object_id,
      relation_type
    ]);

    await writeEvent({
      tenant_id,
      object_id: source_object_id,
      event_type: "runtime.relation.created",
      message: `Relation created: ${source_object_id} ${relation_type} ${target_object_id}`
    });

    send(res, 200, {
      created: true,
      relation: {
        relation_id,
        tenant_id,
        source_object_id,
        target_object_id,
        relation_type
      }
    });
    return true;
  }

  // DELETE RELATION
  if (req.method === "DELETE" && path.startsWith("/runtime/relations/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "governance"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const tenant_id = auth.user.tenant_id;

    const relation_id = decodeURIComponent(
      path.replace("/runtime/relations/", "")
    );

    if (!relation_id) {
      send(res, 400, {
        error: "missing_relation_id"
      });
      return true;
    }

    const existingResult = await db.query(`
      SELECT *
      FROM runtime_relations
      WHERE tenant_id = $1
        AND relation_id = $2
      LIMIT 1
    `, [
      tenant_id,
      relation_id
    ]);

    if (existingResult.rows.length === 0) {
      send(res, 404, {
        error: "relation_not_found",
        relation_id
      });
      return true;
    }

    const relation = existingResult.rows[0];

    await db.query(`
      DELETE FROM runtime_relations
      WHERE tenant_id = $1
        AND relation_id = $2
    `, [
      tenant_id,
      relation_id
    ]);

    await writeEvent({
      tenant_id,
      object_id: relation.source_object_id,
      event_type: "runtime.relation.deleted",
      message: `Relation deleted: ${relation.source_object_id} ${relation.relation_type} ${relation.target_object_id}`
    });

    send(res, 200, {
      deleted: true,
      relation
    });
    return true;
  }

  // GET RELATIONS
  if (req.method === "GET" && path === "/runtime/relations") {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const result = await db.query(`
      SELECT *
      FROM runtime_relations
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [auth.user.tenant_id]);

    send(res, 200, {
      count: result.rows.length,
      relations: result.rows
    });
    return true;
  }

  // GET RELATIONS BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/relations/object/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const object_id = decodeURIComponent(
      path.replace("/runtime/relations/object/", "")
    );

    if (!object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const result = await db.query(`
      SELECT *
      FROM runtime_relations
      WHERE tenant_id = $1
        AND (
          source_object_id = $2
          OR target_object_id = $2
        )
      ORDER BY created_at DESC
    `, [
      auth.user.tenant_id,
      object_id
    ]);

    send(res, 200, {
      object_id,
      count: result.rows.length,
      relations: result.rows
    });
    return true;
  }

  // GET RUNTIME GRAPH DEPTH BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/graph/depth/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const root_object_id = decodeURIComponent(
      path.replace("/runtime/graph/depth/", "")
    );

    if (!root_object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const urlObj = new URL(req.url, "http://localhost");
    const max_depth = Math.min(
      Math.max(Number(urlObj.searchParams.get("depth") || 3), 1),
      5
    );

    const visited = new Set();
    const frontier = new Set([root_object_id]);
    const allNodeIds = new Set([root_object_id]);
    const edgeMap = new Map();

    for (let depth = 0; depth < max_depth; depth++) {
      const current = Array.from(frontier)
        .filter(id => !visited.has(id));

      if (current.length === 0) {
        break;
      }

      for (const id of current) {
        visited.add(id);
      }

      const relationsResult = await db.query(`
        SELECT *
        FROM runtime_relations
        WHERE tenant_id = $1
          AND (
            source_object_id = ANY($2)
            OR target_object_id = ANY($2)
          )
        ORDER BY created_at DESC
      `, [
        auth.user.tenant_id,
        current
      ]);

      frontier.clear();

      for (const relation of relationsResult.rows) {
        edgeMap.set(relation.relation_id, relation);

        if (!visited.has(relation.source_object_id)) {
          frontier.add(relation.source_object_id);
        }

        if (!visited.has(relation.target_object_id)) {
          frontier.add(relation.target_object_id);
        }

        allNodeIds.add(relation.source_object_id);
        allNodeIds.add(relation.target_object_id);
      }
    }

    const nodesResult = await db.query(`
      SELECT *
      FROM runtime_objects
      WHERE tenant_id = $1
        AND object_id = ANY($2)
    `, [
      auth.user.tenant_id,
      Array.from(allNodeIds)
    ]);

    const objectMap = new Map();

    for (const object of nodesResult.rows) {
      objectMap.set(object.object_id, object);
    }

    const nodes = Array.from(allNodeIds).map(id => {
      const object = objectMap.get(id);

      return {
        object_id: id,
        exists_in_runtime_objects: !!object,
        runtime_type: object ? object.runtime_type : null,
        state: object ? object.state : null,
        priority: object ? object.priority : null,
        risk_score: object ? object.risk_score : null,
        tenant_id: auth.user.tenant_id
      };
    });

    const edges = Array.from(edgeMap.values()).map(relation => ({
      relation_id: relation.relation_id,
      source_object_id: relation.source_object_id,
      target_object_id: relation.target_object_id,
      relation_type: relation.relation_type,
      tenant_id: relation.tenant_id,
      created_at: relation.created_at
    }));

    send(res, 200, {
      root_object_id,
      max_depth,
      node_count: nodes.length,
      edge_count: edges.length,
      nodes,
      edges
    });
    return true;
  }

  // GET RUNTIME GRAPH BY OBJECT
  if (req.method === "GET" && path.startsWith("/runtime/graph/")) {
    const auth = requireRole(req, [
      "runtime_admin",
      "auditor"
    ]);

    if (!auth.allowed) {
      send(res, auth.code, auth.response);
      return true;
    }

    const object_id = decodeURIComponent(
      path.replace("/runtime/graph/", "")
    );

    if (!object_id) {
      send(res, 400, {
        error: "missing_object_id"
      });
      return true;
    }

    const relationsResult = await db.query(`
      SELECT *
      FROM runtime_relations
      WHERE tenant_id = $1
        AND (
          source_object_id = $2
          OR target_object_id = $2
        )
      ORDER BY created_at DESC
    `, [
      auth.user.tenant_id,
      object_id
    ]);

    const relations = relationsResult.rows;

    const nodeIds = new Set();
    nodeIds.add(object_id);

    for (const relation of relations) {
      nodeIds.add(relation.source_object_id);
      nodeIds.add(relation.target_object_id);
    }

    const nodesResult = await db.query(`
      SELECT *
      FROM runtime_objects
      WHERE tenant_id = $1
        AND object_id = ANY($2)
    `, [
      auth.user.tenant_id,
      Array.from(nodeIds)
    ]);

    const objectMap = new Map();

    for (const object of nodesResult.rows) {
      objectMap.set(object.object_id, object);
    }

    const nodes = Array.from(nodeIds).map(id => {
      const object = objectMap.get(id);

      return {
        object_id: id,
        object_type: object ? object.object_type : null,
        object_name: object ? object.object_name : null,
        exists_in_runtime_objects: !!object
      };
    });

    const edges = relations.map(relation => ({
      relation_id: relation.relation_id,
      from: relation.source_object_id,
      to: relation.target_object_id,
      relation_type: relation.relation_type,
      created_at: relation.created_at
    }));

    send(res, 200, {
      root: object_id,
      tenant_id: auth.user.tenant_id,
      node_count: nodes.length,
      edge_count: edges.length,
      nodes,
      edges
    });
    return true;
  }

  return false;
}

module.exports = {
  handleRelationsGraphRoute
};
