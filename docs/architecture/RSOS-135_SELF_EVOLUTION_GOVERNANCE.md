# RSOS-135 – Self-Evolution Governance

Status: Draft
Datum: 2026-06-28

## Grundsatz

RSOS darf sich weiterentwickeln, aber nicht unkontrolliert.

Jede wesentliche Weiterentwicklung wird durch Arbeitsgruppen und Ausschuesse aus unterschiedlichen Perspektiven geprueft, bewertet und als Empfehlung vorbereitet.

Die finale Verantwortung und Freigabe bleibt beim Menschen.

KI prueft.
KI bewertet.
KI empfiehlt.
Der Mensch verantwortet.

## Ziel

RSOS nutzt RSOS zur Entwicklung von RSOS.

Eine Aenderung darf nicht nur technisch funktionieren. Sie muss architektonisch stimmig, betrieblich vertretbar, testbar, auditierbar, dokumentiert und verantwortbar sein.

## Prozess

Idee / Problem / Aenderung
  -> Observation
  -> Arbeitsgruppenpruefung
  -> Ausschussbewertung
  -> Gesamtempfehlung
  -> menschliche Freigabe
  -> Umsetzung
  -> Verifikation
  -> TIR
  -> Commit
  -> Learning

## Arbeitsgruppen

### 1. Architecture Working Group

Aufgabe:
- Prueft Struktur, Modularisierung, Verantwortungsgrenzen und Erweiterbarkeit.
- Bewertet, ob eine Aenderung zur bestehenden RSOS-Architektur passt.
- Achtet darauf, dass server.js, Datenbank, Routen, Provider und Composer nicht erneut vermischt werden.

Bewertungsfragen:
- Passt die Aenderung zur Zielarchitektur?
- Wird eine bestehende Grenze verletzt?
- Entsteht neue Kopplung?
- Ist die Erweiterung kontrolliert rueckbaubar?

### 2. Code Working Group

Aufgabe:
- Prueft Codequalitaet, Syntax, Lesbarkeit und Fehlerwahrscheinlichkeit.
- Bewertet, ob der Code klein, nachvollziehbar und wartbar bleibt.

Bewertungsfragen:
- Ist der Code syntaktisch korrekt?
- Ist die Aenderung minimal?
- Gibt es erkennbare Nebenwirkungen?
- Ist der Code eindeutig testbar?

### 3. Test Working Group

Aufgabe:
- Legt fest, welche Tests erforderlich sind.
- Prueft, ob bestehende TIRs ausreichen oder neue TIRs notwendig sind.

Bewertungsfragen:
- Welche Tests muessen laufen?
- Gibt es Regressionen?
- Muss ein neuer TIR entstehen?
- Ist die Aenderung reproduzierbar verifiziert?

### 4. Operations Working Group

Aufgabe:
- Prueft Betrieb, Deployment, Rollback und Stabilitaet.
- Achtet auf Container, Datenbank, Migrationsrisiken und Laufzeitverhalten.

Bewertungsfragen:
- Kann der Betrieb beeintraechtigt werden?
- Gibt es Rollback-Moeglichkeiten?
- Sind Daten oder Laufzeit betroffen?
- Muss vorab ein Backup erstellt werden?

### 5. Knowledge Working Group

Aufgabe:
- Prueft, ob neue Erkenntnisse dokumentiert und in RSOS-Wissen integrierbar sind.
- Achtet auf Begriffe, Prinzipien, Lernpunkte und Wiederverwendbarkeit.

Bewertungsfragen:
- Was wurde gelernt?
- Muss ein Begriff geschaerft werden?
- Muss Architekturwissen aktualisiert werden?
- Entsteht ein wiederverwendbares Muster?

### 6. Unknowns Working Group

Aufgabe:
- Identifiziert offene Fragen, Annahmen und blinde Flecken.
- Verhindert vorschnelle Sicherheit.

