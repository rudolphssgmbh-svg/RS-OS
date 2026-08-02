# RSOS-EVO-001 – Evolutionäre Core-Ordnung

## Dokumentstatus

| Feld | Wert |
|---|---|
| Dokument-ID | RSOS-EVO-001 |
| Status | MODEL_DRAFT |
| Sprint | RSOS-SPRINT-SEED-001 |
| Freigabe | Janette Rudolph und Lothar Mederer |
| Runtime-Wirkung | Keine |
| Produktivwirkung | Keine |
| Review | AWA, VEIT, ARP, RAR, HORUS und Concierge erforderlich |

## 1. Zweck

Dieses Dokument beschreibt das evolutionäre Grundmodell der
RSOS-Arbeitskerne.

Ein Core ist eine begrenzte, identifizierbare, rollenneutrale und
auditierbare Kompetenz- und Arbeitseinheit. Er kann entstehen, lernen,
reifen, sich spezialisieren, teilen, fusionieren, regenerieren oder
geordnet aufgelöst werden.

Alle beschriebenen Evolutionsmechanismen sind zunächst Modellhypothesen.
Sie besitzen keine unmittelbare Runtime- oder Produktivwirkung.

## 2. Core-Grundmodell

Jeder Core besitzt mindestens:

- eindeutige Core-ID,
- eindeutige Core-Adresse,
- Generation,
- Parent- und Herkunftsreferenzen,
- Foundation-Version,
- Kompetenzprofil,
- Verhaltensprofil,
- genealogische Historie,
- Mandat,
- Verantwortung,
- Auditspur,
- Lebenszyklus,
- Resonanzstatus,
- Ressourcenbudget,
- definierte Schnittstellen.

Formal:

```text
Core_i =
(
  Identity,
  Address,
  Generation,
  Foundation,
  Competence,
  Behavior,
  Memory,
  Mandate,
  Responsibility,
  Resonance,
  Resources,
  Lifecycle
)
```

## 3. Core-Genom

Der Core-Genom-Satz besteht modellhaft aus vier getrennten Schichten:

```text
Genome_Core = (F, K, B, M)
```

mit:

- F = Foundation-DNA,
- K = Kompetenz-DNA,
- B = Behavior-DNA,
- M = Memory-DNA.

### 3.1 Foundation-DNA

Die Foundation-DNA enthält:

- Grundordnung,
- freigegebene Naturgesetze,
- Governance-Grenzen,
- Rollenmodell,
- Auditpflicht,
- Fail-Closed-Regeln,
- Schnittstellenverträge,
- geltende Foundation-Version.

Sie wird nicht aus Eltern-Cores rekombiniert.

```text
F_child = F_system
```

Bei inkompatiblen Foundation-Versionen ist eine Fusion blockiert, bis
ein gesonderter Migrations- und Reviewpfad freigegeben wurde.

### 3.2 Kompetenz-DNA

Die Kompetenz-DNA enthält ausschließlich beschreibbare Fähigkeiten mit:

- Kompetenz-ID,
- Domäne,
- Kontext,
- Gültigkeitsbereich,
- Evidenzgrad,
- Reifegrad,
- Vertrauensgrad,
- Resonanzbeitrag,
- letzter Validierung,
- Review- oder Verfallszeit,
- Abhängigkeiten,
- Provenienz,
- Übertragbarkeitsgrad.

Eine Kompetenz darf bei Fusion oder Klonierung nicht allein aufgrund
ihrer Existenz als produktiv gültig übernommen werden.

### 3.3 Behavior-DNA

Die Behavior-DNA beschreibt beobachtbares Arbeits- und
Entscheidungsverhalten:

- Lernstrategie,
- Risikoverhalten,
- Kooperationsverhalten,
- Qualitätsorientierung,
- Innovationsneigung,
- Stabilitätsorientierung,
- Regenerationsfähigkeit,
- Kommunikationsverhalten,
- Reaktion auf Unsicherheit,
- Eskalationsverhalten.

Behavior-DNA wird bei Fusion nicht blind gemittelt. Kandidatenprofile
müssen simuliert, begründet ausgewählt und praktisch validiert werden.

### 3.4 Memory-DNA

Die Memory-DNA bewahrt:

- historische Entscheidungen,
- erfolgreiche und gescheiterte Experimente,
- Fehler,
- Gegenbeispiele,
- widerlegte Hypothesen,
- bewährte Muster,
- Kontextänderungen,
- Evolutionspfade,
- Präzedenzfälle.

Memory-DNA wird nicht vermischt oder überschrieben.

```text
M_child = Provenance_Link(M_A, M_B)
```

Der neue Core darf auf dieses Erbe zugreifen. Historische Erfahrung
wird jedoch erst durch erneute Validierung im eigenen Kontext zu
eigener Kompetenz.

## 4. Komplementäre Core-Polarität

