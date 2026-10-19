/** Compare entire register versions, not just displayed values. */
export function convergence(snapshot) {
    if (!snapshot.peers.length)
        return { state: 'alone', detail: 'Open another tab to monitor consistency.', disagreement: [] };
    const unreported = snapshot.peers.filter(p => !p.revision || !p.records || Date.now() - p.lastSeen > 5000);
    if (unreported.length)
        return { state: 'waiting', detail: `${unreported.length} peer(s) have no recent full-state report (wait for presence heartbeat).`, disagreement: [] };
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
        schema: 'syncsphere-lab-report/2.1', application: 'SyncSphere v2.3', exportedAt: new Date().toISOString(),
        context: { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency ?? null,
            documentVisibility: document.visibilityState, timeOrigin: performance.timeOrigin,
            activePeerCount: snapshot.peers.length,
            transport: snapshot.transport, persistent: snapshot.persistent, tabId: snapshot.tabId },
        methodology: {
            benchmark: '100 isolated sequential versioned register updates between two real tabs; successful samples require the selected peer ACK. PASS / 100 ms uses source-tab monotonic ACK round trip, not the approximate one-way measurement. Does not modify preferences.',
            delivery: 'DIAGNOSTIC ONLY: receiver(performance.timeOrigin + performance.now) minus sender equivalent can suffer cross-context origin rounding and sampling ambiguity. It can exceed RTT and MUST NOT be used for the 100 ms acceptance claim.',
            rtt: 'Primary benchmark: source tab monotonic performance.now elapsed until the selected peer acknowledges application of the isolated register. Includes both delivery and return processing; not a direct measurement of settings paint.',
            p95: 'Nearest-rank 95th percentile of successful samples; failures and timeouts reported separately.',
            stress: 'Independent equal-counter conflicting proposals created in two real tabs before observing one another; both apply the same Lamport counter/tab ID comparator. Isolated from saved preferences.',
            fanout: 'Isolated fault injection affects only ROBUST_* test traffic. Per-sample ackRttMs is the successful final attempt; totalElapsedMs includes all retry waits. Failed/unrun targets must be counted. Injected modes are separate from normal performance benchmarks.',
            recovery: 'Production peer presence advertises complete stamped registers. Newer valid remote stamps are merged; lagging peers receive throttled directed snapshots. The recovery journal counts observations and repairs, not guaranteed durable consensus.',
            caveats: 'Visible/background throttling, device scheduling, multiple peers, and browser security restrictions affect results. Report only represents the machine and session in which it was collected. Fault-injected RTT includes intentional delay and retry timeout and must not be mixed into the normal 100ms performance benchmark.',
        },
        diagnostics: { sentUpdates: snapshot.sentUpdates, receivedUpdates: snapshot.receivedUpdates,
            lastPreferenceDeliveryApproxMs: snapshot.latencyMs.at(-1) ?? null,
            pingRttMs: snapshot.roundTripsMs, conflictsObservedByMainEngine: snapshot.conflictCount,
            oneWayClockAnomalies: benchmark?.oneWayExceedsRtt ?? null,
            repairChecks: snapshot.repairChecks, repairedRegisters: snapshot.repairedRegisters,
            repairSnapshotsSent: snapshot.repairSnapshotsSent, lastRecovery: snapshot.lastRecovery },
        convergence: { ...view, fingerprint: snapshot.localFingerprint,
            revisionFingerprint: snapshot.revisionFingerprint, history }, benchmark, stress, fanout,
    };
}
export function csvReport(benchmark, stress, fanout = null) {
    const headings = ['test', 'run_id', 'trial', 'target_peer', 'delivery_ms_diagnostic_only', 'ack_rtt_ms', 'success', 'local_winner', 'remote_winner', 'expected_winner', 'reason', 'attempts', 'recovered', 'fault_mode', 'total_elapsed_ms', 'attempt_durations_ms'];
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
            rows.push(['fanout', fanout.id, s.sequence, s.peer, '', s.ackRttMs ?? '', s.success, '', '', '', s.reason, s.attempts, s.recovered, fanout.mode, s.totalElapsedMs, s.attemptDurationsMs.join('|')]);
    return rows.map(row => [...row, ...Array(Math.max(0, headings.length - row.length)).fill('')].map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
