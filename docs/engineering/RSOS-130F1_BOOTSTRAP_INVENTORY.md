# RSOS-130F1 Bootstrap Inventory

Status: Draft
Datum: 2026-06-27
Bezug: RSOS-130A2 Server Classification Matrix

## Zweck

Dieses Dokument definiert, welche Teile von runtime-api/server.js tatsaechlich zum Bootstrap gehoeren.

Es veraendert keinen Code.

## Beobachtung

Der obere Bereich von server.js enthaelt gemischte Verantwortungen:

- technische Imports
- Modul-Imports
- Konfiguration
- Datenbank-Pool
- ROOT_PUBLIC_KEY / JWT_SECRET
- executeDefensePipeline
- initDb
- writeEvent

Nicht alles davon ist Bootstrap.

## Bootstrap-relevant

Folgende Teile gehoeren zur Bootstrap-Schicht:

- Node-Core-Imports
- externe Package-Imports
- lokale Modul-Imports
- Konfigurationswerte
- Datenbank-Pool-Erzeugung
- initDb

## Nicht Bootstrap

Folgende Teile bleiben vorerst ausserhalb einer Bootstrap-Extraktion:

- executeDefensePipeline
- writeEvent
- createAuditHash
- send
- Auth-Helper
- readBody
- fachliche Runtime-Routen
- Defense-Logik
- Evidence-Logik
- Governance-Logik

## Bewertung executeDefensePipeline

executeDefensePipeline befindet sich physisch im oberen Bereich von server.js.

Systemisch gehoert die Funktion jedoch nicht zu Bootstrap.

Primaere Rolle:

Observation / Defense

Sekundaere Rollen:

Verification / Governance / Evidence

Daher darf executeDefensePipeline nicht zusammen mit Bootstrap extrahiert werden.

## Vorgeschlagene Bootstrap-Zielstruktur

runtime-api/
└── bootstrap/
    ├── config.js
    ├── database.js
    └── init-db.js

## Extraktionsreihenfolge

Bootstrap sollte nicht als ein grosser Block extrahiert werden.

Empfohlene Folge:

1. RSOS-130F2 Extract bootstrap/config.js
2. RSOS-130F3 Extract bootstrap/database.js
3. RSOS-130F4 Extract bootstrap/init-db.js

Nach jedem Schritt:

- node -c
- run_all_tir.sh
- einzelner Commit

## Ergebnis

Bootstrap ist klein genug fuer eine risikoarme Extraktion, muss aber sauber von Defense- und Evidence-Logik getrennt bleiben.

