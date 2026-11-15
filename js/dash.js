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
     · 標題列右上多一顆「▦ 儀表板」：小視窗 = 切到儀表板，大螢幕全螢幕 = 左邊對話、右邊儀表板並排
     · AI 改了白板（ai:applied / store:change）→ 儀表板即時刷新，被改到的專案那一列會閃一下橘色
     · 以後狀態、Next Step、進度都直接跟 AI 說，不用再自己填 */
  const snap = (P) => { const o = {}; (P || []).forEach((p) => { o[p.id] = [p.wbStatus, p.wbNote, p.next, p.progress, p.goal, p.status].join("¦"); }); return o; };
  function attach(box, getP) {
    const sec = box.querySelector(".office-ai"), hdr = box.querySelector(".rc-h"), mount = box.querySelector("[data-m]");
    if (!sec || !hdr || !mount || box.__dash) return; box.__dash = true;
    const body = document.createElement("div"); body.className = "rc-body"; mount.parentNode.insertBefore(body, mount); body.appendChild(mount);
    const pane = document.createElement("aside"); pane.className = "dh-pane"; pane.setAttribute("aria-label", "儀表板"); body.appendChild(pane);
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "rc-dash"; btn.innerHTML = "▦ 儀表板<i hidden></i>"; btn.setAttribute("aria-pressed", "false");
    const first = hdr.querySelector("button"); hdr.insertBefore(btn, first);
    let on = false, last = snap(getP());
    const hot = {};   // 專案 id → 閃色到什麼時候（連續幾個事件重畫時，閃色不會被洗掉）
    const draw = (flash) => {
      const P = getP(), now = snap(P), keep = pane.scrollTop, t0 = Date.now();
      if (flash) { const ids = P.filter((p) => now[p.id] !== last[p.id]).map((p) => p.id); ids.forEach((id) => (hot[id] = t0 + 2400)); if (ids.length && !on) btn.querySelector("i").hidden = false; }
      last = now; pane.innerHTML = html(P); pane.scrollTop = keep;
      pane.querySelectorAll(".dh-row").forEach((r) => { const a = r.querySelector(".dh-name"), id = a && decodeURIComponent((a.getAttribute("href") || "").replace("#/p/", "")); if (id && hot[id] > t0) r.classList.add("dh-flash"); });
    };
    const set = (v) => { on = v; body.classList.toggle("dash-on", v); btn.setAttribute("aria-pressed", String(v)); btn.classList.toggle("on", v); if (v) { btn.querySelector("i").hidden = true; draw(false); } try { localStorage.setItem("dsb-rc-dash", v ? "1" : ""); } catch (_) {} };
    btn.addEventListener("click", () => set(!on));
    const refresh = () => { if (!box.isConnected) { window.removeEventListener("ai:applied", refresh); window.removeEventListener("store:change", refresh); return; } draw(true); };
    window.addEventListener("ai:applied", refresh); window.addEventListener("store:change", refresh);
    let pref = false; try { pref = localStorage.getItem("dsb-rc-dash") === "1"; } catch (_) {}
    if (pref || matchMedia("(min-width: 1100px)").matches && box.classList.contains("rc-full")) set(true); else draw(false);
    new MutationObserver(() => { if (box.classList.contains("rc-full") && matchMedia("(min-width: 1100px)").matches && !on) set(true); }).observe(box, { attributes: true, attributeFilter: ["class"] });
  }
  window.Dash = { html, attach };
})();
