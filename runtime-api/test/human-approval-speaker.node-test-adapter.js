'use strict';

/**
 * RSOS HERMES node:test compatibility adapter.
 *
 * STATUS: DRAFT ONLY
 * MODE: SHADOW
 * TEST EXECUTION: NOT APPROVED BY THIS FILE
 * DEPENDENCY INSTALLATION: NOT REQUIRED
 * DATABASE ACCESS: FORBIDDEN
 * NETWORK ACCESS: FORBIDDEN
 *
 * Purpose:
 * Expose the Node.js built-in node:test describe/it functions as temporary
 * globals for the three approved HERMES test files. No application module,
 * route, migration, database or network service is started here.
 */

const nodeTest = require('node:test');

if (
  typeof nodeTest.describe !== 'function' ||
  typeof nodeTest.it !== 'function'
) {
  throw new Error('NODE_TEST_DESCRIBE_IT_UNAVAILABLE');
}

Object.defineProperties(globalThis, {
  describe: {
    value: nodeTest.describe,
    writable: false,
    enumerable: false,
    configurable: true,
  },
  it: {
    value: nodeTest.it,
    writable: false,
    enumerable: false,
    configurable: true,
  },
});

const approvedTestFiles = Object.freeze([
  './human-approval-speaker.contract.test.js',
  './human-approval-speaker.security.test.js',
  './human-approval-speaker.audit.test.js',
]);

for (const testFile of approvedTestFiles) {
  require(testFile);
}

delete globalThis.describe;
delete globalThis.it;

module.exports = Object.freeze({
  approvedTestFiles,
  runtimeMode: 'SHADOW',
  dependencyInstallationRequired: false,
  databaseAccessAllowed: false,
  networkAccessAllowed: false,
  applicationStartupAllowed: false,
  routeRegistrationAllowed: false,
  workflowMutationAllowed: false,
});
