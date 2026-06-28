const { composeFullTrace } = require("../../trace/trace-composer");

async function handleFullTraceRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (!(req.method === "GET" && path.startsWith("/runtime/trace/") && path.endsWith("/full"))) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor",
    "governance"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const tenant_id = auth.user.tenant_id;

  const object_id = decodeURIComponent(
    path
      .replace("/runtime/trace/", "")
      .replace("/full", "")
  );

  if (!object_id) {
    send(res, 400, {
      error: "missing_object_id"
    });
    return true;
  }

  const trace = await composeFullTrace({
    db,
    tenant_id,
    object_id
  });

  send(res, 200, trace);
  return true;
}

module.exports = {
  handleFullTraceRoute
};
