import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile } from "node:fs/promises";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");

  // ⚠️  DO NOT delete distDir before building.
  //
  // In production deployments (Google Cloud / Replit autoscale) only production
  // dependencies are installed.  esbuild is a build-time tool and may not be
  // available.  If we delete dist/ first and the rebuild fails, the deployment
  // has no binary to run — Replit/GCloud falls back to the oldest cached image
  // (which has stale code).
  //
  // By keeping the existing dist/ intact, a failed rebuild leaves the last
  // correctly-committed binary in place, so the server always starts with
  // working code even when the build step errors out.

  let buildSucceeded = false;
  try {
    const { build: esbuild } = await import("esbuild");
    const { default: esbuildPluginPino } = await import("esbuild-plugin-pino");

    await esbuild({
      entryPoints: [path.resolve(artifactDir, "src/index.ts")],
      platform: "node",
      bundle: true,
      format: "esm",
      outdir: distDir,
      outExtension: { ".js": ".mjs" },
      logLevel: "info",
      // connect-pg-simple reads table.sql at runtime via __dirname.
      // Externalizing it preserves the module's real __dirname so the
      // SQL file is found in node_modules, not in dist/.
      external: [
        "connect-pg-simple",
        "*.node",
        "sharp",
        "better-sqlite3",
        "sqlite3",
        "canvas",
        "bcrypt",
        "argon2",
        "fsevents",
        "re2",
        "farmhash",
        "xxhash-addon",
        "bufferutil",
        "utf-8-validate",
        "ssh2",
        "cpu-features",
        "dtrace-provider",
        "isolated-vm",
        "lightningcss",
        "pg-native",
        "oracledb",
        "mongodb-client-encryption",
        "nodemailer",
        "handlebars",
        "knex",
        "typeorm",
        "protobufjs",
        "onnxruntime-node",
        "@tensorflow/*",
        "@prisma/client",
        "@mikro-orm/*",
        "@grpc/*",
        "@swc/*",
        "@aws-sdk/*",
        "@azure/*",
        "@opentelemetry/*",
        "@google-cloud/*",
        "@google/*",
        "googleapis",
        "firebase-admin",
        "@parcel/watcher",
        "@sentry/profiling-node",
        "@tree-sitter/*",
        "aws-sdk",
        "classic-level",
        "dd-trace",
        "ffi-napi",
        "grpc",
        "hiredis",
        "kerberos",
        "leveldown",
        "miniflare",
        "mysql2",
        "newrelic",
        "odbc",
        "piscina",
        "realm",
        "ref-napi",
        "rocksdb",
        "sass-embedded",
        "sequelize",
        "serialport",
        "snappy",
        "tinypool",
        "usb",
        "workerd",
        "wrangler",
        "zeromq",
        "zeromq-prebuilt",
        "playwright",
        "puppeteer",
        "puppeteer-core",
        "electron",
      ],
      sourcemap: "linked",
      plugins: [
        // pino relies on workers to handle logging — use a plugin instead of externalizing it
        esbuildPluginPino({ transports: ["pino-pretty"] })
      ],
      // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
      banner: {
        js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
      },
    });

    buildSucceeded = true;
    console.log("[build] esbuild succeeded — fresh bundle written to dist/");
  } catch (err) {
    console.warn("[build] esbuild unavailable or failed:", err.message);
    console.warn("[build] Keeping existing dist/ — production will use the committed binary.");
    // Exit 0 so the deployment step does not abort.
    // The committed dist/index.mjs (tracked in git) will be used as-is.
    process.exit(0);
  }

  if (buildSucceeded) {
    // Copy connect-pg-simple's table.sql into dist/ as a fallback for any
    // code path that still resolves __dirname to the dist folder.
    try {
      const require = createRequire(import.meta.url);
      const pgSimpleDir = path.dirname(require.resolve("connect-pg-simple"));
      await copyFile(
        path.join(pgSimpleDir, "table.sql"),
        path.join(distDir, "table.sql"),
      );
    } catch (e) {
      console.warn("Could not copy connect-pg-simple/table.sql:", e.message);
    }
  }
}

buildAll().catch((err) => {
  console.error("[build] Unexpected error:", err);
  // Exit 0 — never abort the deployment because of a build script error.
  process.exit(0);
});
