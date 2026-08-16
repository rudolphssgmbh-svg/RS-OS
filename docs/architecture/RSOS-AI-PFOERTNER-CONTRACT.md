# RSOS Pförtner Contract

## 1. Purpose

The Pförtner is the controlled communication ingress role of RSOS.

Its responsibility is:

Eingang -> Identität/Herkunft -> Zeit -> Zweck -> Klassifikation -> Protokoll -> Übergabe

The Pförtner does not determine factual truth and does not make business,
technical, governance or human decisions.

## 2. Communication chain

External source / employee / system event
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
Responsible competency roles
    |
    +--> HERMES -> Human approval, when required

The normal communication path must not be silently bypassed.

## 3. Pförtner responsibilities

The Pförtner MAY:

- receive a message or event;
- identify or record its declared source;
- record the input channel;
- record receipt time;
- record the declared or recognizable purpose;
- assign a technical/category classification;
- assign or preserve a correlation identifier;
- create an immutable ingress trace;
- forward the package to Concierge;
- record forwarding time;
- measure ingress-to-handover duration;
- report technical rejection or routing failure.

## 4. Explicit boundaries

The Pförtner MUST NOT:

- decide whether a statement is true;
- determine professional correctness;
- grant approval;
- authorize execution;
- modify the substantive meaning of a message;
- silently discard a valid message;
- bypass required governance;
- replace Concierge;
- replace JARVIS;
- replace HERMES;
- overwrite an existing audit event.

A correction creates a new trace event referencing the original event.

## 5. Minimum ingress evidence

Every accepted ingress package should be capable of representing:

- event_id
- received_at_utc
- received_at_local
- source
- source_type
- input_channel
- tenant_id
- destination_context
- purpose
- purpose_category
- declared_reason
- priority
- correlation_id
- forwarded_to
- forwarded_at
- handover_status
- processing_duration_ms
- result
- rejection_reason
- trace_id

Not every field must contain a value when the information is unknown.

Unknown information must remain explicitly unknown and must not be invented.

## 6. Purpose semantics

The Pförtner records purpose as a claim or classification.

Example:

PURPOSE=Runtime API fault report

is permitted.

The Pförtner must not transform this into:

PURPOSE_VALID=YES

unless a separate authorized competency has performed that assessment.

## 7. Time contract

At minimum the communication trace distinguishes:

received_at
forwarded_at

Derived metric:

handover_duration = forwarded_at - received_at

Timestamps must be timezone-aware.

UTC is the canonical audit time reference.

Local time may additionally be retained for human operational context.

## 8. Concierge handover

The Pförtner hands the ingress package to Concierge.

Concierge is responsible for:

- communication;
- mediation;
- clarification;
- communicative preparation;
- controlled handover toward JARVIS.

The Pförtner records the handover but does not perform Concierge's role.

## 9. JARVIS boundary

JARVIS coordinates and routes the resulting request to the responsible
competency roles.

JARVIS does not retroactively change the Pförtner ingress evidence.

## 10. HERMES boundary

HERMES is used when a formal human approval or decision communication is
required.

HERMES is not the general ingress role.

## 11. Audit principle

The Pförtner contributes evidence for:

WER
WANN
WARUM
WAS

Ingress evidence must be append-oriented.

Corrections and later findings create new evidence referencing prior evidence.

## 12. Health candidates

The following metrics are candidates for later RSOS Health integration:

- ingress_count
- accepted_ingress_count
- rejected_ingress_count
- unresolved_ingress_count
- handover_duration_ms
- handover_failure_count
- routing_failure_count
- missing_source_count
- missing_purpose_count
- trace_coverage
- concierge_handover_success

These metrics are observations.

They do not by themselves constitute judgments about employees or persons.

## 13. Governance

Pförtner observes and records.
Concierge communicates and mediates.
JARVIS coordinates.
Specialist roles assess.
Council/HAR govern according to mandate.
Humans retain required final responsibility.

## 14. Implementation boundary

This contract alone:

- creates no database table;
- creates no API route;
- creates no runtime service;
- grants no execution authority;
- changes no production configuration;
- activates no autonomous agent.

Runtime implementation requires a separate verified implementation step.
