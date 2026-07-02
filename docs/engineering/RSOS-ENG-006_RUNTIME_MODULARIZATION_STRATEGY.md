# RSOS-ENG-006 Runtime Modularization Strategy

Status: Draft
Datum: 2026-07-02
Sprint: Engineering Sprint 002
Scope: Strategy only
Runtime changes: none

## 1. Purpose

This document defines a modularization strategy for the RSOS Runtime API based only on verified repository findings.

It follows from:

- RSOS-ENG-001 Runtime Route Classification
- RSOS-ENG-002 Defense Route Family Analysis
- RSOS-ENG-003 Defense Ingress Detail Analysis
- RSOS-ENG-004 Defense Pipeline Analysis
- RSOS-ENG-005 Runtime Dependency Map

No implementation is authorized by this document.

## 2. Current Reality

The current runtime is centered around:

- runtime-api/server.js

Verified size:

- 17990 lines
- 490885 bytes

The current runtime already contains extracted modules for:

- bootstrap
- ingress
- response
- verification
- evidence/audit-hash
- routes
- trace composer
- trace providers
- RSOS-060 route modules
- external worker clients

## 3. Strategic Goal

The goal is not to rewrite the runtime.

The goal is to reduce risk by separating already visible responsibilities into stable module boundaries, while preserving runtime behavior.

## 4. Non-Goals

This strategy does not allow:

- functional behavior changes
- route changes
- database schema changes
- endpoint renaming
- response shape changes
- authorization changes
- worker behavior changes
- unverified abstractions

## 5. Existing Stable Boundaries

The following boundaries are already supported by current files and exports:

### Infrastructure

- bootstrap/database.js
- bootstrap/init-db.js
- ingress/body.js
- response/send.js
- verification/auth.js
- evidence/audit-hash.js

### Basic Route Modules

- routes/health/health-route.js
- routes/auth/login-route.js
- routes/events/runtime-events-route.js
- routes/events/audit-chain-route.js
- routes/objects/create-object-route.js
- routes/objects/list-objects-route.js
- routes/trace/full-trace-route.js

### Trace

- trace/trace-composer.js
- trace/providers/*

### RSOS-060

- modules/rsos060/sources-routes.js
- modules/rsos060/evidence-routes.js
- modules/rsos060/witness-observations-routes.js
- modules/rsos060/assumptions-hypotheses-routes.js
- modules/rsos060/verifications-routes.js

### Worker Clients

- autonomous-worker.js
- worker-loop.js

## 6. Dependency Rules

### 6.1 Infrastructure Rules

Infrastructure helpers should remain small and side-effect limited.

Allowed:

- response/send may depend on HTTP response object
- ingress/body may depend on request stream
- verification/auth may depend on jsonwebtoken
- bootstrap/database may depend on pg
- evidence/audit-hash may depend on crypto

Not allowed without separate design:

- infrastructure helpers depending on domain logic
- response helper depending on database
- ingress helper performing domain validation
- auth helper performing unrelated business logic

### 6.2 Route Rules

Route modules may coordinate:

- auth
- input parsing
- service/provider calls
- response output

Route modules should not become large domain services.

### 6.3 Provider Rules

Providers are read-oriented or table-oriented access components.

Trace providers currently show the cleanest pattern:

- accept db
- accept tenant_id / object_id
- query one domain table or small table group
- return result

### 6.4 Service Rules

Future service modules should hold domain behavior that is currently inline in server.js.

Services may use:

- db
- writeEvent
- domain-specific helpers

Services should not directly own HTTP response formatting.

### 6.5 Composition Rules

Composition modules may aggregate providers and service results.

They should not directly implement unrelated SQL if a provider boundary exists.

## 7. Preliminary Target Layers

The modular runtime should evolve toward:

HTTP Server
-> Dispatcher
-> Route Modules
-> Domain Services
-> Providers
-> Infrastructure
-> PostgreSQL

The existing trace stack already follows a compatible structure:

Trace Route
-> Trace Composer
-> Trace Providers
-> PostgreSQL

## 8. Extraction Priority

### Priority 1: Preserve and strengthen existing extracted modules

- keep infrastructure helpers stable
- keep trace providers stable
- keep basic route modules stable
- avoid changing their behavior

### Priority 2: Extract low-risk read-only route families

Candidate categories:

- dashboards
- list endpoints
- metrics endpoints
- read-only trace/path endpoints

Reason:

- read-only operations usually have lower state mutation risk

### Priority 3: Extract domain route families with clear SQL clusters

Candidate categories:

- tenant/admin
- learning/competence
- recommendations read/gate read
- incident read endpoints

### Priority 4: Extract write-heavy domains only after read boundaries are stable

Candidate categories:

- defense/recovery
- incident status changes
- recommendations execute/approve
- workflow/worker execution
- governance approvals

Reason:

- these areas mutate state
- these areas call writeEvent
- these areas may affect audit, governance, execution, or recovery chains

### Priority 5: Split large RSOS-060 verification route only after separate analysis

The file:

- modules/rsos060/verifications-routes.js

is the second-largest current module.

It requires a dedicated dependency and route-level analysis before any extraction.

## 9. Current High-Risk Coupling Points

Verified high-coupling functions:

- db.query
- send
- writeEvent
- requireRole
- readBody
- verifyToken

Verified high-coupling file:

- server.js

Known special cases:

- inline crypto usage still exists inside server.js
- worker-loop.js contains fixed login credentials
- autonomous-worker.js generates JWT directly
- verifyOperatorSignature currently returns true

These findings are documentation targets, not immediate change instructions.

## 10. Safe Refactoring Principle

Any future refactoring must preserve:

- endpoint paths
- HTTP methods
- authorization roles
- request formats
- response formats
- audit event behavior
- tenant scoping
- database writes
- worker behavior
- error behavior

Each extraction must be verified before continuing.

## 11. Proposed Future Work Sequence

1. RSOS-ENG-006 Runtime Modularization Strategy
2. RSOS-ENG-007 Runtime Refactoring Plan
3. RSOS-ENG-008 Read-Only Route Extraction Plan
4. RSOS-ENG-009 Verification Protocol for Runtime Extraction
5. Implementation only after approved design

## 12. Strategic Conclusion

The runtime is not an unstructured system.

It is a partially modularized runtime with a dominant server.js dispatcher and several already stable boundaries.

The safest engineering path is incremental extraction based on verified boundaries, starting with read-only and already modular patterns before touching write-heavy or governance-sensitive domains.

