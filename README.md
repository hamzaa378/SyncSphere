# SyncSphere V2.2 — The Browser Reliability Lab

**GDG Tech Wildcard Entry | Frontend Task 1 | TypeScript**

A local-first multi-tab settings app that makes browser synchronization **observable, testable and recoverable**. Unlike a basic theme toggle, SyncSphere exposes active peers, per-setting version stamps, conflict resolution, latency measurements, a real-tab stress bench, recoveries after artificial message loss, and downloadable evidence. No frontend framework, remote server, database, user account, tracking, or runtime dependencies.

> **Core scope:** preferences synchronize between tabs in the **same browser profile and origin**. This is not multi-device synchronization. Test messages never modify actual preferences. V2.1 reports bundled below are real data from a prior V2.1 browser run; **V2.2 browser performance has not been measured in this environment**.

## Start in less than a minute

Requirements: Node.js 18+, recent Chrome/Brave/Edge/Firefox. From the extracted directory:

```powershell
npm start
```

Open **http://localhost:5173** in **three tabs** for the new multi-peer tests. The `dist/` folder ships precompiled, so `npm start` doesn't require npm installation. To edit source and run tests:

```powershell
npm install
npm run build
npm test
```

The CLI uses a lightweight static server, not a sync backend. Avoid double-clicking `index.html` as `file://` origins behave differently.

For real Chromium E2E (run with the server already started):

```powershell
python -m pip install playwright
python -m playwright install chromium
python tests/browser_v22.py
```

If port 5173 is occupied, on PowerShell set `$env:PORT = 5183` before `npm start`, and pass `http://localhost:5183` to the test script.

## Show a GDG evaluator

| Interaction | What it proves | Caveat |
| --- | --- | --- |
| Change theme, language or font in any tab | Required live preference synchronization | Same origin/profile only |
| Close all tabs and reopen | Versioned persistence and theme initialization | Storage must be enabled |
| Ping tabs | Round-trip timing | RTT is not one-way latency |
| Run **100 updates** | Real-tab isolated ACK benchmark, averages/median/P95/max | Does not exercise DOM redraw or persistent settings writes |
| Run **20 collisions** | Deterministic equal-counter conflicts in real tabs | One pair/one winning actor in each run |
| Run **Test all detected tabs** in `normal` mode | Every chosen peer ACKs 12 messages | Peers must have V2.2 open |
| Choose **Drop first attempt** | Controlled loss, retry and recovery accounting | Intentional lab fault, not normal delivery performance |
| Choose **Delay 150 ms** | Timeout/latency diagnostics under injected lag | Not a real browser slowdown |
| Choose **Mixed** | Alternating drops and processing delay | Results are fault-injected RTT |
| Close a tab during the fan-out run | Lost peers produce explicit failed attempts | Can require up to the configured timeout |
| Click **Verify and reconcile now** | Request full-state anti-entropy and inspect journal | A check doesn't imply actual repair was needed |
| Download JSON & CSV | Raw evidence, methods, test IDs, failures | Collect on the same version in all tabs |

### V2.2 changes over V2.1

1. **Fan-out resilience lab** delivers a set of isolated versioned updates to every detected tab (recommended 3–5 tabs). Unique run IDs and target IDs keep ACKs attributable.
2. **Fault injection** covers dropped first attempts, 150 ms delayed ACKs, retry recovery, failure on tab disconnect and cancellation. Retries are bounded (two attempts), not an infinite loop.
3. **Anti-entropy repair** now merges a newer validated per-setting register learned through HELLO/PRESENCE, or sends a *targeted, throttled* SNAPSHOT to a lagging tab. A manual verification control requests fresh state reports.
4. **Recovery journal** exposes state checks, accepted repairs, repair snapshots, most recent recovery reason and freshness of detected peers.
5. **Evidence schema 2.0** adds the full fan-out sample set, injected scenario, attempts, recovered statuses, report context and explicit methodology. The original 100-update baseline and 20-conflict tests remain intact.
6. **Protocol separation** prevents disposable experiment traffic from accidentally populating production peer state.

### How the code works in one minute

- **localStorage** stores one independently stamped register per preference (`theme`, `language`, `fontSize`).
- **BroadcastChannel** broadcasts UPDATE, HELLO, PRESENCE and snapshot requests among tabs.
- Every register has a **Lamport counter** and **actor ID**. The highest `(counter, actor)` wins, regardless of arrival order.
- **Storage events**, visibility recovery and periodic snapshots make the state eventually recover if a tab misses a broadcast or wakes after sleeping.
- **A separate `RobustnessLab`** sends isolated `ROBUST_*` messages. Dropping those messages never drops real user updates.

