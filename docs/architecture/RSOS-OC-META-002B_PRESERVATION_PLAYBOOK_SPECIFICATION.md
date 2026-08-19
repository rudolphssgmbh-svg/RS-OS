# RSOS-OC-META-002B — Preservation Playbook Specification

Status: DRAFT
Scope: Architecture / Operational Care / Preservation Playbooks
Change Class: Documentation Contract
Parent: RSOS-OC-META-002A Pre-authorized Preservation Mandate Contract

Runtime Effects: NONE
Database Effects: NONE
Production Effects: NONE
Emergency Execution Effects: NONE
Playbook Activation Effects: NONE
Commit Authorization: NO

---

## 1. Purpose

This specification defines the mandatory structure and governance requirements
for every future RSOS Operational Care preservation playbook.

A playbook is not authority.

A playbook specification is not execution permission.

A technically valid playbook is not automatically an active playbook.

The governing chain is:

    Mandate Contract
    -> Playbook Specification
    -> Concrete Playbook
    -> Verification
    -> Human Approval
    -> Pre-Authorization
    -> Activation

No stage may be skipped.

---

## 2. Core Principle

A Preservation Playbook SHALL be:

- deterministic;
- narrowly scoped;
- versioned;
- bounded;
- non-destructive;
- fail-closed;
- auditable;
- revocable;
- temporally bounded;
- independently identifiable;
- evidence-producing;
- revalidation-aware.

The playbook SHALL NOT infer authority from severity or technical capability.

Therefore:

    PLAYBOOK_EXISTS != EXECUTION_AUTHORITY
    CRITICAL != EXECUTION_AUTHORITY
    TECHNICAL_CAPABILITY != AUTHORIZATION

---

## 3. Mandatory Playbook Identity

Every playbook SHALL contain:

- playbook_id;
- playbook_version;
- title;
- purpose;
- action_class;
- target_type;
- target_scope;
- owner_role;
- governing_mandate_id;
- created_at;
- reviewed_at;
- approved_at;
- valid_from;
- valid_until;
- revocation_state;
- status.

The combination:

    playbook_id + playbook_version

SHALL uniquely identify the executable specification.

---

## 4. Playbook Status Model

Allowed lifecycle states:

    DRAFT
    REVIEWED
    VERIFIED
    HUMAN_APPROVED
    PRE_AUTHORIZED
    ACTIVE
    SUSPENDED
    REVOKED
    RETIRED

Execution eligibility exists only in:

    ACTIVE

and only if every runtime-independent governance condition remains valid.

ACTIVE does not override fail-closed conditions.

---

## 5. Action Class

Every playbook SHALL define exactly one primary action class.

Examples of eligible future classes may include:

- PAUSE_NON_CRITICAL_WORKER;
- DISABLE_NON_CRITICAL_BACKGROUND_JOB;
- ENTER_READ_ONLY_PROTECTIVE_MODE;
- ISOLATE_AFFECTED_COMPONENT;
- BLOCK_NEW_NON_CRITICAL_WORK;
- REDUCE_OBSERVER_FREQUENCY;
- DEFER_NON_CRITICAL_MAINTENANCE;
- PRESERVE_DIAGNOSTIC_EVIDENCE;
- ACTIVATE_PREDEFINED_FAIL_CLOSED_MODE.

These are specification examples only.

No action class is authorized by inclusion in this document.

---

## 6. Forbidden Action Classes

The following SHALL NOT qualify as autonomous preservation playbooks:

- destructive data deletion;
- audit deletion;
- backup deletion;
- database destruction;
- DROP DATABASE;
- DROP TABLE;
- TRUNCATE;
- destructive repository cleanup;
- git reset --hard;
- git clean;
- force push;
- permanent volume deletion;
- destructive container removal where state may be lost;
- schema migration;
- schema mutation;
- production deployment;
- restoration over production state;
- arbitrary shell execution;
- dynamically generated commands;
- command substitution invented at runtime.

Therefore:

    DESTRUCTIVE_PLAYBOOK = FORBIDDEN
    ARBITRARY_COMMAND_PLAYBOOK = FORBIDDEN

---

## 7. Trigger Specification

Every playbook SHALL define a machine-verifiable trigger.

Mandatory trigger fields:

- trigger_id;
- trigger_type;
- observed_metric_or_state;
- comparison_operator;
- threshold_or_expected_state;
- persistence_duration;
- hysteresis_rule;
- observation_source;
- maximum_observation_age;
- required_confidence;
- unknown_behavior.

Unknown behavior SHALL default to:

    BLOCK

A vague severity such as CRITICAL SHALL NOT be sufficient on its own.

---

## 8. Target Scope

Every playbook SHALL define its exact target scope.

Required target fields:

- target_type;
- target_identifier_rule;
- allowed_tenants;
- allowed_hosts;
- allowed_services;
- excluded_targets;
- maximum_target_count.

Wildcard scope SHALL be forbidden unless specifically reviewed and approved.

A playbook SHALL NOT expand its own target scope.

---

