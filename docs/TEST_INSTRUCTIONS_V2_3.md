# V2.3 acceptance testing — exact procedure

**Goal:** verify real preference synchronization, conflict behavior, measurable performance, artificial faults, convergence and honest evidence. Results are local-browser observations, **not internet latency**, distributed consensus or guaranteed SLA.

## 0. Before every test run

1. Extract the new V2.3 ZIP to a **new directory**; do not copy new files over an old running V2.2 server. Stop any earlier server with `Ctrl+C`.
2. Install Node.js 18+ (Node 22 recommended), and use a current Chromium-based browser (Brave, Chrome or Edge). Node install is not needed for runtime when compiled `dist/` exists.
3. From the directory containing `package.json`, run `npm start`. The terminal should display the local address. Verify `http://localhost:5173` loads. If 5173 is in use, run `$env:PORT="5183"; npm start` in **PowerShell** and use 5183 everywhere.
4. **All tabs must have the identical scheme, host, port and browser profile**. `localhost` and `127.0.0.1` are different origins. A private window belongs to a different browser storage partition/profile.
5. Open **three tabs**, or three side-by-side browser windows if you want them foreground-visible. In the coordinator tab, navigate to **Reliability lab**. Wait for **two other peers** in the selector and **three total tabs** in the Overview.
6. Confirm the displayed footer identifies **V2.3** and the normal preferences are identical in all three tabs. Do not leave old V2.2 tabs open on the same origin: they use the same BroadcastChannel name.
7. For timing comparisons, minimize background downloads, video, games, heavy CPU tasks, browser DevTools recording and battery-saving mode; preferably connect laptop to power. These measures reduce noise, they **do not guarantee any particular latency**.
8. Avoid using the OS clock, browser refresh, tab focus or changed hardware as a benchmark optimization trick. Do not erase inconvenient failed measurements.

## 1. Preference requirements (real settings; not the lab)

| Action | Expected evidence |
| --- | --- |
| In Tab A turn Dark mode ON | Tabs B and C switch themes without reload; activity list receives changes |
| In Tab B choose French | Tabs A and C display French UI without reload |
| In Tab C set font size to 21 | Tabs A and B show 21 px without reload |
| Look at **Convergence** | It ultimately reports all 3 complete stamped registers match; a momentary diverged state is permissible during delivery |
| Close all 3 tabs and reopen same site in the same profile | Three saved preferences restore; initial theme should not flash incorrectly |
| Refresh one tab after changing setting in another | It restores the latest resolved stamp |

Keep a screenshot of the three-tab state with a common value and matching version stamps. These tests are necessary because the isolated lab does not exercise real setting persistence or rendering.

## 2. Benchmark, 100 updates

1. Restart/refresh the three tabs if you want a clear fresh run, wait for peers to settle, then click **Run 100 updates** in coordinator Tab A.
2. Keep target Tab B open and preferably visible. Wait until the button becomes enabled again. Avoid moving windows during measurement.
3. **Expected:** `100/100 acknowledged`, all 100 ACK RTT values typically below 100 ms in a responsive foreground environment. Do not promise or hard-code a value such as 0.3 ms. If failures occur, keep those rows and record the cause.
4. The four metric cards show **source-tab ACK RTT** (average, median, nearest-rank P95 and maximum), not cross-context one-way timing.
5. The JSON also contains `deliveryStats` as **diagnostic-only estimates**. These may be larger than ACK RTT due to cross-context timer origin/resolution. `oneWayExceedsRtt` counts the suspect comparisons. Never use `deliveryStats` to make the 100-ms acceptance claim.
6. Save your data **before** rerunning tests: subsequent runs replace the UI's last result.

The ACK RTT is measured from sending the test message to getting an acknowledgment from the selected real tab. This includes processing and the return path, but it is **not** a direct measurement of persistence or DOM paint of a real preference.

## 3. Conflict test, 20 trials

Click **Run 20 collisions** after choosing a peer. Expected is `20/20` converged. Trials generate same-counter competing stamps on disposable registers in two real tabs, using the production comparator. Both independently resolve to the same winner. One tab may win all trials because actor IDs remain fixed; this is not proof that all interleavings and arbitrary Byzantine faults have been tested.

## 4. Fault fan-out: run all four modes separately

Always use three tabs total (coordinator plus two peers). Each run targets **12 separate test messages per peer = 24 planned deliveries**. After every row below, **export the JSON and CSV immediately into a uniquely named folder**, as only the latest mode is retained in the UI.

