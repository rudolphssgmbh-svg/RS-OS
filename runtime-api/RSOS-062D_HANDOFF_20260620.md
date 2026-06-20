# RSOS-062D Recommendation Outcome Learning – Handoff 2026-06-20

## Ausgangspunkt
RSOS-062D setzt auf RSOS-062C auf.

Ausgangscommit:
5564a49

## Ziel
Recommendation Feedback soll Rule Confidence aktualisieren.

Damit wird der Lernkreislauf geschlossen:

Rule
-> Recommendation
-> Outcome Feedback
-> Rule Confidence Update
-> bessere nächste Recommendation

## Umsetzung
Neuer Endpunkt:

POST /runtime/recommendations/feedback/:recommendation_id

Payload:

{
  "outcome": "success" | "failure",
  "feedback_reason": "optional"
}

## Rollen
Zugelassen:

- system_admin
- runtime_admin
- governance
- auditor

## Lernlogik
Der Endpunkt liest die Recommendation und deren evidence.rule_id.

Anschließend aktualisiert er runtime_recommendation_rules:

- success_count
- failure_count
- feedback_count
- confidence_score
- last_feedback_at

Formel:

confidence_score =
success_count / (success_count + failure_count) * 100

## Evidence Update
Die Recommendation Evidence erhält zusätzlich:

latest_feedback

mit:

- outcome
- feedback_reason
- confidence_score_before
- confidence_score_after
- success_count_before
- success_count_after
- failure_count_before
- failure_count_after
- feedback_count_before
- feedback_count_after
- recorded_by
- recorded_at

## Event
Neues Audit/Event:

runtime.recommendation.feedback.recorded

## Verifikation

Test Recommendation:
rec-1781984103639-vlz95y

Test Rule:
rule-risk-review-admin

Feedback:
outcome = success

Ergebnis:

- feedback_recorded = true
- confidence_score_before = 50
- confidence_score_after = 100
- success_count = 1
- failure_count = 0
- feedback_count = 1
- latest_feedback wurde in Recommendation Evidence gespeichert

Cleanup:
Produktivregel rule-risk-review-admin wurde zurückgesetzt auf:

- success_count = 0
- failure_count = 0
- feedback_count = 0
- confidence_score = 50
- last_feedback_at = NULL

Test Recommendation gelöscht.
Testobjekt gelöscht.

## Ergebnis
RSOS-062D.1 ist funktional verifiziert.
Der Recommendation-Lernkreislauf ist technisch geschlossen.

## Nächster sinnvoller Schritt
RSOS-062E:
Feedback gegen Status/Execution/Verification absichern, z.B. nur Feedback für approved/executed Recommendations oder mit Governance-Begründung.
