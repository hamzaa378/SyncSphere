# GitHub submission checklist

- [ ] Unzip and run `npm start` successfully on your own computer.
- [ ] Run `npm test` and retain output or attach a screenshot.
- [ ] Run `python tests/browser_e2e.py` with a local server already running.
- [ ] Open two normal browser tabs and verify live updates without refresh.
- [ ] Confirm storage persists after all tabs are closed.
- [ ] Show no incorrect initial theme flash when reopening dark mode.
- [ ] Measure actual settings-update latency in the intended browser and report test conditions; do not substitute ping RTT.
- [ ] Demonstrate tie-break conflict resolution in the lab and explain logical stamps.
- [ ] Show that the network graph, fingerprint and ping chart respond to real events.
- [ ] Review README, supported browser scope, architecture and limitations.
- [ ] Record a short screen capture of the V2 live demo.
- [ ] Push entire source (including TS and the included `dist/`) to a public GitHub repository.
- [ ] Optional: deploy the static site on a same-origin static host and include the link.

> The challenge's frontend submission requests source code, README, technical explanation of sync/conflicts, and deployment link if available. Keep the repository explanation and measured results accurate.
