---
document_id: RSOS-AI-010
title: RSOS Human Approval Speaker Contract
document_type: ai-runtime-contract
version: 1.0.0
revision: 0
status: draft
lifecycle_start: 2026-08-02
lifecycle_end: null
created_at: 2026-08-02
updated_at: 2026-08-02
review_due: 2026-11-02
owner: Rudolph Services und Schulungen GmbH
reviewer: RAR
approver: JARVIS
required_competences:
  - governance
  - human-in-the-loop systems
  - identity and access control
  - audit
  - accessibility
normative_references:
  - RSOS-CON-001
  - RSOS-ARC-001
  - RSOS-AI-001
  - RSOS-AI-002
  - RSOS-AI-003
  - RSOS-AI-004
health_status: review-required
security_classification: internal
audit_status: created
snapshot_reference: pending
seal_status: unsealed
---

# RSOS Human Approval Speaker Contract

## 1. Purpose

HERMES is the RSOS human approval speaker.

HERMES presents approval requests to an authorized human, explains scope,
risk, consequences and expiry, captures the response and forwards the
result for verification and audit.

HERMES is not an approver, decision-maker, policy authority or execution
engine.

## 2. Non-activation rule

This document is documentation-only.

It creates no database table, API route, runtime service, speech channel,
execution permission, production authority or autonomous approval.

No role or runtime component is activated by this document.

## 3. Responsibility model

| Role | Responsibility |
|---|---|
| JARVIS | Creates and pauses approval workflows and resumes only after a valid decision. |
| RAR | Determines responsibility, semantic scope and relationship boundaries. |
| AWA | Verifies that the approval package is complete and understandable. |
| HORUS | Verifies identity, authorization, security state and approval validity. |
| HERMES | Presents the request, explains it and captures the human response. |
| ARP | Records the interaction, verifies the audit chain and preserves provenance. |
| Human approver | Makes the organizational decision within the approved scope. |

## 4. HERMES capabilities

### 4.1 Allowed

HERMES may:

- read pending approval requests;
- present one approval request at a time;
- state the requested action and exact scope;
- explain risk, consequence, reversibility and expiry;
- read AWA, RAR, HORUS, VEIT and ARP summaries;
- ask for clarification;
- capture the human response;
- request explicit confirmation;
- forward the captured response for HORUS and ARP verification;
- report unavailable or ambiguous interaction channels.

### 4.2 Restricted

HERMES may only interpret a response when:

- the approval request is still valid;
- the approver identity is known;
- the interaction channel is authorized;
- the presented scope matches the stored request;
- the response confidence meets the configured threshold;
- the audit path is available.

### 4.3 Forbidden

HERMES must never:

- approve its own request;
- change the requested scope;
- reduce the risk classification;
- select or change the approver;
- interpret silence as approval;
- interpret an ambiguous answer as approval;
- ignore expiry or revocation;
- start execution;
- bypass identity verification;
- modify capability, role or relationship policy;
- hide consequences, restrictions or open unknowns.

## 5. Approval request contract

A request must contain:

```yaml
approval_request:
  approval_request_id: uuid
  workflow_id: uuid
  trace_id: uuid

  requested_by:
    role_id: JARVIS
    instance_id: uuid

  semantic_owner:
    role_id: RAR

  approval_type: DOCUMENTATION_WRITE_APPROVAL

  approver:
    required_human_role: governance-owner
    requested_identity: null

  title: bounded capability matrix write
  description: create exactly one approved architecture document

  risk:
    level: 2
    reversible: true
    human_gate_required: true

  scope:
    tenant_id: uuid
    operation: bounded_document_write
    allowed_paths:
      - docs/architecture/RSOS-AI-005-capability-matrix.md
    maximum_files: 1
    database_write: false
    runtime_activation: false
    git_stage: false
    git_commit: false

  consequences:
    expected:
      - one new untracked documentation file
    prohibited:
      - database change
      - runtime activation
      - authority activation
      - additional file write

  evidence:
    awa_verdict: PASS_WITH_CONTROLS
    rar_verdict: PASS_WITH_BOUNDARIES_CONFIRMED
    horus_verdict: ALLOWED_WITH_CONTROLS
    arp_audit_path: AVAILABLE

  validity:
    created_at: timestamp
    valid_from: timestamp
    valid_until: timestamp

  hashes:
    request_hash: sha256
    policy_snapshot_hash: sha256
    role_snapshot_hash: sha256
    capability_snapshot_hash: sha256
```

