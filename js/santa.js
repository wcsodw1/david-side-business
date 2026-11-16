/* ============================================================
   聖誕老人機器人：右上角 NEWS 報紙的正下方，一直左右搖擺。
   滑鼠移過去（或點一下）→ 跳出 AI 總管對話（和 3D 辦公室的機器人同一個對話，可全螢幕：⤢ / F，Esc 縮小再關閉）。
   每一頁都在（解鎖之後），不用走到辦公室。
   ============================================================ */
(() => {
  "use strict";
  const SVG = `<svg viewBox="0 0 80 96" aria-hidden="true"><g class="santa-sway">
    <ellipse cx="40" cy="92" rx="20" ry="3.5" fill="rgba(0,0,0,.25)"/>
    <rect x="22" y="62" width="36" height="26" rx="11" fill="#d7261e"/><rect x="22" y="72" width="36" height="5" fill="#2a1f17"/><rect x="36" y="71" width="8" height="7" rx="1.5" fill="#f2c14e"/>
    <rect x="12" y="66" width="11" height="7" rx="3.5" fill="#d7261e" transform="rotate(-18 17 69)"/><circle cx="11" cy="72" r="4" fill="#fff"/>
    <g class="santa-wave"><rect x="57" y="62" width="11" height="7" rx="3.5" fill="#d7261e" transform="rotate(-40 60 65)"/><circle cx="67" cy="56" r="4" fill="#fff"/></g>
    <rect x="16" y="26" width="48" height="38" rx="15" fill="#f5f2ec" stroke="#2a1f17" stroke-width="1.5"/>
    <rect x="22" y="33" width="36" height="20" rx="9" fill="#1f2433"/>
    <g class="santa-eyes"><rect x="29" y="39" width="7" height="8" rx="3.5" fill="#6be3ff"/><rect x="44" y="39" width="7" height="8" rx="3.5" fill="#6be3ff"/></g>
    <path d="M20 54 Q40 74 60 54 Q58 66 40 70 Q22 66 20 54Z" fill="#fff" stroke="#e8e2d6" stroke-width="1"/>
    <path d="M32 55 Q40 59 48 55" stroke="#e3651d" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M17 29 Q24 4 50 8 Q66 11 70 26 L60 22 Q52 14 40 15 Q26 17 22 30Z" fill="#d7261e"/>
    <path d="M50 8 Q68 6 72 20" stroke="#d7261e" stroke-width="7" fill="none" stroke-linecap="round"/>
    <circle cx="72" cy="22" r="6" fill="#fff"/>
    <rect x="13" y="24" width="54" height="9" rx="4.5" fill="#fff"/>
    <circle cx="40" cy="20" r="2.2" fill="#f2c14e"/>
  </g></svg>`;

  let fab = null, box = null;
  const close = () => { if (!box) return; box.remove(); box = null; document.body.classList.remove("robot-open"); fab && fab.classList.remove("is-open"); };
  const open = () => {
    if (box || !window.AIChat) return;
    if (window.OfficeGate && !window.OfficeGate.isOpen()) { window.OfficeGate.require(open); return; }   // AI 總管要辦公室權限（輸入過就不再問）
    // 3D 辦公室的機器人對話開著的話先關掉，避免疊兩個
    const other = document.querySelector(".robot-chat [data-x]"); if (other) other.click();
    box = document.createElement("div"); box.className = "robot-chat santa-chat";
    box.innerHTML = `<section class="office-ai"><header class="rc-h"><b>🎅 AI 總管</b><span>我看得到所有專案的目標、狀態與 Next Step</span><button type="button" data-fs aria-label="全螢幕" title="全螢幕（F）">⤢</button><button type="button" data-x aria-label="關閉">✕</button></header><div class="ai-mount" data-m></div></section>`;
    document.body.appendChild(box); document.body.classList.add("robot-open"); fab.classList.add("is-open");
    (window.AIChat.mountConv || window.AIChat.mount)(box.querySelector("[data-m]"), { id: "__office", name: "辦公室", office: true, projects: window.PROJECTS || [] });
    box.querySelector("[data-x]").addEventListener("click", close);
    if (window.Dash) window.Dash.attach(box, () => window.PROJECTS || []);   // 儀表板融合進 AI 視窗
    const fsBtn = box.querySelector("[data-fs]"), setFs = (on) => { box.classList.toggle("rc-full", on); fsBtn.textContent = on ? "⤡" : "⤢"; fsBtn.title = on ? "縮小（F / Esc）" : "全螢幕（F）"; try { localStorage.setItem("dsb-robot-full", on ? "1" : ""); } catch (_) {} const m = box.querySelector(".ai-msgs"); if (m) m.scrollTop = m.scrollHeight; };
    fsBtn.addEventListener("click", () => setFs(!box.classList.contains("rc-full")));
    box.addEventListener("keydown", (e) => { if ((e.key === "f" || e.key === "F") && !/^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); setFs(!box.classList.contains("rc-full")); } });
    try { if (localStorage.getItem("dsb-robot-full")) setFs(true); } catch (_) {}
    const ta = box.querySelector("textarea"); if (ta) setTimeout(() => ta.focus(), 60);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !box) return; e.preventDefault(); e.stopPropagation();
    if (box.classList.contains("rc-full")) box.querySelector("[data-fs]").click(); else close();
  }, true);

  // 跟著 NEWS 報紙出現 / 消失（解鎖後才有報紙）
  const sync = () => {
    const news = document.querySelector(".news-fab");
    if (news && !fab && window.PERSONA !== "aeris") {   // ARIES 不能用 AI 總管
      fab = document.createElement("button"); fab.type = "button"; fab.className = "santa-fab"; fab.setAttribute("aria-label", "找 AI 總管聊天（聖誕老人機器人）");
      fab.innerHTML = SVG + `<span class="santa-tip">AI 總管</span>`;
      fab.addEventListener("click", () => (box ? close() : open()));
      // 滑鼠移過去（停 0.35 秒）就跳出 AI 總管；只是路過不會打開
      let hov = 0;
      fab.addEventListener("mouseenter", () => { clearTimeout(hov); hov = setTimeout(() => { if (!box) open(); }, 350); });
      fab.addEventListener("mouseleave", () => clearTimeout(hov));
      document.body.appendChild(fab);
    } else if (!news && fab) { close(); fab.remove(); fab = null; }
    place();
  };
  // 永遠貼在報紙正下方（報紙的位置會因頁面 / 螢幕寬度不同而變）
  const place = () => {
    const news = document.querySelector(".news-fab"); if (!news || !fab) return;
    const r = news.getBoundingClientRect(); if (!r.height) return;
    fab.style.top = Math.round(r.bottom + 10) + "px";
    fab.style.left = Math.round(r.left + r.width / 2 - fab.offsetWidth / 2) + "px"; fab.style.right = "auto";
  };
  window.addEventListener("resize", place); setInterval(place, 1500);
  new MutationObserver(sync).observe(document.body, { childList: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync); else sync();
  window.Santa = { open: () => { sync(); open(); }, close };
})();