Jeder Core erhält eine strukturelle Polarität aus seiner Adresse:

```text
gerade Adresse   = Typ A
ungerade Adresse = Typ B
```

Die Polarität:

- besitzt keine biologische Bedeutung,
- besitzt keine soziale Bedeutung,
- erzeugt keine Hierarchie,
- bestimmt keine Rolle,
- bestimmt keine Kompetenz,
- bestimmt keine Würde oder Verantwortungsfähigkeit.

Sie dient ausschließlich als neutraler Adressierungs-,
Diversitäts- und Rekombinationsmechanismus.

Die Polaritätsbalance lautet:

```text
Delta_P = Betrag(N_A - N_B)
```

`Delta_P` ist ein ökologischer Beobachtungswert, aber kein alleiniger
Entscheidungsgrund für Core-Erzeugung, Fusion oder Apoptose.

## 5. Rollenneutralität

Rolle, Mandat, Träger und Core sind getrennte Objekte.

Eine Rolle wird definiert durch:

- Funktion,
- Kompetenzanforderungen,
- Rechte,
- Pflichten,
- Grenzen,
- Schnittstellen,
- Verantwortungsumfang,
- Mandatsdauer,
- Auditpflicht.

Träger können sein:

- Menschen,
- KI-Systeme,
- einzelne Cores,
- Councils,
- Mensch-KI-Tandems,
- andere zulässige Kollektive.

Der Wechsel des Trägers verändert die Rolle nicht.

```text
Role unabhängig von Carrier
Role unabhängig von Core-Polarität
```

## 6. Core-Entstehung

Ein neuer Core kann nur über einen dokumentierten Genesis-Pfad entstehen:

1. Kompetenz- oder Funktionslücke erkennen.
2. Muse eröffnet Möglichkeiten.
3. AWA formuliert eine prüfbare Core-Hypothese.
4. Professor prüft Konsistenz und Erkenntnisgrundlage.
5. VEIT prüft technische und organisatorische Tragfähigkeit.
6. ARP prüft Provenienz, Auditierbarkeit und Reproduzierbarkeit.
7. RAR prüft Mandat, Zuständigkeit und Verantwortung.
8. HORUS prüft Sicherheit und Fail-Closed-Grenzen.
9. Concierge prüft semantische Verständlichkeit.
10. Das zuständige DecisionTeam entscheidet mit Zweidrittel-Quorum.
11. Genesis erstellt eine begrenzte Core-Spezifikation.
12. Vater Zeit eröffnet eine kontrollierte Reifephase.

AWA darf keinen Core allein erzeugen.

## 7. Klonierung

Ein Klon übernimmt:

- Foundation-DNA,
- Governance,
- Rollen- und Schnittstellenstruktur,
- genealogischen Fingerabdruck,
- Parent-Core-ID,
- Foundation-Version,
- Core-DNA-Hash.

Der operative Ausgangszustand lautet:

```text
Knowledge_State = 0
Experience_State = 0
Inherited_Competence_Status = LATENT
Runtime_Authority = NONE
```

Latente Kompetenzen müssen im neuen Kontext erneut nachgewiesen werden.
## 8. Fusion und Rekombination

Eine Fusion setzt mindestens voraus:

- kompatible Foundation-Versionen,
- gültige Mandate,
- geeignete Kompetenz- und Funktionsbeziehung,
- positive Resonanzprognose,
- gesicherte Provenienz,
- ausreichende Systemkapazität,
- Rollback- oder Abbruchpfad,
- Zweidrittel-Freigabe,
- kein Hard Veto.

Die Foundation-DNA bleibt invariant:

```text
F_child = F_system
```

Die Kompetenz-DNA wird nicht pauschal addiert. Für jedes Kompetenz-Gen
werden mindestens geprüft:

- Evidenz,
- Reife,
- Kontextgültigkeit,
- Vertrauensgrad,
- Aktualität,
- Übertragbarkeit,
- Abhängigkeiten,
- mögliche Konflikte.

Die Behavior-DNA wird als Kandidatenraum simuliert.

Die Memory-DNA wird mit vollständiger Herkunft verkettet.

Die Fusion erzeugt eine neue Core-Identität. Eltern-Cores werden nicht
still überschrieben oder gelöscht.

## 9. Teilung

Ein Core darf geteilt werden, wenn:

- seine funktionale Breite nicht mehr beherrschbar ist,
- seine relationale Masse zu hoch wird,
- Verantwortungsgrenzen unklar werden,
- getrennte Kompetenznischen höhere Resonanz erwarten lassen,
- Audit- oder Sicherheitsgrenzen eine Trennung verlangen.

Die Teilung benötigt:

- Zielarchitektur,
- Ressourcenplan,
- Kompetenzzuordnung,
- Mandatszuordnung,
- Provenienzplan,
- Übergangs- und Rollbackregeln.

