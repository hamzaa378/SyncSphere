# BEGIN HERE — SyncSphere V2.3 continuation and handover

## Snapshot / scope

Project: GDG Tech Wildcard Frontend Task 1, multi-tab settings sync. Current packaged release V2.3. No backend. TypeScript ES modules compiled to `dist/`, shipped precompiled; Node dev server only static. Browser state persisted per origin in `syncsphere:prefs:v1:theme`, `language`, `fontSize`; channel `syncsphere:changes:v1`. No migration of saved settings. Existing V2.2 ZIP remains separate. Do not change those storage keys without a deliberate compatibility plan.

## Core file ownership

- `index.html`: correct theme bootstrap before styles, markup and metric IDs.
- `assets/styles.css`: responsive light/dark presentation.
- `src/main.ts`: wiring, rendering, activity, lab controls, JSON/CSV download. **ACK RTT now drives benchmark headline statistics**.
- `src/core/register.ts`: types, LWW counter and tie break, validation.
- `src/core/storage.ts`: validated storage fallback.
- `src/core/sync-engine.ts`: production broadcast updates, peer discovery, storage events, anti-entropy snapshots and counters.
- `src/core/lab-network.ts`: isolated 100-ACK benchmark, 20 actual peer conflict trials. Selected sender must match ACK; one-way diagnostic is not acceptance criterion; completed remote stress entries freed.
- `src/core/robustness-lab.ts`: fault modes normal/drop-first/delay-150/mixed, targeted ACKs, bounded retry and attempt vs total timing.
- `src/core/reports.ts`: convergence with fresh reports, JSON schema 2.1, CSV samples.
- `scripts/verify_evidence.py`: independent JSON/CSV validator.
- `tests/v23-audit.test.mjs`: new regression tests.
- `tests/browser_v23.py`: optional Playwright real browser acceptance.

## Commands

```powershell
npm start
npm install
npm run build
npm test
python -m pip install playwright
python -m playwright install chromium
python tests/browser_v23.py http://localhost:5173
python scripts/verify_evidence.py path/to/syncsphere-v2.3-evidence.json path/to/syncsphere-v2.3-samples.csv
```

Port conflict: `$env:PORT = '5183'; npm start`; pass the same origin to browser test. The source code is cross-platform. No `.env` or service credentials necessary.

## Completed verification

Static TypeScript build PASS; 23/23 Node tests PASS; prior browser evidence V2.1 (120 records) and V2.2 (144 records) passed independent JSON/CSV validation. Chromium launched but localhost navigation blocked by the execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`); V2.3 real-browser tests still pending on Windows. **Do not say the complete E2E has passed.**

## Known tradeoffs

- No atomic CAS for browser localStorage; eventual convergence is not formal consensus.
- Comparator picks highest `(counter, actor)`; not physically-last-click.
- Wrong-tab attribution now guarded, but same-origin code is trusted; no adversarial threat model.
- One-way performance numbers are approximate diagnostic-only; source ACK RTT is the benchmark basis.
- `RobustnessLab.totalElapsedMs` includes retry waits; `ackRttMs` covers the successful final attempt.
- Presence timeouts can mark background/throttled tabs missing; localStorage disabled means no persistence.
- 100-update isolated lab exercises protocol, not actual DOM/paint/persistence; run separate UI acceptance tests.

## Next work, priority order

1. Run `tests/browser_v23.py` on Windows with 3 tabs and provide output/evidence pair. For manual acceptance run every fault mode and save exports separately.
2. Test intentional tab-close and restoration and verify that failure counting is correct even if the tab is lost mid-run.
3. Run three comparable 100-update benchmarks on the same machine, tab setup and browser build; preserve every raw run and summarize P95 values without cherry-picking.
4. Verify actual setting synchronization, preference persistence across full browser close/reopen and initialization with no theme flash.
5. Include screenshots and runtime information in GDG repository; update `docs/V2_3_TEST_REPORT.md` only after new evidence is produced.

**Main runbook:** `docs/TEST_INSTRUCTIONS_V2_3.md`.

## Final GitHub release follow-up (2026-10-19)

After the initial V2.3 packaging checkpoint, a Windows Playwright Chromium run and the independent JSON/CSV verifier both reported PASS. Details: `docs/EVIDENCE_AND_RESULTS.md`. The release now includes a canonical README, `docs/SETUP_GUIDE.md`, an updated submission checklist, `docs/DEMO_SCRIPT_V2_3.md`, and `.github/workflows/ci.yml`. The underlying synchronization source and tests remain based on the V2.3 audited project. **V2.3 raw browser exports must still be copied from the user's Windows machine**; only terminal output was supplied. The checked-in historical V2.1/V2.2 raw evidence is preserved separately.
