# RSOS-200 Isomorphic Runtime Standard

Status: Draft
Datum: 2026-06-27

## I. Prinzip der Isomorphie

Die Modulgrenzen der Runtime orientieren sich an den RSOS-Evolutionsprinzipien und nicht an technischen Framework-Grenzen.

Runtime, Dokumentation und TIR-Test-Suite muessen dieselbe Struktur und dasselbe Vokabular verwenden.

## II. Pipeline-Architektur

Jeder Ingress-Impuls durchlaeuft die Runtime entlang des evolutionaeren Erkenntniszyklus:

Ingress
-> Observation
-> Selection
-> Interaction
-> Evidence
-> Verification
-> Adaptation
-> Knowledge
-> Governance
-> Response

Technische Frameworks wie Express.js duerfen die Randzonen bedienen.

Der Kern der Runtime wird in der Sprache der RSOS-Foundation strukturiert.

## III. Zielstruktur runtime-api

runtime-api/
-> bootstrap/
-> ingress/
-> observation/
-> selection/
-> interaction/
-> evidence/
-> verification/
-> adaptation/
-> knowledge/
-> governance/
-> infrastructure/
-> response/

## IV. Kopplung an TIR

- evidence/ wird durch RSOS-TIR-0111A Zero Deletion abgesichert.
- selection/ wird durch RSOS-TIR-0121A Tension & Selection abgesichert.
- adaptation/ wird durch RSOS-TIR-0108 und RSOS-TIR-0111B abgesichert.
- knowledge/ wird durch RSOS-TIR-0110A und RSOS-TIR-0111B abgesichert.

## V. Konsequenz

server.js wird nicht willkuerlich technisch zerlegt.

Die kuenftige Modularisierung bildet die RSOS-Foundation physisch in der Runtime ab.

