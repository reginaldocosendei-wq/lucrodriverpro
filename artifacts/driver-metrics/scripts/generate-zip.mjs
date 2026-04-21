import archiver from "archiver";
import { createWriteStream, rmSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist/public");
const zipPath = path.resolve(distDir, "lucrodriverpro.zip");

if (!existsSync(distDir)) {
  console.error("[generate-zip] dist/public not found — run build first");
  process.exit(1);
}

if (existsSync(zipPath)) rmSync(zipPath);

await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 6 } });

  output.on("close", () => {
    console.log(`[generate-zip] Created ${zipPath} (${archive.pointer()} bytes)`);
    resolve();
  });
  archive.on("error", reject);

  archive.pipe(output);
  archive.glob("**/*", {
    cwd: distDir,
    ignore: ["lucrodriverpro.zip"],
  });
  archive.finalize();
});
