# RSOS-ENG-005: Engineering Evidence Requirements

Status: Draft for Review
Scope: Engineering Evidence
Reference:
- Foundation (frozen)
- GENESIS III.1
- GOV-001
- ENG-001
- ENG-002
- ENG-003
- ENG-004
- ARCH-007 ... ARCH-013

## 1. Purpose

This specification defines the strict evidence requirements for the RSOS Engineering Management System.

According to GENESIS III.1:

> No state arises without a traceable cause.

No document, code block, runtime behavior or engineering result may receive VERIFIED status without a complete, tamper-resistant evidence trail inside the repository.

A mere claim of functionality has no epistemic validity inside RSOS.

---

## 2. Evidence Principle

Engineering evidence must be:

- traceable
- reproducible
- reviewable
- falsifiable
- repository-bound
- audit-ready
- linked to the affected change

No evidence means no verification.

---

## 3. Verified Status Rule

VERIFIED status requires:

- stated claim
- evidence reference
- test or proof method
- execution result
- reviewer
- timestamp
- repository path
- audit reference

Without these elements, the maximum allowed status is REVIEW REQUIRED.

---

## 4. Accepted Evidence Types

Accepted evidence types include:

- mathematical proof
- numerical verification
- empirical test result
- automated test output
- manual verification log
- runtime health result
- database verification result
- git diff
- commit hash
- reproducible command output
- audit chain verification
- rollback validation

---

## 5. Invalid Evidence Types

The following are not sufficient evidence:

- verbal assertion
- assumed functionality
- undocumented test claim
- screenshot without context
- unlinked external note
- unverifiable memory
- hidden local state
- undocumented manual action
- unreviewed AI-generated claim

---

## 6. Repository Evidence Requirement

Evidence must be stored or referenced in the repository.

Evidence records must include:

- file path
- command used
- result
- related commit
- related change class
- related review
- reviewer or operator
- timestamp

Evidence outside the repository may support a review but cannot alone establish VERIFIED status.

---

## 7. Code Evidence

Code changes require evidence of:

- syntax validity
- affected file list
- diff review
- runtime compatibility
- test result where applicable
- rollback path
- health check after change

A code block is not verified merely because it was written.

---

## 8. Document Evidence

Documentation changes require evidence of:

- document path
- scope
- referenced baseline
- classification under ENG-004
- review result
- commit hash
- absence of unintended files in commit

A document is not verified merely because it exists.

---

## 9. Wissensnetz Evidence

Wissensnetz changes require evidence of:

- affected knowledge node
- affected relation
- source of information
- confidence impact
- contradiction check
- governance impact
- learning impact
- review status

Major Wissensnetz changes require explicit evidence review.

---

## 10. Verification States

Allowed verification states:

- DRAFT
- REVIEW REQUIRED
- EVIDENCE PROVIDED
- VERIFIED
- VERIFIED WITH OBSERVATION
- REJECTED
- REVOKED

Only VERIFIED and VERIFIED WITH OBSERVATION may be treated as accepted engineering output.

---

## 11. Evidence Failure

Evidence failure occurs when:

- evidence is missing
- evidence is not reproducible
- evidence is not linked
- evidence contradicts the claim
- evidence cannot be audited
- evidence depends on hidden state
- evidence is outside governance scope

Evidence failure blocks VERIFIED status.

---

## 12. Audit Record

Every evidence review records:

- claim
- evidence type
- evidence path
- reviewer
- result
- limitation
- final status
- timestamp
- audit reference

---

## 13. Final Decision

Decision:

Engineering Evidence Requirements become mandatory for all RSOS engineering, documentation, runtime and Wissensnetz verification.

Constraint:

No RSOS document, code block, runtime behavior or knowledge claim may receive VERIFIED status without a complete, traceable and repository-bound evidence trail.