## 9. Safety Preconditions

Every playbook SHALL declare mandatory safety preconditions.

Typical fields SHOULD include:

- target_identity_verified;
- current_state_verified;
- mandate_valid;
- playbook_version_valid;
- kill_switch_allows;
- authorization_current;
- evidence_current;
- evidence_path_available;
- rollback_or_stop_ready;
- scope_valid;
- temporal_validity_valid;
- dependency_state_known.

All required preconditions SHALL evaluate TRUE.

FALSE or UNKNOWN results in:

    EXECUTION = BLOCKED

---

## 10. Evidence Fingerprint Specification

Every playbook SHALL define which material fields form its Evidence Fingerprint.

Potential fields include:

- target identity;
- process identity;
- container identity;
- image identifier;
- configuration hash;
- repository HEAD;
- worktree state;
- dependency state;
- resource state;
- health state;
- tenant scope;
- observation timestamps.

The playbook SHALL identify:

- fingerprint_fields;
- fingerprint_hash_algorithm;
- material_fields;
- ignored_non_material_fields.

A changed material field invalidates the current execution authorization.

---

## 11. Pre-Action Revalidation

Immediately before action execution, the executor SHALL:

1. re-observe the target;
2. rebuild the Evidence Fingerprint;
3. compare material state;
4. validate temporal freshness;
5. validate kill-switch state;
6. validate mandate state;
7. validate playbook state.

Any material mismatch results in:

    ABORTED_DUE_TO_STATE_MUTATION

No stale authorization SHALL silently carry forward.

---

## 12. Allowed Operation Specification

A playbook SHALL define exact allowed operations.

Each operation SHOULD contain:

- operation_id;
- operation_type;
- exact parameters;
- parameter bounds;
- target binding;
- timeout;
- expected outcome;
- allowed exit states;
- forbidden substitutions.

The executor SHALL NOT:

- invent parameters;
- alter command order;
- increase scope;
- increase duration;
- increase retry count;
- replace one operation with another;
- append cleanup commands;
- execute arbitrary fallback commands.

---

## 13. Maximum Effect Envelope

Every playbook SHALL define a Maximum Effect Envelope.

Fields SHOULD include:

- maximum_target_count;
- maximum_duration;
- maximum_retry_count;
- maximum_concurrency;
- maximum_cpu_budget where measurable;
- maximum_io_budget where measurable;
- maximum_memory_budget where measurable;
- maximum_service_scope;
- maximum_tenant_scope.

These values are governance limits.

They SHALL NOT be inferred from observation baselines.

---

## 14. Retry Policy

Retry behavior SHALL be explicit.

Required fields:

- retry_allowed;
- maximum_retry_count;
- retry_delay;
- retryable_reason_codes;
- non_retryable_reason_codes;
- retry_revalidation_required.

Each retry SHALL require fresh revalidation.

Unknown failure causes SHALL NOT be autonomously retried unless explicitly
permitted.

---

## 15. Kill Switch

Every executable playbook SHALL define:

- kill_switch_reference;
- allowed_state;
- denied_states;
- unknown_state_behavior;
- failure_behavior.

Mandatory semantics:

    KILL_SWITCH_ALLOW = MAY_CONTINUE
    KILL_SWITCH_DENY = BLOCK
    KILL_SWITCH_UNKNOWN = BLOCK
    KILL_SWITCH_FAILURE = BLOCK

The kill switch overrides existing pre-authorization.

---

## 16. Temporal Validity

Each playbook SHALL define:

- approved_at;
- valid_from;
- valid_until;
- maximum_execution_delay_after_trigger;
- maximum_observation_age;
- maximum_revalidation_age.

Expired playbooks SHALL NOT execute.

Expired observations SHALL NOT satisfy current safety conditions.

---

## 17. Revocation

Every playbook SHALL be revocable.

Revocation SHALL take precedence over:

- ACTIVE status;
- trigger state;
- pending execution;
- previous authorization.

Required revocation semantics:

    REVOKED = BLOCK

The executor SHALL check revocation immediately before execution.

---

## 18. Rollback / Stop Specification

Every playbook SHALL identify one of:

- rollback_playbook_reference;
- stop_operation_reference;
- self_reverting_behavior.

The selected path SHALL be verified before ACTIVE status.

Rollback capability SHALL NOT be assumed.

A backup SHALL NOT substitute for a verified rollback or stop path.

---

## 19. Evidence Production

Every execution attempt SHALL produce evidence for:

- playbook identity and version;
- mandate identity;
- human approval reference;
- trigger evidence;
- preconditions;
- pre-action Evidence Fingerprint;
- revalidation result;
- kill-switch result;
- operation start;
- operation result;
- retry result;
- abort result;
- rollback or stop result;
- final observation.

Evidence SHALL distinguish:

    Observation
    Interpretation
    Authorization
    Execution
    Outcome
    Verification

---

## 20. Out-of-Band Evidence

A playbook SHALL declare:

- normal_evidence_path;
- emergency_evidence_required;
- fallback_evidence_reference;
- evidence_unavailable_behavior.

