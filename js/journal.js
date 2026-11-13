/* ============================================================
   Journal：每個專案房間的白板卡片，只有三格：1 專案目標、2 目前狀態（TODO / PENDING / BLOCK / ON PROCESS / FINISH + 一句話更新）、3 Next Step。
   同時用在 3D 藝廊的白板，以及專案頁。
   ============================================================ */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  
  const STATUSES = ["TODO", "PENDING", "BLOCK", "ON PROCESS", "FINISH"];

  function card(p, i, H, opt = {}) {
    const field = (key, label, val, ph, empty) => `
      <h3>${label}</h3>
      <div class="wb-field">
        ${val ? `<p class="wb-val">${esc(val)}</p><button type="button" class="link-btn" data-edit="${key}">修改</button>` : `<p class="goal-empty">${empty}</p>`}
        <form class="inline-form ${val ? "hidden" : ""}" data-form="${key}">
          <input name="v" placeholder="${ph}" value="${esc(val || "")}" autocomplete="off"><button type="submit">儲存</button>
        </form>
      </div>`;
    return `
    <div class="wb-card" data-pid="${esc(p.id)}">
      ${opt.page ? "" : `<button class="wb-x" data-x aria-label="關閉">✕</button>`}
      <h2>${esc(p.name)} <small>${esc(p.zh || "")}</small></h2>

      ${field("goal", "1　專案目標", p.goal, "要做到什麼程度？", "尚未設定")}

      <h3>2　目前狀態</h3>
      <div class="chips st-chips">${STATUSES.map((t) => `<button type="button" class="chip st-${t.replace(" ", "-")} ${p.wbStatus === t ? "on" : ""}" data-st="${t}">${t}</button>`).join("")}</div>
      <form class="inline-form" data-note-form><input name="v" placeholder="更新目前狀態…" autocomplete="off"><button type="submit">更新</button></form>
      ${p.wbNote ? `<p class="wb-now">${esc(p.wbNote)}${p.wbNoteAt ? ` <time>${esc(String(p.wbNoteAt).replace(/-/g, "."))}</time>` : ""}</p>` : ""}

      ${field("next", "3　Next Step", p.next, "下一步要做什麼？", "尚未設定")}

      <footer class="wb-foot"><button type="button" class="ghost-btn" data-export>匯出</button></footer>
    </div>`;
  }

  function bind(el, p, i, H, cb = {}) {
    const S = window.Store, again = () => (cb.rerender ? cb.rerender() : null);
    el.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const f = el.querySelector(`[data-form="${b.dataset.edit}"]`); f.classList.remove("hidden"); f.querySelector("input").focus(); b.hidden = true; }));
    el.querySelectorAll("[data-form]").forEach((f) => f.addEventListener("submit", (e) => { e.preventDefault(); const v = String(new FormData(f).get("v") || "").trim(); if (!v) return; if (f.dataset.form === "goal") S.setGoal(p.id, v); else S.setNext(p.id, v); again(); }));
    el.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", () => { S.setStatus(p.id, b.dataset.st); again(); }));
    el.querySelector("[data-note-form]")?.addEventListener("submit", (e) => { e.preventDefault(); const v = String(new FormData(e.target).get("v") || "").trim(); if (v) { S.setNote(p.id, v); again(); } });
    el.querySelector("[data-export]")?.addEventListener("click", async () => {
      const t = S.exportText();
      try { await navigator.clipboard.writeText(t); window.Journal.toast("已複製"); }
      catch (_) { window.prompt("複製下面的內容：", t); }
    });
  }

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("on")); setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, 2600);
  }

  window.Journal = { card, bind, toast };
})();
