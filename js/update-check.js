/* ============================================================
   新版本提示：GitHub Pages 會讓瀏覽器把網頁快取 10 分鐘，推上新版後舊分頁看不到。
   這裡每分鐘（和切回這個分頁時）用 no-store 抓一次 index.html，比對 ?v= 版本號；
   有新版就在畫面上方跳出「有新版本 · 重新整理」。
   ============================================================ */
(() => {
  "use strict";
  const mine = (() => { const s = document.querySelector('script[src*="js/app.js?v="]'); const m = s && /[?&]v=(\d+)/.exec(s.getAttribute("src")); return m ? m[1] : ""; })();
  if (!mine) return;
  let shown = false, busy = false;
  const show = () => {
    if (shown) return; shown = true;
    const b = document.createElement("div"); b.className = "upd-bar"; b.setAttribute("role", "status");
    b.innerHTML = `<span>網站有新版本</span><button type="button" data-r>重新整理</button><button type="button" data-x aria-label="稍後">×</button>`;
    b.querySelector("[data-r]").addEventListener("click", () => location.reload());
    b.querySelector("[data-x]").addEventListener("click", () => b.remove());
    document.body.appendChild(b);
  };
  const check = async () => {
    if (shown || busy || document.hidden) return; busy = true;
    try {
      const html = await (await fetch(location.pathname + "?_=" + Date.now(), { cache: "no-store" })).text();
      const m = /js\/app\.js\?v=(\d+)/.exec(html);
      if (m && m[1] !== mine) show();
    } catch (_) {}
    busy = false;
  };
  setInterval(check, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
  setTimeout(check, 8000);
})();
