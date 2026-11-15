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
  window.Dash = { html };
})();
