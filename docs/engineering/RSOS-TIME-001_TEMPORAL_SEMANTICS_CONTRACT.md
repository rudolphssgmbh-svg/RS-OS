# RSOS-TIME-001 — Temporal Semantics Contract

Status: DRAFT
Scope: Engineering / Temporal Semantics
Change Class: Documentation Contract
Runtime Effects: NONE
Database Effects: NONE
Production Effects: NONE

## 1. Purpose

This contract defines the common temporal semantics used by RSOS.

Its purpose is to prevent different kinds of time from being treated as
interchangeable merely because they are represented by timestamps.

RSOS shall distinguish:

- when something occurred at a source;
- when something was observed;
- when something was received;
- when RSOS processed or recorded it;
- when something became effective or valid;
- when an audit record was created;
- and what temporal ordering may or may not prove.

A timestamp is evidence about time within a defined semantic context.

A timestamp alone is not proof of causality, truth, authority or global order.

## 2. Governing Principle

RSOS shall not infer semantic equality between different time dimensions.

In particular:

source time != observation time
observation time != receipt time
receipt time != processing time
processing time != effective time
effective time != audit time

Two or more of these timestamps may have the same value.

Equal values do not make their meanings equal.

Missing temporal information shall remain unknown rather than being silently
substituted from another time dimension unless an explicit governing contract
defines such substitution.

## 3. Canonical Temporal Dimensions

### 3.1 Source Time

Source Time represents the time claimed by the originating source.

Examples may include:

- source_time
- event_time
- device_time

Source Time may originate outside the RSOS trust boundary.

It shall therefore not automatically be treated as trusted system time.

### 3.2 Device Time

Device Time is a specialized Source Time produced by a device.

A Device Time value may be affected by:

- clock drift;
- clock skew;
- incorrect timezone configuration;
- manual clock modification;
- loss of synchronization;
- offline operation;
- delayed transmission.

Device Time shall not by itself establish authoritative ordering.

### 3.3 Observation Time

Observation Time represents when an observation is claimed or known to have
been made.

Existing RSOS field forms include:

- observation_time
- observed_at

Observation Time is distinct from the time at which RSOS later receives,
processes or stores that observation.

### 3.4 Receipt Time

Receipt Time represents when RSOS or another governed receiving boundary
received information.

Existing RSOS field forms include:

- received_at
- received_at_utc
- received_at_local

Receipt Time may be later than Source Time or Observation Time.

Receipt Time shall not overwrite or reinterpret the source chronology.

### 3.5 Processing Time

Processing Time represents when RSOS evaluates, transforms, routes or otherwise
processes information.

Processing Time may differ from Receipt Time because processing may be delayed,
retried, queued or replayed.

A processing timestamp shall describe processing only.

It shall not be treated as the time at which the underlying real-world event
occurred.

### 3.6 Recorded Time

Recorded Time represents when a record was written or registered within a
governed RSOS context.

Common existing forms include:

- created_at
- recorded_at

Unless another governing contract explicitly states otherwise, `created_at`
shall be interpreted as record-creation time.

`created_at` shall not automatically mean:

- source occurrence time;
- observation time;
- effective time;
- decision time;
- causal predecessor time.

### 3.7 Effective Time

Effective Time represents when a state, rule, decision, approval, knowledge
object or other governed object has semantic effect.

Existing forms include:

- effective_from
- effective time
- valid_from
- valid_until

Effective Time belongs to domain validity semantics.

It shall remain distinct from storage or audit timestamps.

### 3.8 Decision Time

Decision Time represents when a governed decision was made.

Existing approval semantics include:

- decision_timestamp
- decided_at

Decision Time shall not be inferred from `created_at` where an explicit
decision timestamp exists or is required.

### 3.9 Validity Interval

A validity interval defines a bounded period during which an object,
authorization or decision may be relied upon.

Common forms include:

valid_from <= t < valid_until

The exact endpoint semantics shall be stated by the governing domain contract
where they differ.

Expired, revoked or superseded authority shall not remain effective merely
because its historical record still exists.

### 3.10 Audit Time

Audit Time represents the authoritative recorded time of an auditable RSOS
action or event within the RSOS audit boundary.

UTC is the canonical RSOS audit time reference.

Audit Time proves when RSOS recorded an audit event according to the governed
audit mechanism.

Audit Time does not by itself prove when an external real-world event occurred.

## 4. UTC and Timezone Contract

Canonical audit timestamps shall be timezone-aware.

UTC shall be the canonical reference for audit comparison, persistence and
cross-system temporal reasoning.

Local time may be preserved for presentation or contextual evidence where
required.

Local time shall not replace the canonical UTC audit reference.

A timestamp without timezone information shall not be assumed to represent UTC
unless an existing governing contract explicitly guarantees that interpretation.

Legacy naive timestamp fields remain legacy implementation facts until reviewed
separately.

This contract does not modify them.

## 5. Clock Trust

Not all clocks have equal trust.

RSOS shall distinguish at minimum between:

- governed RSOS system clock;
- governed infrastructure clock;
- remote system clock;
- device clock;
- human-entered time;
- reconstructed or inferred time.

