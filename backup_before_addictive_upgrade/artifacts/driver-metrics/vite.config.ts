import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT;
// PORT is required for dev/preview server but not for production builds.
const isBuild = process.argv.includes("build");
if (!rawPort && !isBuild) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}
const port = Number(rawPort ?? "3000");
if (!isBuild && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH is required for Replit dev server; defaults to "/" for Android/Capacitor builds
const basePath = process.env.BASE_PATH ?? "/";

// ─── Domain redirect plugin ────────────────────────────────────────────────────
// In production, redirect any request that arrives on the .replit.app hostname
// to the custom domain with a 301.  Runs in both `vite dev` (server) and
// `vite preview` (preview) servers so the redirect fires regardless of the
// serving mode used by the deployment.
const CUSTOM_DOMAIN = "lucrodriverpro.com";

function domainRedirectPlugin() {
  const addMiddleware = (server: { middlewares: { use: Function } }) => {
    server.middlewares.use((req: any, res: any, next: Function) => {
      const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
      if (!isProduction) return next();

      const host = (req.headers?.host ?? "").toLowerCase();
      if (!host || host === CUSTOM_DOMAIN || host.endsWith(`.${CUSTOM_DOMAIN}`)) {
        return next();
      }

      const location = `https://${CUSTOM_DOMAIN}${req.url ?? "/"}`;
      res.writeHead(301, { Location: location });
      res.end();
    });
  };

  return {
    name: "domain-redirect",
    configureServer:        addMiddleware,
    configurePreviewServer: addMiddleware,
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    domainRedirectPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
