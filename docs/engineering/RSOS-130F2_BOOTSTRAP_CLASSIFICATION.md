# RSOS-130F2 Bootstrap Classification

Status: Draft
Datum: 2026-06-27
Bezug: RSOS-130F1 Bootstrap Inventory

## Zweck

Dieses Dokument klassifiziert die Bootstrap-Bestandteile vor der technischen Extraktion.

Es veraendert keinen Code.

## Klassifikation

| Bestandteil | Aktueller Ort | Systemische Rolle | Zielmodul |
| --- | --- | --- | --- |
| ROOT_PUBLIC_KEY | server.js | Bootstrap / Config | bootstrap/config.js |
| JWT_SECRET | verification/auth.js | Verification / Config | bleibt vorerst in verification/auth.js |
| DB_HOST / DB_USER / DB_PASSWORD / DB_NAME | server.js | Bootstrap / Database Config | bootstrap/database.js |
| Pool-Erzeugung | server.js | Bootstrap / Database | bootstrap/database.js |
| initDb | server.js | Bootstrap / Schema Init | bootstrap/init-db.js |
| executeDefensePipeline | server.js | Observation / Defense | nicht Bootstrap |
| writeEvent | server.js | Evidence / Observation | nicht Bootstrap |

## Entscheidung

RSOS-130F wird in drei kleinen Extraktionen umgesetzt:

1. RSOS-130F3 Extract database pool
2. RSOS-130F4 Extract initDb
3. RSOS-130F5 Recheck config / remove obsolete ROOT_PUBLIC_KEY if unused

## Begründung

ROOT_PUBLIC_KEY ist derzeit nur in einem auskommentierten Block referenziert.

JWT_SECRET ist bereits korrekt im Auth-Modul gekapselt.

Der sinnvollste naechste technische Schritt ist daher nicht config.js, sondern die Auslagerung des Datenbank-Pools nach bootstrap/database.js.

## Gate

Nach jeder Bootstrap-Extraktion gilt:

- node -c
- run_all_tir.sh
- ein einzelner Commit

