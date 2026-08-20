# RSOS OC-META-006A — Minimal Emergency Evidence Contract

Status: DRAFT
Scope: Operational Care / Emergency Evidence / Evidence Continuity
Change Class: Documentation Contract

References:
- RSOS-OC-001B Operational Care Capability Mapping & Gap Contract
- RSOS-OC-META-002A Pre-authorized Preservation Mandate Contract
- RSOS-OC-META-002B Preservation Playbook Specification
- RSOS-OC-META-002C First Preservation Playbook Candidate
- RSOS-OC-META-003B Minimal Maintenance Governance Contract
- RSOS-OC-META-003C Minimal Implementation Boundary Contract
- RSOS Assessment Observer Integrity Boundary

Runtime Effects: NONE
Database Effects: NONE
Schema Effects: NONE
Production Effects: NONE

---

## 1. Purpose

OC-META-006A defines the minimum architecture contract for preserving
Operational Care evidence when the primary Runtime evidence path is unavailable
or cannot be trusted sufficiently for continued evidence recording.

The Emergency Evidence Path exists only to preserve evidence continuity.

It does not create:

- an alternative Runtime;
- an alternative governance authority;
- an alternative canonical knowledge store;
- an alternative source of truth;
- autonomous recovery authority.

Core boundary:

    PRIMARY_EVIDENCE_UNAVAILABLE != EVIDENCE_MAY_BE_DISCARDED
    EMERGENCY_EVIDENCE_PATH != SECOND_SOURCE_OF_TRUTH
    EMERGENCY_RECORD != VERIFIED_FACT
    EMERGENCY_WRITE_SUCCESS != RECOVERY_SUCCESS

---

## 2. Activation Boundary

Emergency Evidence MAY be considered only when the applicable primary evidence
path cannot satisfy required evidence persistence.

Candidate trigger classes include:

    PRIMARY_EVIDENCE_PATH_UNAVAILABLE
    PRIMARY_AUDIT_PATH_UNAVAILABLE
    PRIMARY_EVIDENCE_WRITE_FAILED
    PRIMARY_EVIDENCE_WRITE_TIMEOUT
    PRIMARY_EVIDENCE_INTEGRITY_UNKNOWN
    PRIMARY_EVIDENCE_PATH_DEGRADED

A trigger is an observed condition.

It is not execution authority.

Therefore:

    TRIGGER_DETECTED != EMERGENCY_ACTION_AUTHORIZED
    WRITE_FAILURE != PRIMARY_DATA_CORRUPTION
    TIMEOUT != DATA_LOSS_PROOF
    DEGRADED != UNAVAILABLE

Activation policy, thresholds and runtime bindings remain separately governed.

---

## 3. Failure-Domain Independence

An Emergency Evidence Path SHALL NOT be considered independent merely because
it uses another function, process, table or logical namespace.

Independence evaluation SHALL consider shared dependency on:

- Runtime process;
- Runtime container;
- primary PostgreSQL instance;
- primary database connection pool;
- primary filesystem;
- primary host;
- primary storage device;
- primary network path;
- primary authentication dependency;
- primary clock source where material;
- primary audit adapter;
- common write queue or buffering layer.

Therefore:

    DIFFERENT_TABLE != INDEPENDENT_PATH
    DIFFERENT_PROCESS != INDEPENDENT_FAILURE_DOMAIN
    DIFFERENT_CONTAINER != INDEPENDENT_HOST
    APPEND_ONLY != OUT_OF_BAND
    LOCAL != INDEPENDENT
    EXTERNAL != INDEPENDENT

Failure-domain independence SHALL be explicitly assessed before implementation
approval.

---

## 4. Minimum Emergency Evidence Record

The Emergency Evidence Path SHALL preserve only the minimum information
necessary to reconstruct what was observed and what evidence operation was
attempted.

Candidate minimum fields:

    emergency_record_id
    record_version
    tenant_id
    trace_id
    source_component
    event_type
    observed_at
    recorded_at
    primary_path_status
    trigger_reason
    payload_digest
    previous_emergency_record_hash
    integrity_hash
    reconciliation_state

Where required and safe, the record MAY reference a bounded payload or
separately protected evidence object.

The contract SHALL prefer references and digests over uncontrolled duplication
of sensitive Runtime payloads.

---

## 5. Integrity Boundary

Emergency evidence SHALL be tamper-evident.

The exact cryptographic implementation is not selected by this contract.

Candidate integrity properties include:

- deterministic record serialization;
- cryptographic digest;
- sequence or predecessor reference;
- append-oriented recording;
- immutable historical records;
- detection of missing or reordered records;
- provenance of the writer;
- bounded timestamp metadata.

