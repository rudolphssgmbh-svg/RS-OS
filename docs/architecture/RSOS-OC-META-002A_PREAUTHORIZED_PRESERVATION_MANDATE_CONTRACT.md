# RSOS-OC-META-002A — Pre-authorized Preservation Mandate Contract

Status: DRAFT
Scope: Architecture / Operational Care / Emergency Preservation
Change Class: Documentation Contract
Parent: RSOS-OC-001 Operational Care Foundation
Predecessor: RSOS-OC-001B Operational Care Capability Mapping & Gap Contract

Runtime Effects: NONE
Database Effects: NONE
Production Effects: NONE
Emergency Execution Effects: NONE
Commit Authorization: NO

---

## 1. Purpose

This contract defines the governance boundary for pre-authorized emergency
preservation in RSOS Operational Care.

Its purpose is not to create unrestricted emergency autonomy.

Its purpose is to define the narrow conditions under which a previously
human-approved, deterministic and conserving preservation action MAY later be
eligible for autonomous execution.

The governing principle is:

> Emergency preservation is not emergency autonomy.

A second governing principle is:

> Existing recovery capability does not imply preservation authority.

A third governing principle is:

> Existing autonomous capability in another RSOS subsystem does not transfer
> authority into Operational Care.

---

## 2. Authority Model

Operational Care SHALL preserve the distinction:

Observation
!= Diagnosis
!= Recommendation
!= Authorization
!= Action

A Facility Executor SHALL NOT infer execution authority from:

- severity;
- CRITICAL state;
- recovery capability;
- rollback capability;
- backup availability;
- existing defense autonomy;
- governance metadata;
- observer authority;
- administrator privileges.

Therefore:

    CRITICAL != AUTONOMOUS_AUTHORITY

and:

    RECOVERY_CAPABILITY != PRESERVATION_AUTHORITY

and:

    DEFENSE_AUTONOMY != FACILITY_AUTHORITY

---

## 3. Human Final Authority

Human final authority remains preserved.

A preservation mandate may only become PRE_AUTHORIZED after explicit human
approval of the exact:

- purpose;
- action class;
- target scope;
- trigger conditions;
- safety conditions;
- evidence requirements;
- maximum effect;
- maximum duration;
- rollback or stop path;
- expiry;
- revocation semantics.

Pre-authorization does not transfer general decision authority to the
executor.

---

## 4. Preservation Action Definition

A preservation action is an action whose primary purpose is to prevent
immediate loss of availability, integrity, recoverability or evidence while
minimizing irreversible change.

A preservation action MUST be:

- deterministic;
- narrowly scoped;
- pre-authorized;
- bounded;
- reversible where technically possible;
- conserving rather than optimizing;
- fail-closed;
- auditable;
- evidence-producing;
- revocable;
- time-limited;
- non-destructive.

---

## 5. Forbidden Autonomous Actions

The following classes SHALL NOT qualify for autonomous preservation:

- deletion of business data;
- deletion of audit evidence;
- deletion of backups;
- deletion of database volumes;
- DROP DATABASE;
- DROP TABLE;
- TRUNCATE;
- destructive repository cleanup;
- git reset --hard;
- git clean;
- force push;
- removal of unverified worktrees;
- permanent container deletion where state may be lost;
- permanent volume deletion;
- secret rotation unless separately governed;
- schema mutation;
- production deployment;
- migration execution;
- restoration over production state;
- irreversible configuration changes.

Therefore:

    DESTRUCTIVE_AUTONOMOUS_ACTION = FORBIDDEN

---

## 6. Candidate Preservation Classes

This contract defines candidate classes only.

No candidate class is executable merely because it appears here.

Potential future preservation classes may include:

- PAUSE_NON_CRITICAL_WORKER;
- DISABLE_NON_CRITICAL_BACKGROUND_JOB;
- ENTER_READ_ONLY_PROTECTIVE_MODE;
- ISOLATE_AFFECTED_COMPONENT;
- BLOCK_NEW_NON_CRITICAL_WORK;
- REDUCE_OBSERVER_FREQUENCY;
- DEFER_NON_CRITICAL_MAINTENANCE;
- PRESERVE_DIAGNOSTIC_EVIDENCE;
- ACTIVATE_PREDEFINED_FAIL_CLOSED_MODE.

Each class requires a separately approved playbook before execution.

---

## 7. Preservation Mandate Identity

Every future preservation mandate SHALL possess a stable identity.

Minimum fields SHOULD include:

