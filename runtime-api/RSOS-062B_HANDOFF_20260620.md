# RSOS-062B Confidence-Aware Recommendations – Handoff 2026-06-20

## Ausgangspunkt
RSOS-062B setzt auf RSOS-062A auf.

Ausgangscommit:
1c22d8b

## Ziel
Recommendations sollen nicht nur Typ, Priorität, Reason und Evidence enthalten, sondern zusätzlich eine nachvollziehbare Confidence-Bewertung.

## Umsetzung
Der zentrale Generator generateRecommendationsForObject() wurde erweitert um:

- confidence_score
- confidence_level
- confidence_factors
- base_priority
- effective_priority
- effective_priority_score

## Bewertungslogik
Default Confidence:
70

Confidence-Faktoren:
- definition_confidence_score
- default_confidence_score
- high_risk_score
- open_high_priority_actions
- governance_review_without_approval
- competency_gap_detected

Priority Mapping:
- critical = 100
- high = 80
- normal = 60
- low = 40

Effective Priority Score:
70 Prozent Basis-Priority
30 Prozent Confidence Score

## Verifikation

Testobjekt:
rsos062b-test-risk-object

Testregel:
rule-risk-review-admin

Ergebnis:
- generated_count = 1
- recommendation_type = RECHECK_GOVERNANCE
- priority = high
- base_priority = high
- confidence_score = 80
- confidence_level = medium
- confidence_factors = default_confidence_score, high_risk_score
- effective_priority = high
- effective_priority_score = 80

Duplicate-Test:
- generated_count = 0
- skipped_duplicate_count = 1

Bereinigung:
- Test-Recommendation gelöscht
- Testobjekt gelöscht

## Ergebnis
RSOS-062B ist funktional verifiziert.
Confidence-aware Recommendations sind aktiv, ohne Datenbankmigration.
Bestehende Duplicate Protection bleibt intakt.

## Nächster sinnvoller Schritt
RSOS-062C:
Confidence aus realer Evidence-/Verification-/Source-Quality-Historie ableiten, statt nur regel- und kontextbasiert zu berechnen.
