# SyncSphere V2 — ~3-minute demo script

**0:00–0:25 — What we built.** Explain the goal: browser preferences must remain consistent across tabs without refresh. Show the landing page and mention TypeScript, BroadcastChannel and localStorage.

**0:25–0:55 — Real synchronization.** Open a second tab. Show the new peer in the network constellation. Change dark mode on tab A and language on tab B, then move the font slider. Show that both tabs update immediately.

**0:55–1:15 — Persistence and clean start.** Close and reopen the tabs. Confirm that theme, font size and language were restored, and that no light-theme flash appeared. Mention the pre-CSS bootstrap.

**1:15–1:45 — Network diagnostics.** Open the second tab again, verify peer count and check the fingerprint status. Click Ping open tabs and show the first real RTT sample. State clearly that RTT is a round trip, not the 100 ms sync performance result.

**1:45–2:25 — Conflict lab.** Scroll to the playground. Show tab-A=dark, tab-B=light, both counter 7. Run the simulation. Point to A→B and B→A: both finish light, chosen by the stable actor-ID ordering. The real settings did not change.

**2:25–2:50 — Real code explanation.** Open `src/core/register.ts` and show `compareStamp()`. Then open `src/core/sync-engine.ts` and point to `set()`, `accept()` and `receive()`. The UI displays outcomes; the engine enforces correctness.

**2:50–3:00 — Close.** Mention testing, mobile layout, accessibility, JSON portability, browser-only privacy, limitations, and honest performance reporting.

### Suggested final line

“Rather than just building a settings page, we built a small observability tool that lets anyone watch state synchronization and deterministic conflict resolution happen.”
