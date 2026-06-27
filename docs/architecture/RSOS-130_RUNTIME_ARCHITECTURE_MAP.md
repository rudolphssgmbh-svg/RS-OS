# RSOS-130 Runtime Architecture Map

Status: Draft
Datum: 2026-06-27

## I. Prinzip des Mappings

Dieses Dokument trennt die technische Natur eines Artefakts von seiner systemischen Rolle innerhalb des RSOS-Erkenntniszyklus.

Refactorings werden erst ausgefuehrt, wenn bestehende Artefakte einer nachvollziehbaren Verantwortung zugewiesen wurden.

## II. Systemische Matrix des aktuellen Worktrees

| Datei / Komponente | Technische Natur | Systemische RSOS-Rolle |
| --- | --- | --- |
| runtime-api/server.js | Express Monolith | Ingress und Pipeline-Orchestration |
| runtime-api/migrations/ | PostgreSQL DDL | Evidence und Schema-Definition |
| registry-server/server.js | Node/Express App | Knowledge und zentraler Wissenstransfer |
| node-agent/ | Hintergrunddienst | Observation und Interaction an der Peripherie |
| dashboard/ | Text- und Statusartefakte | Tension- und Evidence-Visualisierung |
| frontend/index.html | Web UI | Human Governance Interface |
| knowledge/current/ | JSON- und Snapshot-Artefakte | Knowledge Snapshot und Foundation Witness |
| docker/ und docker-compose | Infrastruktur-Konfiguration | Infrastructure und Deployment |

## III. Ziel-Topologie fuer das Runtime-Refactoring

Die Aufteilung des Monolithen erfolgt entlang systemischer Verantwortungsbereiche.

Innerhalb der Ordner duerfen Standard-Entwurfsmuster eingesetzt werden.

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

## IV. Execution Gate

Keine technische Refactoring-Massnahme darf ohne vorherige Zuordnung zu einer systemischen Rolle erfolgen.

Nach jedem Refactoring muss run_all_tir.sh weiterhin erfolgreich laufen.

