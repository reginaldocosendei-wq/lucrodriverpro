import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.lucrodriver.app",
  appName: "Lucro Driver",
  webDir: "dist/public",

  server: {
    androidScheme: "https",
    cleartext: false,
  },

  android: {
    backgroundColor: "#0a0a0a",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#0a0a0a",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    Browser: {
      presentationStyle: "popover",
    },
    Camera: {
      presentationStyle: "fullscreen",
    },
  },
};

export default config;
