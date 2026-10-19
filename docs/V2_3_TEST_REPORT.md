# Verification report — SyncSphere V2.3

## Completed in packaging environment

- TypeScript `npm run build`: PASS.
- Node native suite `npm test`: **23/23 PASS** (20 inherited, 3 new regression tests). Includes actual Node BroadcastChannel communication, peer anti-entropy, forced conflict resolution, retry handling, wrong-peer ACK rejection, empty one-way diagnostic support and distinct retry/attempt timing.
- `python scripts/verify_evidence.py evidence/v2_1_browser_baseline/syncsphere-v2.1-evidence.json evidence/v2_1_browser_baseline/syncsphere-v2.1-samples.csv`: **PASS**, 120 matched rows.
- `python scripts/verify_evidence.py evidence/v2_2_browser_baseline/syncsphere-v2.2-evidence.json evidence/v2_2_browser_baseline/syncsphere-v2.2-samples.csv`: **PASS**, 144 matched rows. Cross-context timing anomalies: **53/100** > RTT by 0.05 ms.
- Static Node HTTP server serves `index.html`: HTTP 200 at localhost.
- Browser test is included but **not executed successfully here**: Chromium `Page.goto()` to local server was rejected as `net::ERR_BLOCKED_BY_ADMINISTRATOR`. This is a test-environment restriction; not evidence that the user-side app is broken or works.

## Pending Windows/real-browser acceptance

Run `python tests/browser_v23.py http://localhost:5173`, plus the manual `docs/TEST_INSTRUCTIONS_V2_3.md`. The script tests 100 ACKs, 20 conflicts, each of 4 fault scenarios with 2 peers, real preference updates, convergence, browser reopening, JSON/CSV export. Manual coverage adds deliberate disconnection, multiple visibility conditions and repeated runs.

## Historical browser results, DO NOT relabel them as V2.3

- User V2.1: 100/100 ACKed, 20/20 collision convergence. Approximate one-way mean 0.954 ms, RTT mean 4.418 ms.
- User V2.2: 100/100 ACKed, 20/20 collisions converged, normal three-tab fan-out 24/24. Approximate delivery mean 0.390 ms, ACK RTT mean 0.378 ms. Of these, 53 one-way samples exceeded RTT by more than 0.05 ms. Normal fan-out only; no user-provided V2.2 drop/delay/mixed exports.

**No V2.3 real-browser latency numbers have been produced in this environment.** Report only numbers from the user's next verified export.

## Release update — real Windows Chromium test subsequently supplied (19 October 2026)

The earlier “pending Windows acceptance” section above described the state **at initial V2.3 packaging time**. After that package was delivered, the project owner ran the real browser test and shared its successful PowerShell output:

- Three Chromium tabs: **PASS**.
- 100 benchmark updates and 20 collision trials: **PASS**.
- Fan-out Normal: **24/24**, 0 recovered, P95 successful-attempt ACK RTT **0.50 ms**.
- Fan-out Drop-first: **24/24**, 24 recovered, P95 **0.90 ms**.
- Fan-out Delay-150: **24/24**, 0 recovered, P95 **162.30 ms** (intentionally delayed).
- Fan-out Mixed: **24/24**, 12 recovered, P95 **157.20 ms** (intentionally delayed).
- Preference persistence: **PASS**.
- Independent CSV/JSON consistency validation: **PASS, 144 rows**, 18 one-way timing-uncertainty warnings.

The test output came from the user; the original V2.3 raw JSON/CSV were **not uploaded**. Read the new [EVIDENCE_AND_RESULTS.md](EVIDENCE_AND_RESULTS.md) for exact provenance and limitations. This release must not treat old V2.1/V2.2 raw evidence as V2.3 measurements.
