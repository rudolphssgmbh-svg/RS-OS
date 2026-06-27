# RSOS-130A.1 Server Inventory

Status: Draft
Datum: 2026-06-27
Bezug: RSOS-130, RSOS-130A, RSOS-200, RSOS-201

## Zweck

Dieses Dokument ist die erste statische Inventur des aktuellen Monolithen:

runtime-api/server.js

Es dokumentiert beobachtete Struktur, Groesse, bereits vorhandene Modularisierung, Funktionsgruppen, Routenbereiche und Tabellen-Nutzung.

Es veraendert keinen Code.

## Beobachtungsgrundsatz

Observation precedes Mutation.

Vor jeder Extraktion muss der bestehende Zustand sichtbar, dokumentiert und klassifiziert sein.

## Monolith-Groesse

runtime-api/server.js umfasst zum Zeitpunkt der Inventur:

18597 Zeilen

## Bereits vorhandene Modularisierung

Der Server laedt bereits Module aus:

runtime-api/modules/rsos060/

Beobachtete Module:

- sources-routes
- evidence-routes
- witness-observations-routes
- assumptions-hypotheses-routes
- verifications-routes

Bewertung:

Die Modularisierung hat bereits begonnen. RSOS-130 startet daher nicht bei Null, sondern muss vorhandene Module respektieren und weiterfuehren.

## Zentrale Hilfs- und Kernfunktionen

Beobachtete globale Funktionen:

- executeDefensePipeline
- initDb
- send
- createAuditHash
- writeEvent
- verifyOperatorSignature
- generateToken
- verifyToken
- requireRole
- readBody
- generateRecommendationsForObject
- updateWorkflowState

Vorlaeufige systemische Zuordnung:

| Funktion | Systemische Rolle |
| --- | --- |
| initDb | Bootstrap |
| send | Response |
| createAuditHash | Evidence |
| writeEvent | Evidence / Observation |
| verifyOperatorSignature | Verification |
| generateToken | Verification / Ingress |
| verifyToken | Verification |
| requireRole | Governance / Verification |
| readBody | Ingress |
| executeDefensePipeline | Observation / Verification / Governance / Evidence |
| generateRecommendationsForObject | Adaptation |
| updateWorkflowState | Adaptation / Knowledge |

## Beobachtete Routenbereiche

Die Routen sind nicht ueber Express-Router verteilt, sondern innerhalb des HTTP-Request-Handlers ueber req.method und path-Pruefungen organisiert.

Beobachtete Hauptbereiche:

