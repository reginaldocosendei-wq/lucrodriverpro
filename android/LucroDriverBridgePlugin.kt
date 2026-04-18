package com.lucrodriver.bridge

/**
 * LucroDriverBridgePlugin
 *
 * CAPACITOR PLUGIN — Android ↔ WebView bridge for real ride detection.
 *
 * This is the only communication channel between AccessibilityRideService
 * (which reads partner-app screens) and the React WebView (which runs the
 * profit engine and decision UI).
 *
 * FLOW
 * ────
 *  AccessibilityRideService detects ride card
 *       │
 *       ▼  calls
 *  LucroDriverBridgePlugin.getInstance()?.emitRide(rawRideData)
 *       │
 *       ▼  notifyListeners("rideDetected", jsObject)
 *  Capacitor WebView bridge
 *       │
 *       ▼  JS event fired
 *  RealRideProvider.nextRide() resolves (rideProvider.ts)
 *       │
 *       ▼
 *  fetchNextFeedItem() → calcProfit() → verdict UI + sound + history
 *
 * REGISTRATION
 * ────────────
 * Register this plugin in MainActivity.kt:
 *
 *   import com.lucrodriver.bridge.LucroDriverBridgePlugin
 *
 *   class MainActivity : BridgeActivity() {
 *       override fun onCreate(savedInstanceState: Bundle?) {
 *           registerPlugin(LucroDriverBridgePlugin::class.java)
 *           super.onCreate(savedInstanceState)
 *       }
 *   }
 *
 * The JS side accesses it as:
 *   window.Capacitor.Plugins.LucroDriverBridge.addListener("rideDetected", handler)
 *
 * NOTE: This plugin has no callable @PluginMethod endpoints — it is
 * event-only (push from native to JS). No JS → native calls needed.
 */

import com.getcapacitor.Plugin
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject
import com.lucrodriver.accessibility.RawRideData

@CapacitorPlugin(name = "LucroDriverBridge")
class LucroDriverBridgePlugin : Plugin() {

    // ── Singleton access ──────────────────────────────────────────────────────
    //
    // AccessibilityRideService holds no reference to the plugin directly —
    // it calls getInstance() so the plugin can be swapped out in tests and
    // the reference is never held past the plugin's lifecycle.

    companion object {
        @Volatile
        private var instance: LucroDriverBridgePlugin? = null

        /**
         * Returns the active plugin instance, or null if the plugin has not
         * been initialised yet (e.g. before Capacitor's Bridge is ready).
         *
         * Callers (AccessibilityRideService) must null-check:
         *   LucroDriverBridgePlugin.getInstance()?.emitRide(data)
         */
        fun getInstance(): LucroDriverBridgePlugin? = instance
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun load() {
        // Store reference as soon as Capacitor initialises the plugin.
        instance = this
    }

    override fun handleOnDestroy() {
        // Clear reference so GC can collect; avoids leaking WebView context.
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    // ── Bridge emission ───────────────────────────────────────────────────────

    /**
     * Converts a [RawRideData] into a JSON object and fires it to the JS side
     * as a "rideDetected" event.
     *
     * Called from AccessibilityRideService.emitToBridge() on the main thread.
     * Capacitor's notifyListeners() is thread-safe and will post to the JS thread.
     *
     * JSON shape (mirrors TypeScript RawRideData in rideProvider.ts):
     * {
     *   price:             Double  // BRL gross fare
     *   distanceKm:        Double  // route distance in km
     *   estimatedMinutes:  Int     // ETA in whole minutes
     *   platform:          String  // "Uber" | "99" | "InDrive" | "Cabify"
     *   pickup:            String? // optional — pickup address/neighbourhood
     *   destination:       String? // optional — often hidden by Uber until accepted
     * }
     */
    fun emitRide(data: RawRideData) {
        val js = JSObject().apply {
            put("price", data.price)
            put("distanceKm", data.distanceKm)
            put("estimatedMinutes", data.estimatedMinutes)
            put("platform", data.platform)
            data.pickup?.let { put("pickup", it) }
            data.destination?.let { put("destination", it) }
        }
        // Broadcasts to all JS listeners registered via:
        //   window.Capacitor.Plugins.LucroDriverBridge.addListener("rideDetected", fn)
        notifyListeners("rideDetected", js)
    }
}
