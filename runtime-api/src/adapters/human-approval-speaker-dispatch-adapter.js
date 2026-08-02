'use strict';
const { readHermesShadowRuntimeConfig } = require('../config/hermes-shadow-runtime-config');
const ADAPTER_REASON_CODES = Object.freeze({
  SHADOW_RUNTIME_DISABLED: 'SHADOW_RUNTIME_DISABLED',
  KILL_SWITCH_BLOCKED: 'KILL_SWITCH_BLOCKED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TENANT_MISSING: 'TENANT_MISSING',
  ROLE_UNAUTHORIZED: 'ROLE_UNAUTHORIZED',
  BODY_INVALID: 'BODY_INVALID',
  OPERATION_UNSUPPORTED: 'OPERATION_UNSUPPORTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NO_CONTINUATION: 'NO_CONTINUATION',
});
const ALLOWED_ROLES = new Set(['runtime_admin', 'governance', 'auditor', 'system_admin']);
function blocked(send, res, status, reasonCode) {
  return send(res, status, { outcome: 'blocked', runtimeMode: 'SHADOW', allowedToContinueWorkflow: false, reasonCodes: [reasonCode, ADAPTER_REASON_CODES.NO_CONTINUATION] });
}
async function handleHumanApprovalSpeakerShadowRoute({ req, res, path, verifyToken, readBody, send, createService, env = process.env }) {
  if (req.method !== 'POST' || path !== '/runtime/hermes/approval-speaker/shadow') return false;
  const config = readHermesShadowRuntimeConfig(env);
  if (!config.enabled) return blocked(send, res, 404, ADAPTER_REASON_CODES.SHADOW_RUNTIME_DISABLED);
  if (config.killSwitchBlocked) return blocked(send, res, 503, ADAPTER_REASON_CODES.KILL_SWITCH_BLOCKED);
  const authUser = verifyToken(req);
  if (!authUser) return blocked(send, res, 401, ADAPTER_REASON_CODES.UNAUTHORIZED);
  const tenantId = authUser.tenant_id || null;
  if (!tenantId) return blocked(send, res, 400, ADAPTER_REASON_CODES.TENANT_MISSING);
  const roles = [authUser.role, authUser.system_role].filter(Boolean);
  if (!roles.some((role) => ALLOWED_ROLES.has(role))) return blocked(send, res, 403, ADAPTER_REASON_CODES.ROLE_UNAUTHORIZED);
  let body;
  try { body = await readBody(req); } catch { return blocked(send, res, 400, ADAPTER_REASON_CODES.BODY_INVALID); }
  if (!body || typeof body !== 'object') return blocked(send, res, 400, ADAPTER_REASON_CODES.BODY_INVALID);
  const context = {
    tenantId,
    authenticatedIdentity: { id: authUser.operator_id || authUser.user_id || authUser.sub || null, verified: true },
    authorizedHumanRoles: roles,
  };
  try {
    const service = createService();
    let result;
    if (body.operation === 'list') result = await service.listPendingApprovals({ ...context, limit: body.limit });
    else if (body.operation === 'present') result = await service.getApprovalForPresentation({ ...context, approvalRequestId: body.approvalRequestId, presentedScopeHash: body.presentedScopeHash, auditPathAvailable: body.auditPathAvailable === true });
    else if (body.operation === 'capture') result = await service.captureInteraction({ ...body, ...context });
    else return blocked(send, res, 400, ADAPTER_REASON_CODES.OPERATION_UNSUPPORTED);
    return send(res, 200, { ...result, runtimeMode: 'SHADOW', allowedToContinueWorkflow: false });
  } catch { return blocked(send, res, 500, ADAPTER_REASON_CODES.INTERNAL_ERROR); }
}
module.exports = { ADAPTER_REASON_CODES, ALLOWED_ROLES, handleHumanApprovalSpeakerShadowRoute };
