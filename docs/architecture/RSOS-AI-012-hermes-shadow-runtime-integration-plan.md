# RSOS-AI-012 — HERMES Shadow Runtime Integration Plan

## Document control

| Field | Value |
|---|---|
| Document ID | RSOS-AI-012 |
| Title | HERMES Shadow Runtime Integration Plan |
| Sprint | RSOS-HERMES-002-SHADOW-RUNTIME-INTEGRATION-DISCOVERY |
| Status | DRAFT — DOCUMENT ONLY |
| Authority | Architecture and integration planning only |
| Runtime mode | SHADOW |
| Operational state | NOT ACTIVATED |
| Source-code integration | NOT APPROVED |
| Database execution | NOT APPROVED |
| Route activation | NOT APPROVED |
| Human pilot | NOT APPROVED |
| Production use | NOT APPROVED |

## 1. Purpose

This document defines the bounded integration plan for the HERMES human
approval speaker foundation.

The plan does not activate HERMES and does not authorize any source-code,
database, route, workflow, voice, pilot or production change.

HERMES remains a shadow-only presentation and recording capability.

## 2. Confirmed architecture model

The confirmed runtime architecture model is:

`MANUAL_HTTP_DISPATCH`

The confirmed composition root is:

`runtime-api/server.js`

The runtime does not expose an approved Express router mount seam for HERMES.
Existing runtime behavior is composed through direct imports and direct
invocation of route-handler functions.

The approved reference handler pattern is:

`runtime-api/routes/evidence/evidence-governance-route.js`

The approved reference handler symbol is:

`handleEvidenceGovernanceRoute`

The approved authentication reference is:

`runtime-api/verification/auth.js`

## 3. HERMES package baseline

The existing HERMES shadow package consists of:

- `docs/architecture/RSOS-AI-010-human-approval-speaker-contract.md`
- `docs/architecture/RSOS-AI-011-hermes-shadow-package-seal.md`
- `runtime-api/migrations/109_human_approval_speaker_foundation.sql`
- `runtime-api/src/policies/human-approval-speaker-policy.js`
- `runtime-api/src/services/human-approval-speaker-service.js`
- `runtime-api/src/routes/human-approval-speaker-routes.js`
- `runtime-api/test/human-approval-speaker.contract.test.js`
- `runtime-api/test/human-approval-speaker.security.test.js`
- `runtime-api/test/human-approval-speaker.audit.test.js`
- `runtime-api/test/human-approval-speaker.node-test-adapter.js`

The package is implemented, tested, sealed, locally committed and remotely
published in shadow mode.

It is not operationally activated.

## 4. Integration boundary

The planned integration boundary is limited to a future reviewed insertion in
`runtime-api/server.js`.

The future insertion may only:

1. evaluate a default-off HERMES feature flag;
2. evaluate an independent kill switch;
3. match one explicit HTTP method and one explicit path family;
4. invoke existing authentication controls;
5. resolve tenant context;
6. verify authorized human role;
7. create bounded dependencies through explicit dependency injection;
8. invoke a manual HERMES handler;
9. capture a shadow interaction result;
10. return a fail-closed response.

The future insertion may not:

- continue a workflow;
- mutate a workflow state;
- approve on behalf of a human;
- execute an action;
- bypass authentication;
- bypass tenant isolation;
- infer approval from silence or timeout;
- register a voice interface;
- enable a human pilot;
- enable production use.

## 5. Exact dispatch model

The future HERMES integration must follow the existing manual-dispatch model.

A future implementation must identify and document:

- the exact branch in `runtime-api/server.js`;
- the exact HTTP method;
- the exact path predicate;
- the exact ordering relative to authentication;
- the exact ordering relative to tenant resolution;
- the exact response ownership contract;
- the exact handled or declined return convention;
- the exact exception behavior.

The HERMES handler must be invoked directly as a bounded function.

No parallel Express application or router stack may be introduced.

## 6. Authentication and authorization order

The mandatory order is:

1. request parsing;
2. authentication;
3. identity verification;
4. tenant resolution;
5. tenant isolation verification;
6. human role authorization;
7. request expiry and revocation checks;
8. scope-hash verification;
9. HERMES shadow policy evaluation;
10. shadow interaction recording;
11. fail-closed response.

Authentication must use the existing authoritative controls from:

`runtime-api/verification/auth.js`

No HERMES-specific identity system may be created.

## 7. Tenant isolation

Tenant context must be resolved before any HERMES service invocation.

The integration must reject:

- missing tenant context;
- ambiguous tenant context;
- cross-tenant access;
- tenant mismatch between request and approval object;
- tenant mismatch between identity and approval scope.

Tenant checks must default to deny.

## 8. Default-off feature flag

A future source implementation must define a single authoritative feature flag.

Required semantics:

- absent means disabled;
- empty means disabled;
- malformed means disabled;
- unknown value means disabled;
- only one explicit reviewed value may enable shadow handling;
- the flag must not enable migration execution;
- the flag must not enable route registration outside the manual dispatcher;
- the flag must not enable workflow continuation;
- the flag must not enable voice.

Suggested logical name:

`HERMES_SHADOW_RUNTIME_ENABLED`

The exact configuration source is not approved by this document.

## 9. Independent kill switch

A separate kill switch is mandatory.

Required semantics:

- kill switch denial overrides the feature flag;
- kill switch ambiguity disables HERMES;
- kill switch failure disables HERMES;
- the kill switch must be evaluated before dependency creation;
- the kill switch must be evaluated before any persistence attempt;
- disabling HERMES must not require database access;
- disabling HERMES must not require application restart where technically
  feasible.

