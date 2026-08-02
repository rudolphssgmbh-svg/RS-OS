# RSOS-AI-013 — HERMES Shadow Runtime Integration Seal

## Document control

| Field | Value |
|---|---|
| Document ID | RSOS-AI-013 |
| Sprint | RSOS-HERMES-002-SHADOW-RUNTIME-INTEGRATION-DISCOVERY |
| State | IMPLEMENTED_AND_TESTED_IN_DEFAULT_OFF_SHADOW_MODE |
| Runtime mode | SHADOW |
| Operational state | NOT ACTIVATED |
| Repository adapters | NOT BOUND — FAIL CLOSED |
| Database execution | NOT PERFORMED |
| Application startup | NOT PERFORMED |
| Production use | NOT APPROVED |

## Sealed scope

| Path | SHA-256 |
|---|---|
| `docs/architecture/RSOS-AI-012-hermes-shadow-runtime-integration-plan.md` | `5557d6b12457a120f467a26a210060453af65dbf9c8cd213f0716de4fd6adb21` |
| `runtime-api/server.js` | `7c003efde5338231847976911b45fbc350f9cfd7140e62424426b0423b2057c8` |
| `runtime-api/src/config/hermes-shadow-runtime-config.js` | `991f4e66349c1762fa953807413f94d8327bba2a12d65dfcb05a08f97b2d5e29` |
| `runtime-api/src/adapters/human-approval-speaker-dispatch-adapter.js` | `dd84f99ec4c8888e8b3b2ffe7597697ff7bdf45781a9802d93d5d01aa48c59f2` |
| `runtime-api/src/services/human-approval-speaker-dependency-factory.js` | `5f3d8fbfd84ffce4c8bca4aea8a0d84160f3c413b1884fd6bea541af07032ff9` |
| `runtime-api/test/human-approval-speaker.integration.test.js` | `73b175a51f98007b3ab2dbf2c2b06be4b84e3b601b501a4516a8edf59363b03c` |

## Verified controls

- HERMES uses the existing manual HTTP dispatch model.
- The endpoint is limited to `POST /runtime/hermes/approval-speaker/shadow`.
- The feature flag defaults to disabled.
- The independent kill switch defaults to block.
- Authentication is mandatory.
- Tenant context is mandatory.
- Authorized human role is mandatory.
- Repository adapters are not bound and therefore fail closed.
- Runtime mode remains `SHADOW`.
- `allowedToContinueWorkflow` remains `false`.
- HERMES has no workflow continuation authority.
- HERMES has no approval authority.
- HERMES has no execution authority.
- Voice activation is not approved.
- Human pilot is not approved.
- Production use is not approved.

## Test evidence

The isolated integration test completed with:

- tests: 9;
- passed: 9;
- failed: 0;
- exit code: 0.

Evidence manifest:

`14ffbdc76a5b8d5e1bfce02dd7fc9a79c262063902e8a89325d99dc4c526347b`

## Seal meaning

This seal confirms package identity, static review and isolated test evidence.

The seal does not authorize:

- database migration execution;
- repository adapter binding;
- runtime activation;
- application startup with HERMES enabled;
- workflow continuation;
- approval authority;
- execution authority;
- voice activation;
- human pilot;
- production use.

## Decision

`SEALED_FOR_LOCAL_GIT_COMMIT_IN_DEFAULT_OFF_SHADOW_MODE`
