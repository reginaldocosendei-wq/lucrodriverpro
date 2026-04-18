# Lucro Driver — Real Android Mode

## Critical distinction: browser vs. native

The current web/PWA build of Lucro Driver **cannot** automatically read ride
offer screens on Uber, 99, InDrive, or Cabify.

This is a fundamental limitation of browsers and Progressive Web Apps:
sandboxing rules prohibit any web page from reading the content of another
installed app.  There is no workaround for this in the browser environment.

**Real automatic ride detection requires an Android APK** built with Capacitor
that includes a custom `AccessibilityService`.  The web version remains fully
testable today through the mock simulation provider.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────┐
│  Android device (APK build)                          │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Uber / 99 / InDrive / Cabify (foreground)  │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │  AccessibilityEvent            │
│                     ▼                                │
│  ┌─────────────────────────────────────────────┐    │
│  │  AccessibilityRideService.kt                │    │
│  │  • Listens to partner-app view hierarchies  │    │
│  │  • Extracts price / km / minutes / platform │    │
│  │  • Emits JSON via LucroDriverBridge plugin  │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │  Capacitor plugin event        │
│                     ▼                                │
│  ┌─────────────────────────────────────────────┐    │
│  │  React WebView (Lucro Driver web app)       │    │
│  │  src/services/rideProvider.ts               │    │
│  │  RealRideProvider.nextRide() resolves       │    │
│  └──────────────────┬──────────────────────────┘    │
│                     │  RawRideData                   │
│                     ▼                                │
│  ┌─────────────────────────────────────────────┐    │
│  │  fetchNextFeedItem() in assistant.tsx        │    │
│  │  → calcProfit() → OfferAnalysis             │    │
│  │  → Same verdict UI, sounds, history         │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Browser / PWA (current state — always available)    │
│                                                      │
│  MockRideProvider.nextRide()                        │
│  → Synthetic Brazilian ride data                     │
│  → Same calcProfit() → same UI → same history       │
└──────────────────────────────────────────────────────┘
```

---

## Key files and their roles

| File | Role |
|------|------|
| `android/AccessibilityRideService.kt` | Android service scaffold — monitors Uber/99 screen; has extractor stubs + Brazilian parsers + bridge emit |
| `artifacts/driver-metrics/src/services/rideProvider.ts` | Provider abstraction — `MockRideProvider` (active today), `RealRideProvider` (APK), `ACTIVE_PROVIDER` swap point |
| `artifacts/driver-metrics/src/pages/assistant.tsx` | UI — auto mode loop calls `fetchNextFeedItem()` which routes through `ACTIVE_PROVIDER` |

---

## How to swap to real mode (APK phase)

**Step 1 — Build the Capacitor plugin**

Create a Capacitor plugin (`LucroDriverBridgePlugin`) that:
- Wraps `AccessibilityRideService`
- Exposes a `notifyListeners("rideDetected", data)` call to JS
- Registers itself in `MainActivity.kt`

**Step 2 — Implement `AccessibilityRideService` extractors**

In `android/AccessibilityRideService.kt`:
- Open each partner app with Android Studio's Layout Inspector while a ride
  offer card is on screen
- Map the view IDs / content-descriptions to the `TODO` stubs in each
  `extract*()` method
- Uncomment the Capacitor bridge call in `emitToBridge()`

**Step 3 — Wire `RealRideProvider.nextRide()`**

In `src/services/rideProvider.ts`, replace the TODO in `RealRideProvider.nextRide()`:

```typescript
return new Promise((resolve) => {
  (window as any).LucroDriverBridge.addListener(
    "rideDetected",
    (data: RawRideData) => resolve(data)
  );
});
```

**Step 4 — Swap the active provider**

At the bottom of `src/services/rideProvider.ts`, change:

```typescript
// Before
export const ACTIVE_PROVIDER: RideProvider = new MockRideProvider();

// After
export const ACTIVE_PROVIDER: RideProvider = new RealRideProvider();
```

That single change routes the entire pipeline — including all existing UI,
sounds, verdict logic, and history — through the real Android bridge.
Nothing else in the app needs to change.

**Step 5 — Android Manifest**

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<service
    android:name="com.lucrodriver.accessibility.AccessibilityRideService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_service_config" />
</service>
```

Create `android/app/src/main/res/xml/accessibility_service_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowContentChanged|typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="200"
    android:description="@string/accessibility_service_description" />
```

**Step 6 — User activation**

The driver must manually enable the service once:
> **Android Settings → Accessibility → Downloaded apps → Lucro Driver**

---

## What works today (browser / mock)

- Auto Mode simulation with 8–15 s ride generation
- Green / yellow / red verdict with decision psychology text
- Sound engine (triple ascending ding / beeps / sawtooth + vibration)
- 14-second countdown with auto-dismiss
- Daily counter (corridas evitadas + R$ prejuízo evitado)
- Full history with accept / ignore decisions
- Manual screenshot capture flow (GPT-4o OCR)
- Driver cost profile configuration

## What is prepared for the APK phase

- `AccessibilityRideService.kt` scaffold with all package names, event handling,
  per-app extractor stubs, Brazilian number parsers, and bridge emit function
- `RideProvider` abstraction with `RealRideProvider` placeholder and clear TODOs
- `fetchNextFeedItem()` in the UI already routes through `ACTIVE_PROVIDER` —
  zero UI changes needed when the bridge goes live
- `REAL_PROVIDER.isAvailable` drives the "Provider: aguardando bridge Android"
  status in the locked REAL button panel — updates automatically when live

## What still needs real Android wiring

- [ ] Android Studio Layout Inspector sessions for Uber, 99, InDrive, Cabify
      to finalize view IDs in the extractor stubs
- [ ] `LucroDriverBridgePlugin` Capacitor plugin (Kotlin + TypeScript wrapper)
- [ ] `RealRideProvider.nextRide()` implementation (3 lines, TODO marked)
- [ ] `ACTIVE_PROVIDER` swap in `rideProvider.ts` (1 line change)
- [ ] `AndroidManifest.xml` and accessibility service config XML
- [ ] Capacitor build configuration (`npx cap sync android`)
- [ ] APK signing + Play Store / sideload distribution
