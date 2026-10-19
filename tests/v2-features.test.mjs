import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateConflict } from '../dist/core/conflict-lab.js';
import { SyncEngine } from '../dist/core/sync-engine.js';

const browser = new EventTarget();
const page = new EventTarget();
page.hidden = false;
class MemoryStorage {
  #items = new Map();
  getItem(key) { return this.#items.get(key) ?? null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
}
globalThis.window = browser;
window.setInterval = setInterval;
globalThis.document = page;
globalThis.localStorage = new MemoryStorage();

async function waitFor(predicate, why) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw new Error(why);
}

test('safe sandbox converges for both opposite delivery orders', () => {
  const result = simulateConflict();
  assert.equal(result.converged, true);
  assert.deepEqual(result.winner.stamp, { counter: 7, actor: 'tab-B' });
  assert.equal(result.winner.value, 'light');
  assert.equal(result.forward.at(-1).value, 'light');
  assert.equal(result.backward.at(-1).value, 'light');
  assert.equal(result.forward[0].accepted, true);
  assert.equal(result.backward[1].accepted, false);
});

test('presence discovery, real ping responses, and clean disconnect', async () => {
  const a = new SyncEngine();
  const b = new SyncEngine();
  try {
    await waitFor(() => a.snapshot().peers.some(peer => peer.id === b.tabId), 'a did not see b');
    await waitFor(() => b.snapshot().peers.some(peer => peer.id === a.tabId), 'b did not see a');
    // Fingerprints describe last reported preference values, not version stamps.
    const known = a.snapshot().peers.find(peer => peer.id === b.tabId);
    assert.equal(known.fingerprint, b.snapshot().localFingerprint);
    assert.equal(a.pingPeers(), true);
    await waitFor(() => a.snapshot().roundTripsMs.length > 0, 'ping did not return');
    assert.ok(a.snapshot().roundTripsMs[0] >= 0);
    assert.equal(b.snapshot().sentUpdates, 0, 'ping should not count as setting changes');
    b.set('theme', 'dark');
    await waitFor(() => a.snapshot().receivedUpdates > 0, 'broadcast update not recorded');
    assert.equal(a.snapshot().preferences.theme, 'dark');
    b.dispose();
    await waitFor(() => a.snapshot().peers.length === 0, 'goodbye not received');
    assert.equal(a.pingPeers(), false, 'should not ping absent peers');
  } finally { a.dispose(); b.dispose(); }
});
