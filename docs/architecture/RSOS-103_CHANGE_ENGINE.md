# RSOS-103 Change Engine

Status: Draft
Datum: 2026-06-26

## Zweck

Die Change Engine definiert Veraenderung als zentrales RSOS-Objekt.

RSOS verwaltet nicht nur Dateien, Module oder Zustaende.
RSOS verwaltet nachvollziehbare, pruefbare und steuerbare Veraenderungen.

## Grundsatz

Jede Architekturentscheidung ist zunaechst eine verifizierbare Hypothese, kein Dogma.

## Change Lifecycle

Reality
-> Observation
-> Interpretation
-> Change Proposal
-> Verification
-> Governance
-> Execution
-> Evidence
-> Audit
-> Learning
-> Recovery if required

## Pflichtfelder

- change_id
- tenant_id
- object_id
- object_type
- module
- areas
- reason
- observation
- interpretation
- hypothesis
- verification_status
- governance_status
- execution_status
- audit_status
- recovery_possible
- created_at
- updated_at

## Betroffene Bereiche

Ein Change muss mindestens einem RSOS-101A-Bereich zugeordnet werden.

## Regel

Nicht jedes Modul muss vollstaendig geprueft werden.
Geprueft werden die Bereiche, die durch den Change betroffen sind.

Wenn Unsicherheit besteht, wird der Pruefumfang erweitert.

## Abschluss

Ein Change gilt erst als abgeschlossen, wenn Verification, Governance, Evidence, Audit und Recovery bewertet wurden.