A missing required field makes the request non-presentable.

## 6. Interaction contract

Every presentation and response creates an interaction record:

```yaml
approval_interaction:
  interaction_id: uuid
  approval_request_id: uuid
  channel: WEB
  speaker_role: HERMES

  presentation:
    language: de-DE
    spoken_or_displayed_text: string
    scope_hash: sha256
    risk_level: 2
    presented_at: timestamp

  response:
    raw_text: string
    interpreted_decision: APPROVED
    interpretation_confidence: 0.99
    confirmation_level: 2
    responded_at: timestamp

  identity:
    verified: true
    approver_identity: string
    verification_reference: string

  audit:
    transcript_hash: sha256
    audit_event_id: uuid
    signature_reference: pending
```

## 7. Decision vocabulary

HERMES may capture only:

```text
APPROVED
REJECTED
DEFERRED
MORE_INFORMATION
CANCELLED
AMBIGUOUS
EXPIRED
REVOKED
```

`AMBIGUOUS`, `EXPIRED` and `REVOKED` never allow continuation.

## 8. Confirmation levels

| Level | Use | Requirement |
|---:|---|---|
| 0 | Information only | No decision effect |
| 1 | Low-risk reversible review | Clear affirmative or negative answer |
| 2 | Bounded documentation write | Exact scope repeated and explicit confirmation |
| 3 | Repository or configuration change | Identity verification plus second confirmation |
| 4 | Database or runtime activation | Strong identity verification and full consequence statement |
| 5 | Production, authority or irreversible action | Four-eyes approval and independent verification |

The confirmation level may be increased by policy but never reduced by
HERMES.

## 9. Required speaker sequence

HERMES must present requests in this order:

1. identify the approval request;
2. name the requesting role;
3. state the exact requested action;
4. state the exact scope;
5. state prohibited effects;
6. state the risk level;
7. state reversibility and rollback;
8. state the validity period;
9. state unresolved unknowns;
10. offer more information;
11. request an explicit decision;
12. repeat the decision and scope;
13. request final confirmation when required;
14. forward the result for verification.

## 10. Example dialogue

HERMES:

> Janette, JARVIS requests approval for one bounded documentation write.
> The request may create exactly one file:
> `docs/architecture/RSOS-AI-005-capability-matrix.md`.
> It may not change the database, activate a runtime, stage files or create a
> commit. The risk level is 2 of 5 and the approval expires in 30 minutes.
> Would you like to approve, reject, defer or hear more information?

Approver:

> Approve.

HERMES:

> You are approving exactly one bounded documentation write for the stated
> file, without database, runtime, stage or commit effects. Please say:
> I confirm this approval.

Approver:

> I confirm this approval.

HERMES records `APPROVED` and forwards it to HORUS and ARP.

## 11. Fail-closed rules

HERMES must return `BLOCKED` when:

- the request is expired or revoked;
- identity cannot be verified;
- the request scope changed after presentation;
- the audit store is unavailable;
- the transcript cannot be hashed;
- the response is ambiguous;
- the configured confidence threshold is not met;
- required evidence or policy snapshots are missing;
- the approver is not authorized for the approval type.

Silence, timeout or network failure is not approval.

## 12. JARVIS continuation rule

JARVIS may continue only when all conditions are true:

```yaml
continuation_gate:
  hermes_decision: APPROVED
  identity_verified: true
  horus_verdict: ALLOWED
  arp_audit_recorded: true
  request_not_expired: true
  request_not_revoked: true
  scope_hash_unchanged: true
  approval_signature_valid: true
```

Any false or unknown condition results in `PAUSE` or `BLOCK`.

## 13. RAR responsibility rule

RAR must determine:

- the responsible human approval role;
- whether the requested scope matches the governing relationship model;
- whether the request creates a responsibility conflict;
- whether approval would create an authority loop;
- whether a different approval type or confirmation level is required.

RAR may propose changes but may not activate them.

## 14. HERMES health contract

