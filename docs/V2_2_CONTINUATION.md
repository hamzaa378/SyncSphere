# SINGLE PROJECT HANDOVER — SyncSphere V2.2

**Checkpoint**: V2.2 implemented, TypeScript compiled, **20/20 Node tests passed**. Browser E2E script supplied but environment blocks Chromium navigation; run it on your Windows workstation. Baseline V2.1 ZIP and genuine V2.1 exported evidence preserved.

## User goal and acceptance

GDG Tech Wildcard Frontend Task 1: TypeScript preferences (theme/language/font), real-time tab synchronization target within 100ms, persistence, no incorrect theme flash on startup, deterministic conflicts. Scoring: latency 30%, conflicts 25%, persistence 20%, architecture 15%, UI 10%. User requested a unique observable reliability lab, not just a basic toggle dashboard. Keep code simple to explain in interviews and include GitHub-ready documentation/evidence.

## Installation and environment

Windows PowerShell: `cd GDG_SyncSphere_Frontend_Task1_V2_2`; `npm start`; open `http://localhost:5173` in 3 browser tabs. Node >=18. `dist/` shipped; `npm install && npm run build && npm test` for development. Browser automation: `python -m pip install playwright`; `python -m playwright install chromium`; run `python tests/browser_v22.py` with server running. No MySQL/Oracle/Python backend. No schema migration.

## Source and responsibilities

- `src/core/register.ts`: valid preference domains, version comparator, storage/channel names.
- `src/core/storage.ts`: safe persistence read/bootstrap.
- `src/core/sync-engine.ts`: all real user settings; presence, storage events, anti-entropy and directed snapshots; repair counters.
- `src/core/lab-network.ts`: unchanged V2.1 100-update + 20 equal-clock conflicts, acknowledged samples.
- `src/core/robustness-lab.ts`: new addressed multi-peer fan-out, bounded retries, injectable lab faults, per-sample results.
- `src/core/reports.ts`: convergence, report version 2.0, JSON/CSV with raw samples and methodology.
- `src/core/fingerprint.ts`: stable values/checksum for monitoring, not cryptographic security.
- `src/core/conflict-lab.ts`: simple pedagogical simulation.
- `src/main.ts`: DOM rendering, UI events, V2.1/V2.2 labs and exports.
- `index.html` and `assets/styles.css`: original visual system with two added V2.2 panels.
- `tests/v22-robustness.test.mjs`: V2.2 native Node message transport tests.
- `tests/engine.integration.test.mjs`: original tests plus new anti-entropy and protocol separation tests.
- `tests/browser_v22.py`: actual 3-tab Chromium smoke test, locally runnable.
- `evidence/v2_1_browser_baseline`: unmodified user-provided historical JSON/CSV measurements.

## Current version state

Original `syncsphere:prefs:v1:*` per-key localStorage format is unchanged and no wipe is needed. Browser channel name remains `syncsphere:changes:v1`. Existing V2.1 controls operate with V2.2. New protocol messages are `ROBUST_UPDATE`, `ROBUST_ACK`; only production sync types affect production peer state. No environment variables required except optional `PORT` on server. No cloud credentials.

## Verification and limitations

At packaging: `npm test` reports 20 passing tests including 5 V2.2 robustness checks and 2 new production-engine regression checks. `npm run build` passes. Browser E2E attempted but navigation was blocked by execution environment (`ERR_BLOCKED_BY_ADMINISTRATOR`); **do not present it as passing**. User's V2.1 100/100 and 20/20 records have been preserved, and should be cited only as baseline, not V2.2 outcomes. Same-origin browser partition rules apply; actual background throttling and crash timing remain to be tested.

## Immediate next steps for another AI/developer

1. Extract latest ZIP and run `npm test`.
2. Run `npm start`, open three V2.2 tabs, inspect `#engineering-lab`.
3. Run `python tests/browser_v22.py`; if it fails, attach console traceback and page screenshots.
4. Run regular V2.2 benchmark and conflict tests, export evidence.
5. Test V2.2 fan-out normal, drop-first, delay, mixed. Close one receiving tab during a run, verify explicit failures and recovery after reopening.
6. Compare production full-register fingerprints; test dark mode/font across 3–5 tabs and persistence after closing all tabs.
7. Update `docs/V2_2_TEST_REPORT.md` with **measured browser results** before GitHub submission. Do not silently alter proven historical test evidence.

## Known remaining gaps and possible V2.3 ideas

High-load multi-tab randomized schedules, dedicated browser-level fault injection across production storage, engine restart under corrupted storage, accessibility audits, production preference end-to-end delivery metrics, stronger isolation when tabs have different origin/partition, retry jitter/backoff for more demanding simulations, and automated CI across browser engines. Do not introduce a server or database unless user explicitly wants cross-device functionality.
