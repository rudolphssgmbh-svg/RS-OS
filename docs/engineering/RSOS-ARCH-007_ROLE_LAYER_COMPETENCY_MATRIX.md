# RSOS-ARCH-007 – Role, Layer and Competency Matrix

Status: SPECIFIED  
Classification: ARCHITECTURE  
Purpose: Stable role, layer and competency model for RSOS.

## 1. Principle

RSOS is defined by roles, responsibilities, layers, flows and decision points.

Names and aliases are secondary.  
Technical responsibility is primary.

A new role may only be introduced if it has:

- own input
- own output
- own decision level
- no unnecessary overlap
- auditability
- governance capability

Current result:

No additional core role is required.

Two structural layers remain explicit:

- Coordination Layer
- Meta Observation Layer

## 2. Core Roles

| Role | Neutral technical role | Primary responsibility |
|---|---|---|
| Allvater | Global Governance / Namespace Authority | global routing and meta-orchestration |
| Mimir | Knowledge Authority | history, memory, trace |
| Minerva | Architecture Authority | structure, strategy, rule assessment |
| JARVIS | Interface Coordinator | communication, translation, orientation |
| A.W.A. | Validation Guardian | validation, integrity, quarantine |
| Logi | Execution Engine | computation, worker execution |
| Loki | Variation Engine | mutation, exploration, red-team impulses |
| Bragi | Innovation Engine | concepts, hypotheses, abstraction |
| Ra | Synchronization Infrastructure | time, clock, resources, lifecycle |
| Thor | Transaction Guardian | ACID, commit, rollback |
| Heimdall | Security Gateway | perimeter, zero trust, ingress control |
| Freyr | Growth Engine | scaling and wabe division |
| Freyja | Federation Engine | binding and sphere synthesis |
| VEIT | Learning Engine | competence development |
| HAR | Responsibility Authority | approval, responsibility, action |

## 3. Layer Model

| Layer | Function | Primary roles |
|---|---|---|
| Physical / Runtime | real execution | Logi, Thor, Heimdall, Ra |
| Data / Memory | events, objects, audit, history | Mimir |
| Interpretation | meaning, evidence, rules | A.W.A., Minerva, JARVIS |
| Coordination | scheduling, dependencies, flow control | Ra, Thor, JARVIS, Minerva, Logi |
| Cognitive / Evolution | mutation, innovation, growth, federation | Loki, Bragi, Freyr, Freyja, VEIT |
| Governance | policy, responsibility, final authorization | Allvater, Minerva, Mimir, HAR, Core Council |
| Meta Observation | self-observation, simulation, drift, feedback | Mimir, A.W.A., JARVIS, VEIT, Ra |

## 4. Competency Matrix

| Competency | Primary role | Supporting roles |
|---|---|---|
| Observe | A.W.A. | JARVIS, Ra |
| Remember | Mimir | VEIT |
| Ask | JARVIS | Bragi, Mimir |
| Interpret | JARVIS | Minerva, Mimir |
| Validate | A.W.A. | Thor, Heimdall |
| Decide | Core Council | HAR, Minerva |
| Execute | Logi | Thor, Ra |
| Protect | Heimdall | A.W.A., Thor |
| Secure transaction | Thor | Logi |
| Synchronize | Ra | Thor |
| Learn | VEIT | Mimir, JARVIS |
| Mutate | Loki | A.W.A. |
| Invent | Bragi | Loki, Mimir |
| Scale | Freyr | Ra, Minerva |
| Federate | Freyja | Heimdall, A.W.A. |
| Take responsibility | HAR | Core Council |

## 5. Stable Combinations

| Combination | Meaning |
|---|---|
| Mimir + Bragi | history plus new hypotheses |
| Loki + A.W.A. | variation plus validation |
| Logi + Thor | execution plus transaction safety |
| Ra + Logi | timing plus execution |
| Heimdall + A.W.A. | ingress protection plus internal validation |
| Freyr + Freyja | division plus federation |
| JARVIS + HAR | recommendation plus responsibility |
| VEIT + Mimir | learning plus long-term memory |
| Minerva + Core Council | architecture decision plus governance |

