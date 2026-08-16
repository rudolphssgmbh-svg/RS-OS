# RSOS Pförtner Communication Protocol

Document-ID: RSOS-PF-001B
Status: DRAFT_FOR_VERIFICATION
Parent: RSOS-PF-001A
Scope: Communication Contract
Runtime Implementation: NO

## 1. Purpose

This protocol defines the controlled communication lifecycle for ingress
packages entering RSOS through the Pförtner.

The normal path is:

External Source
    |
    v
Pförtner
    |
    v
Concierge
    |
    v
JARVIS
    |
    v
Responsible Competency Role
    |
    +--> HERMES / Human when formal human communication or approval is required

No role may silently bypass a required communication stage.

## 2. Core principle

Transport is not truth.

Receipt of a message proves only that a communication event was received.

It does not prove:

- factual correctness;
- authenticity beyond available evidence;
- professional correctness;
- authorization;
- approval;
- successful execution.

Every stage preserves the distinction between:

MESSAGE_RECEIVED
MESSAGE_UNDERSTOOD
MESSAGE_CLASSIFIED
MESSAGE_FORWARDED
MESSAGE_DELIVERED
MESSAGE_ACCEPTED
MESSAGE_ASSESSED
MESSAGE_APPROVED
ACTION_EXECUTED
RESULT_VERIFIED

These states must not be treated as equivalent.

## 3. Message identity

Every communication package requires a stable identity.

Minimum identifiers:

- message_id
- trace_id
- correlation_id

message_id identifies one communication object.

trace_id identifies the audit/evidence path.

correlation_id connects related communication events belonging to the same
business or technical context.

A retry must not silently create a new logical request.

## 4. Minimum communication envelope

A communication envelope should be capable of representing:

- protocol_version
- message_id
- trace_id
- correlation_id
- parent_message_id
- tenant_id
- sender
- sender_type
- source_channel
- recipient
- purpose
- purpose_category
- declared_reason
- classification
- priority
- created_at
- received_at
- acknowledged_at
- forwarded_at
- completed_at
- status
- attempt
- payload_reference
- evidence_reference
- result_reference
- rejection_reason
- error_code

Unknown values remain explicitly unknown.

Unknown information must never be invented merely to complete the envelope.

## 5. Pförtner receipt

On receipt the Pförtner records:

- message identity;
- declared source;
- channel;
- receipt timestamp;
- tenant/context when known;
- declared or recognizable purpose;
- technical classification;
- correlation information;
- initial routing destination.

The Pförtner does not decide whether the content is true.

## 6. ACK / NACK contract

Every controlled handover requires an explicit outcome.

ACK means:

The receiving stage confirms technical receipt of the communication package.

ACK does not mean:

- agreement;
- truth;
- approval;
- authorization;
- successful execution.

NACK means:

The receiving stage could not accept the communication package according to
the communication contract.

A NACK requires a reason or error classification.

## 7. Handover states

Permitted conceptual states include:

RECEIVED
CLASSIFIED
QUEUED
FORWARDED
ACKNOWLEDGED
PROCESSING
WAITING_FOR_INFORMATION
WAITING_FOR_APPROVAL
COMPLETED
REJECTED
FAILED
ESCALATED
CANCELLED

State transitions must be traceable.

A later correction creates a new event.

Historical communication evidence is not overwritten.

## 8. Duplicate protection

Duplicate detection should consider at least:

- message_id;
- correlation_id;
- sender;
- purpose;
- payload/evidence reference;
- relevant time window.

A suspected duplicate must not automatically be deleted.

Possible outcomes:

NEW
DUPLICATE_CONFIRMED
DUPLICATE_SUSPECTED
RETRY
UNKNOWN

Duplicate classification is evidence and not factual truth by itself.

## 9. Retry contract

Retries must be bounded.

Every retry records:

- original message_id;
- correlation_id;
- attempt number;
- retry reason;
- retry timestamp;
- previous failure or timeout reference.

Retries must not create uncontrolled loops.

A retry does not erase the failed attempt.

## 10. Timeout contract

Timeouts are observations.

A timeout means:

Expected communication progress was not observed within the defined interval.

It does not automatically mean that a person or system failed.

Timeout handling may produce:

- WAITING
- RETRY
- ESCALATION
- TECHNICAL_REVIEW
- HUMAN_REVIEW

Timeout thresholds require a separate operational policy.

This architecture contract does not invent production timeout values.

## 11. Escalation

Escalation occurs when the normal communication path cannot safely continue.

Possible reasons include:

- repeated delivery failure;
- missing required information;
- unresolved destination;
- governance requirement;
- security concern;
- conflicting instructions;
- unresolved tenant/context;
- timeout threshold reached;
- technical routing failure.

Escalation must identify:

