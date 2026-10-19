import { blankRegisters, compareStamp, KEYS, parseRegister, STORAGE_PREFIX } from "./register.js";
export function readRegister(key) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        return raw === null ? null : parseRegister(key, JSON.parse(raw));
    }
    catch {
        // A corrupt value or blocked storage should not crash the UI.
        return null;
    }
}
export function readAll() {
    const records = blankRegisters();
    for (const key of KEYS) {
        const saved = readRegister(key);
        if (saved && compareStamp(saved.stamp, records[key].stamp) > 0) {
            // Each key is validated by its own parser.
            records[key] = saved;
        }
    }
    return records;
}
export function storageAvailable() {
    try {
        const key = "syncsphere:storage-check";
        localStorage.setItem(key, "ok");
        localStorage.removeItem(key);
        return true;
    }
    catch {
        return false;
    }
}