| Mode to select | Expected result when peers remain responsive | What you should see |
| --- | --- | --- |
| `Normal transport` | 24/24 ACKs, 0 retries, 0 failed | `recovered = 0`, typical low final-attempt RTT |
| `Drop first attempt` | 24/24 ACKs, all 24 recovered after 2 attempts | `attempts=2`; `totalElapsedMs` includes the roughly 160 ms first-attempt wait; final `ackRttMs` does not |
| `Delay acknowledgement by 150 ms` | 24/24 ACKs with one attempt each | final-attempt ACK RTT is ordinarily 150 ms or higher, **not** a normal-latency failure |
| `Mixed faults` | 24/24 ACKs; 12 recovered from dropped first attempts, 12 delayed ACKs | odd sequence dropped first; even sequence delayed; read attempts individually |

**Important:** timing is subject to OS scheduling, background throttling and browser behavior. Under load, even expected runs can fail. Such failures are real observations. A dropped first attempt is intentional: success means a retry eventually reached that peer, not that no message was lost.

## 5. Disconnection and recovery

1. Start three tabs and let presence settle.
2. In Tab A select `Drop first attempt` (or `Mixed`). Click **Test all detected tabs**.
3. Quickly close receiving Tab C while the run is still active. The planned target list is fixed at run start. Affected messages should count as **failed** after the two timeout attempts, unless they were already acknowledged before you closed the tab. An entirely clean 24/24 result when you closed too late is **inconclusive**, not a failure of the test framework.
4. Export failure evidence. Open a replacement Tab D; wait for the new peer ID to appear. Run **Normal** again with all tabs healthy; expect new delivery acknowledgments. Export this recovery evidence separately.
5. Click **Verify and reconcile now**. If no real state was stale, zero repaired registers is correct. `repairChecks > 0` by itself is not proof of repair.
6. To validate actual stale-state correction, create or reopen a tab after changing a real preference in another tab, check that it adopts the current register and converges. Preserve evidence of the previous state and the final state if claiming an observed repair.

## 6. Report export and independent validation

After running the benchmark, conflicts and ONE fan-out mode, click **Export JSON** and **Export CSV**. Move both files together into a folder like `evidence/local_runs/run-01-normal/`. Run this from your project root:

```powershell
python scripts/verify_evidence.py "C:\path\to\syncsphere-v2.3-evidence.json" "C:\path\to\syncsphere-v2.3-samples.csv"
```

The tool checks row counts, duplicate sequence/peer pairs, ACK pass flags, expected winners, recalculated average/median/P95/max, retry timing fields, and denominators. A complete 3-tab export has **100 benchmark + 20 conflict + 24 fan-out = 144 CSV rows**. If only some tests were run, fewer rows are correct.

**Run the actual Chromium automation** (requires Python Playwright and a separately running `npm start`):

```powershell
python -m pip install playwright
python -m playwright install chromium
python tests/browser_v23.py http://localhost:5173
```

Expected: the script creates a temporary browser context, tests all four fault modes plus the benchmark/conflicts, synchronizes a real setting, checks persistence and convergence, saves JSON/CSV under `tests/artifacts/v23_latest/`. The script uses `assert` and will exit with an error if a required result is not obtained. Run the verifier on those files too.

## 7. Repeated runs for defensible evidence

- Warm up once with a normal mode run, and label it **warmup**, not as a hidden or omitted failure.
- Repeat the same **100-update benchmark three times**, preserving **all three** exports with their timestamps. Do not cherry-pick the best one. Report each run's P95 and maximum, or summarize the median of the three run P95 values with all original artifacts accessible.
- Run on the same machine, browser version, power plan, tab count, viewport size and visibility conditions. Record those details in the submission README or evidence notes. For fair comparisons keep exactly the same peer target policy.
- For lower timing noise, prefer three separate side-by-side windows rather than background tabs. This makes `requestAnimationFrame` and timers less likely to be throttled. It is a *controlled test condition*, not a promise about background performance.
- Re-run **under stress** at least once (other tab minimized, busy CPU, tab closed). Report degraded results as reliability limits rather than deleting them.
- Never claim exact per-sample millisecond reproducibility. Operating systems, event loops, browser timer precision and hardware differ between runs.

## Expected output summary (not fabricated measurements)

| Check | Healthy-run expectation |
| --- | --- |
| Three visible instances | Coordinator sees 2 peers |
| 100 benchmark updates | 100/100 ACK; high chance all RTT ≤100 ms under low load |
| 20 collision trials | 20/20 consistent winners |
| Normal fan-out | 24/24, recovered 0 |
| Drop-first | 24/24, recovered 24, 2 attempts each |
| Delay-150 | 24/24, recovered 0, ACK RTT commonly ≥150 ms |
| Mixed | 24/24, recovered 12 |
| Disconnected peer | Unacknowledged planned messages are explicit failures |
| Preferences reopened | Same values before paint and after initialization |
| JSON/CSV verifier | PASS only if recorded samples and summaries agree |

**These are expected behaviors, not a promise that any new run passed.**