## 6. Forbidden Combinations

No role may independently:

- modify Foundation
- approve productive runtime decisions
- bypass governance
- delete audit traces
- exit quarantine without validation
- declare itself the source of truth

Specific prohibitions:

| Combination | Risk |
|---|---|
| Loki without A.W.A. | uncontrolled chaos |
| Logi without Thor | unsafe execution |
| Bragi without Mimir | unsupported speculation |
| Heimdall without A.W.A. | access control without meaning validation |
| JARVIS without HAR | recommendation without responsibility |
| Ra without governance | timing without priority control |

## 7. Normal System Flow

Input  
→ Heimdall verifies ingress  
→ A.W.A. validates integrity  
→ Mimir checks history  
→ JARVIS interprets and explains  
→ Minerva assesses structure  
→ Core Council decides  
→ HAR authorizes  
→ Logi executes  
→ Thor secures transaction  
→ VEIT learns  
→ Mimir archives

## 8. Innovation Flow

Problem  
→ Mimir checks history  
→ Bragi generates hypothesis  
→ Loki generates variants  
→ Logi simulates  
→ A.W.A. validates  
→ Minerva assesses architecture impact  
→ Core Council decides  
→ HAR authorizes  
→ VEIT integrates competence  
→ Mimir archives

## 9. Security Flow

Ingress  
→ Heimdall checks origin and signature  
→ A.W.A. checks meaning and integrity  
→ risk enters quarantine  
→ Loki may mutate only in lab context  
→ Logi runs tests  
→ Thor secures rollback  
→ Mimir stores evidence  
→ Core Council decides release or block

## 10. Completeness Result

Checked rejected role candidates:

- Auditor Engine
- Policy Engine
- State Manager
- Conflict Resolver
- Simulation Engine
- Meta-Learning Engine
- Inquiry Engine
- Dependency Resolver

Result:

No new core role is required.

These candidates are classified as competencies or layer functions.

Open structural implementation targets:

- Coordination Layer
- Meta Observation Layer

These are not roles.  
They are controlled flows between existing roles.

## 11. Core Council

The Core Council is the highest constitutional, legislative and judicial governance body inside an autonomous wabe.

It is a virtual composite governance node, not a normal runtime role.

It is constituted by:

- Mimir as Knowledge Authority
- Minerva as Architecture Authority

HAR is attached when human authorization, responsibility or external accountability is required.

The Core Council decides on:

- amendment authorization
- unresolved conflict arbitration
- runtime rule overrule
- lifecycle mandates
- capability revocation

The Core Council does not execute.

## 12. Council Secretariat

The Council Secretariat is the preparation and notification function of the Core Council.

It may:

- collect approvals
- collect evidence
- verify completeness
- prepare decision files
- notify affected roles
- route signed mandates
- collect readiness feedback

It may not:

- decide
- approve
- overrule
- execute
- modify governance outcomes

## 13. JARVIS as Conductor

JARVIS is the central coordination and collaboration conductor of RSOS.

JARVIS does not decide truth, constitution or responsibility.

JARVIS:

- coordinates roles
- routes information
- prioritizes task visibility
- informs affected units
- monitors progress
- escalates deviations
- keeps collaboration coherent

Short rule:

Core Council decides.
Council Secretariat prepares.
JARVIS conducts.
HAR takes responsibility.
Runtime executes.

## 14. Sphere and Cube Coordination

RSOS coordination is fractal.

| Level | Unit | Coordinator | Decision body |
|---|---|---|---|
| Wabe | autonomous unit | Wabe-JARVIS | Wabe Core Council |
| Kugel | cooperation of wabes | Kugel-JARVIS | Sphere Council |
| Würfel | federation of spheres | Cube-JARVIS | Federation Council |

