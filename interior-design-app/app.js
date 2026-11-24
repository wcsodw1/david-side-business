(() => {
  "use strict";
  const KEY = "ida-demo-v" + window.DEMO_VERSION;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$ " + Math.round(n).toLocaleString("en-US");
  const fmtD = (d) => (d || "").replace(/-/g, "/");
  const WD = "日一二三四五六";
  const fmtW = (d) => { const x = new Date(d + "T00:00:00"); return isNaN(x) ? fmtD(d) : fmtD(d) + "（" + WD[x.getDay()] + "）"; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const load = () => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return clone(window.DEMO); };
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const proj = (id) => S.projects.find((p) => p.id === id);
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const ui = { filter: "done", city: "all", q: "", tab: "work", pq: "", del: false };
  const NUM = "零一二三四五六七八九";

  /* ---------- icons ---------- */
  const P = {
    back: "M15 5l-7 7 7 7", right: "M9 5l7 7-7 7", down: "M6 9l6 6 6-6", bell: "M6 9a6 6 0 0112 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 19a2 2 0 004 0",
    pen: "M4 20l1-4L16 5l3 3L8 19l-4 1zM14 7l3 3", trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6", dl: "M12 4v11M7 11l5 5 5-5M5 20h14",
    plus: "M12 5v14M5 12h14", pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
    cal: "M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01",
    cone: "M12 3l5 15H7zM9.3 11h5.4M10.6 7h2.8M4 21h16M6 18h12", info: "M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01",
    rcp: "M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21zM12 7v10M14.5 9.2c-.6-.8-4.5-1-4.5 1s4.5 1.2 4.5 3.3-4 1.9-4.7.9",
    search: "M11 4a7 7 0 100 14 7 7 0 000-14zM16.5 16.5L21 21",
  };
  const ic = (n, cls = "", w) => `<svg class="ic ${cls}" viewBox="0 0 24 24" ${w ? `style="width:${w}px;height:${w}px"` : ""}><path d="${P[n]}"/></svg>`;
  const rcp = `<svg class="ic" viewBox="0 0 24 24" style="width:21px;height:21px"><path d="${P.rcp}"/></svg>`;

  const received = (p) => p.installments.filter((i) => i.done).reduce((a, i) => a + p.contract * i.pct / 100, 0);
  const stage = (p) => { const n = p.installments.filter((i) => i.done).length; return n ? "第" + NUM[n] + "期" : "尚未收款"; };
  const cover = (e) => e.imgs && e.imgs[0] ? e.imgs[0] : null;
  const bg = (e) => { const c = cover(e); return c ? `style="background-image:url(${c[0]});background-position:${c[1]}"` : ""; };

  /* ---------- screens ---------- */
  const fakeSb = (lt) => `<div class="fake ${lt ? "lt" : ""}" id="fake"><span>5:04</span><span class="r"><b style="font-weight:700">5G</b><span class="bat">58</span></span></div>`;
  const cta = (txt, k, cls = "") => `<div class="dock"></div><button class="cta ${cls}" data-new="${k}">${txt}</button>`;

  function vList() {
    const all = S.projects, cnt = (s) => all.filter((p) => p.status === s).length;
    const L = all.filter((p) => (ui.filter === "all" || p.status === ui.filter) && (ui.city === "all" || p.city === ui.city) && p.name.includes(ui.q));
    const base = all.filter((p) => ui.filter === "all" || p.status === ui.filter);
    const cities = [...new Set(base.map((p) => p.city))];
    const sub = L.length || base.length ? `<div class="chips c2"><button class="chip ${ui.city === "all" ? "on" : ""}" data-city="all">全部</button>${cities.map((c) => `<button class="chip ${ui.city === c ? "on" : ""}" data-city="${esc(c)}">${esc(c)} (${base.filter((p) => p.city === c).length})</button>`).join("")}</div>` : "";
    const cards = L.map((p) => `<div class="pcard" data-go="#/p/${p.id}"><h3>${esc(p.name)}</h3><div class="ct">${esc(p.city)}</div><div class="ow">屋主：${esc(p.owner)}</div><div class="th" style="background-image:url(${p.hero})"></div><hr><div class="ft"><span class="o">${ic("cone", "", 22)}施工進度：${p.progress}%</span><span class="n">${rcp}收款進度：${stage(p)}</span></div></div>`).join("");
    const empty = `<div class="empty"><img src="img/empty.png" alt=""><p>目前沒有新專案</p></div>`;
    return `<div class="scr">${fakeSb()}<div class="scroll" style="padding-bottom:130px"><div class="hello"><h1>Hi ${esc(S.user)}</h1><div class="avatar"><i></i></div></div>
      <div class="search">${ic("search", "", 18)}<input id="q" placeholder="搜尋案場名稱" value="${esc(ui.q)}"></div>
      <div class="chips">${[["all", "全部"], ["doing", `進行中(${cnt("doing")})`], ["done", `已完工(${cnt("done")})`]].map(([k, t]) => `<button class="chip ${ui.filter === k ? "on" : ""}" data-filter="${k}">${t}</button>`).join("")}</div>
      ${L.length ? sub : ""}${cards || empty}</div>${cta("新增專案", "project")}</div>`;
  }

  function memoCards(L) { return L.slice(0, 2).map((m) => `<div class="kc note" style="margin-top:12px"><h4>${esc(m.title)}</h4><p>${esc(m.text)}</p><div class="dt2">${fmtD(m.date)}</div></div>`).join(""); }
  function vHome(p) {
    const pi = p.progressItems.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const sec = (t, go) => `<div class="sec"><h3>${t}</h3><a data-go="${go}">查看更多${ic("right", "s b")}</a></div>`;
    const ch = [p.checks[0], p.checks[p.checks.length - 1]].filter((c, i, a) => c && a.indexOf(c) === i);
    const kc = ch.map((c, k) => { const i = p.checks.indexOf(c), n = p.checks.length; return `<div class="kc ${k === 0 ? "first" : ""}" data-go="#/p/${p.id}/check/${c.id}"><span class="tag ${c.done ? "" : "g"}">${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}</span><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p>${c.done ? `<div class="d">${fmtD(c.date)}</div><div class="s">已完工</div>` : `<span class="pe">${ic("pen", "", 17)}</span>`}</div>`; }).join("");
    return `<div class="scr">${fakeSb(true)}<div class="sbar" id="sbar"></div><div class="scroll" id="sc" style="padding-bottom:40px"><div class="hero" style="background-image:url(${p.hero})"><button class="hbtn l" data-back>${ic("back", "b", 18)}</button><button class="hbtn r" data-go="#/p/${p.id}/notify">${ic("bell", "", 18)}</button></div>
      <div class="sheet"><h2>${esc(p.name)}</h2><span class="loc">${ic("pin", "", 15)}${esc(p.city)}</span><div class="ds">專案設計師：${esc(p.designer)}</div>
        <div class="prg">${ic("cone", "", 24)}總施工進度：<b>${p.progress}%</b></div><div class="bar"><i style="width:${p.progress}%"></i></div>
        <div class="due">預計完工日： ${esc(p.due)} ${ic("info", "", 18)}</div>
        <div class="pay" data-go="#/p/${p.id}/pay"><span>${rcp}已收款進度：　${stage(p)}</span><span>查看明細${ic("right", "s b")}</span></div><div class="bar n"><i style="width:${received(p) / p.contract * 100}%"></i></div></div>
      ${sec("最新工程進度", `#/p/${p.id}/progress`)}<div class="hs">${pi.map((e) => `<div class="hc" data-go="#/p/${p.id}/progress/${e.id}"><div class="im" ${bg(e)}></div><b>${esc(e.title)}</b><div class="dt">${ic("cal", "s", 16)}${fmtD(e.date)}</div></div>`).join("")}</div>
      ${sec("工程備忘錄", `#/p/${p.id}/memos`)}${p.memos.length ? memoCards(p.memos) : `<button class="box" data-new="memo">${ic("plus", "s", 16)}請新增備忘錄</button>`}
      ${sec("重點工程確認", `#/p/${p.id}/checks`)}${kc}
      ${sec("採購清單", `#/p/${p.id}/buys`)}${p.buys.length ? memoCards(p.buys) : `<div class="box t">無採購工程</div>`}</div></div>`;
  }

  const topBar = (title, right = "") => `<div class="top"><button class="ib" data-back>${ic("back", "b")}</button><h1>${esc(title)}</h1>${right || '<span style="width:38px"></span>'}</div>`;

  function vProgress(p) {
    const cnt = (t) => p.progressItems.filter((e) => e.type === t).length;
    const items = p.progressItems.filter((e) => e.type === ui.tab && e.title.includes(ui.pq)).sort((a, b) => b.date.localeCompare(a.date));
    const by = {}; items.forEach((e) => (by[e.date] = by[e.date] || []).push(e));
    const tl = Object.keys(by).map((d) => `<div class="d">${fmtW(d)}</div>${by[d].map((e) => `<div class="pc" data-go="#/p/${p.id}/progress/${e.id}">${ui.del ? `<button class="x" data-delitem="${e.id}">×</button>` : ""}<div class="im" ${bg(e)}></div><b>${esc(e.title)}</b><p>${esc(e.text)}</p></div>`).join("")}`).join("");
    return `<div class="scr">${fakeSb()}${topBar("最新工程進度", `<button class="ib" data-trash style="${ui.del ? "color:#e5484d" : ""}">${ic("trash")}</button><button class="ib" data-export>${ic("dl")}</button>`)}
      <div class="search w">${ic("search", "", 18)}<input id="pq" placeholder="搜尋案場名稱" value="${esc(ui.pq)}"></div>
      <div class="tabs">${[["work", "工程進度"], ["design", "設計調整"]].map(([k, t]) => `<button class="chip ${ui.tab === k ? "on" : ""}" data-tab="${k}">${t}(${cnt(k)})</button>`).join("")}</div>
      <div class="scroll"><div class="tl">${tl || `<div class="noitem">尚無資料</div>`}</div></div>${cta("新增工程進度", "progress", "p")}</div>`;
  }

  function vDetail(item, kind) {
    const imgs = item.imgs || [];
    const car = imgs.length ? `<div class="car" id="car">${imgs.map((i) => `<div class="sl" style="background-image:url(${i[0]});background-position:${i[1]};background-size:${i[2] > 1 ? i[2] * 100 + "%" : "cover"}"></div>`).join("")}</div><div class="dots" id="dots">${imgs.length > 1 ? imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("") : ""}</div>` : `<div class="car none"></div><div class="dots"></div>`;
    const info = kind === "check" ? `<div class="sb2">${esc(item.sub)}</div><div class="dt">${ic("cal", "s", 17)}${item.date ? fmtD(item.date) : "尚未填寫"}</div>` : `<div class="dt">${ic("cal", "s", 17)}${fmtW(item.date)}</div>`;
    return `<div class="scr">${fakeSb()}<div class="top"><button class="ib" data-back>${ic("back", "b")}</button><span style="flex:1"></span><button class="ib" data-edit="${kind}">${ic("pen")}</button></div>
      <div class="scroll" style="margin-top:4px">${car}<div class="dtl ${kind === "check" ? "" : "pg"}"><h2>${esc(item.title)}</h2>${info}<p>${esc(item.text || "")}</p></div></div></div>`;
  }

  function vChecks(p) {
    return `<div class="scr">${fakeSb()}${topBar("重點工程確認")}<div class="scroll" style="padding-bottom:40px">${p.checks.map((c, i) => `<div class="kc ${i === 0 ? "first" : ""}" data-go="#/p/${p.id}/check/${c.id}"><span class="tag ${c.done ? "" : "g"}">${String(i + 1).padStart(2, "0")} / ${String(p.checks.length).padStart(2, "0")}</span><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p>${c.done ? `<div class="d">${fmtD(c.date)}</div><div class="s">已完工</div>` : `<span class="pe">${ic("pen", "", 17)}</span>`}</div>`).join("")}</div></div>`;
  }

  function vNotes(p, k) {
    const memo = k === "memos", L = p[k];
    return `<div class="scr">${fakeSb()}${topBar(memo ? "工程備忘錄" : "採購清單")}<div class="scroll" style="padding:6px 0 130px">${L.map((m) => `<div class="kc note" style="margin-top:18px"><h4>${esc(m.title)}</h4><p>${esc(m.text)}</p><div class="dt2">${fmtD(m.date)}</div></div>`).join("") || `<div class="box t" style="margin-top:14px">${memo ? "尚無備忘錄" : "無採購工程"}</div>`}</div>${cta(memo ? "新增備忘錄" : "新增採購項目", memo ? "memo" : "buy", "p")}</div>`;
  }

  function vNotify(p) { return `<div class="scr">${fakeSb()}${topBar("通知")}<div class="scroll"><div class="empty" style="margin-top:150px"><img src="img/empty.png" alt=""><p>目前沒有通知</p></div></div></div>`; }

  function vPay(p) {
    const rec = received(p), fee = (L, k) => L.map((f, i) => `<div class="ins sm"><h4>${esc(f.name)}</h4><div class="am">${money(f.amount)}</div></div>`).join("");
    return `<div class="scr">${fakeSb()}${topBar("請款進度")}<div class="scroll" style="padding-bottom:40px"><div class="sum"><div class="lb">${rcp}已付款</div><div class="big">${money(rec)}</div><div class="pb"><i style="width:${rec / p.contract * 100}%"></i></div><div class="rw"><b>已收款進度：${stage(p)}</b><span>工程合約總金額　${money(p.contract)}</span></div></div>
      <div class="sec2" style="margin-top:40px"><h3 class="h3">設計合約</h3></div>${fee(p.design)}<button class="box t sq" style="height:89px;width:calc(100% - 32px);margin:${p.design.length ? 14 : 0}px 16px 0" data-new="fee">${ic("plus", "s", 16)}新增設計費用</button>
      <div class="sec2"><h3 class="h3">工程合約</h3><a data-set>編輯設定${ic("right", "s b")}</a></div>
      <div class="lbl" style="margin-top:0">收款樣式 <i>*</i></div><div class="sel"><select data-paytype>${["A .一次收款", "B .收款比例分配"].map((o) => `<option ${p.payType === o ? "selected" : ""}>${o}</option>`).join("")}</select>${ic("down", "", 18)}</div>
      ${p.installments.map((i, k) => `<div class="ins"><h4>第${"一二三四五六七八九"[k]}期工程款：<span>${esc(i.name)}</span></h4><button class="bd ${i.done ? "" : "w"}" data-inst="${k}">${i.done ? "完成" : "待收"}</button>
        <div class="ln" style="top:37px">請款日期： <em>${esc(i.billed)}</em><button data-ed="${k}:billed">${ic("pen", "s")}</button></div><div class="ln" style="top:57px">收款日期： <em>${esc(i.received)}</em><button data-ed="${k}:received">${ic("pen", "s")}</button></div><div class="ln" style="top:84px">備註： <em>${esc(i.note) || "-"}</em></div>
        <div class="am">${money(p.contract * i.pct / 100)}<small>(${i.pct}%)</small></div><button class="pe" data-ed="${k}:note">${ic("pen", "s")}</button></div>`).join("")}
      <div class="sec2"><h3 class="h3">工程追加項目</h3></div>${fee(p.extras)}<button class="box t sq" style="height:89px;width:calc(100% - 32px);margin:${p.extras.length ? 14 : 0}px 16px 0" data-new="extra">${ic("plus", "s", 16)}新增追加減款項</button></div></div>`;
  }

  /* ---------- router ---------- */
  const mem = {}; let depth = 0;
  function render() {
    const h = location.hash.replace(/^#/, "") || "/", seg = h.split("/").filter(Boolean);
    if (h === "/reset") { try { localStorage.removeItem(KEY); } catch (e) {} S = load(); location.hash = "#/"; return; }
    const p = seg[0] === "p" ? proj(seg[1]) : null; let html = "";
    if (!seg.length || !p) html = vList();
    else if (seg.length === 2) html = vHome(p);
    else if (seg[2] === "progress" && !seg[3]) html = vProgress(p);
    else if (seg[2] === "progress") { const e = p.progressItems.find((x) => x.id === seg[3]); html = e ? vDetail(e, "progress") : vHome(p); }
    else if (seg[2] === "pay") html = vPay(p);
    else if (seg[2] === "checks") html = vChecks(p);
    else if (seg[2] === "check") { const c = p.checks.find((x) => x.id === seg[3]); html = c ? vDetail(c, "check") : vHome(p); }
    else if (seg[2] === "memos" || seg[2] === "buys") html = vNotes(p, seg[2]);
    else if (seg[2] === "notify") html = vNotify(p);
    else html = vHome(p);
    const app = $("#app"); app.innerHTML = html + `<div class="home-ind"></div>`;
    const sc = app.querySelector(".scroll"); if (sc) { sc.scrollTop = mem[h] || 0; sc.addEventListener("scroll", () => { mem[h] = sc.scrollTop; sb(sc); }, { passive: true }); sb(sc); }
    const car = $("#car"); if (car) car.addEventListener("scroll", () => { const i = Math.round(car.scrollLeft / car.clientWidth); document.querySelectorAll("#dots i").forEach((d, k) => d.classList.toggle("on", k === i)); }, { passive: true });
  }
  function sb(sc) { const b = $("#sbar"), f = $("#fake"); if (!b) return; const on = sc.scrollTop > 190; b.classList.toggle("on", on); if (f) f.classList.toggle("lt", !on); }
  const goto = (h) => { depth++; location.hash = h; };
  function parent() { const seg = location.hash.replace(/^#/, "").split("/").filter(Boolean); if (seg.length <= 2) return "#/"; if (seg[2] === "progress" && seg[3]) return `#/p/${seg[1]}/progress`; return `#/p/${seg[1]}`; }

  /* ---------- forms ---------- */
  function form(title, fields, onOk) {
    const m = $("#modal");
    m.innerHTML = `<div class="mbox"><h3>${title}</h3>${fields.map((f) => `<label>${f.l}</label>${f.t === "area" ? `<textarea name="${f.n}">${esc(f.v ?? "")}</textarea>` : f.t === "sel" ? `<select name="${f.n}">${f.o.map(([v, t]) => `<option value="${v}" ${f.v === v ? "selected" : ""}>${t}</option>`).join("")}</select>` : `<input name="${f.n}" type="${f.t || "text"}" value="${esc(f.v ?? "")}">`}`).join("")}<div class="btns"><button class="no">取消</button><button class="ok">儲存</button></div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ""; };
    m.querySelector(".no").onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelector(".ok").onclick = () => { const v = {}; m.querySelectorAll("[name]").forEach((x) => (v[x.name] = x.value.trim())); if (onOk(v) !== false) close(); };
  }
  const curP = () => proj((location.hash.match(/#\/p\/([^/]+)/) || [])[1]);
  const curItem = (kind) => { const seg = location.hash.replace(/^#/, "").split("/").filter(Boolean), p = curP(); return kind === "check" ? p.checks.find((c) => c.id === seg[3]) : p.progressItems.find((e) => e.id === seg[3]); };
  const ph = (n) => n % 2 ? ["img/tile.jpg", "50% 50%", 1] : ["img/paint.jpg", "50% 50%", 1];

  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-go],[data-back],[data-filter],[data-city],[data-tab],[data-new],[data-inst],[data-ed],[data-trash],[data-export],[data-delitem],[data-edit],[data-set]");
    if (!t) return; const d = t.dataset;
    if (d.delitem) { ev.stopPropagation(); const p = curP(), e = p.progressItems.find((x) => x.id === d.delitem); if (e && confirm("刪除「" + e.title + "」？")) { p.progressItems = p.progressItems.filter((x) => x !== e); save(); render(); } return; }
    if (d.go) goto(d.go);
    else if ("back" in d) { if (depth > 0) { depth--; history.back(); } else location.hash = parent(); }
    else if (d.filter) { ui.filter = d.filter; ui.city = "all"; render(); }
    else if (d.city) { ui.city = d.city; render(); }
    else if (d.tab) { ui.tab = d.tab; render(); }
    else if ("trash" in d) { ui.del = !ui.del; render(); }
    else if ("export" in d) { const p = curP(), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(p.progressItems.map(({ imgs, ...r }) => r), null, 2)], { type: "application/json" })); a.download = "progress.json"; a.click(); }
    else if (d.inst !== undefined) { const i = curP().installments[+d.inst]; i.done = !i.done; if (i.done && !i.received) i.received = today(); save(); render(); }
    else if (d.ed) { const [k, f] = d.ed.split(":"), i = curP().installments[+k]; form(f === "note" ? "編輯備註" : f === "billed" ? "編輯請款日期" : "編輯收款日期", [{ n: "v", l: f === "note" ? "備註" : "日期", t: f === "note" ? "text" : "date", v: i[f] }], (v) => { i[f] = v.v; save(); render(); }); }
    else if (d.edit) { const it = curItem(d.edit); form("編輯", [{ n: "title", l: "標題", v: it.title }, ...(d.edit === "check" ? [{ n: "sub", l: "說明", v: it.sub }] : []), { n: "date", l: "日期", t: "date", v: it.date }, { n: "text", l: "內容", t: "area", v: it.text }], (v) => { if (!v.title) return false; Object.assign(it, { title: v.title, date: v.date, text: v.text }); if (d.edit === "check") { it.sub = v.sub; it.done = !!v.date; } save(); render(); }); }
    else if ("set" in d) { const p = curP(); form("編輯工程合約", [{ n: "c", l: "工程合約總金額", t: "number", v: p.contract }], (v) => { if (+v.c > 0) { p.contract = +v.c; save(); render(); } else return false; }); }
    else if (d.new) {
      const k = d.new, p = curP();
      if (k === "project") form("新增專案", [{ n: "name", l: "案場名稱" }, { n: "city", l: "地區", v: "台北" }, { n: "owner", l: "屋主" }, { n: "contract", l: "工程合約總金額", t: "number", v: 1000000 }], (v) => { if (!v.name) return false; S.projects.unshift({ id: uid("p"), name: v.name, city: v.city || "台北", owner: v.owner || "屋主", designer: "Allen", status: "doing", progress: 0, due: "", hero: "img/hero.jpg", contract: +v.contract || 0, payType: "B .收款比例分配", installments: [["簽約完成", 30], ["泥作磁磚鋪貼完成", 30], ["油漆進場", 30], ["驗收完成", 10]].map(([name, pct]) => ({ name, pct, billed: "", received: "", done: false, note: "" })), design: [], extras: [], progressItems: [], memos: [], buys: [], checks: [{ id: uid("c"), title: "主要材質型號", sub: "主要裝修材質之品牌、型號或規格紀錄。", date: "", done: false, imgs: [], text: "" }] }); ui.filter = "doing"; ui.city = "all"; save(); render(); });
      else if (k === "progress") form("新增工程進度", [{ n: "type", l: "類型", t: "sel", o: [["work", "工程進度"], ["design", "設計調整"]], v: ui.tab }, { n: "title", l: "標題" }, { n: "date", l: "日期", t: "date", v: today() }, { n: "text", l: "內容", t: "area" }], (v) => { if (!v.title) return false; p.progressItems.push({ id: uid("e"), type: v.type, date: v.date || today(), title: v.title, text: v.text, imgs: [ph(p.progressItems.length)] }); ui.tab = v.type; save(); render(); });
      else if (k === "memo" || k === "buy") form(k === "memo" ? "新增備忘錄" : "新增採購項目", [{ n: "title", l: "標題" }, { n: "text", l: "內容", t: "area" }], (v) => { if (!v.title) return false; p[k === "memo" ? "memos" : "buys"].unshift({ id: uid("m"), date: today(), title: v.title, text: v.text }); save(); render(); });
      else if (k === "fee" || k === "extra") form(k === "fee" ? "新增設計費用" : "新增追加減款項", [{ n: "name", l: "項目名稱" }, { n: "amount", l: "金額（減款請輸入負數）", t: "number" }], (v) => { if (!v.name || v.amount === "") return false; p[k === "fee" ? "design" : "extras"].push({ name: v.name, amount: +v.amount }); save(); render(); });
    }
  });
  document.addEventListener("input", (e) => {
    const id = e.target.id; if (id !== "q" && id !== "pq") return;
    ui[id === "q" ? "q" : "pq"] = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#" + id); q.focus(); q.setSelectionRange(pos, pos);
  });
  document.addEventListener("change", (e) => { if (e.target.dataset && "paytype" in e.target.dataset) { curP().payType = e.target.value; save(); } });
  window.addEventListener("hashchange", render);
  render();
})();
