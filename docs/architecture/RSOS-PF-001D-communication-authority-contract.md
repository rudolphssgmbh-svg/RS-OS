# RSOS-PF-001D — Communication Authority Contract

## 1. Purpose

This contract defines communication, routing, orchestration,
approval and execution authority boundaries between RSOS roles.

It does not grant new runtime authority.

## 2. Core Principle

Communication authority is not decision authority.

Routing authority is not factual authority.

Orchestration authority is not approval authority.

Process continuation authority is not unrestricted execution authority.

No role gains authority merely because it receives, forwards,
coordinates or communicates information.

## 3. Pförtner

Pförtner is the controlled communication ingress role.

Pförtner MAY:

- receive communication;
- record ingress evidence;
- preserve declared purpose;
- classify the communication package;
- forward the package to Concierge.

Pförtner MUST NOT:

- determine substantive truth;
- make business decisions;
- grant governance approval;
- replace Concierge;
- replace JARVIS;
- replace HERMES;
- execute the substantive request.

Authority classification:

COMMUNICATE = YES
ROUTE = INGRESS_TO_CONCIERGE
ASSESS = NO
APPROVE = NO
EXECUTE = NO

## 4. Concierge

Concierge mediates and prepares controlled communication handovers.

Concierge MAY:

- receive documented ingress packages;
- verify communication completeness;
- enrich context without silently changing declared purpose;
- prepare requests for further coordination;
- hand prepared requests toward JARVIS.

Concierge MUST NOT:

- silently rewrite substantive intent;
- determine factual truth merely through mediation;
- grant human approval;
- replace JARVIS coordination.

Authority classification:

COMMUNICATE = YES
ROUTE = CONTROLLED_HANDOVER
ASSESS = COMMUNICATION_CONTEXT_ONLY
APPROVE = NO
EXECUTE = NO

## 5. JARVIS

JARVIS is the coordination and orchestration authority within
the defined RSOS communication structure.

JARVIS MAY:

- receive prepared requests;
- identify responsible competency roles;
- route requests to responsible roles;
- coordinate multi-role processing;
- preserve workflow context;
- orchestrate process continuation;
- collect and coordinate role responses;
- coordinate the controlled return path.

JARVIS MUST NOT:

- convert communication into factual truth without evidence;
- replace responsible competency assessment;
- grant mandatory human approval;
- represent WAITING_FOR_HUMAN_APPROVAL as APPROVED;
- represent APPROVED as EXECUTED;
- obtain unrestricted execution authority from coordination authority;
- silently bypass defined communication roles.

Authority classification:

COMMUNICATE = YES
ROUTE = YES
ORCHESTRATE = YES
CONTINUE_WORKFLOW = YES
ASSESS = COORDINATE_RESPONSIBLE_ROLES
UNILATERAL_APPROVE = NO
UNBOUNDED_EXECUTE = NO

## 6. Responsible Competency Role

A responsible competency role performs assessment only inside
its defined mandate.

A competency role MAY:

- assess matters within its competence;
- produce findings;
- produce evidence;
- produce recommendations;
- return results through the defined communication path.

A competency role MUST NOT gain authority outside its mandate.

Authority classification:

COMMUNICATE = YES
ASSESS = MANDATE_BOUND
APPROVE = ONLY_IF_EXPLICITLY_MANDATED
EXECUTE = ONLY_IF_EXPLICITLY_MANDATED

## 7. HERMES

HERMES is the formal human approval and decision communication role.

HERMES MAY:

- present approval requests;
- communicate decision context;
- capture human responses;
- preserve approval communication evidence.

HERMES MUST NOT:

- act as general ingress gateway;
- replace Pförtner;
- replace Concierge;
- replace JARVIS;
- approve on behalf of the human;
- execute the requested action;
- continue workflow independently.

Authority classification:

COMMUNICATE = YES
HUMAN_GATE = YES
APPROVE = NO
EXECUTE = NO
CONTINUE_WORKFLOW = NO

## 8. Human Authority

Where human approval is mandatory, only the authorized human
may provide that approval.

The following states remain distinct:

WAITING_FOR_HUMAN_APPROVAL

