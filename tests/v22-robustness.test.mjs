import test from 'node:test';
import assert from 'node:assert/strict';
import { RobustnessLab, faultFor } from '../dist/core/robustness-lab.js';
import { csvReport } from '../dist/core/reports.js';

test('failure scenarios are deterministic and independently classified', () => {
  assert.equal(faultFor('mixed', 1), 'drop-first');
  assert.equal(faultFor('mixed', 2), 'delay-150');
  assert.equal(faultFor('normal', 1), 'normal');
});

test('fanout delivers to two real BroadcastChannel peers and exports CSV evidence', async () => {
  const coordinator = new RobustnessLab('sender-v22');
  const a = new RobustnessLab('v22-peer-1');
  const b = new RobustnessLab('v22-peer-2');
  try {
    const result = await coordinator.fanout(['v22-peer-1','v22-peer-2'], 'normal', 5);
    assert.equal(result.successful, 10);
    assert.equal(result.failed, 0);
    assert.equal(result.recovered, 0);
    assert.equal(result.samples.length, 10);
    assert.match(csvReport(null, null, result), /"fanout"/);
  } finally { coordinator.dispose(); a.dispose(); b.dispose(); }
});

test('deliberately dropped first attempts are recovered and recorded, not hidden', async () => {
  const coordinator = new RobustnessLab('retry-origin');
  const peer = new RobustnessLab('retry-target');
  try {
    const result = await coordinator.fanout(['retry-target'], 'drop-first', 4);
    assert.equal(result.successful, 4);
    assert.equal(result.recovered, 4);
    assert.equal(result.samples.every(s => s.attempts === 2), true);
  } finally { coordinator.dispose(); peer.dispose(); }
});

test('150 ms receiver delay changes measured RTT, not the preference store', async () => {
  const coordinator = new RobustnessLab('delay-origin');
  const peer = new RobustnessLab('delay-target');
  try {
    const result = await coordinator.fanout(['delay-target'], 'delay-150', 2);
    assert.equal(result.successful, 2);
    assert.equal(result.samples.every(s => s.ackRttMs >= 140), true);
    assert.equal(result.recovered, 0);
  } finally { coordinator.dispose(); peer.dispose(); }
});

test('closed peer yields explicitly failed samples rather than false successes', async () => {
  const coordinator = new RobustnessLab('offline-origin');
  try {
    const result = await coordinator.fanout(['peer-is-offline'], 'drop-first', 1);
    assert.equal(result.failed, 1);
    assert.equal(result.successful, 0);
    assert.equal(result.samples[0].reason, 'No ACK after retries');
  } finally { coordinator.dispose(); }
});
