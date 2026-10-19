# SyncSphere — concise GDG demo (about 3–4 minutes)

**Before recording:** start `npm start`, open three same-origin tabs in the same profile, and wait until both peers are detected. Test every button once. Avoid showing credentials or unrelated browser tabs.

**0:00–0:30 · The problem.** Explain that appearance, language and font size must update across tabs with no page refresh and survive a browser restart. Point to the three separate settings.

**0:30–1:05 · Real synchronization.** Change dark mode in Tab A, language in Tab B, font size in Tab C. Show the other tabs follow each change. Highlight the live peer constellation and stamped revisions.

**1:05–1:30 · Conflict handling.** Describe `{counter, actor}` and show the deterministic conflict lab. If two updates have the same logical counter, the actor ID breaks the tie; both sides reach the same winner.

**1:30–2:15 · Measurements.** Run the 100-update test; explain that figures are **acknowledgment RTT**, not one-way UI paint. Point out P95, max, and successful sample count. Mention raw JSON/CSV is exported.

**2:15–3:00 · Recovery.** Run Normal then Drop-first in the three-tab fan-out. Show every target acknowledged and recovered messages counted. Explain the artificial drop affects test registers only. Optionally show delayed mode, saying explicitly that its 150 ms delay is intentional.

**3:00–3:30 · Persistence and design.** Close and reopen a tab to demonstrate persisted settings and pre-paint theme. Open `src/core/register.ts`, `src/core/sync-engine.ts`, and `src/core/robustness-lab.ts` to show where comparison, replication and retries are implemented.

**Close:** “SyncSphere isn't just a settings form. It lets reviewers see synchronization, deterministic conflict resolution, failure recovery, and the limits of our measurements.”
