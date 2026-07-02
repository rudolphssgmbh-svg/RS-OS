# RSOS-ENG-005 Runtime Dependency Map

Status: Draft
Datum: 2026-07-02
Sprint: Engineering Sprint 002
Scope: Analyse only
Runtime changes: none

## 1. Purpose

This document records the verified dependency structure of the current RSOS Runtime API.

The analysis follows the active engineering sequence:

Reality
-> Inventory
-> Classification
-> Detail Analysis
-> Dependency Analysis
-> Design
-> Implementation
-> Verification

No implementation decision is derived from hypothetical structures.

## 2. Verified Runtime Entry Point

The active runtime entry point is:

- runtime-api/server.js

The package definition confirms:

- main: server.js

The current runtime is primarily centered around server.js.

## 3. Top-Level Dependencies

server.js imports the following verified components:

### Node.js core

- crypto
- fs
- http

### External packages

- jsonwebtoken
- pg via bootstrap/database.js

### Runtime infrastructure

- response/send
- ingress/body
- verification/auth
- bootstrap/database
- bootstrap/init-db
- evidence/audit-hash

### RSOS-060 modules

- modules/rsos060/sources-routes
- modules/rsos060/evidence-routes
- modules/rsos060/witness-observations-routes
- modules/rsos060/assumptions-hypotheses-routes
- modules/rsos060/verifications-routes

### Extracted route modules

- routes/health/health-route
- routes/auth/login-route
- routes/events/runtime-events-route
- routes/events/audit-chain-route
- routes/objects/list-objects-route
- routes/objects/create-object-route
- routes/trace/full-trace-route

### Trace providers

- trace/providers/object-provider
- trace/providers/relation-provider
- trace/providers/audit-provider
- trace/providers/governance-provider
- trace/providers/execution-provider
- trace/providers/recommendation-provider

## 4. Central Cross-Cutting Runtime Functions

Observed function usage in server.js:

- send: 591
- db.query: 410
- writeEvent: 133
- requireRole: 133
- readBody: 78
- verifyToken: 53
- createAuditHash: 4
- generateRecommendationsForObject: 3

These functions form the strongest verified dependency nodes.

## 5. Infrastructure Dependency Map

### 5.1 Response

response/send.js

Responsibilities:

- sets HTTP status
- sets JSON content type
- sets CORS headers
- adds timestamp
- serializes JSON response

Dependencies:

- none external
- no database
- no auth

### 5.2 Ingress Body

ingress/body.js

Responsibilities:

- reads request stream
- parses JSON body
- returns empty object for empty body

Dependencies:

- none external
- no database
- no auth

### 5.3 Auth

verification/auth.js

Responsibilities:

- generateToken
- verifyToken
- requireRole
- verifyOperatorSignature

Dependencies:

- jsonwebtoken
- JWT_SECRET environment variable or fallback

Important finding:

- verifyOperatorSignature currently returns true and is therefore a stub.

### 5.4 Audit Hash

evidence/audit-hash.js

Responsibilities:

- createAuditHash(payload)
- SHA-256 hash over JSON stringified payload

Dependencies:

- Node.js crypto

### 5.5 Database Bootstrap

bootstrap/database.js

Responsibilities:

- create pg.Pool

Dependencies:

- pg
- DB_HOST
- DB_USER
- DB_PASSWORD
- DB_NAME

### 5.6 Initial DB Bootstrap

bootstrap/init-db.js

Creates only the foundation tables:

- runtime_objects
- runtime_events
- runtime_execution_jobs

Finding:

The bootstrap layer initializes only the foundation core. The wider schema is provided by the migration layer.

## 6. Event / Audit Chain Dependency

writeEvent is defined inside server.js.

Verified flow:

writeEvent
-> SELECT latest audit_hash FROM runtime_events
-> createAuditHash
-> INSERT INTO runtime_events

Direct table dependency:

- runtime_events

Role:

- event logging
- audit chain continuation
- runtime traceability

## 7. Route Layer

Extracted route modules currently exist for:

- health
- auth
- events
- objects
- trace

### 7.1 health-route

Dependencies:

- send

Tables:

- none

### 7.2 auth/login-route

Dependencies:

- db.query
- readBody
- verifyOperatorSignature
- generateToken
- send

Tables:

- runtime_operator_credentials
- runtime_tenant_members

### 7.3 events/runtime-events-route

Dependencies:

- requireRole
- db.query
- send

Tables:

- runtime_events

### 7.4 events/audit-chain-route

Dependencies:

- requireRole
- db.query
- send

Tables:

- runtime_events

### 7.5 objects/create-object-route

Dependencies:

- requireRole
- readBody
- db.query
- writeEvent
- send

Tables:

- runtime_objects
- runtime_events via writeEvent

### 7.6 objects/list-objects-route

Dependencies:

- requireRole
- db.query
- send

Tables:

- runtime_objects

### 7.7 trace/full-trace-route

Dependencies:

- requireRole
- composeFullTrace
- send

Tables:

- indirect through trace-composer and trace providers

## 8. Trace Composition Layer

trace/trace-composer.js is a verified aggregation layer.

It calls:

