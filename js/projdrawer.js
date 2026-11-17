/* 專案詳細抽屜：點辦公室儀表板的專案名稱 → 右側滑出。
   狀態 / 目前狀態 / Next Step / 目標 + 歷史（含時間）+ 這個專案的 AI。樣式沿用任務抽屜（#tdOv .td-box）。 */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P_ST = ["TODO", "ON PROCESS", "PENDING", "BLOCK", "FINISH"];
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = (ms, day) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}` + (day ? "" : ` ${p2(d.getHours())}:${p2(d.getMinutes())}`); };

  function openProject(p, again) {
    const S = window.Store; if (!S || !p) return;
    document.getElementById("tdOv")?.remove();
    const ov = document.createElement("div"); ov.id = "tdOv";
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); again && again(true); };
    document.addEventListener("keydown", onKey, true);
    ov.innerHTML = `<div class="td-box" role="dialog" aria-label="${esc(p.name)}"><button type="button" class="td-x" aria-label="關閉">✕</button>
      <h3>${esc(p.name)}${p.zh ? ` <small class="pd-zh">${esc(p.zh)}</small>` : ""}</h3><p class="td-meta"></p>
      <div class="td-sec" data-fld="note"><h4>目前狀態</h4><div class="td-row"><input name="v" placeholder="現在進行到哪、卡在哪" autocomplete="off"><button type="button" class="td-go">更新</button></div></div>
      <div class="td-sec" data-fld="next"><h4>NEXT STEP</h4><div class="td-row"><input name="v" placeholder="下一步要做什麼" autocomplete="off"><button type="button" class="td-go">更新</button></div></div>
      <div class="td-sec" data-fld="goal"><h4>目標</h4><div class="td-row"><input name="v" placeholder="要做到什麼程度" autocomplete="off"><button type="button" class="td-go">更新</button></div></div>
      <div class="td-sec"><h4>歷史</h4><ul class="td-l"></ul></div>
      <h4>🤖 這個專案的 AI</h4><div class="tz-ai td-ai"></div></div>`;
    document.body.appendChild(ov);
    const cur = () => P_.find((x) => x.id === p.id) || p, P_ = window.PROJECTS || [];
    const paint = (keep) => {
      const q = cur();
      ov.querySelector(".td-meta").innerHTML = `<select data-m="status" title="白板狀態">${P_ST.map((x) => `<option ${x === q.wbStatus ? "selected" : ""}>${x}</option>`).join("")}</select> 完成度 ${q.progress ?? 0}% · ${esc(q.category || "")} · <a href="#/p/${encodeURIComponent(q.id)}" class="pd-open">開啟專案頁 ↗</a>`;
      ov.querySelector("[data-m=status]").addEventListener("change", (e) => { if (e.target.value !== q.wbStatus) S.setStatus(q.id, e.target.value); paint(); again && again(true); });
      if (!keep) { ov.querySelector('[data-fld=note] input').value = q.wbNote || ""; ov.querySelector('[data-fld=next] input').value = q.next || ""; ov.querySelector('[data-fld=goal] input').value = q.goal || ""; }
      const it = [];
      (q.updates || []).forEach((u) => it.push({ at: u.at || new Date((u.date || "1970-01-01") + "T00:00:00").getTime(), day: !u.at, text: (u.title || "") + (u.text && u.text !== u.title ? "：" + u.text : "") }));
      ((S.acts && S.acts(q.id)) || []).filter((a) => /^(next|goal|status)$/.test(a.kind)).forEach((a) => it.push({ at: a.at, day: false, text: a.text }));
      it.sort((a, b) => b.at - a.at);
      ov.querySelector(".td-l").innerHTML = it.map((x) => `<li><em>${esc(stamp(x.at, x.day))}</em><span>${esc(x.text)}</span></li>`).join("") || `<li class="td-none">還沒有歷史。</li>`;
    };
    paint();
    ov.querySelectorAll(".td-sec[data-fld]").forEach((sec) => {
      const f = sec.dataset.fld, inp = sec.querySelector("input");
      const go = () => { const v = inp.value.trim(), q = cur(), old = String({ note: q.wbNote, next: q.next, goal: q.goal }[f] || "").trim(); if (v === old) return;
        if (f === "note") { if (!v) return; S.setNote(q.id, v); } else if (f === "next") S.setNext(q.id, v); else S.setGoal(q.id, v);
        paint(true); again && again(true); };
      sec.querySelector(".td-go").addEventListener("click", go); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    });
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    ov.querySelector(".td-x").addEventListener("click", close);
    window.DrawerUtil && window.DrawerUtil.hoverClose(ov, ov.querySelector(".td-box"), close);
    ov.addEventListener("click", (e) => { if (e.target.closest && e.target.closest(".pd-open")) close(); });
    const ai = ov.querySelector(".td-ai"); if (window.AIChat) { try { window.AIChat.mount(ai, cur()); } catch (_) { ai.textContent = "AI 載入失敗"; } } else ai.textContent = "AI 未載入";
  }
  /* 滑鼠移出面板就自動關閉（回到原本畫面）；正在輸入（輸入框有游標）或選取文字時不關，避免打到一半消失 */
  window.DrawerUtil = { hoverClose(ov, box, close) {
    let t; const typing = () => { const a = document.activeElement; return !!(a && ov.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
    const arm = () => { clearTimeout(t); t = setTimeout(() => { if (!document.body.contains(ov) || typing() || String(window.getSelection && window.getSelection())) return; close(); }, 450); };
    box.addEventListener("mouseleave", arm); box.addEventListener("mouseenter", () => clearTimeout(t));
    box.addEventListener("focusout", () => setTimeout(() => { if (!box.matches(":hover") && !typing()) arm(); }, 0));
  } };
  window.ProjDrawer = { open: openProject };
  /* 辦公室儀表板 / AI 視窗儀表板的專案名稱：點下去開抽屜（不再整頁跳走；抽屜裡有「開啟專案頁」） */
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.kb-name, a.dh-name"); if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const m = /^#\/p\/(.+)$/.exec(a.getAttribute("href") || ""); if (!m) return;
    const pr = (window.PROJECTS || []).find((x) => x.id === decodeURIComponent(m[1])); if (!pr) return;
    e.preventDefault(); e.stopPropagation(); openProject(pr, () => window.dispatchEvent(new CustomEvent("ai:applied")));
  }, true);
})();