Suggested logical name:

`HERMES_SHADOW_KILL_SWITCH`

The exact implementation is not approved by this document.

## 10. Dependency injection plan

The future handler must receive dependencies explicitly.

No global mutable state may be introduced.

Required dependency categories:

- approval request repository;
- approval interaction repository;
- audit adapter;
- clock;
- hash function;
- identity context;
- tenant context;
- request metadata;
- feature-flag state;
- kill-switch state.

Repository adapters must be selected in a separate discovery and review task.

This plan does not approve database connectivity.

## 11. Error and decline behavior

No authoritative central error-handler contract has yet been proven.

Therefore, the future HERMES integration must define local fail-closed behavior.

Mandatory outcomes:

- thrown authentication error: blocked;
- thrown tenant error: blocked;
- thrown policy error: blocked;
- thrown repository error: blocked;
- thrown audit error: blocked;
- handler decline: no continuation;
- missing handler result: blocked;
- malformed handler result: blocked;
- timeout: blocked;
- silence: blocked.

Responses must use stable reason codes and must not expose:

- stack traces;
- repository internals;
- credential details;
- sensitive identity details;
- internal file paths;
- raw database errors.

## 12. Response contract

The future response contract must distinguish:

- request not handled by HERMES;
- request blocked by HERMES;
- shadow interaction recorded;
- shadow interaction persistence failed;
- audit persistence failed;
- authentication failed;
- tenant validation failed;
- request expired;
- request revoked;
- scope changed;
- decision ambiguous;
- decision silent or timed out.

No response may indicate that a workflow was continued.

No response may indicate that HERMES approved or executed an action.

## 13. Audit and provenance

The future integration must preserve:

- request identifier;
- tenant identifier;
- verified identity reference;
- authorized role reference;
- approval request identifier;
- scope hash;
- transcript hash;
- interaction hash;
- previous interaction hash;
- audit event hash;
- reason code;
- timestamp;
- runtime mode;
- feature-flag state;
- kill-switch state.

Interaction records must remain append-only in intent.

The exact persistence adapter is not approved by this document.

## 14. Isolated integration-test plan

A future integration test foundation must use a manual request/response harness.

Required test classes:

- feature flag absent;
- feature flag disabled;
- kill switch active;
- unauthenticated request;
- unauthorized role;
- missing tenant;
- cross-tenant request;
- expired request;
- revoked request;
- changed scope hash;
- ambiguous decision;
- silence;
- timeout;
- successful shadow capture;
- interaction persistence failure;
- audit persistence failure;
- handler exception;
- malformed handler result;
- no workflow continuation;
- no route activation when disabled.

Tests must:

- use mocks;
- avoid database access;
- avoid network access;
- avoid application startup;
- avoid migration execution;
- avoid runtime activation;
- verify no unexpected writes.

## 15. Rollback and disable plan

The future integration must be reversible without losing evidence.

Minimum disable sequence:

1. activate the independent kill switch;
2. verify HERMES requests fail closed;
3. verify no new HERMES interactions are accepted;
4. preserve existing interaction and audit evidence;
5. disable the feature flag;
6. remove or bypass the manual dispatch invocation if separately approved;
7. verify application behavior without HERMES;
8. retain rollback evidence and hashes.

Rollback must not delete historical audit data.

## 16. Open integration gaps

| Gap ID | Category | Description | Required control |
|---|---|---|---|
| HERMES-GAP-001 | Error handling | No authoritative central error-handler contract was proven | Define fail-closed exception and decline behavior |
| HERMES-GAP-002 | Feature flag | No approved default-off runtime feature flag exists | Define immutable default-off configuration and validation |
| HERMES-GAP-003 | Kill switch | No independent HERMES kill switch exists | Define immediate disable path independent of route logic |
| HERMES-GAP-004 | Repository adapters | Runtime repository adapters are not yet selected | Map request, interaction and audit adapters without DB execution |
| HERMES-GAP-005 | Server dispatch | Exact `server.js` insertion branch is not yet specified | Document exact method/path predicate and invocation order |
| HERMES-GAP-006 | Integration test | Manual-dispatch integration tests do not yet exist | Define isolated request/response harness with mocks |
| HERMES-GAP-007 | Rollback | No reviewed disable and rollback runbook exists | Document disable, rollback and evidence capture |

All seven gaps remain open.

## 17. Required review sequence

The mandatory sequence after this document is:

1. integration-plan review;
2. exact server dispatch branch discovery;
3. feature-flag and kill-switch contract decision;
4. repository-adapter discovery;
5. error-contract decision;
6. isolated integration-test design;
7. bounded source-integration decision;
8. bounded source write;
9. source review;
10. isolated integration tests;
11. activation gate review.

No later step is implicitly approved by this plan.

## 18. Prohibited actions

This document does not authorize:

- modification of `runtime-api/server.js`;
- HERMES handler invocation;
- route registration;
- database connection;
- migration execution;
- application startup with HERMES;
- runtime activation;
- workflow continuation;
- approval authority;
- execution authority;
- voice activation;
- human pilot;
- production use;
- Git stage;
- Git commit;
- Git push.

## 19. Decision

The HERMES shadow runtime integration plan is documented for review.

State:

`PLANNED_NOT_IMPLEMENTED`

Runtime mode:

`SHADOW`

Operational state:

`NOT_ACTIVATED`
