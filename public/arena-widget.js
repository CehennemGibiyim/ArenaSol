/*!
 * Arena Web Library v1.0.0
 * TikTok LIVE overlay & metrik widget'ları — zero dependency, GitHub Pages uyumlu.
 * Kullanım: <script src="arena-widget.js"></script> + <div data-arena="goal" data-username="elif_live"></div>
 * Arena Live OS panel API'si ile çalışır: GET {api}/api/live/feed?username=...
 */
(function () {
  "use strict";

  var DEFAULT_API =
    (typeof window !== "undefined" && window.ARENA_API_BASE) || "http://localhost:3000";
  var STYLE_ID = "arena-widget-style";
  var POLL_MS = 2500;

  var CSS = [
    ":root{--arena-cyan:#25f4ee;--arena-pink:#fe2c55;--arena-violet:#8b5cf6;--arena-amber:#f5b642;}",
    ".arena-widget{font-family:Inter,'Segoe UI',system-ui,sans-serif;color:#f2f3fb;box-sizing:border-box;text-align:left;}",
    ".arena-widget *{box-sizing:border-box;}",
    ".arena-card{border-radius:16px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(160deg,rgba(12,13,22,.92),rgba(6,7,12,.88));padding:14px 16px;backdrop-filter:blur(12px);box-shadow:0 18px 48px -24px rgba(0,0,0,.9);min-width:230px;}",
    ".arena-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}",
    ".arena-title{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(242,243,251,.55);font-weight:700;}",
    ".arena-live{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.08em;color:#fff;background:rgba(254,44,85,.16);border:1px solid rgba(254,44,85,.4);padding:3px 8px;border-radius:999px;}",
    ".arena-live i{width:6px;height:6px;border-radius:50%;background:#fe2c55;box-shadow:0 0 0 3px rgba(254,44,85,.2);animation:arenaPulse 1.5s infinite;}",
    "@keyframes arenaPulse{0%,100%{opacity:1}50%{opacity:.35}}",
    ".arena-big{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums;}",
    ".arena-muted{font-size:11px;color:rgba(242,243,251,.5);}",
    ".arena-bar{height:9px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin:10px 0 7px;}",
    ".arena-bar > span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--arena-cyan),var(--arena-violet),var(--arena-pink));transition:width .6s ease;}",
    ".arena-row{display:flex;align-items:center;gap:9px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:12.5px;}",
    ".arena-row:last-child{border-bottom:0;}",
    ".arena-rank{width:20px;height:20px;border-radius:7px;display:grid;place-items:center;font-size:10.5px;font-weight:800;background:rgba(255,255,255,.08);color:rgba(255,255,255,.7);flex:none;}",
    ".arena-rank.top{background:linear-gradient(135deg,var(--arena-cyan),var(--arena-violet));color:#05060a;}",
    ".arena-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}",
    ".arena-value{font-weight:800;color:#9df9f5;font-variant-numeric:tabular-nums;font-size:12px;}",
    ".arena-msg{font-size:12.5px;line-height:1.45;}",
    ".arena-msg b{color:#9df9f5;}",
    ".arena-msg.bot{color:#c4b5fd;}",
    ".arena-alert{border-radius:16px;border:1px solid rgba(254,44,85,.45);background:linear-gradient(140deg,rgba(254,44,85,.22),rgba(124,58,237,.18));padding:14px 18px;animation:arenaIn .45s ease both;}",
    "@keyframes arenaIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}",
    ".arena-alert .who{font-weight:800;font-size:14px;}",
    ".arena-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;}",
    ".arena-cell{border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:8px 10px;background:rgba(255,255,255,.03);}",
    ".arena-cell .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;}",
    ".arena-cell .k{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(242,243,251,.45);font-weight:700;}",
    ".arena-err{font-size:11px;color:#ff9eb2;}",
    ".arena-foot{margin-top:9px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,243,251,.3);display:flex;justify-content:space-between;gap:8px;}",
  ].join("");

  function ensureStyle() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function num(value) {
    var n = Number(value || 0);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
    return new Intl.NumberFormat("tr-TR").format(n);
  }

  function goalBar(label, value, goal, accent) {
    var percent = Math.max(0, Math.min(100, goal > 0 ? Math.round((value / goal) * 100) : 0));
    return (
      '<div class="arena-card">' +
      '<div class="arena-head"><span class="arena-title">' + esc(label) + '</span><span class="arena-live"><i></i>CANLI</span></div>' +
      '<div class="arena-big">' + num(value) + " <span class=\"arena-muted\">/ " + num(goal) + (accent === "diamonds" ? " 💎" : "") + "</span></div>" +
      '<div class="arena-bar"><span style="width:' + percent + '%"></span></div>' +
      '<div class="arena-muted">Hedefin %' + percent + "'i tamamlandı · Arena Live OS</div>" +
      "</div>"
    );
  }

  function leaderboard(snapshot, limit) {
    var rows = (snapshot.leaderboard || []).slice(0, limit || 5);
    var html =
      '<div class="arena-card"><div class="arena-head"><span class="arena-title">Top Gifters</span><span class="arena-muted">' +
      esc(snapshot.session ? "@" + snapshot.session.username : "") +
      "</span></div>";
    if (!rows.length) html += '<div class="arena-muted">Henüz hediye yok. İlk destekçiyi bekliyoruz.</div>';
    rows.forEach(function (row, index) {
      html +=
        '<div class="arena-row"><span class="arena-rank' + (index === 0 ? " top" : "") + '">' + (index + 1) + "</span>" +
        '<span class="arena-name">' + esc(row.nickname || row.username) + "</span>" +
        '<span class="arena-value">' + num(row.diamonds) + " 💎</span></div>";
    });
    html += "</div>";
    return html;
  }

  function chat(snapshot, limit) {
    var events = (snapshot.events || [])
      .filter(function (event) {
        return event.type === "comment" || event.type === "bot" || event.type === "gift";
      })
      .slice(0, limit || 6)
      .reverse();
    var html = '<div class="arena-card"><div class="arena-head"><span class="arena-title">Canlı Sohbet</span><span class="arena-live"><i></i>LIVE</span></div>';
    if (!events.length) html += '<div class="arena-muted">Sohbet akışı bekleniyor...</div>';
    events.forEach(function (event) {
      if (event.type === "gift") {
        html +=
          '<div class="arena-msg">🎁 <b>' + esc(event.nickname || event.username) + "</b> " +
          esc(event.giftName) + " × " + num(event.repeatCount) + " gönderdi</div>";
      } else {
        html +=
          '<div class="arena-msg' + (event.type === "bot" ? " bot" : "") + '"><b>' +
          esc(event.nickname || event.username) + ":</b> " + esc(event.comment) + "</div>";
      }
    });
    html += "</div>";
    return html;
  }

  function stats(snapshot) {
    var overview = snapshot.overview || {};
    return (
      '<div class="arena-card"><div class="arena-head"><span class="arena-title">Yayın Metrikleri</span><span class="arena-live"><i></i>CANLI</span></div>' +
      '<div class="arena-grid">' +
      '<div class="arena-cell"><div class="v">' + num(overview.viewers) + '</div><div class="k">İzleyici</div></div>' +
      '<div class="arena-cell"><div class="v">' + num(overview.diamonds) + '</div><div class="k">Elmas</div></div>' +
      '<div class="arena-cell"><div class="v">' + num(overview.gifts) + '</div><div class="k">Hediye</div></div>' +
      '<div class="arena-cell"><div class="v">' + num(overview.followers) + '</div><div class="k">Takipçi</div></div>' +
      "</div>" +
      '<div class="arena-foot"><span>Arena Live OS</span><span>' + (overview.durationMin || 0) + " dk</span></div></div>"
    );
  }

  function alertBox(snapshot) {
    var gift =
      (snapshot.events || []).filter(function (event) {
        return event.type === "gift" && Number(event.diamondCount) * Number(event.repeatCount || 1) >= 100;
      })[0] || (snapshot.events || []).filter(function (event) { return event.type === "gift"; })[0];
    if (!gift) {
      return '<div class="arena-card"><div class="arena-muted">Büyük hediye bekleniyor...</div></div>';
    }
    return (
      '<div class="arena-alert"><div class="arena-title" style="margin-bottom:6px">Hediye Alarmı</div>' +
      '<div class="who">' + esc(gift.nickname || gift.username) + " → " + esc(gift.giftName) + "</div>" +
      '<div class="arena-muted">' + num(Number(gift.diamondCount) * Number(gift.repeatCount || 1)) + " elmas · " + num(gift.repeatCount) + " adet</div></div>"
    );
  }

  function render(type, snapshot, element) {
    var accent = element.getAttribute("data-accent") || "cyan";
    var limit = Number(element.getAttribute("data-rows") || 5);
    var goal = Number(element.getAttribute("data-goal") || 5000);
    if (type === "goal") {
      var value =
        (element.getAttribute("data-metric") || "diamonds") === "followers"
          ? snapshot.overview.followers
          : snapshot.overview.diamonds;
      return goalBar(element.getAttribute("data-label") || "Elmas Hedefi", value, goal, "diamonds");
    }
    if (type === "top-gifters") return leaderboard(snapshot, limit);
    if (type === "chat") return chat(snapshot, limit);
    if (type === "alert") return alertBox(snapshot);
    return stats(snapshot);
  }

  function Widget(element, options) {
    this.element = element;
    this.options = options;
    this.type = element.getAttribute("data-arena") || "stats";
    this.username = element.getAttribute("data-username") || options.username || "";
    this.session = element.getAttribute("data-session") || options.session || "";
    this.api = (element.getAttribute("data-api") || options.api || DEFAULT_API).replace(/\/$/, "");
    this.timer = null;
    this.stopped = false;
  }

  Widget.prototype.url = function () {
    var params = new URLSearchParams();
    if (this.username) params.set("username", this.username.replace(/^@+/, ""));
    if (this.session) params.set("session", this.session);
    return this.api + "/api/live/feed?" + params.toString();
  };

  Widget.prototype.tick = function () {
    var self = this;
    if (self.stopped) return;
    fetch(self.url(), { headers: { Accept: "application/json" }, mode: "cors" })
      .then(function (response) {
        if (!response.ok) throw new Error("API " + response.status);
        return response.json();
      })
      .then(function (snapshot) {
        try {
          self.element.innerHTML = render(self.type, snapshot, self.element);
        } catch (error) {
          self.element.innerHTML = '<div class="arena-card"><div class="arena-err">Render hatası: ' + esc(error.message) + "</div></div>";
        }
      })
      .catch(function (error) {
        self.element.innerHTML =
          '<div class="arena-card"><div class="arena-title">Arena Live OS</div><div class="arena-err">Bağlantı yok: ' +
          esc(error.message) +
          '</div><div class="arena-muted">Arena panelini başlatın veya data-api değerini kontrol edin.</div></div>';
      });
  };

  Widget.prototype.start = function () {
    var self = this;
    self.element.classList.add("arena-widget");
    self.tick();
    self.timer = setInterval(function () {
      self.tick();
    }, POLL_MS);
    return self;
  };

  Widget.prototype.stop = function () {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  };

  function mount(element, options) {
    ensureStyle();
    if (typeof element === "string") element = document.querySelector(element);
    if (!element) return null;
    if (element.__arenaWidget) return element.__arenaWidget;
    var widget = new Widget(element, options || {});
    element.__arenaWidget = widget.start();
    return widget;
  }

  function autoMount() {
    ensureStyle();
    var nodes = document.querySelectorAll("[data-arena]");
    for (var i = 0; i < nodes.length; i += 1) mount(nodes[i], {});
  }

  var api = {
    version: "1.0.0",
    mount: mount,
    autoMount: autoMount,
    setApiBase: function (base) {
      window.ARENA_API_BASE = base;
    },
    fetchSnapshot: function (username, session) {
      var params = new URLSearchParams();
      if (username) params.set("username", String(username).replace(/^@+/, ""));
      if (session) params.set("session", session);
      return fetch(DEFAULT_API + "/api/live/feed?" + params.toString()).then(function (response) {
        return response.json();
      });
    },
  };

  if (typeof window !== "undefined") {
    window.ArenaWidget = api;
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoMount);
    } else {
      autoMount();
    }
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
