# Technical design and conflict resolution

## Project scope

Matches **GDG Tech Wildcard Frontend Task 1**, pages 3–4: TypeScript, three settings, real-time same-browser cross-tab propagation (100 ms target), persistence, flash-free initialization, deterministic conflict resolution.

## Record format

Every preference is a last-writer-wins register:

```json
{
  "value": "dark",
  "stamp": {
    "counter": 12,
    "actor": "e483e21a"
  }
}
```

Records are stored separately under `syncsphere:prefs:v1:<key>`. `actor` is a per-tab random identifier. `counter` is a per-tab Lamport counter: it grows beyond every revision the tab has already seen. Incoming revisions advance the local clock.

Compare records by the tuple `(counter, actor)`. Higher tuple wins. The comparator gives an absolute total ordering with no clock synchronization requirement.

## A local setting change

`SyncEngine.set(key, value)` first merges the latest saved state. It then advances its Lamport counter, creates a new register, updates the UI, attempts to write that register to localStorage, and publishes an `UPDATE` event on the BroadcastChannel. Updates to a currently unchanged value are no-ops.

## A remote change

`SyncEngine.accept(key, candidate, source)`:

- Verifies the entry has a supported key, supported value, and valid stamp.
- If the incoming stamp is **greater** than the current stamp, adopts it, persists the winner, and notifies subscribers.
- If it is **less**, ignores it. When it came from `storage`, reasserts the local winner on disk.
- If the stamps are equal, does nothing (idempotent duplicate delivery).

Two different preference keys merge independently. Broadcast messages use `HELLO`, `SNAPSHOT`, and `UPDATE` messages. Newly opened tabs send `HELLO` and existing tabs answer with their current snapshot, covering races during startup.

## Persistence race and healing

`localStorage` operations are atomic one key at a time but the **read-then-write sequence is not a transaction** across tabs. So the engine:

1. Reads the saved register before a write.
2. Avoids overwriting an already-known stronger register.
3. Reasserts a stronger local register if it later sees a weaker `storage` write.
4. Also rechecks saved state on focus, visibility and a 2-second visible-tab interval.

This leads to eventual convergence while communicating tabs continue running. It is **not** a distributed transactional database: fully crashed or indefinitely suspended tabs, lost last messages, or externally cleared storage have practical limits.

## Theme initialization

In `index.html`, a synchronous inline script reads the validated saved theme and font size before the browser downloads CSS. On first rendering, `data-theme=dark` selects dark variables immediately. TypeScript then initializes the full state and language translations.

## Latency measurement

Each `UPDATE` contains `sentAt: Date.now()`. A receiving tab records `Date.now() - sentAt` if it is nonnegative and sane. The monitor shows the last timing and the mean of recent samples. Since both tabs run on the same device, it is a useful approximation. It is not a monotonic, hardware-grade latency measurement; clock adjustments, scheduling and inactive-tab throttling affect results. Do not report a 100 ms guarantee without a proper multi-tab benchmark on the target browser and machine.

## Fallbacks and privacy

The app depends on standard browser APIs only. If BroadcastChannel is absent, `storage` events still notify other tabs. If localStorage is blocked, the interface warns that persistence is unavailable. Only browser-local preferences are saved. No user data is sent to a server.

## Code responsibilities

| File | Single responsibility |
| --- | --- |
| `src/core/register.ts` | Types, defaults, stamp comparison, validation |
| `src/core/storage.ts` | Reading browser storage safely |
| `src/core/sync-engine.ts` | Updates, handshake, convergence, repair and logs |
| `src/i18n.ts` | English, Spanish, French and Hindi dictionaries |
| `src/main.ts` | UI controls, rendering, export/import, user messages |
| `index.html` | Accessible markup and early bootstrap |
| `assets/styles.css` | Responsive visual design and themes |
| `tests/*.test.mjs` | Logical winner tests and multi-engine integration |
| `tests/browser_e2e.py` | Two-tab browser validation (optional) |

## Discussion of limitations

- Different browser profiles, devices or partitions cannot share localStorage or BroadcastChannel.
- Multi-field imports are three register operations, not a single atomic transaction.
- The chosen semantics are deterministic revision priority, not literal wall-clock last click.
- Remote storage events may arrive ahead of BroadcastChannel updates, which is fine: older/equal revisions are ignored.
- The reset action creates new versioned default values instead of deleting keys, preserving conflict ordering.
- Clearing browser site data resets preferences, as expected.

## Security and validation

- Incoming broadcast and storage records are parsed and type/range checked.
- Font-size bounds are 14–22 integer pixels; theme and language are restricted to known values.
- Import is size-limited and validated before any setting changes.
- Activity rows use `textContent`, never `innerHTML` from incoming messages.
- No remote scripts, fonts, or images are needed.

## V2 extension (new)

V2 retains the entire V1 register format and merge ordering. These additional message types operate alongside `UPDATE`, `HELLO` and `SNAPSHOT`:

- `PRESENCE` — heartbeat, normally once per 2.5 seconds, optionally including an 8-digit local preference fingerprint. Peers are considered inactive after about 9 seconds without a new signal.
- `GOODBYE` — best-effort signal on normal page navigation/unload. This cannot fire reliably after crashes, hence the heartbeat timeout.
- `PING` / `PONG` — request ID and reply used to measure local browser messaging round-trip time. The requesting tab starts the clock with `performance.now()`; it reads the same monotonic clock when a reply arrives.

`src/core/fingerprint.ts` computes a stable noncryptographic FNV-1a-style 32-bit checksum of `theme|language|fontSize`. It does not hash Lamport stamps because those can differ while the user-facing preferences match. A peer's **last reported** checksum is compared against the local checksum; this is a visualization aid, not a consensus protocol, cryptographic proof, or immediate consistency guarantee.

`src/core/conflict-lab.ts` imports the **same** `compareStamp()` implementation used by the real engine. It is intentionally deterministic and isolated. The proposals both have stamp counter `7`; `tab-B` sorts above `tab-A` and wins regardless of arrival order. It never writes browser storage.

### Important limitation: peer and network measurements

The constellation shows recently observed V2-compatible tabs. Suspended background tabs may not send heartbeats on schedule. If an older V1 tab is open, it can exchange setting updates but cannot participate fully in V2 peer heartbeat/fingerprint reporting. The displayed RTT is not one-way change propagation; a below-100-ms RTT does not, on its own, prove the task's below-100-ms sync goal.

### V2 code ownership

| File | V2 responsibility |
| --- | --- |
| `src/core/fingerprint.ts` | Canonical, lightweight preference fingerprint |
| `src/core/conflict-lab.ts` | Safe isolated deterministic merge lab |
| `src/core/sync-engine.ts` | New peer presence tracking, PING/PONG, counters and fingerprints |
| `src/main.ts` | Network graph SVG, RTT bar chart, conflict visualizer, preset buttons and activity filtering |
| `tests/v2-features.test.mjs` | Presence, ping, disconnect and sandbox tests |

UI strings for technical logs, measurement status and sandbox step details are currently in English. This is documented in the README rather than presented as fully localized.
