import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
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

execSync(`zip -r lucrodriverpro.zip . --exclude "lucrodriverpro.zip"`, {
  cwd: distDir,
  stdio: "inherit",
});

console.log(`[generate-zip] Created ${zipPath}`);
