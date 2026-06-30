# RSOS-120 Tenant Element Model

Status: Draft
Datum: 2026-06-27

## Zweck

RSOS-120 definiert einen Tenant als adaptives RSOS-Element.

Ein Tenant ist kein statischer Datensatz.
Ein Tenant besitzt Identitaet, Potentiale, Erfahrungen, Kompetenzen, Verhalten und Beziehungen.

## Tenant-Schichten

1. Identitaet
- tenant_id
- name
- domain
- owner
- source_module

2. Potential
- aktivierbare Module
- moegliche Prozesse
- verfuegbare Rollen

3. Erfahrungen
- runtime_events
- Auftraege
- Dokumente
- Fahrzeuge
- Kommunikation

4. Kompetenzen
- Verkauf
- Werkstatt
- Buchhaltung
- Transport
- Audit
- Recovery

5. Verhalten
- aktive Workflows
- aktive Regeln
- aktive Prozesse

6. Beziehungen
- Kunden
- Fahrzeuge
- Mitarbeiter
- Dokumente
- andere Tenants

## Grundsatz

Ein Tenant wird in RSOS nicht nur verwaltet.
Ein Tenant wird beobachtet, geprueft, bewertet und kann sich kontrolliert weiterentwickeln.

## Nachweis

Die erste technische Validierung erfolgt durch RSOS-TIR-0120A.
