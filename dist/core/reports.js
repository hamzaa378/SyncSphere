/** Compare entire register versions, not just displayed values. */
export function convergence(snapshot) {
    if (!snapshot.peers.length)
        return { state: 'alone', detail: 'Open another tab to monitor consistency.', disagreement: [] };
    const unreported = snapshot.peers.filter(p => !p.revision || !p.records);
    if (unreported.length)
        return { state: 'waiting', detail: `${unreported.length} peer(s) have not reported their full state yet.`, disagreement: [] };
    const difference = [];
    for (const peer of snapshot.peers) {
        const keys = ['theme', 'language', 'fontSize'];
        const wrong = keys.filter(key => {
            const left = snapshot.records[key];
            const right = peer.records?.[key];
            return !right || right.value !== left.value || right.stamp.counter !== left.stamp.counter || right.stamp.actor !== left.stamp.actor;
        });
        if (wrong.length || peer.revision !== snapshot.revisionFingerprint)
            difference.push(`${peer.id.slice(0, 8)}: ${wrong.length ? wrong.join(', ') : 'revision fingerprint differs'}`);
    }
    if (difference.length)
        return { state: 'diverged', detail: `Temporary disagreement in ${difference.length} tab(s): ${difference.join('; ')}. Anti-entropy will check storage.`, disagreement: difference };
    return { state: 'converged', detail: `All ${snapshot.peers.length + 1} reported full preference registers match.`, disagreement: [] };
}
export function makeReport(snapshot, history, benchmark, stress, fanout = null) {
    const view = convergence(snapshot);
    return {
        schema: 'syncsphere-lab-report/2.0', application: 'SyncSphere v2.2', exportedAt: new Date().toISOString(),
        context: { userAgent: navigator.userAgent, activePeerCount: snapshot.peers.length,
            transport: snapshot.transport, persistent: snapshot.persistent, tabId: snapshot.tabId },
        methodology: {
            benchmark: '100 isolated consecutive versioned register updates between two real tabs, each confirmed by an acknowledgment over the production BroadcastChannel. Does not modify actual preferences.',
            delivery: 'Approximate one-way event-loop delivery: receiver(performance.timeOrigin + performance.now) minus sender equivalent. Same device/time origin; not guaranteed network-grade synchronization timing.',
            rtt: 'Source tab performance.now elapsed until acknowledgment was received; includes reply handling.',
            p95: 'Nearest-rank 95th percentile of successful samples; failures and timeouts reported separately.',
            stress: 'Independent equal-counter conflicting proposals created in two real tabs before observing one another; both apply the same Lamport counter/tab ID comparator. Isolated from saved preferences.',
            fanout: 'All selected live peers receive separate isolated test-register messages. First-attempt drops and delayed acknowledgments are injected on the receiving tab, not in production preference traffic. Every targeted message is counted; retries are recorded.',
            recovery: 'Production peer presence advertises complete stamped registers. Newer valid remote stamps are merged; lagging peers receive throttled directed snapshots. The recovery journal counts observations and repairs, not guaranteed durable consensus.',
            caveats: 'Visible/background throttling, device scheduling, multiple peers, and browser security restrictions affect results. Report only represents the machine and session in which it was collected. Fault-injected RTT includes intentional delay and retry timeout and must not be mixed into the normal 100ms performance benchmark.',
        },
        diagnostics: { sentUpdates: snapshot.sentUpdates, receivedUpdates: snapshot.receivedUpdates,
            lastPreferenceDeliveryApproxMs: snapshot.latencyMs.at(-1) ?? null,
            pingRttMs: snapshot.roundTripsMs, conflictsObservedByMainEngine: snapshot.conflictCount,
            repairChecks: snapshot.repairChecks, repairedRegisters: snapshot.repairedRegisters,
            repairSnapshotsSent: snapshot.repairSnapshotsSent, lastRecovery: snapshot.lastRecovery },
        convergence: { ...view, fingerprint: snapshot.localFingerprint,
            revisionFingerprint: snapshot.revisionFingerprint, history }, benchmark, stress, fanout,
    };
}
export function csvReport(benchmark, stress, fanout = null) {
    const headings = ['test', 'run_id', 'trial', 'target_peer', 'delivery_ms', 'ack_rtt_ms', 'success', 'local_winner', 'remote_winner', 'expected_winner', 'reason', 'attempts', 'recovered', 'fault_mode'];
    const rows = [headings];
    if (benchmark)
        for (const s of benchmark.samples)
            rows.push(['benchmark', benchmark.id, s.sequence, s.peer, s.deliveryMs ?? '', s.acknowledgementMs ?? '', s.passed, '', '', '', s.reason]);
    if (stress)
        for (const t of stress.trials)
            rows.push(['conflict', stress.id, t.sequence, stress.targetPeer, '', t.elapsedMs, t.converged,
                t.localWinner, t.remoteWinner ?? '', t.expectedWinner, t.reason]);
    if (fanout)
        for (const s of fanout.samples)
            rows.push(['fanout', fanout.id, s.sequence, s.peer, '', s.ackRttMs ?? '', s.success, '', '', '', s.reason, s.attempts, s.recovered, fanout.mode]);
    return rows.map(row => [...row, ...Array(Math.max(0, headings.length - row.length)).fill('')].map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