- reason;
- originating stage;
- responsible next stage;
- timestamp;
- evidence reference.

Escalation does not itself authorize action.

## 12. Concierge contract

Concierge receives the documented ingress package from Pförtner.

Concierge may:

- acknowledge receipt;
- clarify communication;
- request missing information;
- mediate;
- prepare the communication context;
- preserve intent and meaning;
- hand the prepared request toward JARVIS.

Concierge must not silently rewrite the substantive request.

Material clarification must remain traceable.

## 13. JARVIS contract

JARVIS coordinates routing to the appropriate competency roles.

JARVIS may:

- inspect routing context;
- identify required competencies;
- coordinate parallel assessments;
- request missing assessments;
- consolidate routing status.

JARVIS must not:

- fabricate missing evidence;
- convert assumptions into facts;
- silently bypass required roles;
- grant human approval;
- erase conflicting assessments.

JARVIS coordinates.

JARVIS does not decide alone.

## 14. HERMES contract

HERMES participates when formal decision communication, approval communication
or controlled human handover is required.

HERMES is not the general ingress gateway.

HERMES does not replace Pförtner, Concierge or JARVIS.

Where human approval is mandatory:

WAITING_FOR_HUMAN_APPROVAL

must remain distinguishable from:

APPROVED

and from:

EXECUTED

## 15. Response path

Communication must support a controlled return path.

Conceptual return path:

Responsible Competency Role
    |
    v
JARVIS
    |
    v
Concierge
    |
    v
Pförtner / controlled egress boundary
    |
    v
Original requester / authorized destination

The return message preserves correlation_id.

The response receives its own message_id and trace evidence.

## 16. Purpose preservation

Purpose is preserved through the communication chain.

Roles may enrich context but must not silently change the original declared
purpose.

The system should distinguish:

declared_purpose

from:

interpreted_purpose

and, where assessed by an authorized competency:

validated_purpose

## 17. Time evidence

Communication timing should distinguish at least:

created_at
received_at
acknowledged_at
forwarded_at
completed_at

Derived measurements may include:

receipt_latency
ack_latency
handover_duration
processing_duration
end_to_end_duration

UTC is the canonical audit reference.

Operational local time may additionally be retained.

## 18. Audit contract

Communication evidence contributes to:

WER
WANN
WARUM
WAS

Additionally the protocol should make reconstructable:

WOHER
WOHIN
STATUS
KORRELATION
ERGEBNIS

Audit evidence is append-oriented.

Corrections reference earlier evidence instead of rewriting it.

## 19. Health candidates

Potential later Health Layer observations include:

- ingress_count
- acknowledgement_rate
- nack_count
- unresolved_message_count
- retry_count
- duplicate_suspected_count
- duplicate_confirmed_count
- timeout_count
- escalation_count
- routing_failure_count
- average_ack_latency
- average_handover_duration
- trace_coverage
- correlation_coverage
- concierge_handover_success
- jarvis_routing_success

These are system observations.

They must not automatically be converted into judgments about individual
employees or persons.

## 20. Hausmeister cooperation

The Hausmeister may inspect technical communication health within its mandate.

This may include:

- stuck communication;
- missing ACK;
- excessive retry;
- broken routing;
- missing trace identifiers;
- technical queue condition;
- communication service availability;
- abnormal processing duration.

The Hausmeister reports observations.

The Hausmeister does not determine substantive truth and does not grant
business or governance approval.

Where coordination is required, findings are communicated through the defined
RSOS communication structure toward Concierge/JARVIS.

## 21. Failure principle

Communication failure must be visible.

RSOS must prefer:

VISIBLE_FAILURE

over:

SILENT_LOSS

and:

EXPLICIT_UNKNOWN

over:

INVENTED_STATE

A failed handover remains evidence.

## 22. Security principle

Secrets must not be placed into ordinary communication traces.

Audit may record:

SECRET_REQUIRED=YES
SECRET_SOURCE=protected_reference
SECRET_ACCESS_RESULT=PASS

Audit must not record the secret value itself.

## 23. Governance

Pförtner:
controlled ingress and ingress evidence.

Concierge:
communication, clarification and mediation.

JARVIS:
coordination and competency routing.

Competency roles:
professional assessment within mandate.

HERMES:
formal human/decision communication where required.

Hausmeister:
technical health observation and operational reporting within mandate.

Council/HAR:
governance according to established mandate.

Human:
required final responsibility and approval.

## 24. Implementation boundary

RSOS-PF-001B is an architecture and communication contract.

It does not:

- create database tables;
- create API endpoints;
- start workers;
- change containers;
- modify secrets;
- alter production configuration;
- create autonomous authority;
- define production timeout values;
- grant execution permission.

Runtime implementation requires a separate verified and human-approved step.
