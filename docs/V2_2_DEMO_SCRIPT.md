# GDG presentation script — SyncSphere V2.2 (approximately 4 minutes)

**Before recording:** Open 3 V2.2 browser tabs side-by-side. Keep their storage origin the same. In one tab, open the Reliability lab. Run the baseline tests once, save real results. Do not quote old V2.1 numbers as current V2.2 observations.

**00:00–00:40 — Why it matters.** "Most settings UIs save preferences in one tab. SyncSphere makes those preferences shared, persistent and explainable. It has no backend and uses simple TypeScript and built-in browser APIs." Change dark mode on Tab A; watch Tabs B and C update. Change font size on Tab B; show updates in A and C.

**00:40–01:20 — The core algorithm.** "Every setting is independently stored as a value and Lamport version. All tabs choose the larger counter; if counters match, the larger tab ID wins. That gives the same winner regardless of message arrival order." Show the real revision panel; optionally run the educational conflict playground.

**01:20–02:00 — Measured performance.** "The existing benchmark issues 100 isolated, sequential updates and requires a real acknowledgment for each. We report average, median, P95 and max for approximate delivery, plus ACK RTT. Results are measured, never filled in with demo numbers." Run it and show the actual result. Run 20 two-tab collisions.

**02:00–03:00 — What makes V2.2 different.** "We added multi-peer reliability experiments. Instead of merely announcing synchronization is fast, we can deliberately drop the first test message to each tab, retry it, and record recovery, attempt count, and per-peer failures." Select `drop-first`, run all detected peers. Check recovered count. Note fault-injected RTT must not be compared with ordinary latency.

**03:00–03:35 — Recovery.** "Visible peers exchange versioned snapshots. If a tab is behind, SyncSphere can adopt a newer register or request a directed snapshot, while keeping the original user values isolated from test traffic." Show recovery journal, peer age, and **Verify and reconcile now**; explain that zero repairs is expected if consistent.

**03:35–04:00 — Submission proof.** Export JSON + CSV. Explain the raw sample rows and how the evidence distinguishes normal measurements from artificial fault injection. Mention limitations: same origin, same profile, not cross-device.

**Best Q&A answer:** "We used a per-field last-writer-wins register because this task needs deterministic, understandable browser-only convergence. A production multi-device setting service might require authenticated clients, a server and stronger conflict semantics, but those would be unnecessary complexity for this specification."
