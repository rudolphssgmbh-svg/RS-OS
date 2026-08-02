'use strict';
const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { readHermesShadowRuntimeConfig } = require('../src/config/hermes-shadow-runtime-config');
const { handleHumanApprovalSpeakerShadowRoute } = require('../src/adapters/human-approval-speaker-dispatch-adapter');
function send(res, statusCode, payload) { res.statusCode = statusCode; res.payload = payload; return true; }
function input(overrides = {}) {
  return {
    req: { method: 'POST', headers: {} }, res: { statusCode: null, payload: null },
    path: '/runtime/hermes/approval-speaker/shadow',
    verifyToken: () => ({ operator_id: 'op-1', tenant_id: 'tenant-1', role: 'runtime_admin' }),
    readBody: async () => ({ operation: 'list' }), send,
    createService: () => ({ listPendingApprovals: async () => ({ outcome: 'allowed_with_controls', approvals: [], runtimeMode: 'SHADOW', allowedToContinueWorkflow: false }) }),
    env: { HERMES_SHADOW_RUNTIME_ENABLED: 'true', HERMES_SHADOW_KILL_SWITCH: 'allow' },
    ...overrides,
  };
}
describe('HERMES shadow runtime integration', () => {
  it('defaults off and blocked', () => { const c = readHermesShadowRuntimeConfig({}); assert.equal(c.enabled, false); assert.equal(c.killSwitchBlocked, true); });
  it('declines unrelated paths', async () => { const x = input({ path: '/runtime/facts' }); assert.equal(await handleHumanApprovalSpeakerShadowRoute(x), false); });
  it('blocks disabled', async () => { const x = input({ env: {} }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 404); });
  it('blocks kill switch', async () => { const x = input({ env: { HERMES_SHADOW_RUNTIME_ENABLED: 'true', HERMES_SHADOW_KILL_SWITCH: 'block' } }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 503); });
  it('blocks unauthenticated', async () => { const x = input({ verifyToken: () => null }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 401); });
  it('blocks missing tenant', async () => { const x = input({ verifyToken: () => ({ operator_id: 'op-1', role: 'runtime_admin' }) }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 400); });
  it('blocks unauthorized roles', async () => { const x = input({ verifyToken: () => ({ operator_id: 'op-1', tenant_id: 'tenant-1', role: 'worker' }) }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 403); });
  it('returns shadow output without continuation', async () => { const x = input(); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 200); assert.equal(x.res.payload.allowedToContinueWorkflow, false); });
  it('fails closed on service error', async () => { const x = input({ createService: () => ({ listPendingApprovals: async () => { throw new Error('x'); } }) }); await handleHumanApprovalSpeakerShadowRoute(x); assert.equal(x.res.statusCode, 500); });
});
