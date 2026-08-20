# RSOS-OC-001B — Operational Care Capability Mapping & Gap Contract

Status: DRAFT
Scope: Architecture / Operational Care
Change Class: Documentation Contract
Parent: RSOS-OC-001 Operational Care Foundation
Predecessor: RSOS-OC-001A Operational Care Existing Capability Reality Inventory

Runtime Effects: NONE
Database Effects: NONE
Production Effects: NONE
Commit Authorization: NO

---

## 1. Purpose

This contract maps existing RSOS operational capabilities against the six
Operational Care metarules.

Its purpose is to determine which existing capabilities SHALL be:

- REUSE
- HARDEN
- EXTEND
- NEW

before any Operational Care implementation is designed.

RSOS-OC-001B SHALL NOT create a parallel operating architecture where a
verified RSOS capability already exists.

The governing rule is:

> Existing capability shall be reused where its authority, evidence model,
> side-effect profile and operational semantics are compatible with
> Operational Care.

Existing functionality is not automatically suitable merely because its
name or purpose appears related.

EXISTING != VERIFIED_FOR_OPERATIONAL_CARE

---

## 2. Governing Operational Care Axiom

> Pflege darf das Gepflegte weder gefährden noch aufgrund veralteter
> Realität verändern.

Operational Care SHALL preserve the distinction:

Observation
!= Diagnosis
!= Recommendation
!= Authorization
!= Action
!= Verification

No role acquires implicit execution authority merely because it can observe,
assess or recommend.

Human final authority remains preserved except for explicitly defined,
pre-authorized preservation mandates whose scope is separately governed.

---

## 3. Classification Model

Every mapped capability SHALL receive one of four decisions.

### 3.1 REUSE

The existing capability already provides the required semantics and can be
used without changing its authority model.

### 3.2 HARDEN

The existing capability is conceptually suitable but requires stronger
operational guarantees, verification, isolation, limits or evidence.

### 3.3 EXTEND

The existing capability provides part of the required behavior but requires
an additive Operational Care extension.

### 3.4 NEW

No verified existing capability sufficiently provides the required behavior.

NEW SHALL only be selected after reasonable reuse analysis.

---

## 4. Mandatory Mapping Fields

Every capability mapping SHALL preserve:

- meta_rule
- existing_component
- existing_source
- existing_authority
- existing_evidence
- verified_status
- side_effect_risk
- semantic_gap
- reuse_decision
- required_control
- verification_requirement
- open_unknowns

Verified status SHALL use:

- PRESENT
- PARTIAL
- ABSENT
- UNKNOWN

Reuse decision SHALL use:

- REUSE
- HARDEN
- EXTEND
- NEW

---

## 5. OC-META-001 — Non-Invasive / Bounded Observation

### 5.1 Objective

Observation must not become disruption.

An Operational Care observer SHALL NOT consume sufficient CPU, I/O,
connections, locks or other critical resources to materially degrade the
system it is evaluating.

Observation SHALL be bounded.

Conceptually:

Observation =
ReadOnly
AND Timeout
AND ResourceBudget
AND NoBlockingLock
AND Backoff

### 5.2 Existing Capability Evidence

The existing RSOS environment already contains partial patterns including:

- read-only review and planning modes;
- local lock timeouts;
- local statement timeouts;
- fail-closed timeout semantics;
- read-only route classifications;
- isolated database comparison concepts;
- Hausmeister observation semantics.

### 5.3 Gap

The Reality Inventory did not prove one canonical Operational Care resource
budget covering:

- CPU consumption;
- disk I/O;
- database connection use;
- scan batch size;
- scan frequency;
- observation backoff;
- observer concurrency;
- network request limits.

### 5.4 Decision

VERIFIED_STATUS = PARTIAL
REUSE_DECISION = HARDEN

Existing read-only and timeout mechanisms SHALL be reused.

Operational Care SHALL add bounded observer policy rather than inventing a
second health observation system.

---

## 6. OC-META-002 — Pre-authorized Emergency Preservation

### 6.1 Objective

Emergency preservation is not unrestricted emergency autonomy.

An Operational Care executor MAY perform autonomous preservation only where
a human-approved deterministic preservation playbook already exists.

A preservation action SHALL be:

- defensive;
- bounded;
- minimal;
- pre-authorized;
- auditable;
- reversible where technically possible;
- non-destructive.

### 6.2 Existing Capability Evidence

RSOS already contains:

- Recovery Runbook concepts;
- verified backup/restore evidence;
- rollback mechanisms;
- recovery roles and recovery support;
- fail-closed behavior;
- kill-switch patterns;
- evidence preservation requirements;
- human final authority requirements.

The existing architecture also deliberately forbids implicit or direct
recovery authority for several observer/support roles.

