# RSOS-131A Route Inventory

Status: Draft / Corrected
Datum: 2026-06-27
Branch: feature/RSOS-060-evidence-foundation

## Zweck

Dieses Dokument startet RSOS-131 Runtime Route Modularization.

Es inventarisiert die HTTP-Routen im Monolithen runtime-api/server.js.

Es veraendert keinen Code.

## Korrektur zur ersten Inventory-Annahme

Die erste Annahme, dass server.js Express-Routen ueber app.get/app.post verwendet, war falsch.

Der Check ergab:

- app.get/app.post Route Count: 0

Daraus folgt:

server.js verwendet keinen Express-Router als primaere Route-Struktur, sondern einen manuellen HTTP-Dispatcher.

## Grundsatz

Observation
-> Classification
-> Transformation
-> Verification

Keine Routen-Extraktion ohne vorherige Inventur und Klassifikation.

## Bisheriger Ausgangspunkt

RSOS-130 hat folgende Helper- und Bootstrap-Module extrahiert:

- runtime-api/response/send.js
- runtime-api/evidence/audit-hash.js
- runtime-api/verification/auth.js
- runtime-api/ingress/body.js
- runtime-api/bootstrap/database.js
- runtime-api/bootstrap/init-db.js

server.js enthaelt weiterhin den manuellen HTTP-Dispatcher und die fachlichen Route-Bloecke.

## Inventar-Methode

Da keine Express-app-Routen vorhanden sind, werden Routen ueber Dispatcher-Muster beobachtet:

- http.createServer
- req.url
- req.method
- pathname
- method
- startsWith(...)
- if/else-if Dispatch-Bloecke

## Route-Domaenen fuer die spaetere Klassifikation

- Health / Runtime Status
- Authentication
- Runtime Objects
- Runtime Events / Evidence
- Governance
- Verification
- Knowledge
- Recommendations / Adaptation
- Communications / Interaction
- Orchestration / Interaction
- Defense / Observation
- Dashboards / Response
- Admin / Governance
- Training / Learning

## Ergebnis

RSOS-131A ist keine Express-Route-Inventur.

RSOS-131A ist eine Inventur des manuellen HTTP-Dispatchers.

## Naechster Schritt

RSOS-131A.1 soll die Dispatcher-Struktur maschinenlesbar aus server.js extrahieren.

Danach folgt RSOS-131B Route Classification.


## Beobachtete Dispatcher-Hinweise