Mandatory distinctions:

    HASH_PRESENT != RECORD_TRUSTED
    HASH_CHAIN_VALID != FACT_VERIFIED
    APPEND_ONLY != FAILURE_DOMAIN_INDEPENDENT
    IMMUTABLE != AUTHORITATIVE

Existing RSOS hashing and immutable-audit patterns SHOULD be reused where their
failure-domain dependency remains acceptable.

---

## 6. Bounded Operation

Emergency evidence persistence SHALL be bounded.

A failing Emergency Evidence Path SHALL NOT create unlimited retry pressure,
unbounded storage growth or recursive evidence failure loops.

A future implementation SHALL define:

- maximum record size;
- maximum spool or journal capacity;
- retry policy;
- maximum retry count or equivalent bounded condition;
- minimum and maximum retry delay where applicable;
- overflow behavior;
- disk-pressure behavior;
- timeout behavior;
- fail-closed condition;
- escalation condition.

Therefore:

    EMERGENCY_PATH_FAILURE != UNBOUNDED_RETRY
    STORAGE_FULL != SILENT_EVIDENCE_DROP
    RETRY_EXHAUSTED != SUCCESS
    UNKNOWN_CAPACITY != UNLIMITED_CAPACITY

Concrete operational values are not authorized by this documentation contract.

---

## 7. Sensitive Data Boundary

Emergency persistence SHALL NOT become an uncontrolled duplicate store for
secrets, credentials or unrestricted Runtime payloads.

The future implementation SHALL classify whether data is:

    REQUIRED
    REFERENCED_ONLY
    HASH_ONLY
    MASKED
    ENCRYPTED
    FORBIDDEN

Secrets SHALL NOT be persisted merely because the primary evidence path failed.

Emergency evidence retention and deletion semantics SHALL remain compatible
with applicable RSOS governance and data-protection requirements.

---

## 8. Reconciliation State Model

Emergency evidence SHALL remain explicitly non-canonical until controlled
reconciliation completes.

Candidate states:

    CAPTURED
    PENDING_RECONCILIATION
    RECONCILIATION_BLOCKED
    RECONCILED
    DUPLICATE_CONFIRMED
    CONFLICT_DETECTED
    SUPERSEDED
    INVALID
    UNKNOWN

Mandatory distinctions:

    CAPTURED != RECONCILED
    REPLAYED != ACCEPTED
    DUPLICATE != CORRUPTION
    CONFLICT != AUTOMATIC_OVERWRITE
    RECONCILIATION_SUCCESS != FACT_ACCEPTANCE

---

## 9. Controlled Reconciliation

When the primary evidence path becomes available again, Emergency Evidence MAY
be proposed for reconciliation.

Conceptual flow:

    EmergencyEvidence
        -> IntegrityVerification
        -> IdentityAndProvenanceCheck
        -> DuplicateDetection
        -> OrderingAssessment
        -> ConflictDetection
        -> GovernedReconciliation
        -> PrimaryEvidenceReference
        -> ReconciliationEvidence

Reconciliation SHALL preserve both:

- the original Emergency Evidence identity;
- the resulting primary evidence reference.

Emergency records SHALL NOT be silently deleted solely because reconciliation
succeeded.

---

## 10. Replay Boundary

Replay is not equivalent to repeating the original business action.

Emergency replay SHALL concern evidence reconstruction or evidence transfer
only.

Therefore:

    EVIDENCE_REPLAY != BUSINESS_ACTION_REPLAY
    EVIDENCE_REPLAY != COMMAND_REEXECUTION
    RECONCILIATION != STATE_MUTATION_AUTHORITY

No operational command, recovery command, migration, approval or destructive
action may be re-executed merely because an Emergency Evidence record exists.

---

## 11. Recovery Boundary

Primary-path recovery SHALL be evaluated independently from emergency evidence
reconciliation.

Therefore:

    PRIMARY_PATH_RECOVERED != EVIDENCE_RECONCILED
    EVIDENCE_RECONCILED != SYSTEM_RECOVERED
    SYSTEM_RECOVERED != VERIFIED_SUCCESS

Existing RSOS Recovery and Preservation contracts remain authoritative.

---

## Emergency Containment and Evidence Preservation Boundary

Emergency conditions do not suspend RSOS governance, evidence discipline or
epistemic boundaries.

Mandatory invariants:

    EMERGENCY_MODE != GOVERNANCE_VACUUM
    EMERGENCY_ACTION != CANONICAL_PROMOTION
    EMERGENCY_CONTAINMENT != EVIDENCE_DESTRUCTION
    EMERGENCY_RECOVERY != VERIFIED_SUCCESS

Where containment, isolation, throttling, shutdown or another preservation
action is required, the system SHOULD preserve the minimum available evidence
before destructive state loss where this can be performed safely and within
the applicable emergency time boundary.

