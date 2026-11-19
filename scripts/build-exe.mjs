#!/usr/bin/env node
/**
 * Arena Windows paket üretici
 * ---------------------------------------------------------------------------
 * `release/Arena-Live-OS/` klasörünü oluşturur (portable çalıştırılabilir paket)
 * ve `release/Arena-Live-OS-windows.zip` olarak sıkıştırır.
 *
 * Kullanım:
 *   node scripts/build-exe.mjs                 # build çıktısını paketle
 *   ARENA_PORTABLE_NODE=1 node scripts/build-exe.mjs   # node.exe'yi de göm
 *
 * NSIS kurulum dosyası (GitHub Actions windows-release.yml içinde):
 *   makensis scripts/installer.nsi
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "release", "Arena-Live-OS");
const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
const VERSION = pkg.version || "1.2.0";

const INCLUDE_DIRS = ["src", "scripts", "docs", "public", "agent", ".github"];
const INCLUDE_FILES = [
  "package.json", "package-lock.json", "tsconfig.json", "next.config.ts",
  "postcss.config.mjs", "eslint.config.mjs", "drizzle.config.ts",
  ".env.example", "README.md", "KURULUM.bat", "Arena-Live-OS.bat",
  "Durdur.bat", "Arena-Agent.bat",
];

const log = (...a) => console.log("[build-exe]", ...a);

async function copyIfExists(from, to) {
  if (!existsSync(from)) return false;
  await cp(from, to, { recursive: true, force: true });
  return true;
}

async function treeSize(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? await treeSize(p) : (await stat(p)).size;
  }
  return total;
}

async function main() {
  log(`temizleniyor: ${OUT}`);
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const dir of INCLUDE_DIRS) await copyIfExists(path.join(ROOT, dir), path.join(OUT, dir));
  for (const file of INCLUDE_FILES) await copyIfExists(path.join(ROOT, file), path.join(OUT, file));

  // .next build çıktısı ve üretim bağımlılıkları
  if (!existsSync(path.join(ROOT, ".next"))) {
    throw new Error(".next bulunamadı — önce `npm run build` çalıştırın.");
  }
  await cp(path.join(ROOT, ".next"), path.join(OUT, ".next"), { recursive: true, force: true, dereference: true });
  // Üretim bağımlılıklarını lockfile'dan kur: pg'nin alt bağımlılıkları
  // (pg-pool, pg-protocol, pg-cloudflare …) elle kopyalanınca eksik kalıyordu.
  log("üretim bağımlılıkları kuruluyor (npm ci --omit=dev)");
  // execSync kabuğu kullanır; Windows'ta npm.cmd doğrudan spawn edilemiyor (EINVAL).
  execSync("npm ci --omit=dev --ignore-scripts --no-audit --no-fund", {
    cwd: OUT,
    stdio: "inherit",
    shell: true,
  });

  if (process.env.ARENA_PORTABLE_NODE === "1") {
    const nodeExe = process.execPath;
    await cp(nodeExe, path.join(OUT, "node.exe"));
    log("gömülü node.exe eklendi");
  }

  await writeFile(
    path.join(OUT, "SURUM.json"),
    JSON.stringify(
      {
        name: "Arena Live OS",
        version: VERSION,
        build: new Date().toISOString(),
        node: process.version,
        repo: process.env.GITHUB_REPOSITORY || "CehennemGibiyim/ArenaSol",
        channel: "github-releases",
        notes: [
          "GitHub'dan anlık veri + otomatik güncelleme",
          "7/24 Actions taraması (giriş gerekmez)",
          "Sandık açma asistanı (yayını açar ve bildirir, jeton toplamaz)",
        ],
      },
      null,
      2,
    ),
  );

  const zipPath = path.join(ROOT, "release", `Arena-Live-OS-${VERSION}-windows.zip`);
  try {
    execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${OUT}\\*' -DestinationPath '${zipPath}' -Force`], { stdio: "inherit" });
  } catch {
    try {
      execFileSync("zip", ["-rq", zipPath, path.basename(OUT)], { cwd: path.join(ROOT, "release"), stdio: "inherit" });
    } catch (e) {
      log("zip oluşturulamadı:", e.message);
    }
  }

  const size = await treeSize(OUT).catch(() => 0);
  const digest = existsSync(zipPath)
    ? createHash("sha256").update(await readFile(zipPath)).digest("hex")
    : "";
  log(`hazır: ${OUT} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  if (digest) log(`zip: ${zipPath} · sha256 ${digest.slice(0, 16)}…`);
}

main().catch((e) => {
  console.error("[build-exe] hata:", e.message);
  process.exit(1);
});
