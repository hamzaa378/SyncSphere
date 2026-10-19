# V2.2 Verification report (2026-10-19)

## Scope and results

**Verified in this build environment**

| Verification | Observation |
| --- | --- |
| TypeScript compilation | PASS (`npm run build`) |
| Automated Node unit/integration suite | **20/20 PASS** (`npm test`) |
| Existing cross-tab model tests | PASS: independent keys, conflict comparison, storage reopening, presence and ping |
| Existing V2.1 experiments in native Node BroadcastChannel | PASS: 100 ACKed updates and 20 convergence trials |
| V2.2 two-peer fan-out in native Node BroadcastChannel | PASS: 10/10 ACKs in automated test |
| V2.2 first-attempt failure injection | PASS: 4/4 recovered after exactly 2 attempts in test |
| V2.2 artificial 150 ms delay | PASS: 2/2 ACKs recorded with sender RTT >=140 ms |
| V2.2 missing peer | PASS: no ACK counted as success; failure recorded |
| V2.2 recovery from newer advertised register | PASS: merged and persisted validated newer stamp |
| V2.2 experiment/production protocol separation | PASS: unrelated fault traffic did not create production peer |
| Real Chromium three-tab Playwright suite | **NOT VERIFIED HERE**: environment blocked navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR` |

These Node tests use real `BroadcastChannel` instances in Node.js for transport-level behavior, plus in-process `window`, `document`, and storage mocks for `SyncEngine`. They are **not** a replacement for a full browser UI test. No V2.2 real-browser latency result is claimed here.

## Historical user-collected browser baseline (V2.1, not V2.2)

The attached V2.1 JSON/CSV evidence from an earlier Chromium run recorded **100/100 ACKs**, 100 successful approximate delivery values with mean 0.954 ms, median 0.900 ms, P95 1.500 ms, max 2.100 ms; acknowledgment RTT mean 4.418 ms, median 4.600 ms, P95 6.300 ms, max 7.700 ms; and **20/20** equal-counter conflict trials converged. It also reported temporary divergence for a theme update and a later matching full-register state. The raw files are copied into `evidence/v2_1_browser_baseline/` and are not relabeled as fresh V2.2 results.

## Remaining browser acceptance work

1. Run `npm start` and `python tests/browser_v22.py` locally to exercise three real Chromium pages and export evidence.
2. Run 100 updates and 20 collisions manually on V2.2 and export their raw results.
3. Run all four V2.2 fault modes with 3–5 tabs and save separate JSON/CSV for each run; confirm target peers and failure counts.
4. Close one peer during mixed mode. A failure must be recorded. Reopen it and check peer discovery/reconciliation.
5. Test with an inactive tab, a sleeping tab, background CPU load, cross-browser tabs on the **same origin** (when permitted), and a browser restart.
6. Verify visually that responsive panels, persistence, translations and high font-size layouts still work.

## What not to claim yet

- No proven <100 ms guarantee across all browsers or under throttling.
- No V2.2 full-browser performance measurement collected in this environment.
- No guarantee of atomic multi-key settings or physical last-click order.
- No automatic real-tab-disappearance test claimed without running it manually.
- Injected 150 ms RTT is not ordinary synchronization delay.
