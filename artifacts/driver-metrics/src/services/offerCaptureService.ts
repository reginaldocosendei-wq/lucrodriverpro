/**
 * offerCaptureService.ts
 *
 * Abstraction layer for ride offer capture.
 *
 * MVP implementation: Camera / Gallery via <input type="file">
 *
 * Future implementations (Android native upgrade path):
 *   - AccessibilityService: Android service that listens for specific app windows
 *     and triggers capture automatically when a ride offer appears.
 *   - MediaProjection API: Continuous screen recording with frame analysis.
 *   - Capacitor Plugin: Custom native plugin wrapping the above.
 *
 * To upgrade to native, replace the `CameraCapture` class with a Capacitor
 * plugin call and keep the rest of the pipeline (analyze → display → save)
 * exactly as-is. The interface contract guarantees compatibility.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaptureMethod =
  | "camera"           // Current MVP: device camera via <input capture>
  | "gallery"          // Current MVP: file picker from gallery
  | "accessibility"    // Future: Android AccessibilityService auto-detect
  | "screenshot_api"   // Future: MediaProjection API continuous capture
  | "capacitor_plugin"; // Future: Custom Capacitor native plugin

export interface CaptureResult {
  file: File;
  previewUrl: string;   // Object URL for showing preview before analysis
  source: CaptureMethod;
  timestamp: number;
}

export interface ICaptureService {
  readonly method: CaptureMethod;
  readonly label: string;
  isAvailable(): boolean;
  capture(): Promise<CaptureResult>;
  cleanup(result: CaptureResult): void;
}

// ─── Camera/Gallery Capture (MVP) ─────────────────────────────────────────────
// Uses a hidden <input type="file"> element. Works in all browsers and on Android.
// On Android with Capacitor: opens the native camera or gallery picker.

class WebInputCapture implements ICaptureService {
  readonly method: CaptureMethod;
  readonly label: string;
  private readonly capture_attr: "environment" | "user" | undefined;

  constructor(mode: "camera" | "gallery") {
    this.method = mode;
    this.label = mode === "camera" ? "Câmera" : "Galeria";
    this.capture_attr = mode === "camera" ? "environment" : undefined;
  }

  isAvailable(): boolean {
    return typeof document !== "undefined";
  }

  capture(): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (this.capture_attr) {
        input.setAttribute("capture", this.capture_attr);
      }
      input.style.display = "none";
      document.body.appendChild(input);

      let settled = false;

      const cleanup = () => {
        document.body.removeChild(input);
      };

      input.onchange = () => {
        if (settled) return;
        settled = true;
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          reject(new Error("Nenhuma imagem selecionada"));
          return;
        }
        const previewUrl = URL.createObjectURL(file);
        resolve({
          file,
          previewUrl,
          source: this.method,
          timestamp: Date.now(),
        });
      };

      // Cancelled without selecting a file
      const onFocus = () => {
        setTimeout(() => {
          if (!settled && (!input.files || input.files.length === 0)) {
            settled = true;
            cleanup();
            reject(new Error("Captura cancelada"));
          }
          window.removeEventListener("focus", onFocus);
        }, 400);
      };
      window.addEventListener("focus", onFocus);

      input.click();
    });
  }

  cleanup(result: CaptureResult): void {
    if (result.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(result.previewUrl);
    }
  }
}

// ─── Future: Capacitor Plugin Capture ────────────────────────────────────────
// Uncomment and implement when building the native Android app.
// The service below is a placeholder that shows how to swap the implementation.
//
// class CapacitorCapture implements ICaptureService {
//   readonly method: CaptureMethod = "capacitor_plugin";
//   readonly label = "Captura Automática";
//
//   isAvailable(): boolean {
//     return Capacitor.isNativePlatform() && isPluginAvailable("OfferCapture");
//   }
//
//   async capture(): Promise<CaptureResult> {
//     const result = await Plugins.OfferCapture.captureOffer();
//     const file = base64ToFile(result.base64, "offer.jpg");
//     return { file, previewUrl: `data:image/jpeg;base64,${result.base64}`, source: "capacitor_plugin", timestamp: Date.now() };
//   }
//
//   cleanup(_result: CaptureResult): void {}
// }

// ─── Service Registry ─────────────────────────────────────────────────────────
// Add native services here as they are implemented. The UI automatically
// uses the first available service in priority order.

export const CAPTURE_SERVICES: ICaptureService[] = [
  // Future native services go here (higher priority)
  // new CapacitorCapture(),

  // MVP services
  new WebInputCapture("camera"),
  new WebInputCapture("gallery"),
];

export function getPreferredCaptureService(): ICaptureService {
  return CAPTURE_SERVICES.find((s) => s.isAvailable()) ?? CAPTURE_SERVICES[0];
}

export function getCameraService(): ICaptureService {
  return new WebInputCapture("camera");
}

export function getGalleryService(): ICaptureService {
  return new WebInputCapture("gallery");
}
