# RSOS-LIB-004: Knowledge Library Registry

Status: Draft for Review
Scope: Library / Registry
Reference:
- Foundation (frozen)
- LIB-001
- LIB-002
- LIB-003
- ENG-001 ... ENG-008
- ENG-100

## 1. Purpose

This specification defines the registry model for RSOS Knowledge Units.

Its purpose is to make Knowledge Units discoverable, versioned, traceable and usable by the RSOS Toolchain.

This document introduces no new architecture.

---

## 2. Registry Principle

Every accepted Knowledge Unit shall be registered.

The registry shall provide:

- identity
- location
- version
- status
- classification
- dependencies
- exports
- consumers
- audit reference

Unregistered Knowledge Units may not become normative.

---

## 3. Registry Entry

Every registry entry shall include:

- knowledge unit id
- title
- file path
- classification
- status
- version
- owner
- domain
- tags
- dependencies
- exports
- consumers
- evidence reference
- audit reference

---

## 4. Versioning

Every Knowledge Unit shall maintain version metadata.

Version metadata includes:

- current version
- previous version
- change class
- change reason
- superseded by
- effective date
- audit reference

Historical versions remain discoverable.

---

## 5. Dependency Index

The registry shall maintain dependency information.

Dependency information includes:

- direct dependencies
- indirect dependencies
- upstream references
- downstream consumers
- unresolved dependencies
- deprecated dependencies

Circular dependencies must be detected before verification.

---

## 6. EXPORTS Index

The registry shall index all exports defined under LIB-002.

The EXPORTS index shall include:

- source Knowledge Unit
- export type
- target path
- target system
- generation status
- evidence requirement
- audit reference

---

## 7. CONSUMERS Index

The registry shall index all consumers defined under LIB-002.

The CONSUMERS index shall include:

- source Knowledge Unit
- consumer class
- consumer name
- allowed input
- expected output
- governance boundary
- audit requirement

---

## 8. Domain and Tag Structure

Knowledge Units may be grouped by:

- architecture
- governance
- engineering
- library
- runtime
- operations
- competence
- knowledge
- tenant
- domain

Tags shall support retrieval, validation and automation.

---

## 9. Search and Reference Rules

The registry shall support deterministic lookup by:

- identifier
- title
- domain
- tag
- dependency
- export type
- consumer class
- status
- version

Ambiguous references must be rejected or escalated.

---

## 10. Registry Maintenance

Whenever a Knowledge Unit is created, changed, superseded or revoked, the registry shall be updated.

Registry changes require:

- change classification under ENG-004
- evidence under ENG-005
- review under ENG-002
- audit reference

---

## 11. Future Implementation Reference

Future implementation may use a registry file or database.

Potential reference paths:

- /library/registry/knowledge_units.json
- /library/registry/exports.json
- /library/registry/consumers.json
- /library/registry/dependencies.json

This document does not create implementation files.

---

## 12. Final Decision

Decision:

The Knowledge Library Registry becomes the authoritative index for RSOS Knowledge Units.

Constraint:

No Knowledge Unit may become normative, generative or operational unless it is registered, versioned, traceable and audit-linked.