Bewertungsfragen:
- Was wissen wir noch nicht?
- Welche Annahmen wurden getroffen?
- Welche Risiken sind noch nicht bewertet?
- Welche Rueckfragen fehlen?

### 7. Practice Working Group

Aufgabe:
- Prueft Nutzen und Realitaetsnaehe.
- Bewertet, ob die Aenderung fuer reale Prozesse in Betrieb, Werkstatt, Verkauf, Governance oder Verwaltung brauchbar ist.

Bewertungsfragen:
- Ist die Aenderung praktisch nutzbar?
- Verbessert sie reale Arbeit?
- Entsteht Aufwand ohne Nutzen?
- Ist sie fuer Menschen nachvollziehbar?

## Ausschuesse

### 1. Governance Committee

Aufgabe:
- Bewertet Verantwortung, Freigabe, Nachvollziehbarkeit und menschliche Kontrolle.

Entscheidungsfragen:
- Darf diese Aenderung umgesetzt werden?
- Braucht sie explizite menschliche Freigabe?
- Ist die Verantwortung klar?
- Ist die Aenderung auditierbar?

### 2. Risk Committee

Aufgabe:
- Bewertet technische, fachliche, betriebliche und organisatorische Risiken.

Entscheidungsfragen:
- Welche Risiken bestehen?
- Sind sie akzeptabel?
- Gibt es Gegenmassnahmen?
- Muss die Aenderung gestoppt oder isoliert getestet werden?

### 3. Quality Committee

Aufgabe:
- Bewertet Qualitaet, Testtiefe, Dokumentationsstand und Verifikationsgrad.

Entscheidungsfragen:
- Ist die Aenderung ausreichend geprueft?
- Ist der Qualitaetsnachweis belastbar?
- Reichen Node-Check, Diff und TIR?
- Fehlt ein spezifischer Test?

### 4. Evolution Committee

Aufgabe:
- Bewertet, ob die Aenderung den Erkenntnisraum erweitert und RSOS langfristig verbessert.

Entscheidungsfragen:
- Welche neue Moeglichkeit entsteht?
- Welche Kompetenz wird verbessert?
- Welche zukuenftige Forschung wird ermoeglicht?
- Passt die Aenderung zu RSOS-003 Principle of Evolution?

## Bewertungsformat

Jede Arbeitsgruppe und jeder Ausschuss liefert eine strukturierte Bewertung:

- Sichtweise:
- Beobachtung:
- Bewertung:
- Nutzen:
- Risiko:
- Unknowns:
- Empfehlung:
- Freigabestatus:

Moegliche Freigabestatus:

- approve
- approve_with_conditions
- needs_more_observation
- needs_test
- needs_human_decision
- reject

## Gesamtempfehlung

Eine Umsetzung gilt nur dann als bereit, wenn:

1. keine blockierenden Risiken offen sind,
2. die Architektur nicht verletzt wird,
3. notwendige Tests definiert sind,
4. Unknowns sichtbar dokumentiert sind,
5. Governance keine Sperre setzt,
6. der Mensch final freigibt.

## Menschliche Verantwortung

RSOS kann pruefen, bewerten und empfehlen.

RSOS darf keine finale Verantwortung uebernehmen.

Die menschliche Freigabe bleibt Pflicht bei:

- Architekturentscheidungen,
- produktiven Datenveraenderungen,
- Governance-Aenderungen,
- Sicherheits- oder Zugriffsentscheidungen,
- irreversiblem Verhalten,
- rechtlich oder wirtschaftlich relevanten Entscheidungen.

## Entwicklungsprinzip

Observation
  -> Classification
  -> Working Group Review
  -> Committee Review
  -> Recommendation
  -> Human Approval
  -> Transformation
  -> Verification
  -> TIR
  -> Commit
  -> Learning

## Zielbild

RSOS entwickelt sich nicht durch spontane Aenderungen, sondern durch kontrollierte, mehrperspektivisch bewertete und auditierbare Evolution.
