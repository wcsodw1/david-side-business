/* ============================================================
   時程表（給 PM 看的）：
   · 每個專案白板有「時程」分頁：列出任務（優先級 P0/P1/P2、負責人、狀態、進度、預計開始/結束、預估天數）+ 每週甘特條
   · 辦公室有「時程表 · PM 檢視」：所有專案的任務放在同一張表，一眼看出誰在什麼時候做什麼
   · 「複製（貼到試算表）」：欄位順序 = Category / Item / Description / Priority / Owner / Status / Progress / Est. Days / Planned Start / Planned End，
     可以直接貼進 Google 試算表給 PM
   資料存在 Store（這台瀏覽器；兩個人同時在線時會即時同步給對方）。
   ============================================================ */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PRI = ["P0", "P1", "P2"], ST = ["To Do", "Doing", "Blocked", "Done"];
  const pd = (s) => new Date(String(s || "") + "T00:00:00");
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const md = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  const mondayOf = (d) => { const x = new Date(d.getTime()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
  const bdays = (a, b) => { let n = 0; const e = pd(b); for (const d = pd(a); d <= e; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; } return Math.max(n, 0); };
  const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(pd(s).getTime());

  /* 週欄位：從最早的開始到最晚的結束（至少 8 週、最多 24 週） */
  function weeksFor(tasks) {
    const ts = tasks.filter((t) => valid(t.start) && valid(t.end));
    let a = mondayOf(ts.length ? new Date(Math.min(...ts.map((t) => pd(t.start).getTime()))) : new Date()), b = ts.length ? pd(ts.map((t) => t.end).sort().pop()) : new Date(a.getTime() + 7 * 7 * 86400000);
    const out = []; for (let m = new Date(a.getTime()); (m <= b || out.length < 8) && out.length < 24; m.setDate(m.getDate() + 7)) { const mon = new Date(m.getTime()), fri = new Date(m.getTime()); fri.setDate(fri.getDate() + 4); out.push({ mon, fri, label: `W${out.length + 1}`, range: `${md(mon)}~${md(fri)}` }); }
    return out;
  }
  const cell = (t, w) => { const on = valid(t.start) && valid(t.end) && pd(t.start) <= w.fri && pd(t.end) >= w.mon; return `<td class="g ${on ? `on pri-${esc(t.pri)} st-${esc(String(t.status).replace(/\s/g, ""))}` : ""}" title="${on ? esc(t.name) + "：" + esc(t.start) + " → " + esc(t.end) : ""}"></td>`; };
  const weekHead = (ws) => ws.map((w) => `<th class="g">${w.label}<small>${w.range}</small></th>`).join("");

  /* ---------- 單一專案的時程分頁 ---------- */
  function panel(p) {
    const tasks = p.tasks || [], ws = weeksFor(tasks), who = window.PERSONA === "aeris" ? "ARIES" : "David";
    const rows = tasks.map((t) => `
      <tr data-tid="${esc(t.id)}">
        <td class="nm"><input data-f="name" value="${esc(t.name)}" aria-label="任務"></td>
        <td><select data-f="pri" class="pri-${esc(t.pri)}">${PRI.map((x) => `<option ${x === t.pri ? "selected" : ""}>${x}</option>`).join("")}</select></td>
        <td><input data-f="owner" value="${esc(t.owner)}" size="7" aria-label="負責人"></td>
        <td><select data-f="status">${ST.map((x) => `<option ${x === t.status ? "selected" : ""}>${x}</option>`).join("")}</select></td>
        <td><input data-f="progress" type="number" min="0" max="100" value="${+t.progress || 0}" class="num" aria-label="進度"><span class="u">%</span></td>
        <td class="d">${valid(t.start) && valid(t.end) ? bdays(t.start, t.end) : "—"}</td>
        <td><input data-f="start" type="date" value="${esc(t.start)}"></td>
        <td><input data-f="end" type="date" value="${esc(t.end)}"></td>
        ${ws.map((w) => cell(t, w)).join("")}
        <td><button type="button" class="x" data-del aria-label="刪除">✕</button></td>
      </tr>`).join("");
    return `
    <div class="sch">
      <div class="sch-head"><b>時程表</b><span>${tasks.length} 個任務</span><button type="button" class="ghost-btn" data-sch-copy>複製（貼到試算表）</button></div>
      ${tasks.length ? `<div class="sch-scroll"><table class="sch-t"><thead><tr><th>任務</th><th>優先</th><th>負責人</th><th>狀態</th><th>進度</th><th>天數</th><th>開始</th><th>結束</th>${weekHead(ws)}<th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="sch-empty">還沒有任務。在下面新增第一個，會自動畫出每週的甘特條。</p>`}
      <form class="sch-add" data-sch-add autocomplete="off">
        <input name="name" placeholder="新任務（例如：拍攝第一支示範片）" required>
        <select name="pri">${PRI.map((x) => `<option ${x === "P1" ? "selected" : ""}>${x}</option>`).join("")}</select>
        <input name="owner" placeholder="負責人" value="${esc(who)}" size="7">
        <input name="start" type="date" value="${iso(new Date())}"><span class="arrow">→</span><input name="end" type="date" value="${iso(new Date(Date.now() + 4 * 86400000))}">
        <button type="submit">新增</button>
      </form>
    </div>`;
  }

  function bind(el, p, again) {
    const S = window.Store; if (!S) return;
    el.querySelector("[data-sch-add]")?.addEventListener("submit", (e) => {
      e.preventDefault(); const f = new FormData(e.target), start = String(f.get("start")), end = String(f.get("end"));
      if (valid(start) && valid(end) && pd(end) < pd(start)) { window.Journal && window.Journal.toast("結束日不能早於開始日"); return; }
      S.addTask(p.id, { name: f.get("name"), pri: f.get("pri"), owner: f.get("owner"), start, end }); again();
    });
    el.querySelectorAll("tr[data-tid]").forEach((tr) => {
      const id = tr.dataset.tid;
      tr.querySelectorAll("[data-f]").forEach((inp) => inp.addEventListener("change", () => {
        let v = inp.value; const f = inp.dataset.f; if (f === "progress") v = Math.max(0, Math.min(100, +v || 0));
        const patch = { [f]: v }, t = (p.tasks || []).find((x) => x.id === id), s2 = f === "start" ? v : t && t.start, e2 = f === "end" ? v : t && t.end;
        if ((f === "start" || f === "end") && valid(s2) && valid(e2) && pd(e2) < pd(s2)) { if (f === "start") patch.end = v; else patch.start = v; }   // 日期顛倒時自動帶動另一端
        S.updateTask(p.id, id, patch); again();
      }));
      tr.querySelector("[data-del]")?.addEventListener("click", () => { S.removeTask(p.id, id); again(); });
    });
    el.querySelector("[data-sch-copy]")?.addEventListener("click", () => copy(tsv([p])));
  }

  /* ---------- 匯出：欄位順序同你們的 Weekly_Task_Tracking ---------- */
  function tsv(projects) {
    const head = ["Category", "Item", "Description", "Priority", "Owner", "Status", "Progress", "Est. Days", "Planned Start", "Planned End"], rows = [head];
    for (const p of projects) for (const t of p.tasks || []) rows.push([p.name, t.name, t.note || "", t.pri, t.owner, t.status, (+t.progress || 0) + "%", valid(t.start) && valid(t.end) ? bdays(t.start, t.end) : "", t.start, t.end]);
    return rows.map((r) => r.map((c) => String(c ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); window.Journal && window.Journal.toast("已複製，貼進 Google 試算表就好"); }
    catch (_) { window.prompt("複製下面的內容，貼進 Google 試算表：", text); }
  }

  /* ---------- 辦公室：全部專案一張表（PM 檢視） ---------- */
  function officeHtml(P, accent) {
    const all = P.flatMap((p) => (p.tasks || []).map((t) => ({ ...t, _p: p }))), ws = weeksFor(all);
    const count = (st) => all.filter((t) => t.status === st).length, today = iso(new Date());
    const late = all.filter((t) => t.status !== "Done" && valid(t.end) && t.end < today).length;
    const ord = { P0: 0, P1: 1, P2: 2 };
    const body = P.map((p, i) => {
      const ts = (p.tasks || []).slice().sort((a, b) => (ord[a.pri] ?? 9) - (ord[b.pri] ?? 9) || String(a.start).localeCompare(String(b.start))); if (!ts.length) return "";
      return `<tr class="grp" style="--c:${accent ? accent(i) : "#888"}"><td colspan="${8 + ws.length}"><a href="#/p/${esc(p.id)}">${esc(p.name)}</a><small>${esc(p.zh || "")}</small></td></tr>` + ts.map((t) => `
        <tr class="${t.status !== "Done" && valid(t.end) && t.end < today ? "late" : ""}">
          <td class="nm">${esc(t.name)}</td><td><span class="pri pri-${esc(t.pri)}">${esc(t.pri)}</span></td><td>${esc(t.owner)}</td><td><span class="stt st-${esc(String(t.status).replace(/\\s/g, ""))}">${esc(t.status)}</span></td>
          <td><span class="bar"><i style="width:${+t.progress || 0}%"></i></span><span class="u">${+t.progress || 0}%</span></td><td class="d">${valid(t.start) && valid(t.end) ? bdays(t.start, t.end) : "—"}</td><td>${esc(String(t.start).slice(5))}</td><td>${esc(String(t.end).slice(5))}</td>
          ${ws.map((w) => cell(t, w)).join("")}
        </tr>`).join("");
    }).join("");
    return `
    <div class="sch sch-office">
      <div class="sch-head"><b>時程表 · PM 檢視</b>
        <span class="chips-sm"><em>${all.length} 個任務</em><em>Doing ${count("Doing")}</em><em>Done ${count("Done")}</em><em>Blocked ${count("Blocked")}</em>${late ? `<em class="warn">逾期 ${late}</em>` : ""}</span>
        <button type="button" class="ghost-btn" data-sch-office-copy>複製（貼到試算表）</button></div>
      ${all.length ? `<div class="sch-scroll"><table class="sch-t ro"><thead><tr><th>任務</th><th>優先</th><th>負責人</th><th>狀態</th><th>進度</th><th>天數</th><th>開始</th><th>結束</th>${weekHead(ws)}</tr></thead><tbody>${body}</tbody></table></div>`
        : `<p class="sch-empty">還沒有任務。到任一專案的白板，切到「時程」分頁新增，這裡就會長出整體甘特圖。</p>`}
    </div>`;
  }
  function bindOffice(el, P) { el.querySelector("[data-sch-office-copy]")?.addEventListener("click", () => copy(tsv(P))); }

  window.Schedule = { panel, bind, officeHtml, bindOffice, tsv };
})();
