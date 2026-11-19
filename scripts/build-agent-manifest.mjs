#!/usr/bin/env node
/**
 * agent/manifest.json üretir: GitHub raw üzerinden anlık güncelleme için
 * dosya listesi + sha256 özetleri.
 *
 *   node scripts/build-agent-manifest.mjs
 *
 * GitHub Actions içinde GITHUB_REPOSITORY otomatik kullanılır; yerelde
 * ARENA_REPO ile değiştirilebilir.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.ARENA_REPO || process.env.GITHUB_REPOSITORY || "CehennemGibiyim/ArenaSol";
const BRANCH = process.env.ARENA_BRANCH || "main";

const FILES = [
  "agent/arena-agent.mjs",
  "agent/collect.mjs",
  "agent/update.mjs",
  "agent/baslat.bat",
  "Arena-Agent.bat",
  "Arena-Live-OS.bat",
  "KURULUM.bat",
  "Durdur.bat",
  "docs/index.html",
  "docs/app.js",
  "docs/style.css",
  "docs/yardim.html",
  "docs/data/rooms.json",
  "docs/data/chests.json",
  "docs/data/status.json",
  "public/arena-widget.js",
];

const manifest = {
  // Sürüm, dosya özetlerinden türetilir: aynı içerik her zaman aynı manifest'i üretir.
  // Böylece CI'da yeniden üretim gereksiz commit/push yarışı yaratmaz.
  version: "",
  repo: REPO,
  branch: BRANCH,
  rawBase: `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`,
  files: {},
};

for (const file of FILES) {
  try {
    const content = await readFile(path.join(ROOT, file));
    manifest.files[file] = {
      sha256: createHash("sha256").update(content).digest("hex"),
      size: content.length,
    };
  } catch {
    /* dosya yoksa atla */
  }
}

await mkdir(path.join(ROOT, "agent"), { recursive: true });
const digest = createHash("sha256");
for (const file of Object.keys(manifest.files).sort()) {
  digest.update(`${file}:${manifest.files[file].sha256}\n`);
}
manifest.version = digest.digest("hex").slice(0, 16);
await writeFile(path.join(ROOT, "agent", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("manifest güncellendi:", Object.keys(manifest.files).length, "dosya, sürüm", manifest.version, "·", REPO);
