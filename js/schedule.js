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
        <td><button type="button" class="x" data-del aria-label="刪除">✕</button></td>
      </tr>`).join("");
    return `
    <div class="sch">
      <div class="sch-head"><b>時程表</b><span>${tasks.length} 個任務</span><button type="button" class="ghost-btn" data-sch-copy>複製（貼到試算表）</button></div>
      ${tasks.length ? `<div class="sch-scroll sch-split"><table class="sch-t sch-l"><thead><tr><th>任務</th><th>優先</th><th>負責人</th><th>狀態</th><th>進度</th><th>天數</th><th>開始</th><th>結束</th><th></th></tr></thead><tbody>${rows}</tbody></table><div class="sch-gt" tabindex="0" aria-label="時間軸（滑過展開）"><span class="sch-gt-tab">時間軸 ◂</span><div class="sch-gt-in"><table class="sch-t sch-g" style="min-width:${ws.length * 58}px"><thead><tr>${weekHead(ws)}</tr></thead><tbody>${tasks.map((t) => `<tr>${ws.map((w) => cell(t, w)).join("")}</tr>`).join("")}</tbody></table></div></div></div>` : `<p class="sch-empty">還沒有任務。在下面新增第一個，會自動畫出每週的甘特條。</p>`}
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
    statusCard(el, p, again);
    el.querySelector("[data-sch-copy]")?.addEventListener("click", () => copy(tsv([p])));
  }


  /* 任務詳細：目前狀態 / Next Step / 備註 / 歷史 + 這個任務自己的獨立 AI Session。
     更新「目前狀態」或「Next Step」時，若舊的有內容，會問你要不要把舊的丟進歷史。 */
  function openTask(p, tid, again) {
    const S = window.Store, get = () => (p.tasks || []).find((x) => x.id === tid); if (!S || !get()) return;
    { const t = get(), seed = (p.tasks0 || []).find((x) => x.name === t.name);   // 舊資料一次性補上 目前狀態 / 備註 預設
      if (t.cur === undefined && seed && seed.cur !== undefined) S.updateTask(p.id, tid, { cur: seed.cur, note: seed.note || "" }); }
    document.getElementById("tdOv")?.remove();
    const ov = document.createElement("div"); ov.id = "tdOv";
    const close = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); again && again(true); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", onKey, true);
    const t0 = get();
    ov.innerHTML = `<div class="td-box" role="dialog" aria-label="${esc(t0.name)}"><button type="button" class="td-x" aria-label="關閉">✕</button>
      <h3>${esc(t0.name)}</h3><p class="td-meta"></p>
      <div class="td-sec" data-fld="cur"><h4>目前狀態</h4><div class="td-row"><input name="v" placeholder="現在進行到哪、卡在哪" autocomplete="off"><button type="button" class="td-go">更新</button></div><div class="td-ask" hidden></div></div>
      <div class="td-sec" data-fld="next"><h4>NEXT STEP</h4><div class="td-row"><input name="v" placeholder="下一步要做什麼" autocomplete="off"><button type="button" class="td-go">更新</button></div><div class="td-ask" hidden></div></div>
      <div class="td-sec"><h4>備註</h4><textarea class="td-note-in" rows="2" placeholder="等待對象、連結、補充（失焦自動儲存）"></textarea></div>
      <div class="td-sec"><h4>歷史</h4><ul class="td-l"></ul></div>
      <h4>🤖 這個任務的獨立 AI Session</h4><div class="tz-ai td-ai"></div></div>`;
    document.body.appendChild(ov);
    const L = { cur: "目前狀態", next: "Next Step" };
    const paint = (keepInputs) => {
      const t = get(); if (!t) return;
      ov.querySelector(".td-meta").innerHTML = `<select data-m="status">${ST.map((x) => `<option ${x === t.status ? "selected" : ""}>${x}</option>`).join("")}</select><input data-m="progress" type="number" min="0" max="100" value="${+t.progress || 0}"><span>%</span> · ${esc(t.pri)} · ${esc(t.owner)} · ${esc(t.start)} → ${esc(t.end)}`;
      ov.querySelectorAll("[data-m]").forEach((el) => el.addEventListener("change", () => { let v = el.value; if (el.dataset.m === "progress") v = Math.max(0, Math.min(100, +v || 0)); S.updateTask(p.id, tid, { [el.dataset.m]: v }); paint(); again && again(true); }));
      if (!keepInputs) { ov.querySelector('[data-fld="cur"] input').value = t.cur || ""; ov.querySelector('[data-fld="next"] input').value = t.next || ""; ov.querySelector(".td-note-in").value = t.note || ""; }
      const H = (t.log || []).slice().reverse();
      ov.querySelector(".td-l").innerHTML = H.map((l) => `<li><em>${esc(l.d)}</em><b>${esc(l.k || "狀態")} · ${esc(l.s)} ${+l.p || 0}%</b><span>${esc(l.text)}</span></li>`).join("") || `<li class="td-none">還沒有歷史。更新目前狀態時，舊的內容可以丟進來。</li>`;
    };
    paint();
    ov.querySelectorAll(".td-sec[data-fld]").forEach((sec) => {
      const fld = sec.dataset.fld, inp = sec.querySelector("input"), ask = sec.querySelector(".td-ask");
      const apply = (saveOld) => {
        const t = get(), old = String(t[fld] || "").trim(), nv = inp.value.trim(), patch = { [fld]: nv, [fld + "At"]: iso(new Date()) };
        if (saveOld && old) patch.log = [...(t.log || []), { d: t[fld + "At"] || iso(new Date()), s: t.status, p: +t.progress || 0, text: old, k: L[fld] }];
        S.updateTask(p.id, tid, patch); ask.hidden = true; paint(true); again && again(true);
      };
      const go = () => { const t = get(), old = String(t[fld] || "").trim(), nv = inp.value.trim(); if (nv === old) return; if (!old) return apply(false);
        ask.hidden = false; ask.innerHTML = `之前的「<b>${esc(old.length > 60 ? old.slice(0, 60) + "…" : old)}</b>」要丟進歷史嗎？ <button type="button" data-y>丟進歷史</button><button type="button" data-n>不用</button>`;
        ask.querySelector("[data-y]").onclick = () => apply(true); ask.querySelector("[data-n]").onclick = () => apply(false); };
      sec.querySelector(".td-go").addEventListener("click", go); inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    });
    ov.querySelector(".td-note-in").addEventListener("change", (e) => { S.updateTask(p.id, tid, { note: e.target.value.trim() }); });
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    ov.querySelector(".td-x").addEventListener("click", close);
    const ai = ov.querySelector(".td-ai");
    if (window.AIChat) { try { window.AIChat.mount(ai, { ...p, id: p.id + "~task-" + tid, name: p.name + " · " + t0.name, zh: "", noTools: true, task: { run: (name, a) => {
          if (name !== "update_this_task") return { ok: false, error: "不認得的工具：" + name };
          const t = get(); if (!t) return { ok: false, error: "任務不存在" }; const patch = {}, done = [], keep = a.archive_old !== false, log = [...(t.log || [])];
          if (ST.includes(a.status) && a.status !== t.status) { patch.status = a.status; done.push("狀態 → " + a.status); }
          if (a.progress !== undefined && !isNaN(+a.progress)) { patch.progress = Math.max(0, Math.min(100, +a.progress)); done.push("進度 → " + patch.progress + "%"); }
          for (const [k, lab] of [["cur", "目前狀態"], ["next", "Next Step"]]) { if (a[k] === undefined) continue; const nv = String(a[k]).trim(), old = String(t[k] || "").trim(); if (nv === old) continue; if (keep && old) log.push({ d: t[k + "At"] || iso(new Date()), s: t.status, p: +t.progress || 0, text: old, k: lab }); patch[k] = nv; patch[k + "At"] = iso(new Date()); done.push(lab + " → " + (nv || "（清空）") + (keep && old ? "（舊的已存進歷史）" : "")); }
          if (a.note !== undefined && String(a.note).trim() !== String(t.note || "").trim()) { patch.note = String(a.note).trim(); done.push("備註已更新"); }
          if (!done.length) return { ok: true, text: "沒有需要改的" };
          if (log.length !== (t.log || []).length) patch.log = log;
          S.updateTask(p.id, tid, patch); paint(); again && again(true); return { ok: true, text: `${t.name}：${done.join("；")}` };
        }, }, sys: () => { const t = get() || t0; return `你是 David 的工作助理，只針對任務「${t.name}」（所屬：${p.name}）用繁體中文簡潔直接地回答。狀態 ${t.status}、進度 ${+t.progress || 0}%、優先 ${t.pri}、期間 ${t.start}→${t.end}。目前狀態：${t.cur || "無"}。Next Step：${t.next || "無"}。備註：${t.note || "無"}。歷史（新到舊）：${(t.log || []).slice().reverse().map((l) => `${l.d} ${l.k || ""} ${l.text}`).join("；") || "無"}。需要時參考，不需要不要複述。`; } }); } catch (_) { ai.textContent = "AI 載入失敗"; } } else ai.textContent = "AI 未載入";
  }

  /* 滑鼠移到任務那一列 → 浮出「新增狀態」小卡：改狀態/進度 + 一句進度紀錄（記在該任務上，保留歷史） */
  function statusCard(el, p, again) {
    const S = window.Store; if (!S || window.VIEWER) return;
    let card = document.getElementById("stTip"); if (!card) { card = document.createElement("div"); card.id = "stTip"; card.hidden = true; document.body.appendChild(card); }
    let timer, cur = null; const hide = () => { clearTimeout(timer); timer = setTimeout(() => { card.hidden = true; cur = null; }, 260); };
    const keep = () => clearTimeout(timer);
    card.onmouseenter = keep; card.onmouseleave = hide;
    const show = (tr) => {
      const t = (p.tasks || []).find((x) => x.id === tr.dataset.tid); if (!t) return; cur = tr; keep();
      const logs = (t.log || []).slice(-3).reverse();
      card.innerHTML = `<form autocomplete="off"><div class="st-h"><b>${esc(t.name)}</b><button type="button" class="st-open">開啟：狀態歷史 + AI ›</button></div>
        <div class="st-r"><select name="status">${ST.map((x) => `<option ${x === t.status ? "selected" : ""}>${x}</option>`).join("")}</select><input name="progress" type="number" min="0" max="100" value="${+t.progress || 0}"><span>%</span><input name="text" placeholder="這次的狀態（例：11/17 已送測、等 GPU）" required><button type="submit">新增</button></div>
        ${logs.length ? `<ul class="st-l">${logs.map((l) => `<li><em>${esc(l.d)}</em> <b>${esc(l.s)} ${+l.p || 0}%</b> ${esc(l.text)}</li>`).join("")}</ul>` : ""}</form>`;
      const r = tr.getBoundingClientRect(), w = Math.min(640, innerWidth - 24);
      card.style.width = w + "px"; card.style.left = Math.max(12, Math.min(r.left + 20, innerWidth - w - 12)) + "px"; card.hidden = false;
      const h = card.offsetHeight; card.style.top = (r.bottom + h + 8 > innerHeight && r.top - h - 8 > 0 ? r.top - h - 4 : r.bottom - 2) + "px";
      card.querySelector(".st-open").addEventListener("click", () => { card.hidden = true; cur = null; openTask(p, t.id, again); });
      card.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault(); const f = new FormData(e.target), pg = Math.max(0, Math.min(100, +f.get("progress") || 0)), st = String(f.get("status")), text = String(f.get("text")).trim(); if (!text) return;
        S.updateTask(p.id, t.id, { status: st, progress: pg, cur: text, curAt: iso(new Date()), log: [...(t.log || []), { d: iso(new Date()), s: st, p: pg, text, k: "狀態" }] }); card.hidden = true; cur = null; again();
      });
    };
    el.addEventListener("mouseover", (e) => { const tr = e.target.closest && e.target.closest("tr[data-tid]"); if (!tr || tr === cur || !el.contains(tr) || tr.contains(document.activeElement) && document.activeElement.matches("input,select")) return; show(tr); });
    el.addEventListener("mouseout", (e) => { const tr = e.target.closest && e.target.closest("tr[data-tid]"); if (!tr || (e.relatedTarget && (tr.contains(e.relatedTarget) || card.contains(e.relatedTarget)))) return; hide(); });
    el.addEventListener("focusin", (e) => { if (e.target.closest("tr[data-tid]")) { clearTimeout(timer); card.hidden = true; cur = null; } });
    window.addEventListener("hashchange", () => { card.hidden = true; });
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
  function bindOffice(el, P) { if (!el) return; el.querySelector("[data-sch-office-copy]")?.addEventListener("click", () => copy(tsv(P))); }


  /* ---------- 滑過專案列 → 浮出該專案自己的進度表（辦公室儀表板 / AI 總管視窗共用） ---------- */
  function attachTip(root, sel, projOf, colorOf) {
    if (!root || root.__tip) return; root.__tip = true;
    let tip = document.getElementById("kbTip"); if (!tip) { tip = document.createElement("div"); tip.id = "kbTip"; tip.hidden = true; document.body.appendChild(tip); }
    const ts = (x) => new Date(x + "T00:00:00").getTime();
    const build = (p) => {
      const L = (p.tasks || []).filter((t) => valid(t.start) && valid(t.end)), c = colorOf ? colorOf(p) : "#8b1e3f";
      if (!L.length) return `<h4 style="--c:${c}">${esc(p.name)}<span>${p.progress ?? 0}%</span></h4><p class="kt-none">還沒有任務。到白板「時程」分頁新增。</p>`;
      const a0 = Math.min(...L.map((t) => ts(t.start))), b0 = Math.max(...L.map((t) => ts(t.end))) + 86400000, span = Math.max(b0 - a0, 86400000), now = Date.now();
      const nowPct = now >= a0 && now <= b0 ? ((now - a0) / span) * 100 : -1, done = L.filter((t) => t.status === "Done").length;
      return `<h4 style="--c:${c}">${esc(p.name)}<span>完成度 ${p.progress ?? 0}% · 任務 ${done}/${L.length} 完成</span></h4>
        <div class="kt-rows">${L.map((t) => `<div class="kt-r"><b class="kt-n" title="${esc(t.name)}">${esc(t.name)}</b><i class="kt-pri kt-${esc(t.pri)}">${esc(t.pri)}</i><em class="kt-st kt-s-${esc(String(t.status).replace(/\s/g, ""))}">${esc(t.status)}</em><span class="kt-bar"><u style="width:${+t.progress || 0}%"></u></span><span class="kt-d">${esc(t.start.slice(5).replace("-", "/"))}–${esc(t.end.slice(5).replace("-", "/"))}</span><span class="kt-tl"><u style="left:${((ts(t.start) - a0) / span) * 100}%;width:${Math.max(((ts(t.end) + 86400000 - ts(t.start)) / span) * 100, 2)}%"></u>${nowPct >= 0 ? `<s style="left:${nowPct}%"></s>` : ""}</span></div>`).join("")}</div>`;
    };
    const place = (row) => { const r = row.getBoundingClientRect(), w = Math.min(760, innerWidth - 24); tip.style.width = w + "px"; tip.style.left = Math.max(12, Math.min(r.left + 24, innerWidth - w - 12)) + "px"; tip.hidden = false; const h = tip.offsetHeight; tip.style.top = (r.bottom + 8 + h <= innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px"; };
    let timer, cur = null; const hide = () => { clearTimeout(timer); cur = null; tip.hidden = true; };
    root.addEventListener("mouseover", (e) => { const row = e.target.closest && e.target.closest(sel); if (!row || row === cur || !root.contains(row)) return; const p = projOf(row); if (!p) return; cur = row; clearTimeout(timer); timer = setTimeout(() => { tip.innerHTML = build(p); place(row); }, 120); });
    root.addEventListener("mouseout", (e) => { const row = e.target.closest && e.target.closest(sel); if (!row || (e.relatedTarget && row.contains(e.relatedTarget))) return; hide(); });
    root.addEventListener("click", hide); root.addEventListener("scroll", hide, true); window.addEventListener("hashchange", hide);
  }
  window.Schedule = { panel, bind, officeHtml, bindOffice, tsv, attachTip };
})();
