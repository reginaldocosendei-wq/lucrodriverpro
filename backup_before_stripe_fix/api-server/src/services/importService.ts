export interface ExtractedData {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
  km: number | null;
  hours: number | null;
  rating: number | null;
}

const EMPTY: ExtractedData = {
  earnings: null,
  trips: null,
  platform: null,
  km: null,
  hours: null,
  rating: null,
};

/**
 * Parse a Brazilian currency / numeric string into a float.
 * Handles:
 *   "R$ 1.234,56"  → 1234.56
 *   "1.234,56"     → 1234.56
 *   "1234,56"      → 1234.56
 *   "1234.56"      → 1234.56
 *   "1234"         → 1234
 *   1234.56        → 1234.56   (already a number)
 */
export function parseBRLNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    // Strip currency symbols, whitespace, asterisks, stars
    let s = value.replace(/R\$\s*/gi, "").replace(/[★*\s]/g, "").trim();

    if (!s || s === "-" || s.toLowerCase() === "null") return null;

    // Brazilian format: period = thousands separator, comma = decimal
    // e.g. "1.234,56" → "1234.56"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+(,\d+)$/.test(s)) {
      // "1234,56" → "1234.56"
      s = s.replace(",", ".");
    }
    // else: already a plain number like "1234" or "1234.56"

    const n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : null;
  }

  return null;
}

/**
 * Parse hours from various formats.
 * Handles:
 *   2.5            → 2.5
 *   "2,5"          → 2.5
 *   "2h30min"      → 2.5
 *   "2h 30min"     → 2.5
 *   "2h 30m"       → 2.5
 *   "2:30"         → 2.5
 *   "150 min"      → 2.5
 *   "150min"       → 2.5
 *   "2h"           → 2.0
 *   "30min"        → 0.5
 */
export function parseHours(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return isFinite(value) && value >= 0 ? value : null;
  }

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (!s || s === "-" || s === "null") return null;

    // "2h30min" or "2h 30m" or "2h30m"
    const hm = s.match(/(\d+)\s*h\s*(\d+)\s*m/);
    if (hm) return parseInt(hm[1]) + parseInt(hm[2]) / 60;

    // "2h" only
    const h = s.match(/^(\d+)\s*h$/);
    if (h) return parseInt(h[1]);

    // "30min" or "30m" only
    const m = s.match(/^(\d+)\s*m(in)?$/);
    if (m) return parseInt(m[1]) / 60;

    // "2:30"
    const colon = s.match(/^(\d+):(\d{2})$/);
    if (colon) return parseInt(colon[1]) + parseInt(colon[2]) / 60;

    // Plain decimal "2,5" or "2.5"
    const n = parseBRLNumber(value);
    if (n !== null) return n;
  }

  return null;
}

/**
 * Parse a trip/integer count.
 * Rejects unrealistic values (e.g. >1000 trips in a day).
 */
export function parseTrips(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    const n = Math.round(value);
    return n > 0 && n <= 999 ? n : null;
  }

  if (typeof value === "string") {
    const n = parseInt(value.trim(), 10);
    return !isNaN(n) && n > 0 && n <= 999 ? n : null;
  }

  return null;
}

/**
 * Parse a passenger rating (0–5).
 */
export function parseRating(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const n = parseBRLNumber(value);
  if (n === null) return null;
  return n >= 0 && n <= 5 ? Math.round(n * 100) / 100 : null;
}

/**
 * Coerce the raw AI response object into a clean ExtractedData.
 * Accepts both old field names (kmDriven / hoursWorked) and new (km / hours).
 */
export function parseExtracted(raw: unknown): ExtractedData {
  if (!raw || typeof raw !== "object") return EMPTY;
  const o = raw as Record<string, unknown>;

  return {
    earnings: parseBRLNumber(o.earnings),
    trips: parseTrips(o.trips),
    platform: typeof o.platform === "string" && o.platform !== "null" ? o.platform : null,
    km: parseBRLNumber(o.km ?? o.kmDriven),
    hours: parseHours(o.hours ?? o.hoursWorked),
    rating: parseRating(o.rating),
  };
}

export function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}
