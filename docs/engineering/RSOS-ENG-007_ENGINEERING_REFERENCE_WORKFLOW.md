# RSOS-ENG-007: Engineering Reference Workflow

Status: Draft for Review
Scope: Engineering Reference Workflow
Reference:
- Foundation (frozen)
- GENESIS III.1
- GOV-001
- ENG-001
- ENG-002
- ENG-003
- ENG-004
- ENG-005
- ENG-006
- ARCH-007 ... ARCH-013

## 1. Purpose

This specification defines the Engineering Reference Workflow and closes the logical cascade of RSOS Engineering Standards ENG-001 through ENG-007.

It describes the mandatory end-to-end reference scenario for evolutionary system changes.

This document introduces no new architecture and does not implement runtime code.

---

## 2. Reference Scenario

The reference scenario is the controlled introduction of a new workshop-state check:

/evolution/cases/werkstatt_check.md

The transition must proceed strictly sequentially:

PROPOSED
→ SPECIFIED
→ SIMULATED
→ TESTED
→ VERIFIED
→ RELEASED

No phase may be skipped.

---

## 3. Phase 1: PROPOSED

Purpose:

A new functional impulse is introduced into the repository.

Action:

A human developer or approved AI-assisted drafting process creates the initial document.

Status:

The document is unconfirmed.

Constraint:

PROPOSED content may not influence Runtime, Governance or accepted knowledge.

---

## 4. Phase 2: SPECIFIED

Purpose:

The proposal is syntactically and structurally defined.

Action:

The document header, dependencies, scope and classification are checked.

Required checks:

- header completeness
- dependency declaration
- change classification under ENG-004
- absence of circular dependency
- repository path validity

Evidence:

A specification review record is created.

Status transition:

PROPOSED → SPECIFIED

---

## 5. Phase 3: SIMULATED

Purpose:

The specified change is evaluated in an isolated simulation environment.

Action:

The change is tested against model expectations and safe assumptions.

Required checks:

- simulation input exists
- simulation result exists
- drift or uncertainty is documented
- functional path is mapped
- no Runtime mutation occurs

Evidence:

A simulation trace is stored or referenced under evidence requirements from ENG-005.

Status transition:

SPECIFIED → SIMULATED

---

## 6. Phase 4: TESTED

Purpose:

The simulated change is tested against positive and negative cases.

Action:

The change is evaluated against expected behavior, failure cases and cascade constraints.

Required checks:

- positive test cases pass
- negative test cases fail safely
- cascade violations are absent
- dangling references are absent
- rollback or isolation path exists

Evidence:

A test certificate or equivalent verification record is created.

Status transition:

SIMULATED → TESTED

---

## 7. Phase 5: VERIFIED

Purpose:

The tested change is accepted as valid engineering output.

Action:

Compliance, review, approval, classification and evidence are checked together.

Required checks:

- ENG-001 compliance complete
- ENG-002 review complete
- ENG-003 approval complete
- ENG-004 classification complete
- ENG-005 evidence complete
- no unresolved contradiction exists
- human responsibility is recorded

Evidence:

A verification record is created with repository-bound evidence.

Status transition:

TESTED → VERIFIED

---

## 8. Phase 6: RELEASED

Purpose:

The verified package is released into REALITY / RUNTIME only after final release readiness.

Action:

ENG-006 Release Readiness is evaluated.

Required checks:

- epistemic purity
- evidence density
- immunity validation
- operational survivability
- runtime health
- rollback path
- audit record

Evidence:

A release readiness record is created.

Status transition:

VERIFIED → RELEASED

---

## 9. Reference Pipeline

The reference workflow is:

1. Create proposal
2. Classify change
3. Specify structure
4. Simulate safely
5. Test against cases
6. Review evidence
7. Approve explicitly
8. Verify package
9. Evaluate release readiness
10. Release or block
11. Record audit trail

---

## 10. Failure Handling

If a phase fails, the workflow must stop.

Failure states include:

- FAILED_AT_SPECIFIED
- FAILED_AT_SIMULATED
- FAILED_AT_TESTED
- FAILED_AT_VERIFIED
- FAILED_AT_RELEASE_GATE
- RELEASE_BLOCKED

Failed changes may return to:

- PROPOSED
- SPECIFIED
- SIMULATED
- TESTED

A failed change may not skip directly to VERIFIED or RELEASED.

---

## 11. Automation Reference

The future implementation reference path is:

/engineering/tests/reference_pipeline.py

This document does not create that implementation.

Any future implementation must be classified under ENG-004, reviewed under ENG-002, approved under ENG-003, evidenced under ENG-005 and gated under ENG-006.

---

## 12. Engineering Block Closure

ENG-007 completes the RSOS Engineering Standard block:

- ENG-001: Architecture Compliance Check
- ENG-002: Engineering Review Protocol
- ENG-003: Engineering Approval Workflow
- ENG-004: Engineering Change Classification
- ENG-005: Engineering Evidence Requirements
- ENG-006: Engineering Release Readiness
- ENG-007: Engineering Reference Workflow

Together, these documents define the full engineering management process from proposal to release.

---

## 13. Final Decision

Decision:

Engineering Reference Workflow is accepted as the mandatory end-to-end blueprint for future RSOS engineering changes.

Constraint:

No future RSOS engineering change may be treated as operationally complete unless it can be traced through the full workflow from PROPOSED to RELEASED or explicitly blocked with audit evidence.

