# RSOS-ENG-009 Dashboard Extraction Verification Protocol

Status: Draft
Datum: 2026-07-02
Sprint: Engineering Sprint 002
Scope: Verification protocol only
Runtime changes: none

## 1. Purpose

This document defines the verification protocol required before and after any dashboard route extraction.

It follows from:

- RSOS-ENG-008 Dashboard Route Extraction Plan

No implementation is authorized by this document.

## 2. Verification Target Routes

The initial dashboard extraction verification scope includes:

- GET /runtime/admin/dashboard
- GET /runtime/dashboard/tenants
- GET /runtime/dashboard/tenants/:tenant_id
- GET /runtime/dashboard/management
- GET /runtime/dashboard

Excluded from this protocol:

- GET /runtime/incidents/dashboard
- GET /runtime/learning/dashboard
- GET /runtime/learning/runtime-dashboard
- GET /runtime/defense/dashboard

These belong to separate domain verification protocols.

## 3. Baseline Requirements

Before any extraction, capture:

- git HEAD
- git branch
- git status --short
- runtime health response
- route response status codes
- route response top-level JSON keys
- authorization behavior
- relevant server.js route line references

## 4. Runtime Health Check

Required command:

curl -sS http://127.0.0.1:8080/health

Expected minimum:

- HTTP reachable
- JSON response
- status ok or equivalent current runtime health response

## 5. Authentication Baseline

Where credentials are available, capture login response using:

POST /auth/login

Required to verify:

- token is returned
- role is unchanged
- tenant_id is unchanged
- scope is unchanged
- system_role behavior is unchanged

No credential values should be committed into documentation.

## 6. Route Response Capture

For each dashboard route, capture:

- HTTP status code
- top-level JSON keys
- route-specific required keys
- response shape notes

Do not require exact count equality if live data changes between runs.
Prefer structural comparison over dynamic count comparison.

## 7. Route-Specific Expectations

### 7.1 GET /runtime/admin/dashboard

Expected properties:

- requires system_admin
- requires global scope
- returns scope: global
- returns summary
- returns tenant_health
- returns recent_activity

Must preserve:

- summary key names
- tenant_health array
- recent_activity array
- global scope requirement

### 7.2 GET /runtime/dashboard/tenants

Expected properties:

- returns generated_at
- returns tenants

Important current behavior:

- uses direct res.writeHead/res.end
- does not use send in the current inline block

Must preserve:

- top-level generated_at
- top-level tenants
- direct response shape
- tenant aggregate fields

### 7.3 GET /runtime/dashboard/tenants/:tenant_id

Expected properties:

- returns generated_at
- returns scope: tenant
- returns tenant_id
- returns tenant
- returns domains
- returns members
- returns objects
- returns relations
- returns risks
- returns recommendations
- returns orchestrations
- returns learning
- returns governance
- returns communication

Must preserve:

- 400 behavior for missing tenant id
- 404 behavior for unknown tenant
- risk placeholder behavior
- governance approval placeholder behavior

### 7.4 GET /runtime/dashboard/management

Expected properties:

- returns generated_at
- returns scope: global_management
- returns dashboard

Must preserve:

- dashboard count field names
- no authorization behavior change unless separately approved

### 7.5 GET /runtime/dashboard

Expected properties:

- requires runtime_admin or auditor
- returns dashboard
- returns summary
- returns objects

Must preserve:

- tenant scoping by auth.user.tenant_id
- active_objects calculation
- high_risk_objects calculation

## 8. Authorization Verification

Verify before and after extraction:

- unauthenticated request behavior for protected routes
- insufficient role behavior
- global scope requirement for admin dashboard
- tenant scoped behavior for runtime dashboard

No route may become more open or more restricted during extraction.

## 9. Mutation Guard

Dashboard extraction must not introduce:

- INSERT
- UPDATE
- DELETE
- writeEvent
- worker execution
- schema migration

Verification command pattern:

grep -RInE 'INSERT INTO runtime_|UPDATE runtime_|DELETE FROM runtime_|writeEvent' runtime-api/routes/dashboard runtime-api/server.js

The dashboard route implementation must not add mutation behavior.

## 10. Diff Guard

Before commit, verify:

- only intended dashboard route files are added
- server.js contains only minimal wiring changes
- no unrelated files are staged
- no dashboard output files are modified

Required commands:

git status --short
git diff --stat
git diff --cached --stat

## 11. Rollback Verification

Rollback must be possible by restoring only changed files.

Required rollback method:

git checkout -- runtime-api/server.js runtime-api/routes/dashboard

or equivalent file-specific checkout before commit.

No database rollback may be required.

## 12. Stop Conditions

Stop immediately if:

- /health fails
- any dashboard route returns a different status code unexpectedly
- top-level JSON keys change unexpectedly
- authorization behavior changes
- tenant scoping changes
- response shape changes
- writeEvent appears in extracted dashboard code
- git diff includes unrelated files

## 13. Commit Acceptance Criteria

A dashboard extraction commit is acceptable only if:

- before/after route checks are documented
- runtime health passes
- route status codes match
- JSON top-level keys match
- authorization behavior matches
- no mutation behavior is introduced
- git diff is limited to intended files

## 14. Conclusion

This protocol must be completed before the first dashboard route extraction is committed.

It exists to ensure that modularization is behavior-preserving, reversible, and verifiable.

