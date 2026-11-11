/* ============================================================
   3D 藝廊（Three.js）：黃昏海邊的玻璃露台藝廊。
   · 預設約 70° 俯視；拖曳 / 觸控 / Q E 可 360° 環繞，滾輪或雙指縮放
   · WASD / 方向鍵走路（依視角方向）、Shift 跑、Enter 進入作品
   · 四周是 360° 日落全景（天空球 + 海面），雲與海面持續流動
   沒有 WebGL 或 Three.js 載入失敗時，app.js 會退回 2D 藝廊。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Gallery3D = { active: false, lastId: null, mount, unmount, supported, closeOverlay: () => !!(S && S.closeBoard && S.closeBoard()) });
  let S = null;

  /* ---------- 版面常數（單位：公尺） ---------- */
  const SPACING = 7.5, OFFICE_X = 15, FIRST_X = 29;
  const DECK_HD = 5.4;                                  // 露台半寬（z）
  const ROOM_HW = 3.2, ROOM_Z0 = -5.3, ROOM_Z1 = -1.6, DOOR_DX = 1.2; // 房間：半寬、後牆、前牆、門中心偏移
  const PL_W = 2.5, PL_D = 1.25, PL_Z = -0.25, PL_DX = -1.7;         // 門外展台
  const TILT = 35 * Math.PI / 180;
  const STAND_Z = 1.1, OFFICE_Z = 0.4;
  const NEAR = 3.4;
  const WALK = 3.4, RUN = 7.0;

  function supported() {
    if (!window.THREE) return false;
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (_) { return false; }
  }

  /* ---------- 小工具 ---------- */
  const mkCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  function mkTex(THREE, canvas, aniso, srgb = true) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = aniso; t.needsUpdate = true;
    return t;
  }

  /* ---------- 全景天空（等距柱狀投影，畫在 canvas 上） ---------- */
  function skyCanvas() {
    const W = 2048, Hh = 1024, c = mkCanvas(W, Hh), g = c.getContext("2d"), hz = Hh * 0.5, rnd = mulberry(11);
    const gr = g.createLinearGradient(0, 0, 0, Hh);
    gr.addColorStop(0, "#07061b"); gr.addColorStop(.22, "#1d1750"); gr.addColorStop(.36, "#5b2f78");
    gr.addColorStop(.44, "#c4577f"); gr.addColorStop(.485, "#ff9b78"); gr.addColorStop(.5, "#ffd9a0");
    gr.addColorStop(.5, "#c9657f"); gr.addColorStop(.62, "#4a2a6c"); gr.addColorStop(1, "#0d0a24");
    g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
    // 星星
    for (let i = 0; i < 700; i++) {
      const y = rnd() * hz * 0.72, a = 0.25 + rnd() * 0.75;
      g.fillStyle = `rgba(255,255,255,${a * (1 - y / (hz * 0.8))})`;
      const r = rnd() < 0.08 ? 1.8 : 0.9; g.fillRect(rnd() * W, y, r, r);
    }
    // 太陽（水平翻轉後會落在 -z 方向）
    const sx = W * 0.25, sy = hz - 34;
    let rg = g.createRadialGradient(sx, sy, 0, sx, sy, 420);
    rg.addColorStop(0, "rgba(255,241,201,.95)"); rg.addColorStop(.18, "rgba(255,197,138,.55)"); rg.addColorStop(1, "rgba(255,155,120,0)");
    g.fillStyle = rg; g.fillRect(sx - 460, sy - 460, 920, 920);
    g.fillStyle = "#fff4d6"; g.beginPath(); g.arc(sx, sy, 44, 0, 7); g.fill();
    // 遠山（兩層，首尾無縫）
    const ridge = (base, amp, ks, col, seed) => {
      const r2 = mulberry(seed), ph = ks.map(() => r2() * 6.28);
      g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 6);
      for (let x = 0; x <= W; x += 4) {
        let h = 0; ks.forEach((k, i) => (h += Math.sin((x / W) * 6.2832 * k + ph[i]) * amp / (1 + i * 0.7)));
        g.lineTo(x, hz - base - Math.max(0, h + amp * 0.6));
      }
      g.lineTo(W, hz + 6); g.closePath(); g.fill();
    };
    ridge(8, 34, [3, 7, 13, 23], "#7a4d92", 3);
    ridge(2, 22, [5, 11, 19, 31], "#352457", 9);
    return c;
  }
  function cloudCanvas() {
    const W = 2048, Hh = 1024, c = mkCanvas(W, Hh), g = c.getContext("2d"), rnd = mulberry(5);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = Hh * (0.27 + rnd() * 0.19), rx = 90 + rnd() * 260, ry = 5 + rnd() * 14;
      const warm = y > Hh * 0.38;
      for (const dx of [0, W, -W]) {
        g.save(); g.translate(x + dx, y); g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry * 2.2);
        gr.addColorStop(0, warm ? "rgba(255,196,160,.55)" : "rgba(255,150,180,.38)"); gr.addColorStop(1, "rgba(255,160,160,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry * 2.2, 0, 7); g.fill(); g.restore();
      }
    }
    return c;
  }
  function waveCanvas() {
    const c = mkCanvas(512, 512), g = c.getContext("2d"), rnd = mulberry(21);
    g.fillStyle = "#2a2866"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * 512, y = rnd() * 512, w = 8 + rnd() * 34;
      g.fillStyle = `rgba(190,170,255,${0.03 + rnd() * 0.08})`;
      for (const dx of [0, 512, -512]) g.fillRect(x + dx, y, w, 1 + rnd() * 1.4);
    }
    return c;
  }
  function glitterCanvas() {
    const W = 256, Hh = 1024, c = mkCanvas(W, Hh), g = c.getContext("2d"), rnd = mulberry(8);
    for (let i = 0; i < 1400; i++) {
      const v = rnd(), x = W / 2 + (rnd() + rnd() + rnd() - 1.5) * (W * 0.28) * (0.25 + (1 - v) * 0.9);
      const a = (0.25 + rnd() * 0.6) * (0.35 + v * 0.65);
      g.fillStyle = `rgba(255,226,170,${a})`; g.fillRect(x, v * Hh, 3 + rnd() * 14, 1.2);
    }
    return c;
  }
  function floorCanvas() {
    const T = 1024, c = mkCanvas(T, T), g = c.getContext("2d"), rnd = mulberry(2), pw = 32;
    for (let y = 0; y < T; y += pw) {
      let x = -((rnd() * 400) | 0);
      while (x < T) {
        const len = 300 + rnd() * 340, l = 21 + rnd() * 8;
        g.fillStyle = `hsl(${24 + rnd() * 8} ${26 + rnd() * 8}% ${l + 2}%)`; g.fillRect(x + 1, y + 1, len - 2, pw - 2);
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = `rgba(0,0,0,${0.04 + rnd() * 0.07})`; g.lineWidth = 1; g.beginPath();
          const yy = y + 3 + rnd() * (pw - 6); g.moveTo(x + rnd() * len * 0.3, yy); g.lineTo(x + len * (0.5 + rnd() * 0.5), yy + (rnd() - 0.5) * 2); g.stroke();
        }
        x += len;
      }
    }
    return c;
  }
  function poolCanvas() {
    const c = mkCanvas(256, 256), g = c.getContext("2d"), rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, "rgba(255,226,170,.9)"); rg.addColorStop(.45, "rgba(255,200,140,.35)"); rg.addColorStop(1, "rgba(255,190,130,0)");
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256); return c;
  }
  function bangCanvas() {
    const c = mkCanvas(128, 128), g = c.getContext("2d");
    g.fillStyle = "#ff3b57"; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill();
    g.lineWidth = 8; g.strokeStyle = "#fff"; g.stroke();
    g.fillStyle = "#fff"; g.font = "800 84px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("!", 64, 70);
    return c;
  }

  /* ---------- 展台上的畫（含專案資訊） ---------- */
  function panelCanvas(p, i, H) {
    const W = 1320, Hh = 870, artH = 600, c = mkCanvas(W, Hh), g = c.getContext("2d"), rnd = mulberry(i * 13 + 4);
    const h = H.hue(i), h2 = (h + 40) % 360;
    const gr = g.createLinearGradient(0, 0, 0, artH);
    gr.addColorStop(0, `hsl(${h} 60% 18%)`); gr.addColorStop(.6, `hsl(${h} 78% 52%)`); gr.addColorStop(1, `hsl(${h2} 92% 76%)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, artH);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`; g.fillRect(rnd() * W, rnd() * artH * 0.5, 2, 2); }
    const sx = W * (0.28 + rnd() * 0.44), sy = artH * (0.3 + rnd() * 0.14), sr = 64 + rnd() * 36;
    const rg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 3.4);
    rg.addColorStop(0, `hsla(${h2},100%,92%,.8)`); rg.addColorStop(1, `hsla(${h2},100%,80%,0)`);
    g.fillStyle = rg; g.fillRect(0, 0, W, artH);
    g.fillStyle = `hsl(${h2} 100% 93%)`; g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
    g.fillStyle = `hsl(${h} 42% 32%)`; g.beginPath(); g.moveTo(0, artH * .7);
    g.bezierCurveTo(W * .2, artH * .52, W * .38, artH * .66, W * .58, artH * .58); g.bezierCurveTo(W * .78, artH * .5, W * .9, artH * .6, W, artH * .64);
    g.lineTo(W, artH); g.lineTo(0, artH); g.fill();
    g.fillStyle = `hsl(${h} 52% 17%)`; g.beginPath(); g.moveTo(0, artH * .85);
    g.bezierCurveTo(W * .26, artH * .72, W * .55, artH * .94, W, artH * .8); g.lineTo(W, artH); g.lineTo(0, artH); g.fill();
    for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${rnd() < .5 ? "255,255,255" : "0,0,0"},${rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * artH, 2, 2); }
    // 說明欄
    g.fillStyle = "#f4ecd8"; g.fillRect(0, artH, W, Hh - artH);
    g.fillStyle = "#8a7a98"; g.font = "600 30px -apple-system, 'Noto Sans TC', sans-serif";
    if ("letterSpacing" in g) g.letterSpacing = "6px";
    g.fillText(String(p.category || "").toUpperCase(), 60, artH + 62);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    let fs = 104; g.fillStyle = "#2a2038";
    do { g.font = `800 ${fs}px Georgia, 'Noto Serif TC', 'Songti TC', serif`; fs -= 4; } while (g.measureText(p.name).width > W - 120 && fs > 40);
    g.fillText(p.name, 60, artH + 160);
    const stt = H.st(p), pr = p.progress ?? 0;
    g.fillStyle = stt.color; g.beginPath(); g.arc(74, artH + 212, 13, 0, 7); g.fill();
    g.fillStyle = "#5b4c70"; g.font = "600 34px -apple-system, 'Noto Sans TC', sans-serif"; g.fillText(`${stt.label}  ·  ${pr}%`, 100, artH + 224);
    g.fillStyle = "#ddd3bf"; g.fillRect(60, artH + 242, W - 120, 10);
    g.fillStyle = `hsl(${h} 78% 52%)`; g.fillRect(60, artH + 242, (W - 120) * pr / 100, 10);
    return c;
  }

  /* ---------- 房內白板的內容 ---------- */
  function boardCanvas(p, i, H) {
    const W = 1400, Hh = 900, c = mkCanvas(W, Hh), g = c.getContext("2d"), h = H.hue(i), stt = H.st(p), pr = p.progress ?? 0;
    g.fillStyle = "#f7f5ef"; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = "rgba(60,50,90,.06)"; g.lineWidth = 1;
    for (let x = 0; x < W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hh); g.stroke(); }
    for (let y = 0; y < Hh; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const fit = (t, mw) => { t = String(t || ""); while (g.measureText(t).width > mw && t.length > 1) t = t.slice(0, -2) + "…"; return t; };
    g.fillStyle = "#8a7a98"; g.font = "600 28px -apple-system, 'Noto Sans TC', sans-serif"; if ("letterSpacing" in g) g.letterSpacing = "6px";
    g.fillText(String(p.category || "").toUpperCase(), 60, 70); if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.fillStyle = "#1f1a33"; let fs = 92; do { g.font = `800 ${fs}px Georgia, 'Noto Serif TC', serif`; fs -= 4; } while (g.measureText(p.name).width > 900 && fs > 44);
    g.fillText(p.name, 60, 160);
    g.fillStyle = stt.color; g.beginPath(); g.arc(74, 214, 13, 0, 7); g.fill();
    g.fillStyle = "#5b4c70"; g.font = "600 32px -apple-system, 'Noto Sans TC', sans-serif"; g.fillText(`${stt.label}  ·  ${p.zh || ""}`, 100, 226);
    // 進度圓環
    const cx = W - 190, cy = 150, r = 86;
    g.lineWidth = 20; g.lineCap = "round"; g.strokeStyle = "#e4dfd2"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = `hsl(${h} 78% 50%)`; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pr / 100); g.stroke();
    g.fillStyle = "#1f1a33"; g.font = "800 62px Georgia, serif"; g.textAlign = "center"; g.fillText(pr + "%", cx, cy + 22); g.textAlign = "left";
    g.strokeStyle = "#1f1a33"; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 272); g.lineTo(W - 60, 272); g.stroke();
    g.fillStyle = "#8a7a98"; g.font = "700 28px -apple-system, 'Noto Sans TC', sans-serif"; if ("letterSpacing" in g) g.letterSpacing = "6px"; g.fillText("最新進度 · LATEST", 60, 322); if ("letterSpacing" in g) g.letterSpacing = "0px";
    const ups = (p.updates || []).slice(0, 4);
    if (!ups.length) { g.fillStyle = "#b8b0c4"; g.font = "500 40px 'Noto Sans TC', sans-serif"; g.fillText("還沒有紀錄", 60, 400); }
    ups.forEach((u, k) => {
      const y = 372 + k * 118, col = `hsl(${(h + k * 28) % 360} 70% 45%)`;
      g.fillStyle = col; g.beginPath(); g.arc(78, y + 14, 12, 0, 7); g.fill();
      g.fillStyle = "#8a7a98"; g.font = "500 26px -apple-system, sans-serif"; g.fillText(String(u.date).replace(/-/g, "."), 108, y + 8);
      g.fillStyle = "#1f1a33"; g.font = "700 42px 'Noto Sans TC', -apple-system, sans-serif"; g.fillText(fit(u.title, W - 220), 108, y + 52);
      g.fillStyle = "#4a3f5e"; g.font = "400 28px 'Noto Sans TC', -apple-system, sans-serif"; g.fillText(fit(u.text, W - 220), 108, y + 90);
    });
    g.fillStyle = "#b8b0c4"; g.font = "500 26px 'Noto Sans TC', sans-serif"; g.fillText("走近白板按 Enter，或直接點白板，看完整紀錄  →", 60, Hh - 30);
    return c;
  }

  function decalCanvas(w, h, draw) { const c = mkCanvas(w, h), g = c.getContext("2d"); draw(g, w, h); return c; }

  /* ---------- 人物（程序生成的寫實比例人形，約 1.8m） ---------- */
  function buildAvatar(THREE, o = {}) {
    const M = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const skin = M(o.skin || 0xe0ac8a, 0.6), hair = M(o.hair || 0x1c1613, 0.55), blazer = M(o.blazer || 0x1f2a44, 0.78), shirt = M(o.shirt || 0xecebe6, 0.8), pants = M(o.pants || 0x2d2f36, 0.8), shoe = M(0x3a261a, 0.4, 0.1);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
    const HIP = 0.94;

    const torso = new THREE.Group(); torso.position.set(0, HIP + 0.02, 0); body.add(torso);
    const chest = mesh(cap(0.165, 0.34), blazer, torso, 0, 0.3, 0); chest.scale.set(1.25, 1, 0.74);
    mesh(new THREE.BoxGeometry(0.13, 0.24, 0.02), shirt, torso, 0, 0.42, 0.115);
    mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.12, 14), skin, torso, 0, 0.66, 0);
    const pelvis = mesh(cap(0.15, 0.1), pants, body, 0, HIP + 0.04, 0); pelvis.scale.set(1.3, 0.8, 0.8); pelvis.rotation.z = Math.PI / 2; pelvis.scale.set(0.8, 1.3, 0.8);

    const head = new THREE.Group(); head.position.set(0, HIP + 0.02 + 0.76, 0); torso.add(head);
    const skull = mesh(new THREE.SphereGeometry(0.112, 24, 20), skin, head, 0, 0, 0); skull.scale.set(0.92, 1.12, 1.0);
    const hairM = mesh(new THREE.SphereGeometry(0.122, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, head, 0, 0.012, -0.012); hairM.scale.set(0.95, 1.1, 1.05);
    mesh(new THREE.SphereGeometry(0.115, 18, 14, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.3), hair, head, 0, -0.01, -0.03).scale.set(0.95, 1.1, 1.05);
    for (const sx of [-1, 1]) {
      mesh(new THREE.SphereGeometry(0.014, 10, 8), M(0x15110f, 0.3), head, sx * 0.037, 0.012, 0.104);
      mesh(new THREE.BoxGeometry(0.036, 0.007, 0.01), hair, head, sx * 0.039, 0.04, 0.105);
      const ear = mesh(new THREE.SphereGeometry(0.02, 10, 8), skin, head, sx * 0.1, -0.005, 0); ear.scale.set(0.5, 1, 0.8);
    }
    mesh(new THREE.ConeGeometry(0.014, 0.04, 8), skin, head, 0, -0.012, 0.112).rotation.x = Math.PI / 2;

    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.255, HIP + 0.02 + 0.56, 0); torso.add(sh);
      mesh(new THREE.SphereGeometry(0.062, 14, 12), blazer, sh);
      mesh(cap(0.05, 0.22), blazer, sh, 0, -0.17, 0);
      const el = new THREE.Group(); el.position.set(0, -0.33, 0); sh.add(el);
      mesh(cap(0.043, 0.2), blazer, el, 0, -0.14, 0);
      mesh(new THREE.SphereGeometry(0.046, 14, 12), skin, el, 0, -0.3, 0.01).scale.set(0.9, 1.15, 0.8);
      return { sh, el };
    };
    const armL = arm(-1), armR = arm(1);
    torso.children.forEach(() => {});
    // 肩膀位置 y 是相對 torso，上面用了絕對值，補正
    armL.sh.position.y = armR.sh.position.y = 0.56;
    head.position.y = 0.76; torso.position.y = HIP + 0.02;

    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.1, HIP, 0); body.add(hip);
      mesh(cap(0.078, 0.3), pants, hip, 0, -0.22, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
      mesh(cap(0.06, 0.3), pants, knee, 0, -0.22, 0);
      const foot = mesh(new THREE.BoxGeometry(0.105, 0.075, 0.27), shoe, knee, 0, -0.455, 0.06);
      foot.geometry.translate(0, 0, 0.0);
      return { hip, knee };
    };
    const legL = leg(-1), legR = leg(1);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    let phase = 0, mv = 0;
    function update(dt, speed, t) {
      const target = speed > 0.05 ? 1 : 0; mv = lerp(mv, target, Math.min(1, dt * 9));
      phase += dt * (1.7 * speed + 0.0);
      const run = clamp((speed - 3.5) / 3.5, 0, 1), amp = lerp(0.55, 0.95, run), s = Math.sin(phase), c = Math.cos(phase);
      legL.hip.rotation.x = s * amp * mv; legR.hip.rotation.x = -s * amp * mv;
      legL.knee.rotation.x = Math.max(0, -c) * amp * 1.5 * mv; legR.knee.rotation.x = Math.max(0, c) * amp * 1.5 * mv;
      armL.sh.rotation.x = -s * amp * 0.8 * mv; armR.sh.rotation.x = s * amp * 0.8 * mv;
      armL.el.rotation.x = -(0.2 + 0.5 * run) * mv - 0.08; armR.el.rotation.x = -(0.2 + 0.5 * run) * mv - 0.08;
      torso.rotation.y = s * 0.14 * mv; torso.rotation.x = 0.04 * mv + 0.16 * run * mv;
      head.rotation.y = -s * 0.07 * mv + Math.sin(t * 0.6) * 0.05 * (1 - mv);
      body.position.y = Math.abs(c) * (0.035 + 0.03 * run) * mv + Math.sin(t * 1.7) * 0.004 * (1 - mv);
    }
    return { root, update, head };
  }

  /* ============================================================
     mount / unmount
     ============================================================ */
  function mount(root, P, H) {
    unmount();
    if (!root || !supported()) return false;
    const THREE = window.THREE, N = P.length;
    const WORLD_W = FIRST_X + N * SPACING + 8;
    const stationsX = [OFFICE_X, ...P.map((_, i) => FIRST_X + i * SPACING)];

    root.innerHTML = `
      <div class="g-hud">
        <button class="g-prompt" id="gPrompt" type="button" hidden></button>
        <div class="g-map" id="gMap" aria-label="快速跳轉"><button type="button" class="office" data-s="0" title="辦公室" aria-label="辦公室"></button>${P.map((p, i) => `<button type="button" data-s="${i + 1}" title="${H.esc(p.name)}" aria-label="${H.esc(p.name)}"></button>`).join("")}</div>
        <p class="g-keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路　<kbd>Shift</kbd> 跑　拖曳 / <kbd>Q</kbd><kbd>E</kbd> 轉 360°　滾輪：門口上滑進門・下滑出門，其他縮放　<kbd>Enter</kbd> 互動</p>
      </div>
      <div class="g-camctl">
        <button type="button" id="gRotL" aria-label="向左轉視角">⟲</button>
        <button type="button" id="gRotR" aria-label="向右轉視角">⟳</button>
        <button type="button" id="gAuto" aria-pressed="false">360° 環繞</button>
        <button type="button" id="gReset">重置視角</button>
      </div>
      <div class="g-board-ov" id="gBoardOv" hidden></div>
      <div class="g-dpad" id="gDpad"><button data-d="u" aria-label="往前">▲</button><button data-d="l" aria-label="往左">◀</button><button data-d="d" aria-label="往後">▼</button><button data-d="r" aria-label="往右">▶</button></div>`;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = "g-canvas"; root.prepend(cv);
    const aniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xb6788f, 0.0017);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2200);

    /* ----- 360° 全景天空 + 雲 + 海 ----- */
    const skyTex = mkTex(THREE, skyCanvas(), aniso); skyTex.wrapS = THREE.RepeatWrapping; skyTex.repeat.x = -1; skyTex.offset.x = 1;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 64, 40), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -3; scene.add(sky);
    const cloudTex = mkTex(THREE, cloudCanvas(), aniso); cloudTex.wrapS = THREE.RepeatWrapping; cloudTex.repeat.x = -1; cloudTex.offset.x = 1;
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(980, 48, 32), new THREE.MeshBasicMaterial({ map: cloudTex, side: THREE.BackSide, transparent: true, fog: false, depthWrite: false }));
    clouds.renderOrder = -2; scene.add(clouds);

    const waveTex = mkTex(THREE, waveCanvas(), aniso); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.repeat.set(90, 90);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: waveTex, color: 0x6a66b8, roughness: 0.32, metalness: 0.55 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(WORLD_W / 2, -1.3, 0); sea.receiveShadow = true; scene.add(sea);
    const glTex = mkTex(THREE, glitterCanvas(), aniso, false); glTex.wrapS = glTex.wrapT = THREE.RepeatWrapping;
    const glitter = new THREE.Mesh(new THREE.PlaneGeometry(130, 700), new THREE.MeshBasicMaterial({ map: glTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    glitter.rotation.x = -Math.PI / 2; glitter.position.set(WORLD_W / 2, -1.28, -390); scene.add(glitter);

    /* ----- 光 ----- */
    scene.add(new THREE.HemisphereLight(0x9a86d8, 0x2a1d33, 0.7));
    const sun = new THREE.DirectionalLight(0xffb27c, 1.9);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);

    /* ----- 露台 ----- */
    const floorTex = mkTex(THREE, floorCanvas(), aniso); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(WORLD_W / 8, (DECK_HD * 2) / 8);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, DECK_HD * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.05 }));
    deck.rotation.x = -Math.PI / 2; deck.position.set(WORLD_W / 2, 0, 0); deck.receiveShadow = true; scene.add(deck);
    const base = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W + 0.6, 1.3, DECK_HD * 2 + 0.6), new THREE.MeshStandardMaterial({ color: 0x1a1630, roughness: 0.8 }));
    base.position.set(WORLD_W / 2, -0.66, 0); base.castShadow = true; base.receiveShadow = true; scene.add(base);
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a35c, metalness: 0.8, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8b8ff, transparent: true, opacity: 0.13, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
    for (const z of [-DECK_HD + 0.05, DECK_HD - 0.05]) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 1.05, 0.03), glass); gl.position.set(WORLD_W / 2, 0.55, z); scene.add(gl);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 0.05, 0.08), brass); rail.position.set(WORLD_W / 2, 1.08, z); scene.add(rail);
      for (let x = 0; x <= WORLD_W; x += 3) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), brass); po.position.set(x, 0.55, z); scene.add(po); }
    }
    for (const x of [0.05, WORLD_W - 0.05]) { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, DECK_HD * 2), glass); gl.position.set(x, 0.55, 0); scene.add(gl); }
    // 路燈
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 2.2 });
    for (let x = 4; x < WORLD_W; x += SPACING) {
      for (const z of [-DECK_HD + 0.35, DECK_HD - 0.35]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.5, metalness: 0.5 }));
        pole.position.set(x, 1.3, z); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), lampMat); bulb.position.set(x, 2.7, z); scene.add(bulb);
      }
    }

    /* ----- 地面標示（起點標題） ----- */
    const introTex = mkTex(THREE, decalCanvas(2048, 640, (g, w, h) => {
      g.textBaseline = "alphabetic"; g.fillStyle = "rgba(255,255,255,.55)"; g.font = "600 34px -apple-system, 'Noto Sans TC', sans-serif";
      if ("letterSpacing" in g) g.letterSpacing = "10px"; g.fillText("DAVID'S SIDE BUSINESS", 20, 70); if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.fillStyle = "#fff"; g.font = "300 150px -apple-system, 'Helvetica Neue', sans-serif"; g.fillText("A place where", 14, 230);
      g.font = "700 150px -apple-system, 'Helvetica Neue', sans-serif"; g.fillText("dreams come true", 14, 390);
      g.fillStyle = "rgba(255,255,255,.8)"; g.font = "400 50px 'Noto Sans TC', -apple-system, sans-serif"; if ("letterSpacing" in g) g.letterSpacing = "14px";
      g.fillText(window.SITE?.taglineZh || "", 20, 480); if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.fillStyle = "#ffb28a"; g.font = "500 44px 'Noto Sans TC', sans-serif"; g.fillText("走向前方，逛逛我的夢想  →", 20, 575);
    }), aniso);
    const decalMat = (map, op = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -2 });
    const intro = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.06), decalMat(introTex));
    intro.rotation.x = -Math.PI / 2; intro.position.set(7.4, 0.012, 1.0); scene.add(intro);

    const poolTex = mkTex(THREE, poolCanvas(), aniso);
    const bangTex = mkTex(THREE, bangCanvas(), aniso);
    const obstacles = [];  // {minX,maxX,minZ,maxZ}
    const addObs = (cx, cz, hw, hd) => obstacles.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
    const pickables = [], pools = [], bangs = [], panelMats = [], boardMats = [], boardTex = [], panelTex = [];

    /* ----- 辦公室（玻璃隔間） ----- */
    (() => {
      const g = new THREE.Group(); g.position.set(OFFICE_X, 0, 0); scene.add(g);
      const M = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
      add(new THREE.PlaneGeometry(8.6, 5.8), M(0x2b2740, 1), 0, 0.014, -2.4, false).rotation.x = -Math.PI / 2;
      const gw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 6.2), glass); gw.position.set(-4.4, 1.3, -2.2); g.add(gw);
      const gw2 = gw.clone(); gw2.position.x = 4.4; g.add(gw2);
      const gb = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.6, 0.04), glass); gb.position.set(0, 1.3, -5.2); g.add(gb);
      for (const [x, z] of [[-4.4, 0.9], [4.4, 0.9], [-4.4, -5.2], [4.4, -5.2]]) add(new THREE.BoxGeometry(0.1, 2.65, 0.1), brass, x, 1.32, z);
      // 辦公桌
      const wood = M(0xc9a36a, 0.55);
      const desk = add(new THREE.BoxGeometry(3.2, 0.06, 1.3), wood, 0, 0.76, -3.0);
      for (const sx of [-1.45, 1.45]) for (const sz of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.06, 0.74, 0.06), M(0x1a1630, 0.4, 0.4), sx, 0.37, -3.0 + sz);
      add(new THREE.BoxGeometry(0.9, 0.5, 0.5), M(0x7a5a3c, 0.6), 1.1, 0.5, -3.0);
      // 螢幕（儀表板）
      const scr = mkTex(THREE, decalCanvas(1024, 600, (c, w, h) => {
        c.fillStyle = "#0e0c22"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#ffe9b8"; c.font = "700 40px -apple-system, sans-serif"; c.fillText("SIDE BUSINESS", 40, 70);
        const avg = Math.round(P.reduce((a, p) => a + (p.progress || 0), 0) / (N || 1));
        c.fillStyle = "#9aa3b2"; c.font = "500 30px 'Noto Sans TC', sans-serif"; c.fillText(`平均進度 ${avg}%`, 40, 112);
        P.forEach((p, i) => {
          const y = 150 + i * 58; c.fillStyle = "rgba(255,255,255,.08)"; c.fillRect(40, y, w - 80, 20);
          c.fillStyle = `hsl(${H.hue(i)} 90% 70%)`; c.fillRect(40, y, (w - 80) * (p.progress || 0) / 100, 20);
          c.fillStyle = "#fff"; c.font = "500 24px -apple-system, sans-serif"; c.fillText(p.name, 40, y - 6);
        });
      }), aniso);
      add(new THREE.BoxGeometry(1.05, 0.66, 0.05), M(0x101018, 0.4, 0.3), 0, 1.17, -3.3);
      add(new THREE.BoxGeometry(0.1, 0.18, 0.1), M(0x101018), 0, 0.88, -3.3);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.56), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false }));
      screen.position.set(0, 1.17, -3.273); g.add(screen);
      add(new THREE.BoxGeometry(0.5, 0.015, 0.16), M(0x2a2550), 0, 0.795, -2.75);
      add(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 14), M(0xf6f1ff, 0.4), -0.9, 0.84, -2.9);
      // 椅子
      add(new THREE.BoxGeometry(0.52, 0.08, 0.5), M(0x8a2f3f, 0.7), 0, 0.5, -2.15);
      add(new THREE.BoxGeometry(0.5, 0.55, 0.07), M(0x8a2f3f, 0.7), 0, 0.82, -1.9);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 10), M(0x15121f, 0.4, 0.6), 0, 0.25, -2.15);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 5), M(0x15121f, 0.4, 0.6), 0, 0.03, -2.15);
      // 書櫃
      const shelf = add(new THREE.BoxGeometry(2.4, 2.3, 0.4), M(0x3b2a22, 0.7), -2.2, 1.15, -4.95);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) add(new THREE.BoxGeometry(0.1, 0.38, 0.28), M(new THREE.Color().setHSL((k * 0.11 + r * 0.2) % 1, 0.5, 0.45), 0.8), -3.1 + k * 0.23, 0.35 + r * 0.52, -4.72);
      // 盆栽
      for (const [px, pz] of [[3.4, -1.0], [-3.7, -0.8]]) {
        add(new THREE.CylinderGeometry(0.28, 0.2, 0.42, 16), M(0xff9b78, 0.7), px, 0.21, pz);
        for (let k = 0; k < 9; k++) { const a = k * 2.4; add(new THREE.SphereGeometry(0.2, 12, 10), M(0x3f9a6a, 0.8), px + Math.cos(a) * 0.14, 0.7 + k * 0.07, pz + Math.sin(a) * 0.14); }
        addObs(OFFICE_X + px, pz, 0.45, 0.45);
      }
      // 吊燈
      add(new THREE.ConeGeometry(0.34, 0.24, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 1.6, side: THREE.DoubleSide }), 0, 2.6, -2.8, false);
      const pl = new THREE.PointLight(0xffd9a0, 1.1, 9); pl.position.set(0, 2.3, -2.6); g.add(pl);
      for (const m of [desk, screen]) { m.userData = { station: 0, kind: "office" }; pickables.push(m); }
      addObs(OFFICE_X, -3.0, 1.75, 0.8); addObs(OFFICE_X - 2.2, -4.9, 1.3, 0.35);
      // 地面標示
      const t = mkTex(THREE, decalCanvas(1024, 256, (c, w, h) => {
        c.textAlign = "center"; c.fillStyle = "#ffe9b8"; c.font = "800 120px Georgia, serif"; if ("letterSpacing" in c) c.letterSpacing = "14px"; c.fillText("OFFICE", w / 2, 130);
        c.fillStyle = "rgba(255,233,184,.8)"; c.font = "500 54px 'Noto Sans TC', sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "10px"; c.fillText("辦公室 · 儀表板", w / 2, 220);
      }), aniso);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), decalMat(t)); d.rotation.x = -Math.PI / 2; d.position.set(OFFICE_X, 0.013, 2.6); scene.add(d);
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true })); bang.position.set(OFFICE_X, 3.3, -2.6); bang.scale.set(0.9, 0.9, 1); bang.renderOrder = 10; scene.add(bang); bangs[0] = bang;
    })();

    /* ----- 專案房間：玻璃隔間 + 門 + 房內白板；門外展台放畫 ----- */
    P.forEach((p, i) => {
      const s = i + 1, sx = FIRST_X + i * SPACING, hue = H.hue(i);
      const g = new THREE.Group(); g.position.set(sx, 0, 0); scene.add(g);
      const M = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
      const mark = (m, kind) => { m.userData = { station: s, kind }; pickables.push(m); return m; };
      const zc = (ROOM_Z0 + ROOM_Z1) / 2, zl = ROOM_Z1 - ROOM_Z0;

      add(new THREE.PlaneGeometry(ROOM_HW * 2 - 0.2, zl - 0.2), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.32, 0.17), roughness: 1 }), 0, 0.014, zc, false).rotation.x = -Math.PI / 2;
      for (const x of [-ROOM_HW, ROOM_HW]) mark(add(new THREE.BoxGeometry(0.04, 2.6, zl), glass, x, 1.3, zc, false), "room");
      mark(add(new THREE.BoxGeometry(ROOM_HW * 2, 2.6, 0.04), glass, 0, 1.3, ROOM_Z0, false), "room");
      mark(add(new THREE.BoxGeometry(DOOR_DX - 0.8 + ROOM_HW, 2.6, 0.04), glass, (-ROOM_HW + DOOR_DX - 0.8) / 2, 1.3, ROOM_Z1, false), "room");
      mark(add(new THREE.BoxGeometry(ROOM_HW - DOOR_DX - 0.8, 2.6, 0.04), glass, (DOOR_DX + 0.8 + ROOM_HW) / 2, 1.3, ROOM_Z1, false), "room");
      for (const [x, z] of [[-ROOM_HW, ROOM_Z0], [ROOM_HW, ROOM_Z0], [-ROOM_HW, ROOM_Z1], [ROOM_HW, ROOM_Z1]]) add(new THREE.BoxGeometry(0.1, 2.65, 0.1), brass, x, 1.32, z);
      for (const dx of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.12, 2.4, 0.12), brass, DOOR_DX + dx, 1.2, ROOM_Z1);
      addObs(sx - ROOM_HW, zc, 0.06, zl / 2); addObs(sx + ROOM_HW, zc, 0.06, zl / 2); addObs(sx, ROOM_Z0, ROOM_HW, 0.06);
      addObs(sx + (-ROOM_HW + DOOR_DX - 0.8) / 2, ROOM_Z1, (DOOR_DX - 0.8 + ROOM_HW) / 2, 0.06); addObs(sx + (DOOR_DX + 0.8 + ROOM_HW) / 2, ROOM_Z1, (ROOM_HW - DOOR_DX - 0.8) / 2, 0.06);
      // 門（點它進出）
      const door = add(new THREE.BoxGeometry(1.6, 2.2, 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), DOOR_DX, 1.1, ROOM_Z1, false); mark(door, "door");
      add(new THREE.BoxGeometry(1.6, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 1.8 }), DOOR_DX, 0.02, ROOM_Z1, false);
      // 門前地面名牌
      const nameTex = mkTex(THREE, decalCanvas(1024, 300, (c, w, h) => {
        c.textAlign = "center"; c.fillStyle = "#ffe9b8"; let fs = 110; do { c.font = `800 ${fs}px Georgia, 'Noto Serif TC', serif`; fs -= 6; } while (c.measureText(p.name).width > w - 80 && fs > 40);
        c.fillText(p.name, w / 2, 130); c.fillStyle = "rgba(255,255,255,.75)"; c.font = "500 46px 'Noto Sans TC', sans-serif"; c.fillText("▲ 滾輪上滑 / Enter 進門", w / 2, 230);
      }), aniso);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.94), decalMat(nameTex, 0.95)); nm.rotation.x = -Math.PI / 2; nm.position.set(sx + DOOR_DX, 0.013, 0.7); scene.add(nm);
      // 室內：燈、盆栽
      add(new THREE.ConeGeometry(0.3, 0.22, 18, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 1.5, side: THREE.DoubleSide }), 0, 2.55, zc, false);
      const pl = new THREE.PointLight(0xffd9a0, 0.9, 9); pl.position.set(0, 2.3, zc + 0.4); g.add(pl);
      add(new THREE.CylinderGeometry(0.26, 0.19, 0.4, 16), M(0xff9b78, 0.7), 2.5, 0.2, -4.7);
      for (let k = 0; k < 8; k++) { const a = k * 2.4; add(new THREE.SphereGeometry(0.19, 12, 10), M(0x3f9a6a, 0.8), 2.5 + Math.cos(a) * 0.13, 0.66 + k * 0.07, -4.7 + Math.sin(a) * 0.13); }
      addObs(sx + 2.5, -4.7, 0.42, 0.42);

      // 房內白板（斜面立架，從上往下看也讀得到）
      const bw = 2.3, bh = bw * 900 / 1400, bd = 1.25, rise = bd * Math.tan(TILT), hF = 0.55, hB = hF + rise;
      const bg = new THREE.Group(); bg.position.set(-0.4, 0, -3.7); g.add(bg);
      const alu = M(0xb9bcc7, 0.35, 0.8);
      for (const x of [-1.0, 1.0]) {
        const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, hF, 10), alu); fl.position.set(x, hF / 2, -0.05); fl.castShadow = true; bg.add(fl);
        const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, hB, 10), alu); bl.position.set(x, hB / 2, -bd + 0.05); bl.castShadow = true; bg.add(bl);
      }
      const btex = mkTex(THREE, boardCanvas(p, i, H), aniso);
      const bmat = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.35, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0.1 });
      const bpg = new THREE.Group(); bpg.position.set(0, (hF + hB) / 2 + 0.02, -bd / 2); bpg.rotation.x = -(Math.PI / 2 - TILT); bg.add(bpg);
      const bframe = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.1, bh + 0.1, 0.05), alu); bframe.castShadow = true; bpg.add(bframe);
      const bart = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bmat); bart.position.z = 0.03; bpg.add(bart);
      const tray = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.9, 0.04, 0.08), alu); tray.position.set(0, hF - 0.02, 0.06); bg.add(tray);
      mark(bart, "board"); mark(bframe, "board"); boardMats[s] = bmat; boardTex[s] = btex;
      addObs(sx - 0.4, -3.7 - bd / 2, bw / 2 + 0.12, bd / 2 + 0.1);

      // 門外展台（掛畫）
      const px = sx + PL_DX, pg = new THREE.Group(); pg.position.set(px, 0, PL_Z); scene.add(pg);
      const prise = PL_D * Math.tan(TILT), phF = 0.62, phB = phF + prise;
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(PL_D, 0); shape.lineTo(PL_D, phB); shape.lineTo(0, phF); shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: PL_W, bevelEnabled: false }); geo.translate(0, 0, -PL_W / 2);
      const pbody = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.45, metalness: 0.2 }));
      pbody.rotation.y = Math.PI / 2; pbody.castShadow = true; pbody.receiveShadow = true; pg.add(pbody);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(PL_W + 0.04, 0.03, 0.03), brass); trim.position.set(0, phF, 0.02); pg.add(trim);
      const tex = mkTex(THREE, panelCanvas(p, i, H), aniso);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 });
      const pw = 2.2, ph = pw * 870 / 1320;
      const panelGrp = new THREE.Group(); panelGrp.position.set(0, (phF + phB) / 2 + 0.02, -PL_D / 2); panelGrp.rotation.x = -(Math.PI / 2 - TILT); pg.add(panelGrp);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.12, ph + 0.12, 0.05), brass); frame.castShadow = true; panelGrp.add(frame);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat); art.position.z = 0.03; panelGrp.add(art);
      for (const m of [art, frame, pbody]) { m.userData = { station: s, kind: "room" }; pickables.push(m); }
      panelMats[s] = mat; panelTex[s] = tex;
      addObs(px, PL_Z - PL_D / 2, PL_W / 2 + 0.1, PL_D / 2 + 0.1);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(sx, 0.02, 0.4); scene.add(pool); pools[s] = pool;
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true })); bang.position.set(sx + DOOR_DX, 2.9, ROOM_Z1); bang.scale.set(0.6, 0.6, 1); bang.renderOrder = 10; scene.add(bang); bangs[s] = bang;
    });
    // 隔著露台的盆景與長椅（寫實點綴）
    for (let x = FIRST_X - 3.75; x < WORLD_W - 2; x += SPACING) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6 }));
      bench.position.set(x, 0.45, DECK_HD - 1.3); bench.castShadow = true; scene.add(bench);
      for (const dx of [-0.75, 0.75]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.5, roughness: 0.4 })); lg.position.set(x + dx, 0.22, DECK_HD - 1.3); lg.castShadow = true; scene.add(lg); }
      addObs(x, DECK_HD - 1.3, 1.0, 0.35);
    }

    /* ----- 人物 ----- */
    const av = buildAvatar(THREE); scene.add(av.root);

    /* ----- 狀態 ----- */
    const sxOf = (s) => stationsX[s];
    const doorX = (s) => sxOf(s) + DOOR_DX;
    const anchor = (s) => (s === 0 ? { x: OFFICE_X, z: OFFICE_Z } : { x: sxOf(s) - 0.2, z: STAND_Z });
    const boardAnchor = (s) => ({ x: sxOf(s) - 0.4, z: -2.9 });
    const roomAt = (x, z) => { if (z > ROOM_Z1 + 0.15) return -1; for (let s = 1; s <= N; s++) if (Math.abs(x - sxOf(s)) < ROOM_HW - 0.25) return s; return -1; };
    const enterPts = (s) => [{ x: doorX(s), z: 0.1 }, { x: doorX(s), z: -2.4 }, boardAnchor(s)];
    const exitPts = (s) => [{ x: doorX(s), z: -2.3 }, { x: doorX(s), z: 0.4 }];

    const spawn = api.lastId === "__office" ? 0 : (api.lastId ? P.findIndex((p) => p.id === api.lastId) + 1 : -1);
    const pos = spawn >= 0 ? { ...anchor(spawn) } : { x: 6, z: 2.2 };
    let yaw = 0.0, elev = 70 * Math.PI / 180, dist = 14, facing = Math.PI;
    const view0 = { yaw, elev, dist };
    const camT = new THREE.Vector3(pos.x, 0.9, pos.z), bias = { x: 0, z: 0 };
    let keys = { l: 0, r: 0, u: 0, d: 0, q: 0, e: 0 }, run = false, touch = { l: 0, r: 0, u: 0, d: 0 }, rotHold = 0, auto = false;
    let route = [], afterFn = null, nearIdx = -1, speedNow = 0, inside = -1, zoomK = 0, lastWheel = 0, promptKey = "", boardS = -1;
    const tickHooks = [];

    const prompt = root.querySelector("#gPrompt"), dots = [...root.querySelectorAll("#gMap button")], ov = root.querySelector("#gBoardOv");
    const goRoute = (pts, fn) => { route = pts.slice(); afterFn = fn || null; };
    const cancelRoute = () => { route = []; afterFn = null; };

    /* ----- 白板總覽（點白板 / 走近按 Enter） ----- */
    const closeBoard = () => { if (ov.hidden) return false; ov.hidden = true; document.body.classList.remove("board-open"); return true; };
    const renderBoard = () => {
      const p = P[boardS - 1], i = boardS - 1;
      if (window.Journal) { ov.innerHTML = window.Journal.card(p, i, H); window.Journal.bind(ov, p, i, H, { close: closeBoard, rerender: renderBoard }); }
      else ov.innerHTML = `<div class="wb-card"><button class="wb-x" data-x>✕</button><h2>${H.esc(p.name)}</h2></div>`;
    };
    const openBoard = (s) => { boardS = s; renderBoard(); ov.hidden = false; document.body.classList.add("board-open"); };
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) closeBoard(); });
    const refreshBoardTexture = (s) => {
      const p = P[s - 1]; if (!p) return;
      if (boardTex[s]) { boardTex[s].image = boardCanvas(p, s - 1, H); boardTex[s].needsUpdate = true; }
      if (panelTex[s]) { panelTex[s].image = panelCanvas(p, s - 1, H); panelTex[s].needsUpdate = true; }
    };
    const onStore = () => { for (let s = 1; s <= N; s++) refreshBoardTexture(s); if (!ov.hidden && boardS > 0) renderBoard(); };
    window.addEventListener("store:change", onStore);

    /* ----- 進門 / 出門 / 前往 ----- */
    const toBoard = (s) => {
      const b = boardAnchor(s);
      if (inside === s && Math.hypot(pos.x - b.x, pos.z - b.z) < 0.7) return openBoard(s);
      goRoute(inside === s ? [b] : [...(inside >= 0 ? exitPts(inside) : []), ...enterPts(s)], () => openBoard(s));
    };
    const enterRoom = (s) => goRoute(inside === s ? [boardAnchor(s)] : [...(inside >= 0 ? exitPts(inside) : []), ...enterPts(s)]);
    const exitRoom = () => { if (inside < 0) return; const s = inside; goRoute([...exitPts(s), anchor(s)]); };
    const toStation = (s, thenOpen) => {
      const pre = inside >= 0 ? exitPts(inside) : [];
      if (s === 0) goRoute([...pre, anchor(0)], thenOpen ? () => H.office() : null);
      else goRoute([...pre, anchor(s)]);
    };
    const activate = () => {
      if (!ov.hidden) return;
      if (inside >= 0) return toBoard(inside);
      if (nearIdx === 0) return H.office();
      if (nearIdx > 0) enterRoom(nearIdx);
    };
    dots.forEach((d) => d.addEventListener("click", () => toStation(+d.dataset.s, false)));
    prompt.addEventListener("click", activate);

    /* ----- 輸入 ----- */
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const blocked = () => document.body.classList.contains("locked") || document.body.classList.contains("news-open") || document.body.classList.contains("board-open") || document.body.classList.contains("dir-typing");
    const onKey = (e) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || blocked()) return;
      const down = e.type === "keydown"; run = e.shiftKey;
      const set = (k) => { keys[k] = down ? 1 : 0; if (down) cancelRoute(); e.preventDefault(); };
      switch (e.code) {
        case "ArrowLeft": case "KeyA": set("l"); break;
        case "ArrowRight": case "KeyD": set("r"); break;
        case "ArrowUp": case "KeyW": set("u"); break;
        case "ArrowDown": case "KeyS": set("d"); break;
        case "KeyQ": keys.q = down ? 1 : 0; break;
        case "KeyE": keys.e = down ? 1 : 0; break;
        case "Enter": case "Space": if (down && !e.repeat) { e.preventDefault(); activate(); } break;
      }
    };
    const clearKeys = () => { keys = { l: 0, r: 0, u: 0, d: 0, q: 0, e: 0 }; run = false; touch = { l: 0, r: 0, u: 0, d: 0 }; rotHold = 0; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey); window.addEventListener("blur", clearKeys);

    // 滑鼠 / 觸控：拖曳轉 360°、滾輪（門口：上滑進門 / 下滑出門；其他：縮放）、點擊
    const ptrs = new Map(); let dragMoved = 0, pinch = 0;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pickHit = (ev) => {
      const r = cv.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(pickables, false)[0]; return hit ? hit.object.userData : null;
    };
    const autoBtn = root.querySelector("#gAuto");
    const stopAuto = () => { auto = false; autoBtn.setAttribute("aria-pressed", "false"); };
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragMoved = 0; stopAuto(); });
    cv.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) { cv.style.cursor = pickHit(e) ? "pointer" : "grab"; return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) dist = clamp(dist * (pinch / d), 8, 36); pinch = d; return; }
      yaw -= dx * 0.006; elev = clamp(elev + dy * 0.004, 28 * Math.PI / 180, 84 * Math.PI / 180); cv.style.cursor = "grabbing";
    });
    const up = (e) => {
      if (ptrs.has(e.pointerId) && ptrs.size === 1 && dragMoved < 7) {
        const u = pickHit(e);
        if (u) {
          if (u.kind === "office") toStation(0, true);
          else if (u.kind === "board") toBoard(u.station);
          else if (u.kind === "door") (inside === u.station ? exitRoom() : enterRoom(u.station));
          else if (u.kind === "room" && inside !== u.station) enterRoom(u.station);
        }
      }
      ptrs.delete(e.pointerId); pinch = 0; cv.style.cursor = "grab";
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const now = performance.now();
      const atDoor = inside >= 0 || nearIdx >= 0;
      if (atDoor && Math.abs(e.deltaY) > 2) {
        if (now - lastWheel > 650) {
          if (e.deltaY < 0) { lastWheel = now; activate(); return; }         // 上滑：進門 / 看白板 / 進辦公室
          if (e.deltaY > 0 && inside >= 0) { lastWheel = now; exitRoom(); return; } // 下滑：出門
        } else if (inside >= 0 || e.deltaY < 0) return;
      }
      dist = clamp(dist * Math.exp(e.deltaY * 0.0012), 8, 36);
    }, { passive: false });
    cv.style.cursor = "grab"; cv.style.touchAction = "none";

    const holdBtn = (el, on, off) => { el.addEventListener("pointerdown", (e) => { e.preventDefault(); on(); }); for (const t of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(t, off); };
    holdBtn(root.querySelector("#gRotL"), () => (rotHold = -1), () => (rotHold = 0));
    holdBtn(root.querySelector("#gRotR"), () => (rotHold = 1), () => (rotHold = 0));
    root.querySelectorAll("#gDpad button").forEach((b) => holdBtn(b, () => { touch[b.dataset.d] = 1; cancelRoute(); }, () => { touch[b.dataset.d] = 0; }));
    autoBtn.addEventListener("click", () => { auto = !auto; autoBtn.setAttribute("aria-pressed", String(auto)); });
    root.querySelector("#gReset").addEventListener("click", () => { yaw = view0.yaw; elev = view0.elev; dist = view0.dist; stopAuto(); });

    const refreshBangs = () => bangs.forEach((b, s) => { if (b) b.visible = (H.unread ? H.unread(s === 0 ? null : P[s - 1].id) : 0) > 0; });
    window.addEventListener("news:change", refreshBangs); refreshBangs();

    const layers = [...document.querySelectorAll("#painting .layer")];
    const resize = () => {
      const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
      renderer.setSize(w, h, false); cv.style.width = "100%"; cv.style.height = "100%";
      camera.aspect = w / h; camera.fov = w / h < 0.9 ? 46 : 36; camera.updateProjectionMatrix();
    };
    resize(); window.addEventListener("resize", resize);

    const ctx = { THREE, scene, camera, root, P, H, pos, stationsX, anchor, boardAnchor, enterPts, exitPts, doorX, roomAt, hooks: tickHooks, buildAvatar: (o) => buildAvatar(THREE, o), openBoard, getInside: () => inside, SPACING, DECK_HD };
    const toScreen = (v) => { const p = v.clone().project(camera); const r = cv.getBoundingClientRect(); return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top, behind: p.z > 1 }; };
    ctx.toScreen = toScreen;

    /* ----- 主迴圈 ----- */
    const fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
    let raf = 0, last = performance.now(), time = 0, qAcc = 0, qN = 0, quality = 2;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const rawDt = (now - last) / 1000; last = now;
      const dt = Math.min(0.25, rawDt); time += dt;
      // 自動調畫質：太卡就降解析度 / 陰影
      if (rawDt < 0.3 && !document.hidden) { qAcc += rawDt; qN++; }
      if (qAcc > 2.5) {
        const fps = qN / qAcc; qAcc = 0; qN = 0;
        if (fps < 24 && quality > 0) {
          quality--; const pr = [0.6, 1, Math.min(window.devicePixelRatio || 1, 2)][quality];
          renderer.setPixelRatio(pr); resize();
          if (quality === 0) { sun.castShadow = false; }
          else if (quality === 1) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
        }
      }

      const rot = (keys.e - keys.q) + rotHold;
      if (rot) { yaw += rot * 1.6 * dt; stopAuto(); }
      if (auto) yaw += 0.16 * dt;

      const ix = (keys.r | touch.r) - (keys.l | touch.l), iz = (keys.u | touch.u) - (keys.d | touch.d);
      let sp = 0, lmx = 0, lmz = 0;
      const steps = Math.max(1, Math.ceil(dt / 0.04)), sdt = dt / steps;
      for (let k = 0; k < steps; k++) {
        let mx = 0, mz = 0; sp = 0;
        if (ix || iz) {
          cancelRoute();
          fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); rgt.set(Math.cos(yaw), 0, -Math.sin(yaw));
          mx = rgt.x * ix + fwd.x * iz; mz = rgt.z * ix + fwd.z * iz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; sp = run ? RUN : WALK;
        } else if (route.length) {
          const t = route[0], dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
          if (d < 0.2) { route.shift(); if (!route.length) { const f = afterFn; afterFn = null; if (f) f(); } }
          else { mx = dx / d; mz = dz / d; sp = Math.min(WALK * 1.6, d * 3 + 1.2); }
        }
        if (!sp) continue;
        lmx = mx; lmz = mz;
        pos.x += mx * sp * sdt; pos.z += mz * sp * sdt;
        for (const o of obstacles) {
          const L = o.minX - 0.3, R = o.maxX + 0.3, T = o.minZ - 0.3, B = o.maxZ + 0.3;
          if (pos.x > L && pos.x < R && pos.z > T && pos.z < B) {
            const pl = pos.x - L, pr = R - pos.x, pt = pos.z - T, pb = B - pos.z, m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = L; else if (m === pr) pos.x = R; else if (m === pt) pos.z = T; else pos.z = B;
          }
        }
        pos.x = clamp(pos.x, 1.2, WORLD_W - 1.2); pos.z = clamp(pos.z, -4.8, DECK_HD - 0.9);
      }
      if (sp) facing += angDiff(facing, Math.atan2(lmx, lmz)) * Math.min(1, dt * 10);
      speedNow = lerp(speedNow, sp, Math.min(1, dt * 12));
      av.root.position.set(pos.x, 0, pos.z); av.root.rotation.y = facing; av.update(dt, speedNow, time);

      // 是否在房間裡 → 鏡頭拉近
      inside = roomAt(pos.x, pos.z);
      zoomK = lerp(zoomK, inside >= 0 ? 1 : 0, Math.min(1, dt * 3));
      const bx = inside >= 0 ? (sxOf(inside) - pos.x) * 0.4 : 0, bz = inside >= 0 ? (-3.2 - pos.z) * 0.4 : 0;
      bias.x = lerp(bias.x, bx, Math.min(1, dt * 3)); bias.z = lerp(bias.z, bz, Math.min(1, dt * 3));
      camT.x = lerp(camT.x, pos.x + bias.x, Math.min(1, dt * 5)); camT.z = lerp(camT.z, pos.z + bias.z, Math.min(1, dt * 5));
      const dd = dist * (camera.aspect < 0.9 ? 1.3 : 1) * (1 - 0.4 * zoomK), hd = Math.cos(elev) * dd, vd = Math.sin(elev) * dd;
      camera.position.set(camT.x + Math.sin(yaw) * hd, camT.y + vd, camT.z + Math.cos(yaw) * hd);
      camera.lookAt(camT);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      clouds.rotation.y += dt * 0.004; sky.rotation.y += dt * 0.0006;
      waveTex.offset.x += dt * 0.0016; waveTex.offset.y += dt * 0.0009; glTex.offset.y -= dt * 0.012;
      sun.position.set(camT.x + 10, 11, camT.z - 24); sun.target.position.set(camT.x, 0, camT.z);
      layers.forEach((l) => (l.style.transform = ""));

      // 靠近哪個站點
      let nn = -1;
      if (inside >= 0) nn = inside;
      else {
        let best = -1, bd = 1e9;
        stationsX.forEach((sx, s) => { const a = anchor(s), d = Math.hypot(pos.x - a.x, pos.z - a.z); if (d < bd) { bd = d; best = s; } });
        nn = bd < (best === 0 ? NEAR + 0.6 : NEAR) ? best : -1;
      }
      const pk = (inside >= 0 ? "in" : "out") + nn;
      if (pk !== promptKey) {
        promptKey = pk; nearIdx = inside >= 0 ? -1 : nn; dots.forEach((d, i) => d.classList.toggle("on", i === nn));
        if (nn >= 0) {
          prompt.innerHTML = inside >= 0
            ? `<kbd>Enter</kbd> 查看白板 · <b>${H.esc(P[nn - 1].name)}</b> <small>　滾輪下滑出門</small>`
            : nn === 0 ? `<kbd>Enter</kbd> 進入 <b>辦公室</b> · 儀表板總覽 <small>　滾輪上滑</small>`
              : `<kbd>Enter</kbd> 進入 <b>${H.esc(P[nn - 1].name)}</b> 房間 · ${P[nn - 1].progress ?? 0}% <small>　滾輪上滑</small>`;
          prompt.hidden = false;
        } else prompt.hidden = true;
      }
      for (let s = 1; s <= N; s++) {
        const on = s === nn, k = Math.min(1, dt * 6);
        panelMats[s].emissiveIntensity = lerp(panelMats[s].emissiveIntensity, on && inside < 0 ? 0.28 : 0.06, k);
        boardMats[s].emissiveIntensity = lerp(boardMats[s].emissiveIntensity, on && inside >= 0 ? 0.25 : 0.1, k);
        pools[s].material.opacity = lerp(pools[s].material.opacity, on ? 0.7 : 0.3, k);
      }
      bangs.forEach((b, s) => { if (b && b.visible) { const k = 1 + Math.sin(time * 5 + s) * 0.12; b.scale.set(0.62 * k, 0.62 * k, 1); b.position.y = (s === 0 ? 3.3 : 2.9) + Math.sin(time * 2.4 + s) * 0.08; } });
      for (const h of tickHooks) h(dt, time);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    if (window.Director) window.Director.mount(ctx);

    S = {
      root, cv, renderer, raf: () => cancelAnimationFrame(raf), onKey, clearKeys, resize, refreshBangs, onStore, scene, closeBoard, camera, sun, openBoard,
    };
    api.active = true; api.debug = S; document.body.classList.add("gl3d");
    return true;
  }

  function unmount() {
    if (!S) return;
    S.raf();
    window.removeEventListener("keydown", S.onKey); window.removeEventListener("keyup", S.onKey);
    window.removeEventListener("blur", S.clearKeys); window.removeEventListener("resize", S.resize);
    window.removeEventListener("news:change", S.refreshBangs); window.removeEventListener("store:change", S.onStore);
    if (window.Director) window.Director.unmount(); document.body.classList.remove("board-open", "dir-typing");
    S.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); } });
    S.renderer.dispose(); S.renderer.forceContextLoss && S.renderer.forceContextLoss(); S.cv.remove();
    S = null; api.active = false; document.body.classList.remove("gl3d");
  }
})();
