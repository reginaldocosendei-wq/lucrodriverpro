/**
 * rideProvider.ts
 *
 * ABSTRACTION LAYER — Ride Offer Provider
 *
 * Defines the contract between the UI decision engine and wherever ride data
 * actually comes from.  Today: MockRideProvider (simulation).
 * Tomorrow: RealRideProvider via Android AccessibilityService → Capacitor bridge.
 *
 * To swap providers, change ACTIVE_PROVIDER at the bottom of this file.
 * Nothing in the UI or profit engine needs to change.
 */

// ─── Raw data structure ────────────────────────────────────────────────────────
// Mirrors the JSON schema that AccessibilityRideService.kt will emit over the
// Capacitor WebView bridge.  Keep in sync with android/AccessibilityRideService.kt.

export interface RawRideData {
  /** Gross fare shown to the driver, in BRL (e.g. 12.50) */
  price: number;
  /** Route distance in kilometres (e.g. 4.2) */
  distanceKm: number;
  /** Estimated duration in whole minutes (e.g. 18) */
  estimatedMinutes: number;
  /** Detected app. Derived from the foreground package name on Android. */
  platform: "Uber" | "99" | "InDrive" | "Cabify";
  /** Pickup neighbourhood or street — may be absent on some apps */
  pickup?: string;
  /** Destination — often hidden until accepted on Uber */
  destination?: string;
}

// ─── Driver cost profile (kept minimal here to avoid circular deps) ────────────

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
   * RealRideProvider requires the Capacitor plugin + Android service to be running.
   */
  readonly isAvailable: boolean;
  /**
   * Returns the next ride offer.
   * - Mock: generates synthetic data immediately.
   * - Real: resolves when the AccessibilityService emits an event through the bridge.
   */
  nextRide(costs: ProviderCosts): Promise<RawRideData>;
}

// ─── Bridge: RawRideData → OfferAnalysis input ────────────────────────────────
// This is the seam between the provider layer and the profit engine.
// Both MockRideProvider and RealRideProvider produce RawRideData.
// The UI calls rawRideToOfferInput() to get values the profit calculation needs.

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
// Used in AUTO MODE today. Generates realistic Brazilian ride offers for simulation.
// Architecture note: Replace ACTIVE_PROVIDER with RealRideProvider when the Android
// APK is built. The rest of the pipeline is identical.

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
      // Good — above R$1.80/km after costs
      distanceKm = parseFloat((Math.random() * 9 + 3).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 1.85 + Math.random() * 1.1)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 3.2 + Math.random() * 9);
    } else if (r < 0.72) {
      // Yellow — R$1.00–1.80/km
      distanceKm = parseFloat((Math.random() * 7 + 2).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 1.05 + Math.random() * 0.7)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 4.2 + Math.random() * 12);
    } else {
      // Red — below R$1.00/km
      distanceKm = parseFloat((Math.random() * 4 + 1.5).toFixed(1));
      price = parseFloat((distanceKm * (costs.costPerKm + 0.25 + Math.random() * 0.65)).toFixed(2));
      estimatedMinutes = Math.round(distanceKm * 5.5 + Math.random() * 16);
    }

    const platform = MOCK_PLATFORMS[Math.floor(Math.random() * MOCK_PLATFORMS.length)];
    // InDrive: passenger proposes lower prices
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
// Placeholder for future Android AccessibilityService integration.
//
// Integration path:
//   1. Build android/AccessibilityRideService.kt (scaffold already exists)
//   2. Add Capacitor plugin that exposes a JS-callable addListener("rideDetected")
//   3. Implement nextRide() below to await that event
//   4. Set ACTIVE_PROVIDER = new RealRideProvider() in this file
//   5. Nothing else in the app changes

export class RealRideProvider implements RideProvider {
  readonly mode = "real" as const;

  /**
   * isAvailable is false until:
   *   - Running inside a Capacitor Android WebView, AND
   *   - com.lucrodriver.accessibility.AccessibilityRideService is enabled in device settings
   *
   * The UI reads this to show the "Real Mode (coming soon)" label.
   */
  get isAvailable(): boolean {
    // Future check: return !!(window as any).Capacitor?.isNativePlatform()
    //                && !!(window as any).LucroDriverBridge?.isServiceRunning();
    return false;
  }

  async nextRide(_costs: ProviderCosts): Promise<RawRideData> {
    if (!this.isAvailable) {
      throw new Error(
        "RealRideProvider: native bridge not active. " +
        "Enable AccessibilityRideService in Android Settings first."
      );
    }
    // TODO: when Capacitor plugin is built, replace with:
    //   return new Promise((resolve) => {
    //     (window as any).LucroDriverBridge.addListener("rideDetected", (data: RawRideData) => {
    //       resolve(data);
    //     });
    //   });
    throw new Error("RealRideProvider.nextRide(): not yet implemented.");
  }
}

// ─── Active provider ──────────────────────────────────────────────────────────
// SINGLE PLACE to swap data source. Swap to RealRideProvider when the APK is ready.

export const ACTIVE_PROVIDER: RideProvider = new MockRideProvider();
export const REAL_PROVIDER = new RealRideProvider();