### 6.3 Gap

No canonical Operational Care:

PRE_AUTHORIZED_PRESERVATION_PLAYBOOK

was proven by RSOS-OC-001A.

No generic Facility Executor SHALL infer emergency authority from existing
recovery capability.

### 6.4 Decision

VERIFIED_STATUS = PARTIAL
REUSE_DECISION = EXTEND

Existing recovery, rollback, governance and evidence capabilities SHALL be
reused.

A new narrow preservation-mandate contract is required before autonomous
Facility preservation can exist.

DESTRUCTIVE_AUTONOMOUS_ACTION = FORBIDDEN

---

## 7. OC-META-003 — Stateful Findings, Deduplication and Hysteresis

### 7.1 Objective

Operational Care findings SHALL represent evolving states rather than
notification spam.

The logical model is:

FindingIdentity
+
FindingState
+
ObservationHistory

Finding deduplication SHALL NOT delete historical observation evidence.

FindingDeduplication != EvidenceDeletion

### 7.2 Existing Capability Evidence

RSOS already contains:

- Finding concepts;
- Worktree Finding Records;
- idempotency mechanisms;
- first_seen_at;
- last_seen_at;
- trust/risk materialization patterns;
- existing observation and evidence structures.

### 7.3 Gap

RSOS-OC-001A did not establish a canonical Operational Care implementation
for:

- finding_key;
- cooldown;
- notification suppression;
- state_changed_at;
- last_notified_at;
- hysteresis;
- alert-flapping prevention.

### 7.4 Decision

VERIFIED_STATUS = PARTIAL
REUSE_DECISION = EXTEND

Existing finding identity and temporal state mechanisms SHOULD be reused.

Operational Care SHALL add explicit deduplication, notification and
hysteresis semantics.

---

## 8. OC-META-004 — Pre-Action Revalidation / Evidence Fingerprint

### 8.1 Objective

Authorization is conditional on current reality.

An authorization SHALL NOT be interpreted as permanent permission to act
against a future changed state.

Immediately before an authorized care action:

OriginalEvidence
-> ReObservation
-> CurrentEvidence
-> PreconditionComparison
-> Execute OR Abort

### 8.2 Existing Capability Evidence

RSOS already contains:

- SHA-256 evidence sealing;
- expected commit checks;
- branch and worktree checks;
- before/after verification patterns;
- governance preconditions;
- state and version preconditions;
- rollback anchors.

### 8.3 Required Operational Care Fingerprint

A care authorization SHOULD be capable of binding to relevant fields such
as:

- authorization_id
- target_id
- target_type
- expected_head
- expected_branch
- expected_remote_head
- expected_dirty_state
- expected_untracked_digest
- expected_resource_state
- expected_evidence_hash
- authorized_at
- valid_until

Only material state fields SHALL invalidate authorization.

Unrelated metadata changes SHALL NOT automatically invalidate an action.

### 8.4 Mandatory Abort State

A material state change between authorization and execution SHALL result in:

ABORTED_DUE_TO_STATE_MUTATION

The previous authorization SHALL NOT silently carry forward.

### 8.5 Decision

VERIFIED_STATUS = PARTIAL
REUSE_DECISION = HARDEN

Existing precondition and evidence-sealing mechanisms SHALL be reused and
generalized into a canonical Operational Care Pre-Action Evidence Gate.

---

## 9. OC-META-005 — Observation Failure Is Not Healthy

### 9.1 Objective

The absence of evidence for a problem is not evidence that no problem exists.

NoEvidence != Healthy

### 9.2 Existing Capability Evidence

RSOS already establishes that:

- missing information remains UNKNOWN;
- unavailable observation must remain explicit;
- unknown conditions must not be invented;
- unknown or false safety preconditions may cause PAUSE, BLOCK or FAIL_CLOSED;
- Hausmeister preserves UNKNOWN as a first-class state.

### 9.3 Operational States

Operational Care SHALL support at least:

- OBSERVABLE
- PARTIALLY_OBSERVABLE
- OBSERVATION_DEGRADED
- OBSERVATION_UNAVAILABLE

These states SHALL remain distinguishable from target health states.

### 9.4 Decision

VERIFIED_STATUS = PRESENT
REUSE_DECISION = REUSE

Operational Care SHALL adopt the existing RSOS UNKNOWN and fail-closed
semantics.

No competing health truth model SHALL be created.

---

## 10. OC-META-006 — Out-of-Band Emergency Evidence

### 10.1 Objective

The care system must not depend solely on the system it is protecting.

A primary evidence store failure SHALL NOT make Operational Care completely
blind.

### 10.2 Existing Capability Evidence

RSOS already contains:

- append-only evidence concepts;
- immutable/auditable records;
- reconciliation semantics;
- evidence preservation;
- recovery evidence.

