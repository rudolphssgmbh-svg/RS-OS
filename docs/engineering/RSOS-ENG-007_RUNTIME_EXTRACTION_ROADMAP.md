# RSOS-ENG-007 Runtime Extraction Roadmap

Status: Draft
Datum: 2026-07-02
Sprint: Engineering Sprint 002
Scope: Roadmap only
Runtime changes: none

## 1. Purpose

This document defines the roadmap for future runtime extraction work.

It is based on:

- RSOS-ENG-001 Runtime Route Classification
- RSOS-ENG-002 Defense Route Family Analysis
- RSOS-ENG-003 Defense Ingress Detail Analysis
- RSOS-ENG-004 Defense Pipeline Analysis
- RSOS-ENG-005 Runtime Dependency Map
- RSOS-ENG-006 Runtime Modularization Strategy

No code change is authorized by this roadmap.

## 2. Extraction Principle

Extraction must proceed only when the target boundary is:

- already visible in the repository
- supported by route or SQL evidence
- small enough to verify
- reversible
- behavior-preserving

No extraction may be justified by desired architecture alone.

## 3. General Extraction Sequence

Every future extraction must follow this sequence:

1. Locate current route block or function in server.js.
2. Document all dependencies.
3. Document all database tables.
4. Document all writeEvent calls.
5. Document all authorization roles.
6. Create target module.
7. Wire target module without behavior change.
8. Run route-level verification.
9. Run runtime health verification.
10. Commit only the verified change.

## 4. Global Preservation Rules

Every extraction must preserve:

- HTTP method
- path
- query parameter behavior
- request body format
- response format
- status codes
- tenant scoping
- authorization roles
- database reads
- database writes
- audit/event writes
- worker behavior
- error behavior

## 5. Phase 0: No-Change Baseline

Before any implementation extraction, capture:

- current git HEAD
- current branch
- current route inventory
- current module inventory
- current runtime health
- current relevant endpoint response

This phase produces no runtime change.

## 6. Phase 1: Read-Only Low-Risk Extractions

Priority candidates:

- dashboard read routes
- metrics read routes
- list endpoints
- trace/path read endpoints

Reason:

- read-only routes have lower mutation risk
- they usually do not call writeEvent
- they are easier to compare before and after extraction

Verification:

- GET endpoint before/after comparison
- auth role check
- tenant scoping check
- no database mutation

## 7. Phase 2: Existing Pattern Reinforcement

Priority candidates:

- routes already similar to extracted route modules
- simple object/event read handlers
- simple admin list handlers

Reason:

- existing route modules provide a proven local pattern
- parameter injection is already used
- route behavior can be preserved with low coupling

Verification:

- route response comparison
- module require map
- no new dependency cycles

## 8. Phase 3: Trace Consolidation

Trace is already the cleanest modular area.

Allowed future work:

- keep full-trace route as route layer
- keep trace-composer as composition layer
- keep trace providers as table-oriented read layer
- avoid mixing write behavior into trace providers

Potential future target:

- remove duplicate direct trace provider usage from server.js only after verifying full-trace route coverage

Verification:

- full trace endpoint comparison
- provider table mapping check
- no response shape change

## 9. Phase 4: Tenant/Admin Route Extraction

Candidate tables:

- runtime_tenants
- runtime_tenant_domains
- runtime_tenant_members
- runtime_tenant_settings
- runtime_operator_credentials

Reason:

- clear SQL cluster
- strong administrative boundary
- high importance but manageable domain shape

Risks:

- credential handling
- system_admin authorization
- tenant scoping
- dashboard dependencies

Verification:

- tenant list
- tenant detail
- admin dashboard
- member creation path if included
- credential creation path if included

## 10. Phase 5: Learning and Competence Extraction

Candidate tables:

- runtime_training_plans
- runtime_learning_evidence
- runtime_learning_states
- runtime_learning_recommendations
- runtime_competencies
- runtime_competence_states
- runtime_competence_gaps
- runtime_assessments
- runtime_assessment_attempts

Reason:

