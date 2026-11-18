#!/usr/bin/env node
/**
 * agent/manifest.json üretir: GitHub raw üzerinden anlık güncelleme için
 * dosya listesi + sha256 özetleri. Commit öncesi çalıştır:
 *   node scripts/build-agent-manifest.mjs
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const FILES = ["agent/arena-agent.mjs", "agent/collect.mjs", "agent/update.mjs", "Arena-Agent.bat", "docs/app.js", "docs/index.html", "docs/style.css", "public/arena-widget.js"];

const manifest = {
  version: new Date().toISOString(),
  repo: "CehennemGibiyim/Arena",
  branch: "main",
  rawBase: "https://raw.githubusercontent.com/CehennemGibiyim/Arena/main/",
  files: {},
};
for (const file of FILES) {
  try {
    const content = await readFile(path.join(ROOT, file));
    manifest.files[file] = { sha256: createHash("sha256").update(content).digest("hex"), size: content.length };
  } catch { /* dosya yoksa atla */ }
}
await mkdir(path.join(ROOT, "agent"), { recursive: true });
await writeFile(path.join(ROOT, "agent", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("manifest güncellendi:", Object.keys(manifest.files).length, "dosya, sürüm", manifest.version);
