# SyncSphere V2 — The Sync Observatory

**GDG Tech Wildcard Entry · Frontend Task 1 · TypeScript**

SyncSphere is a local-first settings application that **synchronizes preferences across browser tabs**. V2 turns the specification into an observable experiment: you can see open tabs appear, watch preferences propagate, measure ping round trips, and explore conflict resolution without changing real settings.

No React, backend, cloud database, login, accounts, analytics or external image/font libraries. Only TypeScript, HTML, CSS, localStorage and BroadcastChannel.

> **Important:** Real-time target from the challenge is **under 100 ms** for synchronization. This is a target, not a measured V2 guarantee. Automated logic tests pass; true browser performance needs the browser test and representative measurements on your own machine.

## 1. Quick start (Windows, macOS, Linux)

Requirements: Node.js 18 or newer; a recent Chromium, Edge, Firefox or other browser supporting modern web APIs.

This ZIP includes the compiled `dist/` files, so you can run it immediately after extraction:

```powershell
cd GDG_SyncSphere_Frontend_Task1_V2
npm start
```

Visit **http://localhost:5173**. Do not double-click `index.html`; use `npm start` so scripts run under a normal browser origin.

To work on the TypeScript source (requires the TypeScript dev dependency):

```powershell
npm install
npm run build
npm run dev
```

Run automated tests:

```powershell
npm test
```

Run browser tests with the server running in a separate terminal:

```powershell
python -m pip install playwright
python -m playwright install chromium
python tests/browser_e2e.py
```

The `python` and Playwright commands are only needed for the optional real-browser end-to-end suite. See `docs/TEST_REPORT_V2.md` for what has actually been verified.

## 2. What you can demonstrate

| Feature | Why it matters | How to try |
| --- | --- | --- |
| Dark mode, language, text size | Required preferences | Change a control |
| Instant cross-tab updates | Required fast synchronization | Open 2 tabs, edit in either |
| Persistence + early theme bootstrap | Required reopen behavior and no theme flash | Close/reopen all tabs |
| Deterministic conflict resolution | Required eventual convergence | Read revisions or run sandbox |
| **Live network constellation** | Visualizes who is connected | Open/close tabs |
| **Convergence fingerprint** | Compares peers' last reported preference values | Check matching signatures after edits |
| **Ping diagnostics chart** | Captures real same-browser message RTT | Click **Ping open tabs** |
| **Isolated conflict playground** | Shows both message orders converging | Click **Run collision experiment** |
| Three presets | Practical user-facing productivity | Try Deep focus / Calm / Easy reading |
| Activity filters | Makes remote events explainable | Filter changes or conflicts |
| Import/export/reset | Useful control over preferences | Use Your toolkit |
| Responsive layouts | Small-screen usability | Resize browser |

### Scope and compatibility

Tabs must share a compatible **origin, browser profile and storage partition**. This is not cross-device account synchronization. V2 continues using V1 storage keys (`syncsphere:prefs:v1:*`), so your V1 preferences are preserved on the same origin. V1 and V2 messaging is only partially interoperable; the live V2 presence/RTT features require V2 in both tabs.

## 3. How synchronization works, simply

**Think of three things:**

1. **localStorage is the notebook.** The last accepted version of each preference is written there. It survives closing the tab.
2. **BroadcastChannel is the walkie-talkie.** A tab announces a change and other tabs update immediately without refreshing.
3. **A version counter plus tab ID is the referee.** Each setting has a `(counter, actor)` stamp. Higher counter wins. If counters tie, the larger actor ID wins. Order of arrival cannot change the final winner.

Each preference is stored as its **own record**. If one tab edits the language and another edits font size, they will not overwrite each other's fields.

```
Tab A                          Browser origin                     Tab B
  | Change dark mode               |                                 |
  | -> write localStorage -------->|                                 |
  | -> BroadcastChannel UPDATE ------------------------------------->|
  |                                |      validate, compare version  |
  |<---------------------------------------- peer may reply to PING -|
  |                                |                                 |
```

The bootstrap script in `index.html` reads saved theme and font size **before CSS**. This avoids flashing the wrong theme when a tab opens.

## 4. V2 features that make the project different

### A. Live network constellation

Tabs announce their presence through a small heartbeat. The interface draws a circle for this tab, circles for recently seen peers and connections between them. Peer disappearance is signaled on clean close; a 9-second inactivity threshold handles missing goodbye messages. Background throttling can make presence stale; it is **a live estimate, not an exact census**.

Code: `src/core/sync-engine.ts` (`HELLO`, `PRESENCE`, `GOODBYE`) and `renderGraph()` in `src/main.ts`.

### B. Convergence microscope

Each tab computes a **short 32-bit fingerprint** from the same canonical sequence: theme, language, font size. It reports its current fingerprint with presence messages. If a peer's last reported fingerprint matches this tab's, the UI reports agreement. Brief differences can appear while updates are in flight; waiting for the next presence message allows the display to settle.

This is **not cryptographic integrity checking** or proof of global agreement. It is a lightweight demonstration that the last reported values appear aligned; hash collisions and delayed messages are possible.

Code: `src/core/fingerprint.ts` and peer presence state.

### C. Timing diagnostics

