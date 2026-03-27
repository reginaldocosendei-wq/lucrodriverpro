export interface ExtractedData {
  earnings: number | null;
  trips: number | null;
  platform: string | null;
  kmDriven: number | null;
  hoursWorked: number | null;
  rating: number | null;
}

export function parseExtracted(raw: unknown): ExtractedData {
  if (!raw || typeof raw !== "object") {
    return { earnings: null, trips: null, platform: null, kmDriven: null, hoursWorked: null, rating: null };
  }
  const obj = raw as Record<string, unknown>;
  return {
    earnings: typeof obj.earnings === "number" ? obj.earnings : null,
    trips: typeof obj.trips === "number" ? Math.round(obj.trips) : null,
    platform: typeof obj.platform === "string" ? obj.platform : null,
    kmDriven: typeof obj.kmDriven === "number" ? obj.kmDriven : null,
    hoursWorked: typeof obj.hoursWorked === "number" ? obj.hoursWorked : null,
    rating: typeof obj.rating === "number" ? obj.rating : null,
  };
}

export function todayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}
