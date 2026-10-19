# V2 verification report

## Verified by automated tests (Node 22, TypeScript compiler)

Run `npm test` in the root folder. The checked V2 test suite includes:

1. Real engine-to-engine propagation of all three settings, concurrent different-key edits, convergence and persistence/reopen.
2. Larger logical counter winning.
3. Deterministic actor-ID tie-breaking on equal counters.
4. Receipt-order-independent ordering.
5. Strict allowed-value validation.
6. Rejection of corrupted register data and invalid stamps.
7. Independent zero-version defaults.
8. Deterministic sandbox convergence in both message orders.
9. Peer presence discovery, ping acknowledgment, remote-update counting and clean disconnect.

**Results at V2 packaging checkpoint: 9/9 passing.** This suite uses real `SyncEngine` and Node's native asynchronous BroadcastChannel with minimal browser API stand-ins. It tests code behavior, not visual rendering or browser timing.

## Inspected statically

- HTML has unique IDs and all `data-i18n` keys have an English translation entry.
- The app uses no third-party hosted fonts, images or scripts.
- The run package includes TypeScript sources and already-compiled `dist/` JavaScript.

## NOT verified here

- Real Chromium/Edge/Firefox UI operation in a normal browser profile: the testing environment blocks local browser navigation. The browser test is included but was not successfully run in this environment.
- The brief's real-time synchronization goal of **under 100 ms**: no qualifying multi-tab benchmark was run here.
- Accessibility conformance by an automated accessibility scanner or manual assistive-technology audit.
- Real-world mobile browser layout beyond static responsive CSS inspection.

## Recommended test on the user's machine

```powershell
npm start
# In another terminal:
python tests/browser_e2e.py
```

Then repeat manually in two visible tabs and two backgrounded tabs, and capture your own sample of actual update times. Document browser version, operating system, visibility state, sample count, observed average/percentiles and worst case. Do not claim guaranteed 100 ms behavior unless the evidence warrants it.
