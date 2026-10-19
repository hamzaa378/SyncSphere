import { CHANNEL_NAME } from './register.js';
import { describe } from './lab-network.js';
const token = () => `robust-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const keyFor = (run, peer, seq, attempt) => `${run}/${peer}/${seq}/${attempt}`;
export function faultFor(mode, sequence) {
    if (mode === 'mixed')
        return sequence % 2 ? 'drop-first' : 'delay-150';
    return mode;
}
export class RobustnessLab {
    tabId;
    channel = null;
    pending = new Map();
    seen = new Set();
    running = false;
    cancelled = false;
    closed = false;
    delayed = new Set();
    constructor(tabId) {
        this.tabId = tabId;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                this.channel = new BroadcastChannel(CHANNEL_NAME);
                this.channel.onmessage = event => this.onMessage(event.data);
            }
        }
        catch {
            this.channel = null;
        }
    }
    get available() { return this.channel !== null; }
    get busy() { return this.running; }
    cancel() { this.cancelled = true; }
    dispose() {
        this.closed = true;
        this.cancel();
        this.channel?.close();
        for (const item of this.pending.values()) {
            clearTimeout(item.timeout);
            item.resolve(false);
        }
        this.pending.clear();
        for (const timer of this.delayed)
            clearTimeout(timer);
        this.delayed.clear();
        this.seen.clear();
    }
    send(wire) { try {
        this.channel?.postMessage(wire);
    }
    catch { /* timeout is evidence */ } }
    onMessage(raw) {
        if (!raw || typeof raw !== 'object' || this.closed)
            return;
        const m = raw;
        if ((m.type !== 'ROBUST_UPDATE' && m.type !== 'ROBUST_ACK') || m.to !== this.tabId
            || typeof m.sender !== 'string' || m.sender === this.tabId || m.sender.length > 100
            || typeof m.run !== 'string' || !/^robust-\d+-[a-z0-9]+$/.test(m.run)
            || !Number.isInteger(m.sequence) || (m.sequence ?? -1) < 1 || (m.sequence ?? 0) > 1000
            || !Number.isInteger(m.attempt) || (m.attempt ?? -1) < 1 || (m.attempt ?? 0) > 3)
            return;
        const msg = m;
        if (msg.type === 'ROBUST_ACK') {
            const pendingKey = keyFor(msg.run, msg.sender, msg.sequence, msg.attempt);
            const item = this.pending.get(pendingKey);
            if (!item || item.peer !== msg.sender || item.fault !== msg.fault)
                return;
            clearTimeout(item.timeout);
            this.pending.delete(pendingKey);
            item.resolve(true);
            return;
        }
        if (typeof msg.value !== 'number' || !Number.isFinite(msg.value))
            return;
        if (!['normal', 'drop-first', 'delay-150', 'mixed'].includes(msg.fault))
            return;
        const sampleKey = `${msg.run}/${msg.sender}/${msg.sequence}`;
        // Limit memory for many repeated experiments; this is not persistent state.
        if (this.seen.size > 2000)
            this.seen.clear();
        const reply = () => this.send({ type: 'ROBUST_ACK', sender: this.tabId, to: msg.sender,
            run: msg.run, sequence: msg.sequence, attempt: msg.attempt, fault: msg.fault });
        // Duplicate test deliveries are idempotent and may be ACKed again.
        if (this.seen.has(sampleKey)) {
            reply();
            return;
        }
        if (msg.attempt === 1 && faultFor(msg.fault, msg.sequence) === 'drop-first')
            return;
        this.seen.add(sampleKey);
        if (faultFor(msg.fault, msg.sequence) === 'delay-150') {
            const timer = setTimeout(() => { this.delayed.delete(timer); if (!this.closed)
                reply(); }, 150);
            this.delayed.add(timer);
        }
        else
            reply();
    }
    wait(run, peer, seq, attempt, ms, fault) {
        const key = keyFor(run, peer, seq, attempt);
        return new Promise(resolve => {
            const timeout = setTimeout(() => { this.pending.delete(key); resolve(false); }, ms);
            this.pending.set(key, { peer, fault, resolve, timeout });
        });
    }
    /** All messages are addressed to real discovered tabs. Missing ACKs are failures, not hidden. */
    async fanout(peers, mode, perPeer = 12, progress = () => { }) {
        if (!this.channel || this.closed || this.running)
            throw new Error('Lab busy or BroadcastChannel unavailable.');
        const targets = [...new Set(peers)].filter(p => !!p && p !== this.tabId && p.length <= 100);
        if (!targets.length || targets.length > 8)
            throw new Error('Open 1–8 other tabs before testing.');
        if (!['normal', 'drop-first', 'delay-150', 'mixed'].includes(mode) || perPeer < 1 || perPeer > 100)
            throw new Error('Invalid test parameters.');
        this.running = true;
        this.cancelled = false;
        const run = token(), startedAt = new Date().toISOString();
        const samples = [];
        const maxAttempts = 2, timeoutMs = mode === 'drop-first' ? 160 : 600;
        try {
            for (let sequence = 1; sequence <= perPeer; sequence++) {
                for (const peer of targets) {
                    if (this.cancelled || this.closed)
                        break;
                    const start = performance.now();
                    let success = false, attempts = 0, ackRttMs = null;
                    const attemptDurationsMs = [];
                    for (let attempt = 1; attempt <= maxAttempts && !this.cancelled; attempt++) {
                        attempts = attempt;
                        const attemptStart = performance.now();
                        const received = this.wait(run, peer, sequence, attempt, timeoutMs, mode);
                        this.send({ type: 'ROBUST_UPDATE', sender: this.tabId, to: peer, run,
                            sequence, attempt, fault: mode, value: sequence });
                        const confirmed = await received;
                        const duration = Math.round((performance.now() - attemptStart) * 1000) / 1000;
                        attemptDurationsMs.push(duration);
                        if (confirmed) {
                            success = true;
                            ackRttMs = duration;
                            break;
                        }
                    }
                    samples.push({ sequence, peer, success, attempts, recovered: success && attempts > 1,
                        ackRttMs, totalElapsedMs: Math.round((performance.now() - start) * 1000) / 1000, attemptDurationsMs,
                        reason: success ? (attempts > 1 ? 'Recovered after retry' : 'ACK received') : 'No ACK after retries' });
                    progress(samples.length, targets.length * perPeer);
                }
                if (this.cancelled || this.closed)
                    break;
                if (sequence % 3 === 0)
                    await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        finally {
            this.running = false;
        }
        const successful = samples.filter(s => s.success);
        return { id: run, startedAt, finishedAt: new Date().toISOString(), mode,
            targetPeers: targets, requestedPerPeer: perPeer, attemptsAllowed: maxAttempts,
            samples, successful: successful.length, failed: targets.length * perPeer - successful.length,
            recovered: successful.filter(s => s.recovered).length,
            rttStats: describe(successful.flatMap(s => s.ackRttMs === null ? [] : [s.ackRttMs])),
            cancelled: this.cancelled, timeoutMs };
    }
}
