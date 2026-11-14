/* ============================================================
   新版本提示：GitHub Pages 會讓瀏覽器把網頁快取 10 分鐘，推上新版後舊分頁看不到。
   每 20 秒（以及切回這個分頁、視窗取得焦點時）用 no-store 抓一次 index.html，比對 ?v= 版本號；
   只要有更新就在畫面上方跳出「網站有新版本 · 重新整理」。
   按 × 只是先關掉這一版的提示；之後又有更新會再跳出來。
   ============================================================ */
(() => {
  "use strict";
  const mine = (() => { const s = document.querySelector('script[src*="js/app.js?v="]'); const m = s && /[?&]v=(\d+)/.exec(s.getAttribute("src")); return m ? m[1] : ""; })();
  if (!mine) return;
  let bar = null, barV = "", dismissed = "", busy = false;
  const show = (v) => {
    if (bar && barV === v) return;
    if (bar) bar.remove();
    barV = v; bar = document.createElement("div"); bar.className = "upd-bar"; bar.setAttribute("role", "status");
    bar.innerHTML = `<span>網站有新版本</span><button type="button" data-r>重新整理</button><button type="button" data-x aria-label="稍後">×</button>`;
    bar.querySelector("[data-r]").addEventListener("click", () => location.reload());
    bar.querySelector("[data-x]").addEventListener("click", () => { dismissed = v; bar.remove(); bar = null; });
    document.body.appendChild(bar);
  };
  const check = async () => {
    if (busy || document.hidden) return; busy = true;
    try {
      const html = await (await fetch(location.pathname + "?_=" + Date.now(), { cache: "no-store" })).text();
      const m = /js\/app\.js\?v=(\d+)/.exec(html);
      if (m && m[1] !== mine && m[1] !== dismissed) show(m[1]);
    } catch (_) {}
    busy = false;
  };
  setInterval(check, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
  setTimeout(check, 5000);
  window.UpdateCheck = { check };
})();
