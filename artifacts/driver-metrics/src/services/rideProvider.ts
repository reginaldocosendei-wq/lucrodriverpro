/**
 * rideProvider.ts
 *
 * ABSTRACTION LAYER — Ride Offer Provider
 *
 * Defines the contract between the UI decision engine and wherever ride data
 * actually comes from.
 *
 *   TODAY  → MockRideProvider  (browser simulation, always active)
 *   FUTURE → RealRideProvider  (Android APK + AccessibilityService + Capacitor bridge)
 *
 * Single swap point: change ACTIVE_PROVIDER at the bottom of this file.
 * Nothing in the UI, sound engine, or history system needs to change.
 */

// ─── Raw data structure ────────────────────────────────────────────────────────
// Mirrors the JSON that LucroDriverBridgePlugin.emitRide() sends over the
// Capacitor WebView bridge.  Keep in sync with:
//   android/LucroDriverBridgePlugin.kt  → emitRide()
//   android/AccessibilityRideService.kt → RawRideData data class

export interface RawRideData {
  /** Gross fare shown to the driver, in BRL (e.g. 12.50) */
  price: number;
  /** Route distance in kilometres (e.g. 4.2) */
  distanceKm: number;
  /** Estimated duration in whole minutes (e.g. 18) */
  estimatedMinutes: number;
  /** Detected app. Derived from the foreground package name on Android. */
  platform: "Uber" | "99" | "InDrive" | "Cabify" | "Other";
  /** Pickup neighbourhood or street — may be absent on some apps */
  pickup?: string;
  /** Destination — often hidden until accepted on Uber */
  destination?: string;
}

// ─── Driver cost profile ───────────────────────────────────────────────────────

export interface ProviderCosts {
  costPerKm: number;
  fixedCostPerHour: number;
}

// ─── Provider interface ────────────────────────────────────────────────────────

export interface RideProvider {
  /** Identifies the data source for debugging / UI labelling */
  readonly mode: "mock" | "real";
  /**
   * True when the provider can actually deliver data.
   * MockRideProvider is always available.
   * RealRideProvider requires Capacitor Android WebView + LucroDriverBridge plugin.
   */
  readonly isAvailable: boolean;
  /**
   * Returns the next ride offer, or null when unavailable.
   * - Mock: resolves immediately with synthetic data.
   * - Real: resolves when the Capacitor bridge fires "rideDetected".
   *         Returns null if the bridge is not present (browser / PWA).
   */
  nextRide(costs: ProviderCosts): Promise<RawRideData | null>;
}

// ─── Bridge: RawRideData → OfferAnalysis input ────────────────────────────────
// Converts raw detected data into the shape the profit engine expects.
// The UI (fetchNextFeedItem in assistant.tsx) passes RawRideData through this
// function before rendering any verdict.

export function rawRideToOfferInput(raw: RawRideData, costs: ProviderCosts) {
  const variableCost = costs.costPerKm * raw.distanceKm;
  const profitPerKm = (raw.price - variableCost) / raw.distanceKm;
  const netProfit = raw.price - variableCost;
  const hours = raw.estimatedMinutes / 60;
  const profitPerHour = (raw.price - variableCost - costs.fixedCostPerHour * hours) / hours;
  const verdict: "green" | "yellow" | "red" =
    profitPerKm >= 1.8 ? "green" : profitPerKm >= 1.0 ? "yellow" : "red";

  return {
    price: raw.price,
    distanceKm: raw.distanceKm,
    estimatedMinutes: raw.estimatedMinutes,
    platform: raw.platform,
    pickup: raw.pickup ?? null,
    destination: raw.destination ?? null,
    confidence: "high" as const,
    profitPerKm,
    profitPerHour,
    netProfit,
    verdict,
    costPerKm: costs.costPerKm,
    fixedCostPerHour: costs.fixedCostPerHour,
  };
}

// ─── MockRideProvider ─────────────────────────────────────────────────────────
// Active in the browser today. Generates realistic Brazilian ride offers.
// When ACTIVE_PROVIDER is swapped to RealRideProvider, this class is untouched
// and can be re-enabled at any time for testing.

const MOCK_NEIGHBORHOODS = [
  "Vila Madalena", "Pinheiros", "Moema", "Itaim Bibi", "Jardins",
  "Brooklin", "Santo André", "Guarulhos", "Osasco", "Santana",
  "Lapa", "Butantã", "Campo Belo", "Morumbi", "Consolação",
  "República", "Brás", "Tatuapé", "Mooca", "Liberdade",
  "Barra Funda", "Vila Prudente", "Penha", "Jabaquara", "Saúde",
];
const MOCK_PLATFORMS: RawRideData["platform"][] = ["Uber", "99", "InDrive", "Cabify"];

export class MockRideProvider implements RideProvider {
  readonly mode = "mock" as const;
  readonly isAvailable = true;

