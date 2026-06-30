# RSOS-104 Unified Meta Model

Status: Draft
Datum: 2026-06-26

## Zweck

RSOS verwendet ein gemeinsames Metamodell fuer Module, Objekte und Changes.

Ein Modul, ein Objekt und ein Change werden nicht als getrennte Welten behandelt.
Sie folgen derselben Grundstruktur.

## Grundstruktur

Jedes RSOS-Element kann ueber folgende Bereiche beschrieben werden:

- 00_identity
- 01_configuration
- 02_interfaces
- 03_runtime
- 04_observation
- 05_evidence
- 06_verification
- 07_governance
- 08_audit
- 09_metrics
- 10_learning
- 11_recovery
- 99_tests

## Elementtypen

RSOS unterscheidet mindestens folgende Elementtypen:

- module
- object
- change
- tenant
- registry_entry
- document
- vehicle_record
- governance_rule
- knowledge_entry
- recovery_action

## Gemeinsames Prinzip

Nicht der Dateipfad ist entscheidend.
Entscheidend ist die Identitaet, der Zustand, die Verantwortung und die nachvollziehbare Veraenderung eines Elements.

## Minimalfelder

Jedes RSOS-Element benoetigt mindestens:

- element_id
- element_type
- name
- status
- owner
- tenant_id
- related_object_id
- source_module
- created_at
- updated_at

## Lebenszyklus

Reality
-> Observation
-> Interpretation
-> Understanding
-> Change Proposal
-> Verification
-> Governance
-> Execution
-> Evidence
-> Audit
-> Learning
-> Recovery if required

## Regel

Ein Element gilt nur dann als kontrolliert, wenn folgende Fragen beantwortbar sind:

- Was ist es?
- Wem gehoert es?
- Warum existiert es?
- Welchen Zustand hat es?
- Welche Veraenderungen betreffen es?
- Welche Evidence liegt vor?
- Welche Verifikation liegt vor?
- Welche Governance gilt?
- Welche Audit-Spur existiert?
- Wie kann Recovery erfolgen?

## Bedeutung

RSOS entwickelt damit nicht nur Funktionen.
RSOS entwickelt ein einheitliches Modell fuer Wirklichkeit, Beobachtung, Verstaendnis und kontrollierte Veraenderung.