| Bereich | Beispiele | Vorlaeufige RSOS-Rolle |
| --- | --- | --- |
| Health | /health | Bootstrap / Observation |
| Auth | /auth/login | Ingress / Verification |
| Incidents | /runtime/incidents | Interaction / Governance / Evidence |
| Reports | /runtime/reports | Knowledge / Response |
| Report Segments | /runtime/report-segments | Knowledge |
| Outcomes | /runtime/outcomes | Evidence / Knowledge |
| Measurements | /runtime/measurements | Evidence / Verification |
| Verification Cycles | /runtime/verification-cycles | Verification |
| Facts | /runtime/facts | Knowledge / Evidence |
| Fact Trace | /runtime/trace/fact | Evidence / Verification / Response |
| Unknowns | /runtime/unknowns | Observation / Knowledge |
| Source Quality | /runtime/source-quality | Evidence / Verification |
| Source Conflicts | /runtime/source-conflicts | Tension / Verification |
| Fact Acceptance Rules | /runtime/fact-acceptance-rules | Governance |
| Governance Checks | /runtime/facts/governance-check | Governance / Verification |
| Lessons Learned | /runtime/lessons-learned | Knowledge / Adaptation |
| Heuristics | /runtime/heuristics | Selection / Knowledge |
| Patterns | /runtime/patterns | Selection / Knowledge |
| Cross Loop Validations | /runtime/cross-loop-validations | Verification |
| Governance Policies | /runtime/governance-policies | Governance |
| Objects | /runtime/objects | Element / Interaction |
| Execute | /runtime/execute | Interaction |
| Events | /runtime/events | Evidence / Observation |
| Audit Chain | /audit/chain/verify | Evidence / Verification |
| Training Plans | /runtime/training-plans | Adaptation / Knowledge |
| Communications | /runtime/communications | Interaction |
| Orchestrations | /runtime/orchestrations | Interaction / Governance |
| Learning Evidence | /runtime/learning-evidence | Evidence / Knowledge |
| Competencies | /runtime/competencies | Knowledge / Adaptation |
| Recommendations | /runtime/recommendations | Adaptation / Governance |
| Recommendation Gates | /runtime/recommendations/gates | Verification / Governance |
| Full Trace | /runtime/trace | Evidence / Verification / Response |
| Relations | /runtime/relations | Interaction |
| Graph | /runtime/graph | Knowledge / Interaction |
| Tenants | /runtime/tenants | Element / Governance |
| Admin Tenants | /runtime/admin/tenants | Governance |
| Dashboards | /runtime/dashboard | Response / Observation |
| Schedule / Worker | /runtime/schedule, /runtime/worker/run | Interaction / Infrastructure |
| Metrics | /runtime/metrics | Observation |
| Dead Letter | /runtime/dead-letter | Infrastructure / Evidence |
| Workflows | /runtime/workflows | Interaction / Adaptation |
| Defense | /runtime/defense/* | Observation / Verification / Governance / Evidence |
| Audit Reports | /runtime/audit-reports | Evidence / Response |
| Learning Runtime | /runtime/learning/* | Knowledge / Adaptation |
| Assessments | /runtime/assessments | Evidence / Knowledge |
| Competence Runtime | /runtime/competence/* | Competency / Knowledge / Adaptation |

## Auffaellige Domänen-Bloecke

### Incident Management

Zeilenbereich grob:

1003 bis 2446

Beobachtete RSOS-Kommentare:

- RSOS-071
- RSOS-072A bis RSOS-072F
- RSOS-073A bis RSOS-073D

Vorlaeufige Rolle:

Interaction, Governance, Evidence, Response

### RSOS-060 Knowledge / Evidence Foundation

Zeilenbereich grob:

2569 bis 7036

Enthaelt unter anderem:

- Reports
- Outcomes
- Measurements
- Verification Cycles
- Facts
- Unknowns
- Source Quality
- Conflicts
- Acceptance Rules
- Governance Checks
- Lessons
- Heuristics
- Patterns
- Cross Loop Validations

Vorlaeufige Rolle:

Evidence, Verification, Knowledge, Selection, Governance

### Runtime Core / Object / Execution

Zeilenbereich grob:

7083 bis 7475

Enthaelt:

- Objects
- Execute
- Events
- Audit Chain Verify

Vorlaeufige Rolle:

Element, Interaction, Evidence, Verification

### Orchestration / Communication / Learning

Zeilenbereich grob:

7540 bis 9294

Enthaelt:

- Training Plans
- Communications
- Orchestrations
- Learning Summaries
- Learning Evidence
- Competencies

Vorlaeufige Rolle:

Interaction, Adaptation, Knowledge

### Recommendations

Zeilenbereich grob:

9403 bis 10762

Enthaelt:

- Recommendation Rules
- Generate
- Feedback
- Gates
- Verify
- Execute
- Approve
- Trace

Vorlaeufige Rolle:

Adaptation, Verification, Governance

### Trace / Path / Relations / Graph

Zeilenbereich grob:

10840 bis 11742

Enthaelt:

- Full Trace
- Execution Path
- Governance Path
- Audit Path
- Relations
- Graph

Vorlaeufige Rolle:

Evidence, Verification, Interaction, Knowledge

### Tenant / Admin / Dashboards

Zeilenbereich grob:

11837 bis 14150

Enthaelt:

- Tenants
- Domains
- Settings
- Members
- Admin Tenants
- Dashboards

Vorlaeufige Rolle:

Element, Governance, Response, Observation

### Worker / Metrics / Defense

Zeilenbereich grob:

14200 bis 17632

Enthaelt:

- Governance Evaluate
- Schedule
- Worker Run
- Metrics
- Dead Letter
- Workflows
- Defense Ingress
- Shadow Validations
- Quarantine
- Savepoints
- Recovery
- Defense Metrics
- Audit Reports
- Defense State

Vorlaeufige Rolle:

Infrastructure, Observation, Verification, Governance, Evidence

### Learning / Assessment / Competence

Zeilenbereich grob:

17704 bis 18527

Enthaelt:

- Learning States
- Assessments
- Assessment Attempts
- Competence State Generator
- Competence Gaps
- Learning Recommendations

Vorlaeufige Rolle:

Knowledge, Evidence, Adaptation, Competency

## Tabellen-Nutzung

Die Tabellen-Nutzung zeigt eine starke Konzentration auf:

- runtime_objects
- runtime_events
- runtime_execution_jobs
- runtime_recommendations
- runtime_tenants
- runtime_incidents
- runtime_governance_decisions
- runtime_orchestrations
- runtime_training_plans
- runtime_learning_evidence
- runtime_competencies
- runtime_relations
- runtime_defense_state
- runtime_quarantine_queue
- runtime_ingress_events
- runtime_facts
- runtime_verification_cycles
- runtime_verification_results

Bewertung:

server.js ist gleichzeitig Runtime-Orchestrator, Governance-Engine, Evidence-Schicht, Knowledge-Schicht und Dashboard-Backend.

## Erste Schlussfolgerung

Die fachlichen Grenzen sind bereits im Code erkennbar.

Die physische Datei ist monolithisch, aber die logische Struktur ist ausreichend sichtbar, um eine kontrollierte, inkrementelle Extraktion vorzubereiten.

## Naechster Schritt

Vor der ersten Code-Extraktion wird RSOS-130A.2 erstellt:

Server Classification Matrix

Dort werden die beobachteten Bereiche aus dieser Inventur einer verbindlichen Zielstruktur zugeordnet.

Erst danach beginnt die erste technische Extraktion.

