/* Arena web panel — docs/data/*.json okur, 5 sn'de bir yeniler, geri sayım canlı çalışır. */
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString("tr-TR");

function clock(ms) {
  const t = Math.max(0, Math.round(ms / 1000));
  if (t < 60) return `${t} sn`;
  const m = Math.floor(t / 60);
  if (m < 60) return `${String(m).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return `${Math.floor(m / 60)}s ${String(m % 60).padStart(2, "0")}dk`;
}

async function getJson(url) {
  const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

/* GitHub Pages adresinden depo bilgisini çıkar: <user>.github.io/<repo> */
function repoInfo() {
  const host = location.hostname;
  const parts = location.pathname.split("/").filter(Boolean);
  if (host.endsWith(".github.io")) {
    const owner = host.replace(".github.io", "");
    const repo = parts[0] || "ArenaSol";
    return { owner, repo };
  }
  return { owner: "CehennemGibiyim", repo: "ArenaSol" };
}

(function wireDownloads() {
  const { owner, repo } = repoInfo();
  const url = `https://github.com/${owner}/${repo}/releases`;
  for (const id of ["download", "download2"]) {
    const el = $(id);
    if (el) el.href = url;
  }
  const actions = document.querySelector('a[href*="/actions"]');
  if (actions) actions.href = `https://github.com/${owner}/${repo}/actions`;
})();

let state = { chests: [], rooms: [], q: "", sort: "opens_at", desc: true };

function chestsForView() {
  const now = Date.now();
  let rows = (state.chests || []).filter((c) => !c.opensAt || new Date(c.opensAt).getTime() > now - 120000);
  if (state.q) {
    const q = state.q.toLowerCase();
    rows = rows.filter((c) => `${c.username} ${c.nickname || ""} ${c.title || ""}`.toLowerCase().includes(q));
  }
  const key = state.sort;
  rows.sort((a, b) => {
    let av;
    let bv;
    if (key === "opens_at") {
      av = new Date(a.opensAt || 0).getTime();
      bv = new Date(b.opensAt || 0).getTime();
    } else if (key === "ratio") {
      av = Number(a.ratio ?? (a.coins || 0) / Math.max(1, a.slots || 1));
      bv = Number(b.ratio ?? (b.coins || 0) / Math.max(1, b.slots || 1));
    } else {
      av = Number(a[key] || 0);
      bv = Number(b[key] || 0);
    }
    return state.desc ? bv - av : av - bv;
  });
  return rows;
}

function renderChests() {
  const list = chestsForView();
  const box = $("chests");
  if (!list.length) {
    box.innerHTML =
      '<p class="empty">Şu anda aktif sandık yok. Otomatik tarama 5 dakikada bir yenilenir; sonuç boşsa sahte kayıt üretilmez.</p>';
    return;
  }
  const now = Date.now();
  box.innerHTML = list
    .map((c) => {
      const left = c.opensAt ? new Date(c.opensAt).getTime() - now : 0;
      const open = left <= 0;
      const tier = c.variant === "gold" || c.skinId === 2 ? "gold" : "";
      return `<a class="card ${open ? "open" : ""} ${tier}" href="https://www.tiktok.com/@${c.username}/live" target="_blank" rel="noopener">
        <div class="row">
          <div style="min-width:0">
            <div class="who">@${c.username}</div>
            <div class="sub">${c.title || c.nickname || "TikTok LIVE"}</div>
          </div>
          <div>
            <div class="timer ${open ? "open" : ""}">${open ? "● AÇIK" : clock(left)}</div>
            <div class="sub" style="text-align:right">${open ? "katıl" : "açılışa"}</div>
          </div>
        </div>
        <div class="nums">
          <div><b>${fmt(c.coins)}</b><span>Jeton</span></div>
          <div><b style="color:#9df9f5">${c.ratio ?? Math.round(((c.coins || 0) / Math.max(1, c.slots || 1)) * 100) / 100}</b><span>Oran</span></div>
          <div><b>${fmt(c.slots)}</b><span>Kontenjan</span></div>
        </div>
        <div class="foot">
          <span>${fmt(c.viewers)} izleyici${c.kind === "bag" ? " · çanta" : ""}</span>
          <span class="tag">${c.variant === "gold" ? "ALTIN" : c.kind === "bag" ? "ÇANTA" : "SANDIK"}</span>
        </div>
        <span class="join">CANLI'yi Aç · Manuel katıl</span>
      </a>`;
    })
    .join("");
}