- clear learning domain
- partially read-oriented
- can be separated after tenant/admin stability

Risks:

- recommendation dependencies
- competence gap generation
- assessment state changes

Verification:

- learning dashboard
- training plan routes
- competence gap routes
- assessment routes

## 11. Phase 6: Recommendation Extraction

Candidate tables:

- runtime_recommendations
- runtime_recommendation_rules
- runtime_recommendation_verification_gates
- runtime_execution_jobs
- runtime_training_plans
- runtime_competencies

Reason:

- recommendations are central and highly reused
- extraction must wait until read-only and learning boundaries are stable

Risks:

- gate enforcement
- execution job creation
- training plan side effects
- confidence and verification coupling

Verification:

- recommendation generate
- recommendation verify
- gate latest/history
- execute
- approve
- trace

## 12. Phase 7: Incident and Recovery Extraction

Candidate tables:

- runtime_incidents
- runtime_incident_links
- runtime_incident_lessons
- runtime_recovery_requests
- runtime_recovery_verifications
- runtime_risks

Reason:

- clear incident lifecycle
- tightly connected to governance and recovery

Risks:

- status transition rules
- closure guards
- residual risk handling
- governance completeness

Verification:

- incident create
- link
- status update
- lessons
- governance completeness
- residual risk
- summary/dashboard

## 13. Phase 8: Defense and Recovery Extraction

Candidate tables:

- runtime_ingress_events
- runtime_shadow_validations
- runtime_quarantine_queue
- runtime_defense_state
- runtime_savepoints
- runtime_recovery_requests
- runtime_recovery_verifications
- runtime_defense_metrics
- runtime_audit_reports

Reason:

- defense is mission-critical
- already analyzed in RSOS-ENG-002 to RSOS-ENG-004
- should be extracted only after lower-risk route families are proven

Risks:

- quarantine state changes
- rollback object creation
- recovery execution
- defense metrics correctness
- audit report generation

Verification:

- ingress
- shadow validation
- quarantine review/approve/reject
- savepoint create/list/rollback
- recovery request/review/approve/reject/execute
- recovery verification close
- defense metrics
- defense dashboard
- defense state

## 14. Phase 9: Workflow and Worker Extraction

Candidate tables:

- runtime_execution_jobs
- runtime_workflow_instances
- runtime_workflow_dependencies
- runtime_orchestrations

Reason:

- worker behavior affects execution pipeline
- worker clients are external HTTP callers

Risks:

- job state transitions
- retry behavior
- orchestration completion
- dead-letter handling
- schedule behavior

Verification:

- /runtime/worker/run
- /runtime/schedule
- /runtime/dead-letter
- workflow state transitions
- worker client compatibility

## 15. Phase 10: RSOS-060 Verification Module Split

Target:

- modules/rsos060/verifications-routes.js

Reason:

- second-largest current module
- already separate from server.js
- likely contains multiple responsibilities

Required before split:

- dedicated route inventory
- dependency map
- table map
- event map
- response map

No split is allowed before dedicated analysis.

## 16. Rollback Rule

Every implementation extraction must be reversible through:

- git checkout of the changed files
- route-level verification before and after rollback
- no schema dependency on extraction

No extraction may require irreversible database migration.

## 17. Commit Rule

Each extraction commit must include only:

- the new module file or files
- the minimal server.js wiring change
- optional documentation update
- no unrelated cleanup

## 18. Stop Conditions

Stop immediately if:

- endpoint response changes unexpectedly
- authorization behavior changes
- tenant scoping changes
- audit event generation changes
- database writes differ
- runtime health fails
- worker loop fails
- route ordering changes behavior

## 19. Roadmap Conclusion

The first implementation work should not target the hardest domains.

The safest path is:

1. read-only route extraction
2. existing route pattern reinforcement
3. trace consolidation
4. tenant/admin
5. learning/competence
6. recommendations
7. incident/recovery
8. defense/recovery
9. workflow/worker
10. RSOS-060 verification split after dedicated analysis

This roadmap preserves the principle that the runtime must be understood, planned, and verified before it is changed.

