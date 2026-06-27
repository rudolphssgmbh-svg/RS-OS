# RSOS-130A.2 Server Classification Matrix

Status: Draft
Datum: 2026-06-27
Bezug: RSOS-130A.1 Server Inventory

## Zweck

Dieses Dokument klassifiziert die in RSOS-130A.1 beobachteten Bloecke des Monolithen `runtime-api/server.js`.

Es ist die verbindliche Zwischenstufe zwischen Inventur und technischer Extraktion.

Es veraendert keinen Code.

## Grundsatz

Observation
-> Classification
-> Transformation
-> Verification

Keine Extraktion ohne vorherige Klassifikation.

## Klassifikationsmatrix

| Beobachteter Block | Zeilenbereich grob | Technische Natur | Primaere RSOS-Rolle | Sekundaere RSOS-Rolle | Zielmodul |
| --- | ---: | --- | --- | --- | --- |
| Bootstrap / Requires / Config | 1-257 | Node Setup, Env, DB Pool | Bootstrap | Infrastructure | bootstrap/ |
| DB Initialization | 258-301 | DDL Init | Bootstrap | Evidence | bootstrap/ |
| Response Helper | 302-315 | JSON Response | Response | Infrastructure | response/ |
| Audit Hash | 316-322 | Crypto Hashing | Evidence | Infrastructure | evidence/ |
| Event Writer | 323-396 | Event Persistence | Evidence | Observation | evidence/ |
| Auth Helpers | 397-478 | Token, Role, Operator Check | Verification | Governance | verification/ |
| Body Parser | 479-501 | Request Body Handling | Ingress | Infrastructure | ingress/ |
| Recommendation Generator Helper | 502-893 | Recommendation Engine | Adaptation | Governance | adaptation/ |
| HTTP Dispatcher / Health / Auth | 894-999 | Request Routing | Ingress | Verification | ingress/ |
| Incident Management | 1003-2446 | Incident API | Interaction | Governance / Evidence | interaction/incidents/ |
| Reports / Outcomes / Measurements | 2569-3151 | Reporting, Outcomes, Measurements | Evidence | Knowledge | evidence/reports/ |
| Verification Cycles | 3152-3269 | Verification API | Verification | Evidence | verification/ |
| Facts / Fact Trace | 3270-3699 | Fact API, Trace | Knowledge | Evidence / Response | knowledge/facts/ |
| Unknowns | 3703-3907 | Unknown Tracking | Observation | Knowledge | observation/unknowns/ |
| Source Quality / Conflicts | 3908-4176 | Source Assessment | Verification | Tension / Evidence | verification/sources/ |
| Fact Acceptance Rules | 4177-4322 | Acceptance Policy | Governance | Verification | governance/ |
| Fact Validation / Confidence | 4323-4820 | Validation, Confidence | Verification | Knowledge | verification/facts/ |
| Governance Checks / Outcomes | 4821-5143 | Governance API | Governance | Verification | governance/ |
| Lessons / Heuristics / Patterns | 5144-6598 | Learning Rules, Patterns | Knowledge | Selection | knowledge/patterns/ |
| Cross Loop Validations | 6599-6938 | Cross Validation | Verification | Adaptation | verification/cross-loop/ |
| Governance Policies | 6939-7082 | Policy API | Governance | Knowledge | governance/policies/ |
| Runtime Objects | 7083-7165 | Object API | Element | Interaction | interaction/objects/ |
| Runtime Execute | 7166-7413 | Execution API | Interaction | Infrastructure | interaction/execution/ |
| Runtime Events / Audit Chain | 7414-7539 | Events, Chain Verify | Evidence | Verification | evidence/audit/ |
| Training Plans | 7540-7829 | Training Completion | Adaptation | Knowledge | adaptation/training/ |
| Communications | 7830-7919, 8578-8971 | Communication API | Interaction | Evidence | interaction/communications/ |
| Orchestrations | 7920-8524 | Orchestration API | Interaction | Governance | interaction/orchestration/ |
| Learning Summary / Evidence | 9054-9220 | Learning Views | Knowledge | Evidence | knowledge/learning/ |
| Competencies | 9221-9402 | Competency API | Knowledge | Adaptation | knowledge/competency/ |
| Recommendation Rules / Generation | 9403-9704 | Recommendation APIs | Adaptation | Selection / Governance | adaptation/recommendations/ |
| Recommendation Gates | 9705-10223 | Gate APIs | Verification | Governance | verification/recommendation-gates/ |
| Recommendation Execution / Approval / Trace | 10224-10839 | Action + Approval APIs | Governance | Adaptation | governance/recommendations/ |
| Full Trace / Paths | 10840-11407 | Trace APIs | Evidence | Verification / Response | evidence/trace/ |
| Relations / Graph | 11408-11836 | Graph and Relation API | Interaction | Knowledge | interaction/graph/ |
| Tenants | 11837-12362 | Tenant API | Element | Governance | interaction/tenants/ |
| Training From Gaps / Learning Dashboard | 12363-12525 | Training + Learning Dashboard | Adaptation | Response | adaptation/learning/ |
| Recommendations From Gaps | 12526-12653 | Gap Recommendations | Adaptation | Knowledge | adaptation/recommendations/ |
| Knowledge API | 12654-12906 | Knowledge CRUD | Knowledge | Evidence | knowledge/ |
| Admin Dashboard / Tenant Admin | 12907-13478 | Admin Control | Governance | Response | governance/admin/ |
| Tenant Dashboards | 13479-14199 | Dashboard APIs | Response | Observation | response/dashboards/ |
| Governance Evaluate | 14200-14249 | Governance Evaluation | Governance | Verification | governance/evaluate/ |
| Schedule / Worker / Jobs | 14250-15352 | Worker Runtime | Infrastructure | Interaction | infrastructure/worker/ |
| Defense Layer | 15353-17632 | Defense, Quarantine, Recovery | Observation | Verification / Governance / Evidence | observation/defense/ |
| Learning Runtime | 17704-18527 | Learning, Assessment, Competence | Knowledge | Adaptation / Evidence | knowledge/learning-runtime/ |

## Extraktionsreihenfolge

Die technische Extraktion erfolgt nicht nach Dateigroesse, sondern nach Risiko und Abhaengigkeiten.

### Phase 1: Niedriges Risiko

1. response/
2. bootstrap/
3. ingress/
4. verification/auth helpers
5. evidence/audit helpers

### Phase 2: Mittleres Risiko

6. observation/unknowns
7. response/dashboards
8. evidence/trace
9. knowledge/facts
10. verification/facts

### Phase 3: Hoeheres Risiko

11. adaptation/recommendations
12. governance/recommendations
13. interaction/orchestration
14. observation/defense
15. knowledge/learning-runtime

## Gate je Extraktion

Jede Extraktion muss diese Bedingung erfuellen:

1. Keine fachliche Logikaenderung
2. server.js ruft nur das neue Modul auf
3. bestehende API bleibt unveraendert
4. run_all_tir.sh muss PASS liefern
5. Commit nur fuer genau eine Extraktion

## Erste empfohlene Extraktion

Nicht Bootstrap zuerst.

Die erste technische Extraktion sollte `response/` sein, weil `send(res, code, data)` eine kleine, klare und isolierte Funktion ist.

Danach:

- TIR-Lauf
- Commit
- naechstes kleines Modul

## Ergebnis

Die Klassifizierung bestaetigt:

Der Monolith ist physisch gross, aber logisch bereits in stabile Verantwortungsbereiche gegliedert.

RSOS-130 kann daher inkrementell und risikoarm fortgesetzt werden.

