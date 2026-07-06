# RSOS-TOOLCHAIN-004: Execution Compiler

Status: Draft for Review
Scope: Toolchain / Execution Kernel
Reference:
- Foundation
- RSOS-KNOW-001
- LIB-001
- LIB-002
- LIB-003
- LIB-004
- LIB-005
- LIB-006
- RSOS-TOOLCHAIN-001
- RSOS-TOOLCHAIN-002
- RSOS-TOOLCHAIN-003

## 1. Purpose

This specification defines the RSOS Execution Compiler.

The Execution Compiler transforms Knowledge Objects into Execution Objects and assembles valid Execution Graphs.

Its purpose is to create a controlled compile step between knowledge representation and runtime execution.

This document introduces no business logic.

---

## 2. Compiler Principle

RSOS shall not execute Knowledge Objects directly.

Every executable structure shall be produced by the Execution Compiler.

The compiler shall transform:

- Knowledge Objects
- Library definitions
- constraints
- evidence requirements
- governance requirements
- tenant context

into:

- Execution Objects
- Execution Graphs
- validation results
- audit preparation metadata

---

## 3. Compiler Responsibility

The Execution Compiler is responsible for:

- loading Knowledge Objects
- resolving LIB semantics
- resolving source bindings
- resolving dependencies
- resolving constraints
- resolving evidence requirements
- resolving governance requirements
- building Execution Objects
- assembling Execution Graphs
- validating graph readiness

The compiler shall not execute runtime actions.

---

## 4. Compiler Pipeline

The compiler pipeline shall contain the following stages:

1. load
2. resolve
3. bind
4. validate
5. build
6. assemble
7. evaluate
8. emit

Each stage shall produce deterministic output.

Each stage shall be auditable.

---

## 5. Load Stage

The load stage retrieves the required Knowledge Object slice.

The slice may include:

- primary Knowledge Object
- related Knowledge Objects
- referenced Library definitions
- source references
- evidence references
- governance references
- tenant context

The load stage shall fail if the primary Knowledge Object is missing.

---

## 6. Resolve Stage

The resolve stage maps Knowledge Object semantics to execution semantics.

It shall resolve:

- object type
- object status
- object relationships
- mandatory relationships
- optional relationships
- forbidden relationships
- cardinality rules
- lifecycle coupling

Unresolved mandatory semantics shall block compilation.

---

## 7. Bind Stage

The bind stage creates explicit bindings.

Bindings shall include:

- source binding
- tenant binding
- library binding
- evidence binding
- governance binding
- audit binding

A compiled object without source binding shall be invalid.

---

## 8. Validate Stage

The validate stage checks whether the object may enter execution preparation.

It shall evaluate:

- structural validity
- relationship validity
- constraint validity
- evidence availability
- governance availability
- lifecycle status
- audit readiness

Validation failures shall produce explicit compiler errors.

---

## 9. Build Stage

The build stage creates Execution Objects.

Each Execution Object shall include:

- execution_object_id
- tenant_id
- source_object_id
- source_object_type
- intent
- status
- inputs
- outputs
- constraints
- evidence_requirements
- governance_requirements
- audit

The build stage shall not create runtime side effects.

---

## 10. Assemble Stage

The assemble stage creates an Execution Graph from Execution Objects.

It shall create:

- graph identity
- graph nodes
- graph edges
- graph constraints
- graph evidence requirements
- graph audit context
- graph status

The resulting graph shall be acyclic.

---

## 11. Evaluate Stage

The evaluate stage determines graph readiness.

A graph may become ready only if:

- all nodes are typed
- all edges reference existing nodes
- no cycles exist
- blocking constraints are satisfied
- required evidence is available
- required governance approvals are available
- audit context is initialized

If readiness is not achieved, the graph shall become blocked or draft.

---

## 12. Emit Stage

The emit stage writes compiler output.

Compiler output may include:

- Execution Objects
- Execution Graph
- compiler diagnostics
- validation errors
- readiness result
- audit preparation event

The emit stage shall not execute the graph.

---

## 13. Compiler Diagnostics

Every compiler run shall produce diagnostics.

Diagnostics shall include:

- compiler_run_id
- tenant_id
- source_object_id
- stage
- severity
- message
- blocking
- timestamp

Allowed severities are:

- info
- warning
- error
- blocking

---

## 14. Compiler Errors

Compiler errors shall be explicit.

A compiler error shall contain:

- error_code
- stage
- object_ref
- message
- blocking
- remediation_hint

Blocking errors shall prevent graph readiness.

---

## 15. Determinism Rule

The same Knowledge Object input, Library state and tenant context shall produce the same compiler output.

If output differs, the compiler shall expose the difference through diagnostics.

Implicit mutation is forbidden.

---

## 16. Audit Rule

Every compiler run shall be auditable.

The compiler shall emit an audit preparation event containing:

- compiler_run_id
- source_object_id
- tenant_id
- input_refs
- output_refs
- result
- timestamp

Audit emission shall not imply runtime execution.

---

## 17. Runtime Boundary

The Execution Compiler shall stop before runtime execution.

It may produce a ready graph.

It shall not execute the graph.

Runtime execution belongs to the Execution Runtime.

---

## 18. Non-Goals

This specification does not define:

- database schema
- API routes
- UI behavior
- business workflows
- autonomous execution
- AI prompt execution
- tenant-specific business policy

---

## 19. Implementation Direction

The first implementation shall provide:

- compiler run object
- staged compiler pipeline
- Knowledge Object loader interface
- LIB resolver interface
- Execution Object builder
- Execution Graph assembler
- graph readiness evaluator
- compiler diagnostics output
- audit preparation event

