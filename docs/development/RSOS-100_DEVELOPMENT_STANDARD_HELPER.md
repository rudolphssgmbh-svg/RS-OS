# RSOS-100 Development Standard Helper

## 1. Zweck

RSOS-100 definiert den verbindlichen Entwicklungsstandard für RS OS.

Der Development Standard Helper stellt sicher, dass neue Module, Änderungen und Erweiterungen nicht unkontrolliert in das Produktivsystem gelangen, sondern nach einem einheitlichen, prüfbaren und auditierbaren Verfahren bewertet werden.

## 2. Grundsatz

Jede Weiterentwicklung wird durch JARVIS koordiniert und durch vier unabhängige Core-Perspektiven bewertet.

JARVIS entscheidet nicht allein.

Die finale Freigabe bleibt beim Entwicklungsteam.

## 3. Core-Council-Modell

### Core A – Architektur und Systemlogik

Prüft:
- Architektur
- Systemgrenzen
- Modulzuschnitt
- Abhängigkeiten
- Konsistenz der Lösung

### Core B – Betrieb, Stabilität und Rollback

Prüft:
- Laufender Betrieb
- Stabilität
- Snapshot
- Recovery
- Rollback-Pfad
- Auswirkungen auf andere Kerne

### Core C – Wissen, Qualität und Unknowns

Prüft:
- Dokumentation
- Fakten
- Annahmen
- Hypothesen
- Unknowns
- Mut zur Lücke

Grundsatz:

Eine dokumentierte Lücke ist zulässig.
Eine nicht dokumentierte Lücke ist ein Qualitätsfehler.

### Core D – Governance und Verantwortung

Prüft:
- Verantwortlichkeit
- Freigabeberechtigung
- Auditierbarkeit
- Risikobegründung
- menschliche Entscheidung

## 4. JARVIS-Auftrag

JARVIS koordiniert die Prüfung, sammelt die Core-Bewertungen und erstellt eine Gesamtauswertung.

JARVIS darf:
- prüfen
- bewerten
- Risiken benennen
- Empfehlungen aussprechen
- Blocker melden

JARVIS darf nicht:
- allein produktiv freigeben
- menschliche Verantwortung ersetzen
- unbekannte Risiken als geklärt ausgeben

## 5. Bewertungsstruktur

Jede Prüfung endet verbindlich mit:

1. Feststellungen
2. Bewertung
3. Empfehlungen
4. Fazit
5. Lessons Learned

## 6. Development-Quarantäne

Änderungen an produktiven Ebenen werden zuerst in eine kontrollierte Entwicklungs-Quarantäne überführt.

Pflichtbestandteile:

- Bereich isolieren
- Snapshot erstellen
- Änderung prüfen
- Abweichungen bewerten
- Rollback-Pfad bestätigen
- Core-Bewertung durchführen
- JARVIS-Fazit erstellen
- menschliche Freigabe einholen

## 7. Freigaberegel

Keine Produktivänderung ohne:

- Snapshot
- Prüfung
- dokumentierte Unknowns
- Rollback-Pfad
- JARVIS-Empfehlung
- Core-Council-Bewertung
- menschliche Freigabe

## 8. Abnahmekriterium

RSOS-100 gilt als eingeführt, wenn dieser Standard im Repository dokumentiert, versioniert und bei der nächsten Moduländerung angewendet wurde.