### 10.3 Gap

RSOS-OC-001A did not prove a dedicated Operational Care path that remains
usable when the primary Runtime database or primary audit path is
unavailable.

No verified canonical implementation was found for:

- emergency local journal;
- independent spool;
- out-of-band persistence;
- emergency evidence reconciliation;
- evidence replay after primary-store recovery.

### 10.4 Decision

VERIFIED_STATUS = ABSENT
REUSE_DECISION = NEW

The future solution SHALL remain minimal.

It SHALL NOT silently create a second source of truth.

Conceptually:

PrimaryEvidencePath
+
EmergencyEvidencePath
+
ControlledReconciliation

The EmergencyEvidencePath is evidence continuity, not an alternative
authoritative runtime.

---

## 11. Existing Operational Competence Mapping

### 11.1 Hausmeister

Role:

Technical observation, health interpretation, degradation reporting,
evidence preservation and explicit UNKNOWN handling.

Decision:

REUSE + HARDEN

Hausmeister SHALL remain an observer/technical assessment competence and
shall not silently become Facility Executor.

### 11.2 Doctor Snuggles

Role:

Development worktree support, technical findings, recovery preparation and
human-readable engineering assistance.

Decision:

REUSE + EXTEND

Doctor Snuggles is a candidate competence for the future Gärtner Team.

WORKTREE_DESTRUCTIVE_AUTHORITY = NO

### 11.3 Tinker Bell / Boxenstopp Support

Role:

Translate verified findings into repair/recovery tool candidates and
controlled engineering preparation.

Decision:

REUSE

Tinker Bell SHALL NOT become autonomous approval authority.

### 11.4 Recovery / ARP / Governance

Role:

Recovery, provenance, governance, audit, rollback and evidence boundaries.

Decision:

REUSE + HARDEN

Operational Care SHALL integrate with these capabilities rather than replace
them.

### 11.5 Human Approval

Role:

Final authorization for critical or irreversible actions.

Decision:

REUSE

Emergency preservation exceptions require separately defined
pre-authorized mandates.

---

## 12. Gärtner Team Boundary

The Gärtner Team SHALL operate on development-environment health including:

- worktrees;
- branches;
- detached HEADs;
- untracked state;
- upstream state;
- local/remote divergence;
- orphaned commits;
- stale workspaces;
- recovery readiness;
- repository integrity.

The Gärtner Team MAY:

- observe;
- classify;
- assess;
- recommend;
- prepare recovery;
- prepare archival proposals.

The Gärtner Team SHALL NOT autonomously:

- git clean;
- git reset --hard;
- delete branches;
- delete worktrees;
- delete untracked files;
- force-push;
- rewrite history.

GARDENER_DESTRUCTIVE_AUTHORITY = NO

---

## 13. Facility System Boundary

The Facility System SHALL cover technical operating-environment health
including:

- services;
- containers;
- databases;
- storage;
- volumes;
- network dependencies;
- certificates;
- backup;
- restore readiness;
- logs;
- resource pressure;
- recovery readiness.

The Facility System SHALL distinguish:

Observation
Assessment
Recommendation
Authorization
Execution
Verification

The Facility System SHALL NOT derive execution authority merely from
severity.

CRITICAL != AUTONOMOUS_AUTHORITY

---

## 14. Care Finding Minimum Model

A future canonical Care Finding SHOULD support:

- care_finding_id
- finding_key
- scope
- target_type
- target_id
- observation
- evidence
- severity
- confidence
- unknowns
- first_seen_at
- last_seen_at
- state_changed_at
- observed_at
- recorded_at
- recommended_action
- requires_human_approval
- trace_id

Temporal fields SHALL follow the RSOS Temporal Semantics Contract once the
relevant temporal contract is integrated into this branch.

observed_at != recorded_at

Timestamp ordering SHALL NOT by itself prove causality.

---

## 15. Operational State Model

A general Operational Care health sequence MAY use:

HEALTHY
-> ATTENTION
-> DEGRADED
-> CRITICAL
-> RECOVERY

Observation availability is orthogonal and SHALL NOT be collapsed into the
health state.

Example:

health_state = UNKNOWN
observation_state = OBSERVATION_UNAVAILABLE

or:

health_state = DEGRADED
observation_state = OBSERVABLE

---

## 16. Side-Effect Principle

Every future Operational Care capability SHALL be classified by side-effect
class before execution authority is considered.

Minimum classes:

- READ_ONLY
- REVERSIBLE
- CONSERVING
- MUTATING
- DESTRUCTIVE

Autonomous execution SHALL NOT be inferred from READ_ONLY observation rights.

DESTRUCTIVE actions require explicit human authorization.

---

## 17. Current Capability Matrix

