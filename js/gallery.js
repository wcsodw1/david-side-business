/* ============================================================
   藝廊：小人用鍵盤在長廊裡左右走，每一幅畫是一個專案。
   ← → / A D 走路　Shift 跑　Enter / Space / ↑ 進入作品
   也可以點畫作或下方小地圖自動走過去；手機用左右按鈕。
   ============================================================ */
(() => {
  "use strict";

  const GAP = 54;     // 兩幅畫的間距（u）
  const FIRST = 80;   // 辦公室的位置（u）；前面留給標題
  const PF = FIRST + 58; // 第一幅畫的位置（u）
  const NEAR = 13;    // 走到畫前多近算「靠近」（u）
  const WALK = 20, RUN = 38; // 速度 u/秒

  const api = (window.Gallery = { active: false, lastId: null, mount, unmount });
  let S = null;

  /* ---------- 每幅畫：用專案色相自動畫一張小風景 ---------- */
  function art(i, hue) {
    const h = hue, h2 = (h + 40) % 360;
    const sx = 28 + ((i * 23) % 44), sy = 38 + ((i * 7) % 18), sr = 9 + (i % 3) * 3;
    const stars = [[14, 14], [70, 20], [48, 10], [86, 40], [20, 44]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${0.7 + (k % 2) * 0.4}" fill="#fff" opacity=".7"/>`).join("");
    return `<svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ga${i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="hsl(${h} 60% 22%)"/><stop offset=".6" stop-color="hsl(${h} 80% 55%)"/><stop offset="1" stop-color="hsl(${h2} 95% 78%)"/>
        </linearGradient>
        <radialGradient id="gh${i}"><stop offset="0" stop-color="hsl(${h2} 100% 92%)" stop-opacity=".8"/><stop offset="1" stop-color="hsl(${h2} 100% 80%)" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="100" height="120" fill="url(#ga${i})"/>${stars}
      <circle cx="${sx}" cy="${sy}" r="${sr * 2.6}" fill="url(#gh${i})"/>
      <circle cx="${sx}" cy="${sy}" r="${sr}" fill="hsl(${h2} 100% 92%)"/>
      <path d="M0 84 C20 66 38 76 58 68 S88 70 100 76 V120 H0Z" fill="hsl(${h} 42% 34%)"/>
      <path d="M0 100 C28 88 58 108 100 92 V120 H0Z" fill="hsl(${h} 50% 18%)"/>
    </svg>`;
  }

  /* ---------- 小人（SVG，之後可換成自己的頭像） ---------- */
  const AVATAR = `
  <svg viewBox="0 0 80 132" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="40" cy="126" rx="24" ry="5" fill="#000" opacity=".35"/>
    <g class="a-bob">
      <g class="a-leg l"><rect x="29" y="92" width="10" height="28" rx="5" fill="#2b2d52"/><ellipse cx="34" cy="121" rx="9" ry="4.6" fill="#fff"/></g>
      <g class="a-leg r"><rect x="41" y="92" width="10" height="28" rx="5" fill="#2b2d52"/><ellipse cx="46" cy="121" rx="9" ry="4.6" fill="#fff"/></g>
      <g class="a-arm l"><rect x="13" y="62" width="10" height="30" rx="5" fill="#ff8f6b"/><circle cx="18" cy="93" r="5" fill="#ffd9b8"/></g>
      <rect x="21" y="58" width="38" height="42" rx="15" fill="#ff8f6b"/>
      <path d="M30 86 h20 v8 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4z" fill="#f27a55"/>
      <g class="a-arm r"><rect x="57" y="62" width="10" height="30" rx="5" fill="#ff8f6b"/><circle cx="62" cy="93" r="5" fill="#ffd9b8"/></g>
      <g class="a-head">
        <circle cx="40" cy="36" r="27" fill="#ffd9b8"/>
        <path d="M13 36 C11 8 69 8 67 36 C62 24 52 19 40 19 C28 19 18 24 13 36Z" fill="#2a2038"/>
        <path d="M14 34 C12 44 15 52 19 54 C17 46 17 40 18 34Z" fill="#2a2038"/>
        <ellipse cx="42" cy="14" rx="19" ry="7" fill="#e8465f"/><circle cx="42" cy="6" r="3.4" fill="#e8465f"/>
        <circle cx="30" cy="40" r="3.4" fill="#2a2038"/><circle cx="50" cy="40" r="3.4" fill="#2a2038"/>
        <circle cx="31.2" cy="38.8" r="1.1" fill="#fff"/><circle cx="51.2" cy="38.8" r="1.1" fill="#fff"/>
        <ellipse cx="24" cy="48" rx="4.6" ry="3" fill="#ff9aa8" opacity=".6"/><ellipse cx="56" cy="48" rx="4.6" ry="3" fill="#ff9aa8" opacity=".6"/>
        <path d="M34 49 Q40 55 46 49" fill="none" stroke="#2a2038" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    </g>
  </svg>`;

  function mount(root, P, H) {
    unmount();
    if (!root) return;
    const N = P.length;
    const fx = (i) => PF + i * GAP;
    // 站點：0 = 辦公室，1..N = 各專案
    const stations = [FIRST, ...P.map((_, i) => fx(i))];
    const endX = fx(N);
    const avg = Math.round(P.reduce((a, p) => a + (p.progress || 0), 0) / (N || 1));
    const worldW = endX + 64;

    root.innerHTML = `
      <div class="g-world" id="gWorld">
        <div class="g-wall"></div>
        <div class="g-floor"></div>
        <div class="g-intro">
          <p class="eyebrow">DAVID'S SIDE BUSINESS</p>
          <h1>A place where <b>dreams come true</b></h1>
          <p class="zh">${H.esc(window.SITE?.taglineZh || "")}</p>
          <p class="walk-hint">往右走，逛逛我的夢想 →</p>
        </div>
        ${P.map((p, i) => `<div class="g-window" style="left:calc(var(--u)*${fx(i) + GAP / 2})"></div>`).join("")}
        <a class="g-office" href="#/office" data-s="0" style="left:calc(var(--u)*${FIRST})" aria-label="辦公室">
          <span class="go-sign">OFFICE · 辦公室</span><span class="g-bang" hidden>!</span>
          <span class="go-room">
            <span class="go-screen">
              ${P.map((p, i) => `<i style="--w:${p.progress ?? 0}%;--c:hsl(${H.hue(i)} 90% 72%);--d:${(i * 0.35).toFixed(2)}s"></i>`).join("")}
              <em>平均 ${avg}%</em>
            </span>
            <span class="go-lamp"></span>
            <span class="go-desk"></span><span class="go-chair"></span><span class="go-plant"></span><span class="go-door"></span>
          </span>
        </a>
        ${P.map((p, i) => `
          <a class="g-frame" href="#/p/${H.esc(p.id)}" data-s="${i + 1}" style="left:calc(var(--u)*${fx(i)})" aria-label="${H.esc(p.name)}">
            <span class="g-cone"></span><span class="g-lamp"></span><span class="g-bang" hidden>!</span>
            <span class="g-fr">
              <span class="g-art">${art(i, H.hue(i))}</span>
              <span class="g-cap">
                <small>${H.esc(p.category)}</small>
                <b>${H.esc(p.name)}</b>
                <span class="g-st"><i style="background:${H.st(p).color}"></i>${H.esc(H.st(p).label)} · ${p.progress ?? 0}%</span>
              </span>
            </span>
          </a>`).join("")}
        <div class="g-end" style="left:calc(var(--u)*${endX})"><span>＋</span><small>下一個夢想<br>即將到來</small></div>
        <div class="g-avatar" id="gAvatar"><div class="g-av-inner">${AVATAR}</div></div>
      </div>

      <div class="g-hud">
        <button class="g-prompt" id="gPrompt" type="button" hidden></button>
        <div class="g-map" id="gMap" aria-label="快速跳轉"><button type="button" class="office" data-s="0" title="辦公室" aria-label="辦公室"></button>${P.map((p, i) => `<button type="button" data-s="${i + 1}" title="${H.esc(p.name)}" aria-label="${H.esc(p.name)}"></button>`).join("")}</div>
        <p class="g-keys"><kbd>←</kbd><kbd>→</kbd> 走路　<kbd>Shift</kbd> 跑　<kbd>Enter</kbd> 進入作品</p>
      </div>
      <div class="g-touch"><button type="button" id="gL" aria-label="向左走">◀</button><button type="button" id="gR" aria-label="向右走">▶</button></div>`;

    const world = root.querySelector("#gWorld"), avatar = root.querySelector("#gAvatar"), prompt = root.querySelector("#gPrompt");
    const frames = [...root.querySelectorAll(".g-office, .g-frame")], dots = [...root.querySelectorAll("#gMap button")];
    const layers = [...document.querySelectorAll("#painting .layer")];

    let u = 8;
    const calcU = () => { u = Math.max(5, Math.min(innerHeight / 100, innerWidth / 62)); root.style.setProperty("--u", u + "px"); };
    calcU();

    const spawnIdx = api.lastId === "__office" ? 0 : (api.lastId ? P.findIndex((p) => p.id === api.lastId) + 1 : -1);
    let x = spawnIdx >= 0 ? stations[spawnIdx] : 14;   // u
    let cam = 0, facing = 1, target = null, openOnArrive = null, nearIdx = -1;
    let left = false, right = false, run = false, touchDir = 0, moved = spawnIdx >= 0;
    const minX = 6, maxX = worldW - 10;
    const camFor = (px) => Math.max(0, Math.min(worldW - innerWidth / u, px - innerWidth / u / 2));
    cam = camFor(x);

    const nearestIndex = () => stations.reduce((b, sx, i) => (Math.abs(x - sx) < Math.abs(x - stations[b]) ? i : b), 0);
    const open = (s) => (s === 0 ? H.office() : H.go(P[s - 1].id));
    const walkTo = (s, thenOpen) => {
      if (thenOpen && Math.abs(x - stations[s]) < NEAR) return open(s);
      target = stations[s]; openOnArrive = thenOpen ? s : null;
    };

    /* ----- 輸入 ----- */
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const onKey = (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.body.classList.contains("locked") || document.body.classList.contains("news-open")) return;
      const down = e.type === "keydown";
      run = e.shiftKey;
      switch (e.code) {
        case "ArrowLeft": case "KeyA":  left = down;  if (down) { target = null; moved = true; } e.preventDefault(); break;
        case "ArrowRight": case "KeyD": right = down; if (down) { target = null; moved = true; } e.preventDefault(); break;
        case "Enter": case "Space": case "ArrowUp": case "KeyW":
          if (down && !e.repeat) { e.preventDefault(); if (nearIdx >= 0) open(nearIdx); }
          break;
      }
    };
    const clearKeys = () => { left = right = run = false; touchDir = 0; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clearKeys);
    const onResize = () => { calcU(); };
    window.addEventListener("resize", onResize);

    frames.forEach((f) => f.addEventListener("click", (e) => { e.preventDefault(); walkTo(+f.dataset.s, true); }));
    dots.forEach((d) => d.addEventListener("click", () => walkTo(+d.dataset.s, false)));
    prompt.addEventListener("click", () => nearIdx >= 0 && open(nearIdx));
    const hold = (id, dir) => {
      const el = root.querySelector(id);
      const on = (e) => { e.preventDefault(); touchDir = dir; target = null; moved = true; };
      const off = () => { if (touchDir === dir) touchDir = 0; };
      el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off);
      el.addEventListener("pointerleave", off); el.addEventListener("pointercancel", off);
    };
    hold("#gL", -1); hold("#gR", 1);

    /* ----- 新消息驚嘆號 ----- */
    const refreshBangs = () => frames.forEach((f, s) => {
      const b = f.querySelector(".g-bang");
      if (b) b.hidden = !(H.unread ? H.unread(s === 0 ? null : P[s - 1].id) : 0);
    });
    window.addEventListener("news:change", refreshBangs);
    refreshBangs();

    /* ----- 主迴圈 ----- */
    let raf = 0, last = performance.now();
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (t - last) / 1000); last = t;

      let dir = (right ? 1 : 0) - (left ? 1 : 0) || touchDir;
      let auto = false;
      if (!dir && target != null) {
        const d = target - x;
        if (Math.abs(d) < 0.6) {
          x = target; target = null;
          if (openOnArrive != null) { const i = openOnArrive; openOnArrive = null; open(i); return; }
        } else { dir = Math.sign(d); auto = true; }
      }
      const speed = (run && !auto) ? RUN : (auto ? 30 : WALK);
      if (dir) {
        x = Math.max(minX, Math.min(maxX, x + dir * speed * dt));
        facing = dir;
        if (target != null) { if ((dir > 0 && x >= target) || (dir < 0 && x <= target)) x = target; }
      }
      avatar.classList.toggle("walking", !!dir);
      avatar.classList.toggle("running", !!dir && (run || auto));
      avatar.classList.toggle("flip", facing < 0);
      avatar.style.transform = `translate3d(${(x * u).toFixed(1)}px,0,0)`;

      cam += (camFor(x) - cam) * Math.min(1, dt * 5);
      world.style.transform = `translate3d(${(-cam * u).toFixed(1)}px,0,0)`;

      // 畫作背景視差
      const maxCam = Math.max(1, worldW - innerWidth / u);
      const pr = cam / maxCam - 0.5;
      for (const l of layers) l.style.transform = `translate(${(-pr * (+l.dataset.depth || 0) * 2.2).toFixed(1)}px,0)`;

      // 靠近哪幅畫
      const ni = nearestIndex();
      const nn = Math.abs(x - stations[ni]) < NEAR ? ni : -1;
      if (nn !== nearIdx) {
        nearIdx = nn;
        frames.forEach((f, i) => f.classList.toggle("near", i === nn));
        dots.forEach((d, i) => d.classList.toggle("on", i === nn));
        if (nn >= 0) {
          prompt.innerHTML = nn === 0
            ? `<kbd>Enter</kbd> 進入 <b>辦公室</b> · 儀表板總覽`
            : `<kbd>Enter</kbd> 進入 <b>${H.esc(P[nn - 1].name)}</b> · ${P[nn - 1].progress ?? 0}%`;
          prompt.hidden = false;
        } else prompt.hidden = true;
      }
      root.classList.toggle("moved", moved);
    };
    raf = requestAnimationFrame(tick);

    S = { root, raf: () => cancelAnimationFrame(raf), onKey, clearKeys, onResize, layers, refreshBangs };
    api.active = true;
  }

  function unmount() {
    if (!S) return;
    S.raf();
    window.removeEventListener("keydown", S.onKey);
    window.removeEventListener("keyup", S.onKey);
    window.removeEventListener("blur", S.clearKeys);
    window.removeEventListener("resize", S.onResize);
    window.removeEventListener("news:change", S.refreshBangs);
    S.layers.forEach((l) => (l.style.transform = ""));
    S = null;
    api.active = false;
  }
})();
