# RSOS-LIB-009 — Lifecycle Event Specification

Status: Draft for Review
Class: Library Contract
Scope: Lifecycle Transition Evidence
Implementation Status: Specification Only

---

## 1. Purpose

LIB-009 defines the canonical RSOS Library contract for recording one
explicit lifecycle state transition.

A Lifecycle Event is immutable evidence that one defined state
transition of one affected object occurred.

LIB-009 does not define one global RSOS state machine.

Allowed states, allowed transitions, prerequisites, validation gates,
approval requirements and business rules remain defined by the
contract governing the affected object.

---

## 2. Core Principle

One Lifecycle Event describes exactly one state transition.

A Lifecycle Event shall be:

- uniquely identifiable
- attributable
- version-aware
- traceable
- auditable
- immutable as historical evidence

A Lifecycle Event shall not:

- invent object-specific lifecycle states
- redefine an object's lifecycle contract
- combine multiple transitions into one event
- silently infer that a transition occurred
- replace Validation
- replace Approval
- replace the immutable Runtime audit trail

The governing object contract determines whether a transition is valid.

LIB-009 records the transition as explicit lifecycle evidence.

---

## 3. Canonical Fields

The canonical Lifecycle Event fields are:

- event_id
- event_type
- timestamp
- actor
- affected_object
- object_version
- previous_state
- new_state
- reason_code
- evidence_reference
- decision_reference

These fields define semantic contract vocabulary.

They do not define physical storage.

---

## 4. Event Identity and Type

### event_id

`event_id` identifies one Lifecycle Event uniquely.

The identifier shall allow the event to be referenced unambiguously.

### event_type

`event_type` identifies the semantic lifecycle event that occurred.

The event type shall not replace the explicit transition represented by
`previous_state` and `new_state`.

Object-specific or domain-specific contracts may define controlled
event-type vocabularies.

LIB-009 does not define one global event-type vocabulary.

---

## 5. Transition Semantics

A valid Lifecycle Event shall describe exactly one transition:

previous_state -> new_state

`previous_state` represents the lifecycle state immediately before the
transition.

`new_state` represents the lifecycle state immediately after the
transition.

Both values shall originate from the lifecycle contract governing the
affected object.

LIB-009 shall not define one universal list of permitted states.

LIB-009 shall not define one universal transition graph.

A transition recorded by LIB-009 shall not itself create authority for
that transition.

The governing object contract remains authoritative for transition
validity.

---

## 6. Affected Object and Version

Every Lifecycle Event shall identify the affected object.

The event shall preserve:

- affected_object
- object_version where the affected object is versioned

The affected object reference shall be explicit and uniquely
resolvable within the applicable scope.

A transition for one object version shall not be interpreted as a
transition for another version.

Ambiguous object or version references shall prevent the event from
being treated as valid lifecycle evidence.

---

## 7. Actor and Timestamp

Every Lifecycle Event shall preserve:

- actor
- timestamp

`actor` identifies the human, governed service or authorized system
actor responsible for initiating or recording the transition.

The actor field shall preserve accountability but shall not itself
create authority.

`timestamp` identifies when the lifecycle transition was recorded.

Timestamp representation shall be unambiguous and timezone-aware where
implemented.

---

## 8. Reason Code

A Lifecycle Event may preserve a `reason_code` explaining why the
transition occurred.

The reason code shall be explicit and traceable where required by the
governing contract.

A reason code shall not replace:

- evidence
- validation
- approval
- audit evidence

A reason code is explanatory metadata, not proof by itself.

---

## 9. Evidence Reference

A Lifecycle Event may reference supporting evidence through
`evidence_reference`.

The evidence reference is required whenever the governing transition
requires evidence, validation, verification or proof.

Evidence shall remain:

- explicit
- traceable
- version-aware where applicable
- audit-linked

A Lifecycle Event shall not convert missing or insufficient evidence
into valid transition evidence.

Evidence existence alone does not authorize a transition.

---

## 10. Decision Reference

A Lifecycle Event may reference a governing decision through
`decision_reference`.

The decision reference is required whenever the governing transition
requires approval, authorization or another explicit governed decision.

A decision reference shall remain traceable to the applicable decision
record.

A Lifecycle Event shall not create decision authority by merely
referencing a decision identifier.

The referenced decision must be valid for the affected object, version
and transition scope.

---