| Meta Rule | Current Status | Decision | Primary Existing Capability | Main Gap |
|---|---|---|---|---|
| OC-META-001 | PARTIAL | HARDEN | Hausmeister / read-only / timeout / observer-integrity patterns | canonical bounded observer policy and verified resource budgets |
| OC-META-002 | PARTIAL | EXTEND | Recovery / rollback / governance / preservation mandate / playbook specification / first candidate | verified and authorized executable preservation playbook |
| OC-META-003 | PARTIAL | EXTEND | findings / idempotency / first_seen / last_seen / observer hysteresis / review lifecycle semantics | canonical finding dedup, cooldown and state policy |
| OC-META-004 | PARTIAL | HARDEN | SHA / preconditions / before-after gates | canonical Pre-Action Evidence Fingerprint enforcement |
| OC-META-005 | PRESENT | REUSE | UNKNOWN / fail-closed / Hausmeister / observer-integrity semantics | no material architectural gap identified |
| OC-META-006 | ABSENT | NEW | append-only evidence / reconciliation concepts | independent emergency evidence path |

---

## 18. Explicit Non-Goals

RSOS-OC-001B does NOT authorize:

- Runtime implementation;
- database schema changes;
- migrations;
- worker creation;
- production deployment;
- automated repository cleanup;
- autonomous recovery execution;
- autonomous destructive actions;
- emergency playbook execution;
- new source-of-truth systems.

---

## 19. Open Unknowns

The following remain intentionally open:

1. Which existing Runtime tables can safely represent Care Findings?
2. Whether a dedicated Care Finding object is required.
3. Whether existing trust/risk materialization can be reused directly.
4. Exact observer CPU, I/O and DB connection budgets.
5. Exact hysteresis thresholds.
6. Exact cooldown policies.
7. Exact Emergency Evidence transport and persistence mechanism.
8. Emergency Evidence reconciliation semantics.
9. Exact Preservation Playbook governance format.
10. Interaction between OC temporal fields and RSOS-TIME-001 after integration.
11. Whether Facility and Gärtner share one finding schema or only a common contract.
12. Which operational actions may ever qualify as pre-authorized preservation.

Unknowns SHALL remain UNKNOWN until separately verified.

### Reconciliation Note

Subsequent Operational Care contracts have reduced several gaps originally
identified by this mapping.

Verified follow-up architecture now includes:

- RSOS-OC-META-002A Pre-authorized Preservation Mandate Contract;
- RSOS-OC-META-002B Preservation Playbook Specification;
- RSOS-OC-META-002C First Preservation Playbook Candidate;
- RSOS-OC-META-003B Minimal Maintenance Governance Contract;
- RSOS-OC-META-003C Minimal Implementation Boundary Contract;
- RSOS-OC-META-003D Worktree Instance & Review Boundary Contract;
- RSOS Assessment Observer Integrity Boundary;
- RSOS ECC-006 Evolution Candidate Promotion Contract.

These contracts reduce previously identified semantic gaps but SHALL NOT be
interpreted as proof of Runtime implementation, production authorization or
execution authority.

Therefore:

    CONTRACT_DEFINED != CAPABILITY_IMPLEMENTED
    CANDIDATE_DEFINED != EXECUTION_AUTHORIZED
    IMPLEMENTATION_BOUNDARY_DEFINED != IMPLEMENTATION_COMPLETE
    GAP_REDUCED != GAP_CLOSED

---

## 20. Gate for Next Phase

RSOS-OC-001C SHALL NOT begin implementation automatically.

Before implementation:

1. this mapping must be reviewed;
2. all existing capability claims must be checked against repository reality;
3. conflicts and duplicated authority must be identified;
4. the temporal dependency must be resolved;
5. emergency-preservation boundaries must receive separate governance review;
6. out-of-band evidence architecture must receive an independent failure-mode review;
7. human approval must be recorded.

---

## 21. Contract Result

RSOS_OC_001B_CAPABILITY_MAPPING = DRAFT
RSOS_OC_001B_EXISTING_CAPABILITIES_REUSED = REQUIRED
RSOS_OC_001B_PARALLEL_ARCHITECTURE = FORBIDDEN
RSOS_OC_001B_HUMAN_FINAL_AUTHORITY = PRESERVED
RSOS_OC_001B_DESTRUCTIVE_AUTONOMY = FORBIDDEN
RSOS_OC_001B_UNKNOWN_PRESERVATION = REQUIRED

RSOS_OC_001B_RUNTIME_CHANGE_AUTHORIZED = NO
RSOS_OC_001B_DATABASE_CHANGE_AUTHORIZED = NO
RSOS_OC_001B_PRODUCTION_CHANGE_AUTHORIZED = NO
RSOS_OC_001B_COMMIT_AUTHORIZED = NO
