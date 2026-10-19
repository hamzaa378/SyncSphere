# Changelog

This project preserves a chronological feature and test history. Refer to `docs/` for the original version-specific handover notes.

## V2.3 — Audited release (19 October 2026)

- ACK round-trip timing is the primary protocol measurement; cross-tab one-way estimates remain diagnostic-only.
- Fan-out reports separate final successful-attempt RTT from total recovery time.
- Peer and test-context verification strengthened, stale peers handled more explicitly and completed lab trial records cleaned up.
- Added JSON/CSV evidence validator, regression tests, full Chromium testing instructions and reproducibility runbook.
- Final GitHub release package adds canonical README, Windows/macOS setup instructions, GitHub upload steps, CI unit-test workflow and provenance-aware browser test results.
- Reported Windows Playwright acceptance: 100 updates, 20 conflicts, all four fan-out modes, three tabs, persistence, 144 export rows. Original raw V2.3 export files not supplied.

## V2.2 — Reliability and recovery

- Added multi-peer fan-out, test-only dropped/delayed messages, retries, repair journal, peer snapshots and per-peer acknowledgments.

## V2.1 — Benchmarks and observability

- Added 100 sequential test-register updates, 20 two-tab logical conflicts, full stamped-state comparisons, JSON/CSV evidence export.

## V2 — Sync observatory

- Added peer constellation, ping measurements, conflict playground, presets and preference fingerprints.

## V1 — Required challenge implementation

- Added theme, language and font-size synchronization using TypeScript, BroadcastChannel, persistence and deterministic Lamport-style register ordering.
