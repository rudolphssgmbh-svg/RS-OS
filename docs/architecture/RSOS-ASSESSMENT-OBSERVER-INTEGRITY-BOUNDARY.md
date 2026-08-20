# RSOS Assessment Observer Integrity Boundary

Status: DRAFT
Scope: Assessment / Observation / Integrity Boundary
Change Class: Documentation Contract

References:
- RSOS-PF-001C Hausmeister Health Observation Contract
- RSOS-PF-002D0B External Observer Boundary Seal
- RSOS-LIB-003 Knowledge Unit Specification
- existing RSOS Source Quality / Evidence Quality capabilities
- existing RSOS UNKNOWN, Verification, Governance and Human Authorization contracts

Effects:
Runtime: NONE
Database: NONE
Schema: NONE
Production: NONE
Compiler: NONE
Observer Implementation: NONE

---

## 1. Purpose

This contract defines the minimum integrity boundary required before an
observation may participate in an RSOS assessment strategy.

It introduces no new observer role and no new governance authority.

---

## 2. Core Invariants

    OBSERVER_HEALTH != OBSERVATION_RESULT
    HEALTHY_OBSERVER != TRUE_OBSERVATION
    UNHEALTHY_OBSERVER != FALSE_OBSERVATION

    SOURCE_QUALITY != OBSERVER_HEALTH
    EVIDENCE_QUALITY != OBSERVER_HEALTH

    AGREEMENT != INDEPENDENCE
    MULTIPLE_OBSERVERS != INDEPENDENT_EVIDENCE

    DEGRADED != COMPROMISED
    STALE != FALSE
    FRESH != VERIFIED
    DRIFT != CORRUPTION

    RECOVERY_SIGNAL != RECOVERED_OBSERVER
    ONE_HEALTHY_SAMPLE != RESTORED_TRUST
    DEGRADATION_THRESHOLD != RECOVERY_THRESHOLD

    EXTERNAL != INDEPENDENT
    INTERNAL != DEPENDENT
    SHARED_FAILURE_DOMAIN != INDEPENDENT_CONFIRMATION

---

## 3. Observer Integrity Record

Where relevant, an observation SHOULD expose or reference:

    observer_identity
    observer_health
    integrity_status
    freshness_status
    independence_status
    drift_status
    aggregation_eligibility
    degradation_reason

    observed_at
    produced_at
    received_at
    evaluated_at
    last_state_transition
    state_duration
    stability_duration
    recovery_state
    flap_status

    dependency_reference
    failure_domain_reference
    source_quality_reference
    evidence_quality_reference

---

## 4. Health, Integrity and Drift

Candidate observer-health states:

    HEALTHY
    DEGRADED
    UNHEALTHY
    COMPROMISED
    UNKNOWN

Candidate integrity states:

    VERIFIED
    SUSPECTED_DRIFT
    STALE
    INCONSISTENT
    COMPROMISED
    UNKNOWN

Candidate drift states:

    NO_DRIFT_DETECTED
    DRIFT_SUSPECTED
    DRIFT_CONFIRMED
    UNKNOWN

Observer health, integrity and drift constrain assessment trust but do not
determine factual truth.

---

## 5. Freshness and Temporal Integrity

Freshness SHALL be evaluated relative to assessment context.

Temporal context MAY include:

    observed_at
    produced_at
    received_at
    evaluated_at

A fresh observation is not automatically verified.

A stale observation is not automatically false.

Where temporal validity cannot be established:

    FRESHNESS_STATUS = UNKNOWN

Existing RSOS temporal and UNKNOWN semantics remain authoritative.

---

## 6. Independence and Shared Failure Domains

Observer independence SHALL describe the observation path, not merely the
number or physical location of observers.

Hidden dependence may include:

- shared upstream source
- shared collector
- shared cache
- shared network path
- shared compute
- shared storage
- shared control plane
- shared preprocessing pipeline
- shared vendor backend
- shared failure domain

Candidate independence states:

    INDEPENDENT
    PARTIALLY_DEPENDENT
    DEPENDENT
    UNKNOWN

Therefore:

    THREE_OBSERVERS_SAME_SOURCE
    != THREE_INDEPENDENT_OBSERVATIONS

Agreement with a shared failure domain SHALL NOT be treated as independent
confirmation.

---

## 7. Aggregation Eligibility

Candidate aggregation states:

    ELIGIBLE
    ELIGIBLE_WITH_REDUCED_TRUST
    REVIEW_REQUIRED
    INELIGIBLE

Boundary guidance:

    COMPROMISED
        -> INELIGIBLE

    DEGRADED
        -> REVIEW_REQUIRED

    STALE
        -> CONTEXT_DEPENDENT

    UNKNOWN_HEALTH
        -> INVESTIGATE
        -> DO_NOT_ASSUME_HEALTHY

These are assessment boundaries, not universal execution rules.

Aggregation eligibility SHALL remain distinct from factual truth, governance
approval and human authorization.

---

## 8. Recovery and Hysteresis

Recovery SHALL be treated as a state transition, not as a single healthy
sample.

Candidate recovery states:

    HEALTHY
    DEGRADED
    UNHEALTHY
    RECOVERING
    COMPROMISED
    UNKNOWN

Re-entry into full aggregation eligibility SHOULD require context-specific
stability evidence.

Stability criteria MAY reference:

    minimum_stable_observations
    minimum_stable_duration
    maximum_allowed_state_transitions

No universal numeric threshold is defined by this contract.

Flapping SHALL remain visible through:

    flap_status
    last_state_transition
    state_duration
    stability_duration

---

## 9. Multiple Assessment Protection

Numerical agreement alone SHALL NOT constitute independent confirmation.

Where dependence is known or unknown:

    CONSENSUS_CONFIDENCE
    = BOUNDED_BY_DEPENDENCE

Repeated observations SHALL NOT manufacture independence.

Source count SHALL NOT be treated as independent-path count.

---

## 10. Existing RSOS Semantics Referenced

This contract does not redefine:

- Source Quality
- Evidence Quality
- UNKNOWN semantics
- Verification
- Governance
- Human Authorization
- Execution Compiler authority

Those existing contracts remain authoritative.

Observer integrity only supplies an additional assessment dimension.

---

## 11. Authority and Implementation Boundary

    OBSERVER_HEALTH_RESULT != GOVERNANCE_DECISION

    AGGREGATION_ELIGIBILITY != HUMAN_AUTHORIZATION

    INELIGIBLE_OBSERVATION != GLOBAL_SYSTEM_SHUTDOWN

    ELIGIBLE_OBSERVATION != VERIFIED_FACT

This contract does not authorize:

- runtime implementation
- database or schema changes
- compiler implementation
- autonomous weighting
- autonomous blocking
- autonomous governance decisions
- production modification

Observer integrity constrains assessment confidence.

It does not replace evidence, verification or governance.
