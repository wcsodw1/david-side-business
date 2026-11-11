(() => {
  "use strict";

  /* ============================================================
     密碼：只存 SHA-256 雜湊，不存明碼。
     要換密碼：在終端機執行  printf '新密碼' | shasum -a 256
     再把結果貼到下面 PASS_HASH。
     ⚠ 這是「前端擋門」：網站是靜態的，雜湊會公開在原始碼裡，
       足以擋一般訪客，但擋不住有心人。請勿放真正機密的資料。
     ============================================================ */
  const PASS_HASH = "e35cb0b39a3c9730ea7744c873ba8708f63d7f663acf56223045ab88f3167a1c";
  const KEY = "dsb-unlocked";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- SHA-256（crypto.subtle 不可用時的備援） ---------- */
  function sha256Fallback(bytes) {
    const K = [], H = [];
    for (let p = 2, n = 0; n < 64; p++) {
      let prime = true;
      for (let i = 2; i * i <= p; i++) if (p % i === 0) { prime = false; break; }
      if (!prime) continue;
      if (n < 8) H[n] = (Math.pow(p, 1 / 2) % 1 * 4294967296) | 0;
      K[n++] = (Math.pow(p, 1 / 3) % 1 * 4294967296) | 0;
    }
    const l = bytes.length, total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, (l * 8) >>> 0);
    dv.setUint32(total - 8, Math.floor(l * 8 / 4294967296));
    let h = H.slice(); const w = new Int32Array(64);
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0, h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(bytes);
  }

  /* ---------- 資料 ---------- */
  const P = window.PROJECTS || [];
  const S = window.STATUS || {};
  const SITE = window.SITE || {};
  const HUES = [338, 24, 262, 198, 150, 12, 290, 44, 220, 170];
  const hue = (i) => HUES[i % HUES.length];
  const grad = (i) => {
    const h = hue(i);
    return `radial-gradient(120% 90% at 85% 10%, hsl(${h} 90% 72%) 0, transparent 55%),` +
           `linear-gradient(160deg, hsl(${(h + 30) % 360} 70% 45%), hsl(${(h + 250) % 360} 55% 22%))`;
  };
  const accent = (i) => `hsl(${hue(i)} 90% 72%)`;
  const initial = (p) => esc((p.name.match(/[A-Za-z0-9一-龥]/) || ["•"])[0].toUpperCase());
  const st = (p) => S[p.status] || { label: p.status, color: "#aaa" };
  const latest = (p) => (p.updates && p.updates[0]) || null;
  const fmt = (d) => String(d || "").replace(/-/g, ".");

  /* ---------- Mega menu ---------- */
  function buildMega() {
    $("#megaGrid").innerHTML = P.map((p, i) => `
      <a class="mega-item" role="menuitem" href="#/p/${esc(p.id)}">
        <span class="mega-dot" style="background:${accent(i)}">${initial(p)}</span>
        <span class="mega-text">
          <span class="mega-name">${esc(p.name)}</span>
          <span class="mega-meta"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)} · ${p.progress ?? 0}%</span>
        </span>
      </a>`).join("");
    const h3 = $(".mega-intro h3");
    if (h3) h3.textContent = `${P.length} 個正在長大的夢`;
  }

  const nav = $("#nav"), mega = $("#mega"), scrim = $("#megaScrim"), trig = $("#megaTrigger"), megaLink = $("#megaLink");
  let megaTimer;
  const openMega = () => {
    if (window.innerWidth <= 960) return;
    clearTimeout(megaTimer);
    mega.classList.add("open"); scrim.classList.add("on"); nav.classList.add("mega-open"); trig.classList.add("hot");
    megaLink.setAttribute("aria-expanded", "true");
  };
  const closeMega = (delay = 160) => {
    clearTimeout(megaTimer);
    megaTimer = setTimeout(() => {
      mega.classList.remove("open"); scrim.classList.remove("on"); nav.classList.remove("mega-open"); trig.classList.remove("hot");
      megaLink.setAttribute("aria-expanded", "false");
    }, delay);
  };
  [trig, mega].forEach((el) => { el.addEventListener("mouseenter", openMega); el.addEventListener("mouseleave", () => closeMega()); });
  trig.addEventListener("focusin", openMega);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMega(0); });
  mega.addEventListener("click", (e) => { if (e.target.closest("a")) closeMega(0); });

  $("#burger").addEventListener("click", () => {
    const on = nav.classList.toggle("menu-open");
    $("#burger").setAttribute("aria-expanded", String(on));
  });
  $(".nav-links").addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("menu-open"); $("#burger").setAttribute("aria-expanded", "false"); } });

  /* ---------- 畫作視差 ---------- */
  const layers = $$("#painting .layer");
  window.addEventListener("pointermove", (e) => {
    if (document.body.classList.contains("dim")) return;
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    layers.forEach((l) => {
      const d = +l.dataset.depth || 0;
      l.style.transform = `translate(${(-x * d * 1.6).toFixed(1)}px, ${(-y * d * 0.8).toFixed(1)}px)`;
    });
  }, { passive: true });

  /* ---------- 畫面 ---------- */
  const app = $("#app");

  function card(p, i) {
    const l = latest(p);
    return `
      <a class="card" href="#/p/${esc(p.id)}" style="--g:${grad(i)}">
        <span class="cat">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <span class="zh">${esc(p.zh)}</span>
        <p class="sum">${esc(l ? l.title : p.summary)}${l ? `<br><small style="opacity:.7">${fmt(l.date)}</small>` : ""}</p>
        <div class="foot">
          <span class="status"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)}<span class="pct">${p.progress ?? 0}%</span></span>
          <div class="bar"><i data-w="${p.progress ?? 0}"></i></div>
        </div>
      </a>`;
  }

  const views = {
    home() {
      return `
        <section class="hero">
          <div>
            <h1>${esc(SITE.tagline || "A place where dreams come true").replace(/(dreams come true)/i, "<b>$1</b>")}</h1>
            <p class="zh">${esc(SITE.taglineZh || "")}</p>
          </div>
          <div class="cta-row">
            <a class="btn solid" href="#/overview">查看進度總覽</a>
            <a class="btn glass" href="#/updates">最新動態</a>
          </div>
        </section>`;
    },

    overview() {
      const avg = P.length ? Math.round(P.reduce((a, p) => a + (p.progress || 0), 0) / P.length) : 0;
      const live = P.filter((p) => p.status === "live").length;
      const building = P.filter((p) => p.status === "building").length;
      return `
        <section class="page">
          <div class="page-head">
            <p class="eyebrow">OVERVIEW</p>
            <h1>Side Business 總覽</h1>
            <p>所有專案的狀態與進度，一眼看完。</p>
            <div class="stats">
              <div class="stat"><b>${P.length}</b><span>個專案</span></div>
              <div class="stat"><b>${live}</b><span>已上線</span></div>
              <div class="stat"><b>${building}</b><span>進行中</span></div>
              <div class="stat"><b>${avg}%</b><span>平均進度</span></div>
            </div>
          </div>
          <div class="cards">${P.map(card).join("")}</div>
        </section>`;
    },

    updates() {
      const all = P.flatMap((p, i) => (p.updates || []).map((u) => ({ ...u, p, i })))
                   .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return `
        <section class="page">
          <div class="page-head">
            <p class="eyebrow">UPDATES</p>
            <h1>最新動態</h1>
            <p>所有專案的進度紀錄，依日期排列。</p>
          </div>
          <div class="panel">
            ${all.length ? `<ul class="timeline" style="--c:#ffb28a">${all.map((u) => `
              <li style="--c:${accent(u.i)}">
                <time>${fmt(u.date)}</time>
                <h4><a href="#/p/${esc(u.p.id)}">${esc(u.title)}</a><span class="tag">${esc(u.p.name)}</span></h4>
                <p>${esc(u.text)}</p>
              </li>`).join("")}</ul>` : `<p class="empty">還沒有任何紀錄。</p>`}
          </div>
        </section>`;
    },

    project(id) {
      const i = P.findIndex((p) => p.id === id);
      if (i < 0) return `<section class="page"><div class="page-head"><h1>找不到這個專案</h1><p><a href="#/overview" style="color:var(--accent)">← 回到總覽</a></p></div></section>`;
      const p = P[i], prev = P[(i - 1 + P.length) % P.length], next = P[(i + 1) % P.length], c = accent(i);
      const ups = p.updates || [];
      return `
        <section class="page" style="--c:${c}">
          <div class="proj-hero" style="--g:${grad(i)}">
            <div class="crumb"><a href="#/overview">Side Business</a> / ${esc(p.category)}</div>
            <h1>${esc(p.name)}</h1>
            <p class="zh">${esc(p.zh)}</p>
          </div>
          <div class="proj-grid">
            <div class="panel">
              <h2>進度紀錄</h2>
              ${ups.length ? `<ul class="timeline">${ups.map((u) => `
                <li><time>${fmt(u.date)}</time><h4>${esc(u.title)}</h4><p>${esc(u.text)}</p></li>`).join("")}</ul>`
                : `<p class="empty">還沒有紀錄，到 data/projects.js 新增第一筆吧。</p>`}
            </div>
            <aside class="panel side">
              <h2>專案資訊</h2>
              <div class="row"><span>狀態</span><span class="status"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)}</span></div>
              <div class="row"><span>類別</span><span>${esc(p.category)}</span></div>
              <div class="row"><span>進度</span><span>${p.progress ?? 0}%</span></div>
              <div class="bar"><i data-w="${p.progress ?? 0}"></i></div>
              ${p.summary ? `<p style="margin-top:20px;color:var(--ink-2);font-size:14px">${esc(p.summary)}</p>` : ""}
              ${(p.links || []).length ? `<div class="links">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.label)}</span><span>↗</span></a>`).join("")}</div>` : ""}
            </aside>
          </div>
          <nav class="pager" aria-label="上下一個專案">
            <a href="#/p/${esc(prev.id)}"><small>← 上一個</small>${esc(prev.name)}</a>
            <a href="#/p/${esc(next.id)}"><small>下一個 →</small>${esc(next.name)}</a>
          </nav>
        </section>`;
    },
  };

  function render() {
    const hash = location.hash.replace(/^#\/?/, "");
    const [seg, arg] = hash.split("/");
    let html, home = false;
    if (!seg) { html = views.home(); home = true; }
    else if (seg === "overview") html = views.overview();
    else if (seg === "updates") html = views.updates();
    else if (seg === "p") html = views.project(decodeURIComponent(arg || ""));
    else { html = views.home(); home = true; }

    document.body.classList.toggle("dim", !home);
    if (home) layers.forEach((l) => (l.style.transform = ""));
    app.innerHTML = html + `<footer class="foot-note">© ${new Date().getFullYear()} David's Side Business</footer>`;
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => $$("[data-w]", app).forEach((b) => (b.style.width = b.dataset.w + "%"))));
    document.title = (seg === "p" && P.find((p) => p.id === arg) ? P.find((p) => p.id === arg).name + " · " : "") + (SITE.name || "David's Side Business");
  }

  /* ---------- 解鎖 / 鎖定 ---------- */
  function enter() {
    document.body.classList.remove("locked");
    nav.hidden = false; app.hidden = false;
    buildMega();
    render();
  }
  function lock() {
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (_) {}
    location.hash = "";
    app.hidden = true; nav.hidden = true; app.innerHTML = "";
    document.body.classList.add("locked"); document.body.classList.remove("dim");
    $("#pw").value = ""; $("#gateError").textContent = "";
    setTimeout(() => $("#pw").focus(), 50);
  }

  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#pw").value;
    if (!v) return;
    if ((await sha256(v)) === PASS_HASH) {
      try { ($("#remember").checked ? localStorage : sessionStorage).setItem(KEY, PASS_HASH); } catch (_) {}
      enter();
    } else {
      $("#gateError").textContent = "密碼不正確，請再試一次";
      const c = $(".gate-card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
      $("#pw").select();
    }
  });
  $("#lockBtn").addEventListener("click", lock);
  window.addEventListener("hashchange", () => { if (!document.body.classList.contains("locked")) render(); });

  let ok = false;
  try { ok = sessionStorage.getItem(KEY) === PASS_HASH || localStorage.getItem(KEY) === PASS_HASH; } catch (_) {}
  if (ok) enter(); else setTimeout(() => $("#pw").focus(), 50);
})();
