# RSOS-OC-META-006I — Residual Risk and Acceptance Criteria

Status: DRAFT
Scope: Operational Care / Emergency Evidence Technology Assessment
Parent: RSOS-OC-META-006H Adversarial Technology Selection Review
Change Class: Documentation / Design Only

---

## 1. Purpose

This contract converts the adversarial findings of OC-META-006H into
explicit residual-risk classes and acceptance criteria.

It does not authorize implementation, runtime modification, database
modification, infrastructure modification or production use.

    RISK_MITIGATION_DEFINED != RISK_MITIGATION_PROVEN
    CONFIGURATION_CANDIDATE != VERIFIED_CONTROL
    TECHNOLOGY_PREFERENCE != IMPLEMENTATION_AUTHORITY

---

## 2. Stage 1 Durability Acceptance Criteria

The leading Stage 1 technology class remains:

    LOCAL_SQLITE_WAL_STORE

A candidate implementation SHALL evaluate at minimum:

    PRAGMA journal_mode = WAL
    PRAGMA synchronous = EXTRA

These settings are candidate durability controls and SHALL NOT themselves
be treated as proof of physical persistence.

Therefore:

    WAL_ENABLED != DURABILITY_PROVEN
    SYNCHRONOUS_EXTRA_CONFIGURED != POWER_LOSS_SURVIVAL_PROVEN
    COMMIT_RETURNED != PHYSICAL_DURABILITY_PROVEN
    SQLITE_OPEN_SUCCESS != EVIDENCE_INTEGRITY_PROVEN

Acceptance requires controlled durability testing against the actual
filesystem, storage stack, operating environment and failure model.

Required proof:

    PARTIAL_WRITE_DETECTION = VERIFIED
    TORN_RECORD_DETECTION = VERIFIED
    CORRUPTION_DETECTION = VERIFIED
    POWER_LOSS_BEHAVIOR = VERIFIED
    FALSE_SUCCESS_PATH = NOT_DEMONSTRATED

Until these proofs exist:

    STAGE1_DURABILITY_STATUS = UNVERIFIED

---

## 3. Bounded Capacity and Backpressure Acceptance Criteria

The Stage 1 emergency buffer SHALL have finite capacity.

    UNBOUNDED_BUFFER_GROWTH = FORBIDDEN
    UNBOUNDED_RETRY = FORBIDDEN
    BUFFER_FULL != SUCCESS
    DISK_FULL != EVIDENCE_CAPTURE_SUCCESS
    READ_ONLY_FILESYSTEM != EVIDENCE_CAPTURE_SUCCESS

Candidate initial capacity for controlled evaluation:

    CANDIDATE_MAX_BUFFER_SIZE = 512MB

The value 512MB is not yet an architectural invariant.

    512MB = TESTABLE_INITIAL_BOUND
    512MB != VERIFIED_PRODUCTION_LIMIT

The final limit SHALL be derived from measured evidence generation rate,
maximum intended outage window, storage reserve and primary-runtime
resource protection.

Backpressure behavior SHALL be explicitly designed and tested.

    BUFFER_FULL -> BACKPRESSURE_REQUIRED
    BACKPRESSURE_REQUIRED != AUTOMATIC_GLOBAL_RUNTIME_SHUTDOWN
    BACKPRESSURE_REQUIRED != NEW_EXECUTION_AUTHORITY

Any denial, throttling, isolation or shutdown of business processing
requires an independently applicable authority and policy.

---

## 4. Causal Evidence Ordering Acceptance Criteria

Every Stage 2 evidence packet SHALL support explicit ordering and
predecessor relationships independent of object-store timestamps.

Candidate metadata:

    sequence_id
    predecessor_digest
    record_digest
    writer_identity
    incident_identity
    capture_timestamp
    provenance

A cryptographic digest algorithm SHALL be selected and governed by the
implementation contract.

SHA-256 is an admissible candidate, not an architectural requirement at
this gate.

Therefore:

    OBJECT_CREATION_TIME != VERIFIED_CAUSAL_ORDER
    OBJECT_NAME_ORDER != VERIFIED_CAUSAL_ORDER
    SEQUENCE_ID != FACT_VERIFICATION
    PREDECESSOR_DIGEST != FACT_VERIFICATION
    HASH_CHAIN_VALID != BUSINESS_TRUTH

A broken sequence or predecessor relationship SHALL create an integrity
exception requiring assessment.

    CHAIN_BREAK -> INTEGRITY_REVIEW_REQUIRED
    CHAIN_BREAK != ATTACK_PROVEN

