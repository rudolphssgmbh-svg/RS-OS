# RSOS-TOOLCHAIN-002: Execution Graph Contract

Status: Draft for Review
Scope: Toolchain / Execution Kernel
Reference:
- Foundation
- LIB-001
- LIB-002
- LIB-003
- LIB-004
- RSOS-KNOW-001
- RSOS-TOOLCHAIN-001

## 1. Purpose

This specification defines the Execution Graph Contract for RSOS.

The Execution Graph is the formal runtime structure produced by the Execution Kernel before any controlled execution occurs.

Its purpose is to transform structured knowledge into a deterministic, auditable and replayable execution model.

This document introduces no business logic.

---

## 2. Principle

RSOS shall not execute Knowledge Objects directly.

Every execution shall pass through an Execution Graph.

The Execution Graph shall define:

- execution intent
- execution nodes
- dependencies
- constraints
- evidence requirements
- governance requirements
- audit context
- execution status

---

## 3. Execution Graph Definition

An Execution Graph is a directed acyclic graph.

It contains nodes, edges, constraints, evidence requirements and audit metadata.

The graph shall be valid before execution.

A graph that is not valid shall not be executed.

---

## 4. Minimal Graph Object

An Execution Graph shall contain at minimum:

- execution_graph_id
- tenant_id
- source_knowledge_unit
- status
- nodes
- edges
- constraints
- evidence_requirements
- audit

---

## 5. Node Model

A node represents one executable step.

Allowed node types for the minimal kernel are:

- load
- resolve
- validate
- plan
- execute
- observe
- commit

---

## 6. Edge Model

An edge defines dependency between two nodes.

Allowed relations are:

- requires_success
- requires_evidence
- requires_approval
- requires_observation
- blocks

---

## 7. Constraint Model

A constraint defines a rule that must be evaluated before or during execution.

Allowed severities are:

- info
- warning
- blocking

---

## 8. Evidence Requirement Model

Evidence requirements define which evidence must exist before execution may proceed.

---

## 9. Graph Status

Allowed graph statuses are:

- draft
- validated
- ready
- running
- paused
- blocked
- completed
- failed
- rolled_back

---

## 10. Node Status

Allowed node statuses are:

- pending
- ready
- running
- completed
- failed
- blocked
- skipped

---

## 11. Validation Rules

An Execution Graph shall only become ready if:

- all nodes are typed
- all edges reference existing nodes
- no cycles exist
- all blocking constraints are satisfied
- required evidence is available
- required governance approvals are available
- audit context is initialized

---

## 12. Non-Goals

This specification does not define:

- business-specific workflows
- UI behavior
- AI prompt execution
- autonomous execution
- tenant-specific policy
- runtime implementation details

---

## 13. Implementation Direction

The first implementation shall provide:

- graph object schema
- graph validation function
- DAG cycle check
- node status transition rules
- audit event emission
- execution readiness evaluation

Execution itself shall remain controlled and gated.