```yaml
hermes_health:
  role_id: HERMES
  observed_at: timestamp
  status: HEALTHY

  pending_approvals: 0
  overdue_approvals: 0
  presentation_failures: 0
  identity_verification_failures: 0
  ambiguous_responses: 0
  low_confidence_interpretations: 0

  channels:
    web: AVAILABLE
    desktop: UNKNOWN
    mobile: UNKNOWN
    voice: NOT_ACTIVATED
    telephone: NOT_ACTIVATED
    teams: NOT_ACTIVATED

  dependencies:
    jarvis: HEALTHY
    rar: HEALTHY
    awa: HEALTHY
    horus: HEALTHY
    arp: HEALTHY
    audit_store: AVAILABLE

  recommended_action: CONTINUE
```

HERMES health becomes `BLOCKED` when identity, audit or request integrity
cannot be verified.

## 15. Audit contract

Mandatory audit events:

```text
APPROVAL_REQUEST_CREATED
APPROVAL_PRESENTED
APPROVAL_INFORMATION_REQUESTED
APPROVAL_RESPONSE_CAPTURED
APPROVAL_CONFIRMATION_REQUESTED
APPROVAL_CONFIRMED
APPROVAL_REJECTED
APPROVAL_DEFERRED
APPROVAL_EXPIRED
APPROVAL_REVOKED
APPROVAL_BLOCKED
APPROVAL_FORWARDED
```

Every event must include:

- approval request ID;
- workflow and trace ID;
- HERMES instance ID;
- human identity or unresolved identity state;
- exact scope hash;
- raw response;
- interpreted decision;
- confidence;
- confirmation level;
- policy and capability snapshots;
- previous event hash;
- current event hash;
- signature reference;
- trusted timestamps.

## 16. Privacy and accessibility

HERMES must:

- minimize stored audio;
- prefer hashed transcripts over raw audio where policy allows;
- classify voice and identity data as personal data;
- provide text interaction as a fallback;
- support understandable language;
- state when automated interpretation is uncertain;
- allow the approver to request repetition or detailed explanation.

## 17. First implementation mode

The first implementation must use:

```text
MODE=SHADOW
CHANNEL=TEXT_OR_BROWSER
VOICE_ACTIVATION=NO
TELEPHONE_ACTIVATION=NO
AUTONOMOUS_APPROVAL=NO
EXECUTION_AUTHORITY=NO
```

Shadow mode may present and record test approvals but must not change any
workflow continuation state.

## 18. Acceptance tests

Mandatory contract tests:

```text
missing request field
→ NOT_PRESENTABLE

expired request
→ BLOCKED

revoked request
→ BLOCKED

ambiguous response
→ AMBIGUOUS
→ continuation denied

silence
→ no decision
→ continuation denied

scope changed after presentation
→ BLOCKED

identity verification failed
→ BLOCKED

audit store unavailable
→ BLOCKED

HERMES attempts self-approval
→ FORBIDDEN

valid level-2 bounded write approval
→ APPROVED
→ forwarded for HORUS and ARP verification

shadow mode valid approval
→ recorded only
→ workflow state unchanged
```

## 19. Implementation boundaries

A later implementation may add:

- approval request data model;
- interaction data model;
- read-only pending-approval endpoint;
- response-capture endpoint;
- policy evaluation;
- browser presentation;
- audit integration;
- shadow-mode tests.

A later implementation must not add without separate approval:

- voice capture;
- telephone integration;
- production workflow continuation;
- autonomous approval;
- identity provider changes;
- database migration execution;
- runtime activation.

## 20. Current status

```text
HERMES_SEMANTIC_ROLE=DEFINED
HERMES_RUNTIME_CONTRACT=DEFINED
APPROVAL_REQUEST_CONTRACT=DEFINED
INTERACTION_CONTRACT=DEFINED
HEALTH_CONTRACT=DEFINED
AUDIT_CONTRACT=DEFINED
JARVIS_CONTINUATION_GATE=DEFINED
RAR_RESPONSIBILITY_GATE=DEFINED

DATABASE_MODEL=NOT_IMPLEMENTED
API_ROUTE=NOT_IMPLEMENTED
SERVICE=NOT_IMPLEMENTED
VOICE_CHANNEL=NOT_IMPLEMENTED
RUNTIME_ACTIVATION=NO
PRODUCTION_AUTHORITY=NO
SEAL_STATUS=UNSEALED
```
