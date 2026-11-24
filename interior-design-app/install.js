/* 安裝到主畫面：Android/桌面 Chrome 用 beforeinstallprompt；iPhone Safari 顯示「分享 → 加入主畫面」說明。 */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const KEY = "ida-install-dismissed";
  let dp = null;

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  function steps() {
    const m = $("#modal");
    m.innerHTML = `<div class="mbox howto"><h3>安裝到主畫面</h3>
      <h4>iPhone（Safari）</h4><ol><li>用 <b>Safari</b> 開啟這個網址</li><li>點下方中間的 <b>分享</b> 圖示（方框加向上箭頭）</li><li>往下滑，點 <b>加入主畫面</b></li><li>右上角點 <b>加入</b>，桌面就會出現 App 圖示</li></ol>
      <h4>Android（Chrome）</h4><ol><li>用 <b>Chrome</b> 開啟這個網址</li><li>點右上角 <b>⋮</b> 選單</li><li>點 <b>安裝應用程式</b>（或 <b>加到主畫面</b>）</li><li>確認 <b>安裝</b></li></ol>
      <div class="btns"><button class="ok">知道了</button></div></div>`;
    m.hidden = false; const close = () => { m.hidden = true; m.innerHTML = ""; };
    m.querySelector(".ok").onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  }
  async function install() {
    if (dp) { dp.prompt(); try { await dp.userChoice; } catch (e) {} dp = null; hide(); }
    else steps();
  }
  function hide() { const b = $("#ibn"); if (b) b.remove(); }
  function show() {
    if (standalone() || $("#ibn")) return;
    try { if (localStorage.getItem(KEY)) return; } catch (e) {}
    const b = document.createElement("div"); b.className = "ibn"; b.id = "ibn";
    b.innerHTML = `<img src="icons/icon-192.png" alt=""><span><b>安裝到主畫面</b>像 App 一樣全螢幕使用</span><button class="go">${dp ? "安裝" : "怎麼裝"}</button><button class="x" aria-label="關閉">×</button>`;
    b.querySelector(".go").onclick = install;
    b.querySelector(".x").onclick = () => { try { localStorage.setItem(KEY, "1"); } catch (e) {} hide(); };
    ($("#app") || document.body).appendChild(b);
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); dp = e; hide(); show(); });
  window.addEventListener("appinstalled", () => { dp = null; hide(); });
  const how = $("#howto"); if (how) how.addEventListener("click", (e) => { e.preventDefault(); if (dp) install(); else steps(); });
  // iPhone 沒有安裝事件：載入後直接顯示說明提示
  if (ios && !standalone()) setTimeout(show, 1200);
})();
