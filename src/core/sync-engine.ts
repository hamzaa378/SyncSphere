import {
  blankRegisters, CHANNEL_NAME, compareStamp, isPreferenceKey, KEYS,
  parseRegister, STORAGE_PREFIX, validValue,
} from "./register.js";
import type { PreferenceKey, Preferences, Register, Registers } from "./register.js";
import { readAll, readRegister, storageAvailable } from "./storage.js";
import { preferenceFingerprint, revisionFingerprint } from "./fingerprint.js";

export type ActivityKind = "local" | "received" | "conflict" | "system";
export type Activity = { time: number; kind: ActivityKind; description: string };
export type Peer = { id: string; lastSeen: number; fingerprint?: string; revision?: string; records?: Registers };
export type Snapshot = {
  preferences: Preferences;
  records: Registers;
  activities: Activity[];
  latencyMs: number[];
  roundTripsMs: number[];
  peers: Peer[];
  localFingerprint: string;
  revisionFingerprint: string;
  sentUpdates: number;
  receivedUpdates: number;
  conflictCount: number;
  tabId: string;
  transport: "BroadcastChannel + storage" | "storage events only";
  persistent: boolean;
  repairChecks: number;
  repairedRegisters: number;
  repairSnapshotsSent: number;
  lastRecovery: string | null;
};
type Message =
  | { type: "HELLO" | "PRESENCE" | "GOODBYE"; sender: string; sentAt: number; fingerprint?: string; revision?: string; records?: Registers }
  | { type: "PING" | "PONG"; sender: string; sentAt: number; requestId: string }
  | { type: "SNAPSHOT"; sender: string; sentAt: number; records: Registers; to?: string }
  | { type: "UPDATE"; sender: string; sentAt: number; key: PreferenceKey; record: Register<unknown> };

type Listener = (snapshot: Snapshot) => void;

function createTabId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

/**
 * One instance per browser tab. No server is necessary: all tabs share
 * localStorage (persistence) and a BroadcastChannel (fast messaging).
 */
