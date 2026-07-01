---
document_id: RSOS-ARCH-007
title: Runtime API Inventory
status: PROPOSED
classification: Architecture / Runtime Inventory
change_scope: Documentation Only
repository_state: Reality Inventory
depends_on: [RSOS-ARCH-006]
---

# Zweck

Dieses Dokument erfasst den realen Ist-Zustand der bestehenden `runtime-api`.

Es beschreibt keine Zielstruktur und führt keine Codeänderungen durch.

Grundsatz:

Reality schlägt Zielbild.

---

# 1. Inventurgrundlage

Quelle dieser Klassifikation ist der Runtime-API Inventory Scan vom 2026-07-01.

---

# 2. Technischer Ist-Zustand

| Bereich | Befund |
|---|---|
| Package | `rsos-runtime-api` |
| Version | `0.1.0` |
| Main | `server.js` |
| Dependencies | `jsonwebtoken`, `pg` |
| server.js Größe | ca. 480 KB |
| server.js Zeilen | 17.990 |
| Inline-Routen | 166 |
| SQL-Migrationen | 71 |

---

# 3. Bereits ausgelagerte Bereiche

Aktiv importierte Handler:

- `modules/rsos060/sources-routes`
- `modules/rsos060/evidence-routes`
- `modules/rsos060/witness-observations-routes`
- `modules/rsos060/assumptions-hypotheses-routes`
- `modules/rsos060/verifications-routes`
- `routes/health/health-route`
- `routes/auth/login-route`
- `routes/events/runtime-events-route`
- `routes/events/audit-chain-route`
- `routes/objects/list-objects-route`
- `routes/objects/create-object-route`
- `routes/trace/full-trace-route`

---

# 4. Bewertung

Die Runtime API befindet sich in einer Übergangsphase.

Die Modularisierung hat begonnen, aber `server.js` ist weiterhin der zentrale Orchestrator.

Die hohe Anzahl an Inline-Routen zeigt, dass weitere Modularisierung sinnvoll ist, jedoch nur in kleinen und verifizierbaren Schritten.

---

# 5. Offene Runtime-Artefakte

Aktuell unversioniert oder offen:

- `runtime-api/016_runtime_relations.sql`
- `runtime-api/RSOS-060_IST_ZUSTAND_20260619.md`
- `runtime-api/RSOS-060_MODULARISIERUNG_STATUS_20260619.md`
- `runtime-api/migrations/090_runtime_verification_cycle_result_link.sql`
- `runtime-api/migrations/obsolete/`

Diese Artefakte werden nicht pauschal übernommen.

Sie müssen separat klassifiziert werden.

---

# 6. Engineering-Regel

Vor jeder weiteren Runtime-Änderung muss geprüft werden:

1. Welche bestehende Route oder Funktion ist betroffen?
2. Ist die Funktion bereits ausgelagert?
3. Gibt es eine Migration oder Datenbankabhängigkeit?
4. Gibt es einen Reality-Test?
5. Ist ein Rollback möglich?
6. Bleibt die Änderung funktional unverändert, falls es sich um Refactoring handelt?

---

# 7. Empfehlung

Keine funktionalen Änderungen im Rahmen dieser Inventur.

Nächster sinnvoller Schritt ist eine Route-Family-Klassifikation der 166 Inline-Routen.

Ziel:

- Route-Familien erfassen
- Verantwortungsbereiche erkennen
- Refactoring-Kandidaten priorisieren
- keine Runtime-Verhaltensänderung durchführen
