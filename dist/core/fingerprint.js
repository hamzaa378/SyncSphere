/** Small, deterministic fingerprint for VISUAL comparison, not a security hash. */
export function preferenceFingerprint(state) {
    // Stable field order matters: every tab must hash the same string.
    const value = `${state.theme}|${state.language}|${state.fontSize}`;
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0").toUpperCase();
}
/** Visual checksum of the complete replicated state, including version stamps. */
export function revisionFingerprint(records) {
    const value = ['theme', 'language', 'fontSize'].map(key => {
        const r = records[key];
        return `${key}:${r.value}:${r.stamp.counter}:${r.stamp.actor}`;
    }).join('|');
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++)
        hash = Math.imul(hash ^ value.charCodeAt(i), 16777619) >>> 0;
    return hash.toString(16).padStart(8, '0').toUpperCase();
}