```
                                Browser origin
 Tab A: settings UI      <---- BroadcastChannel ---->    Tab B: settings UI
    |                                  |                        |
    +----- independently versioned localStorage keys ---------+
    |                                  |
    +-- LabNetwork: 100 updates, 20 collisions (disposable registers)
    +-- RobustnessLab: targeted fan-out, drop/delay/retry diagnostics
    +-- SyncEngine: validated merge, anti-entropy, repair journal
```

## Repository map

```text
index.html                     UI and early theme bootstrap
assets/styles.css              Light/dark responsive design
src/main.ts                    Event listeners, rendering, labs, export
src/i18n.ts                    Preference UI translations (en/es/fr/hi)
src/core/register.ts           Preference validation, clock comparator
src/core/storage.ts            Persistent registers and safe reads
src/core/sync-engine.ts        Production peer communication and state repair
src/core/lab-network.ts        100-update benchmark + 20-conflict tests
src/core/robustness-lab.ts     V2.2 fan-out, controlled faults, ACK/retries
src/core/reports.ts            Convergence assessment + JSON/CSV evidence
src/core/fingerprint.ts        Deterministic non-cryptographic checksums
src/core/conflict-lab.ts       Simple pedagogical conflict simulator
dist/                          Compiled JS supplied for immediate usage
scripts/dev-server.mjs         Local static-only HTTP server
tests/*.test.mjs               Native Node unit/integration tests
tests/browser_v22.py           Optional real-Chromium three-tab test
docs/V2_2_ROBUSTNESS.md        Fault scenarios + testing methodology
docs/V2_2_ARCHITECTURE.md      Sync protocol + anti-entropy tradeoffs
docs/V2_2_TEST_REPORT.md       Verified test scope and known gaps
docs/V2_2_CONTINUATION.md      Version, state, commands, module handover
evidence/v2_1_browser_baseline/  Prior user-collected V2.1 measurements
```

## Compatibility and migration

**No database migration and no user data reset.** Storage names retain `syncsphere:prefs:v1:*`; the existing BroadcastChannel retains `syncsphere:changes:v1`; V2.1 tests remain available. **All open tabs should use V2.2** when running new fan-out scenarios. The previous V1, V2 and V2.1 ZIPs remain separate.

## Results: separate historical evidence from fresh verification

- **Baseline data from the user's V2.1 browser run:** 100/100 ACKed, approximate delivery average 0.954 ms, median 0.9 ms, P95 1.5 ms, max 2.1 ms; 20/20 two-tab conflicts converged. Raw files are in `evidence/v2_1_browser_baseline/`.
- **V2.2 verified here:** 20/20 Node tests pass including fan-out to 2 peers, deliberately dropped first attempt recovered, processing delay, missing peer failure, peer presence repair and a boundary between production and test protocol messages.
- **V2.2 NOT verified here:** real Chromium E2E, actual multi-background-tab performance, cross-browser stress, every failure-injection scenario on your machine. Browser automation is provided but was blocked by environment navigation policy during packaging. Report only measurements **you run** as V2.2 results.

Read [`docs/V2_2_TEST_REPORT.md`](docs/V2_2_TEST_REPORT.md) before submission. Do not claim an arbitrary P95 under fault injection measures ordinary 100 ms preference sync.

## Limitations that are worth saying out loud

- There is **no global atomic transaction** covering multiple preferences; each key resolves independently.
- Logical clock order is deterministic, not proof of physically latest user click.
- Same-origin tabs can delay and throttle; one-way timing in the baseline is an **approximation**; acknowledgment RTT is more directly measured.
- Live presence is an estimate (9-second expiry), not an infallible open/closed signal.
- The anti-entropy strategy is eventual last-writer-wins replication for a browser demo, not a durable consensus protocol or Byzantine-resistant design.
- If persistence is blocked, settings may still sync through BroadcastChannel while tabs remain open, but cannot survive a complete browser restart.
- Lab retry timeouts are deliberately finite; background browser throttling can legitimately produce test failures. Report them.

## Documentation trail

Start with [`docs/V2_2_CONTINUATION.md`](docs/V2_2_CONTINUATION.md) for anyone continuing the project, [`docs/V2_2_ARCHITECTURE.md`](docs/V2_2_ARCHITECTURE.md) for internals, [`docs/V2_2_ROBUSTNESS.md`](docs/V2_2_ROBUSTNESS.md) for test instructions, and [`docs/V2_2_TEST_REPORT.md`](docs/V2_2_TEST_REPORT.md) for honest results. Older docs are retained for V1–V2.1 explanations.

**Submission**: source code + README + docs + actual test evidence, optionally a hosted frontend link and a short screen-recorded demo. Source challenge: `GDG_Tech_Wildcard_Entry.pdf`, Frontend Task 1, pp. 3–4.
