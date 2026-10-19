import { blankRegisters, compareStamp, KEYS, parseRegister, STORAGE_PREFIX } from "./register.js";
import type { PreferenceKey, Preferences, Register, Registers } from "./register.js";

export function readRegister<K extends PreferenceKey>(key: K): Register<Preferences[K]> | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? null : parseRegister(key, JSON.parse(raw));
  } catch {
    // A corrupt value or blocked storage should not crash the UI.
    return null;
  }
}

export function readAll(): Registers {
  const records = blankRegisters();
  for (const key of KEYS) {
    const saved = readRegister(key);
    if (saved && compareStamp(saved.stamp, records[key].stamp) > 0) {
      // Each key is validated by its own parser.
      (records as Record<string, unknown>)[key] = saved;
    }
  }
  return records;
}

export function storageAvailable(): boolean {
  try {
    const key = "syncsphere:storage-check";
    localStorage.setItem(key, "ok");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