## 10. Umweltkapazität

Die Tragfähigkeit des Systems wird modellhaft durch `K_system`
beschrieben.

Sie hängt mindestens ab von:

- Rechenleistung,
- Arbeitsspeicher,
- Speicherplatz,
- Netzwerk und Bandbreite,
- Budget,
- Aufmerksamkeit,
- menschlicher Prüfkapazität,
- Auditkapazität,
- physischen Betriebsmitteln,
- Regenerationsfähigkeit.

Genesis darf keinen neuen Core erzeugen, wenn Versorgung,
Überwachung, Auditierung, Sicherung oder geordnete Abschaltung nicht
gewährleistet sind.

## 11. Funktionale Nische

Jeder produktive Core benötigt eine unterscheidbare Funktion oder
Kompetenznische.

Bei kritischer Überlappung sind zu prüfen:

- Fusion,
- Spezialisierung,
- Domänentrennung,
- bewusste Redundanz,
- Transformation,
- geordnete Stilllegung.

Redundanz bleibt zulässig, wenn sie als Sicherheits-, Kapazitäts- oder
Resilienzreserve ausdrücklich begründet ist.

## 12. Metabolismus

Beim Ende eines Cores entstehen getrennte Stoffströme:

- Foundation bleibt systemweit erhalten.
- Kompetenzen werden auf Vererbbarkeit geprüft.
- Historie und Evidenz gehen an Bibliokar.
- Mandate werden geschlossen oder übertragen.
- Ressourcen gehen an den freigegebenen Systempool zurück.
- sensible Daten bleiben geschützt.
- nicht wiederverwendbare Fragmente werden kontrolliert verworfen.

Der Katalysator darf zerlegen, klassifizieren, recyceln und freigeben.
Er besitzt keine eigene Governance- oder Freigabeautorität.

## 13. Apoptose

Apoptose bezeichnet die kontrollierte Auflösung eines Cores.

Sie darf nur geprüft werden, wenn:

- die Resonanz dauerhaft kritisch bleibt,
- Vater Zeit die erforderliche Beobachtungsdauer bestätigt,
- Regeneration erfolglos blieb,
- kein tragfähiger Transformationsweg besteht,
- kein Entwicklungspotenzial mehr nachweisbar ist,
- keine sinnvolle Fusion möglich ist,
- Verantwortung und Ressourcenübergang geklärt sind,
- die Historie vollständig gesichert wurde.

Jarvis allein darf keine Apoptose entscheiden.

Der Abschlusszustand muss mindestens festhalten:

```text
CORE_CLOSED=YES
MEMORY_PRESERVED=YES
PROVENANCE_COMPLETE=YES
MANDATES_RESOLVED=YES
RESOURCES_RELEASED=YES
RUNTIME_REFERENCES_CLOSED=YES
```

## 14. Multicore-Governance

RSOS beginnt mit vier Arbeitskernen und kann in weiteren Core-Gruppen
skalieren.

Neue Cores erweitern:

- Kompetenz,
- Perspektive,
- Verantwortung,
- Prüfbedarf,
- Legitimation.

Das Zweidrittel-Quorum berechnet sich aus den vorab bestimmten,
zuständigen und stimmberechtigten Cores oder Rollen:

```text
Q = Aufrunden(2 * N_active / 3)
```

Ein Core darf seinen eigenen Vorschlag nicht allein legitimieren.

## 15. Ablehnung und Neuprüfung

Eine Ablehnung durch Jarvis oder eine andere Prüfinstanz muss enthalten:

- Ablehnungs-ID,
- betroffene Intention,
- konkrete Gründe,
- Evidenzreferenzen,
- Risiken,
- Unsicherheiten,
- Bedingungen für eine Neuprüfung,
- empfohlene Korrekturen,
- erforderliche Rollen.

Nicht fundamentale Ablehnungen dürfen überarbeitet und als neue
Revision erneut geprüft werden.

Hard Vetos bleiben gesondert blockierend.

## 16. Status dieser Ordnung

Core-DNA, Core-Polarität, Rekombination, Nischenbildung, Metabolismus
und Apoptose sind formale Organisationsmodelle.

Sie sind noch keine produktiv validierten Runtime-Mechanismen.

Dieses Dokument:

- verändert keinen Sourcecode,
- verändert keine Datenbank,
- erzeugt keinen Core,
- fusioniert keinen Core,
- aktiviert keine Runtime,
- erteilt keine Produktivfreigabe.

## 17. SEED-002 Review-Remediation

### 17.1 ARP – vollständige Provenienz

Jede Entstehung, Klonierung, Fusion, Teilung, Transformation oder
Apoptose eines Cores benötigt eine vollständige Provenienz sämtlicher
übernommener Foundation-, Kompetenz-, Behavior- und Memory-Anteile.