export class SyncEngine {
  readonly tabId = createTabId();
  private records: Registers = readAll();
  private counter = Math.max(...KEYS.map(key => this.records[key].stamp.counter));
  private listeners = new Set<Listener>();
  private activities: Activity[] = [];
  private latencyMs: number[] = [];
  private roundTripsMs: number[] = [];
  private peers = new Map<string, Peer>();
  private pendingPings = new Map<string, number>();
  private sentUpdates = 0;
  private receivedUpdates = 0;
  private conflictCount = 0;
  private channel: BroadcastChannel | null = null;
  private persistent = storageAvailable();
  private intervalId: number | undefined;
  private repairChecks = 0;
  private repairedRegisters = 0;
  private repairSnapshotsSent = 0;
  private lastRecovery: string | null = null;
  private lastRepairToPeer = new Map<string, number>();

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<unknown>) => this.receive(event.data);
      } catch {
        this.channel = null;
      }
    }
    window.addEventListener("storage", this.onStorage);
    window.addEventListener("focus", this.refreshFromStorage);
    window.addEventListener("pageshow", this.refreshFromStorage);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    // Periodic anti-entropy also recovers when a message was missed.
    this.intervalId = window.setInterval(() => {
      if (!document.hidden) this.refreshFromStorage();
      this.send({ type: "PRESENCE", sender: this.tabId, sentAt: Date.now(), fingerprint: this.localFingerprint(), revision: this.revisionFingerprint(), records: this.records });
      // A background tab may sleep. Mark unseen peers as inactive rather than
      // claiming they are definitely closed. Reappearance restores the dot.
      const cutoff = Date.now() - 9000;
      let removed = false;
      for (const [id, peer] of this.peers) {
        if (peer.lastSeen < cutoff) { this.peers.delete(id); removed = true; }
      }
      if (removed) {
        for (const key of [...this.lastRepairToPeer.keys()]) if (!this.peers.has(key)) this.lastRepairToPeer.delete(key);
        this.notify();
      }
    }, 2500);
    this.log("system", "Tab is ready. Saved preferences restored.");
    this.send({ type: "HELLO", sender: this.tabId, sentAt: Date.now(), fingerprint: this.localFingerprint(), revision: this.revisionFingerprint(), records: this.records });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private localFingerprint(): string {
    return preferenceFingerprint({
      theme: this.records.theme.value, language: this.records.language.value, fontSize: this.records.fontSize.value,
    });
  }

  private revisionFingerprint(): string { return revisionFingerprint(this.records); }

  /** Push a fresh report when the underlying winner changes, not only on heartbeats. */
  private reportState(): void {
    this.send({ type: "PRESENCE", sender: this.tabId, sentAt: Date.now(),
      fingerprint: this.localFingerprint(), revision: this.revisionFingerprint(), records: this.records });
  }

  snapshot(): Snapshot {
    return {
      preferences: {
        theme: this.records.theme.value,
        language: this.records.language.value,
        fontSize: this.records.fontSize.value,
      },
      records: structuredClone(this.records),
      activities: [...this.activities],
      latencyMs: [...this.latencyMs],
      roundTripsMs: [...this.roundTripsMs],
      peers: Array.from(this.peers.values()).map(peer => ({ ...peer })).sort((a, b) => a.id.localeCompare(b.id)),
      localFingerprint: this.localFingerprint(),
      revisionFingerprint: this.revisionFingerprint(),
      sentUpdates: this.sentUpdates,
      receivedUpdates: this.receivedUpdates,
      conflictCount: this.conflictCount,
      tabId: this.tabId,
      transport: this.channel ? "BroadcastChannel + storage" : "storage events only",
      persistent: this.persistent,
      repairChecks: this.repairChecks,
      repairedRegisters: this.repairedRegisters,
      repairSnapshotsSent: this.repairSnapshotsSent,
      lastRecovery: this.lastRecovery,
    };
  }

  /** Force a fresh storage read and ask each visible peer to re-exchange registers. */
  requestRepair(): void {
    this.repairChecks++;
    this.refreshFromStorage();
    this.send({ type: "HELLO", sender: this.tabId, sentAt: Date.now(),
      fingerprint: this.localFingerprint(), revision: this.revisionFingerprint(), records: this.records });
    this.reportState();
    this.log("system", "Manual consistency check requested from all open tabs.");
  }

  set<K extends PreferenceKey>(key: K, value: Preferences[K]): void {
    if (!validValue(key, value)) return;
    // Catch up with the saved version before assigning a new counter.
    this.refreshFromStorage();
    if (this.records[key].value === value) return;
    this.counter += 1;
    const register = { value, stamp: { counter: this.counter, actor: this.tabId } };
    this.assign(key, register);
    this.saveWinner(key);
    this.log("local", `Changed ${key} to ${String(value)} in this tab.`);
    this.sentUpdates++;
    this.send({ type: "UPDATE", sender: this.tabId, sentAt: Date.now(), key, record: register });
    this.reportState();
    this.notify();
  }

  /** Ping known tabs and measure actual same-browser round-trip duration. */
  pingPeers(): boolean {
    if (!this.channel || this.peers.size === 0) return false;
    const requestId = `${this.tabId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.pendingPings.set(requestId, performance.now());
    this.send({ type: "PING", sender: this.tabId, sentAt: Date.now(), requestId });
    // Bound memory even if every peer closes before answering.
    if (this.pendingPings.size > 30) this.pendingPings.delete(this.pendingPings.keys().next().value!);
    return true;
  }

  reset(): void {
    // Never clear() storage: removals have no revision and can erase a newer edit.
    this.set("theme", "light");
    this.set("language", "en");
    this.set("fontSize", 16);
    this.log("system", "Restored default preferences.");
  }

  importPreferences(raw: unknown): boolean {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return false;
    const value = raw as Record<string, unknown>;
    if (!KEYS.every(key => validValue(key, value[key]))) return false;
    this.set("theme", value.theme as Preferences["theme"]);
    this.set("language", value.language as Preferences["language"]);
    this.set("fontSize", value.fontSize as Preferences["fontSize"]);
    this.log("system", "Imported and synchronized preferences.");
    return true;
  }

  private assign<K extends PreferenceKey>(key: K, record: Register<Preferences[K]>): void {
    // Type-safe by construction: called only with the validated key/value pair.
    (this.records as Record<string, unknown>)[key] = record;
    this.counter = Math.max(this.counter, record.stamp.counter);
    this.notify();
  }

  private accept<K extends PreferenceKey>(key: K, candidate: Register<Preferences[K]>, source: string): void {
    const current = this.records[key];
    const comparison = compareStamp(candidate.stamp, current.stamp);
    if (comparison > 0) {
      if (candidate.stamp.counter === current.stamp.counter && candidate.stamp.actor !== current.stamp.actor) {
        this.conflictCount++;
        this.log("conflict", `${key}: simultaneous edits; ${candidate.stamp.actor} won the tie-break.`);
      }
      this.assign(key, candidate);
      this.saveWinner(key);
      this.log("received", `${key} updated from ${source}.`);
      this.reportState();
    } else if (comparison < 0 && source === "storage") {
      // Another tab wrote a stale register. Reassert the winner to disk.
      this.saveWinner(key);
    } else if (comparison < 0 && candidate.stamp.counter === current.stamp.counter
               && candidate.stamp.actor !== current.stamp.actor) {
      this.conflictCount++;
      this.log("conflict", `${key}: ignored older concurrent edit; ${current.stamp.actor} won.`);
    }
  }

  private saveWinner<K extends PreferenceKey>(key: K): void {
    if (!this.persistent) return;
    try {
      const onDisk = readRegister(key);
      if (onDisk && compareStamp(onDisk.stamp, this.records[key].stamp) > 0) {
        this.accept(key, onDisk, "storage");
        return;
      }
      if (!onDisk || compareStamp(onDisk.stamp, this.records[key].stamp) < 0) {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(this.records[key]));
      }
      // A cross-tab race between read and write is repaired by storage events.
    } catch {
      this.persistent = false;
      this.log("system", "Browser storage is unavailable. Persistence is disabled.");
    }
  }

  private send(message: Message): void {
    try { this.channel?.postMessage(message); } catch { /* storage events remain a fallback */ }
  }

  /** Merge only validated newer registers; send a bounded repair snapshot for stale peers. */
  private reconcilePeer(peerId: string, incoming: Registers): void {
    this.repairChecks++;
    let peerBehind = false;
    for (const key of KEYS) {
      const next = parseRegister(key, incoming[key]);
      if (!next) continue;
      const relation = compareStamp(next.stamp, this.records[key].stamp);
      if (relation > 0) {
        this.repairedRegisters++;
        this.lastRecovery = `${key}: adopted a newer version from ${peerId.slice(0, 8)}`;
        this.accept(key, next, "peer anti-entropy");
      } else if (relation < 0) peerBehind = true;
    }
    if (peerBehind) {
      const last = this.lastRepairToPeer.get(peerId) ?? 0;
      if (Date.now() - last >= 1200) {
        this.lastRepairToPeer.set(peerId, Date.now());
        this.repairSnapshotsSent++;
        this.send({ type: "SNAPSHOT", sender: this.tabId, to: peerId,
          sentAt: Date.now(), records: this.records });
      }
    }
  }

  private receive(data: unknown): void {
    if (data === null || typeof data !== "object") return;
    const message = data as Partial<Message>;
    if (typeof message.sender !== "string" || message.sender === this.tabId || message.sender.length > 100) return;
    // Ignore unrelated experimental traffic: only the production protocol can alter peer state.
    if (typeof message.type !== "string" || !["HELLO", "PRESENCE", "GOODBYE", "PING", "PONG", "SNAPSHOT", "UPDATE"].includes(message.type)) return;
    const wasKnown = this.peers.has(message.sender);
    const previous = this.peers.get(message.sender);
    const reported = "fingerprint" in message && typeof message.fingerprint === "string"
      && /^[0-9A-F]{8}$/.test(message.fingerprint) ? message.fingerprint : previous?.fingerprint;
    const revision = "revision" in message && typeof message.revision === "string"
      && /^[0-9A-F]{8}$/.test(message.revision) ? message.revision : previous?.revision;
    const peerRecords = "records" in message && message.records && typeof message.records === "object"
      && KEYS.every(key => parseRegister(key, (message.records as Partial<Registers>)[key]))
      ? message.records as Registers : previous?.records;
    this.peers.set(message.sender, { id: message.sender, lastSeen: Date.now(),
      ...(reported ? { fingerprint: reported } : {}), ...(revision ? { revision } : {}),
      ...(peerRecords ? { records: structuredClone(peerRecords) } : {}) });
    if (!wasKnown) { this.log("system", `Tab ${message.sender} is now visible on the network.`); }
    else this.notify();
    if (message.type === "GOODBYE") {
      this.peers.delete(message.sender);
      this.log("system", `Tab ${message.sender} left the network.`);
      return;
    }
    if (message.type === "PRESENCE") {
      if (peerRecords) this.reconcilePeer(message.sender, peerRecords);
      return;
    }
    if (message.type === "PING") {
      if (typeof message.requestId === "string" && message.requestId.length < 150)
        this.send({ type: "PONG", sender: this.tabId, sentAt: Date.now(), requestId: message.requestId });
      return;
    }
    if (message.type === "PONG") {
      if (typeof message.requestId !== "string") return;
      const start = this.pendingPings.get(message.requestId);
      if (start === undefined) return;
      const elapsed = performance.now() - start;
      if (elapsed >= 0 && elapsed < 60000) {
        this.roundTripsMs.push(Math.round(elapsed * 10) / 10);
        this.roundTripsMs = this.roundTripsMs.slice(-24);
        this.notify();
      }
      // Keep request for other peers for up to 30 entries.
      return;
    }
    if (message.type === "HELLO") {
      if (peerRecords) this.reconcilePeer(message.sender, peerRecords);
      this.send({ type: "PRESENCE", sender: this.tabId, sentAt: Date.now(), fingerprint: this.localFingerprint(), revision: this.revisionFingerprint(), records: this.records });
      this.send({ type: "SNAPSHOT", sender: this.tabId, sentAt: Date.now(), records: this.records });
      return;
    }
    if (message.type === "UPDATE" && isPreferenceKey(message.key)) {
      if (typeof message.sentAt === "number" && Number.isFinite(message.sentAt)) {
        const elapsed = Date.now() - message.sentAt;
        // Approximate same-device wall-clock transport latency.
        if (elapsed >= 0 && elapsed < 60_000) {
          this.latencyMs.push(elapsed);
          this.latencyMs = this.latencyMs.slice(-60);
        }
      }
      const candidate = parseRegister(message.key, message.record);
      if (candidate) {
        this.receivedUpdates++;
        this.accept(message.key, candidate, "BroadcastChannel");
        this.notify();
      }
    }
    if (message.type === "SNAPSHOT" && message.records && typeof message.records === "object"
        && (!message.to || message.to === this.tabId)) {
      for (const key of KEYS) {
        const candidate = parseRegister(key, message.records[key]);
        if (candidate) {
          if (compareStamp(candidate.stamp, this.records[key].stamp) > 0) {
            this.repairedRegisters++;
            this.lastRecovery = `${key}: refreshed from snapshot sent by ${message.sender.slice(0, 8)}`;
          }
          this.accept(key, candidate, "another tab's snapshot");
        }
      }
    }
  }

  private onStorage = (event: StorageEvent): void => {
    if (event.storageArea !== localStorage) return;
    if (event.key === null) { this.refreshFromStorage(); return; }
    if (!event.key.startsWith(STORAGE_PREFIX)) return;
    const key = event.key.slice(STORAGE_PREFIX.length);
    if (!isPreferenceKey(key)) return;
    if (event.newValue === null) { this.saveWinner(key); return; }
    try {
      const incoming = parseRegister(key, JSON.parse(event.newValue));
      if (incoming) this.accept(key, incoming, "storage");
    } catch { /* ignore corrupt external writes */ }
  };

  private refreshFromStorage = (): void => {
    const saved = readAll();
    for (const key of KEYS) {
      this.accept(key, saved[key], "storage");
    }
  };

  private onVisibilityChange = (): void => {
    if (!document.hidden) this.refreshFromStorage();
  };

  private log(kind: ActivityKind, description: string): void {
    this.activities.unshift({ kind, description, time: Date.now() });
    this.activities = this.activities.slice(0, 30);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.snapshot());
  }

  dispose(): void {
    this.send({ type: "GOODBYE", sender: this.tabId, sentAt: Date.now() });
    this.channel?.close();
    if (this.intervalId !== undefined) clearInterval(this.intervalId);
    window.removeEventListener("storage", this.onStorage);
    window.removeEventListener("focus", this.refreshFromStorage);
    window.removeEventListener("pageshow", this.refreshFromStorage);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }
}
