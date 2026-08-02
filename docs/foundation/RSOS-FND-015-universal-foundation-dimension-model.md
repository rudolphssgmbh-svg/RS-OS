# RSOS-FND-015 – Universal Foundation Dimension Model

## Dokumentstatus

| Feld | Wert |
|---|---|
| Dokument-ID | RSOS-FND-015 |
| Status | FOUNDATION_DRAFT |
| Geltungsbereich | Jede RSOS-Einheit |
| Runtime-Wirkung | Keine |
| Aktivierungswirkung | Keine |

## 1. Zweck

RSOS-FND-015 definiert den verpflichtenden, minimal vollständigen
Dimensionsraum jeder RSOS-Einheit.

Die fünfzehn Foundation-Dimensionen sind keine bloßen Datenfelder. Sie
bilden die verbindlichen Betrachtungsachsen, über die Identität, Existenz,
Verantwortung, Entwicklung und Wirkung einer Einheit nachvollziehbar
beschrieben werden.

## 2. Foundation-Dimensionen

| ID | Dimension | Leitfrage |
|---|---|---|
| FND-D01 | Identität | Wer oder was ist die Einheit? |
| FND-D02 | Ursprung | Warum und wodurch entstand sie? |
| FND-D03 | Sinn und Zweck | Wozu existiert sie? |
| FND-D04 | Zeit | Wann existiert oder wirkt sie? |
| FND-D05 | Raum und Lokalität | Wo befindet sie sich? |
| FND-D06 | Herkunft und Provenienz | Woher stammen Zustand und Inhalt? |
| FND-D07 | Beziehungen | Mit wem oder womit ist sie verbunden? |
| FND-D08 | Zustand | In welchem gültigen Zustand befindet sie sich? |
| FND-D09 | Realität und Evidenz | Was ist nachweislich belegt? |
| FND-D10 | Wissen | Was ist bekannt? |
| FND-D11 | Kompetenz | Was kann die Einheit nachweislich? |
| FND-D12 | Verantwortung | Wer trägt die Folgen? |
| FND-D13 | Autorität | Was darf die Einheit tun oder entscheiden? |
| FND-D14 | Lebenszyklus | Wie entsteht, reift, altert und endet sie? |
| FND-D15 | Wert und Wirkung | Welchen Beitrag oder Effekt erzeugt sie? |

## 3. Foundation-Regeln

1. Jede RSOS-Einheit muss in allen fünfzehn Dimensionen verortbar sein.
2. Nicht bekannte Werte werden als UNKNOWN geführt und nicht erfunden.
3. Verantwortung und Autorität bleiben getrennte Dimensionen.
4. Wissen und Kompetenz bleiben getrennte Dimensionen.
5. Zustand ist zeit- und lokalitätsgebunden.
6. Evidenz besitzt Provenienz und einen Zeitbezug.
7. Neue Dimensionen erweitern den Kern, verändern ihn aber nicht
   stillschweigend.
8. Domänenspezifische Eigenschaften werden über Dimensionsprofile
   aktiviert.
9. Historische Dimensionsstände bleiben erhalten.
10. Widersprüche zwischen Modell und beobachteter Realität führen zu
    Review oder Fail-Closed, nicht zur stillen Datenkorrektur.

## 4. Anwendungsbereich

Das Modell gilt insbesondere für:

- Menschen;
- Maschinen;
- Produkte;
- Werkzeuge;
- Messgeräte;
- Dokumente;
- Wissen;
- Kompetenzen;
- KI-Cores;
- Cubes;
- Kugeln;
- Schwärme;
- Wabenstöcke;
- Prozesse;
- Organisationen.

## 5. Erweiterbarkeit

RSOS-FND-015 ist der verpflichtende Kern, nicht die Obergrenze.

Zusätzliche Dimensionen werden ausschließlich über das kontrollierte
RSOS-XDIM-Register eingeführt und über ein RSOS-DPROF-Profil einer Einheit
oder Einheitenklasse zugeordnet.
