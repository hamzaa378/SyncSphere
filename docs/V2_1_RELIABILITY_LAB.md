# SyncSphere V2.1 — Reliability lab and interview guide

## Why these features exist

The GDG Task 1 evaluation gives priority to cross-tab update timing, consistency/conflicts, and persistence. V2.1 adds **actual observable experiments** rather than manually invented scores. The original three settings, synchronization, persistence and initialization remain intact. V2.1 does not change `syncsphere:prefs:v1:*` keys or the production channel name.

## How to operate it

1. Use `npm start`, then open the exact same URL in **two current V2.1 tabs** of the same browser profile. The same origin (host+port+protocol) is necessary.
2. Check that the UI says **2 tabs** and that a target tab appears in **Reliability test bench**.
3. Click **Run 100 updates**. The initiator sends one isolated test-register update at a time and awaits an explicit confirmation from the selected peer. See 100/100 only if all acknowledgments arrived.
4. Click **Run 20 collisions**. Both tabs prepare different candidate values with an identical Lamport counter and unique actor IDs. The coordinator issues FIRE, and they exchange independent candidates over the browser channel. The test compares the two winners.
5. Change a normal preference and observe **Convergence and evidence**. The monitor compares the complete value/counter/actor tuple of all three registers in each tab, not just theme/font/language.
6. Use **Export JSON** for full reproducible measurements and test methodology; **Export CSV** for raw rows. The exports are from the browser where the buttons were clicked, not pre-generated.

## What the numbers really mean

- **Average / median / P95 / max** summarize successfully acknowledged approximate **one-way message delivery** samples from the 100-update experiment. Median is midpoint-averaged for even-sized samples; P95 uses nearest rank (ceil(0.95 × n)).
- **ACK RTT** is also captured in JSON. It is a true initiating-tab `performance.now()` elapsed duration until the receiver acknowledged the update, including receiver processing and reply scheduling. It is NOT interchangeable with one-way delivery.
- **One-way delivery** uses `performance.timeOrigin + performance.now()` in two browsing contexts on the **same device**. Browser clock reductions and event-loop scheduling add noise; it is an approximate observation, not an internet round-trip/network metric.
- A failed or timed-out sample is **never silently discarded from the raw test**. Success count and requested sample count are both reported; summary statistics use successful samples only.
- A displayed 2.4 ms or 3 ms from one run does not establish a guaranteed 100 ms SLA; repeat across browser states and machines.

## Difference between ordinary settings and experimental registers

- Ordinary settings are **persistent** per-key last-writer-wins registers in localStorage, distributed via BroadcastChannel and storage-event fallback. This remains unchanged.
- Experiment data goes through the **same BroadcastChannel and `compareStamp` algorithm** but is intentionally **ephemeral and isolated**. It never sets dark mode, language or font size, and it does **not benchmark persistent storage or the fallback transport**. Thus the result is valid evidence of the production transport path's message processing, but does not by itself prove every preference update or startup flow meets a particular time limit.
- The concurrent test stages two proposals on two real tab listeners before either observes the other proposal. The proposals have equal counters, so lexicographically larger tab actor ID wins on both tabs regardless of receive order.

## Key files / architecture

| File | What to explain |
| --- | --- |
| `src/core/register.ts` | Typed settings; compares two Lamport stamps deterministically. |
| `src/core/sync-engine.ts` | Real persisted preferences and peer state announcements. BroadcastChannel, storage events, and periodic repair. |
| `src/core/fingerprint.ts` | Simple, noncryptographic display-value and revision fingerprints. |
| `src/core/lab-network.ts` | Independent test channel instance on the same **channel name**; 100 request/ack updates, 20 prepared collision trials, timeouts, and nearest-rank stats. |
| `src/core/reports.ts` | Full state comparison plus JSON and RFC-compatible escaped CSV. |
| `src/main.ts` | Connects buttons, progress bar, live counters, raw results, downloads, and convergence histories to the DOM. |
| `tests/v21-lab.test.mjs` | Automated 100-message and 20-collision Node BroadcastChannel tests, statistics and revision-state tests. |
| `tests/browser_v21.py` | Optional real-browser E2E test for two Chromium tabs, downloads, and no JavaScript errors. |

## 60-second explanation for evaluators

> Each setting is a versioned register. Every tab announces its state and receives updates through BroadcastChannel, and localStorage persists the winner. If two writes share the same logical version, the tab ID breaks the tie. We now test this with 100 real cross-tab acknowledgments and 20 prepared equal-version collisions. The diagnostics distinguish one-way delivery from round-trip time, and export raw samples so the numbers can be independently checked. The lab writes into its own temporary test register and cannot overwrite your preferences.

## Constraints and honest limitations

- **Same-origin, same-browser-profile only**; no multi-device or internet sync.
- Every peer used for the lab must be running V2.1. An older V2 tab may appear online but cannot answer V2.1 lab messages; the run times out without fabricating a score.
- Hidden/minimized tabs can be throttled. Test with both tabs open and the browser foregrounded; note browser state in any formal report.
- The benchmark is a sequential ACK-based test, not a parallel throughput test; its 100 samples are **not independent network observations**.
- The peer convergence observer relies on peer announcements and can briefly display a mismatch while an update is in flight. Peer liveness is approximate and expires after a silence window.
- Conflict stress uses separate test registers and same comparator, not destructive real preference collisions.
- V2.1 lab text is English; core application controls retain English, Spanish, French and Hindi translations.

## GitHub evidence checklist

- [ ] Screenshot of two detected tabs and a matching full-state fingerprint.
- [ ] Screenshot of the full 100/100 benchmark, including P95 and sample count.
- [ ] Screenshot of 20/20 conflict test with both winners matching.
- [ ] JSON report and CSV sample export from your own browser.
- [ ] Include the browser, OS, focus/background conditions and date of measurement.
- [ ] `npm test` log and optional `python tests/browser_v21.py` output.