A timestamp originating from an external, remote or device clock shall be
treated as a temporal claim unless its clock trust has been established.

Clock trust may require evidence such as:

- synchronization mechanism;
- clock source;
- drift bounds;
- offset bounds;
- last synchronization time;
- timezone information;
- source identity;
- integrity evidence.

Absence of clock-trust evidence shall remain visible as uncertainty.

## 6. Temporal Uncertainty

Temporal uncertainty shall not be silently collapsed into precise time.

RSOS may encounter:

- exact timestamps;
- approximate timestamps;
- bounded intervals;
- unknown timestamps;
- conflicting timestamps;
- untrusted timestamps.

Where temporal precision matters to a governed decision, missing or conflicting
precision shall produce an Unknown, review requirement or other fail-closed
outcome according to the governing contract.

False precision is prohibited.

## 7. Ordering Semantics

Timestamp order and semantic order are different concepts.

The following inference is prohibited without additional governing evidence:

A.timestamp < B.timestamp
therefore
A caused B

A timestamp may support chronology.

It does not independently establish causality.

### 7.1 Database Ordering

`ORDER BY created_at` defines database result ordering according to recorded
creation time.

It shall not automatically be interpreted as:

- source-event order;
- observation order;
- causal order;
- lifecycle order;
- governance order;
- global distributed order.

### 7.2 Stable Ordering

Where deterministic ordering is required and timestamp values may collide,
a governing query or contract should define an explicit deterministic
tie-breaker.

Existing examples include ordering by:

created_at ASC, event_id ASC

A tie-breaker establishes deterministic representation.

It does not establish causality.

### 7.3 Explicit Sequence

Where RSOS already possesses explicit sequence evidence such as:

- chain_position;
- sequence_number;
- predecessor reference;
- previous_hash;

that evidence shall be evaluated according to its governing contract.

Sequence evidence is stronger than timestamp coincidence for reconstructing a
defined sequence.

It still shall not be generalized into real-world causality beyond its scope.

## 8. Causality Contract

Correlation is not causality.

Temporal precedence is not sufficient proof of causality.

A causal claim requires appropriate evidence and verification.

RSOS shall distinguish:

- temporal correlation;
- sequence;
- dependency;
- predecessor relation;
- causal hypothesis;
- verified causal relation.

A causal hypothesis shall not be promoted to verified cause merely because one
event occurred before another.

Root-cause claims remain subject to verification.

## 9. Late and Out-of-Order Information

RSOS supports environments involving:

- delayed delivery;
- offline operation;
- replay;
- synchronization;
- governed eventual consistency.

Therefore an item received later may describe an event that occurred earlier.

Likewise an item recorded earlier may later be superseded by stronger evidence
about the historical chronology.

Receipt order shall not overwrite Source Time or Observation Time.

Processing order shall not overwrite source chronology.

Late arrival shall remain representable and auditable.

## 10. Federation Temporal Semantics

Federation synchronization shall preserve temporal provenance.

Where applicable, synchronized information shall retain:

- source timestamp;
- collection or observation time;
- effective time;
- synchronization context;
- audit reference.

Synchronization does not convert Source Time into local Audit Time.

Synchronization does not create truth, authority or causal proof.

Conflicting temporal evidence shall remain visible and auditable.

Silent temporal conflict resolution is prohibited where the conflict may affect
meaning, trust, governance or outcome.

## 11. Lifecycle Temporal Semantics

A Lifecycle Event timestamp records the governed lifecycle transition according
to the applicable Lifecycle Event contract.

Lifecycle chronology shall preserve:

- affected object;
- affected version;
- previous state;
- new state;
- actor;
- timestamp;
- required evidence and governance references.

A lifecycle timestamp shall not be interpreted as authority for the transition.

The governing object contract remains authoritative for transition validity.

Unknown, ambiguous or unverifiable transitions shall fail closed.

## 12. Approval and Authority Temporal Semantics

Approval validity is temporal and scope-bound.

Where an Approval Record defines:

- decision_timestamp;
- valid_from;
- valid_until;
- revoked_at;
- supersession state;

those fields shall govern their respective semantics.

Historical existence of an Approval Record does not imply current authority.

An approval shall not be relied upon outside:

- its defined scope;
- its valid interval;
- its applicable object or version;
- its non-revoked state.

## 13. Replay and Recovery

Replay may reconstruct processing of historical information.

Replay time is not the original Source Time.

Replay time is not the original Observation Time.

A replayed operation shall preserve sufficient provenance to distinguish:

- original temporal evidence;
- original audit evidence where applicable;
- replay or recovery execution time.

Replay shall not silently rewrite history.

## 14. Temporal Conflict

A Temporal Conflict exists when temporal claims relevant to interpretation or
governance cannot simultaneously be relied upon without resolution.

Examples include:

- source timestamp later than a supposedly dependent event;
- mutually incompatible validity intervals;
- device clock outside an accepted trust bound;
- ambiguous timezone;
- duplicate timestamps without deterministic sequence evidence;
- synchronized records with incompatible temporal provenance.

