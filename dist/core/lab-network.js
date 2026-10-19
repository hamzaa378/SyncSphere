import { CHANNEL_NAME, compareStamp } from "./register.js";
const clock = () => performance.timeOrigin + performance.now();
const runId = () => `lab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const makeKey = (id, seq, response) => `${id}/${seq}/${response}`;
function apply(current, candidate) {
    return !current || compareStamp(candidate.stamp, current.stamp) > 0 ? candidate : current;
}
export function describe(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const count = sorted.length;
    if (!count)
        return { count: 0, average: null, median: null, p95: null, maximum: null };
    const rounded = (n) => Math.round(n * 1000) / 1000;
    const mid = Math.floor(count / 2);
    return { count, average: rounded(sorted.reduce((total, n) => total + n, 0) / count),
        median: rounded(count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
        p95: rounded(sorted[Math.ceil(count * .95) - 1]), maximum: rounded(sorted[count - 1]) };
}
export class LabNetwork {
    tabId;
    channel = null;
    pending = new Map();
    register = new Map();
    stress = new Map();
    active = false;
    cancelled = false;
    constructor(tabId) {
        this.tabId = tabId;
        try {
            if (typeof BroadcastChannel !== "undefined") {
                this.channel = new BroadcastChannel(CHANNEL_NAME);
                this.channel.onmessage = event => this.onMessage(event.data);
            }
        }
        catch { /* Supported only when BroadcastChannel is available. */ }
    }
    get available() { return this.channel !== null; }
    get running() { return this.active; }
    cancel() { this.cancelled = true; }
    dispose() {
        this.cancel();
        this.channel?.close();
        for (const p of this.pending.values()) {
            clearTimeout(p.timeout);
            p.reject(new Error("Lab closed"));
        }
        this.pending.clear();
    }
    send(message) { this.channel?.postMessage(message); }
    awaitMessage(id, seq, type, ms = 2500) {
        const key = makeKey(id, seq, type);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(key);
                reject(new Error(`${type} timed out after ${ms} ms`));
            }, ms);
            this.pending.set(key, { resolve, reject, timeout });
        });
    }
    onMessage(raw) {
        if (!raw || typeof raw !== "object")
            return;
        const msg = raw;
        if (typeof msg.type !== "string" || !msg.type.startsWith("LAB_")
            || msg.to !== this.tabId || typeof msg.sender !== "string" || msg.sender === this.tabId
            || typeof msg.id !== "string" || !/^lab-\d+-[a-z0-9]+$/.test(msg.id)
            || !Number.isInteger(msg.sequence) || (msg.sequence ?? -1) < 0)
            return;
        const message = msg;
        const waitKey = makeKey(message.id, message.sequence, message.type);
        const pending = this.pending.get(waitKey);
        if (pending) {
            this.pending.delete(waitKey);
            clearTimeout(pending.timeout);
            pending.resolve(message);
        }
        if (message.type === "LAB_BENCH_UPDATE" && typeof message.value === "number" && message.stamp) {
            const measured = typeof message.sentAt === "number" ? clock() - message.sentAt : NaN;
            const key = `bench/${message.id}`;
            const candidate = { value: message.value, stamp: message.stamp };
            const next = apply(this.register.get(key), candidate);
            this.register.set(key, next);
            const accepted = compareStamp(next.stamp, candidate.stamp) === 0 && next.value === candidate.value;
            this.send({ type: "LAB_BENCH_ACK", sender: this.tabId, to: message.sender,
                id: message.id, sequence: message.sequence, accepted,
                deliveryMs: measured >= 0 && Number.isFinite(measured) ? measured : null });
            return;
        }
        if (message.type === "LAB_STRESS_PREPARE" && typeof message.value === "number" && message.stamp) {
            const key = `stress/${message.id}/${message.sequence}`;
            const local = { value: message.value, stamp: { counter: message.stamp.counter, actor: this.tabId } };
            this.stress.set(key, { local, coordinator: message.sender, fired: false });
            this.send({ type: "LAB_STRESS_READY", sender: this.tabId, to: message.sender,
                id: message.id, sequence: message.sequence });
            return;
        }
        if (message.type === "LAB_STRESS_FIRE") {
            const key = `stress/${message.id}/${message.sequence}`;
            const entry = this.stress.get(key);
            if (!entry || entry.fired || entry.coordinator !== message.sender)
                return;
            entry.fired = true;
            // Proposal is committed locally BEFORE any opposing proposal is applied.
            this.register.set(key, entry.local);
            this.send({ type: "LAB_STRESS_CANDIDATE", sender: this.tabId, to: message.sender,
                id: message.id, sequence: message.sequence, value: entry.local.value, stamp: entry.local.stamp });
            return;
        }
        if (message.type === "LAB_STRESS_CANDIDATE" && typeof message.value === "number" && message.stamp) {
            const key = `stress/${message.id}/${message.sequence}`;
            const entry = this.stress.get(key);
            if (!entry || !entry.fired || message.stamp.counter !== entry.local.stamp.counter)
                return;
            const candidate = { value: message.value, stamp: message.stamp };
            const next = apply(this.register.get(key), candidate);
            this.register.set(key, next);
            this.send({ type: "LAB_STRESS_REPORT", sender: this.tabId, to: message.sender,
                id: message.id, sequence: message.sequence, winner: next.stamp.actor });
        }
    }
    async benchmark(peer, count = 100, progress = () => { }) {
        if (!this.channel || this.active || peer === this.tabId)
            throw new Error("Choose another online tab; BroadcastChannel is required.");
        this.active = true;
        this.cancelled = false;
        const id = runId(), startedAt = new Date().toISOString();
        const samples = [];
        try {
            for (let sequence = 1; sequence <= count; sequence++) {
                if (this.cancelled)
                    break;
                const stamp = { counter: sequence, actor: this.tabId };
                const value = sequence % 2 ? 14 : 15;
                const start = performance.now();
                // Register is an isolated test value, not the user's fontSize preference.
                this.register.set(`bench/${id}`, apply(this.register.get(`bench/${id}`), { value, stamp }));
                const pending = this.awaitMessage(id, sequence, "LAB_BENCH_ACK", 2500);
                this.send({ type: "LAB_BENCH_UPDATE", sender: this.tabId, to: peer, id, sequence, value,
                    stamp, sentAt: clock() });
                try {
                    const ack = await pending;
                    const rtt = performance.now() - start;
                    const delivered = typeof ack.deliveryMs === "number" && Number.isFinite(ack.deliveryMs)
                        ? Math.round(ack.deliveryMs * 1000) / 1000 : null;
                    const passed = ack.sender === peer && ack.accepted === true && delivered !== null;
                    samples.push({ sequence, peer, deliveryMs: delivered,
                        acknowledgementMs: Math.round(rtt * 1000) / 1000,
                        passed, reason: passed ? "Applied by peer" : "Invalid or rejected acknowledgment" });
                }
                catch (error) {
                    samples.push({ sequence, peer, deliveryMs: null, acknowledgementMs: null,
                        passed: false, reason: error instanceof Error ? error.message : "Unknown timeout" });
                    // Stop after a missing response. A disconnected tab shouldn't consume ~4 minutes.
                    progress(samples.length);
                    break;
                }
                progress(samples.length);
                // Yield to rendering and allow a second tab's event loop to work.
                if (sequence % 10 === 0)
                    await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        finally {
            this.active = false;
            this.register.delete(`bench/${id}`);
        }
        const passing = samples.filter(s => s.passed);
        return { id, startedAt, finishedAt: new Date().toISOString(), targetPeer: peer,
            requested: count, samples,
            deliveryStats: describe(passing.flatMap(s => s.deliveryMs === null ? [] : [s.deliveryMs])),
            rttStats: describe(passing.flatMap(s => s.acknowledgementMs === null ? [] : [s.acknowledgementMs])),
            achievedUnder100ms: passing.filter(s => s.deliveryMs !== null && s.deliveryMs <= 100).length };
    }
    async stressTest(peer, count = 20, progress = () => { }) {
        if (!this.channel || this.active || peer === this.tabId)
            throw new Error("Choose another online tab; BroadcastChannel is required.");
        this.active = true;
        this.cancelled = false;
        const id = runId(), startedAt = new Date().toISOString();
        const trials = [];
        try {
            for (let sequence = 1; sequence <= count; sequence++) {
                if (this.cancelled)
                    break;
                const key = `stress/${id}/${sequence}`;
                const local = { value: sequence % 2 ? 14 : 15,
                    stamp: { counter: sequence, actor: this.tabId } };
                this.stress.set(key, { local, coordinator: this.tabId, fired: false });
                const expectedWinner = this.tabId > peer ? this.tabId : peer;
                const start = performance.now();
                let remoteWinner = null;
                let reason = "Verified in both tabs";
                try {
                    const readyPromise = this.awaitMessage(id, sequence, "LAB_STRESS_READY");
                    this.send({ type: "LAB_STRESS_PREPARE", sender: this.tabId, to: peer, id, sequence,
                        value: sequence % 2 ? 15 : 14, stamp: local.stamp });
                    const ready = await readyPromise;
                    if (ready.sender !== peer)
                        throw new Error("Unexpected READY sender");
                    const reportPromise = this.awaitMessage(id, sequence, "LAB_STRESS_REPORT");
                    const candidatePromise = this.awaitMessage(id, sequence, "LAB_STRESS_CANDIDATE");
                    this.stress.get(key).fired = true;
                    this.register.set(key, local);
                    this.send({ type: "LAB_STRESS_FIRE", sender: this.tabId, to: peer, id, sequence });
                    this.send({ type: "LAB_STRESS_CANDIDATE", sender: this.tabId, to: peer, id, sequence,
                        value: local.value, stamp: local.stamp });
                    const [candidate, report] = await Promise.all([candidatePromise, reportPromise]);
                    if (candidate.sender !== peer || !candidate.stamp || typeof candidate.value !== "number")
                        throw new Error("Invalid remote candidate");
                    this.register.set(key, apply(this.register.get(key), { value: candidate.value, stamp: candidate.stamp }));
                    remoteWinner = report.sender === peer ? report.winner ?? null : null;
                }
                catch (error) {
                    reason = error instanceof Error ? error.message : "Trial failed";
                }
                const localWinner = this.register.get(key)?.stamp.actor ?? "missing";
                const converged = localWinner === remoteWinner && localWinner === expectedWinner;
                trials.push({ sequence, localWinner, remoteWinner, expectedWinner, converged,
                    elapsedMs: Math.round((performance.now() - start) * 1000) / 1000, reason: converged ? reason : `Disagreement: ${reason}` });
                this.register.delete(key);
                this.stress.delete(key);
                progress(trials.length);
                if (!converged)
                    break; // don't conceal a failure inside further trials
                if (sequence % 5 === 0)
                    await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        finally {
            this.active = false;
        }
        return { id, startedAt, finishedAt: new Date().toISOString(), targetPeer: peer,
            requested: count, trials, converged: trials.filter(t => t.converged).length };
    }
}