Until OC-META-006 provides an approved independent Emergency Evidence Path,
the default SHALL be:

    REQUIRED_EVIDENCE_UNAVAILABLE = BLOCK

unless a separately approved fallback mechanism exists.

---

## 21. Authorization Binding

Every future ACTIVE playbook SHALL bind to an explicit human approval.

Required approval binding SHOULD include:

- approval_id;
- approver_identity;
- approved_playbook_id;
- approved_playbook_version;
- approved_action_class;
- approved_target_scope;
- approved_effect_envelope;
- approved_validity_period;
- approval_hash.

A modified playbook version requires new approval.

Therefore:

    PLAYBOOK_VERSION_CHANGE = REAPPROVAL_REQUIRED

---

## 22. No Authority Inheritance

A playbook SHALL NOT inherit authority from:

- Defense Layer;
- Hausmeister;
- Gärtner;
- JARVIS coordination;
- administrator access;
- root access;
- database ownership;
- existing recovery routes;
- existing rollback routes;
- autonomous worker capability.

Therefore:

    TECHNICAL_PRIVILEGE != GOVERNANCE_AUTHORITY

---

## 23. Verification Requirements

Before a playbook may become VERIFIED, it SHALL pass:

- static contract review;
- authority-boundary review;
- destructive-operation scan;
- target-scope review;
- trigger review;
- fail-closed review;
- temporal-validity review;
- revocation review;
- kill-switch review;
- evidence-path review;
- rollback/stop review;
- isolated execution test where technically applicable.

Production testing is not implied.

---

## 24. Activation Requirements

A playbook may become ACTIVE only after:

    specification_valid
    AND implementation_verified
    AND isolated_test_passed
    AND rollback_or_stop_verified
    AND evidence_path_valid
    AND human_approval_valid
    AND preauthorization_valid
    AND kill_switch_valid
    AND temporal_validity_valid

Otherwise:

    ACTIVATION = BLOCKED

---

## 25. Execution Decision Matrix

Execution may proceed only when all conditions are TRUE:

| Condition | Required |
|---|---|
| Playbook ACTIVE | YES |
| Mandate valid | YES |
| Human approval valid | YES |
| Trigger valid | YES |
| Trigger evidence fresh | YES |
| Scope valid | YES |
| Safety preconditions TRUE | YES |
| Evidence Fingerprint valid | YES |
| Pre-action revalidation PASS | YES |
| Kill switch ALLOW | YES |
| Revocation absent | YES |
| Temporal validity PASS | YES |
| Evidence path available | YES |
| Maximum Effect Envelope respected | YES |

Any FALSE or UNKNOWN mandatory condition:

    EXECUTION = BLOCKED

---

## 26. First Concrete Playbook Selection Rule

The first concrete Preservation Playbook SHALL be selected for minimum
operational risk.

Preferred characteristics:

- low impact;
- non-destructive;
- reversible or stoppable;
- narrow target scope;
- short duration;
- no database mutation;
- no repository mutation;
- no deployment;
- independent observability;
- simple verification.

This specification does not select or authorize the first concrete playbook.

---

## 27. Current Capability State

Current state after OC-META-002A:

    PRESERVATION_MANDATE_CONTRACT = DEFINED
    PLAYBOOK_SPECIFICATION = DEFINED_BY_THIS_DRAFT
    CONCRETE_PRESERVATION_PLAYBOOK = NOT_DEFINED
    PLAYBOOK_IMPLEMENTATION = NOT_AUTHORIZED
    PLAYBOOK_ACTIVATION = NOT_AUTHORIZED
    EMERGENCY_EXECUTION = NOT_AUTHORIZED
    DESTRUCTIVE_AUTONOMY = FORBIDDEN

---

## 28. Authority Boundary

RSOS_OC_META_002B_DOCUMENTATION_DRAFT_AUTHORIZED = YES
RSOS_OC_META_002B_COMMIT_AUTHORIZED = NO
RSOS_OC_META_002B_RUNTIME_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002B_DATABASE_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002B_PRODUCTION_CHANGE_AUTHORIZED = NO
RSOS_OC_META_002B_PLAYBOOK_IMPLEMENTATION_AUTHORIZED = NO
RSOS_OC_META_002B_PLAYBOOK_ACTIVATION_AUTHORIZED = NO
RSOS_OC_META_002B_EMERGENCY_EXECUTION_AUTHORIZED = NO
RSOS_OC_META_002B_DESTRUCTIVE_AUTONOMY = FORBIDDEN

---

## 29. Closing Principle

A Preservation Playbook is a pre-reviewed technical procedure operating under
a human-approved mandate.

It is not an autonomous decision maker.

Its authority is bounded by:

    identity
    + version
    + mandate
    + target scope
    + trigger
    + safety preconditions
    + Evidence Fingerprint
    + temporal validity
    + kill switch
    + Maximum Effect Envelope
    + evidence requirements
    + human approval

Anything outside those boundaries:

    FAILS CLOSED
