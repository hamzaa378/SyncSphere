# Verified testing, evidence provenance, and reporting — V2.3

This document separates three evidence levels: **tests rerun when preparing this release**, **output supplied from a Windows Chromium run**, and **original raw samples that are not yet in the release**. Never present historical V2.1 or V2.2 samples as V2.3 measurements.

## 1. Release-package checks performed

| Check | Observed result | Where to rerun |
| --- | --- | --- |
| Native Node test suite | **23/23 passed** | `npm test` after `npm install` |
| V2.1 JSON/CSV verifier | **PASS, 120 records** | `python scripts/verify_evidence.py evidence/v2_1_browser_baseline/syncsphere-v2.1-evidence.json evidence/v2_1_browser_baseline/syncsphere-v2.1-samples.csv` |
| V2.2 JSON/CSV verifier | **PASS, 144 records** | `python scripts/verify_evidence.py evidence/v2_2_browser_baseline/syncsphere-v2.2-evidence.json evidence/v2_2_browser_baseline/syncsphere-v2.2-samples.csv` |

The historical V2.2 verifier warns about **53 cross-context one-way samples exceeding RTT**. Those values were estimates, not reliable performance proof. V2.3 treats ACK RTT as the primary protocol metric.

## 2. User-provided Windows Chromium acceptance output (2026-10-19)

The project owner ran `python tests/browser_v23.py http://localhost:5173` and the independent evidence verifier in Windows PowerShell, reporting:

```text
fanout normal PASS · 24/24 ACKs · 0 recovered · successful-attempt RTT P95 0.50 ms
fanout drop-first PASS · 24/24 ACKs · 24 recovered · successful-attempt RTT P95 0.90 ms
fanout delay-150 PASS · 24/24 ACKs · 0 recovered · successful-attempt RTT P95 162.30 ms
fanout mixed PASS · 24/24 ACKs · 12 recovered · successful-attempt RTT P95 157.20 ms
PASS: 3 Chromium tabs; 100 benchmarks, 20 stress trials, 4 fanout modes, persistence, 144 evidence rows
PASS: SyncSphere v2.3 — 144 CSV records matched JSON; independent stats and denominators verified
  benchmark: 100 raw samples
  stress: 20 raw samples
  fanout: 24 raw samples
  One-way estimates greater than RTT by >.05 ms: 18 (diagnostic uncertainty, not a failed ACK)
```

**Status:** supplied console output, not an independently rerun Playwright test in this packaging environment. The raw `syncsphere-v2.3-evidence.json` and `syncsphere-v2.3-samples.csv` from this run were **not supplied**, so they are **not present** in this release. There is no invented raw evidence, fabricated screenshot, or claimed deployment link.

### How to read those numbers

- Normal mode: 24 delivery targets were acknowledged, with P95 successful-attempt RTT 0.50 ms.
- Drop-first mode: the first test attempt was intentionally dropped for all 24 messages, and each recovered after retry.
- Delay mode: delayed ACKs produce an approximately 150 ms or greater RTT *by design*. Do **not** compare this to the unfaulted 100-ms synchronization target.
- Mixed mode: 12 of 24 targets recovered following an injected drop.
- In all four modes together, 96/96 targeted deliveries were reported successful, with 36 intentional first-attempt drops recovered. The exported CSV has 24 fan-out rows for the **last Mixed** run only, not all 96 fan-out deliveries.
- Anomalous cross-context one-way estimates are expected diagnostic uncertainty; reliable acceptance statistics should use monotonically timed ACK RTT and real preference behavior.

## 3. Add original V2.3 evidence to the repository

On the computer that ran Playwright, from the project root:

```powershell
python scripts/verify_evidence.py `
  ".\tests\artifacts\v23_latest\syncsphere-v2.3-evidence.json" `
  ".\tests\artifacts\v23_latest\syncsphere-v2.3-samples.csv"

Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-evidence.json .\evidence\v2_3_browser_validation\
Copy-Item .\tests\artifacts\v23_latest\syncsphere-v2.3-samples.csv .\evidence\v2_3_browser_validation\
```

Both copy commands are intended for the project root after this release ZIP has been extracted. The `evidence/v2_3_browser_validation/` folder is **not ignored by Git**. When both original files exist and pass the verifier, commit them and update the README with a link to these raw files.

For all **four** fan-out modes in separate raw evidence pairs, run and export each mode manually; the automated script overwrites the current lab report with the last mode's summary. Retain your terminal transcript in addition to any exports.

## 4. Obtaining comparable measurements reliably

1. Record OS, browser version, viewport arrangement, Node/Python versions, battery/AC state and approximate CPU load.
2. Use three tabs in the same browser profile and on the same exact URL, all on V2.3.
3. Keep receiving tabs visible in separate windows for controlled measurements; label any minimized-tab experiment explicitly.
4. Run one **labeled warm-up**, then three regular 100-ACK runs. Save **each** JSON/CSV pair, even when slower than expected.
5. Compare P95, maximum, successful/failed counts and timestamp anomalies. Do not expect identical sub-millisecond observations.
6. Test a deliberately minimized/closed peer separately, record that it is a stress test, and report failures honestly.
7. Treat lab-register RTT as protocol performance. Independently observe true preference application and persistence.

One run is a demonstration, not a universal browser-level service-level agreement. See [TEST_INSTRUCTIONS_V2_3.md](TEST_INSTRUCTIONS_V2_3.md) for a full checklist.

## 5. Claim boundaries for a GitHub README or presentation

**Appropriate:** “Three-tab Chromium tests reported 100 acknowledged benchmark updates, 20 converged logical conflicts, and 24/24 targeted acknowledgments in each of the four test modes. The normal fan-out successful-attempt RTT P95 was 0.50 ms in the reported run.”

**Not appropriate:** “SyncSphere guarantees 0.50 ms latency”, “synchronization is absolutely instantaneous”, “fault-injected 150 ms is a normal latency regression”, or “it provides cross-device strong consistency”.
