# RSOS-131A Route Inventory

Status: Draft
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Zweck

Dieses Dokument startet RSOS-131 Runtime Route Modularization.

Es inventarisiert die HTTP-Routen im Monolithen runtime-api/server.js.

Es veraendert keinen Code.

## Grundsatz

Observation
-> Classification
-> Transformation
-> Verification

Keine Routen-Extraktion ohne vorherige Inventur und Klassifikation.

## Bisheriger Ausgangspunkt

RSOS-130 hat folgende Helper- und Bootstrap-Module extrahiert:

- runtime-api/response/send.js
- runtime-api/evidence/audit-hash.js
- runtime-api/verification/auth.js
- runtime-api/ingress/body.js
- runtime-api/bootstrap/database.js
- runtime-api/bootstrap/init-db.js

server.js enthaelt weiterhin die fachlichen HTTP-Routen.

## Inventar-Methode

Die Routen werden aus server.js ueber folgendes Muster beobachtet:

grep -nE 'app\.(get|post|put|patch|delete|options)\(' runtime-api/server.js

## Ziel von RSOS-131

server.js soll langfristig nur noch:

- Bootstrap ausfuehren
- HTTP-Server initialisieren
- Route-Module registrieren

Die fachlichen Routen werden schrittweise in systemische Module ueberfuehrt.

## Route-Domaenen fuer die spaetere Klassifikation

- Health / Runtime Status
- Authentication
- Runtime Objects
- Runtime Events / Evidence
- Governance
- Verification
- Knowledge
- Recommendations / Adaptation
- Communications / Interaction
- Orchestration / Interaction
- Defense / Observation
- Dashboards / Response
- Admin / Governance
- Training / Learning

## Naechster Schritt

RSOS-131A.1 soll eine vollstaendige maschinenlesbare Route-Liste aus server.js erzeugen.

Danach folgt RSOS-131B Route Classification.


## Beobachtete Routen

```text
```
