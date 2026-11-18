import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INDEX_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Arena Web Library — TikTok LIVE Overlay Kütüphanesi</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(800px 500px at 10% -10%,rgba(37,244,238,.14),transparent),radial-gradient(700px 500px at 90% 0%,rgba(254,44,85,.16),transparent),#050509;color:#eef0fa;font-family:Inter,'Segoe UI',system-ui,sans-serif;padding:40px 20px}
  .wrap{max-width:1080px;margin:0 auto}
  .logo{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:.22em;font-size:13px}
  .mark{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#25f4ee,#fe2c55);display:grid;place-items:center;color:#05060a;font-weight:900}
  h1{font-size:clamp(30px,5vw,52px);line-height:1.03;letter-spacing:-.03em;margin:26px 0 12px}
  h1 span{background:linear-gradient(96deg,#8ffcf8,#b9a7ff 50%,#ff8aa4);-webkit-background-clip:text;background-clip:text;color:transparent}
  p{color:rgba(238,240,250,.64);line-height:1.65;max-width:680px}
  .panel{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);border-radius:18px;padding:18px;margin:18px 0}
  .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));align-items:start}
  code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
  pre{background:#08080f;border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:14px;overflow:auto}
  .badge{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(37,244,238,.35);background:rgba(37,244,238,.1);color:#9df9f5;border-radius:99px;padding:4px 10px}
  .btn{display:inline-block;margin-top:12px;background:linear-gradient(100deg,#25f4ee,#7c5cff,#fe2c55);color:#05060a;font-weight:800;font-size:13px;padding:10px 16px;border-radius:11px;text-decoration:none}
  footer{margin-top:36px;font-size:11px;color:rgba(238,240,250,.35)}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo"><span class="mark">A</span> ARENA WEB LIBRARY</div>
  <h1>TikTok LIVE overlay'leri<br /><span>tek satır HTML ile.</span></h1>
  <p>Zero dependency widget seti. Arena Live OS panelinizden gelen canlı elmas, top gifter, sohbet ve hedef verisini GitHub Pages üzerinde yayınlayın. OBS'e browser source olarak ekleyin.</p>
  <div class="panel">
    <strong style="font-size:13px">Canlı demo</strong>
    <div class="grid" style="margin-top:14px">
      <div data-arena="goal" data-username="elif_live" data-goal="5000" data-label="Elmas Hedefi"></div>
      <div data-arena="top-gifters" data-username="elif_live" data-rows="4"></div>
      <div data-arena="chat" data-username="elif_live" data-rows="5"></div>
      <div data-arena="stats" data-username="elif_live"></div>
    </div>
  </div>
  <div class="grid">
    <div class="panel">
      <span class="badge">Embed</span>
      <pre>&lt;script src="arena-widget.js"&gt;&lt;/script&gt;
&lt;div data-arena="goal"
     data-username="elif_live"
     data-goal="5000"&gt;&lt;/div&gt;</pre>
    </div>
    <div class="panel">
      <span class="badge">API</span>
      <p style="margin-top:12px;font-size:12px">Paneliniz kapalıysa widget "Bağlantı yok" durumuna düşer. Demo için paneli başlatın:</p>
      <pre>npm run start
# http://localhost:3000
# /api/live/feed?username=elif_live</pre>
    </div>
  </div>
  <a class="btn" href="overlay.html" target="_blank">Overlay'i aç ↗</a>
  <a class="btn" href="sandik.html" target="_blank" style="background:rgba(255,255,255,.08);color:#eef0fa;margin-left:8px">Sandık radarı ↗</a>
  <footer>Arena Live OS · MIT · TikTok resmi API'si değildir.</footer>
</div>
<script>window.ARENA_API_BASE = window.ARENA_API_BASE || localStorage.getItem("arenaApi") || "http://localhost:3000";</script>
<script src="arena-widget.js"></script>
</body>
</html>`;

const OVERLAY_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Arena Overlay</title>
<style>
  html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:Inter,'Segoe UI',system-ui,sans-serif}
  #stage{position:fixed;inset:0;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;padding:28px;width:min(420px,90vw)}
</style>
</head>
<body>
<div id="stage"></div>
<script>
  var params = new URLSearchParams(location.search);
  var type = params.get("type") || "all";
  var username = params.get("username") || "elif_live";
  var api = params.get("api") || window.ARENA_API_BASE || "http://localhost:3000";
  if (params.get("api")) localStorage.setItem("arenaApi", params.get("api"));
  window.ARENA_API_BASE = api;
  var widgets = type === "all" ? ["alert", "goal", "top-gifters"] : [type];
  var stage = document.getElementById("stage");
  widgets.forEach(function (kind) {
    var el = document.createElement("div");
    el.setAttribute("data-arena", kind);
    el.setAttribute("data-username", username);
    el.setAttribute("data-goal", params.get("goal") || "5000");
    stage.appendChild(el);
  });
</script>
<script src="arena-widget.js"></script>
</body>
</html>`;

const SANDIK_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Arena Sandık Radarı — GitHub Pages</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(800px 500px at 12% -10%,rgba(37,244,238,.14),transparent),radial-gradient(700px 500px at 88% 0%,rgba(254,44,85,.16),transparent),#050509;color:#eef0fa;font-family:Inter,'Segoe UI',system-ui,sans-serif;padding:24px 16px}
  .wrap{max-width:1180px;margin:0 auto}
  .head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between}
  .logo{display:flex;align-items:center;gap:10px;font-weight:900;letter-spacing:.2em;font-size:12px}
  .mark{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#25f4ee,#fe2c55);display:grid;place-items:center;color:#05060a;font-weight:900}
  input,select{background:#0a0b12;border:1px solid rgba(255,255,255,.12);color:#eef0fa;border-radius:9px;padding:7px 10px;font-size:12px;font-family:inherit}
  button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#eef0fa;border-radius:9px;padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
  button.on{border-color:rgba(37,244,238,.5);background:rgba(37,244,238,.12);color:#9df9f5}
  .status{margin:12px 0 4px;font-size:11px;color:rgba(238,240,250,.45)}
  .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));margin-top:12px}
  .card{border:1px solid rgba(255,255,255,.1);background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));border-radius:14px;padding:13px}
  .card.open{border-color:rgba(254,44,85,.45)}
  .card.gold{border-color:rgba(245,182,66,.4)}
  .row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
  .who{font-size:13px;font-weight:700}
  .sub{font-size:10px;color:rgba(238,240,250,.4);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .timer{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
  .metrics{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:9px}
  .m{border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:5px;text-align:center;background:rgba(0,0,0,.25)}
  .m b{display:block;font-size:13px;font-variant-numeric:tabular-nums}
  .m span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:rgba(238,240,250,.35)}
  a.open-live{display:block;margin-top:9px;text-align:center;padding:8px;border-radius:9px;background:linear-gradient(100deg,#25f4ee,#7c5cff,#fe2c55);color:#05060a;font-weight:800;font-size:11.5px;text-decoration:none}
  .empty{padding:40px;text-align:center;color:rgba(238,240,250,.4);font-size:12px}
  .tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
  .tabs button{font-size:11px;padding:5px 9px}
  .err{color:#ff9eb2;font-size:11px;margin-top:8px}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div class="logo"><span class="mark">A</span> ARENA SANDIK RADARI</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <input id="api" placeholder="Panel adresi" style="width:230px" />
      <input id="q" placeholder="Yayıncı ara" style="width:130px" />
      <select id="sort">
        <option value="opens_at">Açılış</option>
        <option value="coins">Jeton</option>
        <option value="ratio">Oran</option>
        <option value="per_slot">Kişi başı</option>
        <option value="viewers">İzleyici</option>
      </select>
      <button id="dir">↓</button>
      <button id="refresh">↻</button>
    </div>
  </div>
  <div class="tabs" id="tabs"></div>
  <div class="status" id="status">yükleniyor…</div>
  <div class="err" id="err"></div>
  <div class="grid" id="grid"></div>
</div>
<script>
  var API = localStorage.getItem("arenaApi") || window.ARENA_API_BASE || "http://localhost:3000";
  var state = { tab: "chest", q: "", sort: "opens_at", desc: true, chests: [], flows: [], tabs: [] };
  var apiInput = document.getElementById("api");
  var qInput = document.getElementById("q");
  var sortInput = document.getElementById("sort");
  var dirBtn = document.getElementById("dir");
  apiInput.value = API;

  function fmt(n){ n=Number(n)||0; if(n>=1e6)return (n/1e6).toFixed(1)+"M"; if(n>=1e3)return (n/1e3).toFixed(n%1e3===0?0:1)+"K"; return new Intl.NumberFormat("tr-TR").format(n); }
  function clock(s){ s=Math.max(0,Math.round(s)); if(s<60)return s+"s"; var m=Math.floor(s/60); if(m<60)return m+":"+String(s%60).padStart(2,"0"); return Math.floor(m/60)+"h"+String(m%60).padStart(2,"0"); }
  function color(s){ return s<=0?"#ff3b5c":s<=30?"#ffa62b":"#2ee6a8"; }
  function esc(v){ return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }

  function renderTabs(counts){
    var el = document.getElementById("tabs");
    el.innerHTML = "";
    (state.tabs.length ? state.tabs : [{id:"chest",label:"Sandık",filter:{kind:"chest"}},{id:"flow",label:"Jeton akışı",filter:{kind:"live"}}]).forEach(function(tab){
      var b = document.createElement("button");
      b.textContent = tab.label + " (" + (counts && counts[tab.id] != null ? counts[tab.id] : 0) + ")";
      if (state.tab === tab.id) b.className = "on";
      b.onclick = function(){ state.tab = tab.id; load(); };
      el.appendChild(b);
    });
  }

  function currentTab(){
    return state.tabs.find(function(t){ return t.id === state.tab; }) || { filter: { kind: "chest" } };
  }

  function render(){
    var grid = document.getElementById("grid");
    var tab = currentTab();
    var rows = (state.tab === "flow" || (tab.filter && tab.filter.kind === "live")) ? state.flows : state.chests;
    if (state.q) rows = rows.filter(function(r){ return (r.username+" "+(r.nickname||"")+" "+(r.title||"")).toLowerCase().indexOf(state.q.toLowerCase()) >= 0; });
    grid.innerHTML = "";
    if (!rows.length) { grid.innerHTML = '<div class="empty">Uygun sandık yok — panelde tarama başlatın.</div>'; return; }
    rows.forEach(function(r){
      var isFlow = r.kind === "live";
      var left = isFlow ? 0 : Math.round((new Date(r.opensAt || Date.now()).getTime() - Date.now())/1000);
      var el = document.createElement("div");
      el.className = "card" + (!isFlow && left <= 0 ? " open" : "") + (r.variant === "gold" ? " gold" : "");
      el.innerHTML =
        '<div class="row"><div style="min-width:0"><div class="who">@'+esc(r.username)+'</div><div class="sub">'+esc(r.title || (isFlow?"jeton akışı":r.variant))+'</div></div>'+
        '<div style="text-align:right"><div class="timer" style="color:'+(isFlow?"#2ee6a8":color(left))+'">'+(isFlow?"●":(left>0?clock(left):"●"))+'</div>'+
        '<div class="sub">'+(isFlow?"canlı":(left>0?"açılış":"açık"))+'</div></div></div>'+
        '<div class="metrics"><div class="m"><b>'+fmt(r.coins)+'</b><span>Jeton</span></div>'+
        '<div class="m"><b style="color:#9df9f5">'+(r.ratio||0)+'</b><span>Oran</span></div>'+
        '<div class="m"><b>'+fmt(r.slots)+'</b><span>'+(isFlow?"Gönderen":"Kontenjan")+'</span></div></div>'+
        '<div class="sub" style="margin-top:7px">'+fmt(r.viewers)+' izleyici'+(isFlow?"":" · katılan "+fmt(r.joined))+'</div>'+
        '<a class="open-live" href="https://www.tiktok.com/@'+esc(r.username)+'/live" target="_blank" rel="noreferrer">CANLI'yı Aç</a>';
      grid.appendChild(el);
    });
  }

  async function load(){
    var tab = currentTab();
    var params = new URLSearchParams();
    Object.keys(tab.filter || {}).forEach(function(k){
      var v = tab.filter[k];
      params.set(k, Array.isArray(v) ? v.join(",") : v);
    });
    params.set("sort", state.sort);
    params.set("desc", state.desc ? "1" : "0");
    if (state.q) params.set("q", state.q);
    try {
      var res = await fetch(API + "/api/chests?" + params.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      state.chests = data.chests || [];
      state.flows = data.flows || [];
      if (data.tabs && data.tabs.length) state.tabs = data.tabs;
      renderTabs(data.tab_counts || {});
      render();
      document.getElementById("status").textContent = (data.count || 0) + " sandık · " + (state.flows.length) + " akış odası · " + new Date().toLocaleTimeString("tr-TR");
      document.getElementById("err").textContent = "";
    } catch (e) {
      document.getElementById("err").textContent = "Bağlantı yok: " + e.message + " — paneli başlatın veya API adresini girin.";
    }
  }

  apiInput.onchange = function(){ API = apiInput.value.replace(/\/$/,""); localStorage.setItem("arenaApi", API); load(); };
  qInput.oninput = function(){ state.q = qInput.value; render(); };
  sortInput.onchange = function(){ state.sort = sortInput.value; load(); };
  dirBtn.onclick = function(){ state.desc = !state.desc; dirBtn.textContent = state.desc ? "↓" : "↑"; load(); };
  document.getElementById("refresh").onclick = load;
  setInterval(load, 15000);
  setInterval(render, 1000);
  load();
</script>
</body>
</html>`;

const README = `# Arena Web Library

TikTok LIVE overlay & metrik widget'ları. **Zero dependency**, GitHub Pages uyumlu, OBS browser source ile çalışır.
Arena Live OS panel API'sine bağlanır: \`GET /api/live/feed?username=...\`

## Dosyalar
- \`arena-widget.js\` — kütüphane (vanilla JS, ~7 KB)
- \`index.html\` — demo sayfası (GitHub Pages ana sayfası)
- \`overlay.html\` — OBS şeffaf overlay
- \`sandik.html\` — GitHub Pages sandık radarı (panel API'sinden filtre + sıralama)
- \`.github/workflows/pages.yml\` — otomatik Pages deploy

## GitHub Pages yayını
1. Bu klasörü bir GitHub deposuna push edin.
2. Settings → Pages → Deploy from a branch → main / (root).
3. \`https://KULLANICI.github.io/DEPO/\` adresini açın.

## Widget tipleri
\`\`\`html
<div data-arena="goal" data-username="elif_live" data-goal="5000"></div>
<div data-arena="top-gifters" data-username="elif_live" data-rows="5"></div>
<div data-arena="chat" data-username="elif_live" data-rows="8"></div>
<div data-arena="alert" data-username="elif_live"></div>
<div data-arena="stats" data-username="elif_live"></div>
<script src="arena-widget.js"></script>
\`\`\`

Panel adresi farklıysa: \`<script>window.ARENA_API_BASE="https://panel.ornek.com"</script>\`

## JavaScript API
\`\`\`js
ArenaWidget.mount("#hedef", { api, username, type: "goal" });
ArenaWidget.fetchSnapshot("elif_live").then(console.log);
ArenaWidget.setApiBase("https://panel.ornek.com");
\`\`\`

## OBS
Sources → Browser → \`overlay.html?username=elif_live&type=all\` → 1920x1080, arka plan şeffaf.

## Güvenlik notu
API'yi herkese açık yayınlıyorsanız reverse proxy + token ekleyin. Widget yalnızca okuma yapar.

MIT License · Arena Live OS
`;

const PAGES_WORKFLOW = `name: Deploy Arena Web Library
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
`;

const LICENSE = `MIT License

Copyright (c) ${new Date().getFullYear()} Arena Live OS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export async function GET() {
  try {
    const zip = new JSZip();
    const pub = path.join(process.cwd(), "public", "arena-widget.js");
    let widget: string;
    try {
      widget = await readFile(pub, "utf8");
    } catch {
      widget = "/* arena-widget.js bulunamadı — panel public klasörünü kontrol edin */";
    }
    const folder = zip.folder("arena-web-library");
    if (!folder) throw new Error("Zip klasörü oluşturulamadı");
    folder.file("arena-widget.js", widget);
    folder.file("index.html", INDEX_HTML);
    folder.file("overlay.html", OVERLAY_HTML);
    folder.file("sandik.html", SANDIK_HTML);
    folder.file("README.md", README);
    folder.file("LICENSE", LICENSE);
    folder.file(".nojekyll", "");
    folder.file(".github/workflows/pages.yml", PAGES_WORKFLOW);
    folder.file(
      "SURUM.json",
      JSON.stringify(
        {
          name: "Arena Web Library",
          version: "1.0.0",
          license: "MIT",
          generatedAt: new Date().toISOString(),
          widgets: ["goal", "top-gifters", "chat", "alert", "stats"],
          api: "/api/live/feed?username={username}&session={id}",
          host: "GitHub Pages / OBS Browser Source",
        },
        null,
        2,
      ),
    );

    const buffer = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new Response(new Blob([buffer as unknown as ArrayBuffer]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="arena-web-library.zip"',
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
