# RSOS-LIB-005: Knowledge Package Specification

Status: Draft for Review
Scope: Library / Package Specification
Reference:
- Foundation (frozen)
- LIB-001
- LIB-002
- LIB-003
- LIB-004
- ENG-001 ... ENG-008
- ENG-100

## 1. Purpose

This specification defines the RSOS Knowledge Package.

A Knowledge Package is a reusable, versioned and auditable collection of multiple Knowledge Units.

Its purpose is to make related Knowledge Units usable as one coherent package for documentation, export, validation, reuse and future Toolchain generation.

This document introduces no new architecture.

---

## 2. Package Principle

A Knowledge Package shall group Knowledge Units that belong together by purpose, scope or application context.

A package shall not replace individual Knowledge Units.

A package shall provide:

- package identity
- package metadata
- included Knowledge Units
- package version
- package status
- package dependencies
- package exports
- package consumers
- evidence references
- audit references
- release state

---

## 3. Knowledge Package Definition

A Knowledge Package is a structured collection of registered Knowledge Units.

A package shall be valid only if every included Knowledge Unit is registered according to LIB-004.

A package may contain:

- Foundation-related Knowledge Units
- Engineering Knowledge Units
- Library Knowledge Units
- Process Knowledge Units
- Toolchain Knowledge Units
- Domain-neutral reusable Knowledge Units

A package shall not contain unregistered or unverifiable content.

---

## 4. Package Metadata

Each Knowledge Package shall define the following metadata:

- package_id
- package_name
- package_type
- package_version
- package_status
- package_scope
- package_owner
- created_at
- updated_at
- references
- included_units
- dependencies
- exports
- consumers
- evidence
- audit

---

## 5. Package Identity

Each package shall have a stable package_id.

The package_id shall be unique within the RSOS Library Registry.

Example:

RSOS-PKG-LIBRARY-FOUNDATION
RSOS-PKG-ENGINEERING-BASELINE
RSOS-PKG-KNOWLEDGE-APPLICATION

The package_id shall not change when the package version changes.

---

## 6. Package Versioning

Each package shall have an explicit version.

Package versioning shall track changes to the package structure, not only changes to included Knowledge Units.

A new package version is required when:

- a Knowledge Unit is added
- a Knowledge Unit is removed
- a Knowledge Unit dependency changes
- package exports change
- package consumers change
- evidence references change
- release status changes

Package versioning shall not override Knowledge Unit versioning.

---

## 7. Included Knowledge Units

A package shall list every included Knowledge Unit explicitly.

Each entry shall contain:

- unit_id
- unit_version
- registry_reference
- inclusion_reason
- required_status

Example:

unit_id: RSOS-LIB-003
unit_version: 1.0.0
registry_reference: RSOS-LIB-004
inclusion_reason: Defines the Knowledge Unit model.
required_status: accepted

---

## 8. Package Dependencies

A package may depend on:

- another Knowledge Package
- a Knowledge Unit
- an Engineering protocol
- a registry entry
- a Toolchain baseline

Dependencies shall be explicit.

A package shall not depend on undocumented assumptions.

---

## 9. Package EXPORTS

A package may export reusable outputs.

Package-level exports may include:

- specifications
- schemas
- templates
- validation rules
- registry entries
- generation instructions
- documentation bundles
- Toolchain inputs

Exports shall be declared at package level.

A package export shall not conflict with the exports of its included Knowledge Units.

---

## 10. Package CONSUMERS

A package shall define intended consumers.

Consumers may include:

- RSOS Toolchain
- Engineering workflow
- Runtime documentation
- Registry process
- Audit process
- Validation process
- Human reviewer
- Future generators

Consumers shall be defined so that package usage remains traceable.

---

## 11. Evidence Requirements

A Knowledge Package shall reference evidence for:

- package purpose
- included Knowledge Units
- version changes
- dependency changes
- export changes
- approval decisions

Evidence may include:

- source documents
- registry entries
- engineering documents
- audit records
- review notes
- verification results

A package shall not be marked accepted without sufficient evidence.

---

## 12. Audit Requirements

Every package lifecycle event shall be auditable.

Audit-relevant events include:

- package creation
- package update
- package validation
- package approval
- package rejection
- package deprecation
- package export
- package consumption by Toolchain

Audit records shall preserve:

- timestamp
- actor
- package_id
- package_version
- event_type
- evidence_reference
- decision_reference

---

## 13. Package Status Model

A package shall use the following status model:

- draft
- review
- accepted
- deprecated
- rejected

Only accepted packages may be used as Toolchain input.

---

## 14. Package Validation

A package shall be valid only if:

- package_id is unique
- metadata is complete
- all included Knowledge Units exist in the registry
- all included Knowledge Units have valid versions
- dependencies are declared
- exports are declared
- consumers are declared
- evidence is referenced
- audit requirements are satisfied
- status transition is allowed

Validation shall be deterministic.

---

## 15. Package Release

A package release shall represent a stable package version.

A release shall include:

- package metadata
- included Knowledge Unit list
- dependency list
- exports
- consumers
- evidence references
- audit references
- approval reference

A released package shall be reproducible.

---

## 16. Toolchain Preparation

The future RSOS Toolchain shall be able to:

- read package metadata
- resolve included Knowledge Units
- validate package dependencies
- generate package exports
- verify package evidence
- create audit events
- reject invalid package states
- consume accepted packages as generation input

This document prepares the package model for automatic generation.

It does not define the implementation of the Toolchain.

---

## 17. Minimal Package Schema

```yaml
package_id: RSOS-PKG-EXAMPLE
package_name: Example Knowledge Package
package_type: knowledge_package
package_version: 1.0.0
package_status: draft
package_scope: Example scope
package_owner: RSOS Engineering

references:
  - RSOS-LIB-001
  - RSOS-LIB-002
  - RSOS-LIB-003
  - RSOS-LIB-004

included_units:
  - unit_id: RSOS-LIB-003
    unit_version: 1.0.0
    registry_reference: RSOS-LIB-004
    inclusion_reason: Defines Knowledge Unit structure.
    required_status: accepted

dependencies:
  - dependency_id: RSOS-LIB-004
    dependency_type: registry
    required: true

exports:
  - export_id: example_export
    export_type: documentation
    consumer: RSOS Toolchain

consumers:
  - consumer_id: rsos_toolchain
    consumer_type: generator

evidence:
  - evidence_id: example_evidence
    evidence_type: specification
    reference: RSOS-LIB-005

audit:
  required: true
  events:
    - package.created
    - package.validated
    - package.approved

```

---

## 18. Non-Goals

This specification does not define:

- runtime implementation
- database schema
- API routes
- generator code
- package execution
- business-domain-specific package content
- replacement of Knowledge Units

---

## 19. Integrity Rule

A Knowledge Package shall never hide the status, evidence or dependencies of its included Knowledge Units.

Package-level acceptance does not automatically change the acceptance status of included Knowledge Units.

The package is a traceable grouping layer, not an authority override.

---

## 20. Summary

LIB-005 defines the RSOS Knowledge Package as a reusable, versioned and auditable collection of Knowledge Units.

It prepares the RSOS Library for package-level reuse, validation, export and future automatic generation by the RSOS Toolchain.
