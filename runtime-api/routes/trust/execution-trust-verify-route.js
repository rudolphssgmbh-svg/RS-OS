const { verifyExecutionTrust } = require("../../modules/trust/execution-trust-service");

async function handleExecutionTrustVerifyRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method !== "GET" || path !== "/runtime/execution/verify") {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const trustResult = await verifyExecutionTrust({
    db,
    tenantId: auth.user.tenant_id
  });

  return send(res, 200, trustResult);
}

module.exports = { handleExecutionTrustVerifyRoute };
