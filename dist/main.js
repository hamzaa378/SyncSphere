import { SyncEngine } from "./core/sync-engine.js";
import { simulateConflict } from "./core/conflict-lab.js";
import { translateUI } from "./i18n.js";
import { LabNetwork } from "./core/lab-network.js";
import { convergence, makeReport, csvReport } from "./core/reports.js";
function el(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing required element: #${id}`);
    return node;
}
function setText(id, content) { el(id).textContent = content; }
const engine = new SyncEngine();
const lab = new LabNetwork(engine.tabId);
let benchmarkResult = null;
let stressResult = null;
const convergenceHistory = [];
let lastConvergence = null;
let peerSignature = '';
const themeToggle = el("theme-toggle");
const languageSelect = el("language-select");
const fontSlider = el("font-slider");
const activityList = el("activity-list");
let activeFilter = "all";
let latestSnapshot = engine.snapshot();
let toastTimer;
let graphSignature = "";
function toast(message) {
    const box = el("toast");
    box.textContent = message;
    box.classList.add("show");
    if (toastTimer !== undefined)
        clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => box.classList.remove("show"), 2800);
}
function renderActivity(events) {
    activityList.replaceChildren();
    const filtered = events.filter(event => activeFilter === "all" || event.kind === activeFilter);
    setText("event-counter", `${events.length} events`);
    if (!filtered.length) {
        const empty = document.createElement("li");
        empty.className = "event-empty";
        empty.textContent = "Nothing in this category yet. Change a setting or open a new tab.";
        activityList.append(empty);
        return;
    }
    for (const event of filtered.slice(0, 8)) {
        const li = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = `event-dot ${event.kind}`;
        dot.setAttribute("aria-hidden", "true");
        const description = document.createElement("span");
        description.className = "event-text";
        description.textContent = event.description;
        const time = document.createElement("time");
        time.className = "event-time";
        time.dateTime = new Date(event.time).toISOString();
        time.textContent = new Date(event.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        li.append(dot, description, time);
        activityList.append(li);
    }
}
// Draws a live map of peer presence, using ordinary SVG primitives.
// No external graph library, no account, and no network server required.
function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attrs))
        node.setAttribute(name, value);
    return node;
}
function renderGraph(snapshot) {
    const ids = snapshot.peers.map(peer => peer.id);
    const signature = ids.join("|") + "/" + snapshot.tabId;
    if (signature === graphSignature)
        return;
    graphSignature = signature;
    const container = el("peer-graph");
    container.replaceChildren();
    const ring = svg("circle", { cx: "210", cy: "133", r: "96", fill: "none", stroke: "#72a28a", "stroke-opacity": ".35", "stroke-dasharray": "3 7" });
    container.append(ring);
    container.append(svg("circle", { cx: "210", cy: "133", r: "118", fill: "none", stroke: "#72a28a", "stroke-opacity": ".17" }));
    const show = ids.slice(0, 6);
    const points = show.map((id, index) => {
        const angle = -Math.PI / 2 + 2 * Math.PI * index / Math.max(3, show.length);
        return { id, x: 210 + 113 * Math.cos(angle), y: 133 + 99 * Math.sin(angle) };
    });
    for (const point of points) {
        container.append(svg("line", { x1: "210", y1: "133", x2: String(point.x), y2: String(point.y), stroke: "#439e72", "stroke-opacity": ".7", "stroke-width": "2", "stroke-dasharray": "5 6" }));
    }
    for (const point of points) {
        container.append(svg("circle", { cx: String(point.x), cy: String(point.y), r: "22", fill: "#fff5e8", stroke: "#d7ad84", "stroke-width": "2" }));
        const short = svg("text", { x: String(point.x), y: String(point.y + 4), "text-anchor": "middle", "font-size": "10", "font-weight": "800", fill: "#865a35" });
        short.textContent = point.id.slice(0, 4);
        container.append(short);
    }
    container.append(svg("circle", { cx: "210", cy: "133", r: "40", fill: "#1f7b53", stroke: "#c9eed2", "stroke-width": "7" }));
    const self = svg("text", { x: "210", y: "130", "text-anchor": "middle", "font-size": "14", "font-weight": "900", fill: "white" });
    self.textContent = "YOU";
    const id = svg("text", { x: "210", y: "146", "text-anchor": "middle", "font-size": "9", fill: "#d5ffe4" });
    id.textContent = snapshot.tabId.slice(0, 6);
    container.append(self, id);
    if (ids.length > 6) {
        const more = svg("text", { x: "210", y: "250", "text-anchor": "middle", "font-size": "12", fill: "#517d68" });
        more.textContent = `+${ids.length - 6} more peers`;
        container.append(more);
    }
}
function renderBars(values) {
    const holder = el("rtt-bars");
    holder.replaceChildren();
    setText("rtt-sample-count", `${values.length} sample${values.length === 1 ? "" : "s"}`);
    if (!values.length) {
        const empty = document.createElement("div");
        empty.className = "bar-empty";
        empty.textContent = "Open two tabs and press Ping open tabs.";
        holder.append(empty);
        setText("max-rtt", "Awaiting measurements");
        return;
    }
    const peak = Math.max(5, ...values);
    for (const value of values.slice(-24)) {
        const bar = document.createElement("div");
        bar.className = "bar";
        bar.style.height = `${Math.max(5, Math.round(value / peak * 90))}px`;
        bar.title = `${value.toFixed(1)} milliseconds round-trip`;
        holder.append(bar);
    }
    setText("max-rtt", `Max ${Math.max(...values).toFixed(1)} ms`);
}
function render(snapshot) {
    latestSnapshot = snapshot;
    const { preferences, records } = snapshot;
    document.documentElement.dataset.theme = preferences.theme;
    document.documentElement.style.setProperty("--app-font-size", `${preferences.fontSize}px`);
    document.querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", preferences.theme === "dark" ? "#101c1c" : "#f6f5f1");
    translateUI(preferences.language);
    themeToggle.checked = preferences.theme === "dark";
    languageSelect.value = preferences.language;
    fontSlider.value = String(preferences.fontSize);
    fontSlider.setAttribute("aria-valuetext", `${preferences.fontSize} pixels`);
    setText("font-value", `${preferences.fontSize} px`);
    setText("tab-short", snapshot.tabId.slice(0, 6));
    setText("tab-count", String(1 + snapshot.peers.length));
    setText("received-count", String(snapshot.receivedUpdates));
    setText("sent-count", String(snapshot.sentUpdates));
    setText("received-diagnostic", String(snapshot.receivedUpdates));
    setText("network-status", snapshot.peers.length ? `${snapshot.peers.length} peer(s) visible` : "Only this tab so far");
    setText("state-fingerprint", snapshot.localFingerprint);
    const known = snapshot.peers.filter(peer => peer.fingerprint !== undefined);
    const mismatch = known.filter(peer => peer.fingerprint !== snapshot.localFingerprint);
    const state = snapshot.peers.length === 0 ? "Waiting for another tab" :
        mismatch.length ? `${mismatch.length} peer state(s) differ · settling` :
            known.length === snapshot.peers.length ? "✓ All reported states match" : "Waiting for peer state reports";
    setText("state-alignment", state);
    const alignment = convergence(snapshot);
    setText("convergence-reason", alignment.detail);
    setText("convergence-long", alignment.detail);
    if (alignment.state !== lastConvergence) {
        lastConvergence = alignment.state;
        convergenceHistory.push({ at: new Date().toISOString(), state: alignment.state,
            detail: alignment.detail, peers: snapshot.peers.length });
        if (convergenceHistory.length > 200)
            convergenceHistory.shift();
    }
    setText("convergence-events", `${convergenceHistory.length} convergence state transitions`);
    const signature = snapshot.peers.map(peer => peer.id).join('|');
    if (signature !== peerSignature) {
        peerSignature = signature;
        const selector = el("peer-select");
        const selected = selector.value;
        selector.replaceChildren();
        if (!snapshot.peers.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Open another tab first';
            selector.append(option);
        }
        else {
            for (const peer of snapshot.peers) {
                const option = document.createElement('option');
                option.value = peer.id;
                option.textContent = `Tab ${peer.id}`;
                selector.append(option);
            }
            selector.value = snapshot.peers.some(peer => peer.id === selected) ? selected : snapshot.peers[0].id;
        }
    }
    setText("transport", snapshot.transport);
    setText("persistence", snapshot.persistent ? "● Enabled" : "⚠ Unavailable");
    setText("conflicts", String(snapshot.conflictCount));
    const lastRTT = snapshot.roundTripsMs.at(-1);
    setText("rtt-value", lastRTT === undefined ? "—" : lastRTT.toFixed(1));
    setText("rtt-caption", lastRTT === undefined ? "Run a ping with at least two tabs" : `Measured round trip · ${snapshot.roundTripsMs.length} samples collected`);
    setText("ping-diagnostic", lastRTT === undefined ? '—' : `${lastRTT.toFixed(1)} ms`);
    const lastOneWay = snapshot.latencyMs.at(-1);
    setText("latency", lastOneWay === undefined ? "Awaiting an update" : `${lastOneWay} ms (approx.)`);
    for (const key of ["theme", "language", "fontSize"]) {
        const stamp = records[key].stamp;
        setText(`version-${key}`, `${stamp.counter} · ${stamp.actor}`);
    }
    renderGraph(snapshot);
    renderBars(snapshot.roundTripsMs);
    renderActivity(snapshot.activities);
}
engine.subscribe(render);
themeToggle.addEventListener("change", () => engine.set("theme", themeToggle.checked ? "dark" : "light"));
languageSelect.addEventListener("change", () => {
    const language = languageSelect.value;
    if (language === "en" || language === "es" || language === "fr" || language === "hi")
        engine.set("language", language);
});
fontSlider.addEventListener("input", () => engine.set("fontSize", Number(fontSlider.value)));
// All three preset fields use the same normal, independently synced setters.
const presets = {
    focus: { theme: "dark", language: "en", fontSize: 18 },
    calm: { theme: "light", language: "en", fontSize: 16 },
    read: { theme: "light", language: "en", fontSize: 21 },
};
for (const button of Array.from(document.querySelectorAll("[data-preset]"))) {
    button.addEventListener("click", () => {
        const preset = presets[button.dataset.preset ?? ""];
        if (!preset)
            return;
        for (const key of ["theme", "language", "fontSize"])
            engine.set(key, preset[key]);
        toast("Preset applied and shared across tabs");
    });
}
el("open-tab").addEventListener("click", () => {
    const tab = window.open(window.location.href, "_blank");
    if (!tab)
        toast("Your browser blocked the pop-up. Duplicate this tab manually.");
});
el("ping-tabs").addEventListener("click", () => {
    if (!engine.pingPeers())
        toast("Open this page in another tab before measuring round-trip time.");
    else
        toast("Ping sent. Watch the diagnostics chart for the reply.");
});
el("run-conflict").addEventListener("click", () => {
    const result = simulateConflict();
    const output = el("lab-result");
    output.replaceChildren();
    const head = document.createElement("div");
    head.className = "lab-result-head";
    const title = document.createElement("strong");
    title.textContent = "tab-B wins: light theme";
    const badge = document.createElement("span");
    badge.className = "convergence";
    badge.textContent = result.converged ? "✓ BOTH ORDERS CONVERGE" : "⚠ RESULTS DIFFER";
    head.append(title, badge);
    output.append(head);
    const comparisons = document.createElement("div");
    comparisons.className = "lab-comparison";
    for (const [name, steps] of [["Order 1: A → B", result.forward], ["Order 2: B → A", result.backward]]) {
        const card = document.createElement("div");
        card.className = "lab-order";
        const heading = document.createElement("b");
        heading.textContent = name;
        card.append(heading);
        for (const step of steps) {
            const line = document.createElement("div");
            line.textContent = `${step.actor}: ${step.accepted ? "accepted" : "ignored"} → ${step.value}`;
            card.append(line);
        }
        comparisons.append(card);
    }
    output.append(comparisons);
    const summary = document.createElement("p");
    summary.className = "lab-summary";
    summary.textContent = "Both edits use counter 7. Because tab-B sorts after tab-A, tab-B wins regardless of which message arrives first. Your actual settings were not modified.";
    output.append(summary);
});
for (const button of Array.from(document.querySelectorAll("[data-filter]"))) {
    button.addEventListener("click", () => {
        const next = button.dataset.filter;
        if (next === "all" || next === "local" || next === "received" || next === "conflict" || next === "system") {
            activeFilter = next;
            for (const item of Array.from(document.querySelectorAll("[data-filter]")))
                item.classList.toggle("active", item === button);
            renderActivity(latestSnapshot.activities);
        }
    });
}
el("copy-tab-id").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(engine.tabId);
        toast("Tab ID copied");
    }
    catch {
        toast(`Your tab ID: ${engine.tabId}`);
    }
});
el("reset-settings").addEventListener("click", () => { engine.reset(); toast("Default preferences restored across tabs"); });
el("export-settings").addEventListener("click", () => {
    // Export values only; revision stamps and temporary tab IDs stay private.
    const data = JSON.stringify(engine.snapshot().preferences, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "syncsphere-preferences.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Settings exported as JSON");
});
const fileInput = el("import-file");
el("import-settings").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file)
        return;
    try {
        if (file.size > 10_000)
            throw new Error("JSON file too large");
        if (!engine.importPreferences(JSON.parse(await file.text())))
            throw new Error("Invalid preference values");
        toast("Imported preferences shared across tabs");
    }
    catch (error) {
        toast(error instanceof Error ? error.message : "Failed to import JSON");
    }
    finally {
        fileInput.value = "";
    }
});
// Close the BroadcastChannel cleanly when the page is truly unloaded.
window.addEventListener("pagehide", event => { if (!event.persisted)
    engine.dispose(); });
