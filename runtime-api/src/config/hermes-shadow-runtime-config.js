'use strict';
const ENABLED_VALUE = 'true';
const KILL_SWITCH_BLOCK_VALUE = 'block';
function readHermesShadowRuntimeConfig(env = process.env) {
  const enabled = String(env.HERMES_SHADOW_RUNTIME_ENABLED || '').trim().toLowerCase() === ENABLED_VALUE;
  const killSwitchValue = String(env.HERMES_SHADOW_KILL_SWITCH || KILL_SWITCH_BLOCK_VALUE).trim().toLowerCase();
  return Object.freeze({
    enabled,
    killSwitchBlocked: killSwitchValue !== 'allow',
    runtimeMode: 'SHADOW',
    allowedToContinueWorkflow: false,
  });
}
module.exports = { ENABLED_VALUE, KILL_SWITCH_BLOCK_VALUE, readHermesShadowRuntimeConfig };