- getTraceObject
- getTraceRelations
- getTraceRecommendations
- getTraceOrchestrations
- getTraceTrainingPlans
- getTraceLearningEvidence
- getTraceExecution
- getTraceGovernance
- getTraceRisks
- getTraceAudit

Finding:

The composer contains no direct SQL statements. It orchestrates providers.

## 9. Trace Provider Layer

Verified provider-to-table mapping:

- object-provider -> runtime_objects
- audit-provider -> runtime_events
- governance-provider -> runtime_governance_decisions
- execution-provider -> runtime_execution_jobs
- recommendation-provider -> runtime_recommendations
- relation-provider -> runtime_relations
- learning-provider -> runtime_training_plans, runtime_learning_evidence
- orchestration-provider -> runtime_orchestrations
- risk-provider -> runtime_risks

Finding:

The trace providers are a clean read layer. They depend on db.query and table-specific access.

## 10. SQL Domain Clusters in server.js

The current server.js remains broadly coupled to many runtime tables. The SQL references show the following real domain clusters.

### 10.1 Defense and Ingress

Tables:

- runtime_ingress_events
- runtime_shadow_validations
- runtime_quarantine_queue
- runtime_defense_state
- runtime_savepoints
- runtime_recovery_requests
- runtime_recovery_verifications
- runtime_defense_metrics
- runtime_audit_reports

### 10.2 Runtime Core

Tables:

- runtime_objects
- runtime_events
- runtime_actions
- runtime_execution_jobs

### 10.3 Governance

Tables:

- runtime_governance_decisions
- runtime_governance_approvals
- runtime_governance_checks
- runtime_governance_outcomes
- runtime_governance_policies

### 10.4 Incident and Recovery

Tables:

- runtime_incidents
- runtime_incident_links
- runtime_incident_lessons
- runtime_recovery_requests
- runtime_recovery_verifications
- runtime_risks

### 10.5 Knowledge and Verification

Tables:

- runtime_facts
- runtime_fact_sources
- runtime_fact_confidence
- runtime_fact_acceptance_rules
- runtime_verifications
- runtime_verification_cycles
- runtime_verification_checks
- runtime_verification_results
- runtime_unknowns
- runtime_unknown_dependencies
- runtime_sources
- runtime_source_quality
- runtime_source_conflicts
- runtime_evidence
- runtime_assumptions
- runtime_hypotheses

### 10.6 Learning and Competence

Tables:

- runtime_training_plans
- runtime_learning_evidence
- runtime_learning_states
- runtime_learning_recommendations
- runtime_competencies
- runtime_competence_states
- runtime_competence_gaps
- runtime_assessments
- runtime_assessment_attempts
- runtime_lessons_learned

### 10.7 Recommendations

Tables:

- runtime_recommendations
- runtime_recommendation_rules
- runtime_recommendation_verification_gates

### 10.8 Heuristics and Patterns

Tables:

- runtime_heuristics
- runtime_heuristic_triggers
- runtime_heuristic_feedback
- runtime_patterns
- runtime_pattern_matches
- runtime_pattern_feedback
- runtime_cross_loop_validations

### 10.9 Orchestration and Communication

Tables:

- runtime_orchestrations
- runtime_orchestration_rules
- runtime_communication_events
- runtime_communication_evidence

### 10.10 Tenant and Admin

Tables:

- runtime_tenants
- runtime_tenant_domains
- runtime_tenant_members
- runtime_tenant_settings
- runtime_operator_credentials

### 10.11 Workflow Engine

Tables:

- runtime_workflow_instances
- runtime_workflow_dependencies
- runtime_execution_jobs

## 11. Current Architectural Shape

Verified current shape:

HTTP Layer
-> server.js dispatcher
-> extracted route modules
-> infrastructure helpers
-> trace composer
-> trace providers
-> domain logic mostly inline in server.js
-> PostgreSQL

## 12. Key Engineering Findings

1. server.js is the main runtime monolith and the dominant dependency node.
2. Infrastructure helpers are already partially extracted.
3. Trace has the clearest verified multi-layer structure.
4. Trace providers are table-oriented and read-only.
5. RSOS-060 is partially modularized.
6. Domain boundaries are visible in SQL usage even where implementation remains inline.
7. writeEvent is a central audit/event dependency.
8. requireRole is the central authorization gate.
9. db.query is the main persistence coupling point.
10. No implementation change was performed during this analysis.

## 13. Preliminary Module Boundaries Derived from Reality

The following module boundaries are supported by verified repository evidence:

- Infrastructure
- Auth
- Ingress
- Response
- Audit/Event
- Trace
- RSOS-060 Evidence/Knowledge Foundation
- Defense/Recovery
- Governance
- Incident Management
- Knowledge/Verification
- Learning/Competence
- Recommendations
- Heuristics/Patterns
- Orchestration/Communication
- Tenant/Admin
- Workflow/Execution

These are not approved refactoring targets yet. They are dependency-derived analysis categories.

## 14. Restrictions

This document does not authorize:

- code movement
- route changes
- module extraction
- renaming
- runtime behavior changes
- database schema changes

Any implementation requires a separate design and verification step.

