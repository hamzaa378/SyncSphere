# Explaining SyncSphere to anyone

## The challenge in one sentence

Imagine you have the same settings page open in three browser tabs. When you turn on dark mode in one tab, all three tabs should switch immediately and remember the setting tomorrow.

## Three simple browser tools solve it

**1. localStorage = the notebook.**

The browser keeps the most recent accepted value on your computer. When you close and reopen the website, it reads the notebook back. Each setting uses its own key:

- `syncsphere:prefs:v1:theme`
- `syncsphere:prefs:v1:language`
- `syncsphere:prefs:v1:fontSize`

**2. BroadcastChannel = the walkie-talkie.**

Every tab joins the same channel. When a user changes something, that tab tells all the others: "The font size has changed to 20." Other tabs listen and update without reloading.

**3. Logical counter + tab ID = the referee.**

Sometimes two tabs change the same setting together. A version number answers which version is newer. If both versions have the same number, the tab ID gives a deterministic winner. All tabs follow the same rule.

## The five steps after the user clicks

1. A `change` or `input` event fires in `src/main.ts`.
2. `SyncEngine.set()` assigns a new revision to the changed setting.
3. `saveWinner()` writes it to localStorage.
4. `BroadcastChannel.postMessage()` informs other tabs.
5. The other tabs compare versions and accept the winning value. The view re-renders automatically.

The code that picks a winner is only a few lines:

```ts
function compareStamp(a, b) {
  if (a.counter !== b.counter) return a.counter > b.counter ? 1 : -1;
  return a.actor === b.actor ? 0 : a.actor > b.actor ? 1 : -1;
}
```

That's the entire tie-break strategy: larger counter first, then larger tab ID.

## Why are there three storage keys, rather than one settings object?

Imagine tab A changes dark mode while tab B changes font size at the same instant. If both rewrite the *whole* settings object, whichever writes last may erase the other's change. By storing **one versioned record per preference**, the edits do not clash.

## Why is there a script in the HTML `<head>`?

When you reopen the app, a page would normally appear in light mode for a moment and then switch to dark once TypeScript starts. The tiny head script reads the saved theme **before the CSS is applied**, preventing that flash.

## Why are there both BroadcastChannel and storage events?

BroadcastChannel is the fast path. Storage events help keep the tabs in agreement even if broadcast messaging isn't available. The engine also checks the saved state when a tab becomes visible or focused again.

## Why is this different from just copying a YouTube tutorial?

This app adds:

- A visible **revision for every setting** rather than unversioned updates.
- A real **deterministic tie-break** for two writers.
- **Self-healing** after a stale storage write.
- A **live activity/latency monitor** so an evaluator can observe what happened.
- Four actually translated interfaces, import/export, and automated tests.

## Interview answer in 30 seconds

> "I used plain TypeScript so the logic is easy to understand. I store preferences in localStorage and send updates to other tabs through BroadcastChannel. Every preference has a logical version and a tab identifier. On a conflict, all tabs run the same comparison and accept the winning version. I also added a storage-event fallback, an early theme initializer, and a sync monitor so we can demonstrate the behavior and measure it."

## Questions an evaluator may ask

**Q: What if I refresh the page?** The values reload from localStorage.

**Q: What if BroadcastChannel isn't available?** Browser storage events can propagate the changes; latency may differ.

**Q: Why not use only localStorage?** Storage events are useful, but BroadcastChannel is intended for lightweight direct cross-tab communication. It also enables a HELLO/SNAPSHOT handshake.

**Q: What if both tabs change dark mode together?** The larger logical counter wins. If the counters tie, the larger tab ID wins.

**Q: Why not compare actual timestamps?** Clock-based ordering can depend on timestamp granularity and wall-clock changes. The logical counter plus unique tab ID is deterministic.

**Q: Is it always under 100 ms?** It's a target, not a guarantee. Background-tab scheduling and device load can add latency. We show observed timings instead of promising impossible guarantees.

**Q: Is this internet/cloud synchronization?** No. The challenge asks for tabs in one browser. No server is needed for that.