- preservation_mandate_id;
- playbook_id;
- playbook_version;
- action_class;
- target_type;
- target_scope;
- trigger_definition;
- safety_preconditions;
- evidence_requirements;
- maximum_duration;
- maximum_scope;
- rollback_or_stop_reference;
- valid_from;
- valid_until;
- approved_by;
- approved_at;
- approval_reference;
- revocation_state;
- kill_switch_reference.

---

## 8. Determinism Requirement

A pre-authorized playbook SHALL define exact allowed operations.

The executor SHALL NOT:

- invent commands;
- broaden target scope;
- substitute another action;
- alter thresholds;
- change action order;
- add destructive cleanup;
- infer additional authority.

If the prescribed action cannot be executed exactly within its mandate, the
executor SHALL fail closed.

---

## 9. Trigger Requirements

A trigger SHALL be explicit and machine-verifiable.

Examples of trigger dimensions may include:

- disk pressure;
- memory pressure;
- unavailable dependency;
- queue saturation;
- evidence-storage risk;
- health-state degradation.

A trigger MUST NOT depend solely on a vague classification such as CRITICAL.

A trigger SHALL identify:

- metric or state;
- threshold or condition;
- observation source;
- observation freshness;
- confidence requirement;
- hysteresis or persistence requirement where applicable.

---

## 10. Safety Preconditions

Before execution, all mandatory safety preconditions SHALL evaluate TRUE.

FALSE or UNKNOWN SHALL result in:

    BLOCK
or
    FAIL_CLOSED

Mandatory safety checks SHOULD include:

- target identity;
- mandate validity;
- playbook version;
- kill-switch state;
- authorization validity;
- scope validity;
- current evidence freshness;
- current target state;
- rollback or stop readiness;
- evidence path availability where required.

UNKNOWN MUST NOT be interpreted as safe.

---

## 11. Pre-Action Revalidation

Authorization is conditional on current reality.

Immediately before execution, the executor SHALL perform bounded
re-observation of material target state.

The current Evidence Fingerprint SHALL be compared with the fingerprint
associated with the original trigger and authorization context.

If a material state mutation is detected:

    ABORTED_DUE_TO_STATE_MUTATION

The previous authorization SHALL NOT silently carry forward.

---

## 12. Evidence Fingerprint

A future Evidence Fingerprint SHOULD bind relevant material state, including
where appropriate:

- target identity;
- target version;
- configuration hash;
- active process identity;
- health state;
- resource state;
- worktree state;
- dependency state;
- relevant timestamps;
- observation source references.

Only material fields SHALL invalidate execution.

The material field set SHALL be defined by the playbook.

---

## 13. Temporal Validity

A preservation mandate SHALL have bounded temporal validity.

Required concepts include:

- approved_at;
- valid_from;
- valid_until;
- observed_at;
- revalidated_at;
- executed_at;
- expired_at;
- revoked_at where applicable.

Expired mandates SHALL NOT execute.

Old evidence SHALL NOT become current merely because authorization still
exists.

---

## 14. Kill Switch

Every executable preservation playbook SHALL have a fail-closed kill-switch
path.

The kill switch SHALL override:

- trigger state;
- existing pre-authorization;
- executor readiness.

Kill-switch states other than explicit ALLOW SHALL block autonomous
preservation.

Therefore:

    KILL_SWITCH_UNKNOWN = BLOCK
    KILL_SWITCH_FAILURE = BLOCK
    KILL_SWITCH_DENY = BLOCK

---

## 15. Execution Boundaries

Every playbook SHALL define maximum impact.

Boundaries SHOULD include:

- maximum affected targets;
- maximum runtime;
- maximum retries;
- maximum concurrent actions;
- maximum resource consumption where practical;
- allowed host or tenant scope;
- allowed service class.

No preservation action may silently expand beyond these boundaries.

---

## 16. Retry Semantics

Retry authority SHALL be explicit.

A failed preservation action SHALL NOT retry indefinitely.

A playbook SHOULD define:

- maximum_retry_count;
- retry_delay;
- retryable_reason_codes;
- non_retryable_reason_codes.

UNKNOWN failure cause SHALL default to no autonomous retry unless separately
authorized.

---

## 17. Rollback / Stop Semantics

A preservation playbook SHALL identify either:

- a verified rollback path;
- a verified stop path;
- or an explicit statement that the action is self-reverting.

Rollback capability MUST NOT be assumed.

Backup availability MUST NOT be represented as rollback proof.

Restore capability MUST NOT be represented as restore authorization.

---

## 18. Evidence Requirements

Every attempted execution SHALL create evidence for:

