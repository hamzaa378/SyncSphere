# V2.3 source audit: confirmed changes, uncertainty and tradeoffs

This is a maintenance upgrade from V2.2, not a rewrite. SyncSphere stores three preferences as independent last-writer-wins registers, uses BroadcastChannel for fast same-origin messaging, localStorage for persistence/fallback and periodic state reports for recovery. No schema migration, backend, account or new runtime dependency.

## Confirmed issues in the previous V2.2 data/code

1. **One-way timing was not a safe primary pass criterion.** The V2.2 JSON had 53/100 samples with reported approximate delivery greater than measured round-trip timing (threshold >0.05 ms). Although same-machine wall-clock/timer origin combinations often agree, scheduling and resolution make it unsafe for strict ordering comparisons. **Change:** V2.3 UI uses source-tab monotonic `performance.now()` ACK RTT for average/median/P95/max and the ≤100ms counter. One-way estimates remain optional diagnostic data, with an anomaly count. ACKed samples no longer fail only because the one-way estimate is absent.
2. **Retry recovery timing was ambiguous.** `ackRttMs` in V2.2 included the delay waiting for *earlier failed attempts*, while the field looked like a single-attempt RTT. **Change:** `ackRttMs` is now the final successful attempt's duration, `totalElapsedMs` includes all waits and retries, and `attemptDurationsMs` lists each attempt. Exported CSV includes all three.
3. **Lab reply attribution required strengthening.** A reply of the right type/sequence could reach the wrong pending waiter when multiple actors participate. **Change:** the benchmark/stress pending waiter must match the selected sender. The robustness ACK must also match the expected fault mode.
4. **Remote stress-register lifetime was unnecessarily long.** The remote side retained completed trial records in its maps. **Change:** completed remote trials are released immediately; disposal also clears all lab registers.
5. **Historical exports lacked an independent, simple validator.** **Change:** stdlib Python `scripts/verify_evidence.py` checks CSV/JSON agreement, sample counts, per-run stats, retry details and failures for schema 1.0, 2.0 and 2.1.
6. **Convergence could report a peer with stale presence information as current.** **Change:** a full-state report older than 5 seconds yields `waiting` until a fresh peer heartbeat, without claiming permanent disagreement.

## Methodology precision

- **ACK RTT:** monotonic at source tab; performance is representative of a single device, one browser profile and selected peer. It includes the return message; it is **not** a direct test of persistent preference write + DOM paint.
- **One-way estimate:** cross-context sum of `performance.timeOrigin + performance.now`. Record for curiosity and debugging only; timestamp origin and timer precision can produce apparent contradictions.
- **Conflict resolution:** Lamport `(counter, actor ID)` total order, not a guarantee of the most recent physical click. Tie tests use isolated test registers and one fixed actor pair per run.
- **Recovery:** eventual repair via validated peer revisions/storage. `localStorage` is not a cross-tab compare-and-swap transaction; simultaneous storage writes have a race window. BroadcastChannel and subsequent anti-entropy generally repair the state but the demo does not provide durable distributed consensus.
- **Fault injection:** deliberately corrupts *only lab traffic*. It does not test a malicious extension or other software mutating localStorage and does not imply production preference broadcasts have retransmission guarantees.
- **Presence:** best-effort (9-second expiry) rather than a perfect measure of which tabs are alive. An inactive or background-throttled tab may be marked missing.
- **Storage disabled:** live synchronization can still work through BroadcastChannel, but preferences cannot be promised after closing all tabs.

## Areas for future work, intentionally NOT claimed as solved

Atomic multi-setting transactions; deterministic physically-last-click ordering; durability under storage quota/browser privacy policies; malicious-message hardening between same-origin scripts; real background throttling guarantees; multi-device synchronization; formal CRDT verification; measuring visual repaint latency. These would require stronger designs and more involved browser experiments beyond GDG Frontend Task 1.

## Test inventory

- `npm test`: 23 native Node unit/integration tests including real BroadcastChannel instances, stress, retries, and new timing/attribution regressions.
- `python scripts/verify_evidence.py`: passes on the user-provided 120-row V2.1 and 144-row V2.2 browser reports preserved under `evidence/`.
- `python tests/browser_v23.py`: runnable real Chromium acceptance script to be executed on an ordinary local machine. This execution environment returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` when Chromium navigated localhost, so the browser test cannot honestly be marked as passed here.
