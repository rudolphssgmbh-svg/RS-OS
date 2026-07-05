# RSOS-ENG-004: Engineering Change Classification

Status: Draft for Review
Scope: Engineering Change Classification
Reference:
- Foundation (frozen)
- GOV-001
- ENG-001
- ENG-002
- ENG-003
- ARCH-007 ... ARCH-013

## 1. Purpose

This document defines the classification rules for engineering changes in RSOS.

The primary classification levels are:

- Major
- Minor
- Patch

Critical is used as an escalation marker when a change creates exceptional risk.

This document introduces no new architecture.

---

## 2. Classification Principle

Every engineering change must be classified before review and approval.

Classification determines:

- review depth
- approval level
- evidence requirements
- rollback requirements
- runtime release readiness

No change may remain unclassified.

---

## 3. Patch Change

A Patch change is a small correction that does not alter architecture, governance, responsibility, data meaning or runtime behavior.

Patch examples:

- typo correction
- formatting correction
- documentation clarification
- non-functional text cleanup
- small naming correction without semantic change
- dashboard snapshot refresh
- log wording clarification

Patch changes must not:

- change Foundation meaning
- change ARCH meaning
- change GOV meaning
- change ENG workflow meaning
- alter runtime behavior
- alter database structure
- alter trust, routing, synchronization or recovery behavior

Patch approval may be lightweight but must remain auditable.

---

## 4. Minor Change

A Minor change extends or clarifies existing behavior without changing architectural responsibility or governance authority.

Minor examples:

- adding an approved documentation section
- adding a new engineering checklist
- extending an existing route family without changing governance meaning
- adding a non-breaking runtime endpoint
- adding an approved evidence field
- improving observability without changing decisions
- adding a compatible validation rule

Minor changes require:

- compliance check
- engineering review
- rollback path
- human approval
- audit record

Minor changes must not:

- introduce new core roles
- change Foundation
- redefine architecture
- bypass governance
- create hidden authority
- break compatibility

---

## 5. Major Change

A Major change affects architecture, governance, responsibility, federation behavior, trust boundaries, runtime state, data model or operational decision flow.

Major examples:

- new architecture document
- governance rule change
- engineering workflow change
- database schema change
- new runtime domain
- new federation behavior
- trust model change
- synchronization model change
- recovery or isolation model change
- route authorization change
- change affecting audit chain continuity

Major changes require:

- full compliance check
- full engineering review
- governance review
- risk review
- evidence record
- rollback or isolation plan
- explicit human approval
- post-change verification

Major changes may not proceed without documented governance acceptance.

---

## 6. Critical Escalation Marker

Critical is not a normal change class.

Critical is an escalation marker applied to Major, Minor or Patch when the change creates exceptional risk.

Critical triggers include:

- potential audit chain break
- production outage risk
- irreversible data loss risk
- security or trust boundary risk
- governance bypass risk
- unclear human responsibility
- unresolved architectural contradiction
- unknown rollback path

Critical changes require council review or equivalent governance escalation before approval.

---

## 7. Wissensnetz Classification

Changes to the RSOS Wissensnetz must be classified carefully because they affect knowledge, evidence, learning and future decisions.

### Patch in Wissensnetz

Patch applies when:

- wording is corrected without changing meaning
- duplicate text is removed
- formatting is improved
- reference labels are corrected
- metadata is clarified without semantic change

### Minor in Wissensnetz

Minor applies when:

- an existing knowledge relation is clarified
- an evidence reference is added
- a learning note is added
- a known unknown is documented
- a classification is refined without changing accepted knowledge
- a new observation is linked to an existing concept

### Major in Wissensnetz

Major applies when:

- accepted knowledge changes
- fact confidence changes materially
- a new core knowledge relation is introduced
- a dependency between domains changes
- a contradiction affects prior conclusions
- governance acceptance rules change
- evidence interpretation changes a decision
- learning output changes future recommendations

Wissensnetz Major changes require explicit review because they may affect future reasoning.

---

## 8. Classification Questions

Before classifying a change, ask:

- Does it change meaning?
- Does it change responsibility?
- Does it change trust?
- Does it change architecture?
- Does it change governance?
- Does it change runtime behavior?
- Does it change accepted knowledge?
- Does it change evidence interpretation?
- Does it affect auditability?
- Does it require rollback or isolation?

If any answer is yes, the change is not Patch.

---

## 9. Classification Result

Every change records:

- change id
- change title
- affected area
- selected class
- reason
- risk level
- reviewer
- approval requirement
- rollback requirement
- audit reference

---

## 10. Final Decision

Decision:

Engineering Change Classification becomes mandatory before review, approval and release.

Constraint:

No RSOS engineering or Wissensnetz change may proceed without explicit classification as Patch, Minor, Major or Critical-marked.

