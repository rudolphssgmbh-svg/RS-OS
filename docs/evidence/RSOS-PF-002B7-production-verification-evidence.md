# RSOS-PF-002B7 — Production Verification Evidence

## 1. Document Identity

Document-ID: RSOS-PF-002B7
Document-Type: Production Verification Evidence
Status: EVIDENCE_FREEZE_DRAFT
Parent: RSOS-PF-002B
Created-At-UTC: 2026-08-16T09:52:28Z
Repository-Commit: 3284a9f84ec3d670583a7bce4b179b24a1a28bc7
Branch: feature/RSOS-DS-001-signage-foundation

## 2. Purpose

This document freezes the verified production state of the
RSOS-PF-002B tenant-isolation correction and associated runtime
packaging correction.

It records verification evidence only.

It does not grant new runtime authority, autonomous authority,
database authority or additional production authority.

## 3. Verified Deployment Identity

PF002B_DEPLOYED_HEAD = 3284a9f84ec3d670583a7bce4b179b24a1a28bc7

PF002B_PRODUCTION_IMAGE_ID = sha256:3fba591a22ac852a92c7dfef30b815243aa86c9341d82debe4a66b662a2be16e

PF002B_ROLLBACK_IMAGE_ID = sha256:705bf5b4485f9497c263762b117c8eaae562484d3854276dbc0c887c44d9a656

PF002B_PRODUCTION_CONTAINER = rsos-runtime-api

PF002B_PRODUCTION_NETWORK = rsos_default

PF002B_PRODUCTION_PORT = 127.0.0.1:8080

## 4. Production Health

Production health response:

```json
{"timestamp":"2026-08-16T09:52:28.009Z","status":"ok","runtime":"healthy","database":"connected"}
```

PF002B_PRODUCTION_HEALTH = PASS
PF002B_PRODUCTION_RUNTIME = PASS
PF002B_PRODUCTION_DATABASE = PASS

## 5. Tenant Isolation Verification

PRODUCTION_UNSAFE_PATTERN_COUNT = 0

PRODUCTION_GLOBAL_SCOPE_GUARDS = 8

PF002B_TENANT_DEFAULT = PASS
PF002B_FOREIGN_TENANT_OVERRIDE_BLOCKED = PASS
PF002B_GLOBAL_OVERRIDE_ALLOWED = PASS

PF002B_PRODUCTION_TENANT_SECURITY = PASS

## 6. Packaging Verification

The production image contains the required runtime src dependencies,
including:

- /app/src/adapters/human-approval-speaker-dispatch-adapter.js
- /app/src/services/human-approval-speaker-dependency-factory.js

PF002B_PRODUCTION_PACKAGING = PASS

## 7. Verification Chain

The following verification chain was completed:

- static code verification;
- authority-model verification;
- 24-case isolated tenant regression test;
- committed tenant-isolation fix;
- isolated image build;
- packaging dependency analysis;
- Dockerfile src packaging correction;
- .dockerignore src allowlist correction;
- ephemerally started runtime;
- health and database verification;
- production preflight verification;
- controlled production deployment;
- post-deployment image identity verification;
- production tenant-security verification;
- rollback-anchor verification.

PF002B_VERIFICATION_CHAIN = PASS

## 8. Deployment Incident and Recovery Evidence

The first production deployment attempt was aborted before target startup
because the protected runtime environment file could not be read by the
non-root Docker CLI process.

The previous production container was restored successfully.

The second deployment introduced a mandatory credential and runtime
preflight before production shutdown and completed successfully.

PF002B_FIRST_DEPLOYMENT_ATTEMPT = ABORTED
PF002B_FIRST_ROLLBACK = PASS
PF002B_SECOND_DEPLOYMENT_ATTEMPT = PASS

Lesson learned:

Credential access and full target-runtime preflight MUST complete before
the active production runtime is stopped.

## 9. Rollback State

The previous production container remains retained as:

rsos-runtime-api-pre-pf002b

The previous production image remains addressable as:

rsos-runtime-api:rollback-pf002b

PF002B_ROLLBACK_READY = PASS

OLD_CONTAINER_DELETION = HOLD
ROLLBACK_IMAGE_DELETION = HOLD

## 10. Known Unknown

The historical provenance of the DB_PASSWORD value currently present in
the production container was not established during PF-002B.

The value itself was not output, copied to a file or modified.

DB_PASSWORD_PROVENANCE = UNKNOWN

This unknown does not invalidate the verified production deployment,
but should be resolved separately in a credential-provenance review.

## 11. Production Result

PF002B_PRODUCTION_VERIFIED = YES
PF002B_DEPLOYMENT = PASS
PF002B_PRODUCTION_HEALTH = PASS
PF002B_PRODUCTION_DATABASE = PASS
PF002B_PRODUCTION_SECURITY = PASS
PF002B_PRODUCTION_PACKAGING = PASS
PF002B_ROLLBACK_READY = PASS

HUMAN_ACCEPTANCE = YES

## 12. Non-Grant Clause

This evidence does not grant:

- unrestricted execution authority;
- autonomous business authority;
- new database authority;
- new tenant authority;
- new governance authority;
- deletion authority for rollback assets.

RUNTIME_CHANGE = ALREADY_DEPLOYED_AND_VERIFIED
DATABASE_SCHEMA_CHANGE = NONE_VERIFIED
SECRET_CHANGE = NO
ROLLBACK_DELETION = NO
