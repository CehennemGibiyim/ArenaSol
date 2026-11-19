#!/usr/bin/env node
/**
 * Arena Self-Updater — Windows paketi açılırken VE çalışırken GitHub'ı izler.
 * ---------------------------------------------------------------------------
 * Kaynak: raw.githubusercontent.com/<repo>/<branch>/agent/manifest.json
 * Her dosyanın sha256 özeti yerelle karşılaştırılır; farklıysa indirilir.
 * Çalışan betiğin üzerine yazılamadığı için `.pending` olarak bırakılır ve
 * bir sonraki açılışta devreye girer (Arena-Live-OS.bat bunu uygular).
 *
 * Ortam:
 *   ARENA_REPO="kullanici/depo"  (varsayılan CehennemGibiyim/ArenaSol)
 *   ARENA_BRANCH="main"
 *   ARENA_MANIFEST_URL="..."
 *   UPDATE_CHECK_SECONDS=1800    (ajanın periyodik kontrolü için)
 *
 * Çıktı: agent/data/update.json (panel ve durum göstergesi için)
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, rename, access, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "..");
const REPO = process.env.ARENA_REPO || process.env.GITHUB_REPOSITORY || "CehennemGibiyim/ArenaSol";
const BRANCH = process.env.ARENA_BRANCH || "main";
const MANIFEST_URL =
  process.env.ARENA_MANIFEST_URL || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/agent/manifest.json`;
const TIMEOUT = Number(process.env.UPDATE_TIMEOUT_MS || 15000);
const RAW_BASE = process.env.ARENA_RAW_BASE || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;
const log = (...a) => console.log(`[update ${new Date().toLocaleTimeString("tr-TR")}]`, ...a);

async function fetchBuf(url) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { "User-Agent": "arena-updater", Accept: "application/json,*/*", "Cache-Control": "no-cache" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

async function writeStatus(status) {
  try {
    await mkdir(path.join(ROOT, "agent", "data"), { recursive: true });
    await writeFile(
      path.join(ROOT, "agent", "data", "update.json"),
      JSON.stringify({ ...status, checkedAt: new Date().toISOString() }, null, 2),
    );
  } catch {
    /* durum dosyası opsiyonel */
  }
}

/** Yalnızca manifesti okuyup sürüm karşılaştırması yapar (hızlı kontrol). */
export async function checkForUpdates() {
  const manifest = JSON.parse((await fetchBuf(MANIFEST_URL)).toString("utf8"));
  let stale = 0;
  for (const [file, meta] of Object.entries(manifest.files || {})) {
    let localHash = "";
    try {
      localHash = createHash("sha256").update(await readFile(path.join(ROOT, file))).digest("hex");
    } catch {
      /* dosya yok */
    }
    if (localHash !== meta.sha256) stale++;
  }
  return { version: manifest.version, repo: manifest.repo || REPO, files: Object.keys(manifest.files || {}).length, stale };
}

async function main() {
  // Önceki açılışta bırakılan pending güncellemeyi uygula
  const selfPath = path.join(ROOT, "agent", "update.mjs");
  const pending = selfPath + ".pending";
  try {
    await access(pending);
    await rename(pending, selfPath);
    log("bekleyen self-update uygulandı, lütfen betiği yeniden aç");
    await writeStatus({ ok: true, applied: "self", pending: false });
    process.exit(0);
  } catch {
    /* yok */
  }

  let manifest;
  try {
    manifest = JSON.parse((await fetchBuf(MANIFEST_URL)).toString("utf8"));
  } catch (e) {
    log("manifest alınamadı (çevrimdışı/erişim yok) — yerel sürümle devam:", e.message);
    await writeStatus({ ok: false, error: e.message });
    return;
  }
  const rawBase = manifest.rawBase || RAW_BASE;
  log(`manifest v${manifest.version} — ${Object.keys(manifest.files || {}).length} dosya kontrol ediliyor`);

  let changed = 0;
  let pendingSelf = false;
  for (const [file, meta] of Object.entries(manifest.files || {})) {
    const local = path.join(ROOT, file);
    let localHash = "";
    try {
      localHash = createHash("sha256").update(await readFile(local)).digest("hex");
    } catch {
      /* yok */
    }
    if (localHash === meta.sha256) continue;
    try {
      const content = await fetchBuf(rawBase + file);
      if (createHash("sha256").update(content).digest("hex") !== meta.sha256) throw new Error("hash uyuşmadı");
      if (file.endsWith(".mjs") && file.includes("agent/")) {
        // Çalışan .mjs dosyaları Windows'ta kilitli olabilir: pending bırak
        await writeFile(local + ".pending", content);
        if (file === "agent/update.mjs") pendingSelf = true;
        log("güncellendi (pending):", file);
      } else {
        await writeFile(local, content);
        log("güncellendi:", file);
      }
      changed++;
    } catch (e) {
      log("indirilemedi:", file, e.message);
    }
  }
  log(changed ? `${changed} dosya GitHub'dan güncellendi` : "her şey güncel");
  await writeStatus({
    ok: true,
    version: manifest.version,
    repo: manifest.repo || REPO,
    changed,
    pendingSelf,
    files: Object.keys(manifest.files || {}).length,
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SELF);
if (isDirectRun) main().catch((e) => { console.error("[update] hata:", e.message); process.exit(0); });
