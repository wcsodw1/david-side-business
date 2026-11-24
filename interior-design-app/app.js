(() => {
  "use strict";
  const KEY = "ida-demo-v" + window.DEMO_VERSION;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$ " + Math.round(n).toLocaleString("en-US");
  const fmtD = (d) => (d || "").replace(/-/g, "/");
  const WD = "日一二三四五六";
  const fmtW = (d) => { const x = new Date(d); return isNaN(x) ? fmtD(d) : fmtD(d) + "（" + WD[x.getDay()] + "）"; };
  const load = () => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return JSON.parse(JSON.stringify(window.DEMO)); };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const proj = (id) => S.projects.find((p) => p.id === id);
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  const today = () => new Date().toISOString().slice(0, 10);
  const ui = { filter: "all", city: "all", q: "", tab: "work" };

  const ICON = { back: "‹", bell: "🔔", edit: "✎", cal: "🗓" };
  const art = (c, extra = "") => `<div class="im ${c}" ${extra}></div>`;
  const bar = (title, right = "") => `<div class="bar"><button class="ib" data-back>${ICON.back}</button><h1>${esc(title)}</h1>${right || '<span style="width:40px"></span>'}</div>`;
  const received = (p) => p.installments.filter((i) => i.done).reduce((a, i) => a + p.contract * i.pct / 100, 0);
  const stage = (p) => { const n = p.installments.filter((i) => i.done).length; return n ? "第" + "零一二三四五六七八九"[n] + "期" : "尚未收款"; };

  /* ---------------- 畫面 ---------------- */
  function vList() {
    const all = S.projects, n = (s) => all.filter((p) => p.status === s).length;
    let L = all.filter((p) => (ui.filter === "all" || p.status === ui.filter) && (ui.city === "all" || p.city === ui.city) && p.name.includes(ui.q));
    const cities = [...new Set(all.map((p) => p.city))];
    const cards = L.map((p) => `<div class="pcard" data-go="#/p/${p.id}"><div class="row"><div class="t"><h3>${esc(p.name)}</h3><small>${esc(p.city)}</small><div class="own">屋主：${esc(p.owner)}</div></div><div class="thumb ${p.art}"></div></div><div class="meta"><span>🚧 <b>施工進度：${p.progress}%</b></span><span>💲 收款進度：${stage(p)}</span></div></div>`).join("");
    const empty = `<div class="empty"><svg viewBox="0 0 200 160"><rect x="70" y="10" width="6" height="140" fill="#f3b25c"/><rect x="110" y="10" width="6" height="140" fill="#f3b25c"/><g fill="#f3b25c"><rect x="70" y="30" width="46" height="5"/><rect x="70" y="60" width="46" height="5"/><rect x="70" y="90" width="46" height="5"/><rect x="70" y="120" width="46" height="5"/></g><circle cx="93" cy="45" r="9" fill="#222"/><rect x="82" y="52" width="22" height="34" rx="6" fill="#222"/><rect x="104" y="44" width="30" height="8" rx="3" fill="#f3b25c"/></svg><div>目前沒有新專案</div></div>`;
    return `<div class="scroll" style="padding:0 0 120px"><div class="hello"><h1>Hi ${esc(S.user)}</h1><div class="avatar"></div></div>
      <div class="search">🔍<input id="q" placeholder="搜尋案場名稱" value="${esc(ui.q)}"></div>
      <div class="chips">${[["all", "全部"], ["doing", `進行中(${n("doing")})`], ["done", `已完工(${n("done")})`]].map(([k, t]) => `<button class="chip ${ui.filter === k ? "on" : ""}" data-filter="${k}">${t}</button>`).join("")}</div>
      <div class="chips" style="padding-top:8px"><button class="chip sm ${ui.city === "all" ? "on" : ""}" data-city="all">全部</button>${cities.map((c) => `<button class="chip sm ${ui.city === c ? "on" : ""}" data-city="${esc(c)}">${esc(c)} (${all.filter((p) => p.city === c).length})</button>`).join("")}</div>
      ${cards || empty}</div><button class="cta" data-new="project">新增專案</button>`;
  }

  function vProject(p) {
    const pi = p.progressItems.slice().sort((a, b) => b.date.localeCompare(a.date));
    const sec = (t, go) => `<div class="sec"><h3>${t}</h3><a data-go="${go}">查看更多 ›</a></div>`;
    const memos = p.memos.length ? p.memos.slice(0, 2).map((m) => `<div class="kc" style="margin-top:8px"><h4>${esc(m.title)}</h4><p style="max-width:100%">${esc(m.text)}</p></div>`).join("") : `<button class="add" data-new="memo">＋ 請新增備忘錄</button>`;
    const buys = p.buys.length ? p.buys.slice(0, 2).map((m) => `<div class="kc" style="margin-top:8px"><h4>${esc(m.title)}</h4><p style="max-width:100%">${esc(m.text)}</p></div>`).join("") : `<div class="add" style="cursor:default">無採購工程</div>`;
    const checks = p.checks.filter((_, i) => i === 0 || i === p.checks.length - 1).map((c) => { const i = p.checks.indexOf(c); return `<div class="kc" data-go="#/p/${p.id}/check/${c.id}"><span class="tag ${c.done ? "" : "g"}">${String(i + 1).padStart(2, "0")} / ${String(p.checks.length).padStart(2, "0")}</span><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p><div class="rt">${c.done ? fmtD(c.date) + "<b>已完工</b>" : "✎"}</div></div>`; }).join("");
    return `<div class="scroll" style="padding:0 0 60px"><div class="hero ${p.art}"><button class="back" data-back>‹</button><button class="bell">🔔</button></div>
      <div class="sheet"><h2>${esc(p.name)}</h2><span class="loc">📍 ${esc(p.city)}</span><div class="sub">專案設計師：${esc(p.designer)}</div>
        <div class="prog">🚧 總施工進度：<b>${p.progress}%</b></div><div class="bar2"><i style="width:${p.progress}%"></i></div>
        <div class="due">預計完工日：${esc(p.due)} ⓘ</div>
        <div class="pay" data-go="#/p/${p.id}/pay"><span>💲 已收款進度：　${stage(p)}</span><span>查看明細 ›</span></div><div class="bar2 n"><i style="width:${received(p) / p.contract * 100}%"></i></div></div>
      <div style="padding:0 20px">${sec("最新工程進度", `#/p/${p.id}/progress`)}
        <div class="hs">${pi.slice(0, 5).map((e) => `<div class="hc" data-go="#/p/${p.id}/progress/${e.id}">${art(e.art)}<div class="tx"><b>${esc(e.title)}</b><div class="dt">🗓 ${fmtD(e.date)}</div></div></div>`).join("") || `<div class="add" style="cursor:default">尚無進度</div>`}</div>
        ${sec("工程備忘錄", `#/p/${p.id}/list/memos`)}${memos}
        ${sec("重點工程確認", `#/p/${p.id}/checks`)}${checks}
        ${sec("採購清單", `#/p/${p.id}/list/buys`)}${buys}</div></div>`;
  }

  function vProgress(p) {
    const items = p.progressItems.filter((e) => e.type === ui.tab).sort((a, b) => b.date.localeCompare(a.date));
    const cnt = (t) => p.progressItems.filter((e) => e.type === t).length;
    return `${bar("最新工程進度", `<button class="ib" data-del="progress" title="刪除最新一筆">🗑</button>`)}<div class="scroll"><div class="tabs">${[["work", "工程進度"], ["design", "設計調整"]].map(([k, t]) => `<button class="chip ${ui.tab === k ? "on" : ""}" data-tab="${k}">${t}(${cnt(k)})</button>`).join("")}</div>
      <div class="tl">${items.map((e) => `<div class="d">${fmtW(e.date)}</div><div class="hc" data-go="#/p/${p.id}/progress/${e.id}">${art(e.art)}<div class="tx"><b>${esc(e.title)}</b><p>${esc(e.text).slice(0, 60)}${e.text.length > 60 ? "…" : ""}</p></div></div>`).join("") || `<div class="d">尚無資料</div>`}</div></div><button class="cta" data-new="progress">新增工程進度</button>`;
  }

  const dots = (n, cur) => n > 1 ? `<div class="dots">${Array.from({ length: n }, (_, i) => `<i class="${i === cur ? "on" : ""}" data-slide="${i}"></i>`).join("")}</div>` : "";
  function vDetail(title, e, back) {
    return `<div class="bar"><button class="ib" data-back>‹</button><span style="flex:1"></span><button class="ib">✎</button></div>
      <div class="scroll" style="padding:0 0 40px"><div class="car">${art(e.art)}</div>${dots(Math.max(e.n || 1, 1), 0)}
      <div class="dtl"><h2>${esc(e.title)}</h2>${e.sub ? `<div class="dt" style="margin-top:0">${esc(e.sub)}</div>` : ""}<div class="dt">🗓 ${e.date ? fmtW(e.date) : "尚未填寫"}</div><p>${esc(e.text || "尚無內容")}</p></div></div>`;
  }

  function vChecks(p) {
    return `${bar("重點工程確認")}<div class="scroll">${p.checks.map((c, i) => `<div class="kc" data-go="#/p/${p.id}/check/${c.id}"><span class="tag ${c.done ? "" : "g"}">${String(i + 1).padStart(2, "0")} / ${String(p.checks.length).padStart(2, "0")}</span><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p><div class="rt">${c.done ? fmtD(c.date) + "<b>已完工</b>" : "✎"}</div></div>`).join("")}</div>`;
  }

  function vList2(p, k) {
    const name = k === "memos" ? "工程備忘錄" : "採購清單";
    const L = p[k];
    return `${bar(name)}<div class="scroll">${L.map((m) => `<div class="kc"><h4>${esc(m.title)}</h4><p style="max-width:100%">${esc(m.text)}</p><div class="dt">🗓 ${fmtD(m.date)}</div></div>`).join("") || `<div class="add" style="cursor:default">${k === "memos" ? "尚無備忘錄" : "無採購工程"}</div>`}</div><button class="cta" data-new="${k === "memos" ? "memo" : "buy"}">新增${k === "memos" ? "備忘錄" : "採購項目"}</button>`;
  }

  function vPay(p) {
    const rec = received(p);
    return `${bar("請款進度")}<div class="scroll"><div class="sum"><small>💲 已付款</small><div class="big">${money(rec)}</div><div class="bar2"><i style="width:${rec / p.contract * 100}%"></i></div><div class="row"><b>已收款進度：${stage(p)}</b><span>工程合約總金額　${money(p.contract)}</span></div></div>
      <div class="sec"><h3>設計合約</h3></div><button class="add" data-new="fee">＋ 新增設計費用</button>
      <div class="sec"><h3>工程合約</h3><a>編輯設定 ›</a></div>
      <div style="color:var(--mute);font-size:14px">收款樣式 <span style="color:#d33">*</span></div><div class="sel">${esc(p.payType)} ⌄</div>
      ${p.installments.map((i, k) => `<div class="ins" data-inst="${k}"><h4>第${"一二三四五六七八九"[k]}期工程款：<span>${esc(i.name)}</span></h4><span class="badge ${i.done ? "" : "w"}">${i.done ? "完成" : "待收"}</span><div class="l">請款日期：${fmtD(i.billed) || "　"} ✎<br>收款日期：${fmtD(i.received) || "　"} ✎<br>備註： -</div><div class="amt">${money(p.contract * i.pct / 100)} <small>(${i.pct}%)</small></div></div>`).join("")}
      <div class="sec"><h3>工程追加項目</h3></div><button class="add" data-new="extra">＋ 新增追加減款項</button></div>`;
  }

  /* ---------------- 路由 ---------------- */
  function render() {
    const h = location.hash.replace(/^#/, "") || "/", seg = h.split("/").filter(Boolean);
    const app = $("#app"); let html = "";
    if (h === "/reset") { try { localStorage.removeItem(KEY); } catch (e) {} S = load(); location.hash = "#/"; return; }
    const p = seg[0] === "p" ? proj(seg[1]) : null;
    if (!seg.length) html = vList();
    else if (p && seg.length === 2) html = vProject(p);
    else if (p && seg[2] === "progress" && !seg[3]) html = vProgress(p);
    else if (p && seg[2] === "progress") { const e = p.progressItems.find((x) => x.id === seg[3]); html = e ? vDetail("", e) : vList(); }
    else if (p && seg[2] === "pay") html = vPay(p);
    else if (p && seg[2] === "checks") html = vChecks(p);
    else if (p && seg[2] === "check") { const c = p.checks.find((x) => x.id === seg[3]); html = c ? vDetail("", c) : vList(); }
    else if (p && seg[2] === "list") html = vList2(p, seg[3] === "buys" ? "buys" : "memos");
    else html = vList();
    app.innerHTML = html; const sc = app.querySelector(".scroll"); if (sc) sc.scrollTop = 0;
  }

  /* ---------------- 互動 ---------------- */
  function form(title, fields, onOk) {
    const m = $("#modal");
    m.innerHTML = `<div class="mbox"><h3>${title}</h3>${fields.map((f) => `<label>${f.l}</label>${f.t === "area" ? `<textarea name="${f.n}"></textarea>` : f.t === "sel" ? `<select name="${f.n}">${f.o.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>` : `<input name="${f.n}" type="${f.t || "text"}" value="${f.v ?? ""}">`}`).join("")}<div class="btns"><button class="no">取消</button><button class="ok">儲存</button></div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ""; };
    m.querySelector(".no").onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelector(".ok").onclick = () => { const v = {}; m.querySelectorAll("[name]").forEach((x) => (v[x.name] = x.value.trim())); if (onOk(v) !== false) close(); };
  }
  const curP = () => proj((location.hash.match(/#\/p\/([^/]+)/) || [])[1]);
  const ARTS = ["art-tile", "art-paint", "art-wood", "art-room"];

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-go],[data-back],[data-filter],[data-city],[data-tab],[data-new],[data-del],[data-inst],[data-slide]");
    if (!t) return;
    if (t.dataset.go) location.hash = t.dataset.go;
    else if ("back" in t.dataset) { const seg = location.hash.replace(/^#/, "").split("/").filter(Boolean); if (seg.length <= 2) location.hash = "#/"; else location.hash = "#/p/" + seg[1] + (seg[2] === "progress" && seg[3] ? "/progress" : seg[2] === "check" && history.length > 1 ? "" : ""); }
    else if (t.dataset.filter) { ui.filter = t.dataset.filter; render(); }
    else if (t.dataset.city) { ui.city = t.dataset.city; render(); }
    else if (t.dataset.tab) { ui.tab = t.dataset.tab; render(); }
    else if (t.dataset.slide) { document.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", String(i) === t.dataset.slide)); document.querySelector(".car .im").style.filter = `hue-rotate(${t.dataset.slide * 12}deg) brightness(${1 - t.dataset.slide * 0.04})`; }
    else if (t.dataset.inst !== undefined) { const p = curP(), i = p.installments[+t.dataset.inst]; i.done = !i.done; i.received = i.done ? today() : ""; save(); render(); }
    else if (t.dataset.del) { const p = curP(); const L = p.progressItems.filter((e) => e.type === ui.tab).sort((a, b) => b.date.localeCompare(a.date)); if (L[0] && confirm("刪除最新一筆「" + L[0].title + "」？")) { p.progressItems = p.progressItems.filter((e) => e !== L[0]); save(); render(); } }
    else if (t.dataset.new) {
      const k = t.dataset.new, p = curP();
      if (k === "project") form("新增專案", [{ n: "name", l: "案場名稱" }, { n: "city", l: "地區", v: "台北" }, { n: "owner", l: "屋主" }, { n: "contract", l: "工程合約總金額", t: "number", v: 1000000 }], (v) => { if (!v.name) return false; S.projects.unshift({ id: uid("p"), name: v.name, city: v.city || "台北", owner: v.owner || "屋主", designer: S.user, status: "doing", progress: 0, due: "", art: "art-hero", contract: +v.contract || 0, payType: "B .收款比例分配", installments: [{ name: "簽約完成", pct: 30, billed: "", received: "", done: false }, { name: "泥作磁磚鋪貼完成", pct: 30, billed: "", received: "", done: false }, { name: "油漆進場", pct: 30, billed: "", received: "", done: false }, { name: "驗收完成", pct: 10, billed: "", received: "", done: false }], progressItems: [], memos: [], buys: [], checks: [{ id: uid("c"), title: "主要材質型號", sub: "主要裝修材質之品牌、型號或規格紀錄。", date: "", done: false, art: "art-blank", n: 0, text: "" }] }); ui.filter = "all"; ui.city = "all"; save(); render(); });
      else if (k === "progress") form("新增工程進度", [{ n: "type", l: "類型", t: "sel", o: [["work", "工程進度"], ["design", "設計調整"]] }, { n: "title", l: "標題" }, { n: "date", l: "日期", t: "date", v: today() }, { n: "text", l: "內容", t: "area" }], (v) => { if (!v.title) return false; p.progressItems.push({ id: uid("e"), type: v.type, date: v.date || today(), title: v.title, text: v.text, art: ARTS[Math.floor(Math.random() * 4)], n: 1 }); ui.tab = v.type; if (v.type === "work") p.progress = Math.min(100, p.progress + 5); save(); render(); });
      else if (k === "memo" || k === "buy") form(k === "memo" ? "新增備忘錄" : "新增採購項目", [{ n: "title", l: "標題" }, { n: "text", l: "內容", t: "area" }], (v) => { if (!v.title) return false; p[k === "memo" ? "memos" : "buys"].unshift({ id: uid("m"), date: today(), title: v.title, text: v.text }); save(); render(); });
      else alert("這個功能在 POC 還沒開放，之後版本再加。");
    }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "q") { ui.q = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#q"); q.focus(); q.setSelectionRange(pos, pos); } });
  window.addEventListener("hashchange", render);
  render();
})();
