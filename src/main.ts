import { SyncEngine } from "./core/sync-engine.js";
import type { Activity, Snapshot } from "./core/sync-engine.js";
import { simulateConflict } from "./core/conflict-lab.js";
import { translateUI } from "./i18n.js";
import type { PreferenceKey, Preferences } from "./core/register.js";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element: #${id}`);
  return node as T;
}
function setText(id: string, content: string): void { el(id).textContent = content; }

const engine = new SyncEngine();
const themeToggle = el<HTMLInputElement>("theme-toggle");
const languageSelect = el<HTMLSelectElement>("language-select");
const fontSlider = el<HTMLInputElement>("font-slider");
const activityList = el<HTMLOListElement>("activity-list");
let activeFilter: "all" | Activity["kind"] = "all";
let latestSnapshot = engine.snapshot();
let toastTimer: number | undefined;
let graphSignature = "";

function toast(message: string): void {
  const box = el<HTMLDivElement>("toast");
  box.textContent = message;
  box.classList.add("show");
  if (toastTimer !== undefined) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => box.classList.remove("show"), 2800);
}

function renderActivity(events: Activity[]): void {
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
function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}
function renderGraph(snapshot: Snapshot): void {
  const ids = snapshot.peers.map(peer => peer.id);
  const signature = ids.join("|") + "/" + snapshot.tabId;
  if (signature === graphSignature) return;
  graphSignature = signature;
  const container = el<HTMLElement>("peer-graph");
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

function renderBars(values: number[]): void {
  const holder = el<HTMLDivElement>("rtt-bars");
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
  setText("max-rtt", `Max ${peak.toFixed(1)} ms`);
}

function render(snapshot: Snapshot): void {
  latestSnapshot = snapshot;
  const { preferences, records } = snapshot;
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.style.setProperty("--app-font-size", `${preferences.fontSize}px`);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
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
  setText("network-status", snapshot.peers.length ? `${snapshot.peers.length} peer(s) visible` : "Only this tab so far");
  setText("state-fingerprint", snapshot.localFingerprint);
  const known = snapshot.peers.filter(peer => peer.fingerprint !== undefined);
  const mismatch = known.filter(peer => peer.fingerprint !== snapshot.localFingerprint);
  const state = snapshot.peers.length === 0 ? "Waiting for another tab" :
    mismatch.length ? `${mismatch.length} peer state(s) differ · settling` :
    known.length === snapshot.peers.length ? "✓ All reported states match" : "Waiting for peer state reports";
  setText("state-alignment", state);
  setText("transport", snapshot.transport);
  setText("persistence", snapshot.persistent ? "● Enabled" : "⚠ Unavailable");
  setText("conflicts", String(snapshot.conflictCount));
  const lastRTT = snapshot.roundTripsMs.at(-1);
  setText("rtt-value", lastRTT === undefined ? "—" : lastRTT.toFixed(1));
  setText("rtt-caption", lastRTT === undefined ? "Run a ping with at least two tabs" : `Measured round trip · ${snapshot.roundTripsMs.length} samples collected`);
  const lastOneWay = snapshot.latencyMs.at(-1);
  setText("latency", lastOneWay === undefined ? "Awaiting an update" : `${lastOneWay} ms (approx.)`);
  for (const key of ["theme", "language", "fontSize"] as const) {
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
  if (language === "en" || language === "es" || language === "fr" || language === "hi") engine.set("language", language);
});
fontSlider.addEventListener("input", () => engine.set("fontSize", Number(fontSlider.value)));

// All three preset fields use the same normal, independently synced setters.
const presets: Record<string, Preferences> = {
  focus: { theme: "dark", language: "en", fontSize: 18 },
  calm: { theme: "light", language: "en", fontSize: 16 },
  read: { theme: "light", language: "en", fontSize: 21 },
};
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-preset]"))) {
  button.addEventListener("click", () => {
    const preset = presets[button.dataset.preset ?? ""];
    if (!preset) return;
    for (const key of ["theme", "language", "fontSize"] as const) engine.set(key, preset[key]);
    toast("Preset applied and shared across tabs");
  });
}

el("open-tab").addEventListener("click", () => {
  const tab = window.open(window.location.href, "_blank");
  if (!tab) toast("Your browser blocked the pop-up. Duplicate this tab manually.");
});
el("ping-tabs").addEventListener("click", () => {
  if (!engine.pingPeers()) toast("Open this page in another tab before measuring round-trip time.");
  else toast("Ping sent. Watch the diagnostics chart for the reply.");
});

el("run-conflict").addEventListener("click", () => {
  const result = simulateConflict();
  const output = el<HTMLDivElement>("lab-result");
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
  for (const [name, steps] of [["Order 1: A → B", result.forward], ["Order 2: B → A", result.backward]] as const) {
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

for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-filter]"))) {
  button.addEventListener("click", () => {
    const next = button.dataset.filter;
    if (next === "all" || next === "local" || next === "received" || next === "conflict" || next === "system") {
      activeFilter = next;
      for (const item of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-filter]"))) item.classList.toggle("active", item === button);
      renderActivity(latestSnapshot.activities);
    }
  });
}

el("copy-tab-id").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(engine.tabId); toast("Tab ID copied"); }
  catch { toast(`Your tab ID: ${engine.tabId}`); }
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
const fileInput = el<HTMLInputElement>("import-file");
el("import-settings").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    if (file.size > 10_000) throw new Error("JSON file too large");
    if (!engine.importPreferences(JSON.parse(await file.text()) as unknown)) throw new Error("Invalid preference values");
    toast("Imported preferences shared across tabs");
  } catch (error) { toast(error instanceof Error ? error.message : "Failed to import JSON"); }
  finally { fileInput.value = ""; }
});

// Close the BroadcastChannel cleanly when the page is truly unloaded.
window.addEventListener("pagehide", event => { if (!event.persisted) engine.dispose(); });
