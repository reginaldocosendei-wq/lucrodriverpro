package com.lucrodriver.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.lucrodriver.bridge.LucroDriverBridgePlugin
import org.json.JSONObject

/**
 * AccessibilityRideService
 *
 * PURPOSE
 * ───────
 * Monitors the foreground screen for ride offer cards on Uber, 99, InDrive,
 * and Cabify. When a card is detected, extracts structured data and sends it
 * to the React WebView via the LucroDriverBridge Capacitor plugin.
 *
 * INTEGRATION FLOW
 * ────────────────
 *  Android screen (Uber/99 app)
 *       │  AccessibilityEvent (TYPE_WINDOW_CONTENT_CHANGED)
 *       ▼
 *  AccessibilityRideService.onAccessibilityEvent()
 *       │  extractRideData()
 *       ▼
 *  RawRideData (JSON)  ←── matches RawRideData interface in rideProvider.ts
 *       │  LucroDriverBridge.emit("rideDetected", data)
 *       ▼
 *  React WebView — RealRideProvider.nextRide() resolves
 *       │  rawRideToOfferInput() → profit engine → verdict UI
 *       ▼
 *  Driver sees verdict + decision buttons
 *
 * DATA CONTRACT (JSON emitted to bridge)
 * ──────────────────────────────────────
 * {
 *   "price":             12.50,          // BRL, required
 *   "distanceKm":         4.2,           // km, required
 *   "estimatedMinutes":    18,           // integer minutes, required
 *   "platform":         "Uber",          // "Uber"|"99"|"InDrive"|"Cabify"
 *   "pickup":           "Vila Madalena", // optional
 *   "destination":      "Moema"          // optional (often hidden by Uber)
 * }
 *
 * ACTIVATION
 * ──────────
 * The user must enable the service in:
 *   Settings → Accessibility → Downloaded apps → Lucro Driver
 *
 * STATUS: Scaffold only. Text extraction and bridge call are marked TODO below.
 */
class AccessibilityRideService : AccessibilityService() {

    // ── Package names we observe ──────────────────────────────────────────────
    companion object {
        private const val PKG_UBER    = "com.ubercab.driver"
        private const val PKG_99      = "com.ninetynine.partner"
        private const val PKG_INDRIVE = "sinet.startup.inDriver"
        private const val PKG_CABIFY  = "com.cabify.driver"

        private val OBSERVED_PACKAGES = setOf(PKG_UBER, PKG_99, PKG_INDRIVE, PKG_CABIFY)
    }

    // ── Service configuration ─────────────────────────────────────────────────

