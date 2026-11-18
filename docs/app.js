/* Arena web panel — docs/data/*.json okur, 5 sn'de bir yeniler, geri sayım canlı çalışır. */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString("tr-TR");

function clock(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

async function getJson(url) {
  const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function renderChests(list) {
  const now = Date.now();
  const active = (list || []).filter((c) => !c.opensAt || new Date(c.opensAt).getTime() > now - 90000);
  active.sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime());
  if (!active.length) {
    $("chests").innerHTML = '<p class="empty">Şu anda aktif sandık yok. Otomatik tarama 5 dakikada bir yenilenir.</p>';
    return;
  }
  $("chests").innerHTML = active.map((c) => {
    const left = c.opensAt ? new Date(c.opensAt).getTime() - now : 0;
    const open = left <= 0;
    return `<a class="card chest ${open ? "open" : ""}" href="https://www.tiktok.com/@${c.username}/live" target="_blank" rel="noopener">
      <div class="row"><b>@${c.username}</b><span class="tag">${c.kind === "bag" ? "Çanta" : "Sandık"}</span></div>
      <div class="nums"><span><b>${fmt(c.coins)}</b> jeton</span><span><b>${c.ratio}</b> oran</span><span><b>${fmt(c.slots)}</b> kontenjan</span></div>
      <div class="timer">${open ? "AÇIK — katıl" : "Açılışa " + clock(left)}</div>
    </a>`;
  }).join("");
}

function renderRooms(list) {
  if (!list || !list.length) {
    $("rooms").innerHTML = '<p class="empty">Doğrulanmış canlı yayın yok.</p>';
    return;
  }
  $("rooms").innerHTML = list.map((r) => `<a class="card room" href="https://www.tiktok.com/@${r.user}/live" target="_blank" rel="noopener">
    <div class="row"><b>@${r.user}</b><span class="src">${r.source || ""}${r.region ? " · " + r.region : ""}</span></div>
    <div class="sub">${(r.title || r.nickname || "TikTok LIVE")} · ${fmt(r.viewers)} izleyici</div>
  </a>`).join("");
}

async function load() {
  try {
    const [rooms, chests] = await Promise.all([getJson("data/rooms.json"), getJson("data/chests.json")]);
    $("meta").textContent = `Son güncelleme: ${new Date(rooms.generatedAt).toLocaleString("tr-TR")} · ${rooms.checked} hesap kontrol edildi · ${rooms.liveCount} canlı doğrulandı · ${chests.count} aktif sandık · kaynak: ${rooms.source}`;
    renderRooms(rooms.rooms);
    renderChests(chests.chests);
  } catch (e) {
    $("meta").textContent = "Veri alınamadı: " + e.message + " — bir sonraki otomatik tur bekleniyor.";
  }
}

load();
setInterval(load, 5000);          // veri 5 sn'de bir yenilenir
setInterval(() => renderChests(window.__lastChests || []), 1000); // geri sayım saniyelik
setInterval(async () => { try { window.__lastChests = (await getJson("data/chests.json")).chests; } catch {} }, 5000);
