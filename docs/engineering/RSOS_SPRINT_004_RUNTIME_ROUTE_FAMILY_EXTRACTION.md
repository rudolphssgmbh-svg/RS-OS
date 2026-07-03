# RSOS Engineering Sprint 004 - Runtime Route Family Extraction

Status: In Progress
Branch: feature/RSOS-060-evidence-foundation
Baseline: e499f83
Scope: Runtime route family extraction
Rule: No functional changes. Behavior-preserving modularization only.

## Ausgangslage

Dashboard-Familie ist modularisiert.
Runtime ist gesund.
Precheck am 2026-07-02:
- Branch: feature/RSOS-060-evidence-foundation
- HEAD: e499f83 refactor(runtime): extract tenant dashboard detail route
- /health: ok, runtime healthy, database connected

## Arbeitsprinzip

1. Ist-Zustand pruefen
2. Route-Familie vollstaendig analysieren
3. Dokumentation erstellen
4. Kleine verhaltenserhaltende Extraktionen
5. Nach jeder Extraktion:
   - Syntax pruefen
   - Runtime testen
   - /health pruefen
   - Regressionstest ausfuehren
   - Commit erstellen

## Zielbereiche

1. Learning Dashboard
2. Defense Dashboard
3. Incidents Dashboard
4. Governance-Familie

## Learning Dashboard Analyse

### Gefundene Routen

1. RSOS-049E Learning Dashboard
   - Methode: GET
   - Pfad: /runtime/learning/dashboard
   - Bereich in server.js: ca. Zeile 11856
   - Zweck: Tenant-bezogene Auswertung von Kompetenzen, Trainingsplaenen und Learning Evidence

2. RSOS-076D Learning Runtime Dashboard
   - Methode: GET
   - Pfad: /runtime/learning/runtime-dashboard
   - Bereich in server.js: ca. Zeile 17378
   - Zweck: Tenant-bezogene Runtime-Auswertung von Learning States, Competence States, Gaps, Assessments, Attempts und Recommendations

### Rollen

/runtime/learning/dashboard:
- system_admin
- runtime_admin
- auditor
- governance

/runtime/learning/runtime-dashboard:
- runtime_admin
- governance
- auditor
- system_admin

### Abhaengigkeiten

Beide Routen verwenden:
- req
- res
- path
- db
- send
- requireRole

/runtime/learning/runtime-dashboard verwendet zusaetzlich:
- URL

### Tabellen

/runtime/learning/dashboard:
- runtime_competencies
- runtime_training_plans
- runtime_learning_evidence

/runtime/learning/runtime-dashboard:
- runtime_learning_states
- runtime_competence_states
- runtime_competence_gaps
- runtime_assessments
- runtime_assessment_attempts
- runtime_learning_recommendations

### Extraktionsentscheidung

Die beiden Learning-Dashboard-Routen koennen gemeinsam in ein Modul ausgelagert werden:

runtime-api/routes/learning-dashboard-routes.js

Vorgesehene Schnittstelle:

handleLearningDashboardRoutes({
  req,
  res,
  path,
  db,
  send,
  requireRole
})

Rueckgaberegel:
- true: Route wurde behandelt
- false: Route gehoert nicht zu dieser Familie

### Verhaltenserhaltende Regeln

- Keine Query-Aenderungen
- Keine Rollen-Aenderungen
- Keine Response-Struktur-Aenderungen
- Keine Statuscode-Aenderungen
- Keine Tenant-Logik-Aenderung
- server.js nur minimal anpassen

## Sprint 004A - Learning Dashboard Extraction

Status: Verified
Datum: 2026-07-02

### Umsetzung

Extrahiert in:

runtime-api/routes/dashboard/learning-dashboard-route.js

Aus server.js entfernt:
- RSOS-049E Learning Dashboard
- RSOS-076D Learning Runtime Dashboard

In server.js ergaenzt:
- require handleLearningDashboardRoute
- Handler-Aufruf vor RSOS-049F Generate Recommendations From Competency Gaps

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/dashboard/learning-dashboard-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression ohne JWT:
- GET /runtime/learning/dashboard: 401 unauthorized
- GET /runtime/learning/runtime-dashboard: 401 unauthorized

Regression mit JWT:
- Login janette / rsos_secure_2026: TOKEN_OK
- GET /runtime/learning/dashboard: JSON response PASS
- GET /runtime/learning/runtime-dashboard?tenant_id=tenant-psgarage: JSON response PASS

Bewertung:
- Verhaltenserhaltende Extraktion bestaetigt
- Keine funktionalen Aenderungen beabsichtigt
- server.js reduziert
- Learning Dashboard Family modularisiert

## Sprint 004B - Defense Metrics Extraction

Status: Verified
Datum: 2026-07-02

### Umsetzung

Extrahiert in:

runtime-api/routes/defense/defense-metrics-route.js

Aus server.js entfernt:
- POST /runtime/defense/metrics/recalculate
- GET /runtime/defense/metrics
- GET /runtime/defense/dashboard

In server.js ergaenzt:
- require handleDefenseMetricsRoute
- Handler-Aufruf vor /runtime/audit-reports/generate

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/defense/defense-metrics-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression ohne JWT:
- GET /runtime/defense/metrics: 401 unauthorized
- GET /runtime/defense/dashboard: 401 unauthorized