- trigger observation;
- mandate identity;
- playbook identity/version;
- authorization reference;
- pre-action revalidation;
- Evidence Fingerprint;
- action start;
- action result;
- abort result where applicable;
- rollback or stop result;
- final observed state.

The evidence record SHALL distinguish:

Observation
from
Interpretation
from
Authorization
from
Execution Result.

---

## 19. Out-of-Band Evidence Dependency

Operational Care SHALL NOT assume that the protected primary system remains
available during an emergency.

Where the normal audit or database path is unavailable, emergency
preservation requires an independent evidence-continuity mechanism.

This contract does not define that mechanism.

That requirement belongs to OC-META-006.

Until an appropriate evidence path exists, a playbook whose required
evidence cannot be preserved SHALL fail closed unless a separately approved
bounded fallback evidence mechanism exists.

---

## 20. Existing Recovery Reuse

Existing RSOS recovery, rollback, governance, savepoint, approval and
verification capabilities MAY be reused.

They SHALL NOT automatically become Emergency Preservation authority.

Reuse requires explicit mapping between:

- existing capability;
- preservation mandate;
- safety boundary;
- evidence requirement;
- human approval;
- execution scope.

---

## 21. Existing Defense Autonomy Boundary

Existing defense or autonomous-defense capability belongs to its own governed
domain.

Operational Care SHALL NOT inherit authority by similarity.

Therefore:

    EXISTING_DEFENSE_AUTONOMY_REUSED_AS_FACILITY_AUTHORITY = NO

Any future integration requires explicit governance review and human approval.

---

## 22. Playbook Lifecycle

A preservation playbook MAY progress through:

    DRAFT
    -> REVIEWED
    -> VERIFIED
    -> HUMAN_APPROVED
    -> PRE_AUTHORIZED
    -> ACTIVE
    -> SUSPENDED
    -> REVOKED
    -> RETIRED

No state may be skipped merely because the playbook is technically executable.

---

## 23. Execution Decision

A future executor may execute only if all conditions evaluate TRUE:

    mandate_valid
    AND playbook_active
    AND trigger_valid
    AND safety_preconditions_valid
    AND evidence_current
    AND evidence_fingerprint_valid
    AND kill_switch_allows
    AND scope_valid
    AND temporal_validity_valid

Otherwise:

    EXECUTION = BLOCKED

---

## 24. First Playbook Principle

The first future executable preservation playbook SHOULD be:

- low impact;
- reversible or safely stoppable;
- non-destructive;
- technically simple;
- independently observable;
- easy to verify;
- easy to abort.

No specific first playbook is authorized by this contract.

---

## 25. Current Status

Current verified architecture state:

    RECOVERY_CAPABILITY = PRESENT
    GOVERNANCE_CAPABILITY = PRESENT
    HUMAN_FINAL_AUTHORITY = PRESERVED
    FAIL_CLOSED_CAPABILITY = PRESENT
    KILL_SWITCH_PATTERN = PRESENT
    BACKUP_RESTORE_CAPABILITY = PARTIAL_VERIFIED
    PREAUTHORIZED_PRESERVATION_PLAYBOOK = NOT_YET_DEFINED
    PRESERVATION_MANDATE_MODEL = DEFINED_BY_THIS_DRAFT
    DESTRUCTIVE_AUTONOMOUS_ACTION = FORBIDDEN
    EMERGENCY_EXECUTION = NOT_AUTHORIZED

---

## 26. Authority Boundary

RSOS_OC_META_002A_DOCUMENTATION_DRAFT_AUTHORIZED = YES
RSOS_OC_META_002A_COMMIT_AUTHORIZED = NO
RSOS_OC_META_002A_RUNTIME_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002A_DATABASE_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002A_PRODUCTION_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002A_EMERGENCY_EXECUTION_AUTHORIZED = NO
RSOS_OC_META_002A_PLAYBOOK_EXECUTION_AUTHORIZED = NO
RSOS_OC_META_002A_DESTRUCTIVE_AUTONOMY = FORBIDDEN

---

## 27. Closing Principle

A preservation mandate exists to preserve the system until responsible
decision-making can continue.

It SHALL NOT become a hidden path to unrestricted autonomy.

The governing chain is:

    Observe
    -> Verify Trigger
    -> Validate Mandate
    -> Revalidate Reality
    -> Verify Evidence Fingerprint
    -> Verify Kill Switch
    -> Execute Only Approved Preservation
    -> Preserve Evidence
    -> Reobserve
    -> Escalate to Human Governance

Anything outside the approved mandate fails closed.
