# V2.2 Robustness test handbook

## Goals

1. Prove two-to-five browser tabs can receive independent addressed messages, not merely one pair.
2. Make delivery failure visible by counting all planned deliveries, not just successful samples.
3. Detect and recover from controlled loss with bounded retries.
4. Distinguish expected 150 ms injected delay from ordinary browser transport latency.
5. Document how a real tab disconnect affects ACKs, including incompletes.
6. Verify real user preferences never get mutated by fault injection.

## Setup and version check

Use the exact same `http://localhost:5173` origin in all tabs, no mixed V2.1/V2.2 bundles; open three or more tabs. Open the **Reliability lab** sidebar entry in the coordinator tab. All other tabs need to stay open and running V2.2. The menu **Test all detected tabs** uses the coordinator's current peer list, capped at 8 peers and designed for 1–8 recipients. It sends 12 updates to each recipient, so 3 tabs total means 24 planned ACKs. It records the real target list as it existed when the run started.

## Experiment matrix

| Mode | Receiver behavior | How to interpret |
| --- | --- | --- |
| `normal` | ACK immediately | Baseline targeted multi-peer communication (not real preference DOM benchmark) |
| `drop-first` | Deliberately ignores first attempt for every test message; acknowledges second | Successful rows should be marked recovered, attempts=2 |
| `delay-150` | Waits 150 ms before ACK | ACK RTT includes the deliberate delay; never compare directly to regular delivery latency |
| `mixed` | Odd sequence: drop-first; even sequence: delay 150 ms | Evaluate each row with injected fault scenario |

The sender retries at most twice. Timeout: 160 ms/attempt for `drop-first`, 600 ms/attempt for other modes. All values are **test parameters**, not guarantees on real tab delivery. Missing ACKs are recorded as failures. If a tab is closed in the middle, expect failed rows and possibly unattempted rows on cancellation. The exported `requestedPerPeer`, `targetPeers`, `samples`, `failed`, `cancelled` and `timeoutMs` establish the denominator and provenance.

## How to test disappearance

Start with three tabs. In coordinator tab choose `mixed`; click **Test all detected tabs**. Close one receiving tab while the test is running. The receiver can't ACK once closed. After the timeout, observe one or more failed sample rows; do not interpret an empty reply as success. Open a new tab; wait for peer discovery, run normal mode again, and check new peer IDs are discovered. This is a manual resilience test, not automatically forced by the application.

## Repair observability

Every peer's HELLO/PRESENCE message may contain full stamped registers. The engine validates values, compares stamps, merges newer versions and sends bounded targeted snapshots if peers are behind. `repairChecks` counts inspections; `repairedRegisters` counts new versions adopted through peer anti-entropy or snapshots; `repairSnapshotsSent` counts targeted repair attempts. It is normal for successful stable sessions to have **zero actual repairs**.

To exercise the monitor without risking settings, create 3 tabs and edit one real preference while others are open. Watch convergence move from diverged (if caught) to converged. Then click **Verify and reconcile now**, which forces a localStorage read and HELLO/PRESENCE exchange. Refresh a tab or restore a background tab and verify full stamped registers match. Do not claim a change was repaired merely because checks incremented.

## Record measurements responsibly

JSON includes `schema`, browser agent, tab IDs, created timestamp, benchmark raw samples, stress trials, fan-out raw samples with retries, convergence transitions, and recovery counters. CSV has one row per benchmark/stress/fan-out observation, with missing values empty and failures retained. Prefer recording both exported files and a screenshot; ensure same run/time/source version. A 100-update baseline using isolated test registers and a fan-out fault-injection run answer **different** performance questions.

### Suggested acceptance conditions

- 100/100 ACKs from the existing baseline lab and P95 of successful deliveries below 100 ms during a normal visible two-tab test (must be measured locally).
- 20/20 converged two-tab conflict trials.
- For normal fan-out with 3 tabs: 24/24 ACKs.
- For `drop-first` fan-out with 3 tabs: 24/24 ACKs, all marked recovered after 2 attempts.
- For `delay-150`: ACK RTT around or above 150 ms when tabs remain responsive; no false assertion that this is normal latency.
- For an intentionally disconnected tab: at least one failed/incomplete delivery, no false success, and later recovery after opening a new tab.
- Closing all tabs and reopening preserves all three preferences.
- Test-register fault experiments do **not** alter settings (compare before and after).

These are planned acceptance criteria, not automatic claims of passed V2.2 browser tests.
