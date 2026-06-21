# RSOS-060 Knowledge & Evidence Foundation - Modularisierungsplan

Stand: 2026-06-19

Ziel:
server.js nicht weiter aufblaehen. RSOS-060 wird schrittweise in Module ausgelagert.

Reihenfolge:
1. Nur Hilfsfunktionen vorbereiten, keine Logik veraendern.
2. Source Routes aus server.js extrahieren.
3. Evidence Routes extrahieren.
4. Observation / Witness Routes extrahieren.
5. Assumption / Hypothesis Routes extrahieren.
6. Verification / Verification Results Routes extrahieren.
7. Unknown Routes extrahieren.
8. Facts / Fact Validation / Fact Confidence / Governance Check extrahieren.

Regeln:
- Vor jedem Schritt Backup erstellen.
- Nach jedem Schritt: node --check server.js.
- Danach Container-Code aktualisieren und Healthcheck.
- Danach API-Regressionstest.
- Keine neue Fachlogik waehrend Extraktion.
- Audit writeEvent() bleibt Pflicht.
- Tenant-Scoping bleibt Pflicht.