APPROVED

EXECUTED

No AI role may collapse these states.

## 9. Hausmeister

Hausmeister observes operational and technical conditions
within its defined mandate.

Hausmeister MAY:

- observe technical state;
- report availability;
- report abnormal processing duration;
- report operational findings;
- perform explicitly authorized operational duties.

Hausmeister MUST NOT:

- determine substantive business truth;
- grant business approval;
- grant governance approval;
- bypass Concierge/JARVIS where coordination is required.

Authority classification:

COMMUNICATE = YES
OBSERVE = YES
ASSESS = TECHNICAL_MANDATE_ONLY
APPROVE = NO
EXECUTE = OWN_OPERATIONAL_MANDATE_ONLY

## 10. Authority Separation

RSOS distinguishes at minimum:

COMMUNICATION_AUTHORITY

ROUTING_AUTHORITY

ORCHESTRATION_AUTHORITY

ASSESSMENT_AUTHORITY

APPROVAL_AUTHORITY

EXECUTION_AUTHORITY

PROCESS_CONTINUATION_AUTHORITY

These authorities MUST NOT be treated as equivalent.

Possession of one authority does not imply possession of another.

## 11. Communication Failure

Communication failure must remain visible.

RSOS prefers:

VISIBLE_FAILURE

over:

SILENT_SUCCESS

A failed handover, unavailable role, incomplete response or
unresolved authority boundary must remain observable.

## 12. Controlled Return Path

Conceptual return path:

Responsible Competency Role
    |
    v
JARVIS
    |
    +--> Responsible Competency Role
    |
    +--> Concierge
    |
    +--> HERMES --> Authorized Human
    |
    +--> Authorized Requesting Context

JARVIS determines the appropriate communication route within its mandate
according to purpose, competency, communication contract, governance,
security requirements and required human approval.

JARVIS MAY select and coordinate the appropriate communication path.

JARVIS MUST NOT bypass a mandatory competency, governance, security,
evidence or human-approval stage.

The exact path therefore depends on mandate, context and approval
requirements and is not required to be identical for every communication.

## 13. Non-Grant Clause

This document describes authority boundaries.

It does not:

- activate a role;
- grant runtime permissions;
- modify database permissions;
- create API permissions;
- enable HERMES;
- authorize production changes;
- authorize autonomous business decisions.

Any technical implementation requires separate review,
evidence and human approval.

## 14. Contract Result

PF001D_COMMUNICATION_AUTHORITY = DEFINED
PF001D_ROUTING_AUTHORITY = DEFINED
PF001D_ORCHESTRATION_AUTHORITY = DEFINED
PF001D_HUMAN_APPROVAL_BOUNDARY = DEFINED
PF001D_EXECUTION_BOUNDARY = DEFINED
PF001D_RUNTIME_CHANGE = NONE
PF001D_DATABASE_CHANGE = NONE
PF001D_PRODUCTION_CHANGE = NONE

## 15. Human Acceptance

HUMAN_ACCEPTANCE = YES

ACCEPTED_AT_UTC = 2026-08-16T08:37:09Z

PRE_ACCEPTANCE_SHA256 = cfe0bd4a3b0e517ae5fc6e9c86ae90948193e579df27463c536f52548e35bd55

The reviewed RSOS-PF-001D Communication Authority Contract was
explicitly accepted by the authorized human after completion of the
Authority Consistency Gate.

This acceptance confirms the documented authority model, including:

- JARVIS communication authority;
- JARVIS routing authority;
- JARVIS orchestration authority;
- JARVIS process continuation authority;
- mandatory competency, governance, security, evidence and
  human-approval gate protection;
- HERMES human-gate separation;
- Hausmeister technical observation and mandate boundaries;
- separation of communication, routing, orchestration, assessment,
  approval, execution and process-continuation authority.

This acceptance does not grant technical implementation authority.

RUNTIME_AUTHORIZATION = NO
DATABASE_CHANGE = NO
CONTAINER_CHANGE = NO
SECRET_CHANGE = NO
PRODUCTION_CHANGE = NO
UNBOUNDED_AUTONOMY = NO
