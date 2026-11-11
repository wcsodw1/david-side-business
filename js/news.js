/* ============================================================
   NEWS：右側的報紙。有新事件 → 跳出紅色驚嘆號；
   點開報紙看過、按「看過了」或點進報導後才會消掉。
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

  const items = () => P.flatMap((p, i) => (p.updates || []).map((u) => ({ p, i, u, key: keyOf(p, u) })))
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
    mounted = true;
    refresh();
  }

  function unmount() {
    if (!mounted) return;
    close();
    fab.remove(); scrim.remove(); panel.remove();
    mounted = false;
  }

  function refresh() {
    if (!mounted) return;
    const n = unread().length;
    fab.classList.toggle("has-new", n > 0);
    fab.setAttribute("aria-label", n ? `NEWS：${n} 則新消息` : "NEWS：沒有新消息");
    render();
    window.dispatchEvent(new CustomEvent("news:change"));
  }

  function render() {
    const all = items(), un = all.filter((x) => !read.has(x.key)), rd = all.filter((x) => read.has(x.key));
    const d = new Date();
    const dateStr = d.toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    const art = (x, isNew) => `
      <article class="art ${isNew ? "unread" : "seen"}">
        ${isNew ? `<span class="stamp">NEW</span>` : ""}
        <p class="kicker">${esc(x.p.name)} · ${esc(String(x.u.date).replace(/-/g, "."))}</p>
        <h3><a href="#/p/${esc(x.p.id)}" data-key="${esc(x.key)}" data-go>${esc(x.u.title)}</a></h3>
        <p class="body">${esc(x.u.text)}</p>
        ${isNew ? `<button type="button" class="seen-btn" data-key="${esc(x.key)}">✓ 看過了</button>` : ""}
      </article>`;
    panel.innerHTML = `
      <header class="paper-head">
        <button type="button" class="paper-x" data-close aria-label="關閉">✕</button>
        <small>VOL.1 · ${esc(dateStr)}</small>
        <h2>THE DAVID TIMES</h2>
        <div class="rule"></div>
        <p class="sub">${un.length ? `<b>${un.length}</b> 則新消息 · 看過後按「看過了」` : "目前沒有新消息 ☕"}</p>
      </header>
      <div class="paper-body">
        ${un.length ? `<div class="sec">頭條 HEADLINES</div>${un.map((x) => art(x, true)).join("")}` : ""}
        ${rd.length ? `<div class="sec dim">過往報導 ARCHIVE</div>${rd.slice(0, 12).map((x) => art(x, false)).join("")}` : ""}
        ${!all.length ? `<p class="empty-paper">還沒有任何消息。</p>` : ""}
      </div>
      <footer>${un.length ? `<button type="button" class="read-all" data-all>全部標為已讀</button>` : `<span>已全部看過</span>`}</footer>`;
  }

  function onPanelClick(e) {
    if (e.target.closest("[data-close]")) return close();
    if (e.target.closest("[data-all]")) { unread().forEach((x) => read.add(x.key)); save(); return refresh(); }
    const b = e.target.closest(".seen-btn");
    if (b) { read.add(b.dataset.key); save(); return refresh(); }
    const a = e.target.closest("[data-go]");
    if (a) { read.add(a.dataset.key); save(); close(); refresh(); }   // 照常跳到專案頁
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