  async nextRide(costs: ProviderCosts): Promise<RawRideData> {
    const r = Math.random();
    let price: number, distanceKm: number, estimatedMinutes: number;

    if (r < 0.38) {
      distanceKm = parseFloat((Math.random() * 9 + 3).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 1.85 + Math.random() * 1.1)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 3.2 + Math.random() * 9);
    } else if (r < 0.72) {
      distanceKm = parseFloat((Math.random() * 7 + 2).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 1.05 + Math.random() * 0.7)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 4.2 + Math.random() * 12);
    } else {
      distanceKm = parseFloat((Math.random() * 4 + 1.5).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 0.25 + Math.random() * 0.65)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 5.5 + Math.random() * 16);
    }

    const platform = MOCK_PLATFORMS[Math.floor(Math.random() * MOCK_PLATFORMS.length)];
    if (platform === "InDrive") price = parseFloat((price * 0.83).toFixed(2));

    const pickupIdx = Math.floor(Math.random() * MOCK_NEIGHBORHOODS.length);
    let destIdx = Math.floor(Math.random() * MOCK_NEIGHBORHOODS.length);
    while (destIdx === pickupIdx) destIdx = Math.floor(Math.random() * MOCK_NEIGHBORHOODS.length);

    return {
      price,
      distanceKm,
      estimatedMinutes,
      platform,
      pickup: MOCK_NEIGHBORHOODS[pickupIdx],
      destination: Math.random() > 0.38 ? MOCK_NEIGHBORHOODS[destIdx] : undefined,
    };
  }
}

// ─── RealRideProvider ─────────────────────────────────────────────────────────
// Receives ride data from Android AccessibilityRideService via Capacitor bridge.
//
// Data flow:
//   AccessibilityRideService.kt detects ride card
//     → LucroDriverBridgePlugin.emitRide(data)
//     → notifyListeners("rideDetected", jsObject)
//     → window.Capacitor.Plugins.LucroDriverBridge fires "rideDetected" event
//     → RealRideProvider listener resolves the pending nextRide() Promise
//     → fetchNextFeedItem() → calcProfit() → verdict UI + sound + history
//
// Safe fallback: in browser/PWA, isAvailable returns false.
// fetchNextFeedItem() receives null and reschedules — mock simulation continues.

// Type for the Capacitor Plugins namespace (avoids importing full SDK in web build)
interface CapacitorPlugins {
  LucroDriverBridge?: {
    addListener(event: string, handler: (data: RawRideData) => void): void;
    removeAllListeners?(): void;
  };
}
interface CapacitorGlobal {
  isNativePlatform(): boolean;
  Plugins: CapacitorPlugins;
}

function getCapacitor(): CapacitorGlobal | null {
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap ?? null;
}

export class RealRideProvider implements RideProvider {
  readonly mode = "real" as const;

  // Pending resolver — set by nextRide(), cleared when the bridge fires.
  private pendingResolve: ((data: RawRideData) => void) | null = null;
  private listenerRegistered = false;

  /**
   * True only when running inside the Capacitor Android WebView AND the
   * LucroDriverBridge plugin is registered (APK build with plugin in MainActivity).
   *
   * In browser / PWA this is always false — no data will flow, mock continues.
   */
  get isAvailable(): boolean {
    const cap = getCapacitor();
    return !!(cap?.isNativePlatform() && cap?.Plugins?.LucroDriverBridge);
  }

  /**
   * Sets up the Capacitor bridge listener once, then returns a Promise that
   * resolves the next time the AccessibilityService sends a ride event.
   *
   * Returns null immediately when not running in the Android APK (browser / PWA).
   * The caller (fetchNextFeedItem in assistant.tsx) treats null as "no data yet"
   * and reschedules — mock simulation is unaffected.
   */
  async nextRide(_costs: ProviderCosts): Promise<RawRideData | null> {
    if (!this.isAvailable) {
      // Browser / PWA — safe fallback, mock mode continues unaffected.
      return null;
    }

    this.ensureListenerRegistered();

    return new Promise<RawRideData>((resolve) => {
      // One pending resolver at a time. If a previous one is orphaned
      // (e.g. the component unmounted mid-wait), it is safely overwritten —
      // the AccessibilityService will emit again on the next ride.
      this.pendingResolve = resolve;
    });
  }

  /**
   * Registers the Capacitor "rideDetected" listener exactly once.
   * The listener resolves the pending Promise set by nextRide().
   *
   * Must be called only when isAvailable is true (Capacitor is present).
   */
  private ensureListenerRegistered(): void {
    if (this.listenerRegistered) return;

    const bridge = getCapacitor()!.Plugins.LucroDriverBridge!;

    bridge.addListener("rideDetected", (data: RawRideData) => {
      if (this.pendingResolve) {
        this.pendingResolve(data);
        this.pendingResolve = null;
      }
      // If no resolver is pending the event is silently dropped —
      // the auto-mode timer will call nextRide() again and re-register.
    });

    this.listenerRegistered = true;
  }

  /** Call when the component unmounts / auto mode is disabled, to clean up. */
  cleanup(): void {
    this.pendingResolve = null;
    const bridge = getCapacitor()?.Plugins?.LucroDriverBridge;
    bridge?.removeAllListeners?.();
    this.listenerRegistered = false;
  }
}

// ─── Active provider ──────────────────────────────────────────────────────────
//
// MOCK MODE (default — browser + PWA):
export const ACTIVE_PROVIDER: RideProvider = new MockRideProvider();
//
// REAL MODE (Android APK with LucroDriverBridgePlugin registered):
// To enable: comment the line above and uncomment the line below.
// Everything else in the app — UI, sounds, history, verdict — is unchanged.
//
// export const ACTIVE_PROVIDER: RideProvider = new RealRideProvider();

export const REAL_PROVIDER = new RealRideProvider();