`Ping open tabs` sends a ping and measures the time to receive a pong using `performance.now()`. This is **round-trip time** (RTT), not one-way synchronization latency. Actual incoming `UPDATE` messages carry a timestamp for an approximate one-way delivery observation. Both measurements may be affected by background throttling. No benchmark is invented or prefilled.

Code: `SyncEngine.pingPeers()` and `renderBars()`.

### D. Conflict playground

The sandbox proposes **counter 7, actor tab-A, value dark** and **counter 7, actor tab-B, value light**. It merges both proposals in A→B and B→A delivery order using the same `compareStamp()` function as the live engine. **Both paths end with tab-B's light value.** It does not alter localStorage or your actual preferences.

Code: `src/core/conflict-lab.ts`. For a true same-key live conflict, use two tabs and make edits close together; the winning revision is shown in the real revision panel.

## 5. Files and responsibilities

```text
GDG_SyncSphere_Frontend_Task1_V2/
├── index.html                  Semantic page, pre-CSS preference bootstrap
├── assets/styles.css           Responsive layout, light/dark visual system
├── src/
│   ├── main.ts                 UI wiring, visualization, presets, sandbox UI
│   ├── i18n.ts                 English/Spanish/French/Hindi translations
│   └── core/
│       ├── register.ts         Typed settings, validation, version comparator
│       ├── storage.ts          Safe localStorage reads and availability
│       ├── sync-engine.ts      Cross-tab transport, merge, presence and ping
│       ├── conflict-lab.ts     Deterministic isolated merge example
│       └── fingerprint.ts      Stable, noncryptographic settings checksum
├── dist/                       Compiled JS shipped for easy running
├── scripts/dev-server.mjs      Lightweight static server
├── tests/                      Node unit/integration + optional browser test
└── docs/
    ├── EXPLAIN_LIKE_IM_FIVE.md Beginner-friendly logic and terminology
    ├── TECHNICAL_DESIGN.md     Protocol, correctness assumptions and limits
    ├── V2_FEATURE_WALKTHROUGH.md Presentation & explanation of new features
    ├── TEST_REPORT_V2.md       Recorded evidence and limitations
    ├── DEMO_SCRIPT.md          3-minute presentation walkthrough
    └── GITHUB_SUBMISSION_CHECKLIST.md
```

## 6. Challenges and responsible claims

- **Within-100-ms sync:** test on multiple visible/background tabs, browsers, and machines. The chart shows RTT and cannot by itself establish challenge compliance.
- **Persistence:** disabled if browser localStorage is blocked. The UI shows unavailable state.
- **Equal-version collisions:** order is deterministic, but it uses logical priority, **not** the physically latest click time.
- **Multi-field presets/import:** each field is independently synchronized; a set of three changes is **not atomic** across tabs.
- **Language:** core navigation, preferences and main V2 headings are localized in four languages; some technical details, logs, graph messages and sandbox results remain English.
- **Security:** all incoming records are validated, the JSON import has a size limit, and log/simulation strings are inserted via `textContent` rather than raw HTML.
- **No network dependency at runtime:** the small local HTTP server only serves static files. Preferences never reach that server.

## 7. Evaluation submission

Submit the complete source and README as a GitHub repository, with a short explanation of the sync and conflict strategy and a deployment/demo link if available. The required criteria come from GDG Tech Wildcard Frontend Task 1 (brief pages 3–4). See `docs/GITHUB_SUBMISSION_CHECKLIST.md`.

Suggested single-sentence pitch:

> SyncSphere is a browser-based observatory that makes distributed-state synchronization visible: not just synced settings, but how tabs discover peers, check agreement and resolve conflicts.

---

## V2.1 — Reliability Test Bench (new)

**Keep both browser tabs on V2.1.** The existing V2 settings format and `BroadcastChannel` name remain unchanged, but the new test messages require V2.1 in both tabs.

Navigate to **Reliability lab** in the left navigation. From one tab, select the other tab and run:

- **100-update benchmark**: isolated real-tab updates with ACKs; average, median, nearest-rank P95, and maximum approximate delivery time, plus actual ACK RTTs in JSON.
- **20-collision stress test**: simultaneous logical versions generated in separate real tabs; the winning actor is checked in both.
- **Revision-aware convergence monitor**: compares all preference values *and* counters/actor stamps, showing divergence reasons and recovery events.
- **Export JSON / CSV**: your machine's raw observations and methodology for a GitHub submission.

**Nothing in the lab overwrites your saved preferences.** Benchmarks exercise the same BroadcastChannel name and conflict ordering used by the app, but use **isolated in-memory test registers**. They are not a benchmark of localStorage writes or cross-device synchronization.

For the complete explanation, test methodology, files, caveats, and evaluator demo, read [`docs/V2_1_RELIABILITY_LAB.md`](docs/V2_1_RELIABILITY_LAB.md). For verification scope, read [`docs/TEST_REPORT_V2_1.md`](docs/TEST_REPORT_V2_1.md).

```powershell
npm start
# Open two browser tabs on http://localhost:5173

# In a different terminal:
npm test

# Optional, after installing Playwright and browser:
python -m pip install playwright
python -m playwright install chromium
python tests/browser_v21.py
```
