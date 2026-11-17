/* PWA service worker：網路優先（永遠先拿最新版），斷線時才用上次快取。不快取 3D 外部程式庫以外的跨網域內容。 */
const CACHE = "dsb-pwa-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), same = u.origin === location.origin, cdn = u.hostname === "cdn.jsdelivr.net";
  if (!same && !cdn) return;
  if (u.search.includes("_=")) return;   // update-check 的輪詢請求不要碰
  e.respondWith(fetch(r).then((res) => { if (res && res.ok && (res.type === "basic" || res.type === "cors")) { const c = res.clone(); caches.open(CACHE).then((ch) => ch.put(r, c)).catch(() => {}); } return res; }).catch(() => caches.match(r).then((m) => m || (r.mode === "navigate" ? caches.match("./") : undefined))));
});
