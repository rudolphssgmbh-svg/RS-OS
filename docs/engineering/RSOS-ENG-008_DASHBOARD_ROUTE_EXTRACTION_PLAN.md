# RSOS-ENG-008 Dashboard Route Extraction Plan

Status: Draft
Datum: 2026-07-02
Sprint: Engineering Sprint 002
Scope: Extraction plan only
Runtime changes: none

## 1. Purpose

This document defines the extraction plan for dashboard route handlers.

It does not authorize implementation.

## 2. Verified Dashboard Routes

The following dashboard routes were identified in runtime-api/server.js:

- GET /runtime/admin/dashboard
- GET /runtime/dashboard/tenants
- GET /runtime/dashboard/tenants/:tenant_id
- GET /runtime/dashboard/management
- GET /runtime/dashboard

Related but excluded for this first dashboard extraction scope:

- GET /runtime/incidents/dashboard
- GET /runtime/learning/dashboard
- GET /runtime/learning/runtime-dashboard
- GET /runtime/defense/dashboard

These excluded routes belong to their own domain families.

## 3. Read-Only Verification

The included dashboard routes are read-only.

Verified properties:

- no INSERT
- no UPDATE
- no DELETE
- no writeEvent usage
- no schema change
- no worker interaction

## 4. Shared Dependencies

The dashboard handlers depend on:

- db
- send
- requireRole for protected routes
- path parsing for tenant detail route

## 5. Route-Specific Dependencies

### 5.1 GET /runtime/admin/dashboard

Authorization:

- system_admin
- global scope required

Tables:

- runtime_tenants
- runtime_tenant_members
- runtime_operator_credentials
- runtime_objects
- runtime_recommendations
- runtime_training_plans
- runtime_learning_evidence
- runtime_governance_decisions
- runtime_communication_events
- runtime_events

### 5.2 GET /runtime/dashboard/tenants

Authorization:

- currently no explicit requireRole observed in the isolated block

Tables:

- runtime_tenants
- runtime_tenant_domains
- runtime_tenant_members
- runtime_objects
- runtime_relations
- runtime_recommendations
- runtime_orchestrations
- runtime_training_plans
- runtime_learning_evidence
- runtime_governance_decisions
- runtime_communication_events

### 5.3 GET /runtime/dashboard/tenants/:tenant_id

Authorization:

- currently no explicit requireRole observed in the isolated block

Tables:

- runtime_tenants
- runtime_tenant_domains
- runtime_tenant_members
- runtime_objects
- runtime_relations
- runtime_recommendations
- runtime_orchestrations
- runtime_training_plans
- runtime_learning_evidence
- runtime_competencies
- runtime_governance_decisions
- runtime_communication_events
- runtime_communication_evidence

### 5.4 GET /runtime/dashboard/management

Authorization:

- currently no explicit requireRole observed in the isolated block

Tables:

- runtime_tenants
- runtime_tenant_members
- runtime_tenant_domains
- runtime_objects
- runtime_relations
- runtime_recommendations
- runtime_orchestrations
- runtime_training_plans
- runtime_learning_evidence
- runtime_competencies
- runtime_governance_decisions
- runtime_communication_events
- runtime_events

### 5.5 GET /runtime/dashboard

Authorization:

- runtime_admin
- auditor

Tables:

- runtime_objects
- runtime_events

## 6. Proposed Target Structure

Future extraction target:

runtime-api/routes/dashboard/

Proposed files:

- admin-dashboard-route.js
- tenant-dashboard-list-route.js
- tenant-dashboard-detail-route.js
- management-dashboard-route.js
- runtime-dashboard-route.js

Optional later aggregator:

- dashboard-routes.js

No aggregator is required for the first extraction unless route wiring becomes repetitive.

## 7. Extraction Rules

Any future extraction must preserve:

- exact HTTP paths
- exact methods
- exact authorization behavior
- exact response fields
- exact error codes
- exact error messages
- exact SQL behavior
- existing risk_count placeholder behavior
- existing generated_at/timestamp behavior
- existing use of send versus direct res.writeHead where present

Important:

GET /runtime/dashboard/tenants currently uses direct res.writeHead/res.end instead of send. A future extraction must preserve that response shape unless a separate behavior-change decision is approved.

## 8. Verification Protocol

Before extraction:

1. Capture current HEAD.
2. Capture /health.
3. Capture route responses for each dashboard route where credentials are available.
4. Capture status codes for unauthorized access where applicable.
5. Capture git diff baseline.

After extraction:

1. Re-run /health.
2. Re-run each dashboard route.
3. Compare status codes.
4. Compare JSON top-level keys.
5. Compare authorization behavior.
6. Confirm no writeEvent calls were added.
7. Confirm no non-dashboard files were modified except minimal server.js wiring.
8. Confirm git diff contains only intended extraction files.

## 9. Risk Assessment

Low risk:

- read-only operations
- no event writes
- no database mutation
- clear dashboard route cluster

Medium risk:

- several dashboard routes currently lack explicit authorization in the isolated blocks
- one route uses direct response handling instead of send
- tenant detail dashboard performs many queries and has a larger response shape

High risk if changed:

- authorization behavior
- tenant scoping
- response format
- route ordering

## 10. Stop Conditions

Stop extraction immediately if:

- any dashboard response changes unexpectedly
- a dashboard route becomes protected or unprotected differently
- direct response behavior changes
- tenant dashboard list shape changes
- runtime health fails
- unrelated files appear in git diff

## 11. Conclusion

The dashboard route family is a valid first extraction candidate because the selected routes are read-only and do not interact with the audit/event chain.

Implementation is not authorized by this document.