## 11. Validation and Approval Coupling

Validation and Approval remain separate responsibilities.

LIB-007 Validation Reports may provide transition evidence.

LIB-008 Approval Records may provide governed decision evidence.

A Lifecycle Event may reference both when required by the governing
object contract.

Validation does not equal Approval.

Approval does not equal Validation.

Neither Validation nor Approval is replaced by the Lifecycle Event.

LIB-009 records that the governed state transition occurred.

---

## 12. Audit Requirements

Every lifecycle transition is audit-relevant.

Lifecycle evidence shall preserve, directly or by reference:

- timestamp
- actor
- affected object
- affected object version where applicable
- previous state
- new state
- transition result
- evidence reference where applicable
- decision reference where applicable

A Lifecycle Event shall maintain an auditable relationship to the
transition it represents.

Where the governing process requires an available audit path, loss of
that audit path shall prevent the transition from being treated as
fully verified lifecycle evidence.

---

## 13. Runtime Audit Boundary

LIB-009 does not redefine the existing RSOS Runtime event model.

LIB-009 does not modify `runtime_events`.

The Library Lifecycle Event and Runtime audit event may be related, but
they are not automatically identical concepts.

Any future mapping between LIB-009 and Runtime event storage requires a
separate verified implementation contract.

The immutable Runtime audit trail remains authoritative for recorded
Runtime audit evidence.

---

## 14. Immutability

A recorded Lifecycle Event is historical evidence.

It shall not be rewritten to represent a later state.

Corrections, reversals, deprecations, revocations or subsequent
transitions shall be represented by additional governed records or
events according to the applicable contract.

Historical lifecycle evidence shall remain reconstructable.

---

## 15. Object-Specific Lifecycle Authority

The governing object specification owns:

- available lifecycle states
- permitted transitions
- transition prerequisites
- required validation
- required approval
- required evidence
- version-specific lifecycle rules
- domain-specific transition semantics

LIB-009 owns only the common transition-evidence contract.

LIB-009 shall not override an object-specific lifecycle model.

LIB-009 shall not merge different object-specific state vocabularies
into one global vocabulary.

---

## 16. Fail-Closed Semantics

A Lifecycle Event shall not be treated as valid transition evidence
when required transition information cannot be established.

Examples include:

- unresolved affected object
- unresolved object version where required
- unknown previous state
- unknown new state
- transition not permitted by the governing contract
- required evidence missing
- required approval or decision missing
- actor attribution missing where required
- audit trace unavailable where required
- ambiguous transition scope

Unknown or ambiguous lifecycle state shall not be converted into an
implicit valid transition.

---

## 17. Toolchain Preparation

The future RSOS Toolchain shall be able to evaluate Lifecycle Events
deterministically.

Required capabilities include:

- resolve event identity
- resolve affected object
- resolve object version
- read previous state
- read new state
- resolve actor
- resolve reason code where present
- resolve evidence references
- resolve decision references
- identify the governing lifecycle contract
- validate the transition against that contract
- expose audit relationships
- reject ambiguous or invalid transition evidence

The semantic contract does not prescribe implementation.

---

## 18. Non-Goals

LIB-009 does not define:

- one global RSOS state machine
- one global lifecycle state vocabulary
- one global transition graph
- object-specific business rules
- workflow orchestration
- automatic state mutation
- automatic approvals
- Runtime execution behavior
- database schema
- API routes
- workers
- deployment behavior
- physical Runtime event storage

These concerns belong to governing object contracts or later
implementation layers.

---

## 19. Integrity Rule

A Lifecycle Event is evidence of one explicit state transition.

It shall never be interpreted as authority for transitions beyond the
affected object, version and scope recorded by the event.

The transition chain shall remain reconstructable through:

affected object
-> object version
-> previous state
-> new state
-> actor
-> evidence where required
-> decision where required
-> audit relationship

Historical lifecycle evidence shall remain immutable.

Unknown, ambiguous or unverifiable transitions shall fail closed.

---

## 20. Final Decision

Decision:

LIB-009 becomes the canonical RSOS Library contract for representing
one explicit, attributable, auditable and immutable lifecycle state
transition.

Constraint:

LIB-009 standardizes transition evidence.

It does not standardize all object-specific lifecycle states or
transition graphs.

The governing object contract remains authoritative for lifecycle
semantics and transition validity.
