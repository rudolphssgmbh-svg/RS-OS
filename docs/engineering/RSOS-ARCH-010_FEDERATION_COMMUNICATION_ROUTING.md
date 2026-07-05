# RSOS-ARCH-010: Federation Communication & Routing

Status: Draft for Review
Reference: ARCH-008 Federation Architecture, ARCH-009 Federation Governance Protocol
Scope: Architecture / Communication / Routing only
Core Role Policy: No new core roles introduced

## 1. Purpose

ARCH-010 defines how federations communicate, address each other, route messages and preserve auditability across Waben, Kugeln and Würfel.

It does not introduce implementation code or new core roles.

## 2. Communication Boundary

Federation communication may transport:

- observations
- evidence references
- governance requests
- decision notifications
- risk warnings
- synchronization notices
- recovery signals
- learning results
- capability requests
- escalation messages

Federation communication may not transport:

- unaudited authority
- hidden approvals
- implicit trust
- untraceable state changes
- governance bypasses

## 3. Routing Principle

Every routed message must identify:

- source federation
- target federation
- source Wabe, Kugel or Würfel
- target Wabe, Kugel or Würfel
- message type
- namespace
- trust level
- governance reference
- audit reference

No route is valid without traceability.

## 4. Federation Address Model

Canonical address pattern:

federation://<federation>/<kugel>/<wabe>/<cube>/<tenant>/<domain>/<object>/<event>

Address segments may be omitted only when scope remains clear.

Every address must be:

- unique
- resolvable
- auditable
- bounded by trust
- compatible with governance

## 5. Message Types

Allowed message types:

- OBSERVATION_EVENT
- EVIDENCE_REFERENCE
- GOVERNANCE_REQUEST
- GOVERNANCE_DECISION
- TRUST_CHANGE_NOTICE
- ROUTE_REQUEST
- ROUTE_APPROVED
- ROUTE_SUSPENDED
- SYNC_NOTICE
- RISK_WARNING
- RECOVERY_SIGNAL
- ISOLATION_NOTICE
- LEARNING_RESULT
- CAPABILITY_REQUEST
- COUNCIL_ESCALATION
- JARVIS_COORDINATION

## 6. Routing States

A route may have one of the following states:

- proposed
- under_review
- approved
- active
- suspended
- isolated
- revoked
- archived

A route may not become active without ARCH-009 governance approval.

## 7. Message Flow

Standard message flow:

1. Source creates message
2. Namespace is resolved
3. Trust boundary is checked
4. Governance permission is checked
5. Route state is checked
6. Message is transmitted
7. Target receives message
8. Target validates source
9. Audit reference is recorded
10. Response or escalation is created

## 8. Trust-Aware Routing

Routing must respect trust level.

Trust levels:

- none: no routing
- observed: observation only
- verified: evidence and observation
- accepted: governed operational communication
- delegated: scoped delegation only
- suspended: blocked except recovery or audit

Trust never implies unlimited routing.

## 9. Namespace Resolution

Namespace resolution determines whether a target is valid.

Resolution must check:

- federation identity
- Kugel boundary
- Wabe scope
- Würfel capability
- tenant/domain compatibility
- route permission
- trust level
- audit availability

If namespace resolution fails, the message must not be routed.

## 10. Federation Bus Concept

The federation bus is an architectural communication layer.

It is responsible for:

- message classification
- route lookup
- namespace validation
- trust boundary verification
- governance reference validation
- audit reference creation
- escalation on failure

The federation bus is not a new role and not an autonomous decision maker.

## 11. Inter-Federation Communication

Inter-federation communication requires:

- known source
- known target
- approved route
- explicit trust level
- message type permission
- audit reference
- recovery path

Communication must be suspended if trust or governance becomes invalid.

## 12. Council Communication Channel

Councils communicate through structured review messages.

Council messages must contain:

- review topic
- affected federation
- concern
- evidence reference
- risk statement
- requested decision
- dissent marker
- recommendation

Council communication is advisory unless governance approval activates a decision.

## 13. JARVIS Coordination Channel

JARVIS coordination messages may contain:

- context request
- evidence comparison
- contradiction marker
- uncertainty marker
- recommendation request
- escalation request
- synchronization support

JARVIS coordination may not approve, override or hide decisions.

## 14. Failure Handling

Routing failure must produce one of:

- retry recommendation
- escalation
- route suspension
- trust downgrade
- isolation request
- recovery signal
- audit-only archive

Silent failure is not allowed.

## 15. Audit Requirements

Every communication event must preserve:

- source
- target
- message type
- route state
- trust level
- governance reference
- timestamp
- outcome
- audit reference

## 16. Architectural Decision

Decision:

Federation communication and routing are accepted as governed architecture layers.

Constraint:

No message may cross federation boundaries without namespace resolution, explicit trust scope, governance permission and auditability.

