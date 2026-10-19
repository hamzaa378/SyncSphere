/**
 * A tiny last-writer-wins register with a Lamport logical clock.
 *
 * Each preference has its OWN register so two tabs editing different
 * preferences never overwrite one another's changes.
 *
 * Winner = bigger logical counter. If counters match, larger tab ID wins.
 * This is a total ordering, independent of message arrival order.
 */
export const KEYS = ["theme", "language", "fontSize"];
export const DEFAULTS = { theme: "light", language: "en", fontSize: 16 };
export const STORAGE_PREFIX = "syncsphere:prefs:v1:";
export const CHANNEL_NAME = "syncsphere:changes:v1";
export function compareStamp(a, b) {
    if (a.counter !== b.counter)
        return a.counter > b.counter ? 1 : -1;
    return a.actor === b.actor ? 0 : a.actor > b.actor ? 1 : -1;
}
export function validValue(key, value) {
    if (key === "theme")
        return value === "light" || value === "dark";
    if (key === "language")
        return value === "en" || value === "es" || value === "fr" || value === "hi";
    return typeof value === "number" && Number.isInteger(value) && value >= 14 && value <= 22;
}
export function validStamp(value) {
    if (value === null || typeof value !== "object")
        return false;
    const entry = value;
    return typeof entry.counter === "number" && Number.isSafeInteger(entry.counter)
        && entry.counter >= 0 && typeof entry.actor === "string"
        && entry.actor.length > 0 && entry.actor.length <= 100;
}
export function parseRegister(key, raw) {
    if (raw === null || typeof raw !== "object")
        return null;
    const entry = raw;
    if (!validStamp(entry.stamp) || !validValue(key, entry.value))
        return null;
    return { value: entry.value, stamp: entry.stamp };
}
export function blankRegisters() {
    return {
        theme: { value: DEFAULTS.theme, stamp: { counter: 0, actor: "system" } },
        language: { value: DEFAULTS.language, stamp: { counter: 0, actor: "system" } },
        fontSize: { value: DEFAULTS.fontSize, stamp: { counter: 0, actor: "system" } },
    };
}
export function isPreferenceKey(value) {
    return typeof value === "string" && KEYS.includes(value);
}
