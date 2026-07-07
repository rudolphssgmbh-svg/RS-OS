# RSOS-TOOLCHAIN-006: Execution Adapter

Status: Draft for Review
Scope: Toolchain / Execution Integration
Reference:
- Foundation
- RSOS-KNOW-001
- RSOS-TOOLCHAIN-001
- RSOS-TOOLCHAIN-002
- RSOS-TOOLCHAIN-003
- RSOS-TOOLCHAIN-004
- runtime/
- runtime-api/

---

## 1. Purpose

This specification defines the RSOS Execution Adapter.

The Execution Adapter connects the isolated Execution Runtime prototype with the productive Runtime API boundary.

Its purpose is controlled integration without merging experimental kernel logic directly into the productive runtime.

---

## 2. Adapter Principle

The Execution Adapter shall separate:

- execution kernel behavior
- runtime-api transport behavior
- audit persistence
- governance checks
- evidence references

The adapter shall not bypass runtime-api governance.

---

## 3. Boundary Rule

The isolated `runtime/` kernel remains a separate execution engine.

The productive `runtime-api/` remains the authority for:

- authentication
- tenant context
- audit events
- governance decisions
- database persistence
- external API behavior

---

## 4. Adapter Responsibility

The adapter shall translate between:

- Runtime API requests
- Execution Graph identifiers
- Execution Runtime calls
- Execution result objects
- Audit and governance events

---

## 5. Non-Goals

This specification does not define:

- autonomous execution
- tenant-specific business workflows
- UI behavior
- replacement of runtime-api
- replacement of PostgreSQL persistence
- direct execution of Knowledge Objects

---

## 6. Initial Implementation Direction

The first implementation shall provide:

- an adapter module inside `runtime-api/`
- controlled invocation of the isolated runtime kernel
- result normalization
- audit event writing
- governance-compatible execution status
- no public route changes unless separately approved

---

## 7. Integrity Rule

The adapter may execute only validated Execution Graphs.

Every adapter execution must be traceable through runtime-api audit events.