Candidate minimum pre-containment evidence MAY include:

    incident_identity
    observed_state
    last_known_valid_state_reference
    active_failure_signals
    relevant queue_or_workload_state
    dependency_state
    observer_health_state
    timestamp_context
    provenance
    integrity_digest
    unknowns

The exact forensic capture mechanism is not selected by this contract.

Therefore:

    EVIDENCE_CAPTURE_REQUIRED_WHERE_SAFE_AND_FEASIBLE = TRUE
    EVIDENCE_CAPTURE != FULL_MEMORY_DUMP
    EVIDENCE_CAPTURE != VERIFIED_FACT
    EVIDENCE_CAPTURE_FAILURE != CONTAINMENT_SUCCESS
    EVIDENCE_CAPTURE_FAILURE != AUTOMATIC_CONTAINMENT_PROHIBITION

If evidence capture cannot complete safely before required containment:

    EVIDENCE_CAPTURE_STATE = INCOMPLETE_OR_UNKNOWN
    CONTAINMENT_DECISION = GOVERNED_BY_EXISTING_AUTHORITY
    EVIDENCE_GAP = MUST_REMAIN_VISIBLE

A timeout or exhausted observation path SHALL NOT itself create isolation
authority.

Therefore:

    TIMEOUT_EXHAUSTION != SUCCESS
    TIMEOUT_EXHAUSTION != ISOLATION_AUTHORITY
    TIMEOUT_EXHAUSTION -> EMERGENCY_REVIEW_REQUIRED

Any isolation or containment action requires an already applicable authority,
pre-authorized preservation mandate or separately governed emergency decision.

JARVIS may coordinate the evidence and containment review path but SHALL NOT
derive execution authority from the emergency condition.

    JARVIS_COORDINATION != EMERGENCY_EXECUTION_AUTHORITY

A recovered component SHALL remain provisional until the applicable
verification and governance path establishes safe return to active service.

    RECOVERED != VERIFIED
    RECOVERED != ACTIVE_ROUTING_AUTHORIZED
    PROVISIONAL_RECOVERY != CANONICAL_ACCEPTANCE

---

## Persistence, Ordering and Forensic Durability Boundary

Emergency Evidence SHALL distinguish successful write attempts from durable,
complete and reconstructable evidence persistence.

Mandatory distinctions:

    WRITE_ATTEMPTED != WRITE_COMPLETED
    WRITE_COMPLETED != DURABLY_PERSISTED
    PARTIAL_WRITE != VALID_RECORD
    RECORD_PRESENT != RECORD_COMPLETE
    STORAGE_ACK != DURABILITY_PROOF
    HASH_VALID != DURABILITY_PROOF

A future implementation SHALL define how incomplete, torn, partially persisted
or corrupted emergency records are detected and classified.

Such records SHALL NOT silently enter reconciliation as valid evidence.

Therefore:

    PARTIAL_RECORD -> INVALID_OR_UNKNOWN
    CORRUPTED_RECORD -> RECONCILIATION_BLOCKED
    DURABILITY_UNKNOWN -> EVIDENCE_STATE_UNKNOWN

### Crash and Storage Failure Boundary

The Emergency Evidence mechanism SHALL define behavior for at least:

- process crash;
- container termination;
- host loss;
- power loss;
- storage exhaustion;
- storage becoming read-only;
- interrupted write;
- unavailable persistence target.

A storage failure SHALL NOT silently convert missing evidence into successful
capture.

    DISK_FULL != EVIDENCE_CAPTURE_SUCCESS
    HOST_RECOVERED != EMERGENCY_RECORD_DURABLE
    PROCESS_RESTARTED != WRITE_CONFIRMED

The concrete durability primitive is technology-specific and is not selected
by this contract.

### Ordering and Time Boundary

Wall-clock timestamps SHALL NOT by themselves establish authoritative event
ordering.

Emergency Evidence SHOULD preserve sufficient sequence and predecessor context
to reconstruct ordering where possible.

Therefore:

    TIMESTAMP != TOTAL_ORDER
    CLOCK_TIME != TRUSTED_SEQUENCE
    CLOCK_SKEW != EVIDENCE_CORRUPTION
    SEQUENCE_NUMBER != VERIFIED_CAUSALITY

Where time or ordering cannot be established reliably:

    ORDERING_STATE = UNKNOWN

Unknown ordering SHALL remain visible during reconciliation.

### Writer Identity and Provenance Boundary

Emergency evidence SHALL preserve the identity or governed identity reference
of the component that produced or persisted the record.

Mandatory distinction:

    WRITER_IDENTITY_PRESENT != WRITER_TRUSTED

Future implementation SHALL define how writer identity, process identity and
applicable authorization context are bound to the record without converting
technical identity into governance authority.

