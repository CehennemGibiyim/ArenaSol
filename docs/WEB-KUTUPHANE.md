# Arena Web Library — GitHub Pages kütüphanesi

`arena-widget.js`, Arena Live OS API'sinden beslenen **sıfır bağımlılıklı** bir overlay/metrik widget setidir.
GitHub Pages, Netlify, herhangi bir statik hosting veya OBS Browser Source üzerinde çalışır.

## Kurulum (GitHub Pages)

1. Panel → **Kütüphane** → **Web kütüphanesini indir** (zip).
2. Zip'i bir GitHub deposuna aktarın (ör. `arena-web-library`).
3. Depo → Settings → Pages → **Deploy from a branch → main / (root)**.
4. Adresi açın: `https://kullaniciadi.github.io/arena-web-library/`
5. Widget'lar Arena panelinize bağlanır. Panel adresi varsayılan `http://localhost:3000`'dir; uzak sunucu için:

```html
<script>window.ARENA_API_BASE = "https://panel.ornek.com";</script>
<script src="arena-widget.js"></script>
```

## Kullanım

```html
<div data-arena="goal"
     data-username="elif_live"
     data-goal="5000"
     data-label="Elmas Hedefi"></div>

<div data-arena="top-gifters" data-username="elif_live" data-rows="5"></div>
<div data-arena="chat" data-username="elif_live" data-rows="8"></div>
<div data-arena="alert" data-username="elif_live"></div>
<div data-arena="stats" data-username="elif_live"></div>
```

Programatik kullanım:

```js
const widget = ArenaWidget.mount("#hedef", {
  api: "https://panel.ornek.com",
  username: "elif_live",
  type: "goal",
});
widget.stop();
```

## Veri sözleşmesi

`GET {API}/api/live/feed?username={username}&session={id}`

```json
{
  "session": { "id": 1, "username": "elif_live", "mode": "demo", "status": "active" },
  "events": [{ "type": "gift", "nickname": "mertt34", "giftName": "Galaxy", "diamondCount": 1000, "repeatCount": 1 }],
  "leaderboard": [{ "username": "mertt34", "nickname": "mertt34", "diamonds": 4200, "gifts": 6 }],
  "overview": { "viewers": 3280, "diamonds": 18240, "gifts": 268, "followers": 214, "durationMin": 42 }
}
```

CORS etkin (`Access-Control-Allow-Origin: *`), böylece GitHub Pages üzerinden panel API'sine doğrudan erişilebilir.

## OBS kurulumu

1. OBS → Sources → **Browser** → `overlay.html` dosyasını veya Pages URL'sini ekleyin.
2. Genişlik 1920, yükseklik 1080.
3. **Shutdown source when not visible** seçeneğini kapatın.
4. Arka plan şeffaftır; `?type=goal` parametresi ile tek widget gösterebilirsiniz.

## Özelleştirme

- `data-accent`: `cyan | pink | violet | amber`
- `data-goal`: hedef elmas sayısı
- `data-rows`: liste satır sayısı
- CSS değişkenleri: `--arena-cyan`, `--arena-pink`, `--arena-violet`

MIT lisansı. TikTok ile resmi bağlantısı yoktur.