    override fun onServiceConnected() {
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                         AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 200L          // ms debounce
            packageNames = OBSERVED_PACKAGES.toTypedArray()
        }
        serviceInfo = info
    }

    // ── Event handling ────────────────────────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in OBSERVED_PACKAGES) return

        val root = rootInActiveWindow ?: return
        val platform = packageToPlatform(pkg)

        // Each extractor returns null if no ride card is currently visible.
        val data: RawRideData? = when (pkg) {
            PKG_UBER    -> extractUber(root, platform)
            PKG_99      -> extract99(root, platform)
            PKG_INDRIVE -> extractInDrive(root, platform)
            PKG_CABIFY  -> extractCabify(root, platform)
            else        -> null
        }

        data?.let { emitToBridge(it) }
    }

    override fun onInterrupt() { /* required override, no-op */ }

    // ── Per-app extractors ────────────────────────────────────────────────────
    //
    // TODO: For each app, inspect the view hierarchy in Android Studio's
    // Layout Inspector while a ride offer is visible. Map content-description
    // and resource-id values to the fields below.
    //
    // Useful helpers:
    //   findNodeByText(root, "R$")   — finds any node whose text starts with "R$"
    //   findNodeById(root, "com.ubercab.driver:id/trip_price")
    //   node.text?.toString()

    private fun extractUber(root: AccessibilityNodeInfo, platform: String): RawRideData? {
        // TODO: Uber shows ride cards with IDs like:
        //   trip_price, trip_distance, trip_duration, trip_pickup_address
        // val priceNode = root.findAccessibilityNodeInfosByViewId("com.ubercab.driver:id/trip_price").firstOrNull()
        // val price = parsePrice(priceNode?.text?.toString()) ?: return null
        // val distNode = root.findAccessibilityNodeInfosByViewId("com.ubercab.driver:id/trip_distance").firstOrNull()
        // val dist = parseDistance(distNode?.text?.toString()) ?: return null
        // val durNode = root.findAccessibilityNodeInfosByViewId("com.ubercab.driver:id/trip_duration").firstOrNull()
        // val mins = parseMinutes(durNode?.text?.toString()) ?: return null
        // return RawRideData(price, dist, mins, platform, pickup = pickupNode?.text?.toString())
        return null // TODO: implement
    }

    private fun extract99(root: AccessibilityNodeInfo, platform: String): RawRideData? {
        // TODO: 99 uses content descriptions. Check with Layout Inspector.
        return null // TODO: implement
    }

    private fun extractInDrive(root: AccessibilityNodeInfo, platform: String): RawRideData? {
        // TODO: InDrive shows passenger-proposed price. Extract it from the bid card.
        return null // TODO: implement
    }

    private fun extractCabify(root: AccessibilityNodeInfo, platform: String): RawRideData? {
        // TODO: Cabify implementation
        return null // TODO: implement
    }

    // ── Bridge emission ───────────────────────────────────────────────────────

    /**
     * Sends extracted ride data to the React WebView via LucroDriverBridgePlugin.
     *
     * The plugin converts [RawRideData] to a JSObject and fires it as the
     * "rideDetected" Capacitor event, which RealRideProvider.nextRide() is
     * waiting on in the WebView JS context.
     *
     * If the plugin singleton is null (service started before Capacitor is ready,
     * or running outside the APK) the call is safely ignored and a warning is logged.
     */
    private fun emitToBridge(data: RawRideData) {
        val plugin = LucroDriverBridgePlugin.getInstance()
        if (plugin != null) {
            // Real bridge call — sends data to the React WebView.
            plugin.emitRide(data)
            android.util.Log.d("LucroDriver", "emitRide → ${data.platform} R$${data.price} ${data.distanceKm}km")
        } else {
            // Plugin not yet initialised — log only. This can happen if the
            // AccessibilityService fires before MainActivity.onCreate() completes.
            // The next event from the same ride card will retry automatically.
            android.util.Log.w("LucroDriver", "LucroDriverBridgePlugin not ready — ride event dropped. platform=${data.platform}")
        }
    }

    // ── Parsing helpers ───────────────────────────────────────────────────────

    /** Extracts a BRL amount from strings like "R$ 12,50" or "12.50" */
    private fun parsePrice(text: String?): Double? {
        if (text.isNullOrBlank()) return null
        return text
            .replace(Regex("[^0-9,.]"), "")
            .replace(",", ".")
            .toDoubleOrNull()
    }

    /** Extracts km from strings like "4,2 km" or "4.2km" */
    private fun parseDistance(text: String?): Double? {
        if (text.isNullOrBlank()) return null
        return text
            .replace(Regex("[^0-9,.]"), "")
            .replace(",", ".")
            .toDoubleOrNull()
    }

    /** Extracts minutes from strings like "18 min" or "~18min" or "1h 2min" */
    private fun parseMinutes(text: String?): Int? {
        if (text.isNullOrBlank()) return null
        val hours = Regex("(\\d+)\\s*h").find(text)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val mins  = Regex("(\\d+)\\s*min").find(text)?.groupValues?.get(1)?.toIntOrNull() ?: 0
        val total = hours * 60 + mins
        return if (total > 0) total else text.replace(Regex("[^0-9]"), "").toIntOrNull()
    }

    private fun packageToPlatform(pkg: String): String = when (pkg) {
        PKG_UBER    -> "Uber"
        PKG_99      -> "99"
        PKG_INDRIVE -> "InDrive"
        PKG_CABIFY  -> "Cabify"
        else        -> "Unknown"
    }
}

// ── Data class ────────────────────────────────────────────────────────────────
// Mirrors the TypeScript RawRideData interface in src/services/rideProvider.ts.
// Keep both in sync when adding fields.

data class RawRideData(
    val price: Double,
    val distanceKm: Double,
    val estimatedMinutes: Int,
    val platform: String,
    val pickup: String? = null,
    val destination: String? = null,
)