```text
718:const server = http.createServer(async (req, res) => {
720:  const path = req.url.split("?")[0];
722:  if (req.method === "OPTIONS") {
737:    if (req.method === "GET" && path === "/health") {
748:    if (req.method === "POST" && path === "/auth/login") {
834:      req.method === "POST" &&
878:      req.method === "POST" &&
924:      req.method === "PATCH" &&
1082:      req.method === "GET" &&
1140:      req.method === "POST" &&
1207:      req.method === "GET" &&
1257:      req.method === "GET" &&
1352:      req.method === "POST" &&
1449:      req.method === "POST" &&
1565:      req.method === "POST" &&
1662:      req.method === "GET" &&
1737:      req.method === "GET" &&
1811:      req.method === "GET" &&
1826:      const url = new URL(req.url, "http://localhost");
1869:      req.method === "GET" &&
1957:      req.method === "GET" &&
2041:      req.method === "GET" &&
2056:      const url = new URL(req.url, "http://localhost");
2125:      req.method === "GET" &&
2273:      req.method === "GET" &&
2397:    if (req.method === "POST" && path === "/runtime/reports") {
2496:    if (req.method === "GET" && path === "/runtime/reports") {
2506:      const urlObj = new URL(req.url, "http://localhost");
2543:    if (req.method === "POST" && path === "/runtime/report-segments") {
2641:    if (req.method === "GET" && path === "/runtime/report-segments") {
2651:      const urlObj = new URL(req.url, "http://localhost");
2699:    if (req.method === "POST" && path === "/runtime/outcomes") {
2752:    if (req.method === "GET" && path === "/runtime/outcomes") {
2756:      const urlObj = new URL(req.url, "http://localhost");
2770:    if (req.method === "POST" && path === "/runtime/measurements") {
2901:    if (req.method === "GET" && path === "/runtime/measurements") {
2905:      const urlObj = new URL(req.url, "http://localhost");
2980:    if (req.method === "POST" && path === "/runtime/verification-cycles") {
3064:    if (req.method === "GET" && path === "/runtime/verification-cycles") {
3068:      const urlObj = new URL(req.url, "http://localhost");
3098:    if (req.method === "POST" && path === "/runtime/facts") {
3249:    if (req.method === "GET" && path === "/runtime/facts") {
3259:      const urlObj = new URL(req.url, "http://localhost");
3297:    if (req.method === "GET" && path.startsWith("/runtime/trace/fact/")) {
3531:    if (req.method === "POST" && path === "/runtime/unknowns") {
3658:    if (req.method === "GET" && path === "/runtime/unknowns") {
3668:      const urlObj = new URL(req.url, "http://localhost");
3736:    if (req.method === "POST" && path === "/runtime/source-quality") {
3819:    if (req.method === "GET" && path === "/runtime/source-quality") {
3829:      const urlObj = new URL(req.url, "http://localhost");
3866:    if (req.method === "POST" && path === "/runtime/source-conflicts") {
3954:    if (req.method === "GET" && path === "/runtime/source-conflicts") {
3964:      const urlObj = new URL(req.url, "http://localhost");
4005:    if (req.method === "POST" && path === "/runtime/fact-acceptance-rules") {
4104:    if (req.method === "GET" && path === "/runtime/fact-acceptance-rules") {
4114:      const urlObj = new URL(req.url, "http://localhost");
4151:    if (req.method === "POST" && path === "/runtime/facts/validate") {
4370:    if (req.method === "POST" && path === "/runtime/facts/calculate-confidence") {
4605:    if (req.method === "GET" && path === "/runtime/fact-confidence") {
4615:      const urlObj = new URL(req.url, "http://localhost");
4649:    if (req.method === "POST" && path === "/runtime/facts/governance-check") {
4784:    if (req.method === "GET" && path === "/runtime/governance-checks") {
4794:      const urlObj = new URL(req.url, "http://localhost");
4830:    if (req.method === "POST" && path === "/runtime/governance-outcomes") {
4922:    if (req.method === "GET" && path === "/runtime/governance-outcomes") {
4932:      const urlObj = new URL(req.url, "http://localhost");
4972:    if (req.method === "POST" && path === "/runtime/lessons-learned/generate") {
5129:    if (req.method === "GET" && path === "/runtime/lessons-learned") {
5139:      const urlObj = new URL(req.url, "http://localhost");
5177:    if (req.method === "POST" && path === "/runtime/heuristics") {
5273:    if (req.method === "GET" && path === "/runtime/heuristics") {
5283:      const urlObj = new URL(req.url, "http://localhost");
5322:    if (req.method === "POST" && path === "/runtime/heuristic-triggers") {
5453:    if (req.method === "GET" && path === "/runtime/heuristic-triggers") {
5463:      const urlObj = new URL(req.url, "http://localhost");
5505:    if (req.method === "POST" && path === "/runtime/heuristic-triggers/materialize") {
5660:    if (req.method === "POST" && path === "/runtime/heuristic-feedback") {
5832:    if (req.method === "GET" && path === "/runtime/heuristic-feedback") {
5842:      const urlObj = new URL(req.url, "http://localhost");
5882:    if (req.method === "POST" && path === "/runtime/patterns") {
5973:    if (req.method === "GET" && path === "/runtime/patterns") {
5983:      const urlObj = new URL(req.url, "http://localhost");
6021:    if (req.method === "POST" && path === "/runtime/pattern-matches") {
6149:    if (req.method === "GET" && path === "/runtime/pattern-matches") {
6159:      const urlObj = new URL(req.url, "http://localhost");
6205:    if (req.method === "POST" && path === "/runtime/pattern-feedback") {
6377:    if (req.method === "GET" && path === "/runtime/pattern-feedback") {
6387:      const urlObj = new URL(req.url, "http://localhost");
6427:    if (req.method === "POST" && path === "/runtime/cross-loop-validations") {
6711:    if (req.method === "GET" && path === "/runtime/cross-loop-validations") {
6721:      const urlObj = new URL(req.url, "http://localhost");
6767:    if (req.method === "POST" && path === "/runtime/governance-policies") {
6864:    if (req.method === "GET" && path === "/runtime/governance-policies") {
6874:      const urlObj = new URL(req.url, "http://localhost");
6911:    if (req.method === "POST" && path === "/runtime/objects") {
6994:if (req.method === "POST" && path === "/runtime/execute") {
7242:    if (req.method === "GET" && path === "/runtime/objects") {
7270:    if (req.method === "GET" && path === "/runtime/events") {
7303:    if (req.method === "GET" && path === "/audit/chain/verify") {
7368:    if (req.method === "POST" && path.startsWith("/runtime/training-plans/complete/")) {
7658:    if (req.method === "POST" && path.startsWith("/runtime/communications/ack/")) {
7748:    if (req.method === "POST" && path === "/runtime/orchestrations") {
7828:    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/approve/")) {
7915:    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/execute/")) {
8057:    if (req.method === "POST" && path.startsWith("/runtime/orchestrations/complete/")) {
8144:    if (req.method === "GET" && path === "/runtime/orchestration-rules") {
8189:    if (req.method === "GET" && path.startsWith("/runtime/orchestrations/") && path.endsWith("/trace")) {
8353:    if (req.method === "GET" && path === "/runtime/orchestrations") {
8406:    if (req.method === "GET" && path.startsWith("/runtime/communication-summary/")) {
8536:    if (req.method === "GET" && path.startsWith("/runtime/communications/")) {
8650:    if (req.method === "POST" && path.startsWith("/runtime/communications/complete/")) {
8800:    if (req.method === "POST" && path === "/runtime/communications/send") {
8882:    if (req.method === "GET" && path.startsWith("/runtime/learning-summary/")) {
8981:    if (req.method === "GET" && path.startsWith("/runtime/learning-evidence/")) {
9049:    if (req.method === "GET" && path.startsWith("/runtime/training-plans/")) {
9122:    if (req.method === "GET" && path === "/runtime/competencies/gaps") {
9166:    if (req.method === "GET" && path.startsWith("/runtime/competencies/")) {
9231:    if (req.method === "GET" && path === "/runtime/recommendation-rules") {
9276:    if (req.method === "POST" && path.startsWith("/runtime/recommendations/generate/")) {
9322:    if (req.method === "POST" && path.startsWith("/runtime/recommendations/feedback/")) {
9538:    if (req.method === "GET" && path.startsWith("/runtime/recommendations/gates/latest/")) {
9585:    if (req.method === "GET" && path.startsWith("/runtime/recommendations/gates/history/")) {
9629:    if (req.method === "POST" && path.startsWith("/runtime/recommendations/verify/")) {
10052:    if (req.method === "POST" && path.startsWith("/runtime/recommendations/execute/")) {
10311:    if (req.method === "POST" && path.startsWith("/runtime/recommendations/approve/")) {
10398:    if (req.method === "GET" && path.startsWith("/runtime/recommendations/trace/")) {
10590:    if (req.method === "GET" && path.startsWith("/runtime/recommendations/")) {
10668:    if (req.method === "GET" && path.startsWith("/runtime/trace/") && path.endsWith("/full")) {
10878:    if (req.method === "GET" && path.startsWith("/runtime/trace/")) {
11015:    if (req.method === "GET" && path.startsWith("/runtime/execution/path/")) {
11088:    if (req.method === "GET" && path.startsWith("/runtime/governance/path/")) {
11185:    if (req.method === "GET" && path.startsWith("/runtime/audit/path/")) {
11236:    if (req.method === "POST" && path === "/runtime/relations") {
11303:    if (req.method === "DELETE" && path.startsWith("/runtime/relations/")) {
11370:    if (req.method === "GET" && path === "/runtime/relations") {
11396:    if (req.method === "GET" && path.startsWith("/runtime/relations/object/")) {
11441:    if (req.method === "GET" && path.startsWith("/runtime/graph/depth/")) {
11462:      const urlObj = new URL(req.url, "http://localhost");
11570:    if (req.method === "GET" && path.startsWith("/runtime/graph/")) {
11665:    if (req.method === "POST" && path === "/runtime/tenants") {
11754:    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/domains")) {
11865:    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {
11962:    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {
12014:    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {
12133:    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {
12192:    if (req.method === "POST" && path === "/runtime/training-plans/generate-from-gaps") {
12288:    if (req.method === "GET" && path === "/runtime/learning/dashboard") {
12355:    if (req.method === "POST" && path === "/runtime/recommendations/generate-from-gaps") {
12483:    if (req.method === "POST" && path === "/runtime/knowledge") {
12596:    if (req.method === "GET" && path === "/runtime/knowledge") {
12609:      const urlObj = new URL(req.url, "http://localhost");
12663:    if (req.method === "GET" && path.startsWith("/runtime/knowledge/")) {
12736:    if (req.method === "GET" && path === "/runtime/admin/dashboard") {
12849:    if (req.method === "POST" && path === "/runtime/admin/tenants") {
12977:    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/members")) {
13095:    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/credentials")) {
13226:    if (req.method === "GET" && path === "/runtime/admin/tenants") {
13308:    if (req.method === "GET" && path === "/runtime/dashboard/tenants") {
13412:    if (req.method === "GET" && path.startsWith("/runtime/dashboard/tenants/")) {
13630:    if (req.method === "GET" && path === "/runtime/tenants") {
13685:    if (req.method === "GET" && path.startsWith("/runtime/admin/tenants/")) {
13846:    if (req.method === "GET" && path.startsWith("/runtime/tenants/")) {
13945:    if (req.method === "GET" && path === "/runtime/dashboard/management") {
13978:    if (req.method === "GET" && path === "/runtime/dashboard") {
14028:    if (req.method === "GET" && path === "/governance/evaluate") {
14078:    if (req.method === "POST" && path === "/runtime/schedule") {
14384:    if (req.method === "POST" && path === "/runtime/worker/run") {
14943:    if (req.method === "GET" && path === "/runtime/metrics") {
15004:    if (req.method === "GET" && path === "/runtime/dead-letter") {
15041:    if (req.method === "POST" && path === "/runtime/dead-letter/requeue") {
15107:    if (req.method === "GET" && path.startsWith("/runtime/workflows/")) {
15183:    if (req.method === "POST" && path === "/runtime/defense/ingress") {
15474:            verification_method,
15575:    if (req.method === "GET" && path === "/runtime/defense/ingress") {
15602:    if (req.method === "POST" && path === "/runtime/defense/shadow-validations") {
15672:    if (req.method === "GET" && path === "/runtime/defense/shadow-validations") {
15699:    if (req.method === "POST" && path === "/runtime/defense/quarantine") {
15761:    if (req.method === "GET" && path === "/runtime/defense/quarantine") {
15789:    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/review")) {
15848:    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/approve")) {
15935:    if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/reject")) {
16023:    if (req.method === "POST" && path === "/runtime/defense/savepoints") {
16084:    if (req.method === "GET" && path === "/runtime/defense/savepoints") {
16112:    if (req.method === "POST" && path.startsWith("/runtime/defense/savepoints/") && path.endsWith("/rollback")) {
16266:    if (req.method === "POST" && path === "/runtime/defense/recovery-requests") {
16317:    if (req.method === "GET" && path === "/runtime/defense/recovery-requests") {
16346:    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/review")) {
16404:    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/approve")) {
16461:    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/reject")) {
16520:    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/execute")) {
16782:    if (req.method === "POST" && path === "/runtime/defense/recovery-verifications") {
16886:    if (req.method === "GET" && path === "/runtime/defense/recovery-verifications") {
16915:    if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-verifications/") && path.endsWith("/close")) {
16995:    if (req.method === "POST" && path === "/runtime/defense/metrics/recalculate") {
17115:    if (req.method === "GET" && path === "/runtime/defense/metrics") {
17144:    if (req.method === "GET" && path === "/runtime/defense/dashboard") {
17222:    if (req.method === "POST" && path === "/runtime/audit-reports/generate") {
17359:    if (req.method === "GET" && path === "/runtime/audit-reports") {
17396:    if (req.method === "GET" && path.startsWith("/runtime/audit-reports/")) {
17433:    if (req.method === "GET" && path === "/runtime/defense/state") {
```
