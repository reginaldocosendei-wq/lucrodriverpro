/**
 * Unified storage adapter for Lucro Driver.
 *
 * - On Android (native Capacitor): persists to SharedPreferences via
 *   @capacitor/preferences — survives WebView clears, scheme changes, updates.
 * - On web / PWA: uses localStorage as normal.
 *
 * The in-memory cache (memCache) allows synchronous reads from code paths
 * that cannot await (e.g. setAuthTokenGetter, initial useState).
 * Always call storageInit() once during app boot before any sync reads.
 */

import { Capacitor } from "@capacitor/core";

const memCache: Record<string, string | null> = {};
let _preferencesModule: typeof import("@capacitor/preferences") | null = null;

async function prefs() {
  if (!_preferencesModule) {
    _preferencesModule = await import("@capacitor/preferences");
  }
  return _preferencesModule.Preferences;
}

const isNative = () => Capacitor.isNativePlatform();

// ── Boot init ─────────────────────────────────────────────────────────────────
// Call once at app start to populate the sync cache from persistent storage.
export async function storageInit(keys: string[]): Promise<void> {
  if (!isNative()) {
    for (const key of keys) {
      memCache[key] = localStorage.getItem(key);
    }
    console.log("[storage] init (web/localStorage) — keys:", keys.join(", "));
    return;
  }
  const P = await prefs();
  for (const key of keys) {
    const { value } = await P.get({ key });
    memCache[key] = value;
  }
  console.log("[storage] init (native/Preferences) — keys:", keys.join(", "));
}

// ── Async read ────────────────────────────────────────────────────────────────
export async function storageGet(key: string): Promise<string | null> {
  if (!isNative()) {
    const val = localStorage.getItem(key);
    memCache[key] = val;
    return val;
  }
  const P = await prefs();
  const { value } = await P.get({ key });
  memCache[key] = value;
  return value;
}

// ── Async write ───────────────────────────────────────────────────────────────
export async function storageSet(key: string, value: string): Promise<void> {
  memCache[key] = value;
  if (!isNative()) {
    localStorage.setItem(key, value);
    return;
  }
  const P = await prefs();
  await P.set({ key, value });
}

// ── Async delete ──────────────────────────────────────────────────────────────
export async function storageRemove(key: string): Promise<void> {
  memCache[key] = null;
  if (!isNative()) {
    localStorage.removeItem(key);
    return;
  }
  const P = await prefs();
  await P.remove({ key });
}

// ── Sync read (from in-memory cache — only reliable after storageInit) ────────
export function storageGetSync(key: string): string | null {
  return memCache[key] ?? null;
}

// ── Sync write (cache + localStorage; Preferences updated in background) ──────
// Use for urgent writes that must not block the UI thread.
export function storageSetSync(key: string, value: string): void {
  memCache[key] = value;
  try { localStorage.setItem(key, value); } catch {}
  if (isNative()) {
    prefs().then((P) => P.set({ key, value })).catch(() => {});
  }
}

// ── Sync delete ───────────────────────────────────────────────────────────────
export function storageRemoveSync(key: string): void {
  memCache[key] = null;
  try { localStorage.removeItem(key); } catch {}
  if (isNative()) {
    prefs().then((P) => P.remove({ key })).catch(() => {});
  }
}
