# V2.2 Architecture and recovery rationale

## 1. Core invariant

For each preference key `k`, the local register is `R[k]={value,stamp:{counter,actor}}` where `counter` is a nonnegative safe integer. Merge takes the register with lexicographically greater `(counter,actor)`. Because this is a total order, merge is commutative, associative and idempotent (assuming equal stamps are never reused with different values). Three independent keys avoid accidental unrelated-field overwrites.

**Not guaranteed:** transactions over multiple preferences, semantic reconciliation, cryptographic authenticity, or strict real-time global order.

## 2. Transport and persistence

`SyncEngine` publishes user changes via `BroadcastChannel` (`syncsphere:changes:v1`). It writes the winning per-key register to `localStorage` (`syncsphere:prefs:v1:theme`, `language`, `fontSize`) and observes storage events. `index.html` loads saved theme/font before main CSS for flash-free initialization. Focus/pageshow/visibility recovery reads storage. Every 2.5 seconds, active tabs publish presence including stamped registers. Peers absent for 9 seconds are removed from the **discovered** set (absence does not prove tab closed).

Every incoming register is validated by `parseRegister`. Malformed or out-of-range preferences are ignored. `receive` now accepts only known production message types before updating presence metadata; `LAB_*` and `ROBUST_*` traffic cannot make phantom production peers.

## 3. Anti-entropy and targeted repair

`reconcilePeer(peerId,registers)` runs when a valid peer advertises full registers in HELLO/PRESENCE:

1. For each key, parse the remote register using the same production validators.
2. If remote stamp wins, merge and persist it; record a repaired register and explanation.
3. If local stamp wins, send a full directed SNAPSHOT back, at most once per peer per 1200 ms.
4. A targeted SNAPSHOT is ignored by any tab whose `tabId` doesn't match `to`.
5. Accepted new stamps are advertised in the existing presence mechanism.

This improves recovery from missed messages; there is no network or background server, and no guarantee the browser will wake suspended tabs immediately. Repair counters describe observations and accepted merges, not guaranteed global consensus.

## 4. Lab separation

`LabNetwork` handles `LAB_*` messages on the same browser channel and uses disposable in-memory registers for 100-update and 20-conflict experiments. `RobustnessLab` handles `ROBUST_*` addressed test messages, records IDs, attempts, status and acknowledged RTT, and can inject first-attempt loss or a delayed ACK. It never modifies user preferences, invokes `SyncEngine.set()`, or writes to localStorage.

`ROBUST_UPDATE` protocol fields: `type`, `sender`, `to`, `run`, `sequence`, `attempt`, `fault`, `value`. Its response `ROBUST_ACK` contains `sender`, `to`, `run`, `sequence`, `attempt`. ACK handling checks *run + peer + sequence + attempt*, ensuring stray replies from another target or a prior trial cannot satisfy the wrong pending request. The peer receiver validates the test message before responding. Pending timeouts are cleared on receipt and disposal; delayed callbacks are bounded to the session and canceled on disposal.

Retries are limited to **2 attempts** and failure never silently becomes success. The fan-out is sequential, per target and sequence, to make source and measurement causality easy to explain; it is **not a throughput/burst benchmark**. Injected processing delay is a deliberate test fault, not a real browser pathology. Targeted updates are not persistent after tab restart.

## 5. Measurement model

Existing 100-update baseline: estimated one-way delivery via `performance.timeOrigin + performance.now()` subtraction on one device, ACK RTT on the initiating tab with `performance.now()`. Percentile is nearest rank over passing samples; failures are counted separately. This should not be treated as a high-precision synchronized network clock.

V2.2 fan-out: sender-side `performance.now()` from initial send to final ACK, including retry waits and artificial delays. `rttStats` is ACK completion time, **not** one-way message latency and not the challenge's ordinary <100 ms preference update result. `normal`, `drop-first`, `delay-150` and `mixed` are separate measured modes and should not be pooled.

## 6. Security and failure trade-offs

All same-origin tabs are assumed to be benign. This is not an authenticated inter-process protocol and a malicious page sharing the origin could impersonate a tab. Browser storage can be disabled, cleared or corrupted. A crashed/unresponsive tab may miss events until reload. Storage read/write is not an atomic compare-and-swap; deterministic reassertion and anti-entropy are best-effort eventual recovery. Frontend uses `textContent` for descriptions rather than injecting untrusted HTML. Import JSON size and preference values are validated.

Avoid presenting this as a cross-device CRDT database; it is a small last-writer-wins, per-field replicated register with logical clocks, suitable for this frontend challenge.

## 7. Compatibility

V2.2 leaves original v1 storage and channel identifiers unchanged and adds additive protocol types and UI. Upgrading by extracting a new ZIP preserves saved preferences on the same origin; do not clear storage to migrate. Run all tabs on the same release during experiments.
