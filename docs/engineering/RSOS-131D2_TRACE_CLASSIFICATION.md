# RSOS-131D2 Trace Route Classification

Status: Draft
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Zweck

Dieses Dokument klassifiziert die Trace-Routen vor einer spaeteren technischen Extraktion.

Es veraendert keinen Code.

## Bezug

- RSOS-131D1 Trace Route Inventory
- runtime-api/server.js
- RSOS-131 Route Modularization

## Trace-Routen

| Route | Charakter | Extraktionsrisiko |
| --- | --- | --- |
| GET /runtime/trace/:object_id/full | Vollstaendige Domaenenaggregation | Hoch |
| GET /runtime/trace/:object_id | Kompakte Trace-Zusammenfassung | Mittel |

## Klassifikation der Full-Trace-Datenquellen

| Datenquelle | Trace-Teilbereich | Primaere RSOS-Rolle | Moeglicher Provider |
| --- | --- | --- | --- |
| runtime_objects | Object Snapshot | Knowledge / Element | trace/providers/object-provider.js |
| runtime_relations | Relation Snapshot | Interaction / Graph | trace/providers/relation-provider.js |
| runtime_recommendations | Recommendation Snapshot | Adaptation | trace/providers/recommendation-provider.js |
| runtime_orchestrations | Orchestration Snapshot | Interaction | trace/providers/orchestration-provider.js |
| runtime_training_plans | Training Snapshot | Adaptation / Learning | trace/providers/training-provider.js |
| runtime_learning_evidence | Learning Evidence Snapshot | Knowledge / Evidence | trace/providers/learning-provider.js |
| runtime_execution_jobs | Execution Snapshot | Interaction / Infrastructure | trace/providers/execution-provider.js |
| runtime_governance_decisions | Governance Snapshot | Governance | trace/providers/governance-provider.js |
| runtime_risks | Risk Snapshot | Governance / Observation | trace/providers/risk-provider.js |
| runtime_events | Audit Snapshot | Evidence | trace/providers/audit-provider.js |

## Architekturentscheidung

Trace wird nicht als ein einzelnes grosses Route-Modul extrahiert.

Stattdessen wird Trace spaeter in zwei Ebenen zerlegt:

1. Route Handler
2. Trace Provider

Der Route Handler orchestriert nur noch die Provider.

Die Provider liefern jeweils einen klaren Teilbereich.

## Reihenfolge fuer spaetere Extraktion

1. Provider fuer Object Snapshot
2. Provider fuer Audit Snapshot
3. Provider fuer Governance Snapshot
4. Provider fuer Relation Snapshot
5. Provider fuer Recommendations
6. Provider fuer Learning / Training
7. Provider fuer Execution
8. Full Trace Route Handler
9. Compact Trace Route Handler

## Ergebnis

Trace ist keine einfache Object-Route.

Trace ist eine Kompositionsschicht ueber mehrere Runtime-Domaenen.

Deshalb wird Trace erst nach Provider-Klassifikation extrahiert.

