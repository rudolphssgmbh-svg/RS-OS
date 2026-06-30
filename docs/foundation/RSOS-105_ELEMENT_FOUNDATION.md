# RSOS-105 Element Foundation

Status: Draft
Datum: 2026-06-26

## Zweck

Ab RSOS-105 ist Element der universelle Basistyp von RSOS.

Module, Objekte, Changes, Tenants, Dokumente, Fahrzeugakten, Knowledge-Eintraege und Governance-Regeln sind Spezialisierungen eines Elements.

## Grundsatz

Alles, was in RSOS beobachtet, beschrieben, veraendert, geprueft oder auditiert wird, ist ein Element.

## Element-Typen

Beispiele:

- module
- object
- change
- tenant
- registry_entry
- document
- vehicle_record
- customer_record
- knowledge_entry
- governance_rule
- recovery_action
- observation
- evidence
- verification
- audit_entry
- learning_entry

## Minimalstruktur

Ein Element besitzt mindestens:

- element_id
- element_type
- name
- status
- owner
- tenant_id
- source_module
- created_at
- updated_at

## Standardbereiche

Jedes Element kann nach RSOS-101A beschrieben werden:

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

## Statusmodell

Moegliche Element-Zustaende:

- created
- observed
- interpreted
- under_review
- verified
- approved
- active
- completed
- archived
- rejected
- recovered
- failed

## Regel

Ein Element ist nicht nur ein Datensatz.
Ein Element ist ein nachvollziehbarer Zustand innerhalb des RSOS-Metamodells.

## Bedeutung

Mit dem Element-Modell kann RSOS unterschiedliche Dinge einheitlich behandeln:

- Fahrzeuge
- Kunden
- Auftraege
- Dateien
- Module
- Changes
- Evidence
- Governance
- Audit
- Recovery

Damit wird RSOS von einer Sammlung einzelner Funktionen zu einer gemeinsamen Runtime fuer beobachtbare, pruefbare und kontrollierte Elemente.