JARVIS remains the conductor on every level.

Only scope changes.

## 15. Cube Stacking

Cube stacking means arranging cubes into higher-order federation topology.

This is not execution and not normal coordination.

Current decision:

No new core role is required.

Cube stacking is assigned to Allvater as Global Governance / Namespace Authority.

Allvater manages:

- global namespace
- federation topology
- cube hierarchy
- routing coordinates
- root trust boundaries

JARVIS coordinates the work across cubes.

Federation Council authorizes structural changes.

Freyja may create binding between units.

Freyr may support growth and division.

Allvater defines the topology.


## 16. Council Hierarchy

RSOS governance is fractal.

Each structural level has its own decision body, preparation function and conductor.

| Level | Structural unit | Decision body | Preparation function | Conductor |
|---|---|---|---|---|
| Wabe | autonomous unit | Wabe Core Council | Wabe Council Secretariat | Wabe-JARVIS |
| Kugel | cooperation of wabes | Sphere Council | Sphere Council Secretariat | Kugel-JARVIS |
| Würfel | federation of spheres | Federation Council | Federation Council Secretariat | Cube-JARVIS |

Higher councils do not replace lower councils.

They coordinate and authorize decisions only within their defined scope.

## 17. Responsibility Flow

Responsibility flows from decision to preparation to coordination to execution.

Core rule:

Council decides.
Secretariat prepares.
JARVIS conducts.
HAR takes responsibility.
Runtime executes.
Mimir archives.

Flow:

Request
→ Council Secretariat collects evidence, approvals and readiness
→ Core Council decides
→ Council Secretariat distributes signed mandate
→ JARVIS coordinates affected roles
→ HAR confirms responsibility if human accountability is required
→ Runtime roles execute within mandate
→ A.W.A. validates execution integrity
→ Thor secures commit or rollback
→ VEIT learns from verified outcome
→ Mimir archives final trace

## 18. Notification Flow

Notification is not authorization.

Notification ensures that every affected role receives the correct information at the correct time.

Notification flow:

Council Secretariat
→ JARVIS
→ affected role owners
→ readiness feedback
→ Council Secretariat
→ Core Council if escalation is required

JARVIS may notify, remind, route and escalate.

JARVIS may not approve, overrule or execute.

## 19. Federation Lifecycle

Kugeln and Würfel require explicit lifecycle states.

| State | Meaning |
|---|---|
| PROPOSED | unit or federation is requested |
| REVIEW | evidence and compatibility are checked |
| AUTHORIZED | council has approved creation or change |
| ACTIVE | unit participates in normal operation |
| SYNCHRONIZING | unit exchanges state, trust or knowledge |
| SPLITTING | unit is dividing into smaller units |
| MERGING | units are combining into a larger structure |
| SUSPENDED | unit is temporarily removed from active flow |
| ARCHIVED | unit is preserved as historical record |
| DEPRECATED | unit is no longer valid for active use |

No Kugel or Würfel may enter ACTIVE state without council authorization.

## 20. Collaboration Protocol

Collaboration between units follows the same minimal protocol on every level.

1. Proposal
2. Evidence collection
3. Compatibility check
4. Council authorization
5. Secretariat preparation
6. JARVIS coordination
7. HAR responsibility check
8. Runtime execution
9. Validation
10. Archive

This protocol applies to:

- Wabe internal collaboration
- Kugel-level cooperation
- Würfel-level federation
- cube stacking
- mitosis
- sphere synthesis
- capability sharing

## 21. Final ARCH-007 Closure Rule

ARCH-007 defines the stable role, layer and competency architecture.

New concepts must first be classified as one of:

- role
- competency
- layer function
- flow
- lifecycle state
- governance artifact
- implementation detail

A new core role is allowed only if it passes the full role test.

If a function can be expressed as a competency, layer function or flow between existing roles, no new role may be introduced.
