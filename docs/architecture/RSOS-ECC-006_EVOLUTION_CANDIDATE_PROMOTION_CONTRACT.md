# RSOS ECC-006 — Evolution Candidate Promotion Contract

Status: DRAFT
Scope: Evolution / Calibration / Candidate Promotion
Change Class: Documentation Contract

Purpose:
Define the minimum boundary before a Shadow Evolution result may enter
controlled RSOS assessment and Boxenstopp review.

References:
- RSOS-OC-META-003C Minimal Implementation Boundary Contract
- RSOS-OC-META-003D Worktree Instance & Review Boundary Contract
- RSOS Assessment Observer Integrity Boundary
- existing RSOS Verification, Engineering Approval and Human Authorization contracts

Effects:
Runtime: NONE
Database: NONE
Schema: NONE
Production: NONE
Compiler: NONE
Autonomous Promotion: NONE

---

## 1. Core Boundary

    CANDIDATE_GENERATED != CANDIDATE_PROMOTABLE
    CANDIDATE_PROMOTABLE != AUTHORIZED_CHANGE
    CHANGE != IMPROVEMENT
    HIGHER_FITNESS != LOWER_TOTAL_RISK
    BEST_MUTATION != REQUIRED_CHANGE
    SIMULATION_RESULT != REALITY_VERIFICATION
    REJECT != DELETE

Shadow Evolution may propose. Productive Reality remains governed.

---

## 2. Candidate Identity

A candidate SHALL remain attributable to its exact baseline.

Minimum identity:

    candidate_id
    candidate_version
    parent_candidate_id
    baseline_reference
    originating_case_id
    generation_method
    stated_purpose
    target_state

---

## 3. Evolution Delta

Every promotable candidate SHALL expose:

    hypothesis_reference
    proposed_change
    expected_benefit
    affected_components
    dependency_delta
    failure_domain_delta
    risk_delta
    unknown_delta
    recovery_impact
    rollback_hypothesis

Mandatory rule:

    RISK_REDUCTION
    requires
    NEW_RISK_ANALYSIS

Existing RSOS rules for hypothesis, evidence, UNKNOWN and verification remain
authoritative.

---

## 4. Fitness and Control

Fitness SHALL remain multi-dimensional and MAY include:

    resilience
    risk_reduction
    unknown_reduction
    resource_cost
    complexity_cost
    maintainability
    recovery_quality
    dependency_independence
    security_impact
    governance_compliance
    temporal_stability
    environmental_impact

Fitness does not constitute authorization.

Candidate comparison SHOULD retain:

    BASELINE
    CANDIDATE_A
    CANDIDATE_B
    NO_CHANGE_CANDIDATE

No-change remains a valid outcome.

---

## 5. Scenarios and Verification

Evaluation MAY include:

    KNOWN_SCENARIOS
    ADVERSARIAL_SCENARIOS
    NOVELTY_SCENARIOS

If the model cannot support a reliable conclusion, existing RSOS UNKNOWN
semantics apply.

Every promotable candidate SHALL define a context- and criticality-appropriate
verification plan, which MAY include:

    structural_validation
    constraint_validation
    formal_proof_obligations
    mutation_tests
    simulation_tests
    dependency_checks
    observer_integrity_checks
    temporal_stability_checks
    rollback_verification
    reality_verification

---

## 6. Promotion Gate

States:

    PASS
    HOLD
    REJECT

Semantics:

    PASS   = complete enough for controlled assessment
    HOLD   = potentially useful but incomplete
    REJECT = unsuitable for promotion under the applicable boundary

Mandatory distinctions:

    PASS != AUTHORIZATION
    HOLD != FAILURE
    REJECT != DELETE

Promotion SHOULD establish:

    provenance_complete
    baseline_known
    purpose_explicit
    alternatives_compared
    fitness_vector_present
    dependency_delta_present
    risk_delta_present
    unknowns_visible
    verification_plan_present
    rollback_hypothesis_present
    authority_boundary_preserved

PASS permits only entry into the existing governed RSOS review path.

---

## 7. Candidate History

Evolution history SHOULD retain:

    baseline
    hypothesis_reference
    mutation
    simulation_results
    fitness_vector
    counterexamples
    failures
    unknowns
    verification_results
    promotion_state
    lessons_learned

Rejected and failed candidates SHOULD remain discoverable where retention policy
permits.

---

## 8. Authority and Implementation Boundary

ECC-006 creates no new authority.

Existing RSOS review, JARVIS coordination, Council, Human Authorization,
Boxenstopp, controlled implementation and Reality Verification remain
authoritative.

    ECC006_PASS != GOVERNANCE_APPROVAL
    ECC006_PASS != HUMAN_AUTHORIZATION
    ECC006_PASS != COMPILER_AUTHORIZATION
    ECC006_PASS != PRODUCTION_CHANGE

Not authorized:

- runtime implementation
- database or schema changes
- compiler implementation
- autonomous promotion
- autonomous evolution
- autonomous production modification

---

## 9. Machine-Readable Candidate Shape

    candidate:
      identity
      baseline
      proposed_change
      target_state
      fitness_vector
      dependency_delta
      risk_delta
      unknown_delta
      scenario_coverage
      verification_plan
      rollback_hypothesis
      promotion_state
      provenance
      authority_boundary

This is a documentation-level contract only.