// ===== V2.1 Research lab ====================================================
function reportDownload(filename, contents, mime) {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function statText(value) { return value === null ? '—' : `${value.toFixed(2)} ms`; }
function renderBenchStats(result) {
    const stats = result.deliveryStats;
    setText('stat-avg', statText(stats.average));
    setText('stat-median', statText(stats.median));
    setText('stat-p95', statText(stats.p95));
    setText('stat-max', statText(stats.maximum));
    const successes = result.samples.filter(sample => sample.passed).length;
    setText('bench-success', `${successes} / ${result.requested} acknowledged`);
    setText('bench-under100', `${result.achievedUnder100ms} / ${successes} ≤ 100 ms`);
    setText('report-samples', `Benchmark ${successes}/${result.requested} · stress ${stressResult?.converged ?? 0}/${stressResult?.requested ?? 0}`);
}
function renderStressTrials(result) {
    setText('stress-converged', `${result.converged} / ${result.requested}`);
    setText('stress-failed', String(result.trials.filter(trial => !trial.converged).length + (result.requested - result.trials.length)));
    const trace = el('stress-trace');
    trace.replaceChildren();
    for (const trial of result.trials) {
        const row = document.createElement('div');
        row.textContent = `#${String(trial.sequence).padStart(2, '0')} ${trial.converged ? '✓' : '✕'} winner ${trial.localWinner.slice(0, 8)} · ${trial.elapsedMs.toFixed(2)} ms`;
        trace.append(row);
    }
}
function labButtons(busy) {
    el('run-benchmark').disabled = busy;
    el('run-stress').disabled = busy;
    el('cancel-lab').disabled = !busy;
    el('peer-select').disabled = busy;
}
const benchmarkButton = el('run-benchmark');
benchmarkButton.addEventListener('click', async () => {
    const peer = el('peer-select').value;
    if (!peer)
        return toast('Open a second tab and wait for discovery.');
    if (!lab.available)
        return toast('BroadcastChannel is unavailable in this browser.');
    labButtons(true);
    benchmarkResult = null;
    setText('benchmark-status', 'Preparing isolated test register…');
    setText('stat-avg', '—');
    setText('stat-median', '—');
    setText('stat-p95', '—');
    setText('stat-max', '—');
    try {
        const result = await lab.benchmark(peer, 100, done => {
            el('benchmark-fill').style.width = `${done}%`;
            el('benchmark-progress').setAttribute('aria-valuenow', String(done));
            if (done % 5 === 0 || done === 1)
                setText('benchmark-status', `Measuring: ${done}/100 acknowledged or checked…`);
        });
        benchmarkResult = result;
        renderBenchStats(result);
        const ok = result.samples.filter(s => s.passed).length;
        setText('benchmark-status', `${ok === 100 ? 'PASS' : 'INCOMPLETE'} · ${ok}/100 acknowledged · one-way P95 ${statText(result.deliveryStats.p95)} · ACK RTT P95 ${statText(result.rttStats.p95)}`);
        toast('Benchmark finished. Export JSON or CSV for your submission.');
    }
    catch (error) {
        setText('benchmark-status', error instanceof Error ? error.message : 'Benchmark could not start');
    }
    finally {
        labButtons(false);
    }
});
el('cancel-lab').addEventListener('click', () => { lab.cancel(); toast('Cancellation requested after the current sample'); });
el('run-stress').addEventListener('click', async () => {
    const peer = el('peer-select').value;
    if (!peer)
        return toast('Open a second tab and wait for discovery.');
    if (!lab.available)
        return toast('BroadcastChannel is unavailable in this browser.');
    labButtons(true);
    stressResult = null;
    setText('stress-status', 'Preparing two real tabs…');
    try {
        const result = await lab.stressTest(peer, 20, done => {
            if (done % 5 === 0 || done === 1)
                setText('stress-status', `Checking equal-counter collisions: ${done}/20…`);
        });
        stressResult = result;
        renderStressTrials(result);
        setText('stress-status', `${result.converged === 20 ? 'PASS' : 'CHECK FAILURES'} · ${result.converged}/${result.requested} conflicts converged in both tabs`);
        setText('report-samples', `Benchmark ${benchmarkResult?.samples.filter(s => s.passed).length ?? 0}/100 · stress ${result.converged}/${result.requested}`);
    }
    catch (error) {
        setText('stress-status', error instanceof Error ? error.message : 'Conflict test failed');
    }
    finally {
        labButtons(false);
    }
});
el('export-report-json').addEventListener('click', () => {
    const report = makeReport(engine.snapshot(), convergenceHistory, benchmarkResult, stressResult);
    reportDownload('syncsphere-v2.1-evidence.json', JSON.stringify(report, null, 2), 'application/json');
    toast('Evidence JSON exported, including methodology and raw samples');
});
el('export-report-csv').addEventListener('click', () => {
    reportDownload('syncsphere-v2.1-samples.csv', csvReport(benchmarkResult, stressResult), 'text/csv;charset=utf-8');
    toast('Raw sample CSV exported');
});
window.addEventListener('pagehide', event => { if (!event.persisted)
    lab.dispose(); });
