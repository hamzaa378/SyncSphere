import test from 'node:test';
import assert from 'node:assert/strict';
import { BroadcastChannel } from 'node:worker_threads';
import { LabNetwork } from '../dist/core/lab-network.js';
import { RobustnessLab } from '../dist/core/robustness-lab.js';
import { csvReport } from '../dist/core/reports.js';

const CHANNEL = 'syncsphere:changes:v1';

test('benchmark ACK must come from selected peer; approximate delivery may be absent', async () => {
  const source = new LabNetwork('origin-v23');
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    const m = event.data;
    if (m?.type !== 'LAB_BENCH_UPDATE' || m.to !== 'peer-v23') return;
    channel.postMessage({type:'LAB_BENCH_ACK', sender:'spoofed-other-peer', to:'origin-v23',
      id:m.id, sequence:m.sequence, accepted:true, deliveryMs:0});
    channel.postMessage({type:'LAB_BENCH_ACK', sender:'peer-v23', to:'origin-v23',
      id:m.id, sequence:m.sequence, accepted:true, deliveryMs:null});
  };
  try {
    const result = await source.benchmark('peer-v23', 4);
    assert.equal(result.samples.filter(s=>s.passed).length,4);
    assert.equal(result.rttStats.count,4);
    assert.equal(result.deliveryStats.count,0);
    assert.equal(result.achievedUnder100ms,4);
    assert.equal(result.oneWayExceedsRtt,0);
  } finally { source.dispose(); channel.close(); }
});

test('fanout distinguishes successful retry RTT from end-to-end recovery', async () => {
  const a = new RobustnessLab('a-v23');
  const b = new RobustnessLab('b-v23');
  try {
    const result = await a.fanout(['b-v23'], 'drop-first', 2);
    assert.equal(result.recovered, 2);
    for (const sample of result.samples) {
      assert.equal(sample.attempts,2);
      assert.ok(sample.totalElapsedMs >= 145);
      assert.ok(sample.totalElapsedMs > sample.ackRttMs + 100);
      assert.equal(sample.attemptDurationsMs.length,2);
      assert.ok(Math.abs(sample.attemptDurationsMs[1] - sample.ackRttMs) <= 0.001);
    }
    const csv = csvReport(null,null,result);
    assert.match(csv, /total_elapsed_ms/);
    assert.match(csv, /attempt_durations_ms/);
  } finally { a.dispose(); b.dispose(); }
});

test('empty ACKs do not fabricate success for a closed peer', async () => {
  const a = new RobustnessLab('sender-no-peer-v23');
  try {
    const result = await a.fanout(['closed-peer-v23'],'drop-first',1);
    assert.equal(result.failed,1);
    assert.equal(result.samples[0].ackRttMs,null);
    assert.equal(result.samples[0].attemptDurationsMs.length,2);
    assert.ok(result.samples[0].totalElapsedMs >= 300);
  } finally {a.dispose();}
});
