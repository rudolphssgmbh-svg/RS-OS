---
document_id:       RSOS-REALITY-STATE
title:             RSOS Reality State
status:            ACTIVE
category:          Engineering / Reality Verification
last_modified:     2026-07-01
source_of_truth:   Runtime Server / Repository / Database
purpose:           Verifizierter Ist-Zustand des real existierenden RSOS-Systems
---

# 1. Grundsatz

Dieses Dokument beschreibt nicht, was RSOS theoretisch sein soll.

Dieses Dokument beschreibt, was im Repository, im Server und in der Laufzeit real nachweisbar ist.

Regel:

Code schlägt Theorie.
Test schlägt Behauptung.
Reality State schlägt veraltete Dokumentation.

---

# 2. Aktueller Ist-Zustand

| Bereich | Status | Nachweis |
|---|---|---|
| Repository-Konsolidierung | REAL / ABGESCHLOSSEN | Commit a7b28b3 |
| Runtime API | REAL / LÄUFT | `/health` liefert 200 OK |
| Datenbankverbindung | REAL / LÄUFT | `/health` meldet `database: connected` |
| Auth Route | REAL / TESTBAR | `/auth/login` erreichbar |
| JWT-Schutz | REAL / GETESTET | `/runtime/*` ohne Token liefert 401 |
| Server-Split | REAL / TEILWEISE | `routes/` und `modules/` werden importiert |
| Monolith-Routen | REAL / VORHANDEN | 166 Inline-Routen in `runtime-api/server.js` |
| DB-Migrationen | REAL / VORHANDEN | Migrationen 001 bis 091 vorhanden |

---

# 3. Serverstruktur

Aktiv importierte ausgelagerte Bereiche:

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

# 4. Route-Familien

| Route-Familie | Anzahl | Status |
|---|---:|---|
| `/runtime/defense` | 17 | REAL / MONOLITH |
| `/runtime/learning` | 6 | REAL / MONOLITH |
| `/runtime/facts` | 5 | REAL / MONOLITH |
| `/runtime/competence` | 4 | REAL / MONOLITH |
| `/runtime/dashboard` | 3 | REAL / MONOLITH |
| `/runtime/admin` | 3 | REAL / MONOLITH |
| `/runtime/objects` | 2 | REAL / TEILWEISE AUSGELAGERT |
| `/runtime/events` | 1 | REAL / AUSGELAGERT |
| `/health` | 1 | REAL / AUSGELAGERT / GETESTET |
| `/auth/login` | 1 | REAL / AUSGELAGERT / GETESTET |
| `/audit/chain` | 1 | REAL / AUSGELAGERT |
| `/governance/evaluate` | 1 | REAL / MONOLITH |

---

# 5. Bisherige Basistests

| Test | Ergebnis |
|---|---|
| `GET /health` | PASS |
| `POST /auth/login` ohne Credentials | PASS, 400 `missing_credentials` |
| `GET /runtime/objects` ohne Token | PASS, 401 `JWT token required` |
| `GET /runtime/metrics` ohne Token | PASS, 401 `JWT token required` |

---

# 6. Offene Ist-Prüfungen

Noch nicht final geprüft:

- gültiger Login mit echtem Operator
- Runtime-Objekt mit Token lesen
- Runtime-Objekt mit Token anlegen
- Events lesen
- Trace lesen
- Governance prüfen
- Metrics mit Token lesen
- Datenbanktabellen vollständig erfassen
- Docker/Container mit `sudo` prüfen
- Frontend-Anbindung prüfen

---

# 7. Arbeitsregel ab jetzt

Vor jeder neuen Entwicklung muss geprüft werden:

1. Existiert die Funktion bereits im Server?
2. Ist sie erreichbar?
3. Ist sie testbar?
4. Ist sie dokumentiert?
5. Ist die Dokumentation aktuell?

Erst wenn diese Fragen beantwortet sind, darf entschieden werden, ob neue Implementierung notwendig ist.
