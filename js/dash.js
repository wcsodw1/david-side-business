/* ============================================================
   儀表板（唯讀）：AI 總管視窗右側清單最上面的「儀表板」用。
   不用離開 AI 視窗，點一下就能看到每個專案的狀態、目前進度、Next Step 與完成度。
   外觀是 Hermès 風格（羊皮紙底、襯線標題、橘色點綴），字體偏大。要修改狀態請用 AI 對話，或回辦公室頁的儀表板。
   ============================================================ */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eff = (p) => p.wbStatus || ({ building: "ON PROCESS", idea: "TODO", live: "FINISH", paused: "PENDING", backlog: "BACKLOG" }[p.status] || "TODO");
  const CLS = { TODO: "TODO", PENDING: "PENDING", BLOCK: "BLOCK", "ON PROCESS": "ON-PROCESS", FINISH: "FINISH", BACKLOG: "BACKLOG" };
  const ORDER = ["ON PROCESS", "TODO", "PENDING", "BLOCK", "BACKLOG", "FINISH"];
  const label = (e) => (e === "ON PROCESS" ? "ON-PROCESS" : e);
  const lastReal = (p) => (p.updates || []).find((u) => !/專案頁建立/.test(u.title));

  function html(P) {
    P = P || [];
    const by = (s) => P.filter((p) => p.status === s), avg = P.length ? Math.round(P.reduce((a, p) => a + (p.progress || 0), 0) / P.length) : 0;
    const now = new Date().toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" });
    const row = (p) => {
      const u = lastReal(p), txt = p.wbNote || (u ? u.title : "") || (p.goal ? "🎯 目標：" + p.goal : ""), pg = p.progress ?? 0;
      return `<li class="dh-row"><div class="dh-main"><a class="dh-name" href="#/p/${esc(p.id)}">${esc(p.name)}</a><span class="ps-chip ps-${CLS[eff(p)] || "TODO"}">${esc(label(eff(p)))}</span></div>
        <p class="dh-now ${txt ? "" : "none"}">${esc(txt || "（還沒有更新）")}</p>
        ${p.next ? `<p class="dh-next"><b>Next</b>${esc(p.next)}</p>` : ""}
        <div class="dh-pg" title="完成度 ${pg}%"><i style="width:${pg}%"></i><b>${pg}%</b></div></li>`;
    };
    const secs = ORDER.map((e) => ({ e, list: P.filter((p) => eff(p) === e) })).filter((s) => s.list.length)
      .map((s) => `<section class="dh-sec"><h3>${esc(label(s.e))}<span>${s.list.length}</span></h3><ul class="dh-list">${s.list.map(row).join("")}</ul></section>`).join("");
    return `<div class="dh">
      <div class="dh-top"><span>SIDE BUSINESS 儀表板</span><time>${now}</time></div>
      <div class="dh-kpis"><div><b>${P.length}</b><span>專案</span></div><div><b>${by("live").length}</b><span>已上線</span></div><div><b>${by("building").length}</b><span>進行中</span></div><div><b>${by("idea").length}</b><span>發想中</span></div><div><b>${avg}<small>%</small></b><span>平均進度</span></div></div>
      ${secs || `<p class="dh-empty">還沒有專案。</p>`}
    </div>`;
  }
  /* ----- 融合：把儀表板接到 AI 總管視窗（機器人 / 聖誕老人開的那個）-----
     · 平常收在標題列右上的「▦ 儀表板」，AI 對話佔滿整個視窗
     · 滑鼠移到按鈕上 → 儀表板像推開窗戶一樣從右上角向左下滑出來；滑鼠移開就收起；點按鈕可以「釘住」一直開著（觸控裝置就是點一下開 / 關）
     · AI 改了白板（ai:applied / store:change）→ 儀表板即時刷新，被改到的專案那一列會閃一下橘色；收起來時按鈕上會冒出橘色小點
     · 以後狀態、Next Step、進度都直接跟 AI 說，不用再自己填 */
  const snap = (P) => { const o = {}; (P || []).forEach((p) => { o[p.id] = [p.wbStatus, p.wbNote, p.next, p.progress, p.goal, p.status].join("¦"); }); return o; };
  function attach(box, getP) {
    const sec = box.querySelector(".office-ai"), hdr = box.querySelector(".rc-h");
    if (!sec || !hdr || box.__dash) return; box.__dash = true;
    const pane = document.createElement("aside"); pane.className = "dh-pane"; pane.setAttribute("aria-label", "儀表板"); sec.appendChild(pane);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "rc-dash"; btn.innerHTML = "▦ 儀表板<i hidden></i>"; btn.setAttribute("aria-pressed", "false"); btn.setAttribute("aria-expanded", "false");
    hdr.insertBefore(btn, hdr.querySelector("button"));
    let open = false, pinned = false, closeT = 0, last = snap(getP());
    const hot = {};   // 專案 id → 閃色到什麼時候（連續幾個事件重畫時，閃色不會被洗掉）
    const draw = (flash) => {
      const P = getP(), now = snap(P), keep = pane.scrollTop, t0 = Date.now();
      if (flash) { const ids = P.filter((p) => now[p.id] !== last[p.id]).map((p) => p.id); ids.forEach((id) => (hot[id] = t0 + 2400)); if (ids.length && !open) btn.querySelector("i").hidden = false; }
      last = now; pane.innerHTML = html(P); pane.scrollTop = keep;
      pane.querySelectorAll(".dh-row").forEach((r) => { const a = r.querySelector(".dh-name"), id = a && decodeURIComponent((a.getAttribute("href") || "").replace("#/p/", "")); if (id && hot[id] > t0) r.classList.add("dh-flash"); });
    };
    const show = (v) => { if (v === open) return; open = v; pane.classList.toggle("open", v); btn.classList.toggle("on", v || pinned); btn.setAttribute("aria-expanded", String(v)); if (v) { btn.querySelector("i").hidden = true; pane.style.top = Math.max(60, hdr.offsetTop + hdr.offsetHeight + 8) + "px"; draw(false); } };
    const later = () => { clearTimeout(closeT); closeT = setTimeout(() => { if (!pinned) show(false); }, 280); };
    const now = () => { clearTimeout(closeT); show(true); };
    const hoverOK = matchMedia("(hover: hover)").matches;
    if (hoverOK) { btn.addEventListener("mouseenter", now); pane.addEventListener("mouseenter", now); btn.addEventListener("mouseleave", later); pane.addEventListener("mouseleave", later); }
    btn.addEventListener("click", () => { pinned = !pinned; btn.setAttribute("aria-pressed", String(pinned)); if (pinned) show(true); else if (hoverOK) later(); else show(false); btn.classList.toggle("on", open || pinned); });
    box.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { pinned = false; btn.setAttribute("aria-pressed", "false"); show(false); } }, true);
    const refresh = () => { if (!box.isConnected) { window.removeEventListener("ai:applied", refresh); window.removeEventListener("store:change", refresh); return; } draw(true); };
    window.addEventListener("ai:applied", refresh); window.addEventListener("store:change", refresh);
    draw(false);
    if (window.Schedule && window.Schedule.attachTip) window.Schedule.attachTip(pane, ".dh-row", (row) => { const a = row.querySelector(".dh-name"), id = a && decodeURIComponent((a.getAttribute("href") || "").replace("#/p/", "")); return (getP() || []).find((p) => p.id === id); }, (p) => `hsl(${(((getP() || []).indexOf(p)) * 47) % 360} 75% 58%)`);   // 滑過專案 → 浮出它自己的進度表
  }
  window.Dash = { html, attach };
})();
