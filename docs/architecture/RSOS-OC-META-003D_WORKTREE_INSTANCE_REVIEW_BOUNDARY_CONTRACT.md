# RSOS-OC-META-003D — Worktree Instance & Review Boundary Contract

Status: DRAFT
Scope: Architecture / Operational Care / Worktree Review Boundary
Change Class: Documentation Contract

Parent:
- RSOS-OC-META-003C Minimal Implementation Boundary Contract

Referenced Existing Governance:
- RSOS-100 Development Standard Helper
- RSOS-ARCH-007 Role Layer Competency Matrix
- RSOS-PF-001D Communication Authority Contract
- RSOS-LIB-003 Knowledge Unit Specification
- RSOS-LIB-004 Knowledge Library Registry
- RSOS-ENG-006 Engineering Release Readiness
- RSOS-ENG-007 Engineering Reference Workflow

Runtime Effects: NONE
Database Effects: NONE
Schema Effects: NONE
Production Effects: NONE
Role Implementation Effects: NONE
Commission Implementation Effects: NONE

---

## 1. Purpose

This contract defines the minimal boundary between:

- a governed worktree case;
- role-bound worktree instances;
- specialized review findings;
- independent Core A-D assessment;
- existing Council / HAR / Human authority;
- and the verified return path into canonical RSOS knowledge.

This contract does not redefine existing governance roles.

---

## 2. Existing Authority Is Preserved

The following existing governance separation remains authoritative:

    Core A-D = independent review perspectives
    Core Council = governance decision body
    Council Secretariat = preparation and dossier function
    JARVIS = coordination / conductor
    HAR = responsibility and human-authority binding
    Runtime = execution

Therefore:

    REVIEW != DECISION
    DECISION != EXECUTION
    COORDINATION != APPROVAL
    FINDING != AUTHORIZATION

---

## 3. Worktree Case Identity

Every governed Boxenstopp / worktree review case SHOULD have a stable case identity.

Minimum conceptual fields:

    case_id
    worktree_id
    source_commit
    source_branch
    scope
    purpose
    created_at
    mandate_reference
    authority_scope
    evidence_references
    known_facts
    assumptions
    hypotheses
    unknowns

A worktree case SHALL remain attributable to the exact source state under review.

---

## 4. Role and Instance Separation

RSOS already distinguishes role identity from instance identity.

Mandatory distinction:

    ROLE != INSTANCE

A role describes competence and mandate.

An instance is a case-bound realization of that role.

Conceptually:

    role_id = TEXAS_RANGER
    instance_id = WT-CASE-42/TEXAS_RANGER/001

An instance SHALL NOT inherit authority beyond the governing role mandate.

Therefore:

    INSTANCE != NEW_AUTHORITY
    INSTANCE != GOVERNANCE_BODY
    INSTANCE != HUMAN_APPROVER

---

## 5. Specialized Review Instances

A worktree case MAY invoke specialized review instances when their competence is relevant.

Examples may include:

- investigative review;
- causal / diagnostic review;
- rule-compliance review;
- invariant review;
- efficiency / redundancy review;
- operational containment review;
- temporal-impact review;
- environmental-impact review.

These instances produce findings.

They do not create governance decisions.

Mandatory distinction:

    SPECIALIZED_FINDING != FACT
    SPECIALIZED_FINDING != DECISION
    SPECIALIZED_FINDING != AUTHORIZATION

---

## 6. Findings Contract

Every specialized finding SHOULD identify:

    finding_id
    case_id
    role_id
    instance_id
    observation
    evidence
    assumptions
    hypotheses
    unknowns
    confidence
    scope
    affected_components
    recommendation
    dissent_or_conflict
    provenance

A finding SHALL preserve uncertainty.

A finding SHALL NOT convert:

    PATTERN != FACT
    HEURISTIC != FACT
    CORRELATION != CAUSATION
    HIGH_CONFIDENCE != VERIFIED_TRUTH

---

## 7. Independent Core Review

Core A, Core B, Core C and Core D remain independent review perspectives.

Each Core SHOULD receive the same bounded case dossier.

Each Core SHOULD produce its own assessment before consolidated coordination.

Conceptual outcomes MAY include:

    PASS
    PASS_WITH_CONDITIONS
    HOLD
    FAIL
    UNKNOWN_REQUIRES_REVIEW

Dissent SHALL remain visible.

Therefore:

    CONSENSUS != REQUIRED_FOR_TRUTH
    DISSENT != FAILURE
    DISSENT != AUTOMATIC_BLOCK
    DISSENT_RELEVANT_TO_GOVERNANCE = MUST_REMAIN_VISIBLE

---

## 8. JARVIS Boundary

JARVIS coordinates:

- dossier distribution;
- review routing;
- review-status visibility;
- conflict visibility;
- escalation;
- result consolidation.

JARVIS SHALL NOT:

- replace a Core assessment;
- suppress dissent;
- create missing evidence;
- convert UNKNOWN into KNOWN;
- grant human approval;
- overrule the Core Council.

Mandatory distinction:

    JARVIS_COORDINATION != GOVERNANCE_DECISION

---

## 9. Council and Human Boundary

Existing Council / HAR / Human authority remains unchanged.

A worktree review result may become a governance input.

It does not become authority by itself.

Therefore:

    REVIEW_PASS != COUNCIL_APPROVAL
    COUNCIL_DECISION != HUMAN_APPROVAL
    HUMAN_APPROVAL != EXECUTION
    EXECUTION != VERIFIED_SUCCESS

---