function renderRooms() {
  // data/rooms.json artık çevrimdışı havuzu da taşır; listelemede yalnızca canlılar görünür.
  const list = (state.rooms || []).filter((room) => room.live !== false);
  $("room-count").textContent = `${list.length} oda`;
  if (!list.length) {
    $("rooms").innerHTML = '<p class="empty">Doğrulanmış canlı yayın yok. Bir sonraki tarama 5 dakika içinde.</p>';
    return;
  }
  $("rooms").innerHTML = list
    .map(
      (r) => `<a class="card" href="https://www.tiktok.com/@${r.user || r.username}/live" target="_blank" rel="noopener">
      <div class="row">
        <div style="min-width:0">
          <div class="who">@${r.user || r.username}</div>
          <div class="sub">${r.title || r.nickname || "TikTok LIVE"}</div>
        </div>
        <span class="tag">${r.region || "LIVE"}</span>
      </div>
      <div class="foot"><span>${fmt(r.viewers)} izleyici</span><span>${r.source || "radar"}</span></div>
    </a>`,
    )
    .join("");
}

function renderKpis() {
  const now = Date.now();
  const active = (state.chests || []).filter((c) => !c.opensAt || new Date(c.opensAt).getTime() > now - 120000);
  $("kpi-chests").textContent = active.length;
  $("kpi-coins").textContent = `${fmt(active.reduce((sum, c) => sum + Number(c.coins || 0), 0))} jeton`;
  $("kpi-rooms").textContent = (state.rooms || []).filter((room) => room.live !== false).length;
  const best = active.reduce((max, c) => {
    const ratio = Number(c.ratio ?? (c.coins || 0) / Math.max(1, c.slots || 1));
    return ratio > max ? ratio : max;
  }, 0);
  $("kpi-ratio").textContent = best || "0";
  renderChests();
}

function renderStatus(status, roomsMeta) {
  if (status && status.generatedAt) {
    const age = Math.max(0, Math.round((Date.now() - new Date(status.generatedAt).getTime()) / 1000));
    $("kpi-status").textContent = status.ok === false ? "HATA" : "AÇIK";
    $("kpi-heartbeat").textContent =
      age < 90 ? `${age} sn önce tarandı` : `${Math.round(age / 60)} dk önce tarandı`;
  } else if (roomsMeta && roomsMeta.generatedAt) {
    $("kpi-status").textContent = "AÇIK";
    $("kpi-heartbeat").textContent = `son veri ${new Date(roomsMeta.generatedAt).toLocaleTimeString("tr-TR")}`;
  }
}

async function load() {
  const results = await Promise.allSettled([
    getJson("data/rooms.json"),
    getJson("data/chests.json"),
    getJson("data/status.json"),
  ]);
  const rooms = results[0].status === "fulfilled" ? results[0].value : null;
  const chests = results[1].status === "fulfilled" ? results[1].value : null;
  const status = results[2].status === "fulfilled" ? results[2].value : null;

  if (rooms) state.rooms = rooms.rooms || [];
  if (chests) state.chests = chests.chests || [];

  if (rooms || chests) {
    const when = rooms?.generatedAt || chests?.generatedAt;
    $("meta").textContent = [
      when ? `Son güncelleme: ${new Date(when).toLocaleString("tr-TR")}` : "",
      rooms ? `${rooms.checked} hesap kontrol edildi` : "",
      rooms ? `${rooms.liveCount} canlı doğrulandı` : "",
      chests ? `${chests.count} aktif sandık` : "",
      `kaynak: ${rooms?.source || chests?.source || "GitHub Actions"}`,
    ]
      .filter(Boolean)
      .join(" · ");
    renderKpis();
    renderRooms();
    renderStatus(status, rooms);
  } else {
    $("meta").textContent =
      "Veri alınamadı — GitHub Actions taraması henüz çalışmamış olabilir. Bir sonraki otomatik tur bekleniyor.";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("q").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderChests();
  });
  $("sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    state.desc = e.target.value !== "opens_at";
    $("dir").textContent = state.desc ? "↓" : "↑";
    renderChests();
  });
  $("dir").addEventListener("click", () => {
    state.desc = !state.desc;
    $("dir").textContent = state.desc ? "↓" : "↑";
    renderChests();
  });
  $("refresh").addEventListener("click", () => void load());

  load();
  setInterval(load, 5000);
  setInterval(renderChests, 1000);
});