Duplicate transfer SHALL remain distinguishable from duplicate business
execution.

    DUPLICATE_TRANSFER != DUPLICATE_BUSINESS_ACTION
    EVIDENCE_REPLAY != COMMAND_REEXECUTION

---

## 5. Stage 2 Acceptance Criteria

The leading Stage 2 technology class remains:

    IMMUTABLE_OBJECT_STORAGE

Before selection it SHALL demonstrate:

    FAILURE_DOMAIN_INDEPENDENCE = VERIFIED
    DURABILITY_SEMANTICS = VERIFIED
    ACK_SEMANTICS = VERIFIED
    CREDENTIAL_FAILURE_BEHAVIOR = VERIFIED
    NETWORK_PARTITION_BEHAVIOR = VERIFIED
    RETENTION_MODEL = GOVERNED
    ORDERING_SUPPORT = VERIFIED
    RECONCILIATION_SUPPORT = VERIFIED

Mandatory boundaries:

    REMOTE_ACK != FACT_VERIFIED
    REMOTE_ACK != RECONCILIATION_COMPLETE
    REMOTE_EVIDENCE != RUNTIME_STATE
    REMOTE_EVIDENCE != CANONICAL_KNOWLEDGE
    IMMUTABLE != INFINITE_RETENTION

---

## 6. Residual Risk Classification

    R1_LOCAL_CORRUPTION = BLOCKING
    R2_POWER_LOSS_DURABILITY = BLOCKING
    R3_BUFFER_EXHAUSTION = CONDITIONAL
    R4_CREDENTIAL_FAILURE = CONDITIONAL
    R5_NETWORK_PARTITION = CONDITIONAL
    R6_RETENTION_CONFLICT = BLOCKING
    R7_CAUSAL_ORDERING = BLOCKING
    R8_DUPLICATE_TRANSFER = CONDITIONAL
    R9_SECOND_SOURCE_OF_TRUTH = BLOCKING
    R10_HOST_LOSS_BEFORE_REMOTE_PERSISTENCE = RESIDUAL_HUMAN_DECISION
    R11_REMOTE_ACK_SEMANTICS = BLOCKING

Definitions:

    BLOCKING = MUST_BE_RESOLVED_BEFORE_TECHNOLOGY_SELECTION
    CONDITIONAL = REQUIRES_VERIFIED_CONTROL
    RESIDUAL_HUMAN_DECISION = REQUIRES_EXPLICIT_HUMAN_ACCEPTANCE_OR_REDESIGN

---

## 7. Host-Loss Residual Risk

The following window remains explicitly unresolved:

    LOCAL_CAPTURED
        -> REMOTE_TRANSFER_PENDING
        -> PRIMARY_HOST_LOSS

Possible result:

    LOCAL_ONLY_EVIDENCE_MAY_BE_LOST

Therefore:

    LOCAL_CAPTURED != REMOTE_PERSISTED
    LOCAL_ACK != REMOTE_DURABILITY
    RESIDUAL_RISK != SILENT_ACCEPTANCE

This risk SHALL either be reduced by design or explicitly accepted through
the applicable human governance path.

---

## 8. Selection Gate

The leading combination remains:

    LOCAL_SQLITE_WAL_PLUS_IMMUTABLE_OBJECT_STORAGE

But:

    ADVERSARIAL_PASS_WITH_CONDITIONS != FINAL_SELECTION
    WEIGHTED_WINNER != VERIFIED_TECHNOLOGY
    ACCEPTANCE_CRITERIA_DEFINED != ACCEPTANCE_CRITERIA_SATISFIED

Final technology-class selection remains blocked while any BLOCKING risk
lacks verified evidence.

---

## 9. Authority Boundary

    SPECIFIC_PRODUCT_SELECTED = NO
    IMPLEMENTATION_AUTHORIZED = NO
    RUNTIME_CHANGE_AUTHORIZED = NO
    DATABASE_CHANGE_AUTHORIZED = NO
    INFRASTRUCTURE_CHANGE_AUTHORIZED = NO
    PRODUCTION_AUTHORIZED = NO

Next gate:

    OC-META-006J_PROOF_PLAN_AND_EXIT_CRITERIA

---

## 10. Status

    OC_META_006I = DRAFT_DEFINED
    RESIDUAL_RISKS = CLASSIFIED
    ACCEPTANCE_CRITERIA = DEFINED
    CONTROLS_VERIFIED = NO
    IMPLEMENTATION_AUTHORIZED = NO