A conflict shall not be silently converted into certainty.

The applicable governing layer shall determine whether the result is:

- accepted with bounded uncertainty;
- review required;
- quarantined;
- rejected;
- represented as Unknown.

## 15. Legacy Timestamp Boundary

The existing Runtime contains both timezone-aware and legacy naive timestamp
definitions.

This contract documents the semantic boundary.

It does not:

- alter database column types;
- migrate existing values;
- reinterpret historical rows automatically;
- change Runtime queries;
- change indexes;
- change APIs;
- change worker behavior.

Any remediation of legacy timestamp storage requires a separate inventory,
impact analysis, migration contract, verification and human approval.

## 16. Existing `created_at` Ordering Boundary

The Runtime currently contains many queries ordered by `created_at`.

This contract does not declare those queries defective merely because they use
`created_at`.

Each query must be evaluated according to its intended semantic ordering.

Future review shall classify relevant ordering sites as one of:

- record-order correct;
- deterministic presentation order;
- lifecycle order requiring stronger semantics;
- causal or dependency order requiring stronger evidence;
- ambiguous and requiring review.

No Runtime ordering change is authorized by this contract.

## 17. Evidence and Provenance

Temporal claims used for material governance or verification should preserve,
where applicable:

- timestamp value;
- temporal dimension;
- originating source;
- clock source or clock class;
- timezone or UTC normalization information;
- uncertainty;
- receipt context;
- evidence reference;
- audit reference.

A timestamp without semantic provenance may remain useful as data.

It shall not automatically become trusted temporal knowledge.

## 18. Fail-Closed Rule

Where correct temporal interpretation is required for:

- authority;
- governance;
- safety;
- verification;
- lifecycle validity;
- causal determination;
- audit integrity;

and the required temporal semantics cannot be established, RSOS shall fail
closed according to the governing contract.

Unknown time remains Unknown.

Ambiguous order remains ambiguous.

Unverified causality remains unverified.

## 19. Compatibility Rule

This contract is additive.

Existing specialized contracts remain authoritative within their defined
scope where they provide stronger or more specific temporal semantics.

This contract shall not silently redefine:

- Runtime audit storage;
- Lifecycle Event storage;
- federation protocols;
- approval schemas;
- domain-specific validity rules.

Conflicts between this common contract and a specialized contract require
explicit review.

## 20. Engineering Consequences

Future RSOS engineering reviews should distinguish temporal dimensions before
introducing or modifying timestamp fields.

A new timestamp field should answer:

1. What temporal dimension does it represent?
2. Who or what supplies the clock?
3. Is that clock trusted?
4. Is the timestamp timezone-aware?
5. Is UTC normalization required?
6. Can information arrive late or out of order?
7. What does ordering by this field mean?
8. What deterministic tie-breaker exists?
9. Does the timestamp affect validity or authority?
10. What uncertainty must be preserved?
11. What evidence supports causal interpretation?
12. What audit relationship must remain reconstructable?

## 21. Non-Goals

RSOS-TIME-001 does not define:

- one universal physical clock;
- one global distributed total order;
- automatic clock synchronization;
- one universal causal graph;
- database migrations;
- API changes;
- Runtime behavior changes;
- automatic repair of legacy timestamps;
- automatic conversion from naive timestamps to UTC.

Those require separate governed engineering work.

## 22. Canonical Invariants

The following invariants are established by this contract:

TIME-INV-001:
Different temporal dimensions shall not be treated as semantically equivalent
without an explicit governing rule.

TIME-INV-002:
`created_at` is not automatically event occurrence time.

TIME-INV-003:
Timestamp precedence alone does not prove causality.

TIME-INV-004:
UTC is the canonical RSOS audit time reference.

TIME-INV-005:
External and device timestamps are temporal claims until their clock trust is
established.

TIME-INV-006:
Late and out-of-order information shall remain representable.

TIME-INV-007:
Temporal uncertainty shall not be replaced by false precision.

TIME-INV-008:
Effective validity shall remain distinct from record creation time.

TIME-INV-009:
Replay shall not silently rewrite original temporal provenance.

TIME-INV-010:
Temporal conflicts affecting governed interpretation shall remain visible.

TIME-INV-011:
Timestamp-only ordering shall not be generalized into causal ordering.

TIME-INV-012:
Unknown or unverifiable material temporal semantics shall fail closed according
to the applicable governing contract.

## 23. Acceptance Boundary

This document is a temporal-semantics engineering contract only.

Acceptance of this document does not authorize implementation.

Any subsequent Runtime, database, migration, API, worker, synchronization or
production change requires its own:

- reality inventory;
- impact analysis;
- change classification;
- implementation plan;
- verification evidence;
- rollback or recovery consideration where applicable;
- human approval.

Until such separate approval exists:

TEMPORAL_CONTRACT_RUNTIME_CHANGE_AUTHORIZED = NO
TEMPORAL_CONTRACT_DATABASE_CHANGE_AUTHORIZED = NO
TEMPORAL_CONTRACT_PRODUCTION_CHANGE_AUTHORIZED = NO