### Cryptographic and Key Boundary

Cryptographic integrity mechanisms SHALL NOT depend on silently unavailable,
expired or unverifiable key material.

A future implementation SHALL define:

- integrity algorithm;
- key ownership where applicable;
- key availability behavior;
- key rotation behavior;
- verification of historical records after rotation;
- behavior when key provenance is UNKNOWN.

Therefore:

    ENCRYPTED != TRUSTED
    SIGNED != FACT_VERIFIED
    KEY_AVAILABLE != KEY_AUTHORIZED
    KEY_ROTATED != HISTORICAL_EVIDENCE_INVALID

Technology-specific cryptographic choices remain outside this contract.

### Retention Boundary

Emergency Evidence retention SHALL be bounded and governed.

Retention SHALL account for:

- reconciliation state;
- unresolved conflicts;
- legal or governance requirements;
- storage pressure;
- sensitive-data classification;
- historical verification requirements.

Therefore:

    RECONCILED != IMMEDIATE_DELETE
    RETENTION_EXPIRED != SILENT_DELETION
    STORAGE_PRESSURE != UNGOVERNED_PURGE

Deletion or compaction semantics require separate governed definition.

---

## 12. Authority Boundary

OC-META-006A creates no execution authority.

JARVIS MAY coordinate evidence review and routing within existing authority
boundaries.

Hausmeister MAY observe and report evidence-path health within its existing
mandate.

ARP and applicable evidence/governance functions MAY evaluate provenance,
integrity and auditability according to their existing mandates.

Human and existing governance authority remain unchanged.

Therefore:

    OBSERVER != APPROVER
    EVIDENCE_WRITER != GOVERNANCE_AUTHORITY
    JARVIS_COORDINATION != GOVERNANCE_DECISION
    EMERGENCY_EVIDENCE != HUMAN_AUTHORIZATION

---

## 13. Implementation Boundary

This contract defines architecture semantics only.

Not authorized:

- creation of files or spool directories;
- new database tables;
- new database instances;
- new services;
- new containers;
- new queues;
- new external storage;
- Runtime route changes;
- worker creation;
- deployment changes;
- production configuration changes;
- automatic evidence replay.

Technology selection requires a separate failure-domain assessment.

---

## 14. Technology Selection Gate

Before a concrete Emergency Evidence technology is selected, candidate designs
SHALL be evaluated for at least:

    FAILURE_DOMAIN_INDEPENDENCE
    WRITE_AVAILABILITY
    TAMPER_EVIDENCE
    BOUNDED_RESOURCE_USE
    ORDERING_SUPPORT
    RECONCILIATION_SUPPORT
    DATA_PROTECTION
    RECOVERY_BEHAVIOR
    OPERATIONAL_COMPLEXITY
    SECOND_SOURCE_OF_TRUTH_RISK

Candidate technologies MAY include different mechanisms, but this contract
selects none.

The preferred solution SHALL be the smallest mechanism that satisfies the
verified failure scenario without creating unnecessary infrastructure.

---

## 15. Core Invariants

    PRIMARY_EVIDENCE_PATH != EMERGENCY_EVIDENCE_PATH
    EMERGENCY_EVIDENCE_PATH != SECOND_SOURCE_OF_TRUTH
    APPEND_ONLY != OUT_OF_BAND
    DIFFERENT_STORAGE_NAME != FAILURE_DOMAIN_INDEPENDENCE
    CAPTURED != RECONCILED
    REPLAYED != ACCEPTED
    HASH_VALID != FACT_VERIFIED
    PRIMARY_PATH_RECOVERED != EVIDENCE_RECONCILED
    EVIDENCE_REPLAY != BUSINESS_ACTION_REPLAY
    EMERGENCY_EVIDENCE != EXECUTION_AUTHORITY

---

## 16. Current Status

    OC_META_006A_CONTRACT = DRAFT_DEFINED
    EMERGENCY_EVIDENCE_REQUIREMENTS = DRAFT_DEFINED
    FAILURE_DOMAIN_MODEL = DRAFT_DEFINED
    MINIMUM_RECORD_MODEL = DRAFT_DEFINED
    RECONCILIATION_MODEL = DRAFT_DEFINED
    TECHNOLOGY_SELECTED = NO
    RUNTIME_IMPLEMENTATION = NO
    DATABASE_IMPLEMENTATION = NO
    PRODUCTION_AUTHORIZATION = NO

---

## 17. Closing Principle

Emergency Evidence exists so that RSOS does not lose its ability to explain
what happened when the ordinary evidence path is impaired.

The fallback must therefore be sufficiently independent to survive the failure
it is intended to observe, but sufficiently bounded and governed that it never
becomes a hidden second Runtime or source of truth.
