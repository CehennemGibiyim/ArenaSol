#!/usr/bin/env node
/**
 * Arena Self-Updater — Windows paketi açılırken GitHub'daki değişiklikleri anlar.
 * ---------------------------------------------------------------------------
 * Her açılışta:  raw.githubusercontent.com/CehennemGibiyim/Arena/main/agent/manifest.json
 * çekilir; yerel dosyaların sha256 özeti farklıysa indirilip üzerine yazılır.
 * Kendini (update.mjs) güncellemek yerine update.mjs.pending olarak bırakır;
 * bir sonraki açılışta pending dosya devreye girer (Windows'ta çalışan dosya
 * anında üzerine yazılamaz).
 *
 * Ortam: ARENA_REPO="kullanici/depo", ARENA_BRANCH="main", ARENA_MANIFEST_URL="..."
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, access, copyFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const REPO = process.env.ARENA_REPO || "CehennemGibiyim/Arena";
const BRANCH = process.env.ARENA_BRANCH || "main";
const MANIFEST_URL = process.env.ARENA_MANIFEST_URL || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/agent/manifest.json`;
const TIMEOUT = Number(process.env.UPDATE_TIMEOUT_MS || 15000);
const log = (...a) => console.log(`[update ${new Date().toLocaleTimeString("tr-TR")}]`, ...a);

async function fetchBuf(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "arena-updater", Accept: "application/json,*/*" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

async function main() {
  // Önceki açılışta bırakılan pending güncellemeyi uygula
  const selfPath = path.join(ROOT, "agent", "update.mjs");
  const pending = selfPath + ".pending";
  try { await access(pending); await rename(pending, selfPath); log("bekleyen self-update uygulandı, lütfen betiği yeniden aç"); process.exit(0); } catch { /* yok */ }

  let manifest;
  try {
    manifest = JSON.parse((await fetchBuf(MANIFEST_URL)).toString("utf8"));
  } catch (e) {
    log("manifest alınamadı (çevrimdışı/erişim yok) — yerel sürümle devam:", e.message);
    return;
  }
  const rawBase = manifest.rawBase || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
  log(`manifest v${manifest.version} — ${Object.keys(manifest.files || {}).length} dosya kontrol ediliyor`);

  let changed = 0;
  for (const [file, meta] of Object.entries(manifest.files || {})) {
    const local = path.join(ROOT, file);
    let localHash = "";
    try { localHash = createHash("sha256").update(await readFile(local)).digest("hex"); } catch { /* yok */ }
    if (localHash === meta.sha256) continue;
    try {
      const content = await fetchBuf(rawBase + file);
      if (createHash("sha256").update(content).digest("hex") !== meta.sha256) throw new Error("hash uyuşmadı");
      if (file === "agent/update.mjs") {
        await writeFile(local + ".pending", content);
        log("update.mjs güncellendi -> bir sonraki açılışta pending uygulanacak");
      } else {
        await writeFile(local, content);
        log("güncellendi:", file);
      }
      changed++;
    } catch (e) { log("indirilemedi:", file, e.message); }
  }
  log(changed ? `${changed} dosya GitHub'dan güncellendi` : "her şey güncel");
}

main().catch((e) => { console.error("[update] hata:", e.message); process.exit(0); });
