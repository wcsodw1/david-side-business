/* ============================================================
   Journal：每個專案房間的白板卡片（目標 / 里程碑 / 進度 / 紀錄 / 輸入框）。
   同時用在 3D 藝廊的白板，以及專案頁。
   ============================================================ */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TYPES = ["進度", "完成", "事件", "問題"];
  let composeType = "進度";

  function card(p, i, H, opt = {}) {
    const st = H.st(p), ms = p.milestones || [], done = ms.filter((m) => m.done).length, pr = p.progress ?? 0;
    const unreadFn = (u) => window.News && window.News.isUnread(p, u);
    const stale = window.Store ? window.Store.daysSinceUpdate(p) : null;
    return `
    <div class="wb-card" data-pid="${esc(p.id)}">
      ${opt.page ? "" : `<button class="wb-x" data-x aria-label="關閉">✕</button>`}
      <p class="eyebrow">${esc(p.category)} · WHITEBOARD</p>
      <h2>${esc(p.name)} <small>${esc(p.zh || "")}</small></h2>
      <div class="wb-meta">
        <span class="status"><i class="pill-dot" style="background:${st.color}"></i>${esc(st.label)}</span>
        <span class="wb-pct">${pr}%</span>
        <span class="wb-auto ${p.progressMode === "milestone" ? "on" : ""}">${esc(p.progressReason || "")}</span>
      </div>
      <div class="bar wb-bar"><i style="width:${pr}%"></i></div>
      ${p.suggestStatus ? `<p class="wb-hint">里程碑全數完成，建議把狀態改成「已上線」。</p>` : ""}
      ${p.summary ? `<p class="wb-sum">${esc(p.summary)}</p>` : ""}

      <h3>目標 · 要做到什麼程度</h3>
      <div class="wb-goal">
        ${p.goal ? `<p class="goal-text">${esc(p.goal)}</p><button type="button" class="link-btn" data-edit-goal>修改</button>`
                 : `<p class="goal-empty">還沒有設定目標，館長會來問你。</p>`}
        <form class="inline-form ${p.goal ? "hidden" : ""}" data-goal-form>
          <input name="goal" placeholder="例如：月營收 3 萬 / 上架 10 個商品 / 簽滿 5 位租客" value="${esc(p.goal || "")}" autocomplete="off">
          <button type="submit">儲存</button>
        </form>
      </div>

      <h3>里程碑 <span class="cnt">${done}/${ms.length}</span></h3>
      <ul class="ms-list">
        ${ms.map((m) => `<li class="${m.done ? "done" : ""}"><label><input type="checkbox" data-ms="${esc(m.id)}" ${m.done ? "checked" : ""}><span>${esc(m.text)}</span></label><button type="button" class="x" data-ms-del="${esc(m.id)}" aria-label="刪除">×</button></li>`).join("") || `<li class="empty">還沒有里程碑。加幾個，完成度就會自動計算。</li>`}
      </ul>
      <form class="inline-form" data-ms-form><input name="ms" placeholder="新增里程碑（可用逗號一次加多個）" autocomplete="off"><button type="submit">加入</button></form>

      <h3>記錄今天的狀況 / 事件</h3>
      ${stale != null && stale >= 7 ? `<p class="wb-hint">已經 ${stale} 天沒有更新了。</p>` : ""}
      <form class="composer" data-compose>
        <div class="chips">${TYPES.map((t) => `<button type="button" class="chip ${t === composeType ? "on" : ""}" data-type="${t}">${t}</button>`).join("")}</div>
        <div class="inline-form"><input name="text" placeholder="發生了什麼事？做到哪了？（Enter 送出）" autocomplete="off"><button type="submit">記錄</button></div>
      </form>

      <h3>進度紀錄</h3>
      <ul class="timeline wb-tl" style="--c:hsl(${H.hue(i)} 90% 55%)">
        ${(p.updates || []).slice(0, 12).map((u) => `<li><time>${esc(String(u.date).replace(/-/g, "."))}${u.local ? " · 我記錄的" : ""}${unreadFn(u) ? ` <em class="new">NEW</em>` : ""}</time><h4>${esc(u.title)}</h4><p>${esc(u.text)}</p></li>`).join("") || `<li class="empty">還沒有紀錄。</li>`}
      </ul>

      <footer class="wb-foot">
        ${(p.updates || []).some(unreadFn) ? `<button type="button" class="ghost-btn" data-read>✓ 全部看過了</button>` : ""}
        ${opt.page ? "" : `<a class="ghost-btn" href="#/p/${esc(p.id)}">查看完整專案頁 →</a>`}
        <button type="button" class="ghost-btn" data-export>匯出我的紀錄</button>
      </footer>
      <p class="wb-note">紀錄存在這台瀏覽器；要讓所有裝置都看到，按「匯出」貼給 Claude 寫進 data/projects.js。</p>
    </div>`;
  }

  function bind(el, p, i, H, cb = {}) {
    const S = window.Store, again = () => (cb.rerender ? cb.rerender() : null);
    el.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { composeType = b.dataset.type; el.querySelectorAll("[data-type]").forEach((x) => x.classList.toggle("on", x === b)); }));
    el.querySelector("[data-edit-goal]")?.addEventListener("click", (e) => { el.querySelector("[data-goal-form]").classList.remove("hidden"); el.querySelector("[data-goal-form] input").focus(); e.target.hidden = true; });
    el.querySelector("[data-goal-form]")?.addEventListener("submit", (e) => { e.preventDefault(); const v = new FormData(e.target).get("goal"); if (String(v).trim()) { S.setGoal(p.id, v); again(); } });
    el.querySelector("[data-ms-form]")?.addEventListener("submit", (e) => { e.preventDefault(); const v = new FormData(e.target).get("ms"); if (String(v).trim()) { S.addMilestones(p.id, v); again(); } });
    el.querySelectorAll("[data-ms]").forEach((c) => c.addEventListener("change", () => { S.toggleMilestone(p.id, c.dataset.ms); again(); }));
    el.querySelectorAll("[data-ms-del]").forEach((b) => b.addEventListener("click", () => { S.removeMilestone(p.id, b.dataset.msDel); again(); }));
    el.querySelector("[data-compose]")?.addEventListener("submit", (e) => {
      e.preventDefault(); const text = new FormData(e.target).get("text"); if (!String(text).trim()) return;
      const r = S.addUpdate(p.id, { type: composeType, text }); again();
      if (r && r.ticked.length && window.Journal.toast) window.Journal.toast(`已自動打勾：${r.ticked.join("、")}`);
    });
    el.querySelector("[data-read]")?.addEventListener("click", () => { if (window.News) window.News.markProject(p.id); again(); });
    el.querySelector("[data-export]")?.addEventListener("click", async () => {
      const t = S.exportText();
      try { await navigator.clipboard.writeText(t); window.Journal.toast("已複製！貼給 Claude 就能寫進網站資料檔"); }
      catch (_) { window.prompt("複製下面的內容：", t); }
    });
  }

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("on")); setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, 2600);
  }

  window.Journal = { card, bind, toast };
})();
