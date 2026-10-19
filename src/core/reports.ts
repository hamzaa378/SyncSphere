import type { BenchmarkResult, StressResult } from './lab-network.js';
import type { Snapshot } from './sync-engine.js';
import type { PreferenceKey } from './register.js';
export type ConvergenceEvent = { at: string; state: string; detail: string; peers: number };
export type Convergence = { state: 'alone' | 'waiting' | 'converged' | 'diverged'; detail: string; disagreement: string[] };
/** Compare entire register versions, not just displayed values. */
export function convergence(snapshot: Snapshot): Convergence {
  if (!snapshot.peers.length) return { state: 'alone', detail: 'Open another tab to monitor consistency.', disagreement: [] };
  const unreported = snapshot.peers.filter(p => !p.revision || !p.records);
  if (unreported.length) return { state: 'waiting', detail: `${unreported.length} peer(s) have not reported their full state yet.`, disagreement: [] };
  const difference: string[] = [];
  for (const peer of snapshot.peers) {
    const keys: PreferenceKey[] = ['theme', 'language', 'fontSize'];
    const wrong = keys.filter(key => {
      const left = snapshot.records[key]; const right = peer.records?.[key];
      return !right || right.value !== left.value || right.stamp.counter !== left.stamp.counter || right.stamp.actor !== left.stamp.actor;
    });
    if (wrong.length || peer.revision !== snapshot.revisionFingerprint) difference.push(`${peer.id.slice(0, 8)}: ${wrong.length ? wrong.join(', ') : 'revision fingerprint differs'}`);
  }
  if (difference.length) return { state: 'diverged', detail: `Temporary disagreement in ${difference.length} tab(s): ${difference.join('; ')}. Anti-entropy will check storage.`, disagreement: difference };
  return { state: 'converged', detail: `All ${snapshot.peers.length + 1} reported full preference registers match.`, disagreement: [] };
}
export function makeReport(snapshot: Snapshot, history: ConvergenceEvent[], benchmark: BenchmarkResult | null, stress: StressResult | null) {
  const view = convergence(snapshot);
  return {
    schema: 'syncsphere-lab-report/1.0', application: 'SyncSphere v2.1', exportedAt: new Date().toISOString(),
    context: { userAgent: navigator.userAgent, activePeerCount: snapshot.peers.length,
      transport: snapshot.transport, persistent: snapshot.persistent, tabId: snapshot.tabId },
    methodology: {
      benchmark: '100 isolated consecutive versioned register updates between two real tabs, each confirmed by an acknowledgment over the production BroadcastChannel. Does not modify actual preferences.',
      delivery: 'Approximate one-way event-loop delivery: receiver(performance.timeOrigin + performance.now) minus sender equivalent. Same device/time origin; not guaranteed network-grade synchronization timing.',
      rtt: 'Source tab performance.now elapsed until acknowledgment was received; includes reply handling.',
      p95: 'Nearest-rank 95th percentile of successful samples; failures and timeouts reported separately.',
      stress: 'Independent equal-counter conflicting proposals created in two real tabs before observing one another; both apply the same Lamport counter/tab ID comparator. Isolated from saved preferences.',
      caveats: 'Visible/background throttling, device scheduling, multiple peers, and browser security restrictions affect results. Report only represents the machine and session in which it was collected.',
    },
    diagnostics: { sentUpdates: snapshot.sentUpdates, receivedUpdates: snapshot.receivedUpdates,
      lastPreferenceDeliveryApproxMs: snapshot.latencyMs.at(-1) ?? null,
      pingRttMs: snapshot.roundTripsMs, conflictsObservedByMainEngine: snapshot.conflictCount },
    convergence: { ...view, fingerprint: snapshot.localFingerprint,
      revisionFingerprint: snapshot.revisionFingerprint, history }, benchmark, stress,
  };
}
export function csvReport(benchmark: BenchmarkResult | null, stress: StressResult | null): string {
  const headings = ['test','run_id','trial','target_peer','delivery_ms','ack_rtt_ms','success','local_winner','remote_winner','expected_winner','reason'];
  const rows: unknown[][] = [headings];
  if (benchmark) for (const s of benchmark.samples)
    rows.push(['benchmark', benchmark.id, s.sequence, s.peer, s.deliveryMs ?? '', s.acknowledgementMs ?? '', s.passed, '', '', '', s.reason]);
  if (stress) for (const t of stress.trials)
    rows.push(['conflict', stress.id, t.sequence, stress.targetPeer, '', t.elapsedMs, t.converged,
      t.localWinner, t.remoteWinner ?? '', t.expectedWinner, t.reason]);
  return rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
