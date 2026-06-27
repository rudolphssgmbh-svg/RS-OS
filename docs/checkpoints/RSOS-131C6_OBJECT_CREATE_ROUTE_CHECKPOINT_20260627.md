# RSOS-131C6 Object Create Route Checkpoint

Status: Verifiziert
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Zweck

Dieses Dokument friert die erfolgreiche Extraktion der Runtime Object Create Route ein.

## Extrahierte Route

POST /runtime/objects

## Neues Modul

runtime-api/routes/objects/create-object-route.js

## Bestehendes Objekt-Modul

runtime-api/routes/objects/list-objects-route.js

## Verdrahtung

server.js ruft fuer POST /runtime/objects:

handleCreateRuntimeObjectRoute({
  req,
  res,
  db,
  send,
  readBody,
  requireRole,
  writeEvent
})

## Architekturentscheidung

writeEvent bleibt vorerst im Monolithen und wird als Dependency uebergeben.

Begruendung:

writeEvent wird an vielen Stellen im Runtime-Core genutzt. Eine globale Extraktion von writeEvent wird als eigener spaeterer Evidence-Service-Schnitt behandelt.

## Verifikation

Ausgefuehrt:

- node -c runtime-api/server.js
- node -c runtime-api/routes/objects/create-object-route.js
- node -c runtime-api/routes/objects/list-objects-route.js
- bash tests/tir/run_all_tir.sh

Ergebnis:

PASS

## Ergebnis

Die Object-Domaene enthaelt jetzt:

runtime-api/routes/objects/
├── create-object-route.js
└── list-objects-route.js

Die Runtime blieb nach der Extraktion funktional unveraendert.

## Folgeabschnitt

Empfohlen:

RSOS-131C7 GET /runtime/object/:id oder vorbereitend eine Object-Domain-Inventory.

