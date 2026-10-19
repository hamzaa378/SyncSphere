import test from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine } from '../dist/core/sync-engine.js';
import { KEYS, STORAGE_PREFIX, compareStamp } from '../dist/core/register.js';

// Minimal browser-platform stand-ins. These test the REAL SyncEngine logic,
// not a rewritten simulation of the algorithm. Native Node BroadcastChannel
// carries messages asynchronously between the two engine instances.
const windowTarget = new EventTarget();
const documentTarget = new EventTarget();
documentTarget.hidden = false;
class SharedStorage {
  #map = new Map();
  getItem(key) { return this.#map.get(key) ?? null; }
  setItem(key, value) {
    const newValue = String(value);
    this.#map.set(key, newValue);
    const event = new Event('storage');
    Object.assign(event, { key, newValue, storageArea: this });
    // All test instances see the event, even the writer. Real browsers omit
    // self-events, but it cannot change the result: equal stamps are ignored.
    windowTarget.dispatchEvent(event);
  }
  removeItem(key) {
    this.#map.delete(key);
    const event = new Event('storage');
    Object.assign(event, { key, newValue: null, storageArea: this });
    windowTarget.dispatchEvent(event);
  }
  clear() { this.#map.clear(); }
}
globalThis.window = windowTarget;
window.setInterval = setInterval;
globalThis.document = documentTarget;
globalThis.localStorage = new SharedStorage();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, reason) {
  for (let i = 0; i < 80; i++) {
    if (check()) return;
    await delay(20);
  }
  throw new Error(reason);
}

test('multi-tab changes, independent keys, conflict convergence, and persisted reopen', async () => {
  const a = new SyncEngine();
  const b = new SyncEngine();
  try {
    a.set('theme', 'dark');
    await until(() => b.snapshot().preferences.theme === 'dark', 'theme did not propagate');
    b.set('language', 'fr');
    await until(() => a.snapshot().preferences.language === 'fr', 'language did not propagate');
    a.set('fontSize', 20);
    await until(() => b.snapshot().preferences.fontSize === 20, 'font size did not propagate');
    await until(() => b.snapshot().latencyMs.length >= 1, 'incoming BroadcastChannel latency not logged');

    // Separate edits in the same tick both survive (one storage key per preference).
    a.set('theme', 'light');
    b.set('fontSize', 18);
    await until(() => b.snapshot().preferences.theme === 'light', 'theme parallel edit lost');
    await until(() => a.snapshot().preferences.fontSize === 18, 'font size parallel edit lost');

    // Two simultaneous revisions of the same setting must settle on a single winner.
    // They may have different counters depending on events already processed.
    a.set('language', 'hi');
    b.set('language', 'es');
    await until(() => a.snapshot().preferences.language === b.snapshot().preferences.language,
      'concurrent same-key changes did not converge');
    await delay(60);
    const x = a.snapshot().records.language, y = b.snapshot().records.language;
    assert.deepEqual(x, y);
    assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'language')), x);

    const c = new SyncEngine();
    try {
      assert.deepEqual(c.snapshot().preferences, a.snapshot().preferences, 'new tab did not restore latest saved state');
      b.reset();
      await until(() => KEYS.every(key => c.snapshot().preferences[key] === ({theme:'light',language:'en',fontSize:16})[key]), 'reset did not propagate');
      a.importPreferences({ theme: 'dark', language: 'hi', fontSize: 21 });
      await until(() => c.snapshot().preferences.fontSize === 21 && c.snapshot().preferences.language === 'hi', 'import did not propagate');
      assert.equal(c.snapshot().preferences.theme, 'dark');
      assert.equal(c.snapshot().persistent, true);
    } finally { c.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});
