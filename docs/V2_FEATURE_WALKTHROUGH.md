# How to explain SyncSphere V2 to someone else

## Start with the problem, not the tools

Imagine changing dark mode in one tab while a second tab stays open. Usually you have to reload the second tab to get the latest saved preference. SyncSphere changes the second tab automatically. The hard part is not sending a message; it is avoiding lost changes if both tabs edit settings around the same time.

## V2's four memorable demonstrations

**1. The tabs appear on a constellation.** Open the page twice. The network map draws a new peer circle and a connection line. Each tab periodically announces, “I'm still here.” On exit, it says goodbye; if the message is missed, the peer eventually times out.

**2. The app displays a compact state fingerprint.** Every tab calculates an 8-character signature from the actual settings. Compare the fingerprint and alignment status after an edit. This is a lightweight checksum, not encryption or formal proof of consistency. A briefly different signature is normal until messages arrive.

**3. The ping chart measures something real.** Press Ping open tabs. The current tab sends a ping and waits for a reply. We record the elapsed time with a monotonic clock. This is round-trip message time, not one-way synchronization latency. Only use a real multi-tab benchmark to assess the challenge's 100 ms target.

**4. The conflict lab tests both message arrival orders.** Pretend A writes dark and B writes light, both at logical revision 7. The actor ID is the tie-breaker. Because tab-B sorts after tab-A, light wins regardless of which message arrives first. The lab uses the *same comparator* as the actual engine and does not touch saved preferences.

## File-by-file explanation for an interview

1. `register.ts` holds the TypeScript types and the small function that decides which stamped version wins.
2. `storage.ts` reads the local browser notebook safely.
3. `sync-engine.ts` is the coordinator: it sends updates, merges incoming records, tracks peers and answers pings.
4. `fingerprint.ts` turns the three settings into a short, deterministic signature.
5. `conflict-lab.ts` runs two isolated merge experiments.
6. `main.ts` connects controls to the engine and updates the visuals. The UI does not decide who wins conflicts.
7. `i18n.ts` stores the translation dictionaries; CSS handles responsive design and themes.

## Common questions and good answers

**Why not just localStorage?** It persists, but BroadcastChannel gives a direct message path and avoids having to wait for periodic reads. `storage` events and periodic checks are fallbacks.

**Why not timestamps?** Wall clocks can change or be offset. A Lamport-style counter gives an ordering based on observed revisions, and actor IDs break ties consistently.

**Why one register per setting?** So changing font size does not overwrite a language change made by another tab. Merging an entire settings JSON object would create unnecessary conflicts.

**Why a heartbeat?** Browser tabs can be closed or suspended. A heartbeat lets the network map show tabs recently heard from without requiring a server.

**What does the checksum prove?** Only that the *last reported user-facing preference values* appear equal with high probability for this tiny demo. It is not cryptographically collision-resistant, and stale reports can temporarily disagree.

**Can it sync between phones?** Not as implemented. Browser storage and BroadcastChannel work in compatible tabs of the same browser origin and storage partition, not across devices.

**What does an RTT below 100 ms mean?** One ping-and-pong completed in under 100 ms. The actual challenge measures settings synchronization latency, so RTT should never be reported as proof of meeting that target.

**Why not use React?** We deliberately used standard TypeScript and browser APIs, so the key synchronization logic is obvious and the project can run with zero frontend runtime dependencies.

## How to structure a live demo

Open two tabs side by side. Show a network node appearing. Change appearance, language, and font size in different tabs. Run one ping, run the isolated conflict experiment, then close and reopen both tabs to prove persistence. Explain how each visible result maps to a small source file. Refer to `DEMO_SCRIPT.md` for timing.