Regression mit JWT:
- Login janette / rsos_secure_2026: TOKEN_OK
- GET /runtime/defense/metrics: JSON response PASS
- GET /runtime/defense/dashboard: JSON response PASS

Bewertung:
- Verhaltenserhaltende Extraktion bestaetigt
- Defense Metrics und Defense Dashboard modularisiert
- Defense State bleibt separat fuer Sprint 004C

## Sprint 004C - Defense State Extraction

Status: Verified
Datum: 2026-07-02

### Umsetzung

Extrahiert in:

runtime-api/routes/defense/defense-state-route.js

Aus server.js entfernt:
- GET /runtime/defense/state
- POST /runtime/defense/state

In server.js ergaenzt:
- require handleDefenseStateRoute
- Handler-Aufruf vor RSOS-076D Learning Runtime API

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/defense/defense-state-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression ohne JWT:
- GET /runtime/defense/state: 401 unauthorized

Regression mit JWT:
- Login janette / rsos_secure_2026: TOKEN_OK
- GET /runtime/defense/state: JSON response PASS

Bewertung:
- Verhaltenserhaltende Extraktion bestaetigt
- Defense State modularisiert

## Sprint 004D - Incident Dashboard Extraction

Status: Verified
Datum: 2026-07-02

### Umsetzung

Extrahiert in:

runtime-api/routes/incidents/incident-dashboard-route.js

Aus server.js entfernt:
- GET /runtime/incidents/metrics
- GET /runtime/incidents/search
- GET /runtime/incidents/completeness
- GET /runtime/incidents/dashboard

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/incidents/incident-dashboard-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression:
- Ohne JWT: alle vier Routen 401 unauthorized
- Mit JWT: alle vier Routen JSON response PASS
- GET /runtime/incidents/search ohne q: 400 validation_error PASS

Bewertung:
- Verhaltenserhaltende Read-only-Extraktion bestaetigt

## Sprint 004E - Incident Registry Extraction

Status: Verified
Datum: 2026-07-03

### Umsetzung

Extrahiert in:

runtime-api/routes/incidents/incident-registry-route.js

Aus server.js entfernt:
- GET /runtime/incidents
- GET /runtime/incidents/:incident_id/summary
- GET /runtime/incidents/:incident_id

In server.js ergaenzt:
- require handleIncidentRegistryRoute
- Handler-Aufruf vor RSOS-060 Evidence Routes

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/incidents/incident-registry-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression:
- Ohne JWT: alle drei Routen 401 unauthorized
- Mit JWT: GET /runtime/incidents JSON response PASS
- Missing valid UUID summary: 404 not_found PASS
- Missing valid UUID detail: 200 with incident null PASS

Bewertung:
- Verhaltenserhaltende Read-only-Extraktion bestaetigt

## Sprint 004F - Incident Core Workflow Extraction

Status: Verified
Datum: 2026-07-03

### Umsetzung

Extrahiert in:

runtime-api/routes/incidents/incident-core-route.js

Aus server.js entfernt:
- POST /runtime/incidents
- POST /runtime/incidents/:incident_id/links
- PATCH /runtime/incidents/:incident_id/status
- GET /runtime/incidents/:incident_id/timeline
- POST /runtime/incidents/:incident_id/lessons
- GET /runtime/incidents/:incident_id/lessons

In server.js ergaenzt:
- require handleIncidentCoreRoute
- Handler-Aufruf vor RSOS-073D Incident Governance Completeness

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/incidents/incident-core-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression:
- Ohne JWT: alle sechs Routen 401 unauthorized
- Mit JWT: timeline missing incident 404 not_found PASS
- Mit JWT: lessons missing incident 200 with empty lessons PASS
- Mit JWT: invalid status 400 validation_error PASS

Bewertung:
- Verhaltenserhaltende Core-Workflow-Extraktion bestaetigt
- Incident Governance bleibt separat

## Sprint 004G - Incident Governance Extraction

Status: Verified with pre-existing schema gap
Datum: 2026-07-03

### Umsetzung

Extrahiert in:

runtime-api/routes/incidents/incident-governance-route.js

Aus server.js entfernt:
- GET /runtime/incidents/:incident_id/governance/completeness
- POST /runtime/incidents/:incident_id/residual-risk
- POST /runtime/incidents/:incident_id/governance-approval
- POST /runtime/incidents/:incident_id/governance-review
- GET /runtime/incidents/:incident_id/governance

In server.js ergaenzt:
- require handleIncidentGovernanceRoute
- Handler-Aufruf vor Incident Dashboard Route

### Verifikation

Syntax:
- node -c runtime-api/server.js: PASS
- node -c runtime-api/routes/incidents/incident-governance-route.js: PASS

Runtime:
- docker restart rsos-runtime-api: PASS
- /health: ok, runtime healthy, database connected

Regression:
- Ohne JWT: alle fuenf Routen 401 unauthorized
- Mit JWT: completeness missing incident 404 not_found PASS
- Mit JWT: governance-review missing incident 404 not_found PASS
- Mit JWT: residual-risk missing incident 404 not_found PASS
- Mit JWT: governance view exposed existing schema gap: relation runtime_governance_approvals does not exist

Bewertung:
- Verhaltenserhaltende Extraktion bestaetigt
- Keine funktionale Aenderung vorgenommen
- Schema-Luecke separat behandeln, nicht in dieser Extraktion
