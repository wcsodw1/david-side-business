/* Service worker：讓 App 可安裝到主畫面，且離線也能開。
   策略：stale-while-revalidate（先用快取秒開，背景更新；下次開啟就是新版）。 */
const CACHE = "ida-shell-v6";
const SHELL = ["./", "index.html", "style.css", "app.js", "data.js", "manifest.webmanifest", "install.html",
  "img/hero.jpg", "img/tile.jpg", "img/paint.jpg", "img/ceiling.jpg", "img/floor.jpg", "img/empty.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png", "icons/qr.svg", "img/brand/install-qr.png",
  "img/brand/logo-white.svg", "img/brand/logo-dark.svg", "icons/icon-maskable-512.png", "themes/", "themes.css", "img/brand/themes/industrial-logo.svg", "img/brand/themes/european-logo.svg", "img/brand/themes/tropical-logo.svg", "img/brand/themes/muji-logo.svg", "img/brand/themes/kyoto-logo.svg",
  "themes/industrial/", "themes/industrial/manifest.webmanifest", "icons/themes/industrial-192.png", "themes/european/", "themes/european/manifest.webmanifest", "icons/themes/european-192.png", "themes/tropical/", "themes/tropical/manifest.webmanifest", "icons/themes/tropical-192.png", "themes/muji/", "themes/muji/manifest.webmanifest", "icons/themes/muji-192.png", "themes/kyoto/", "themes/kyoto/manifest.webmanifest", "icons/themes/kyoto-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then((res) => { if (res && res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
