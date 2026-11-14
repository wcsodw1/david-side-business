/* ============================================================
   NEWS：右側的報紙。上半是「各專案現況」（每個專案的狀態 / 目前狀態 / Next Step / 目標），
   下半是最近的更新紀錄。有新更新的專案會蓋 NEW 章，看過後按「看過了」才會消掉。
   已讀狀態存在這台瀏覽器（localStorage）。
   ============================================================ */
(() => {
  "use strict";
  const KEY = "dsb-news-read";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let P = [], H = {}, fab, scrim, panel, read = new Set(), mounted = false, open = false;

  const load = () => { try { read = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (_) { read = new Set(); } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...read])); } catch (_) {} };
  const keyOf = (p, u) => `${p.id}|${u.date}|${u.title}`;

  const items = () => P.flatMap((p, i) => (p.updates || []).filter((u) => !/專案頁建立/.test(u.title)).map((u) => ({ p, i, u, key: keyOf(p, u) })))   // 「專案頁建立」是系統訊息，不算更新
    .sort((a, b) => String(b.u.date).localeCompare(String(a.u.date)));
  const unread = () => items().filter((x) => !read.has(x.key));

  const api = (window.News = {
    mount, unmount,
    isOpen: () => open,
    close,
    unreadCount: (pid) => unread().filter((x) => !pid || x.p.id === pid).length,
    isUnread: (p, u) => !read.has(keyOf(p, u)),
    // 自己記錄的更新不算「新消息」；在白板上按「看過了」可一次標記某專案
    markRead: (p, u) => { load(); read.add(keyOf(p, u)); save(); if (mounted) refresh(); },
    markProject: (pid) => { load(); items().filter((x) => x.p.id === pid).forEach((x) => read.add(x.key)); save(); if (mounted) refresh(); },
  });

  const PAPER = `
    <svg viewBox="0 0 72 80" aria-hidden="true">
      <g class="paper-tilt">
        <rect x="9" y="12" width="54" height="62" rx="4" fill="#d9ccaa" transform="rotate(5 36 43)"/>
        <rect x="7" y="8" width="54" height="62" rx="4" fill="#f4ecd8" stroke="#2a2218" stroke-width="1.6"/>
        <rect x="12" y="13" width="44" height="13" rx="1.5" fill="#1c1a17"/>
        <text x="34" y="23.4" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="800" font-size="10.5" letter-spacing="1.6" fill="#f4ecd8">NEWS</text>
        <rect x="12" y="31" width="20" height="14" rx="1" fill="#b9a67a"/>
        <g stroke="#2a2218" stroke-width="1.6" stroke-linecap="round" opacity=".75">
          <path d="M36 33h20M36 38h20M36 43h14M12 51h44M12 56h44M12 61h30"/>
        </g>
      </g>
    </svg>`;

  function mount(projects, helpers) {
    unmount();
    P = projects; H = helpers || {};
    load();

    fab = document.createElement("button");
    fab.className = "news-fab"; fab.type = "button"; fab.setAttribute("aria-label", "NEWS 最新消息");
    fab.innerHTML = `${PAPER}<span class="news-bang" aria-hidden="true">!</span><span class="news-tip">NEWS</span>`;
    fab.addEventListener("click", () => (open ? close() : openPanel()));

    scrim = document.createElement("div");
    scrim.className = "news-scrim"; scrim.addEventListener("click", close);

    panel = document.createElement("aside");
    panel.className = "news-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "最新消息報紙");
    panel.addEventListener("click", onPanelClick);

    document.body.append(fab, scrim, panel);
    mounted = true; window.addEventListener("store:change", onStore);
    refresh();
  }

  function unmount() {
    if (!mounted) return;
    close();
    fab.remove(); scrim.remove(); panel.remove(); window.removeEventListener("store:change", onStore); if (popBox) { popBox.remove(); popBox = null; }
    mounted = false;
  }

  // 專案一有更新就從 NEWS 圖示旁彈出提示卡（約 7 秒後自動收起；點一下打開報紙）
  const KIND_LABEL = { status: "狀態", note: "目前狀態", next: "Next Step", goal: "專案目標", tasks: "時程表" };
  let popBox = null;
  function pop(d) {
    const p = P.find((x) => x.id === d.pid); if (!p || !d.text && d.kind !== "status") return;
    if (!popBox) { popBox = document.createElement("div"); popBox.className = "news-pops"; document.body.appendChild(popBox); }
    const who = d.remote ? (d.who === "aeris" ? "ARIES" : "David") + " 更新了" : "已更新";
    const el = document.createElement("div"); el.className = "news-pop";
    const val = d.kind === "status" ? (d.text ? `<span class="ps-chip ps-${STATUS_CLS[d.text] || "TODO"}">${esc(d.text)}</span>` : "（已清除）") : esc(d.text);
    el.innerHTML = `<small>NEWS · ${esc(who)}</small><b>${esc(p.name)}</b><p><em>${esc(KIND_LABEL[d.kind] || "")}</em> ${val}</p>`;
    el.addEventListener("click", () => { el.remove(); openPanel(); });
    popBox.appendChild(el); while (popBox.children.length > 3) popBox.firstChild.remove();
    requestAnimationFrame(() => el.classList.add("on")); setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 400); }, 7000);
  }
  function onStore(e) { if (mounted) { refresh(); const d = e && e.detail; if (d && d.pid && !document.body.classList.contains("locked")) pop(d); } }

  function refresh() {
    if (!mounted) return;
    const n = unread().length;
    fab.classList.toggle("has-new", n > 0);
    fab.setAttribute("aria-label", n ? `NEWS：${n} 則新消息` : "NEWS：沒有新消息");
    render();
    window.dispatchEvent(new CustomEvent("news:change"));
  }

  const STATUS_CLS = { TODO: "TODO", PENDING: "PENDING", BLOCK: "BLOCK", "ON PROCESS": "ON-PROCESS", FINISH: "FINISH" };

  function render() {
    const all = items(), unreadKeys = new Set(unread().map((x) => x.key));
    const d = new Date();
    const dateStr = d.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const real = (p) => (p.updates || []).filter((u) => !/專案頁建立/.test(u.title));
    // 各專案現況卡
    const card = (p) => {
      const ups = p.updates || [], hasNew = ups.some((u) => unreadKeys.has(keyOf(p, u))), last = real(p)[0];
      const st = p.wbStatus ? `<span class="ps-chip ps-${STATUS_CLS[p.wbStatus] || "TODO"}">${esc(p.wbStatus)}</span>` : `<span class="ps-chip ps-none">未設定</span>`;
      const note = p.wbNote || (last ? last.title : "");
      const when = p.wbNoteAt || (last ? last.date : "");
      return `
      <article class="art pj ${hasNew ? "unread" : "seen"}">
        ${hasNew ? `<span class="stamp">NEW</span>` : ""}
        <p class="kicker">${esc(p.category || "")}${when ? ` · ${esc(String(when).replace(/-/g, "."))}` : ""}</p>
        <h3><a href="#/p/${esc(p.id)}" data-go data-pid="${esc(p.id)}">${esc(p.name)}</a> ${st}</h3>
        <p class="body">${note ? esc(note) : `<span class="dimtxt">還沒有狀態更新</span>`}</p>
        <p class="pj-row"><b>Next</b>${p.next ? esc(p.next) : `<span class="dimtxt">尚未設定</span>`}</p>
        <p class="pj-row"><b>目標</b>${p.goal ? esc(p.goal) : `<span class="dimtxt">尚未設定</span>`}</p>
        ${hasNew ? `<button type="button" class="seen-btn" data-pid="${esc(p.id)}">✓ 看過了</button>` : ""}
      </article>`;
    };
    // 最近更新紀錄（不含「專案頁建立」這種系統訊息）
    const recent = all.filter((x) => !/專案頁建立/.test(x.u.title)).slice(0, 8);
    const rec = (x) => `<article class="art ${unreadKeys.has(x.key) ? "unread" : "seen"}"><p class="kicker">${esc(x.p.name)} · ${esc(String(x.u.date).replace(/-/g, "."))}</p><h3><a href="#/p/${esc(x.p.id)}" data-key="${esc(x.key)}" data-go>${esc(x.u.title)}</a></h3>${x.u.text ? `<p class="body">${esc(x.u.text)}</p>` : ""}</article>`;
    const un = P.filter((p) => (p.updates || []).some((u) => unreadKeys.has(keyOf(p, u)))).length;
    panel.innerHTML = `
      <header class="paper-head">
        <button type="button" class="paper-x" data-close aria-label="關閉">✕</button>
        <small>VOL.1 · ${esc(dateStr)}</small>
        <h2>THE DAVID TIMES</h2>
        <div class="rule"></div>
        <p class="sub">${P.length} 個專案現況${un ? ` · <b>${un}</b> 個有新更新` : ""}</p>
      </header>
      <div class="paper-body">
        <div class="sec">專案現況 PROJECT STATUS</div>
        ${P.map(card).join("") || `<p class="empty-paper">還沒有專案。</p>`}
        ${recent.length ? `<div class="sec dim">最近更新 RECENT</div>${recent.map(rec).join("")}` : ""}
      </div>
      <footer>${un ? `<button type="button" class="read-all" data-all>全部標為已讀</button>` : `<span>已全部看過</span>`}</footer>`;
  }

  function onPanelClick(e) {
    if (e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-all]")) { unread().forEach((x) => read.add(x.key)); save(); return refresh(); }
    const b = e.target.closest(".seen-btn");
    if (b) { items().filter((x) => x.p.id === b.dataset.pid).forEach((x) => read.add(x.key)); save(); return refresh(); }
    const a = e.target.closest("[data-go]");
    if (a) { if (a.dataset.key) read.add(a.dataset.key); if (a.dataset.pid) items().filter((x) => x.p.id === a.dataset.pid).forEach((x) => read.add(x.key)); save(); close(); refresh(); }   // 照常跳到專案頁
  }

  function openPanel() {
    open = true;
    render();
    panel.classList.add("open"); scrim.classList.add("on"); fab.classList.add("is-open");
    document.body.classList.add("news-open");
  }
  function close() {
    if (!mounted) return;
    open = false;
    panel.classList.remove("open"); scrim.classList.remove("on"); fab.classList.remove("is-open");
    document.body.classList.remove("news-open");
  }
})();