## 10. Worktree Knowledge Boundary

Knowledge produced inside a worktree is provisional until verified through the governed return path.

Mandatory distinctions:

    WORKTREE_KNOWLEDGE != CANONICAL_KNOWLEDGE
    SIMULATION_RESULT != VERIFIED_REALITY
    TEST_RESULT != RELEASE_AUTHORIZATION
    FINDING != ACCEPTED_KNOWLEDGE

Worktree findings MAY reference canonical knowledge.

They SHALL NOT silently overwrite it.

---

## 11. Verified Return Path

A verified result MAY be proposed for return into the canonical RSOS Library only after the required governance path completes.

Conceptual path:

    CANONICAL_LIBRARY
        -> WORKTREE_CASE
        -> ROLE_INSTANCES
        -> SPECIALIZED_FINDINGS
        -> CORE_A_D_REVIEW
        -> COUNCIL_SECRETARIAT
        -> CORE_COUNCIL
        -> HAR / HUMAN_AUTHORIZATION
        -> CONTROLLED_INTEGRATION
        -> POST_CHANGE_VERIFICATION
        -> CANONICAL_LIBRARY_UPDATE

The return path SHALL preserve:

- provenance;
- source state;
- evidence;
- decision record;
- authorization;
- verification result;
- prior canonical version.

Mandatory distinction:

    VERIFIED_RESULT != AUTOMATIC_LIBRARY_CHANGE

---

## 12. Canonical Knowledge Promotion Gate

A proposed knowledge change SHALL NOT become canonical solely because:

- a worktree test passed;
- multiple reviewers agree;
- confidence is high;
- a pattern recurred;
- a simulation succeeded;
- JARVIS recommends it.

Canonical promotion requires the applicable:

    evidence
    review
    governance
    authorization
    integration
    verification
    provenance

### 12.1 Review Instance Lifecycle Boundary

Every specialized review instance SHALL have an explicit lifecycle state.

Conceptual lifecycle states MAY include:

    UNINSTANTIATED
    ACTIVE
    REVIEW_SUBMITTED
    CONSOLIDATED
    SUPERSEDED
    TERMINATED
    TERMINATED_WITH_ERROR

Only an instance in a state permitted by the applicable review contract MAY
contribute a finding to the governed review path.

Therefore:

    INSTANCE_EXISTS != INSTANCE_ACTIVE
    INSTANCE_ACTIVE != FINDING_ACCEPTED
    INSTANCE_TERMINATED != PROMOTION_AUTHORITY

### 12.2 Return Path Failure and Containment Boundary

A failure, abort, interruption or timeout within the verified return path
SHALL NOT silently advance canonical promotion.

If required evidence, review state, authorization, integration state or
verification cannot be established, the affected promotion path SHALL remain
blocked until the applicable governed recovery or supersession path has been
completed.

A failed or interrupted return path SHALL preserve sufficient provenance and
state information to determine what was attempted, what completed, what did
not complete, and what remains unresolved.

Therefore:

    RETURN_PATH_INTERRUPTED != PROMOTION_COMPLETED
    PARTIAL_INTEGRATION != VERIFIED_SUCCESS
    FAILED_PROMOTION != CANONICAL_ACCEPTANCE
    RECOVERY_REQUIRED != RECOVERY_COMPLETED

### 12.3 Hard Promotion Constraints

    PROMOTABLE_FINDING != CANONICAL_KNOWLEDGE
    PROMOTION_TRIGGERED != CONTROLLED_INTEGRATION
    AUTOMATIC_PROMOTION = GOVERNANCE_VIOLATION

---

## 13. Failure / Unknown Behavior

If the return path cannot prove the required evidence, authority or verification:

    CANONICAL_PROMOTION = BLOCKED

The worktree result may remain:

    PROVISIONAL
    INCONCLUSIVE
    REFUTED
    UNKNOWN_REMAINS
    UNKNOWABLE
    SUPERSEDED

Unknowns SHALL remain visible.

---

## 14. Explicit Non-Goals

This contract does not:

- implement AI roles;
- create runtime agents;
- create database tables;
- modify routing;
- modify JARVIS;
- modify Council authority;
- modify HAR;
- modify human approval rules;
- activate autonomous review;
- activate autonomous knowledge promotion;
- modify production.

---

## 15. Core Invariants

    INSTANCE != AUTHORITY
    FINDING != FACT
    ASSESSMENT != DECISION
    WORKTREE_RESULT != CANONICAL_KNOWLEDGE

---

## 16. Current Status

    WORKTREE_CASE_MODEL = DRAFT_DEFINED
    ROLE_INSTANCE_BOUNDARY = DRAFT_DEFINED
    SPECIALIZED_FINDING_BOUNDARY = DRAFT_DEFINED
    CORE_REVIEW_BOUNDARY = REFERENCES_EXISTING_GOVERNANCE
    VERIFIED_RETURN_PATH = DRAFT_DEFINED
    RUNTIME_IMPLEMENTATION = NOT_AUTHORIZED
    ROLE_IMPLEMENTATION = NOT_AUTHORIZED
    COMMISSION_IMPLEMENTATION = NOT_AUTHORIZED
    AUTOMATIC_LIBRARY_PROMOTION = BLOCKED

---

## 17. Closing Principle

The Boxenstopp may create evidence, findings and verified improvement candidates.

It does not create truth, authority or canonical knowledge by itself.

Canonical RSOS knowledge evolves only through a traceable path from evidence,
through independent review and governance, to human-authorized integration and
post-change verification.
