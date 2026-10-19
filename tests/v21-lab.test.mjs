import test from 'node:test';
import assert from 'node:assert/strict';
import { LabNetwork, describe } from '../dist/core/lab-network.js';
import { csvReport, convergence } from '../dist/core/reports.js';
import { blankRegisters } from '../dist/core/register.js';
import { revisionFingerprint } from '../dist/core/fingerprint.js';

test('percentile uses nearest rank; empty samples stay null', () => {
  const summary = describe([30,10,20,40,50]);
  assert.deepEqual(summary, { count: 5, average: 30, median: 30, p95: 50, maximum: 50 });
  assert.equal(describe([]).p95, null);
});

test('100 updates are genuinely delivered and ACKed by a second BroadcastChannel instance', async () => {
  const a = new LabNetwork('lab-suite-a');
  const b = new LabNetwork('lab-suite-b');
  try {
    assert.equal(a.available, true);
    const result = await a.benchmark('lab-suite-b', 100);
    assert.equal(result.samples.length, 100);
    assert.equal(result.samples.filter(s => s.passed).length, 100);
    assert.equal(result.deliveryStats.count, 100);
    assert.equal(result.rttStats.count, 100);
    assert.equal(result.achievedUnder100ms <= 100, true);
    assert.equal(result.samples.every(s => s.acknowledgementMs >= 0), true);
    assert.match(csvReport(result, null), /"benchmark"/);
  } finally { a.dispose(); b.dispose(); }
});

test('20 real simultaneous logical conflicts converge using independent registers', async () => {
  const a = new LabNetwork('stress-a');
  const b = new LabNetwork('stress-b');
  try {
    const result = await a.stressTest('stress-b', 20);
    assert.equal(result.trials.length, 20);
    assert.equal(result.converged, 20);
    assert.equal(result.trials.every(t => t.localWinner === 'stress-b' && t.remoteWinner === 'stress-b'), true);
  } finally { a.dispose(); b.dispose(); }
});

test('convergence checks revision stamps, not just user-facing preference values', () => {
  const original = blankRegisters();
  const changed = structuredClone(original);
  changed.theme.stamp = { counter: 1, actor: 'actor-a' };
  const snapshot = {
    records: original,
    revisionFingerprint: revisionFingerprint(original),
    peers: [{ id: 'other', lastSeen: Date.now(), fingerprint: 'same-values',
      revision: revisionFingerprint(changed), records: changed }],
  };
  const assessment = convergence(snapshot);
  assert.equal(assessment.state, 'diverged');
  assert.match(assessment.detail, /theme/);
  snapshot.peers[0].revision = revisionFingerprint(original);
  snapshot.peers[0].records = original;
  assert.equal(convergence(snapshot).state, 'converged');
});
