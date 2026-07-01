---
document_id: RSOS-ARCH-006
title: RSOS Repository Inventory & Classification Mapping
status: PROPOSED
classification: Architecture / Repository Inventory
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ARCH-005, RSOS-LANGUAGE-001, RSOS-RLUM-001]
---

# Zweck

Dieses Dokument erfasst den realen Ist-Zustand des RSOS-Repositories.

Es beschreibt keine Zielstruktur und führt keine Repository-Änderungen durch.

Grundsatz:

Reality schlägt Zielbild.

---

# 1. Inventurgrundlage

Quelle dieser Klassifikation ist der Reality Inventory Scan vom 2026-07-01.

Der Scan zeigte folgende reale Hauptbereiche:

- backups
- changelog
- configs
- control-plane
- core
- dashboard
- docker
- docs
- event-bus
- exports
- frontend
- gateway
- intelligence
- keys
- knowledge
- logs
- memory
- modules
- node-agent
- operations
- operators
- registry-server
- replay
- runtime
- runtime-api
- storage
- tenant
- tests

---

# 2. Vorläufige Klassifikation

| Pfad | Schicht | Status | Entscheidung |
|---|---|---|---|
| docs | Documentation / Architecture | ACTIVE | weiter klassifizieren |
| docs/architecture | Architecture | ACTIVE | Genesis-derived docs vorhanden |
| docs/engineering | Engineering | ACTIVE | Bestand prüfen |
| docs/foundation | Foundation | ACTIVE | Bestand prüfen |
| docs/archive | Archive | UNCLASSIFIED | prüfen, nicht löschen |
| docs/research | Research | UNCLASSIFIED | prüfen |
| runtime-api | Runtime / Engineering | ACTIVE | Reality-Abgleich erforderlich |
| runtime | Runtime | UNCLASSIFIED | prüfen |
| core | Core | UNCLASSIFIED | prüfen |
| modules | Modules / Legacy | UNCLASSIFIED | prüfen |
| intelligence | Intelligence | UNCLASSIFIED | prüfen |
| event-bus | Communication | UNCLASSIFIED | prüfen |
| gateway | Communication / API | UNCLASSIFIED | prüfen |
| registry-server | Registry | UNCLASSIFIED | prüfen |
| node-agent | Agent | UNCLASSIFIED | prüfen |
| operators | Operator / Auth | ACTIVE | prüfen |
| dashboard | Operations / Monitoring | MODIFIED | Änderungen klassifizieren |
| frontend | Frontend | MODIFIED | Änderungen klassifizieren |
| knowledge | Knowledge / Reality | MODIFIED | Bestand prüfen |
| operations | Operations | UNTRACKED | prüfen |
| docker | Infrastructure | UNTRACKED | prüfen |
| configs | Infrastructure | ACTIVE | prüfen |
| storage | Infrastructure | ACTIVE | prüfen |
| backups | Backup | ACTIVE | nicht verändern |
| logs | Runtime Evidence | ACTIVE | nicht verändern |
| tests | Test | ACTIVE | prüfen |
| tenant | Tenant | UNCLASSIFIED | prüfen |
| memory | Memory | UNCLASSIFIED | prüfen |
| replay | Replay / Recovery | UNCLASSIFIED | prüfen |
| exports | Export | UNCLASSIFIED | prüfen |
| keys | Security | ACTIVE | nicht offenlegen |

---

# 3. Worktree-Befund

Der Worktree ist nicht sprintrein.

Offen sind unter anderem:

- Dashboard-Dateien
- Frontend
- Knowledge-Artefakte
- Docker
- Node-Agent
- Operations
- Runtime-API Zusatzdateien
- Migrationen
- Archive und Research-Bereiche

Diese Änderungen werden nicht pauschal übernommen.

Sie müssen separat klassifiziert werden.

---

# 4. Engineering-Regel

Vor jedem weiteren Commit muss entschieden werden:

1. Gehört die Änderung zur aktuellen Sprint-Zielsetzung?
2. Ist sie Dokumentation, Architektur, Runtime, Reality oder Evolution?
3. Ist sie geprüft?
4. Ist sie rückführbar auf Genesis, Language oder RLUM?
5. Muss sie archiviert, übernommen oder zurückgestellt werden?

---

# 5. Status

ARCH-006 ist ein vorläufiges Reality-Inventar.

Status bleibt PROPOSED, bis alle offenen Repository-Bereiche einzeln klassifiziert wurden.
