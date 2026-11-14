/* ============================================================
   3D 藝廊（Three.js）：黃昏海邊的玻璃露台藝廊。
   · 預設約 70° 俯視；拖曳 / 觸控 / Q E 可 360° 環繞，滾輪或雙指縮放
   · WASD / 方向鍵走路（依視角方向）、Shift 跑、Enter 進入作品
   · 四周是 360° 日落全景（天空球 + 海面），雲與海面持續流動
   沒有 WebGL 或 Three.js 載入失敗時，app.js 會退回 2D 藝廊。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Gallery3D = { active: false, lastId: null, mount, unmount, supported, closeOverlay: () => !!(S && S.closeBoard && S.closeBoard()), exitRoom: () => !!(S && S.exitRoom && S.exitRoom()) });
  let S = null;

  /* ---------- 版面常數（單位：公尺） ---------- */
  const ENTRY = 26;                                     // 美術館門面的位置（x）；之前是戶外：家 + 花園
  const HOUSE = { x0: 0.5, x1: 12.0, z0: -8.0, z1: 0.4 };    // 兩層樓：一樓 David、二樓 Aeris
  const POOL = { x0: -9.6, x1: -3.2, z0: -3.0, z1: 3.0, surface: -0.28 };   // 船尾泳池（可下水）
  const UY = 3.3, STAIR = { x0: 6.0, x1: 11.0, z0: -7.8, z1: -6.3 };   // UY：二樓地板高度；STAIR：樓梯（東端一樓入口，往西爬到二樓）
  const SPACING = 7.5, OFFICE_X = ENTRY + 13, FIRST_X = ENTRY + 13 + SPACING;
  const ROW_DZ = 1.7;                                   // 走道半寬 = 1.6 + 1.7 = 3.3（南北兩排房間夾著中央走道）
  const DECK_HD = 8.6;                                  // 露台半寬（z）
  const ROOM_HW = 3.2, ROOM_Z0 = -6.2, ROOM_Z1 = -1.6, DOOR_DX = 1.2; // 房間：半寬、後牆、前牆、門中心偏移
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
    for (let i = 0; i < 60; i++) {
      const x = rnd() * W, y = Hh * (0.26 + rnd() * 0.2), rx = 80 + rnd() * 240, ry = 6 + rnd() * 16;
      for (const dx of [0, W, -W]) {
        g.save(); g.translate(x + dx, y); g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry * 2.2);
        gr.addColorStop(0, "rgba(255,255,255,.75)"); gr.addColorStop(1, "rgba(255,255,255,0)");
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
    const T = 1024, c = mkCanvas(T, T), g = c.getContext("2d"), rnd = mulberry(2), pw = 44;
    g.fillStyle = "#8a7a66"; g.fillRect(0, 0, T, T);
    for (let y = 0; y < T; y += pw) {
      let x = -((rnd() * 400) | 0);
      while (x < T) {
        const len = 300 + rnd() * 340, l = 49 + rnd() * 8;
        g.fillStyle = `hsl(${33 + rnd() * 7} ${30 + rnd() * 10}% ${l}%)`; g.fillRect(x + 1, y + 1, len - 2, pw - 2);
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = `rgba(90,60,30,${0.03 + rnd() * 0.05})`; g.lineWidth = 1; g.beginPath();
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
  /* ---------- 後牆外側的招牌：從走道哪一側看都知道這間是什麼 ---------- */
  function signCanvas(p, i, H) {
    const W = 1380, Hh = 318, c = mkCanvas(W, Hh), g = c.getContext("2d"), h = H.hue(i), stt = H.st(p), pr = p.progress ?? 0;
    g.fillStyle = "#1d1a2b"; g.fillRect(0, 0, W, Hh); g.fillStyle = `hsl(${h} 75% 55%)`; g.fillRect(0, 0, 36, Hh);
    g.strokeStyle = "#c9a35c"; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, Hh - 20);
    let fs = 124; g.fillStyle = "#f6f1ff"; do { g.font = `800 ${fs}px Georgia, 'Noto Serif TC', serif`; fs -= 6; } while (g.measureText(p.name).width > W - 500 && fs > 50);
    g.textAlign = "left"; g.fillText(p.name, 80, 150);
    g.fillStyle = "rgba(246,241,255,.78)"; g.font = "500 44px 'Noto Sans TC', -apple-system, sans-serif"; g.fillText(`${p.zh || ""}　·　${p.category || ""}`, 80, 212);
    const lu = (p.updates || [])[0]; g.fillStyle = "rgba(255,226,170,.9)"; g.font = "500 34px 'Noto Sans TC', sans-serif";
    let t = lu ? `最新：${lu.title}` : "尚無進度紀錄"; while (g.measureText(t).width > W - 520 && t.length > 4) t = t.slice(0, -2) + "…"; g.fillText(t, 80, 262);
    g.textAlign = "right"; g.fillStyle = stt.color; g.beginPath(); g.arc(W - 330, 78, 14, 0, 7); g.fill();
    g.fillStyle = "#f6f1ff"; g.font = "600 40px 'Noto Sans TC', sans-serif"; g.fillText(stt.label, W - 60, 92);
    g.font = "800 128px Georgia, serif"; g.fillStyle = `hsl(${h} 80% 68%)`; g.fillText(pr + "%", W - 60, 214);
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(W - 420, 244, 360, 14); g.fillStyle = `hsl(${h} 80% 62%)`; g.fillRect(W - 420, 244, 360 * pr / 100, 14);
    return c;
  }

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
    { // 作品底部的資訊條：最新進度、目標、里程碑（門前就能看到裡面的細節）
      g.fillStyle = "rgba(10,8,24,.66)"; g.fillRect(0, artH - 104, W, 104); g.textAlign = "left";
      const fit2 = (t, mw) => { t = String(t || ""); while (g.measureText(t).width > mw && t.length > 3) t = t.slice(0, -2) + "…"; return t; };
      const lu = (p.updates || [])[0], ms = p.milestones || [], done = ms.filter((m) => m.done).length;
      g.fillStyle = "#fff"; g.font = "600 34px 'Noto Sans TC', -apple-system, sans-serif"; g.fillText(fit2(`${p.wbStatus ? p.wbStatus + "　" : ""}${p.wbNote || (lu ? lu.title : "尚無狀態")}`, W - 80), 40, artH - 58);
      g.fillStyle = "#ffd9a0"; g.font = "500 30px 'Noto Sans TC', sans-serif"; g.fillText(fit2(`${p.goal ? "目標：" + p.goal : "尚未設定目標"}${p.next ? "　→　Next：" + p.next : ""}`, W - 80), 40, artH - 18);
    }
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

  function seatPose(A, a) {            // 坐姿：大腿水平、小腿下垂、坐高約 0.46m
    A.legL.hip.rotation.x = lerp(A.legL.hip.rotation.x, -1.45, a); A.legR.hip.rotation.x = lerp(A.legR.hip.rotation.x, -1.45, a);
    A.legL.knee.rotation.x = lerp(A.legL.knee.rotation.x, 1.5, a); A.legR.knee.rotation.x = lerp(A.legR.knee.rotation.x, 1.5, a);
    A.legL.hip.rotation.z = lerp(A.legL.hip.rotation.z, -0.1, a); A.legR.hip.rotation.z = lerp(A.legR.hip.rotation.z, 0.1, a);
    A.body.position.y = lerp(A.body.position.y, -0.47, a);
    A.torso.rotation.x = lerp(A.torso.rotation.x, -0.05, a);
  }

  // 游泳姿勢（自由式）：身體前傾趴在水面、雙臂輪流划、雙腿打水；k = 0..1 混合量
  function swimPose(A, k, t, moving) {
    if (k < 0.01) { if (A.root.rotation.order !== "XYZ") { A.root.rotation.order = "XYZ"; A.root.rotation.x = 0; } return; }
    A.root.rotation.order = "YXZ"; A.root.rotation.x = 1.3 * k;
    const w = t * (moving ? 5.5 : 1.8);
    A.armR.sh.rotation.x = lerp(A.armR.sh.rotation.x, -w, k); A.armL.sh.rotation.x = lerp(A.armL.sh.rotation.x, -(w + Math.PI), k);
    A.armR.el.rotation.x = -0.35 * k; A.armL.el.rotation.x = -0.35 * k; A.armR.sh.rotation.z = -0.08 * k; A.armL.sh.rotation.z = 0.08 * k;
    const kick = Math.sin(w * 2.2) * (moving ? 0.38 : 0.12);
    A.legL.hip.rotation.x = lerp(A.legL.hip.rotation.x, kick, k); A.legR.hip.rotation.x = lerp(A.legR.hip.rotation.x, -kick, k); A.legL.knee.rotation.x = 0.12 * k; A.legR.knee.rotation.x = 0.12 * k;
    A.head.rotation.x = -1.05 * k; A.torso.rotation.x = 0;
  }

  /* ---------- 人物（程序生成，約 1.8m；漸縮的四肢、圓潤的關節、有輪廓的軀幹） ---------- */
  function buildAvatar(THREE, o = {}) {
    const M = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 0.5 });
    const skin = M(o.skin || 0xe0ac8a, 0.55), hair = M(o.hair || 0x1c1613, 0.5), cloth = M(o.blazer || 0x1f2a44, 0.85), shirt = M(o.shirt || 0xecebe6, 0.7),
      pants = M(o.pants || 0x2d2f36, 0.82), shoe = M(o.shoe || 0x241812, 0.22, 0.15), tieM = M(o.tie || 0x7a2230, 0.6);
    cloth.side = THREE.DoubleSide;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const sph = (r, ws = 20, hs = 14) => new THREE.SphereGeometry(r, ws, hs);
    const tube = (rt, rb, h) => new THREE.CylinderGeometry(rt, rb, h, 18, 1);
    const HIP = 0.93, PI = Math.PI;

    // 骨盆 + 軀幹（Lathe：腰窄、肩寬、胸有厚度）
    mesh(sph(0.16, 24, 16), pants, body, 0, HIP + 0.03, 0).scale.set(1.12, 0.78, 0.82);
    const torso = new THREE.Group(); torso.position.set(0, HIP + 0.05, 0); body.add(torso);
    const prof = [[0.001, 0], [0.150, 0.02], [0.158, 0.10], [0.172, 0.22], [0.200, 0.36], [0.214, 0.46], [0.186, 0.53], [0.105, 0.575], [0.058, 0.60], [0.001, 0.605]].map(([x, y]) => new THREE.Vector2(x, y));
    mesh(new THREE.LatheGeometry(prof, 28), cloth, torso).scale.set(1, 1, 0.64);
    const vee = mesh(new THREE.CircleGeometry(0.075, 3), shirt, torso, 0, 0.45, 0.134); vee.rotation.z = -PI / 2; vee.castShadow = false;
    if (o.tie) { mesh(new THREE.BoxGeometry(0.032, 0.24, 0.012), tieM, torso, 0, 0.35, 0.139); mesh(new THREE.BoxGeometry(0.04, 0.04, 0.016), tieM, torso, 0, 0.47, 0.139); }
    mesh(new THREE.TorusGeometry(0.064, 0.014, 8, 20), shirt, torso, 0, 0.6, 0).rotation.x = PI / 2;
    mesh(tube(0.052, 0.058, 0.1), skin, torso, 0, 0.645, 0);

    // 頭
    const head = new THREE.Group(); head.position.set(0, 0.70, 0); torso.add(head);
    mesh(sph(0.108, 26, 20), skin, head, 0, 0.085, 0).scale.set(0.9, 1.1, 1.0);
    mesh(sph(0.07), skin, head, 0, 0.0, 0.022).scale.set(1, 0.82, 0.95);
    mesh(new THREE.SphereGeometry(0.117, 26, 18, 0, PI * 2, 0, PI * 0.55), hair, head, 0, 0.098, -0.008).scale.set(0.95, 1.1, 1.05);
    mesh(new THREE.SphereGeometry(0.113, 20, 14, 0, PI * 2, PI * 0.45, PI * 0.3), hair, head, 0, 0.085, -0.028).scale.set(0.95, 1.1, 1.05);
    const white = M(0xf4f1ea, 0.4), iris = M(0x1d1410, 0.3);
    for (const sx of [-1, 1]) {
      mesh(sph(0.015, 12, 8), white, head, sx * 0.037, 0.092, 0.096).scale.set(1, 0.75, 0.5);
      mesh(sph(0.0085, 10, 8), iris, head, sx * 0.037, 0.092, 0.1);
      mesh(new THREE.BoxGeometry(0.04, 0.007, 0.01), hair, head, sx * 0.039, 0.115, 0.1).rotation.z = sx * -0.12;
      mesh(sph(0.02, 10, 8), skin, head, sx * 0.099, 0.075, 0).scale.set(0.5, 1, 0.8);
    }
    mesh(new THREE.ConeGeometry(0.014, 0.04, 8), skin, head, 0, 0.062, 0.108).rotation.x = PI / 2;
    mesh(new THREE.BoxGeometry(0.04, 0.006, 0.006), M(0x8a4a4a, 0.5), head, 0, 0.026, 0.1);

    // 手臂：肩 → 上臂 → 手肘 → 前臂 → 袖口 → 手
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.225, 0.50, 0); torso.add(sh);
      mesh(sph(0.064), cloth, sh);
      mesh(tube(0.056, 0.047, 0.3), cloth, sh, 0, -0.15, 0);
      mesh(sph(0.048), cloth, sh, 0, -0.3, 0);
      const el = new THREE.Group(); el.position.set(0, -0.3, 0); sh.add(el);
      mesh(tube(0.046, 0.037, 0.26), cloth, el, 0, -0.13, 0);
      mesh(tube(0.04, 0.04, 0.03), shirt, el, 0, -0.262, 0);
      const wr = new THREE.Group(); wr.position.set(0, -0.3, 0); el.add(wr);          // 手腕關節：球拍掛在這裡
      mesh(sph(0.039, 14, 10), skin, wr, 0, -0.015, 0.004).scale.set(0.85, 1.35, 0.6);
      mesh(sph(0.015, 8, 6), skin, wr, side * -0.03, 0.01, 0.012);
      return { sh, el, wr };
    };
    const armL = arm(-1), armR = arm(1);

    // 腿：髖 → 大腿 → 膝 → 小腿 → 皮鞋
    const leg = (side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.092, HIP, 0); body.add(hip);
      mesh(sph(0.092), pants, hip);
      mesh(tube(0.088, 0.062, 0.43), pants, hip, 0, -0.215, 0);
      mesh(sph(0.063), pants, hip, 0, -0.43, 0);
      const knee = new THREE.Group(); knee.position.set(0, -0.43, 0); hip.add(knee);
      mesh(tube(0.06, 0.043, 0.40), pants, knee, 0, -0.2, 0);
      mesh(tube(0.047, 0.047, 0.03), pants, knee, 0, -0.395, 0);
      mesh(sph(0.05, 18, 12), shoe, knee, 0, -0.455, 0.055).scale.set(1, 0.85, 2.7);
      mesh(new THREE.BoxGeometry(0.09, 0.012, 0.2), M(0x120d0a, 0.7), knee, 0, -0.495, 0.045);
      return { hip, knee };
    };
    const legL = leg(-1), legR = leg(1);

    let phase = 0, mv = 0;
    function update(dt, speed, t) {
      const target = speed > 0.05 ? 1 : 0; mv = lerp(mv, target, Math.min(1, dt * 9));
      phase += dt * (1.7 * speed);
      const run = clamp((speed - 3.5) / 3.5, 0, 1), amp = lerp(0.5, 0.74, run), s = Math.sin(phase), c = Math.cos(phase);
      legL.hip.rotation.x = s * amp * mv; legR.hip.rotation.x = -s * amp * mv;
      legL.knee.rotation.x = Math.max(0, -c) * amp * 1.4 * mv; legR.knee.rotation.x = Math.max(0, c) * amp * 1.4 * mv;
      armL.sh.rotation.x = -s * amp * 0.75 * mv; armR.sh.rotation.x = s * amp * 0.75 * mv;
      armL.sh.rotation.z = 0.06; armR.sh.rotation.z = -0.06;
      armL.el.rotation.x = -(0.15 + 0.55 * run) * mv - 0.1; armR.el.rotation.x = -(0.15 + 0.55 * run) * mv - 0.1;
      torso.rotation.y = s * 0.12 * mv; torso.rotation.x = 0.03 * mv + 0.16 * run * mv;
      head.rotation.y = -s * 0.06 * mv + Math.sin(t * 0.6) * 0.06 * (1 - mv);
      body.position.y = Math.abs(c) * (0.03 + 0.03 * run) * mv + Math.sin(t * 1.7) * 0.004 * (1 - mv);
    }
    return { root, update, head, armR, armL, legL, legR, torso, body };
  }

  /* ============================================================
     mount / unmount
     ============================================================ */
  function mount(root, P, H) {
    unmount();
    if (!root || !supported()) return false;
    const THREE = window.THREE, N = P.length;
    const isPB = (p) => /pickle/i.test(p.id + p.name);
    let slotN = 0; const slots = P.map((p) => (isPB(p) ? -1 : slotN++));
    const sPB = P.findIndex(isPB) + 1;                       // 匹克球「房間」= 室內球場（0 = 沒有）
    const HX = 11.8, HXE = 17.5, HZ = 5.0;                         // 場館：西半長 / 東半長（含休息區）/ 半寬
    const NC = Math.max(1, Math.ceil((slotN + 1) / 2));            // 欄數：辦公室在北排第 0 欄，其餘專案先填北排再填南排
    const COURT_CX = OFFICE_X + (NC - 1) * SPACING + 21.5, WORLD_W = COURT_CX + HXE + 3.7;
    const rowOf = []; rowOf[0] = { sx: OFFICE_X, zoff: -ROW_DZ, rot: 0 };
    P.forEach((p, i) => { if (slots[i] < 0) return; const j = slots[i], north = j < NC - 1, c = north ? j + 1 : j - (NC - 1); rowOf[i + 1] = { sx: OFFICE_X + c * SPACING, zoff: north ? -ROW_DZ : ROW_DZ, rot: north ? 0 : 1 }; });
    const L2W = (s, lx, lz) => { const r = rowOf[s]; return r.rot ? { x: r.sx - lx, z: r.zoff - lz } : { x: r.sx + lx, z: r.zoff + lz }; };   // 房間座標 → 世界座標（南排旋轉 180°）
    const stationsX = [OFFICE_X, ...P.map((p, i) => (slots[i] < 0 ? COURT_CX : rowOf[i + 1].sx))];

    root.innerHTML = `
      <div class="g-hud">
        <div class="g-info" id="gInfo" hidden></div>
        <button class="g-prompt" id="gPrompt" type="button" hidden></button>
        <div class="g-map" id="gMap" aria-label="快速跳轉"><button type="button" class="office" data-s="0" title="辦公室" aria-label="辦公室"></button>${P.map((p, i) => `<button type="button" data-s="${i + 1}" title="${H.esc(p.name)}" aria-label="${H.esc(p.name)}"></button>`).join("")}</div>
        <p class="g-keys">按住左鍵：往指標方向走　單擊：走過去　右鍵拖曳：轉視角　<kbd>WASD</kbd> 走路　<kbd>Space</kbd> 跳　雙擊方向鍵：跑　<kbd>Enter</kbd> 互動　<kbd>Esc</kbd> 退出</p>
      </div>
      <div class="g-camctl">
        <button type="button" id="gRotL" aria-label="向左轉視角">⟲</button>
        <button type="button" id="gRotR" aria-label="向右轉視角">⟳</button>
        <button type="button" id="gAuto" aria-pressed="false">360° 環繞</button>
        <button type="button" class="g-jump" id="gJump" aria-label="跳">⤒</button>
        <button type="button" id="gReset">重置視角</button>
      </div>
      <div class="g-board-ov" id="gBoardOv" hidden></div>
      <div class="g-dpad" id="gDpad"><button data-d="u" aria-label="往前">▲</button><button data-d="l" aria-label="往左">◀</button><button data-d="d" aria-label="往後">▼</button><button data-d="r" aria-label="往右">▶</button></div>`;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = renderer.domElement; cv.className = "g-canvas"; root.prepend(cv);
    const aniso = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xbfe4ff, 0.0017);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2200);

    /* ----- 360° 全景天空 + 雲 + 海 ----- */
    const skyU = { zen: { value: new THREE.Color(0x2f86e4) }, hor: { value: new THREE.Color(0xbfe4ff) }, gnd: { value: new THREE.Color(0x203a5a) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, night: { value: 0 }, sunI: { value: 1 } };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: "varying vec3 vD; void main(){ vD = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vD; uniform vec3 zen, hor, gnd, sunDir, moonDir; uniform float night, sunI;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main(){
          vec3 d = normalize(vD); float h = d.y;
          vec3 col = h > 0.0 ? mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.42)) : mix(hor, gnd, clamp(-h * 5.0, 0.0, 1.0));
          float sd = max(dot(d, normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.72, 0.42) * pow(sd, 6.0) * 0.30 * sunI + vec3(1.0, 0.9, 0.7) * pow(sd, 60.0) * 0.5 * sunI;
          col = mix(col, vec3(1.0, 0.97, 0.86), smoothstep(0.9990, 0.9996, sd) * clamp(sunI * 2.0, 0.0, 1.0));
          float md = max(dot(d, normalize(moonDir)), 0.0);
          col += vec3(0.5, 0.6, 0.9) * pow(md, 40.0) * 0.18 * night;
          col = mix(col, vec3(0.93, 0.95, 1.0), smoothstep(0.9993, 0.9997, md) * night);
          vec3 sp = floor(d * 170.0); float st = hash(sp);
          col += vec3(1.0) * step(0.9968, st) * night * smoothstep(0.02, 0.25, h) * (0.5 + 0.5 * hash(sp + 7.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 32), skyMat);
    sky.renderOrder = -3; scene.add(sky);
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat));
    let envRT = null;
    const updateEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(envScene, 0, 0.1, 100); if (envRT) envRT.dispose(); envRT = rt; scene.environment = rt.texture; pm.dispose(); } catch (_) {} };
    updateEnv();
    const cloudTex = mkTex(THREE, cloudCanvas(), aniso); cloudTex.wrapS = THREE.RepeatWrapping; cloudTex.repeat.x = -1; cloudTex.offset.x = 1;
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(980, 48, 32), new THREE.MeshBasicMaterial({ map: cloudTex, side: THREE.BackSide, transparent: true, fog: false, depthWrite: false, color: 0xffffff }));
    clouds.renderOrder = -2; scene.add(clouds);

    const waveTex = mkTex(THREE, waveCanvas(), aniso); waveTex.wrapS = waveTex.wrapT = THREE.RepeatWrapping; waveTex.repeat.set(90, 90);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ map: waveTex, color: 0x3a86b4, roughness: 0.32, metalness: 0.55 }));
    const seaMat = sea.material;
    sea.rotation.x = -Math.PI / 2; sea.position.set(WORLD_W / 2, -14, 0); sea.receiveShadow = true; scene.add(sea);
    const glTex = mkTex(THREE, glitterCanvas(), aniso, false); glTex.wrapS = glTex.wrapT = THREE.RepeatWrapping;
    const glitter = new THREE.Mesh(new THREE.PlaneGeometry(130, 700), new THREE.MeshBasicMaterial({ map: glTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
    glitter.rotation.x = -Math.PI / 2; glitter.position.set(WORLD_W / 2, -13.98, -390); scene.add(glitter);

    /* ----- 光 ----- */
    const hemi = new THREE.HemisphereLight(0xe4e8ff, 0x7a6a62, 0.6); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe6cc, 1.3);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);

    /* ----- 露台 ----- */
    const floorTex = mkTex(THREE, floorCanvas(), aniso); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(WORLD_W / 8, (DECK_HD * 2) / 8);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, DECK_HD * 2), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.05 }));
    deck.rotation.x = -Math.PI / 2; deck.position.set(WORLD_W / 2, 0, 0); deck.receiveShadow = true; scene.add(deck);
    const base = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W + 0.6, 1.3, DECK_HD * 2 + 0.6), new THREE.MeshStandardMaterial({ color: 0x2b2a31, roughness: 0.8 }));
    base.position.set(WORLD_W / 2, -0.66, 0); base.visible = false; scene.add(base);   // 郵輪船體（ship.js）取代這個底座
    const brass = new THREE.MeshStandardMaterial({ color: 0x7d6446, metalness: 0.85, roughness: 0.38 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8b8ff, transparent: true, opacity: 0.13, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false });
    for (const z of [-DECK_HD + 0.05, DECK_HD - 0.05]) {
      const gl = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 1.05, 0.03), glass); gl.position.set(WORLD_W / 2, 0.55, z); scene.add(gl);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 0.05, 0.08), brass); rail.position.set(WORLD_W / 2, 1.08, z); scene.add(rail);
      for (let x = 0; x <= WORLD_W; x += 3) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.1, 0.07), brass); po.position.set(x, 0.55, z); scene.add(po); }
    }
    { const gl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, DECK_HD * 2), glass); gl.position.set(WORLD_W - 0.05, 0.55, 0); scene.add(gl);
      for (const [z0, z1] of [[-DECK_HD, 1.4], [6.6, DECK_HD]]) { const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.05, z1 - z0), glass); g2.position.set(0.05, 0.55, (z0 + z1) / 2); scene.add(g2); }   // 西側欄杆：南邊留一個缺口通往船尾甲板
      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 1.4 + DECK_HD), brass); rl.position.set(0.05, 1.08, (-DECK_HD + 1.4) / 2); scene.add(rl); const rl2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, DECK_HD - 6.6), brass); rl2.position.set(0.05, 1.08, (6.6 + DECK_HD) / 2); scene.add(rl2); }
    // 路燈
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 0.1 });   // 路燈燈泡（亮度由 lights.js 依天色控制）
    const lampPts = [];                                                                                                // 所有路燈位置，給 lights.js 做光暈與近燈照明
    for (let x = ENTRY + 4; x < WORLD_W; x += SPACING) {
      if (x > COURT_CX - HX - 1 && x < COURT_CX + HXE + 1) continue;
      for (const z of [-DECK_HD + 0.35, DECK_HD - 0.35]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.5, metalness: 0.5 }));
        pole.position.set(x, 1.3, z); scene.add(pole);
        const lm = lampMat.clone(); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), lm); bulb.position.set(x, 2.7, z); scene.add(bulb); lampPts.push({ x, y: 2.7, z, mat: lm });
      }
    }

    /* ----- 地面標示（起點標題） ----- */
    const introTex = mkTex(THREE, decalCanvas(2048, 640, (g, w, h) => {
      g.textBaseline = "alphabetic"; g.fillStyle = "rgba(60,48,40,.6)"; g.font = "600 34px -apple-system, 'Noto Sans TC', sans-serif";
      if ("letterSpacing" in g) g.letterSpacing = "10px"; g.fillText("DAVID'S SIDE BUSINESS", 20, 70); if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.fillStyle = "#2c241d"; g.font = "300 150px -apple-system, 'Helvetica Neue', sans-serif"; g.fillText("A place where", 14, 230);
      g.font = "700 150px -apple-system, 'Helvetica Neue', sans-serif"; g.fillText("dreams come true", 14, 390);
      g.fillStyle = "rgba(44,36,29,.85)"; g.font = "400 50px 'Noto Sans TC', -apple-system, sans-serif"; if ("letterSpacing" in g) g.letterSpacing = "14px";
      { const zh = window.SITE?.taglineZh || "", parts = zh.split('"'); if (parts.length === 3) { g.fillText(parts[0], 20, 480); const w = g.measureText(parts[0]).width; g.fillStyle = "#b4562c"; g.font = "800 64px Georgia, serif"; if ("letterSpacing" in g) g.letterSpacing = "3px"; g.fillText('"' + parts[1] + '"', 20 + w, 482); } else g.fillText(zh, 20, 480); } if ("letterSpacing" in g) g.letterSpacing = "0px";
      g.fillStyle = "#b4562c"; g.font = "500 44px 'Noto Sans TC', sans-serif"; g.fillText("走向前方，逛逛我的夢想  →", 20, 575);
    }), aniso);
    const decalMat = (map, op = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -2 });
    const intro = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.0), decalMat(introTex));
    intro.rotation.x = -Math.PI / 2; intro.position.set(ENTRY + 7.0, 0.012, -0.9); scene.add(intro);

    const poolTex = mkTex(THREE, poolCanvas(), aniso);
    const bangTex = mkTex(THREE, bangCanvas(), aniso);
    const obstacles = [];  // {minX,maxX,minZ,maxZ}
    const addObs = (cx, cz, hw, hd, lv, h) => obstacles.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd, lv, h });   // h：障礙物高度（≤0.85 的可以用 Space 跳過去）
    addObs(0.05, (-DECK_HD + 1.4) / 2, 0.05, (1.4 + DECK_HD) / 2); addObs(0.05, (6.6 + DECK_HD) / 2, 0.05, (DECK_HD - 6.6) / 2);   // 西側欄杆（缺口 z 1.4–6.6 通往船尾）
    const pickables = [], pools = [], bangs = [], panelMats = [], boardMats = [], boardTex = [], panelTex = [], roomSignTex = [];

    /* ----- 匹克球場（4 人雙打，球會真的飛來飛去） ----- */
    let courtUpdate = null, loungeUpdate = null; const chairSpots = [], roofs = [], shells = [];
    {
      const CX = COURT_CX, CZ = 0, CL = 13.41, CW = 6.1, PADL = 20.4, PADW = 9.7, K = 2.13;
      const ppm = 90, cw = Math.round(PADL * ppm), ch = Math.round(PADW * ppm), cvs = mkCanvas(cw, ch), g = cvs.getContext("2d"), rnd = mulberry(77);
      const X = (m) => (m + PADL / 2) * ppm, Z = (m) => (m + PADW / 2) * ppm;
      g.fillStyle = "#2f6b5a"; g.fillRect(0, 0, cw, ch);
      g.fillStyle = "#2c6fa3"; g.fillRect(X(-CL / 2), Z(-CW / 2), CL * ppm, CW * ppm);
      g.fillStyle = "#4aa08f"; g.fillRect(X(-K), Z(-CW / 2), 2 * K * ppm, CW * ppm);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? "255,255,255" : "0,0,0"},${rnd() * 0.05})`; g.fillRect(rnd() * cw, rnd() * ch, 2, 2); }
      g.strokeStyle = "#f4f4ee"; g.lineWidth = 5; g.lineCap = "square";
      g.strokeRect(X(-CL / 2), Z(-CW / 2), CL * ppm, CW * ppm);
      for (const m of [-K, K]) { g.beginPath(); g.moveTo(X(m), Z(-CW / 2)); g.lineTo(X(m), Z(CW / 2)); g.stroke(); }
      for (const [a, b] of [[-CL / 2, -K], [K, CL / 2]]) { g.beginPath(); g.moveTo(X(a), Z(0)); g.lineTo(X(b), Z(0)); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,.85)"; g.font = "700 34px -apple-system, 'Noto Sans TC', sans-serif"; g.textAlign = "center";
      if ("letterSpacing" in g) g.letterSpacing = "10px"; g.fillText("PICKLEBALL · 匹克球場", X(0), Z(CW / 2 + 0.42)); if ("letterSpacing" in g) g.letterSpacing = "0px";
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(PADL, PADW), new THREE.MeshStandardMaterial({ map: mkTex(THREE, cvs, aniso), roughness: 0.82, envMapIntensity: 0.3 }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(CX, 0.016, CZ); pad.receiveShadow = true; scene.add(pad);
      const pbIdx = P.findIndex((p) => /pickle/i.test(p.id + p.name));
      if (pbIdx >= 0) { pad.userData = { station: pbIdx + 1, kind: "room" }; pickables.push(pad); }

      // 球網
      const netTex = new THREE.CanvasTexture(decalCanvas(512, 128, (c, w, h) => {
        c.strokeStyle = "rgba(20,20,26,.8)"; c.lineWidth = 1.4;
        for (let x = 0; x <= w; x += 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
        for (let y = 0; y <= h; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      }));
      const net = new THREE.Mesh(new THREE.PlaneGeometry(CW + 0.7, 0.86), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      net.rotation.y = Math.PI / 2; net.position.set(CX, 0.5, CZ); scene.add(net);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, CW + 0.7), new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.6 })); tape.position.set(CX, 0.93, CZ); tape.castShadow = true; scene.add(tape);
      for (const z of [-(CW / 2 + 0.35), CW / 2 + 0.35]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a31, metalness: 0.6, roughness: 0.4 })); po.position.set(CX, 0.5, z); po.castShadow = true; scene.add(po); }
      addObs(CX, CZ, 0.1, CW / 2 + 0.5);
      addObs(CX, CZ, CL / 2 + 0.1, CW / 2 + 0.1);   // 球場本身不能走進去，沿邊走

      // ===== 室內球場：四面圍起來（下半白牆、上半玻璃），西側留門，球不會跑出去 =====
      const DZ = 1.2;
      const hallWall = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.92, envMapIntensity: 0.4 });
      const wb = (w, h, d, x, y, z, mat, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
      const HL = HX + HXE, HC = CX + (HXE - HX) / 2;
      wb(HL, 1.3, 0.14, HC, 0.65, HZ, hallWall); wb(HL, 2.3, 0.05, HC, 2.45, HZ, glass, false); addObs(HC, HZ, HL / 2, 0.1);   // 南牆：矮牆 + 玻璃
      wb(HL, 2.8, 0.14, HC, 1.4, -HZ, hallWall); wb(HL, 0.8, 0.05, HC, 3.2, -HZ, glass, false); addObs(HC, -HZ, HL / 2, 0.1);  // 北牆：實牆（掛計分牌）
      wb(0.14, 3.6, 2 * HZ, CX + HXE, 1.8, 0, hallWall); addObs(CX + HXE, 0, 0.1, HZ);
      for (const sg3 of [-1, 1]) {        // 場館兩側多出來的露台：圍起來做成花園（不能進入）
        const zc3 = sg3 * (HZ + (DECK_HD - HZ) / 2); addObs(HC, zc3, HL / 2, (DECK_HD - HZ) / 2 + 0.05);
        const gp3 = new THREE.Mesh(new THREE.PlaneGeometry(HL + 0.3, DECK_HD - HZ - 0.15), new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 1 })); gp3.rotation.x = -Math.PI / 2; gp3.position.set(HC, 0.03, zc3); gp3.receiveShadow = true; scene.add(gp3);
        for (let bx3 = HC - HL / 2 + 1.5; bx3 < HC + HL / 2 - 1; bx3 += 3.4) { const bs = new THREE.Mesh(new THREE.SphereGeometry(0.55 + ((bx3 * 7) % 3) * 0.12, 12, 9), new THREE.MeshStandardMaterial({ color: 0x2f6a34, roughness: 0.95 })); bs.position.set(bx3, 0.5, zc3 + sg3 * 0.3); bs.castShadow = true; scene.add(bs); }
      }
      if (sPB > 0) {
        const pp = P[sPB - 1], bw = 4.2, bh = bw * 900 / 1400;
        const alu2 = new THREE.MeshStandardMaterial({ color: 0xb9bcc7, roughness: 0.35, metalness: 0.8 });
        const btex = mkTex(THREE, boardCanvas(pp, sPB - 1, H), aniso);
        const bmat = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.35, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0.1 });
        const wg = new THREE.Group(); wg.position.set(CX + HXE - 0.1, 1.95, 0); wg.rotation.y = -Math.PI / 2; scene.add(wg);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.14, bh + 0.14, 0.06), alu2); fr.castShadow = true; wg.add(fr);
        const art = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bmat); art.position.z = 0.035; wg.add(art);
        const tray = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.9, 0.05, 0.12), alu2); tray.position.set(0, -bh / 2 - 0.1, 0.06); wg.add(tray);
        for (const dx of [-1.2, 1.2]) { const lt = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.1), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffd9a0, emissiveIntensity: 1.8 })); lt.position.set(dx, bh / 2 + 0.28, 0.14); wg.add(lt); }
        for (const m of [fr, art]) { m.userData = { station: sPB, kind: "board" }; pickables.push(m); }
        boardMats[sPB] = bmat; boardTex[sPB] = btex; panelMats[sPB] = { emissiveIntensity: 0 }; pools[sPB] = { material: { opacity: 0 } };
        const dm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 2 * DZ), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); dm.position.set(CX - HX, 1.5, 0); dm.userData = { station: sPB, kind: "door" }; pickables.push(dm); scene.add(dm);
        const bg2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true })); bg2.position.set(CX - HX, 3.0, 0); bg2.scale.set(0.6, 0.6, 1); bg2.renderOrder = 10; scene.add(bg2); bangs[sPB] = bg2;
      }
      for (const sg of [-1, 1]) {
        const len = HZ - DZ, zc = sg * (DZ + len / 2);
        wb(0.14, 1.3, len, CX - HX, 0.65, zc, hallWall); wb(0.05, 2.3, len, CX - HX, 2.45, zc, glass, false); addObs(CX - HX, zc, 0.1, len / 2);
        wb(0.14, 3.6, 0.14, CX - HX, 1.8, sg * DZ, brass);
      }
      for (const [x, z] of [[CX - HX, -HZ], [CX - HX, HZ], [CX + HXE, -HZ], [CX + HXE, HZ]]) wb(0.16, 3.65, 0.16, x, 1.82, z, brass);
      const hl = new THREE.PointLight(0xfff2dc, 0.9, 20); hl.position.set(CX, 3.4, 0); scene.add(hl);
      // 門口地面標示
      const signTex = mkTex(THREE, decalCanvas(1024, 300, (c, w, h) => {
        c.textAlign = "center"; c.fillStyle = "#3a2e24"; c.font = "800 110px Georgia, serif"; if ("letterSpacing" in c) c.letterSpacing = "8px"; c.fillText("PICKLEBALL", w / 2, 125);
        c.fillStyle = "rgba(58,46,36,.75)"; c.font = "500 50px 'Noto Sans TC', sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "8px"; c.fillText("室內匹克球場 →", w / 2, 220);
      }), aniso);
      const sg2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.29), decalMat(signTex, 0.95)); sg2.rotation.x = -Math.PI / 2; sg2.position.set(CX - HX - 3.2, 0.013, 0); scene.add(sg2);

      // ===== 休息區（球場最後方）：木條圍欄隔開、留出入口。分三個功能區：
      //   ① 置物區（北牆：木條牆 + 置物櫃 + 長凳 + 球拍架 + 球籃）  ② 補水區（東牆：吧檯 = 飲水機/杯子/毛巾籃 + 販賣機）  ③ 座位聊天區（椅子、圓桌、地毯、電風扇）
      const LSH = 1.8, LX = CX + LSH, FX = LX + 8.5, LX0 = FX + 0.25, LX1 = CX + HXE - 0.25, FZ0 = -HZ + 0.15, FZ1 = 3.1;
      const bubCache = {};
      const bubbleTex = (txt) => {
        if (bubCache[txt]) return bubCache[txt];
        const c = mkCanvas(320, 140), g = c.getContext("2d");
        g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(40, 6); g.lineTo(280, 6); g.quadraticCurveTo(312, 6, 312, 38); g.lineTo(312, 78); g.quadraticCurveTo(312, 110, 280, 110); g.lineTo(190, 110); g.lineTo(160, 134); g.lineTo(140, 110); g.lineTo(40, 110); g.quadraticCurveTo(8, 110, 8, 78); g.lineTo(8, 38); g.quadraticCurveTo(8, 6, 40, 6); g.fill();
        g.strokeStyle = "#cfc8b6"; g.lineWidth = 4; g.stroke();
        g.fillStyle = "#1f1a33"; g.textAlign = "center"; let fs = 46; do { g.font = `700 ${fs}px 'Noto Sans TC', -apple-system, sans-serif`; fs -= 3; } while (g.measureText(txt).width > 270 && fs > 22);
        g.fillText(txt, 160, 78); const t = mkTex(THREE, c, aniso); bubCache[txt] = t; return t;
      };
      const mkBubble = () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex("…"), transparent: true, depthTest: false })); sp.renderOrder = 12; sp.visible = false; scene.add(sp); return sp; };
      const showBubble = (sp, av, txt, on) => {
        if (!on) { sp.visible = false; return; }
        const tx = bubbleTex(txt); if (sp.material.map !== tx) { sp.material.map = tx; sp.material.needsUpdate = true; }
        sp.visible = true; sp.position.set(av.root.position.x, 2.4, av.root.position.z); const d = camera.position.distanceTo(sp.position), w = d * 0.085; sp.scale.set(w, w * 0.4375, 1);
      };
      const CHAT = ["今天發球好穩", "哈哈，我腳快斷了", "再來一局？", "剛那球超刁", "先喝口水", "你反手進步了", "太陽好大", "待會吃什麼？", "手感不錯", "換邊後要小心"];
      let fanBlades = null;
      {
        const MM = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
        const mk = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
        const wood2 = MM(0x9a6b3c, 0.6), dark = MM(0x2a2d36, 0.5, 0.5), steel = MM(0xc9ced8, 0.35, 0.8), PI2 = Math.PI, ZN = -HZ + 0.12;
        const glowM = (c, k) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: k });

        // ---------- 地面：柔和的灰綠色地毯 + 座位區的大地毯 ----------
        mk(new THREE.PlaneGeometry(LX1 - LX0, 2 * HZ - 0.5), MM(0x5f7d6b, 1), (LX0 + LX1) / 2, 0.016, 0, false).rotation.x = -PI2 / 2;
        const rugC = mkCanvas(256, 320), rg2 = rugC.getContext("2d"); rg2.fillStyle = "#6b2230"; rg2.fillRect(0, 0, 256, 320); rg2.strokeStyle = "#e8c98a"; rg2.lineWidth = 5; rg2.strokeRect(10, 10, 236, 300); rg2.lineWidth = 2; rg2.strokeRect(24, 24, 208, 272);
        for (let k = 0; k < 6; k++) { rg2.strokeStyle = "rgba(232,201,138,.35)"; rg2.beginPath(); rg2.moveTo(34, 50 + k * 44); rg2.lineTo(222, 50 + k * 44); rg2.stroke(); }
        mk(new THREE.PlaneGeometry(3.6, 4.6), new THREE.MeshStandardMaterial({ map: mkTex(THREE, rugC, aniso), roughness: 1 }), LX + 11.6, 0.02, -1.4, false).rotation.x = -PI2 / 2;

        // ---------- 木條圍欄（x = FX）+ 串燈 + 出入口 ----------
        const slatC = mkCanvas(512, 128), sc2 = slatC.getContext("2d");
        for (let x = 0; x < 512; x += 22) { const gr = sc2.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, "#a8794a"); gr.addColorStop(1, "#8a5f36"); sc2.fillStyle = gr; sc2.fillRect(x + 3, 0, 16, 128); }
        const slatT = new THREE.CanvasTexture(slatC); slatT.encoding = THREE.sRGBEncoding; slatT.anisotropy = aniso;
        const flen = FZ1 - FZ0, fzc = (FZ0 + FZ1) / 2;
        const slats = new THREE.Mesh(new THREE.PlaneGeometry(flen, 0.85), new THREE.MeshStandardMaterial({ map: slatT, transparent: true, alphaTest: 0.5, roughness: 0.7, side: THREE.DoubleSide })); slats.position.set(FX, 0.58, fzc); slats.rotation.y = PI2 / 2; slats.castShadow = true; scene.add(slats);
        mk(new THREE.BoxGeometry(0.07, 0.07, flen), wood2, FX, 1.12, fzc); mk(new THREE.BoxGeometry(0.07, 0.07, flen), wood2, FX, 0.12, fzc);
        for (let z = FZ0; z <= FZ1 + 0.01; z += flen / 7) mk(new THREE.BoxGeometry(0.1, 1.2, 0.1), wood2, FX, 0.6, z);
        for (let k = 0; k <= 16; k++) { const z = FZ0 + (flen * k) / 16, sag = Math.sin((k / 16) * PI2 * 4) * 0.06; mk(new THREE.SphereGeometry(0.042, 8, 6), glowM(0xffd38a, 2.2), FX, 1.32 + sag, z, false); }   // 串燈
        addObs(FX, fzc, 0.08, flen / 2);
        for (const z of [FZ1, 4.9]) mk(new THREE.BoxGeometry(0.14, 2.3, 0.14), wood2, FX, 1.15, z);
        mk(new THREE.BoxGeometry(0.16, 0.14, 1.94), wood2, FX, 2.25, 4.0); addObs(FX, 4.9, 0.12, 0.12);
        const restT = mkTex(THREE, decalCanvas(512, 160, (c, w, h) => { c.fillStyle = "#2a2230"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a35c"; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.textAlign = "center"; c.fillStyle = "#e8c98a"; c.font = "800 62px Georgia, 'Noto Serif TC', serif"; c.fillText("休息區", w / 2, 88); c.font = "600 30px sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "8px"; c.fillText("REST AREA", w / 2, 132); }), aniso);
        for (const sgn of [-1, 1]) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), new THREE.MeshStandardMaterial({ map: restT, roughness: 0.6 })); sp.position.set(FX + sgn * 0.1, 1.88, 4.0); sp.rotation.y = sgn > 0 ? PI2 / 2 : -PI2 / 2; scene.add(sp); }
        const restD = mkTex(THREE, decalCanvas(768, 230, (c, w, h) => { c.textAlign = "center"; c.fillStyle = "rgba(255,233,184,.92)"; c.font = "800 100px 'Noto Sans TC', sans-serif"; c.fillText("休息區", w / 2, 110); c.font = "600 44px sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "10px"; c.fillText("REST AREA", w / 2, 180); }), aniso);
        const restDm = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.9), decalMat(restD, 0.9)); restDm.rotation.x = -PI2 / 2; restDm.position.set(LX + 10.6, 0.024, 3.5); scene.add(restDm);

        // ---------- ① 置物區（北牆）：木條牆 + 霓虹字 + 置物櫃 + 長凳 + 球拍架 + 球籃 + 時鐘 ----------
        const wallSlatC = mkCanvas(512, 256), ws = wallSlatC.getContext("2d"); ws.fillStyle = "#3a2a1c"; ws.fillRect(0, 0, 512, 256);
        for (let x = 0; x < 512; x += 24) { const gr = ws.createLinearGradient(x, 0, x + 20, 0); gr.addColorStop(0, "#b98450"); gr.addColorStop(1, "#8e5f34"); ws.fillStyle = gr; ws.fillRect(x + 2, 0, 20, 256); }
        const wallSlat = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.5), new THREE.MeshStandardMaterial({ map: mkTex(THREE, wallSlatC, aniso), roughness: 0.75 })); wallSlat.position.set(LX + 12.4, 1.3, -HZ + 0.09); scene.add(wallSlat);
        const neonT = mkTex(THREE, decalCanvas(1024, 160, (c, w, h) => { c.textAlign = "center"; c.fillStyle = "#ffb28a"; c.shadowColor = "#ff7a4a"; c.shadowBlur = 26; c.font = "800 84px 'Helvetica Neue', Arial, sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "12px"; c.fillText("REST · REFUEL · REPLAY", w / 2, 108); }), aniso);
        const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), new THREE.MeshBasicMaterial({ map: neonT, transparent: true, toneMapped: false, depthWrite: false })); neon.position.set(LX + 11.7, 2.35, -HZ + 0.1); scene.add(neon);
        // 置物櫃：6 格，每格一個顏色，櫃頂放運動包
        const lockCols = [0xe0463c, 0xf2a53a, 0x3fa36b, 0x2f7fc8, 0x7a5ad0, 0xd05a9a];
        mk(new THREE.BoxGeometry(2.6, 1.95, 0.5), MM(0x3a3f4a, 0.5, 0.4), LX + 10.7, 0.975, -4.7);
        lockCols.forEach((c, k) => { const dx = LX + 9.6 + k * 0.43; mk(new THREE.BoxGeometry(0.4, 1.85, 0.04), MM(c, 0.45, 0.3), dx, 0.98, -4.43, false); mk(new THREE.BoxGeometry(0.03, 0.12, 0.03), steel, dx + 0.13, 1.0, -4.4, false); mk(new THREE.BoxGeometry(0.28, 0.02, 0.02), dark, dx, 1.6, -4.405, false); });
        [[10.2, 0x1d2a44, 0xff5a4a], [11.4, 0x2a2d36, 0x1fa39a]].forEach(([dx, c1, c2]) => { const g2 = new THREE.Group(); g2.position.set(LX + dx, 2.18, -4.7); const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 6, 12), MM(c1, 0.8)); bd.rotation.z = PI2 / 2; bd.castShadow = true; g2.add(bd); g2.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.27), MM(c2, 0.7))); scene.add(g2); });
        addObs(LX + 10.7, -4.7, 1.35, 0.3);
        // 球籃
        mk(new THREE.CylinderGeometry(0.23, 0.18, 0.4, 16, 1, true), MM(0xf28a3a, 0.6), LX + 12.3, 0.2, -4.62); mk(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 16), MM(0xf28a3a, 0.6), LX + 12.3, 0.01, -4.62);
        for (let k = 0; k < 9; k++) { const a = k * 2.4, r2 = 0.09 + (k % 3) * 0.03; mk(new THREE.SphereGeometry(0.05, 10, 8), MM(0xd8ee3a, 0.6), LX + 12.3 + Math.cos(a) * r2, 0.28 + (k % 3) * 0.04, -4.62 + Math.sin(a) * r2, false); }
        addObs(LX + 12.3, -4.62, 0.3, 0.3);
        // 長凳（椅墊、球鞋）+ 球拍架
        mk(new THREE.BoxGeometry(2.1, 0.08, 0.5), wood2, LX + 13.7, 0.46, -4.6); for (const dx of [-0.9, 0.9]) mk(new THREE.BoxGeometry(0.08, 0.46, 0.44), dark, LX + 13.7 + dx, 0.23, -4.6);
        [0xff5a4a, 0x1fa39a, 0xf2d23a].forEach((c, i) => mk(new THREE.BoxGeometry(0.62, 0.07, 0.42), MM(c, 0.9), LX + 13.05 + i * 0.65, 0.54, -4.6, false));
        for (const dx of [-0.25, 0.25]) for (const dz of [0, 0.34]) mk(new THREE.BoxGeometry(0.1, 0.07, 0.26), MM(0xf4f4ee, 0.7), LX + 13.4 + dx * 1.2 + dz * 0.2, 0.06, -4.2 + dz * 0.1, false);
        addObs(LX + 13.7, -4.6, 1.15, 0.3);
        mk(new THREE.BoxGeometry(1.7, 0.7, 0.05), wood2, LX + 13.7, 1.55, -HZ + 0.1, false);
        [0xff5a4a, 0x2a2a31, 0x3a7be0, 0x1fa39a].forEach((c, i) => { const px = LX + 13.1 + i * 0.4; mk(new THREE.BoxGeometry(0.17, 0.23, 0.02), MM(c, 0.5), px, 1.58, -HZ + 0.15, false); mk(new THREE.BoxGeometry(0.035, 0.13, 0.025), dark, px, 1.4, -HZ + 0.15, false); });
        { const cl = new THREE.Group(); cl.position.set(LX + 14.9, 2.05, -HZ + 0.12); const face = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 28), MM(0xf6f1ff, 0.4)); face.rotation.x = PI2 / 2; cl.add(face);
          const hand1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), dark); hand1.position.set(0, 0.08, 0.03); const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02), dark); hand2.position.set(0.05, 0, 0.03); hand2.rotation.z = -1.1; cl.add(hand1, hand2); scene.add(cl); }

        // ---------- ② 補水區（東牆）：吧檯 + 飲水機 + 杯子 + 毛巾籃 + 水果 + 洗手液；販賣機；急救箱 ----------
        const CXE = LX + 15.2;
        mk(new THREE.BoxGeometry(0.62, 0.9, 2.5), wood2, CXE, 0.45, -3.6); mk(new THREE.BoxGeometry(0.7, 0.05, 2.58), MM(0xf1ede4, 0.4), CXE, 0.925, -3.6);
        mk(new THREE.BoxGeometry(0.4, 0.9, 0.4), MM(0xf4f4ee, 0.5), CXE, 1.4, -4.4); mk(new THREE.CylinderGeometry(0.17, 0.17, 0.46, 16), new THREE.MeshStandardMaterial({ color: 0x6ec6ff, roughness: 0.2, transparent: true, opacity: 0.75 }), CXE, 2.08, -4.4);
        mk(new THREE.BoxGeometry(0.08, 0.05, 0.1), MM(0x2f6fb0, 0.4), CXE - 0.2, 1.55, -4.4, false);
        for (let k = 0; k < 3; k++) mk(new THREE.CylinderGeometry(0.045, 0.034, 0.1, 10), MM(0xf4f4ee, 0.5), CXE - 0.1, 0.99 + k * 0.0, -3.85 + k * 0.1, false);          // 紙杯
        mk(new THREE.CylinderGeometry(0.2, 0.17, 0.26, 16, 1, true), MM(0xb98450, 0.9), CXE - 0.05, 1.07, -3.2); for (let k = 0; k < 4; k++) mk(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10), MM(k % 2 ? 0xffffff : 0x9fd8d0, 0.95), CXE - 0.1 + (k % 2) * 0.1, 1.2, -3.25 + Math.floor(k / 2) * 0.1, false).rotation.z = PI2 / 2;   // 毛巾籃
        mk(new THREE.CylinderGeometry(0.17, 0.12, 0.1, 14), MM(0xf1ede4, 0.5), CXE - 0.05, 1.0, -2.65); for (let k = 0; k < 4; k++) mk(new THREE.SphereGeometry(0.05, 8, 6), MM([0xf28a3a, 0xf2d23a, 0xd8ee3a, 0xe0463c][k], 0.6), CXE - 0.05 + (k % 2) * 0.07 - 0.03, 1.1, -2.65 + (k > 1 ? 0.07 : -0.05), false);   // 水果
        mk(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), MM(0x6ec6ff, 0.3), CXE + 0.15, 1.04, -2.5, false);                                                    // 洗手液
        addObs(CXE, -3.6, 0.4, 1.3);
        // 販賣機（東牆南側）
        mk(new THREE.BoxGeometry(0.8, 1.9, 0.75), MM(0xc23a3a, 0.4, 0.3), CXE, 0.95, 3.55);
        { const pn = mk(new THREE.PlaneGeometry(0.6, 1.2), glowM(0x9fd8ff, 0.7), CXE - 0.39, 1.15, 3.55, false); pn.rotation.y = -PI2 / 2;
          for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const it = mk(new THREE.BoxGeometry(0.02, 0.16, 0.12), MM([0xe0463c, 0x2f9a5a, 0xf2d23a, 0x2f7fc8][(r + k) % 4], 0.5), CXE - 0.4, 1.5 - r * 0.28, 3.55 - 0.2 + k * 0.2, false); } }
        addObs(CXE, 3.55, 0.45, 0.45);
        // 急救箱
        mk(new THREE.BoxGeometry(0.34, 0.26, 0.08), MM(0xf4f4ee, 0.5), LX + 15.5, 1.5, -HZ + 0.12, false); mk(new THREE.BoxGeometry(0.16, 0.04, 0.02), MM(0xd92a47, 0.5), LX + 15.5, 1.5, -HZ + 0.17, false); mk(new THREE.BoxGeometry(0.04, 0.16, 0.02), MM(0xd92a47, 0.5), LX + 15.5, 1.5, -HZ + 0.17, false);

        // ---------- ③ 座位聊天區：折疊椅（面向球場、披毛巾）+ 圓桌 + 冰桶桌 + 電風扇 + 盆栽 ----------
        const seatM = MM(0xcfd3dc, 0.6), towelCols = [0xffffff, 0x1fa39a, 0xf2d23a, 0xf28a3a, 0xff6b8a, 0x6ec6ff];
        [-3.4, -2.5, -1.6, -0.7, 0.2, 1.1].forEach((z, i) => {
          const x = LX + 10.2, fa = -PI2 / 2, cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = fa; scene.add(cg);
          const mc = (geo, mat, lx, ly, lz, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(lx, ly, lz); m.castShadow = cast; m.receiveShadow = true; cg.add(m); return m; };
          mc(new THREE.BoxGeometry(0.46, 0.04, 0.44), seatM, 0, 0.46, 0); mc(new THREE.BoxGeometry(0.46, 0.44, 0.03), seatM, 0, 0.7, -0.21);
          for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) mc(new THREE.BoxGeometry(0.03, 0.46, 0.03), dark, lx, 0.23, lz);
          const tc = MM(towelCols[i % towelCols.length], 0.95);
          mc(new THREE.BoxGeometry(0.4, 0.035, 0.12), tc, 0, 0.935, -0.2); mc(new THREE.BoxGeometry(0.38, 0.3, 0.014), tc, 0, 0.78, -0.17, false);
          chairSpots.push({ x, z, face: fa, front: { x: x + Math.sin(fa) * 0.75, z: z + Math.cos(fa) * 0.75 } });
          addObs(x, z, 0.3, 0.3);
        });
        // 冰桶桌（座位區後側）
        mk(new THREE.BoxGeometry(1.3, 0.05, 0.85), wood2, LX + 12.4, 0.75, -1.6); for (const [dx, dz] of [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]]) mk(new THREE.BoxGeometry(0.05, 0.75, 0.05), dark, LX + 12.4 + dx, 0.375, -1.6 + dz);
        mk(new THREE.BoxGeometry(0.58, 0.34, 0.36), MM(0x2f6fb0, 0.5), LX + 12.1, 0.945, -1.6); mk(new THREE.BoxGeometry(0.6, 0.06, 0.38), MM(0xf4f4ee, 0.5), LX + 12.1, 1.145, -1.6);
        for (let k = 0; k < 6; k++) mk(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10), MM([0xe0463c, 0xc9ced8, 0x2f9a5a][k % 3], 0.3, 0.6), LX + 12.6 + (k % 3) * 0.1, 0.835, -1.8 + Math.floor(k / 3) * 0.14, false);
        addObs(LX + 12.4, -1.6, 0.7, 0.48);
        // 電風扇（落地式，葉片會轉）
        { const fg = new THREE.Group(); fg.position.set(LX + 9.3, 0, 2.2); scene.add(fg);
          const fm = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; fg.add(m); return m; };
          fm(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), dark, 0.02); fm(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), steel, 0.57);
          const head = new THREE.Group(); head.position.set(0.1, 1.15, 0); fg.add(head);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.014, 6, 24), steel); ring.rotation.y = PI2 / 2; head.add(ring);
          fanBlades = new THREE.Group(); head.add(fanBlades);
          for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.06), MM(0xcfe8ff, 0.4)); b.position.y = 0.1; const pv = new THREE.Group(); pv.rotation.x = k * 2.094; pv.add(b); fanBlades.add(pv); }
          addObs(LX + 9.3, 2.2, 0.28, 0.28); }
        // 盆栽
        for (const dx of [10.6, 11.9, 13.2]) { mk(new THREE.BoxGeometry(1.0, 0.36, 0.3), MM(0x6a4a2e, 0.9), LX + dx, 0.18, 4.78, false); for (let k = 0; k < 4; k++) mk(new THREE.SphereGeometry(0.17, 10, 8), MM(0x3f9a6a, 0.8), LX + dx - 0.36 + k * 0.24, 0.5, 4.78, false); addObs(LX + dx, 4.78, 0.5, 0.15); }
        for (const [px, pz] of [[LX + 15.1, 1.7], [LX + 15.1, -1.2]]) { mk(new THREE.CylinderGeometry(0.26, 0.19, 0.42, 14), MM(0xff9b78, 0.7), px, 0.21, pz); for (let k = 0; k < 11; k++) { const a = k * 2.4; mk(new THREE.SphereGeometry(0.22, 10, 8), MM(0x3f9a6a, 0.8), px + Math.cos(a) * 0.14, 0.7 + k * 0.1, pz + Math.sin(a) * 0.14); } addObs(px, pz, 0.4, 0.4); }
        // 地上的水瓶
        const bottleM2 = new THREE.MeshStandardMaterial({ color: 0x6ec6ff, roughness: 0.2, transparent: true, opacity: 0.82 }), capM2 = MM(0xf4f4ee, 0.5);
        [[9.7, -3.9, 0], [9.9, -2.0, 1], [9.75, 0.7, 0], [11.0, 1.0, 1], [11.2, -3.2, 0], [12.9, -0.6, 0]].forEach(([dx, dz, lie]) => {
          const g2 = new THREE.Group(); g2.position.set(LX + dx, lie ? 0.035 : 0.11, dz); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.22, 12), bottleM2); b.castShadow = true;
          const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10), capM2); cp.position.y = 0.125; g2.add(b, cp); if (lie) { g2.rotation.z = PI2 / 2; g2.rotation.y = dx; } scene.add(g2);
        });
        const hl2 = new THREE.PointLight(0xffd9a0, 0.9, 16); hl2.position.set(LX + 12, 3.2, 0); scene.add(hl2);

        // ---------- 聊天角：圓桌 + 兩張對坐的椅子 ----------
        const buildChair2 = (x, z, fa, col) => {
          const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = fa; scene.add(cg);
          const mc2 = (geo, mat, lx, ly, lz, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(lx, ly, lz); m.castShadow = cast; m.receiveShadow = true; cg.add(m); return m; };
          mc2(new THREE.BoxGeometry(0.46, 0.04, 0.44), MM(col, 0.6), 0, 0.46, 0); mc2(new THREE.BoxGeometry(0.46, 0.44, 0.03), MM(col, 0.6), 0, 0.7, -0.21);
          for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) mc2(new THREE.BoxGeometry(0.03, 0.46, 0.03), dark, lx, 0.23, lz);
          addObs(x, z, 0.3, 0.3);
        };
        const chatX = LX + 11.6, chatZ = 2.4;
        buildChair2(chatX, chatZ, PI2 / 2, 0xe8c98a); buildChair2(chatX + 1.4, chatZ, -PI2 / 2, 0xe8c98a);
        mk(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 20), wood2, chatX + 0.7, 0.72, chatZ); mk(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 10), dark, chatX + 0.7, 0.36, chatZ); mk(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14), dark, chatX + 0.7, 0.015, chatZ, false);
        for (const dz of [-0.15, 0.18]) mk(new THREE.CylinderGeometry(0.04, 0.032, 0.09, 10), MM(0xf4f4ee, 0.5), chatX + 0.7 + (dz > 0 ? 0.12 : -0.12), 0.79, chatZ + dz, false);
        addObs(chatX + 0.7, chatZ, 0.5, 0.5);

        // ---------- 休息區的人：聊天 x2、擦汗 x1、喝水 x1 ----------
        const mkP = (o) => { const a = buildAvatar(THREE, o); scene.add(a.root); return a; };
        const towelM2 = MM(0xffffff, 0.95), cupM2 = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.25, transparent: true, opacity: 0.9 });
        const A1 = { av: mkP({ blazer: 0xd95f5f, pants: 0x2a2d3a, hair: 0x1c1613, skin: 0xe0ac8a, shirt: 0xffe9e0 }), x: chatX, z: chatZ, face: PI2 / 2, bub: mkBubble() };
        const B1 = { av: mkP({ blazer: 0x3b7bd9, pants: 0xdad8d0, hair: 0x7a5a30, skin: 0xd9a07c, shirt: 0xe8f0ff }), x: chatX + 1.4, z: chatZ, face: -PI2 / 2, bub: mkBubble() };
        const W1 = { av: mkP({ blazer: 0x2fa36b, pants: 0x2a2d3a, hair: 0x2a2018, skin: 0xe8b999, shirt: 0xffffff }), x: chairSpots[4].x, z: chairSpots[4].z, face: chairSpots[4].face };
        const towelW = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.18), towelM2); towelW.position.set(0, -0.05, 0.03); W1.av.armR.wr.add(towelW);
        const D1 = { av: mkP({ blazer: 0xf2d23a, pants: 0x22304a, hair: 0x1c1613, skin: 0xc58a68, shirt: 0xfff3c0 }), x: CXE - 0.78, z: -4.4, face: PI2 / 2 };
        const cupD = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 10), cupM2); cupD.position.set(0, -0.06, 0.04); D1.av.armR.wr.add(cupD);
        const ease3 = (u) => u * u * (3 - 2 * u);
        loungeUpdate = (dt, t) => {
          if (fanBlades) fanBlades.rotation.x += dt * 22;
          const SEQ = [[0, 0, 2.4], [-1, 0, 0.5], [1, 1, 2.4], [-1, 0, 0.5], [0, 2, 2.0], [-1, 0, 0.4], [1, 3, 2.2], [-1, 0, 0.6], [0, 4, 2.2], [1, 5, 2.0], [-1, 0, 0.8]];
          const total = SEQ.reduce((a, q) => a + q[2], 0); let tt = t % total, cur = SEQ[SEQ.length - 1];
          for (const q of SEQ) { if (tt < q[2]) { cur = q; break; } tt -= q[2]; }
          const who = cur[0], phrase = CHAT[(cur[1] + Math.floor(t / total) * 3) % CHAT.length];
          [A1, B1].forEach((c, k) => {
            const A = c.av; A.update(dt, 0, t + k * 1.7); A.root.position.set(c.x, 0, c.z); A.root.rotation.y = c.face; seatPose(A, 1);
            const speaking = who === k;
            A.head.rotation.y = 0.0; A.head.rotation.x = speaking ? 0.08 * Math.sin(t * 5) : 0.05 * Math.sin(t * 1.9 + k);
            if (speaking) { A.armR.sh.rotation.x = -0.9 + 0.35 * Math.sin(t * 4.2); A.armR.el.rotation.x = -1.1 + 0.25 * Math.sin(t * 4.2 + 1); A.armR.sh.rotation.z = -0.35; A.armL.sh.rotation.x = -0.7; }
            else { A.armR.sh.rotation.x = -0.7; A.armR.el.rotation.x = -1.1; A.armL.sh.rotation.x = -0.7; A.armL.el.rotation.x = -1.1; }
            showBubble(c.bub, A, phrase, speaking);
          });
          { const A = W1.av; A.update(dt, 0, t + 3); A.root.position.set(W1.x, 0, W1.z); A.root.rotation.y = W1.face; seatPose(A, 1);
            const u = (t % 6.0);
            if (u < 1.8) { const k = ease3(Math.min(1, u / 0.4)); A.armR.sh.rotation.x = lerp(-0.7, -2.25, k); A.armR.el.rotation.x = lerp(-1.1, -2.0, k); A.armR.wr.rotation.z = Math.sin(t * 10) * 0.45 * k; A.head.rotation.x = -0.12 * k; }
            else if (u < 3.0) { const k = ease3(Math.min(1, (u - 1.8) / 0.3)); A.armR.sh.rotation.x = lerp(-2.25, -1.5, k); A.armR.el.rotation.x = lerp(-2.0, -2.2, k); A.armR.wr.rotation.z = Math.sin(t * 9) * 0.4; A.head.rotation.x = 0.1; }
            else { A.armR.sh.rotation.x = -0.7; A.armR.el.rotation.x = -1.1; A.armR.wr.rotation.z = 0; A.head.rotation.y = 0.5 * Math.sin(t * 0.6); }
            A.armL.sh.rotation.x = -0.7; A.armL.el.rotation.x = -1.1; }
          { const A = D1.av; A.update(dt, 0, t + 5); const u = t % 7.0;
            const lookCourt = u > 4.2, yaw = lookCourt ? -PI2 / 2 + 0.3 : PI2 / 2; D1.face += angDiff(D1.face, yaw) * Math.min(1, dt * 3);
            A.root.position.set(D1.x, 0, D1.z); A.root.rotation.y = D1.face;
            if (u < 1.0) { const k = ease3(u); A.armR.sh.rotation.x = lerp(-0.45, -2.0, k); A.armR.el.rotation.x = lerp(-0.5, -1.95, k); }
            else if (u < 2.6) { A.armR.sh.rotation.x = -2.0; A.armR.el.rotation.x = -1.95; A.head.rotation.x = -0.28 * ease3(Math.min(1, (u - 1.0) / 0.4)); }
            else if (u < 3.6) { const k = ease3(u - 2.6); A.armR.sh.rotation.x = lerp(-2.0, -0.6, k); A.armR.el.rotation.x = lerp(-1.95, -1.0, k); A.head.rotation.x = lerp(-0.28, 0, k); }
            else { A.armR.sh.rotation.x = -0.6; A.armR.el.rotation.x = -1.0; }
          }
        };
      }

      // ================= 匹克球：規則（11 分制）+ 動作 =================
      const HALF = CL / 2, NET_H = 0.88, rr = (a, b) => a + Math.random() * (b - a);
      const half = [0, 1];                                            // 兩隊目前所在半場（局間換場會對調）
      const dirT = (t) => (half[t] === 0 ? 1 : -1);                    // 朝哪個方向擊球
      const wx = (t, d) => CX + (half[t] === 0 ? -d : d);              // d = 距離球網的公尺數
      const courtZ = (t, c) => (c === "R" ? 1 : -1) * (half[t] === 0 ? 1 : -1) * 1.5; // 右 / 左發球區中心 z
      const parity = (n) => (n % 2 === 0 ? "R" : "L");                 // 偶數分右區、奇數分左區
      const kit = [
        { top: 0x1fa39a, pants: 0x2a2d3a, hair: 0x1c1613, skin: 0xe0ac8a, paddle: 0xff5a4a },
        { top: 0xf28a3a, pants: 0xdad8d0, hair: 0x5a3a22, skin: 0xc58a68, paddle: 0x2a2a31 },
        { top: 0xf2f2f2, pants: 0x22304a, hair: 0x2a2018, skin: 0xe8b999, paddle: 0x3a7be0 },
        { top: 0xf2d23a, pants: 0x2a2d3a, hair: 0x7a5a30, skin: 0xd9a07c, paddle: 0x1fa39a },
      ];
      const hex = (n) => "#" + n.toString(16).padStart(6, "0");
      const players = kit.map((k, i) => {
        const av2 = buildAvatar(THREE, { blazer: k.top, shirt: k.top, pants: k.pants, hair: k.hair, skin: k.skin });
        const pd = new THREE.Group();
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.014), new THREE.MeshStandardMaterial({ color: k.paddle, roughness: 0.5 })); face.position.y = -0.21; face.castShadow = true;
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.6 })); handle.position.y = -0.04;
        pd.add(face, handle); pd.position.set(0, 0, 0.03); pd.rotation.x = -1.35; av2.armR.wr.add(pd);
        scene.add(av2.root);
        const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x6ec6ff, roughness: 0.2, transparent: true, opacity: 0.85 })); drink.position.set(0, -0.33, 0.03); drink.visible = false; av2.armR.el.add(drink);
        const towelP = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.15), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })); towelP.position.set(0, -0.05, 0.03); towelP.visible = false; av2.armL.wr.add(towelP);
        return { av: av2, drink, towelP, bub: mkBubble(), pd, hand: "F", aimZ: null, W: { open: 0, yaw: 0 }, sitA: 0, idx: i, team: i < 2 ? 0 : 1, court: i % 2 === 0 ? "R" : "L", role: "", x: 0, z: 0, face: 0, yawOff: 0, swing: 0, swingType: "dink", swingDur: 0.5, spd: 0, crouch: 0.2, route: [] };
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8ee3a, roughness: 0.5, emissive: 0x7a8a10, emissiveIntensity: 0.5 }));
      ball.castShadow = true; scene.add(ball);

      // ---- 比賽狀態 ----
      let score = [0, 0], games = [0, 0], gameNo = 1, srv = 0, serverNo = 2, serverP = 0, firstSrv = 0;
      let mode = "wait", wait = 2.2, dead = 0, bannerT = 0, changeT = 0, serveT = 0, flashT = 0, flashTeam = -1, banner = "";
      let restT = 0, fetch = null, breakPlan = false, pointsSince = 0, tClock = 0;
      let flight = null, rally = null, lastType = "";
      const depthT = [3.6, 3.6];
      const partner = (i) => (i % 2 === 0 ? i + 1 : i - 1);
      const inCourt = (t, c) => (players[t * 2].court === c ? players[t * 2] : players[t * 2 + 1]);
      const swapCourts = (t) => { const a = players[t * 2], b = players[t * 2 + 1], c = a.court; a.court = b.court; b.court = c; };
      const startGame = () => { score = [0, 0]; serverNo = 2; srv = firstSrv; players.forEach((p) => (p.court = p.idx % 2 === 0 ? "R" : "L")); serverP = inCourt(srv, "R").idx; };
      const setupPoint = () => {
        players.forEach((p) => (p.role = ""));
        const sp = players[serverP]; sp.role = "server"; players[partner(serverP)].role = "sPartner";
        const rc = inCourt(1 - srv, sp.court); rc.role = "receiver"; players[partner(rc.idx)].role = "rPartner";
      };

      // ---- 計分牌（北牆）----
      const sbC = mkCanvas(1280, 480), sg = sbC.getContext("2d"), sbTex = mkTex(THREE, sbC, aniso);
      const teamName = ["青 · 橘", "白 · 黃"];
      const drawBoard = () => {
        const W = 1280, Hh = 480; sg.clearRect(0, 0, W, Hh);
        sg.fillStyle = "#0b0e1b"; sg.fillRect(0, 0, W, Hh); sg.strokeStyle = "#2c3350"; sg.lineWidth = 8; sg.strokeRect(4, 4, W - 8, Hh - 8);
        sg.fillStyle = "#8f9ab8"; sg.font = "700 34px -apple-system, 'Noto Sans TC', sans-serif"; sg.textAlign = "center";
        if ("letterSpacing" in sg) sg.letterSpacing = "8px"; sg.fillText(`PICKLEBALL · 雙打 · 第 ${gameNo} 局 · 先得 11 分`, W / 2, 56); if ("letterSpacing" in sg) sg.letterSpacing = "0px";
        for (let t = 0; t < 2; t++) {
          const x0 = t === 0 ? 40 : 680, w = 560, isSrv = t === srv;
          sg.fillStyle = isSrv ? "#141a30" : "#10142a"; sg.fillRect(x0, 86, w, 270);
          sg.strokeStyle = isSrv ? "#ffb347" : "#2c3350"; sg.lineWidth = isSrv ? 6 : 3; sg.strokeRect(x0, 86, w, 270);
          for (let j = 0; j < 2; j++) { sg.fillStyle = hex(kit[t * 2 + j].top); sg.beginPath(); sg.arc(x0 + 42 + j * 46, 128, 17, 0, 7); sg.fill(); }
          sg.fillStyle = "#cfd6ec"; sg.font = "700 38px 'Noto Sans TC', sans-serif"; sg.textAlign = "left"; sg.fillText(teamName[t], x0 + 140, 142);
          sg.fillStyle = flashTeam === t && flashT > 0 ? "#ffffff" : "#ffb347"; sg.shadowColor = "#ff9a1f"; sg.shadowBlur = 28;
          sg.font = "800 190px 'Courier New', ui-monospace, monospace"; sg.textAlign = "center"; sg.fillText(String(score[t]).padStart(2, "0"), x0 + w / 2, 318); sg.shadowBlur = 0;
          if (isSrv) { sg.fillStyle = "#ffb347"; sg.font = "700 30px 'Noto Sans TC', sans-serif"; sg.textAlign = "right"; sg.fillText(`發球中 · 第 ${serverNo} 發球員`, x0 + w - 20, 142); }
        }
        sg.fillStyle = "#cfd6ec"; sg.font = "700 40px 'Noto Sans TC', sans-serif"; sg.textAlign = "center";
        sg.fillText(`${score[srv]} - ${score[1 - srv]} - ${serverNo}`, W / 2, 232);
        sg.fillStyle = "#8f9ab8"; sg.font = "500 26px 'Noto Sans TC', sans-serif"; sg.fillText("發球方 - 接發方 - 發球員", W / 2, 272);
        sg.fillStyle = "#ffb347"; sg.font = "800 44px 'Courier New', monospace"; sg.fillText(`局數 ${games[0]} : ${games[1]}`, W / 2, 330);
        sg.fillStyle = "#8f9ab8"; sg.font = "500 28px 'Noto Sans TC', sans-serif"; sg.textAlign = "center";
        sg.fillText(`${parity(score[srv]) === "R" ? "偶數分 · 右區發球" : "奇數分 · 左區發球"}　　${rally ? "比賽中" : "準備發球"}`, W / 2, 428);
        if (banner) { sg.fillStyle = "rgba(8,10,24,.86)"; sg.fillRect(30, 150, W - 60, 190); sg.fillStyle = "#ffe08a"; sg.font = "800 92px 'Noto Sans TC', sans-serif"; sg.textAlign = "center"; sg.fillText(banner, W / 2, 270); sg.font = "600 36px 'Noto Sans TC', sans-serif"; sg.fillStyle = "#cfd6ec"; sg.fillText("雙方換邊，下一局即將開始", W / 2, 322); }
        sbTex.needsUpdate = true;
      };
      {
        const bd = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.16, 0.1), new THREE.MeshStandardMaterial({ color: 0x1a1d2c, roughness: 0.5, metalness: 0.4 })); bd.position.set(CX, 1.75, -HZ + 0.12); bd.castShadow = true; scene.add(bd);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.025), new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false })); face.position.set(CX, 1.75, -HZ + 0.18); scene.add(face);
      }

      // ---- 擊球種類 ----
      const SHOT = {
        serve:  { d1: [0.95, 1.1],  d2: [0.55, 0.7],  apex: 1.5,  depth: [4.4, 6.2], bounce: true },
        return: { d1: [0.8, 0.95],  d2: [0.45, 0.6],  apex: 1.8,  depth: [5.0, 6.2], bounce: true },
        drop:   { d1: [1.0, 1.2],   d2: [0.3, 0.38],  apex: 1.55, depth: [1.0, 1.9], bounce: true },
        dink:   { d1: [0.85, 1.15], d2: [0.28, 0.36], apex: 1.15, depth: [0.7, 1.9], bounce: true },
        drive:  { d1: [0.4, 0.55],  d2: [0.22, 0.3],  apex: 0.35, depth: [3.6, 6.0], bounce: true },
        volley: { d1: [0.45, 0.6],  d2: [0.2, 0.25],  apex: 0.4,  depth: [3.4, 5.2], bounce: false },
        lob:    { d1: [1.5, 1.8],   d2: [0.55, 0.7],  apex: 3.6,  depth: [5.2, 6.3], bounce: true },
        smash:  { d1: [0.3, 0.4],   d2: [0.5, 0.5],   apex: 0.2,  depth: [2.8, 4.5], bounce: true },
        out:    { d1: [0.45, 0.6],  d2: [0.4, 0.4],   apex: 0.35, depth: [7.1, 8.0], bounce: true },
        net:    { d1: [0.4, 0.5],   d2: [0.3, 0.3],   apex: 0.1,  depth: [0, 0], bounce: false },
      };
      const SPD = { serve: [8, 10], return: [9, 12], drop: [4.5, 6], dink: [3.5, 5], drive: [15, 19], volley: [11, 14], lob: [6, 7.5], smash: [18, 23], out: [13, 16], net: [10, 13] };
      const SWDUR = { serve: 0.62, return: 0.5, drop: 0.55, dink: 0.5, drive: 0.5, volley: 0.38, lob: 0.56, smash: 0.56, out: 0.5, net: 0.5 };
      // 揮拍姿勢：back=引拍、fwd=擊球、end=收拍；turn=側身蓄力（負=向持拍側轉）、over=擊球後轉過去的量
      const POSE = {
        drive:  { back: 0.7,  fwd: -1.75, end: -0.7, turn: -0.95, over: 0.3,  cr: 0.3 },
        return: { back: 0.6,  fwd: -1.6,  end: -0.7, turn: -0.8,  over: 0.25, cr: 0.35 },
        out:    { back: 0.7,  fwd: -1.75, end: -0.7, turn: -0.95, over: 0.3,  cr: 0.3 },
        net:    { back: 0.6,  fwd: -1.5,  end: -0.7, turn: -0.8,  over: 0.2,  cr: 0.4 },
        dink:   { back: -0.2, fwd: -1.1,  end: -0.6, turn: -0.12, over: 0.05, cr: 0.95 },
        drop:   { back: 0.0,  fwd: -1.2,  end: -0.6, turn: -0.2,  over: 0.08, cr: 0.8 },
        serve:  { back: 0.85, fwd: -1.0,  end: -0.5, turn: -0.25, over: 0.1,  cr: 0.12 },
        lob:    { back: 0.5,  fwd: -2.1,  end: -1.3, turn: -0.5,  over: 0.15, cr: 0.5 },
        volley: { back: -0.7, fwd: -1.3,  end: -0.9, turn: -0.3,  over: 0.1,  cr: 0.7 },
        smash:  { back: -2.6, fwd: -1.0,  end: -0.4, turn: -0.6,  over: 0.35, cr: 0.0 },
      };
      // 擊球角度：開面(+)=球拍面朝上（高吊/ dink）、閉面(-)=前壓（抽球/殺球）；yaw = 球拍面依目標左右偏轉
      const OPEN = { lob: 0.95, dink: 0.55, drop: 0.5, serve: 0.35, return: -0.05, drive: -0.35, volley: 0.0, smash: -0.9, out: -0.3, net: -0.2 };
      const startSwing = (p, type, hand, keepAim) => {
        p.swing = 1; p.swingType = type; p.swingDur = SWDUR[type] || 0.5; p.hand = hand || "F";
        if (!keepAim && (type !== "serve" || p.aimZ == null)) p.aimZ = clamp(rr(-2.4, 2.4), -CW / 2 + 0.35, CW / 2 - 0.35);
        const side = half[p.team] === 0 ? 1 : -1, lr = (p.aimZ - p.z) * side;      // 目標在持拍者右側(+)或左側(-)
        p.W = { open: (OPEN[type] ?? 0) + rr(-0.12, 0.12), yaw: clamp(lr * 0.3 + rr(-0.08, 0.08), -0.9, 0.9) };
      };
      const pickPlayer = (team, z) => { const a = players[team * 2], b = players[team * 2 + 1]; return Math.abs(a.z - z) < Math.abs(b.z - z) ? a : b; };
      const chooseType = (k) => {
        if (k === 0) return "serve"; if (k === 1) return "return"; if (k === 2) return "drop";
        if (k >= rally.max) return rally.finish;
        const r = Math.random(), atNet = depthT[0] < 3.2 && depthT[1] < 3.2;
        let type = atNet ? (r < 0.5 ? "dink" : r < 0.68 ? "drive" : r < 0.82 ? "volley" : r < 0.92 ? "lob" : "dink") : (r < 0.4 ? "dink" : r < 0.66 ? "drive" : r < 0.82 ? "lob" : r < 0.92 ? "volley" : "dink");
        if (type === lastType && type !== "dink") type = "dink";
        return type;
      };

      const nextShot = (hi, forced) => {
        const p = players[hi], team = p.team, opp = 1 - team, dir = dirT(team), k = rally.k++;
        const type = forced || chooseType(k); lastType = type;
        const S = SHOT[type], bp = ball.position, sx = bp.x, sz = bp.z, y0 = clamp(bp.y, 0.45, 1.5);
        if (window.Music) window.Music.sfx("hit", sx, sz, { smash: 1.5, drive: 1.3, serve: 1.1, volley: 0.9, lob: 0.8, drop: 0.55, dink: 0.45 }[type] ?? 0.9);   // 球拍擊球聲
        const segs = []; let end = false, winner = -1, recv, z1, contact;
        if (type === "net") {
          const zn = clamp(sz, -2.6, 2.6);
          segs.push({ x0: sx, y0, z0: sz, x1: CX, y1: 0.62, z1: zn, dur: clamp(Math.hypot(CX - sx, zn - sz) / rr(...SPD.net), 0.22, 1.0), apex: 0.1 });
          segs.push({ x0: CX, y0: 0.62, z0: zn, x1: CX - dir * 0.35, y1: 0.05, z1: zn, dur: 0.3, apex: 0.05 });
          end = true; winner = opp; recv = players[opp * 2];
        } else {
          if (type === "serve") { const rc = inCourt(opp, p.court); recv = rc; z1 = p.aimZ != null ? p.aimZ : Math.sign(courtZ(opp, rc.court)) * rr(0.7, 2.5); }
          else { z1 = p.aimZ != null ? p.aimZ : clamp(rr(-2.4, 2.4), -CW / 2 + 0.35, CW / 2 - 0.35); recv = pickPlayer(opp, z1); }
          p.aimZ = null;
          let dep1 = rr(S.depth[0], S.depth[1]);
          if (type === "out") {                                                          // 出界球：飛到場地外，但還在球館裡（長球飛過底線 / 大角度飛到側邊）
            const east = wx(opp, 1) > CX, dmax = east ? 9.4 : 10.6;
            if (Math.random() < 0.4) { z1 = (Math.random() < 0.5 ? -1 : 1) * rr(3.5, 4.5); dep1 = rr(2.5, 6.2); } else dep1 = rr(7.3, dmax);
          }
          const lastY = S.bounce ? 0.04 : 0.95;
          const bx = wx(opp, dep1);
          const dh = Math.hypot(bx - sx, z1 - sz), vh = rr(...SPD[type]);
          let d1 = clamp(dh / vh, 0.28, 2.0), apex = 9.8 * d1 * d1 / 8;                     // 重力決定弧線高度
          if (type === "lob") apex = Math.max(apex, 2.8);
          const dep0 = Math.abs(sx - CX), un = dep0 / (dep0 + dep1), yn = lerp(y0, lastY, un) + apex * 4 * un * (1 - un);
          if (type !== "out" && yn < NET_H + 0.14) apex += (NET_H + 0.14 - yn) / Math.max(0.2, 4 * un * (1 - un));   // 要過網就得抬高
          d1 = Math.max(d1, Math.sqrt(8 * apex / 9.8));                                    // 弧線越高，飛行時間越長
          segs.push({ x0: sx, y0, z0: sz, x1: bx, y1: lastY, z1, dur: d1, apex });
          const cd = Math.max(2.3, dep1 + 0.5);
          contact = { x: S.bounce ? wx(opp, cd) : bx, z: z1 };
          if (type === "smash") { segs.push({ x0: bx, y0: 0.04, z0: z1, x1: bx + dir * 1.6, y1: 0.05, z1: z1 + rr(-0.6, 0.6), dur: 0.5, apex: 0.9 }); end = true; winner = team; }
          else if (type === "out") {                                                     // 落地後在館內滾動，碰到牆 / 圍欄會反彈，最後停在某處等人去撿
            let x = bx, z = z1, hv = Math.max(0.1, vh), ux = (bx - sx) / Math.max(0.01, dh), uz = (z1 - sz) / Math.max(0.01, dh), v = hv * 0.55, n = 0;
            const XA = CX - HX + 0.35, XB = CX + 10.3 - 0.5, ZA = -HZ + 0.3, ZB = HZ - 0.3;
            while (v > 0.5 && n < 3) {
              const stop = v * v / 4.4, dX = ux > 1e-6 ? (XB - x) / ux : ux < -1e-6 ? (XA - x) / ux : 1e9, dZ = uz > 1e-6 ? (ZB - z) / uz : uz < -1e-6 ? (ZA - z) / uz : 1e9, dw = Math.min(dX, dZ);
              if (dw >= stop) { segs.push({ x0: x, y0: 0.04, z0: z, x1: x + ux * stop, y1: 0.04, z1: z + uz * stop, dur: Math.max(0.2, v / 2.2), apex: n === 0 ? 0.2 : 0.05 }); break; }
              const t = Math.max(0.12, (v - Math.sqrt(Math.max(0, v * v - 2.2 * dw))) / 1.1), xw = x + ux * dw, zw = z + uz * dw;
              segs.push({ x0: x, y0: 0.04, z0: z, x1: xw, y1: 0.04, z1: zw, dur: t, apex: n === 0 ? 0.2 : 0.05 });
              v = Math.max(0, v - 2.2 * t) * 0.55; if (dX <= dZ) ux = -ux; else uz = -uz; x = xw; z = zw; n++;
            }
            if (segs.length < 2) segs.push({ x0: bx, y0: 0.04, z0: z1, x1: bx + dir * 0.8, y1: 0.04, z1, dur: 0.4, apex: 0.12 });
            end = true; winner = opp;
          }
          else if (S.bounce) { const d2 = clamp(Math.abs(contact.x - bx) / (vh * 0.45), 0.25, 0.55); segs.push({ x0: bx, y0: 0.04, z0: z1, x1: contact.x, y1: 0.85, z1, dur: d2, apex: 9.8 * d2 * d2 / 8 }); }
        }
        flight = { segs, i: 0, t: 0, recv, recvType: end ? null : chooseType(rally.k), recvHand: Math.random() < 0.68 ? "F" : "B", end, winner, swung: false, contact: contact || { x: CX, z: 0 }, hitDir: dir };
        // 站位（第 4 拍起進入網前對攻）
        if (k >= 3) {
          if (type === "dink") { depthT[team] = Math.max(2.6, depthT[team] - 0.7); depthT[opp] = Math.max(2.6, depthT[opp] - 0.4); }
          else if (type === "lob") depthT[opp] = 5.8;
          else if (type === "drive" || type === "volley") { depthT[team] = Math.max(2.8, depthT[team] - 0.5); depthT[opp] = Math.max(3.2, depthT[opp]); }
        }
      };

      const awardPoint = (w) => {
        flashTeam = w;
        if (w === srv) { score[srv]++; swapCourts(srv); flashT = 1.2; }                  // 發球方得分：兩人左右換邊
        else if (serverNo === 1) {                                                         // 第一發球員失誤 → 換搭檔發球
          serverNo = 2; serverP = partner(serverP);
          if (players[serverP].court !== parity(score[srv])) swapCourts(srv);
        } else { srv = 1 - srv; serverNo = 1; serverP = inCourt(srv, parity(score[srv])).idx; flashT = 0.6; }   // 換發球權
        rally = null; flight = null;
        const a = score[0], b = score[1];
        if (Math.max(a, b) >= 11 && Math.abs(a - b) >= 2) {
          const gw = a > b ? 0 : 1; games[gw]++; banner = `${teamName[gw]} 勝　${Math.max(a, b)} : ${Math.min(a, b)}`; mode = "over"; bannerT = 6;
        } else { mode = "dead"; dead = 1.0; pointsSince++; breakPlan = pointsSince >= 3 && Math.random() < 0.3; setupPoint(); }
        ball.position.y = 0.06;
        if (mode === "over") { restT = 6; }
        drawBoard();
      };
      const startPoint = () => {
        rally = { k: 0, max: Math.round(rr(5, 14)), finish: (() => { const r = Math.random(); return r < 0.5 ? "smash" : r < 0.7 ? "net" : "out"; })() };
        depthT[0] = depthT[1] = 3.6; lastType = ""; setupPoint();
        { const sv = players[serverP], rc0 = inCourt(1 - srv, sv.court); sv.aimZ = Math.sign(courtZ(1 - srv, rc0.court)) * rr(0.7, 2.5); } startSwing(players[serverP], "serve", "F"); serveT = SWDUR.serve * 0.5; mode = "serve"; drawBoard();
      };
      const endIntermission = () => {            // 局間：雙方對調場地，下一局換對方先發球
        banner = ""; half[0] = 1 - half[0]; half[1] = 1 - half[1]; gameNo++; firstSrv = 1 - firstSrv; startGame();
        players.forEach((p) => { const sideZ = (p.idx % 2 === 0 ? -1 : 1) * 4.1, nx = wx(p.team, 6.4); p.route = [...(p.x > FX ? [GB, GA] : []), { x: p.x > FX ? GA.x : p.x, z: sideZ }, { x: nx, z: sideZ }]; });
        mode = "change"; changeT = 4.2; pointsSince = 0; setupPoint(); drawBoard();
      };
      startGame(); setupPoint(); drawBoard();
      let courtTS = 1;
      api.setCourtSpeed = (n) => { courtTS = n; };
      api.forceFinish = (t) => { if (rally) { rally.finish = t; rally.max = rally.k + 1; return true; } return false; };   // 測試用：讓這一分用指定方式結束（out / net / smash）
      api.forceRest = (sec = 10) => { flight = null; rally = null; mode = "rest"; restT = sec; };   // 測試用：立刻讓四位球員去休息區
      api.courtState = () => ({ mode, score: score.slice(), games: games.slice(), srv, serverNo, gameNo, half: half.slice(), k: rally ? rally.k : -1, fetch: fetch ? fetch.stage : null, ball: [+ball.position.x.toFixed(1), +ball.position.y.toFixed(2), +ball.position.z.toFixed(1)], players: players.map((p) => ({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), court: p.court, role: p.role, sit: +p.sitA.toFixed(2), hand: p.hand, wr: p.av.armR.wr.rotation.toArray().slice(0, 3).map((v) => +v.toFixed(2)) })) });
      players.forEach((p) => { const d = { server: 6.9, sPartner: 6.4, receiver: 6.7, rPartner: 2.7 }[p.role]; p.x = wx(p.team, d); p.z = courtZ(p.team, p.court); p.face = half[p.team] === 0 ? Math.PI / 2 : -Math.PI / 2; });

      const startFetch = () => {
        let best = null, bd = 1e9; players.forEach((q) => { const d = Math.hypot(q.x - ball.position.x, q.z - ball.position.z); if (d < bd) { bd = d; best = q; } });
        fetch = { p: best, stage: "go", t: 0 }; mode = "fetch";
      };
      const targetOf = (p) => {
        const k = rally ? rally.k : 0, t = p.team;
        let d;
        if (!rally || k <= 1) d = { server: 6.9, sPartner: 6.4, receiver: 6.7, rPartner: 2.7 }[p.role];
        else if (k === 2) d = { server: 5.8, sPartner: 5.4, receiver: 4.8, rPartner: 2.7 }[p.role];
        else if (k === 3) d = t === srv ? 3.8 : 3.0;
        else d = depthT[t];
        let z = courtZ(t, p.court);
        if (rally && k >= 3) z = clamp(z * 0.8 + ball.position.z * 0.3, -CW / 2 - 0.4, CW / 2 + 0.4);
        return { x: wx(t, (d || 4) + (p.court === "L" ? 0.2 : 0)), z };
      };
      // 圍欄在 x=FX：球員進出休息區一律從出入口（南側 z≈4）通過，不穿牆
      const GA = { x: FX - 0.9, z: 4.0 }, GB = { x: FX + 0.9, z: 3.9 };
      const viaGate = (p, tg) => {
        const a = p.x < FX, b = tg.x < FX; if (a === b) return tg;
        if (a) return Math.hypot(p.x - GA.x, p.z - GA.z) < 0.6 || p.x > GA.x + 0.7 ? GB : GA;     // 球場 → 休息區
        return Math.hypot(p.x - GB.x, p.z - GB.z) < 0.6 || p.x < GB.x - 0.7 ? GA : GB;             // 休息區 → 球場
      };
      const ease = (u) => u * u * (3 - 2 * u);
      const facingLeft = (p) => { const nb = chairSpots[p.idx ^ 1], me = chairSpots[p.idx]; return nb.z > me.z; };   // 面向西時，南側(+z)在左手邊

      courtUpdate = (dt0, t) => {
        const dt = dt0 * courtTS; tClock += dt; if (loungeUpdate) loungeUpdate(dt, tClock);
        if (flashT > 0) { flashT -= dt; if (flashT <= 0) { flashTeam = -1; drawBoard(); } }
        // ---- 節奏 ----
        if (mode === "wait") { wait -= dt; if (wait <= 0) startPoint(); }
        else if (mode === "serve") { serveT -= dt; if (serveT <= 0) { nextShot(serverP, "serve"); mode = "flight"; } }
        else if (mode === "dead") { dead -= dt; if (dead <= 0) { if (breakPlan) { breakPlan = false; pointsSince = 0; mode = "rest"; restT = 5.5; } else startFetch(); } }
        else if (mode === "rest") { restT -= dt; if (restT <= 0) startFetch(); }
        else if (mode === "fetch" && fetch) {
          const fp = fetch.p, hx = fp.x + Math.sin(fp.face) * 0.28, hz = fp.z + Math.cos(fp.face) * 0.28;
          if (fetch.stage === "go") { if (Math.hypot(fp.x - ball.position.x, fp.z - ball.position.z) < 0.45) { fetch.stage = "pick"; fetch.t = 0.9; } }
          else if (fetch.stage === "pick") { fetch.t -= dt; if (fetch.t < 0.5) ball.position.set(hx, lerp(0.8, 0.12, clamp((fetch.t) / 0.5, 0, 1)), hz); if (fetch.t <= 0) { if (fp === players[serverP]) fetch.stage = "done"; else { fetch.stage = "feed"; fetch.t = SWDUR.dink * 0.5; const sv0 = players[serverP]; fp.aimZ = sv0.z; startSwing(fp, "dink", "F", true); } } }
          else if (fetch.stage === "feed") {                                              // 用球拍把球輕輕「推」給發球員（不走過去）
            ball.position.set(hx, 0.78, hz); fetch.t -= dt;
            if (fetch.t <= 0) { const sv = players[serverP], x1 = sv.x + dirT(sv.team) * 0.3, dist0 = Math.hypot(x1 - ball.position.x, sv.z - ball.position.z); fetch.fly = { x0: ball.position.x, y0: ball.position.y, z0: ball.position.z, x1, y1: 0.85, z1: sv.z, t: 0, dur: clamp(dist0 / 4.5, 0.55, 1.7) }; fetch.stage = "fly"; }
          }
          else if (fetch.stage === "fly") {
            const f = fetch.fly; f.t += dt / f.dur; const u = Math.min(1, f.t);
            ball.position.set(lerp(f.x0, f.x1, u), lerp(f.y0, f.y1, u) + 9.8 * f.dur * f.dur / 8 * 4 * u * (1 - u), lerp(f.z0, f.z1, u));
            if (f.t >= 1) fetch.stage = "done";
          }
          if (fetch.stage === "done") { mode = "wait"; wait = rr(2.0, 3.2); fetch = null; }
        }
        else if (mode === "over") { bannerT -= dt; if (bannerT <= 0) endIntermission(); }
        else if (mode === "change") { changeT -= dt; if (changeT <= 0) { players.forEach((p) => (p.route = [])); startFetch(); drawBoard(); } }
        // ---- 球 ----
        if (mode === "flight" && flight) {
          const sg2 = flight.segs[flight.i]; flight.t += dt / sg2.dur; const u = Math.min(1, flight.t);
          ball.position.set(lerp(sg2.x0, sg2.x1, u), lerp(sg2.y0, sg2.y1, u) + sg2.apex * 4 * u * (1 - u), lerp(sg2.z0, sg2.z1, u));
          const last = flight.i === flight.segs.length - 1;
          if (last && !flight.end && !flight.swung && sg2.dur * (1 - flight.t) <= (SWDUR[flight.recvType] || 0.5) * 0.5) {
            flight.swung = true; const rcv = flight.recv, sd = half[rcv.team] === 0 ? 1 : -1;
            const tx0 = flight.contact.x + flight.hitDir * 0.5, tz0 = flight.contact.z + sd * (flight.recvHand === "F" ? -0.4 : 0.4), lead0 = (SWDUR[flight.recvType] || 0.5) * 0.5;
            const deficit = Math.max(0, Math.hypot(tx0 - rcv.x, tz0 - rcv.z) - 5.2 * lead0 * 0.9);
            startSwing(rcv, flight.recvType, flight.recvHand);
            rcv.stretch = clamp((deficit - 0.1) / 0.7, 0, 1); rcv.latSign = Math.sign((flight.contact.z - rcv.z) * sd) || 1;
          }
          if (flight.t >= 1) {
            if (!last) { if (window.Music) window.Music.sfx("bounce", sg2.x1, sg2.z1); flight.i++; flight.t = 0; }                                  // 球落地聲
            else if (flight.end) { if (window.Music) window.Music.sfx(lastType === "net" ? "net" : "bounce", sg2.x1, sg2.z1); const w = flight.winner; flight = null; awardPoint(w); }
            else {
              const rc = flight.recv, dd = Math.hypot(flight.contact.x - rc.x, flight.contact.z - rc.z);
              if (dd > 1.35) { const w = 1 - rc.team; flight = null; awardPoint(w); }          // 手搆不到 → 漏接，對方得分
              else { const hi = rc.idx, ty = flight.recvType; flight = null; nextShot(hi, ty); }
            }
          }
        } else if (mode === "wait" || mode === "serve") {
          const sp = players[serverP], bounce = mode === "wait" && wait > 0.7;
          ball.position.set(sp.x + dirT(sp.team) * 0.3, bounce ? 0.4 + 0.42 * Math.abs(Math.sin(tClock * 4.4)) : 0.85, sp.z);
        }
        // ---- 球員 ----
        players.forEach((p) => {
          const moving = mode === "change" && p.route.length;
          let tg = moving ? p.route[0] : targetOf(p), sp, urgent = 0;
          const resting = (mode === "rest" || mode === "over") && chairSpots[p.idx];
          if (resting) tg = { x: chairSpots[p.idx].x, z: chairSpots[p.idx].z };
          const fpo = mode === "fetch" && fetch && fetch.p === p ? fetch : null;
          if (!moving) tg = viaGate(p, tg);
          if (fpo) { if (fpo.stage === "go") tg = { x: ball.position.x, z: ball.position.z }; else if (fpo.stage === "back") { const sv = players[serverP]; tg = { x: sv.x - dirT(sv.team) * 0.9, z: sv.z }; } else tg = { x: p.x, z: p.z }; }
          if (!moving && !resting && !fpo && flight && flight.recv === p && !flight.end) {
            tg = { x: flight.contact.x + flight.hitDir * 0.5, z: flight.contact.z + (half[p.team] === 0 ? 1 : -1) * (flight.recvHand === "F" ? -0.4 : 0.4) };
            const sg2 = flight.segs[flight.segs.length - 1], remain = (flight.segs.length - 1 - flight.i) * 0.4 + sg2.dur * (flight.i === flight.segs.length - 1 ? 1 - flight.t : 1);
            urgent = Math.hypot(tg.x - p.x, tg.z - p.z) / Math.max(0.25, remain);
          }
          const dx = tg.x - p.x, dz = tg.z - p.z, d = Math.hypot(dx, dz);
          if (moving) { sp = 2.6; if (d < 0.3) p.route.shift(); }
          else if (urgent) sp = clamp(urgent * 1.1, 1.4, 5.2);                 // 追球：有快有慢，依來球時間決定
          else sp = Math.min(resting || fpo ? 2.6 : 2.2, d * 2.2);                // 一般調整站位 / 走去撿球 / 走去休息：慢走
          if (d > 0.03) { p.x += (dx / d) * sp * dt; p.z += (dz / d) * sp * dt; }
          if (!moving && !resting && !fpo && mode !== "change" && p.x < FX - 0.5) {
            p.x = clamp(p.x, half[p.team] ? CX + 0.7 : CX - HALF - 1.6, half[p.team] ? CX + HALF + 1.6 : CX - 0.7);
            p.z = clamp(p.z, -CW / 2 - 1.1, CW / 2 + 1.1);
          }
          const mv = d > 0.1 ? sp : 0;
          p.spd = lerp(p.spd, mv, Math.min(1, dt * 7));
          // 面向：比賽中看球；準備 / 發球時面向球網
          const nd = half[p.team] === 0 ? Math.PI / 2 : -Math.PI / 2;
          const lookBall = (mode === "flight" && flight) || mode === "dead";
          const sitting = resting && d < 0.15, want = sitting ? chairSpots[p.idx].face : fpo && (fpo.stage === "feed" || fpo.stage === "fly") ? Math.atan2(players[serverP].x - p.x, players[serverP].z - p.z) : moving || fpo || resting ? Math.atan2(dx, dz) : lookBall ? Math.atan2(ball.position.x - p.x, ball.position.z - p.z) * 0.75 + nd * 0.25 : nd;
          p.face += angDiff(p.face, want) * Math.min(1, dt * 6);
          const lateral = Math.abs(dz) > Math.abs(dx) * 1.2;
          p.av.update(dt, p.spd * (lateral ? 0.75 : 1), t + p.idx);
          p.sitA = lerp(p.sitA, sitting ? 1 : 0, Math.min(1, dt * 5));
          // ---- 姿勢：膝蓋彎曲（網前 dink 蹲低）、衝刺前傾 ----
          const near = Math.abs(p.x - CX) < 3.3, ready = !p.swing && p.spd < 2.2;
          const crT = p.swing > 0 ? (POSE[p.swingType] ? POSE[p.swingType].cr : 0.3) : near ? 0.85 : (mode === "wait" || mode === "serve") && p.role === "server" ? 0.12 : 0.32;
          p.crouch = lerp(p.crouch, p.spd > 3.2 ? 0 : crT, Math.min(1, dt * 6));
          const still = clamp(1 - p.spd / 2.6, 0, 1), c = p.crouch * still, h = c * 0.82, kn = h * 1.9, drop = 0.83 - (0.43 * Math.cos(h) + 0.40 * Math.cos(kn - h));
          const A = p.av;
          A.legL.hip.rotation.x += -h * 1.05; A.legR.hip.rotation.x += -h * 0.85; A.legL.knee.rotation.x += kn * 1.05; A.legR.knee.rotation.x += kn * 0.85;
          A.legL.hip.rotation.z = -0.07 - 0.12 * c; A.legR.hip.rotation.z = 0.07 + 0.12 * c;
          A.body.position.y -= drop; A.torso.rotation.x += c * 0.4 + (p.spd > 3.2 ? 0.2 : 0);
          // 撿球：彎腰伸手
          if (fpo && fpo.stage === "pick") { A.torso.rotation.x += 0.65; A.armR.sh.rotation.x = -0.1; A.armR.el.rotation.x = -0.2; A.legL.hip.rotation.x -= 0.25; A.legL.knee.rotation.x += 0.45; }
          if (mode === "fetch" && fetch && (fetch.stage === "feed" || fetch.stage === "fly") && p === players[serverP]) { A.armL.sh.rotation.x = -1.25; A.armR.sh.rotation.x = -1.1; A.armR.el.rotation.x = -0.6; }   // 發球員伸手接球
          // 準備姿勢：球拍舉在身前
          if (!(p.swing > 0)) { A.armR.wr.rotation.set(0.25, 0, 0); p.pd.rotation.x = -1.35; A.torso.rotation.z = 0; p.stretch = 0; }
          if (!p.swing && !fpo && p.sitA < 0.5) { A.armR.sh.rotation.x = -0.65 - c * 0.5; A.armR.el.rotation.x = -0.9; A.armL.sh.rotation.x = -0.35 - c * 0.3; }
          // ---- 揮拍：引拍 → 側身蓄力 → 轉身發力 → 收拍 ----
          let off = 0;
          if (p.swing > 0) {
            p.swing = Math.max(0, p.swing - dt / p.swingDur);
            const u = 1 - p.swing, Q = POSE[p.swingType] || POSE.dink; let ax, tv;
            if (u < 0.4) { const s = ease(u / 0.4); ax = lerp(-0.65, Q.back, s); tv = lerp(0, Q.turn, s); }
            else if (u < 0.62) { const s = ease((u - 0.4) / 0.22); ax = lerp(Q.back, Q.fwd, s); tv = lerp(Q.turn, Q.over, s); }
            else { const s = ease((u - 0.62) / 0.38); ax = lerp(Q.fwd, Q.end, s); tv = lerp(Q.over, 0, s); }
            const bh = p.hand === "B" ? -1 : 1; tv *= bh;                                  // 反手：向另一側轉身
            const Wp = p.W, rc2 = u < 0.4 ? ease(u / 0.4) * 0.45 : u < 0.62 ? lerp(0.45, 1, ease((u - 0.4) / 0.22)) : lerp(1, 0.55, (u - 0.62) / 0.38);
            const fc = -0.15 - 0.55 * Wp.open;                                              // 擊球瞬間的手腕屈伸（開面 / 閉面）
            const cock = u < 0.4 ? lerp(0.1, 0.55, ease(u / 0.4)) : u < 0.62 ? lerp(0.55, fc, ease((u - 0.4) / 0.22)) : lerp(fc, fc - 0.25, (u - 0.62) / 0.38);
            A.armR.wr.rotation.set(cock, Wp.yaw * rc2 * bh, (bh > 0 ? 0.22 : -0.35) * rc2);   // 屈伸 / 前臂旋轉(拍面朝向) / 尺橈偏
            A.armR.sh.rotation.z = bh > 0 ? 0.1 : -0.7 * rc2; p.pd.rotation.x = -1.35 - Wp.open * 0.3 * rc2;
            A.armR.sh.rotation.x = ax; A.armR.el.rotation.x = -0.35 - 0.35 * Math.sin(u * Math.PI);
            const sk = p.stretch || 0;
            if (sk > 0.02) {                                                                // 來不及站好位：手臂伸直、身體側傾，用手腕勾回來
              A.armR.el.rotation.x = lerp(A.armR.el.rotation.x, -0.12, sk); A.armR.sh.rotation.z += (p.latSign || 1) * 0.55 * sk * (bh > 0 ? 1 : -0.6);
              A.torso.rotation.z = (p.latSign || 1) * -0.28 * sk; A.armR.wr.rotation.x += 0.35 * sk; A.armR.wr.rotation.z += 0.3 * sk * (p.latSign || 1);
            }
            A.armL.sh.rotation.x = -0.5 - tv * 0.6; A.torso.rotation.y += -tv * 0.45; A.torso.rotation.x += Math.sin(u * Math.PI) * 0.12; off = tv;
          }
          // 坐下休息（可喝水）
          if (p.sitA > 0.01) {
            seatPose(A, p.sitA);
            const ph = tClock + p.idx * 1.1, act = Math.floor(ph / 3.2) % 3, up = (ph % 3.2) / 3.2;   // 輪流：喝水 → 擦汗 → 聊天
            const nb = chairSpots[p.idx ^ 1], me = chairSpots[p.idx], sideSign = nb.z > me.z ? 1 : -1;
            p.drink.visible = act === 0 && p.sitA > 0.9; p.towelP.visible = act === 1 && p.sitA > 0.9;
            let speak = false;
            if (act === 0) { const k = ease(Math.min(1, up * 3)); A.armR.sh.rotation.x = lerp(-0.7, -2.1, k); A.armR.el.rotation.x = lerp(-1.1, -1.7, k); A.head.rotation.x = -0.18 * k; }
            else if (act === 1) { const k = ease(Math.min(1, up * 4)); A.armL.sh.rotation.x = lerp(-0.7, -2.2, k); A.armL.el.rotation.x = lerp(-1.1, -2.0, k); A.armL.wr.rotation.z = Math.sin(tClock * 10) * 0.45 * k; A.armR.sh.rotation.x = -0.7; A.armR.el.rotation.x = -1.1; }
            else {                                                                                  // 聊天：轉頭看隔壁的人、點頭、比手勢
              speak = ((Math.floor(ph / 1.6) + p.idx) % 2) === 0; A.head.rotation.y = 0.75 * sideSign * (p.idx > 1 ? 1 : 1) * ((facingLeft(p) ? 1 : -1));
              A.head.rotation.x = speak ? 0.08 * Math.sin(tClock * 5) : 0.05 * Math.sin(tClock * 1.9);
              A.armR.sh.rotation.x = speak ? -0.9 + 0.35 * Math.sin(tClock * 4.2) : -0.7; A.armR.el.rotation.x = speak ? -1.1 + 0.25 * Math.sin(tClock * 4.2 + 1) : -1.1;
            }
            showBubble(p.bub, A, CHAT[(p.idx * 3 + Math.floor(ph / 1.6)) % CHAT.length], act === 2 && speak && p.sitA > 0.9 && (mode === "rest" || mode === "over"));
          } else { p.drink.visible = false; p.towelP.visible = false; showBubble(p.bub, A, "", false); }
          p.yawOff = lerp(p.yawOff, off, Math.min(1, dt * 14));
          A.root.position.set(p.x, 0, p.z + (p.sitA > 0.5 ? 0.0 : 0)); A.root.rotation.y = p.face + p.yawOff;
        });
      };
    }

    /* ----- 戶外：David 的家 → 花園小徑 → 美術館入口 ----- */
    {
      const M = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const mk = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
      const rnd = mulberry(31), PI = Math.PI;
      // 草地
      const gc = mkCanvas(1024, 512), gg = gc.getContext("2d");
      gg.fillStyle = "#4d7a3e"; gg.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 16000; i++) { gg.fillStyle = `hsl(${92 + rnd() * 28} ${34 + rnd() * 22}% ${24 + rnd() * 20}%)`; gg.fillRect(rnd() * 1024, rnd() * 512, 2, 3 + rnd() * 4); }
      const gt = mkTex(THREE, gc, aniso); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(ENTRY / 8, (DECK_HD * 2) / 8);
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(ENTRY, DECK_HD * 2), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, envMapIntensity: 0.1 }));
      grass.rotation.x = -PI / 2; grass.position.set(ENTRY / 2, 0.012, 0); grass.receiveShadow = true; scene.add(grass);

      // 小徑：從家門口蜿蜒到美術館入口
      const pathPts = [[12.2, -2.4], [14.5, -2.4], [17, -1.0], [20, 0.1], [ENTRY - 0.2, 0]];
      const stones = [0x8e887a, 0x9a9486, 0x827c70, 0xa39d8f];
      for (let s = 0; s < pathPts.length - 1; s++) {
        const [x0, z0] = pathPts[s], [x1, z1] = pathPts[s + 1], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), n = Math.ceil(len / 0.85);
        for (let k = 0; k < n; k++) {
          const u = (k + 0.5) / n, w = 1.9;
          for (let r = 0; r < 2; r++) {
            const off = (r - 0.5) * (w / 2) + (rnd() - 0.5) * 0.08, px = lerp(x0, x1, u) - Math.sin(ang) * off, pz = lerp(z0, z1, u) + Math.cos(ang) * off;
            const tile = new THREE.Mesh(new THREE.BoxGeometry(len / n * 0.96, 0.03, w / 2 * 0.94), M(stones[(rnd() * 4) | 0], 0.9)); tile.position.set(px, 0.028, pz); tile.rotation.y = -ang; tile.receiveShadow = true; scene.add(tile);
          }
        }
      }

      // ===== David 的家：兩層樓（一樓 David、二樓 Aeris）=====
      const plasterH = M(0xf3ece0, 0.92), wood = M(0xc9a36a, 0.55), bronze = M(0x7d6446, 0.38, 0.85);
      const shellBox = (w, h, d, x, z, mat, grp, low, y0 = 0) => { const g0 = new THREE.BoxGeometry(w, h, d); g0.translate(0, h / 2, 0); const m = new THREE.Mesh(g0, mat); m.position.set(x, y0, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); shells.push({ m, grp, low }); return m; };
      const X0 = HOUSE.x0, X1 = HOUSE.x1, Z0 = HOUSE.z0, Z1 = HOUSE.z1, ZC = (Z0 + Z1) / 2, DW0 = -3.2, DW1 = -1.6, FH = UY - 0.22, WT = 2.8, TOP = UY + WT;   // FH：一樓牆高；UY：二樓地板面；TOP：二樓牆頂
      const ft = floorTex.clone(); ft.needsUpdate = true; ft.repeat.set(1.4, 1);
      const hf = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.5, color: 0xe6d3b0 })); hf.rotation.x = -PI / 2; hf.position.set((X0 + X1) / 2, 0.018, ZC); hf.receiveShadow = true; scene.add(hf);
      // 外牆（北、東為整面高牆；西、南走進去會降低）
      mk(new THREE.BoxGeometry(X1 - X0 + 0.14, TOP, 0.14), plasterH, (X0 + X1) / 2, TOP / 2, Z0); addObs((X0 + X1) / 2, Z0, (X1 - X0) / 2, 0.1);
      shellBox(0.14, FH, Z1 - Z0, X0, ZC, plasterH, "H", 0.48); shellBox(0.14, WT, Z1 - Z0, X0, ZC, plasterH, "U", 0.48, UY); addObs(X0, ZC, 0.1, (Z1 - Z0) / 2);
      shellBox(X1 - X0 + 0.14, FH, 0.14, (X0 + X1) / 2, Z1, plasterH, "H", 0.48); shellBox(X1 - X0 + 0.14, WT, 0.14, (X0 + X1) / 2, Z1, plasterH, "U", 0.48, UY); addObs((X0 + X1) / 2, Z1, (X1 - X0) / 2, 0.1);
      mk(new THREE.BoxGeometry(0.14, TOP, DW0 - Z0), plasterH, X1, TOP / 2, (Z0 + DW0) / 2); addObs(X1, (Z0 + DW0) / 2, 0.1, (DW0 - Z0) / 2);
      mk(new THREE.BoxGeometry(0.14, TOP, Z1 - DW1), plasterH, X1, TOP / 2, (DW1 + Z1) / 2); addObs(X1, (DW1 + Z1) / 2, 0.1, (Z1 - DW1) / 2);
      mk(new THREE.BoxGeometry(0.14, TOP - 2.1, DW1 - DW0), plasterH, X1, 2.1 + (TOP - 2.1) / 2, (DW0 + DW1) / 2);                                    // 門楣 + 門上方牆
      for (const z of [DW0, DW1]) mk(new THREE.BoxGeometry(0.16, 2.1, 0.12), bronze, X1, 1.05, z);
      // 窗（東牆，一樓 + 二樓）
      const paneM = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45, emissive: 0x4a6a90, emissiveIntensity: 0.3 });
      for (const [z, y] of [[-6.0, 1.5], [-0.7, 1.5], [-2.4, UY + 1.5], [-5.6, UY + 1.5], [-0.9, UY + 1.5]]) { mk(new THREE.BoxGeometry(0.05, 1.2, 1.4), paneM, X1 + 0.09, y, z, false); mk(new THREE.BoxGeometry(0.06, 1.3, 0.08), bronze, X1 + 0.09, y, z, false); mk(new THREE.BoxGeometry(0.06, 0.08, 1.5), bronze, X1 + 0.09, y, z, false); }
      // 二樓地板（中間留樓梯口）：四塊，頂面 = UY
      const slabM = new THREE.MeshStandardMaterial({ color: 0xdcc7a0, roughness: 0.6, transparent: true });
      const slab = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.22, z1 - z0), slabM); m.position.set((x0 + x1) / 2, UY - 0.11, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; scene.add(m); roofs.push({ m, mat: slabM, grp: "H2" }); };
      slab(X0, STAIR.x0, Z0, Z1); slab(STAIR.x1, X1, Z0, Z1); slab(STAIR.x0, STAIR.x1, STAIR.z1, Z1); slab(STAIR.x0, STAIR.x1, Z0, STAIR.z0);

      // 樓梯：從東（一樓入口）往西爬到二樓；南側有扶手
      { const N = 16, dx = (STAIR.x1 - STAIR.x0) / N, zc = (STAIR.z0 + STAIR.z1) / 2, sw = STAIR.z1 - STAIR.z0 - 0.05;
        for (let i = 0; i < N; i++) { const h = (i + 1) * UY / N, x = STAIR.x1 - (i + 0.5) * dx; mk(new THREE.BoxGeometry(dx, h, sw), wood, x, h / 2, zc); }
        for (let i = 0; i <= N; i += 2) { const x = STAIR.x1 - i * dx, y = i * UY / N; mk(new THREE.BoxGeometry(0.06, 1.0, 0.06), bronze, x, y + 0.5, STAIR.z1 - 0.05, false); }
        const rl = mk(new THREE.BoxGeometry(Math.hypot(STAIR.x1 - STAIR.x0, UY), 0.06, 0.07), bronze, (STAIR.x0 + STAIR.x1) / 2, UY / 2 + 1.0, STAIR.z1 - 0.05, false); rl.rotation.z = Math.atan2(UY, STAIR.x1 - STAIR.x0) * -1 * -1; rl.rotation.z = -Math.atan2(UY, STAIR.x1 - STAIR.x0) * -1; rl.rotation.z = Math.atan2(UY, -(STAIR.x1 - STAIR.x0)) + Math.PI;
        addObs((STAIR.x0 + STAIR.x1) / 2, STAIR.z1 + 0.1, (STAIR.x1 - STAIR.x0) / 2, 0.05);                                       // 南側扶手（兩層都擋）
        addObs(STAIR.x0 - 0.1, zc, 0.1, (STAIR.z1 - STAIR.z0) / 2 + 0.1, 0);                                                    // 一樓：不能從樓梯上端走進去
        addObs(STAIR.x1 + 0.1, zc, 0.1, (STAIR.z1 - STAIR.z0) / 2 + 0.1, 1); }                                                  // 二樓：樓梯口東端是空的

      /* ---- 一樓家具（lv 0）---- */
      const bedF = M(0x7a5a3c, 0.6), white = M(0xf4f1ea, 0.9), teal = M(0x2f8f8a, 0.9), terra = M(0xb4643a, 0.9), navy = M(0x2b3a5a, 0.9), pinkB = M(0x1b2f5e, 0.9), dk = M(0x1a1630, 0.4, 0.4);
      const bed = (bx, bz, wd, blanket, y0 = 0, lv = 0) => {            // 大床：床尾朝東、床頭靠西
        mk(new THREE.BoxGeometry(2.1, 0.3, wd), bedF, bx, y0 + 0.15, bz); mk(new THREE.BoxGeometry(2.0, 0.2, wd - 0.1), white, bx + 0.03, y0 + 0.4, bz); mk(new THREE.BoxGeometry(1.2, 0.07, wd - 0.08), blanket, bx + 0.45, y0 + 0.53, bz);
        mk(new THREE.BoxGeometry(0.1, 0.9, wd + 0.1), bedF, bx - 0.97, y0 + 0.45, bz);
        const np = wd > 1.8 ? 2 : 1; for (let k = 0; k < np; k++) mk(new THREE.BoxGeometry(0.42, 0.12, 0.6), white, bx - 0.75, y0 + 0.56, bz + (np === 2 ? (k ? 0.45 : -0.45) : 0));
        addObs(bx, bz, 1.15, wd / 2 + 0.05, lv, 0.65);
      };
      // （一樓沒有床：床在二樓，兩個人睡同一張雙人床）

      mk(new THREE.BoxGeometry(1.4, 2.2, 0.55), bedF, 4.4, 1.1, Z0 + 0.4); addObs(4.4, Z0 + 0.4, 0.75, 0.32, 0);                       // 衣櫃
      mk(new THREE.BoxGeometry(1.5, 0.05, 0.75), wood, 2.2, 0.75, -3.9); for (const dx of [-0.65, 0.65]) for (const dz of [-0.3, 0.3]) mk(new THREE.BoxGeometry(0.05, 0.75, 0.05), dk, 2.2 + dx, 0.37, -3.9 + dz);
      mk(new THREE.BoxGeometry(0.5, 0.03, 0.34), M(0x2a2550, 0.4, 0.4), 2.2, 0.79, -3.8); { const lt = mk(new THREE.BoxGeometry(0.46, 0.3, 0.02), M(0x101018, 0.4, 0.3), 2.2, 0.95, -4.15); lt.rotation.x = -0.2; }
      mk(new THREE.BoxGeometry(0.5, 0.06, 0.5), terra, 2.2, 0.48, -3.15); mk(new THREE.BoxGeometry(0.5, 0.5, 0.06), terra, 2.2, 0.72, -2.9); addObs(2.2, -3.6, 0.85, 0.75, 0, 0.8);   // 書桌 + 椅
      // 客廳：沙發、茶几、地毯、電視櫃
      mk(new THREE.BoxGeometry(2.4, 0.45, 0.95), terra, 4.6, 0.22, -0.65); mk(new THREE.BoxGeometry(2.4, 0.5, 0.2), terra, 4.6, 0.62, -0.28); for (const sx of [-1.2, 1.2]) mk(new THREE.BoxGeometry(0.16, 0.3, 0.95), terra, 4.6 + sx, 0.4, -0.65); addObs(4.6, -0.6, 1.3, 0.55, 0, 0.85);
      mk(new THREE.BoxGeometry(1.1, 0.04, 0.6), wood, 4.6, 0.38, -2.0); for (const [dx, dz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) mk(new THREE.BoxGeometry(0.04, 0.36, 0.04), dk, 4.6 + dx, 0.18, -2.0 + dz); addObs(4.6, -2.0, 0.6, 0.35, 0, 0.45);
      const rugC = mkCanvas(256, 192), rg = rugC.getContext("2d"); rg.fillStyle = "#2b3a5a"; rg.fillRect(0, 0, 256, 192); rg.strokeStyle = "#e8c98a"; rg.lineWidth = 6; rg.strokeRect(14, 14, 228, 164); rg.lineWidth = 2; rg.strokeRect(30, 30, 196, 132);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), new THREE.MeshStandardMaterial({ map: mkTex(THREE, rugC, aniso), roughness: 1 })); rug.rotation.x = -PI / 2; rug.position.set(5.6, 0.022, -2.3); rug.receiveShadow = true; scene.add(rug);
      mk(new THREE.BoxGeometry(1.8, 0.5, 0.45), bedF, 7.7, 0.25, -0.6); { const tv = mk(new THREE.BoxGeometry(1.5, 0.85, 0.06), M(0x0c0c12, 0.2, 0.4), 7.7, 1.2, -0.55); } addObs(7.7, -0.6, 0.95, 0.3, 0, 0.5);
      // 廚房 / 餐廳（東半邊）
      mk(new THREE.BoxGeometry(3.0, 0.9, 0.7), M(0xe8e4dc, 0.6), 10.1, 0.45, Z1 - 0.45); mk(new THREE.BoxGeometry(3.1, 0.05, 0.75), M(0x5a5560, 0.4, 0.2), 10.1, 0.93, Z1 - 0.45); addObs(10.1, Z1 - 0.45, 1.55, 0.4, 0);
      mk(new THREE.BoxGeometry(0.9, 2.0, 0.75), M(0xdadde4, 0.4, 0.5), 11.45, 1.0, Z1 - 0.5); addObs(11.45, Z1 - 0.5, 0.5, 0.42, 0);   // 冰箱
      mk(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 20), wood, 8.6, 0.74, -3.5); mk(new THREE.CylinderGeometry(0.07, 0.1, 0.72, 10), dk, 8.6, 0.37, -3.5); addObs(8.6, -3.5, 0.8, 0.8, 0, 0.8);
      for (const [dx, dz] of [[-1.0, 0], [1.0, 0], [0, -1.0], [0, 1.0]]) { mk(new THREE.BoxGeometry(0.42, 0.06, 0.42), terra, 8.6 + dx, 0.46, -3.5 + dz); mk(new THREE.BoxGeometry(0.4, 0.36, 0.05), terra, 8.6 + dx * 1.12, 0.66, -3.5 + dz * 1.12); }
      // 餐桌上的早餐（桌面高度 0.77）：兩人份的盤子、荷包蛋、吐司、杯子，中間是麵包籃、果汁、水果
      { const T = 8.6, TZ = -3.5, ty = 0.78, pl = M(0xfafafa, 0.35), egg = M(0xfffdf5, 0.5), yolk = M(0xffc21a, 0.4), toast = M(0xd9a35a, 0.8), cup = M(0xf1ece2, 0.4), coffee = M(0x4a2a18, 0.3), juice = new THREE.MeshStandardMaterial({ color: 0xff9a2e, roughness: 0.15, transparent: true, opacity: 0.85 }), bread = M(0xc98d4a, 0.85), glassM = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.4 });
        for (const [sx, sz, face] of [[-0.5, 0, 0], [0.5, 0, Math.PI]]) {   // 兩個座位：西側、東側
          const bx = T + sx * 1.0, bz = TZ + sz;
          mk(new THREE.CylinderGeometry(0.17, 0.15, 0.02, 20), pl, bx, ty + 0.01, bz, false);
          const e = mk(new THREE.SphereGeometry(0.07, 14, 8), egg, bx - 0.03, ty + 0.03, bz + 0.03, false); e.scale.set(1.3, 0.28, 1.1); mk(new THREE.SphereGeometry(0.03, 10, 8), yolk, bx - 0.03, ty + 0.045, bz + 0.03, false);
          for (const dz of [-0.07, 0.01]) { const t = mk(new THREE.BoxGeometry(0.1, 0.018, 0.1), toast, bx + 0.07, ty + 0.03 + (dz > 0 ? 0.018 : 0), bz + dz - 0.05, false); t.rotation.y = 0.2; }
          mk(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 14), cup, bx + (sx < 0 ? -0.1 : 0.1), ty + 0.04, bz - 0.26, false); mk(new THREE.CylinderGeometry(0.037, 0.037, 0.004, 14), coffee, bx + (sx < 0 ? -0.1 : 0.1), ty + 0.072, bz - 0.26, false);   // 咖啡
          mk(new THREE.BoxGeometry(0.012, 0.004, 0.16), M(0xcfd3dc, 0.3, 0.8), bx + (sx < 0 ? -0.2 : 0.2), ty + 0.005, bz, false);   // 刀叉
        }
        const bk = mk(new THREE.CylinderGeometry(0.15, 0.11, 0.07, 18), M(0x9a6b3c, 0.8), T, ty + 0.035, TZ + 0.2, false); for (let k = 0; k < 4; k++) { const b = mk(new THREE.SphereGeometry(0.06, 10, 8), bread, T - 0.07 + (k % 2) * 0.12, ty + 0.1, TZ + 0.15 + (k > 1 ? 0.1 : 0), false); b.scale.set(1.4, 0.8, 0.9); }   // 麵包籃
        mk(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 14), juice, T + 0.18, ty + 0.1, TZ - 0.12, false); mk(new THREE.CylinderGeometry(0.058, 0.058, 0.01, 14), glassM, T + 0.18, ty + 0.205, TZ - 0.12, false);                // 果汁
        mk(new THREE.CylinderGeometry(0.13, 0.08, 0.06, 18), M(0xe8e4dc, 0.5), T - 0.1, ty + 0.03, TZ - 0.18, false); for (const [dx, dz, c] of [[-0.05, -0.02, 0xe23b3b], [0.04, 0.0, 0xff8a1f], [0.0, 0.05, 0xe23b3b], [-0.03, 0.06, 0xf2c14e]]) mk(new THREE.SphereGeometry(0.045, 10, 8), M(c, 0.55), T - 0.1 + dx, ty + 0.085, TZ - 0.18 + dz, false);   // 水果盤
      }
      mk(new THREE.BoxGeometry(0.4, 2.2, 1.8), bedF, X0 + 0.35, 1.1, -1.4); addObs(X0 + 0.35, -1.4, 0.25, 0.95, 0);                          // 書櫃（西牆；樓梯入口前面要留空）
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) mk(new THREE.BoxGeometry(0.1, 0.4, 0.26), M(new THREE.Color().setHSL((k * 0.13 + r * 0.2) % 1, 0.32, 0.42), 0.8), X0 + 0.6, 0.4 + r * 0.5, -2.1 + k * 0.3, false);
      mk(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), dk, 6.9, 0.8, -4.9); mk(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 1.6 }), 6.9, 1.7, -4.9, false);
      { const pg = new THREE.Group(); mk(new THREE.CylinderGeometry(0.26, 0.19, 0.4, 14), M(0xff9b78, 0.7), 1.6, 0.2, -0.1); for (let k = 0; k < 8; k++) { const a = k * 2.4; mk(new THREE.SphereGeometry(0.19, 10, 8), M(0x3f9a6a, 0.85), 1.6 + Math.cos(a) * 0.12, 0.55 + k * 0.07, -0.1 + Math.sin(a) * 0.12, false); } }

      /* ---- 二樓：Aeris 的房間（lv 1）---- */
      const U = (geo, mat, x, y, z, cast = true) => mk(geo, mat, x, UY + y, z, cast);
      bed(1.75, -3.6, 1.98, pinkB, UY, 1);                                                                                             // 二樓雙人床（兩個人一起睡）
      for (const [bz2, lc] of [[-5.1, 0xffe9b8], [-2.1, 0xffd8e8]]) { U(new THREE.BoxGeometry(0.5, 0.5, 0.45), bedF, 0.95, 0.25, bz2); U(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: lc, emissive: lc, emissiveIntensity: 1.3 }), 0.95, 0.62, bz2, false); }   // 兩邊床頭櫃 + 小燈
      U(new THREE.BoxGeometry(1.4, 2.2, 0.55), bedF, 4.6, 1.1, Z0 + 0.4); addObs(4.6, Z0 + 0.4, 0.75, 0.32, 1);                         // 衣櫃
      U(new THREE.BoxGeometry(1.5, 0.05, 0.6), M(0xf4e4ec, 0.5), 3.4, 0.74, -0.9); for (const dx of [-0.65, 0.65]) U(new THREE.BoxGeometry(0.05, 0.74, 0.05), dk, 3.4 + dx, 0.37, -0.9);
      U(new THREE.BoxGeometry(0.9, 1.1, 0.04), M(0xdfe8f4, 0.1, 0.8), 3.4, 1.35, -1.15); U(new THREE.BoxGeometry(0.4, 0.4, 0.4), M(0xe9a9c0, 0.8), 3.4, 0.22, -0.4); addObs(3.4, -0.75, 0.85, 0.45, 1, 0.8);     // 梳妝台 + 鏡子 + 小凳
      U(new THREE.BoxGeometry(0.4, 2.2, 1.8), bedF, X1 - 0.3, 1.1, -3.4); addObs(X1 - 0.3, -3.4, 0.25, 0.95, 1);                       // 書櫃
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) U(new THREE.BoxGeometry(0.1, 0.4, 0.26), M(new THREE.Color().setHSL((k * 0.11 + r * 0.17 + 0.5) % 1, 0.35, 0.5), 0.8), X1 - 0.55, 0.4 + r * 0.5, -4.1 + k * 0.3, false);
      const rugP = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshStandardMaterial({ color: 0xf2c4d4, roughness: 1 })); rugP.rotation.x = -PI / 2; rugP.position.set(6.3, UY + 0.012, -2.4); rugP.receiveShadow = true; scene.add(rugP);
      U(new THREE.CylinderGeometry(0.26, 0.19, 0.4, 14), M(0xffffff, 0.7), 11.2, 0.2, -0.7); for (let k = 0; k < 7; k++) { const a = k * 2.2; U(new THREE.SphereGeometry(0.18, 10, 8), M(0x4fae7a, 0.85), 11.2 + Math.cos(a) * 0.12, 0.55 + k * 0.07, -0.7 + Math.sin(a) * 0.12, false); }
      U(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), dk, 9.6, 0.8, -0.6); U(new THREE.SphereGeometry(0.16, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffe0ec, emissive: 0xffa8c8, emissiveIntensity: 1.6 }), 9.6, 1.7, -0.6, false);
      U(new THREE.SphereGeometry(0.35, 14, 10), M(0xf7e0c8, 0.9), 5.6, 0.35, -4.6); U(new THREE.SphereGeometry(0.22, 12, 9), M(0xf7e0c8, 0.9), 5.6, 0.8, -4.6);    // 玩偶

      // 毛毛蟲沙發：圍著圓地毯東側的一整條弧形沙發 —— 8 節毛茸茸的綠色身體（每一節都能坐）+ 笑笑的頭（眼睛、腮紅、觸角）
      { const fc = mkCanvas(128, 128), fg = fc.getContext("2d"); fg.fillStyle = "#808080"; fg.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 1100; i++) { const x = Math.random() * 128, y = Math.random() * 128, l = 3 + Math.random() * 5, a = Math.random() * 6.28; fg.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.35)"; fg.lineWidth = 1.2; fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); fg.stroke(); }
        const furT = mkTex(THREE, fc, aniso); furT.wrapS = furT.wrapT = THREE.RepeatWrapping; furT.repeat.set(2, 2);
        const fur = (h, l = 0.4) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(h, 0.6, l), roughness: 1, bumpMap: furT, bumpScale: 1.6 });
        const SC = { x: 6.3, z: -2.4, R: 2.0 }, N = 8, TH0 = -60, STEP = 17, d2r = PI / 180;
        for (let i = 0; i < N; i++) {
          const th = (TH0 + i * STEP) * d2r, c = Math.cos(th), sn = Math.sin(th), phi = -(th + PI / 2), m = fur(0.36 - i * 0.014, 0.4 + (i % 2) * 0.05), k = i === N - 1 ? 0.82 : 1;
          const seat = U(new THREE.SphereGeometry(1, 18, 14), m, SC.x + SC.R * c, 0.3, SC.z + SC.R * sn); seat.scale.set(0.46 * k, 0.34 * k, 0.52 * k); seat.rotation.y = phi;                         // 坐墊
          const back = U(new THREE.SphereGeometry(1, 18, 14), m, SC.x + (SC.R + 0.3) * c, 0.62, SC.z + (SC.R + 0.3) * sn); back.scale.set(0.46 * k, 0.5 * k, 0.28 * k); back.rotation.y = phi;         // 靠背（朝外）
          addObs(SC.x + (SC.R + 0.12) * c, SC.z + (SC.R + 0.12) * sn, 0.4, 0.4, 1, 0.62);
          chairSpots.push({ x: SC.x + (SC.R - 0.05) * c, z: SC.z + (SC.R - 0.05) * sn, face: Math.atan2(-c, -sn), front: { x: SC.x + (SC.R - 1.0) * c, z: SC.z + (SC.R - 1.0) * sn }, sofa: true });   // 坐墊位置、面向地毯、起身時站的位置
        }
        // 頭：接在第一節前面（朝向北邊樓梯方向）
        const th = TH0 * d2r, c = Math.cos(th), sn = Math.sin(th), fx = sn, fz = -c, hx = SC.x + SC.R * c + fx * 0.62, hz = SC.z + SC.R * sn + fz * 0.62;
        const hd = new THREE.Group(); hd.position.set(hx, UY, hz); hd.rotation.y = Math.atan2(-fz, fx); scene.add(hd);
        const part = (geo, mat, x, y, z, sc) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); if (sc) q.scale.set(sc[0], sc[1], sc[2]); q.castShadow = true; hd.add(q); return q; };
        const white = M(0xffffff, 0.4), black = M(0x16121e, 0.3), pinkC = M(0xff9bb5, 0.8), headM = fur(0.27, 0.5);
        part(new THREE.SphereGeometry(1, 20, 16), headM, 0, 0.6, 0, [0.55, 0.52, 0.56]);
        for (const sz of [-1, 1]) {
          part(new THREE.SphereGeometry(0.13, 12, 10), white, 0.44, 0.78, sz * 0.2); part(new THREE.SphereGeometry(0.065, 10, 8), black, 0.55, 0.78, sz * 0.2);   // 眼睛
          part(new THREE.SphereGeometry(0.09, 10, 8), pinkC, 0.42, 0.56, sz * 0.36, [0.5, 1, 1]);                                                                // 腮紅
          const an = part(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), black, 0.02, 1.2, sz * 0.22); an.rotation.x = -sz * 0.3; part(new THREE.SphereGeometry(0.08, 10, 8), pinkC, 0.02, 1.43, sz * 0.3);   // 觸角
        }
        part(new THREE.TorusGeometry(0.11, 0.022, 6, 14, PI), black, 0.52, 0.55, 0).rotation.set(0, PI / 2, PI);                                                // 微笑
        addObs(hx, hz, 0.5, 0.5, 1, 0.9);
      }

      // 二樓牆上的海報：朴燦烈 Park Chanyeol（程式畫的舞台風格海報，用剪影與燈光，不是本人照片；之後可以換成你自己的圖）
      { const NAME = "朴燦烈";
        const drawPoster = (g, w, h, st) => {
          const lg = (c0, c1, c2) => { const q = g.createLinearGradient(0, 0, w, h); q.addColorStop(0, c0); q.addColorStop(0.55, c1); q.addColorStop(1, c2); g.fillStyle = q; g.fillRect(0, 0, w, h); };
          const stars = (n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,255,${a * Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 2, 2); } };
          const person = (cx, base, sc, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, base - 270 * sc, 30 * sc, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - 52 * sc, base - 225 * sc); g.quadraticCurveTo(cx, base - 250 * sc, cx + 52 * sc, base - 225 * sc); g.lineTo(cx + 40 * sc, base - 100 * sc); g.lineTo(cx + 30 * sc, base); g.lineTo(cx + 8 * sc, base); g.lineTo(cx, base - 95 * sc); g.lineTo(cx - 8 * sc, base); g.lineTo(cx - 30 * sc, base); g.lineTo(cx - 40 * sc, base - 100 * sc); g.closePath(); g.fill(); };
          const beam = (x0, col) => { const q = g.createLinearGradient(x0, 0, x0, h * 0.9); q.addColorStop(0, col); q.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = q; g.beginPath(); g.moveTo(x0 - 6, 0); g.lineTo(x0 + 6, 0); g.lineTo(x0 + 120, h * 0.9); g.lineTo(x0 - 120, h * 0.9); g.fill(); };
          g.textAlign = "center";
          if (st === 0) { lg("#0b0a1f", "#2a1055", "#0b0a1f"); stars(120, 0.9); beam(w * 0.3, "rgba(120,200,255,.5)"); beam(w * 0.7, "rgba(255,120,200,.5)"); person(w / 2, h * 0.86, 1.25, "#05050c"); g.fillStyle = "#fff"; g.font = "800 120px 'Noto Sans TC', sans-serif"; g.fillText(NAME, w / 2, h * 0.16); g.fillStyle = "#9fd8ff"; g.font = "600 34px 'Noto Sans TC', sans-serif"; g.fillText("S T A G E", w / 2, h * 0.22); }
          else if (st === 1) { lg("#ff9a5c", "#ff4f7a", "#3b1a6a"); g.fillStyle = "rgba(255,240,200,.95)"; g.beginPath(); g.arc(w / 2, h * 0.45, 130, 0, 7); g.fill(); g.fillStyle = "#1a0f33"; for (let i = 0; i < 9; i++) { const bw = 40 + Math.random() * 50, bh = 90 + Math.random() * 200; g.fillRect(i * 58, h - bh, bw, bh); } person(w / 2, h * 0.9, 1.15, "#0a0618"); g.fillStyle = "#fff"; g.font = "800 112px 'Noto Sans TC', sans-serif"; g.fillText(NAME, w / 2, h * 0.14); }
          else if (st === 2) { g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, w, h); g.fillStyle = "#111"; g.beginPath(); g.arc(w / 2, h * 0.55, 190, 0, 7); g.fill(); g.fillStyle = "#e23b3b"; g.fillRect(0, h * 0.78, w, 16); person(w / 2, h * 0.92, 1.3, "#f4f1ea"); g.fillStyle = "#111"; g.font = "800 126px 'Noto Sans TC', sans-serif"; g.fillText(NAME, w / 2, h * 0.17); g.font = "600 30px 'Noto Sans TC', sans-serif"; g.fillText("E N C O R E", w / 2, h * 0.23); }
          else if (st === 3) { lg("#031b34", "#0a4a73", "#02101f"); stars(200, 1); for (let i = 0; i < 5; i++) { g.strokeStyle = `rgba(120,220,255,${0.15 + i * 0.07})`; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h * 0.62, 70 + i * 55, Math.PI, 0); g.stroke(); } person(w / 2, h * 0.9, 1.2, "#020a14"); g.fillStyle = "#cfefff"; g.font = "800 118px 'Noto Sans TC', sans-serif"; g.fillText(NAME, w / 2, h * 0.15); }
          else { lg("#22082f", "#7a1f6a", "#ff7a59"); for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`; g.beginPath(); g.moveTo(w / 2, h * 0.6); const a = i * 0.45; g.lineTo(w / 2 + Math.cos(a) * 700, h * 0.6 + Math.sin(a) * 700); g.lineTo(w / 2 + Math.cos(a + 0.18) * 700, h * 0.6 + Math.sin(a + 0.18) * 700); g.fill(); } person(w / 2, h * 0.92, 1.3, "#12041a"); g.fillStyle = "#ffe9a8"; g.font = "800 122px 'Noto Sans TC', sans-serif"; g.fillText(NAME, w / 2, h * 0.16); g.fillStyle = "#fff"; g.font = "600 30px 'Noto Sans TC', sans-serif"; g.fillText("L I V E", w / 2, h * 0.225); }
        };
        const drawPoster2 = (g, w, h, st) => { drawPoster(g, w, h, st); g.textAlign = "center"; g.fillStyle = st === 2 ? "rgba(0,0,0,.55)" : "rgba(255,255,255,.7)"; g.font = "600 30px 'Noto Sans TC', sans-serif"; g.fillText("P A R K   C H A N Y E O L", w / 2, h - 28); };
        const frameM = M(0xf4f1ea, 0.5);
        let posterN = 0;
        const PHOTOS = (window.SITE && window.SITE.posterPhotos) || [];   // 要放真正的照片：把圖片放進 img/posters/，並把檔名依序寫進 data/projects.js 的 SITE.posterPhotos
        const poster = (x, y, z, ry, st, pw = 0.9, ph = 1.35) => {
          const tex = mkTex(THREE, decalCanvas(512, 768, (g, w, h) => drawPoster2(g, w, h, st)), aniso); const photo = pw >= 0.6 && posterN < PHOTOS.length ? PHOTOS[posterN++] : null;   // 每張大海報用不同的照片（小的那張保留程式畫的風格）
          const grp = new THREE.Group(); grp.position.set(x, UY + y, z); grp.rotation.y = ry; scene.add(grp);
          const fr = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.08, ph + 0.08, 0.03), frameM); fr.castShadow = false; grp.add(fr);
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.18 })); pl.position.z = 0.02; grp.add(pl);
          if (photo) new THREE.TextureLoader().load("img/posters/" + photo, (t) => {      // 有照片就換上去（裁成海報比例、填滿）
            if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
            const pa = pw / ph, ia = t.image.width / t.image.height; if (ia > pa) { t.repeat.x = pa / ia; t.offset.x = (1 - t.repeat.x) / 2; } else { t.repeat.y = ia / pa; t.offset.y = (1 - t.repeat.y) / 2; }
            pl.material.map = t; pl.material.emissiveMap = t; pl.material.needsUpdate = true;
          });
        };
        const NZ = Z0 + 0.08, EX = X1 - 0.08;
        poster(1.3, 1.55, NZ, 0, 0); poster(2.45, 1.55, NZ, 0, 1); poster(2.0, 0.55, NZ, 0, 3, 0.5, 0.75);                         // 北牆（床頭那側）
        poster(7.2, 1.5, NZ, 0, 2); poster(8.4, 1.5, NZ, 0, 4); poster(9.6, 1.5, NZ, 0, 0); poster(10.8, 1.5, NZ, 0, 3);          // 北牆（樓梯口上方，從上往下看最明顯）
        if (PHOTOS.length) {   // CC BY 4.0 要求標註作者與授權：在海報牆下方放一塊說明牌
          const cr = mkTex(THREE, decalCanvas(1024, 120, (g, w, h) => { g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, w, h); g.strokeStyle = "#2a2218"; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = "#2a2218"; g.textAlign = "center"; g.font = "600 34px 'Noto Sans TC', sans-serif"; g.fillText("Photos: ggbye1127 · OXO · SHAQ Photo — CC BY 4.0 — via Wikimedia Commons (resized)", w / 2, 50); g.font = "500 28px 'Noto Sans TC', sans-serif"; g.fillText("海報照片：ggbye1127、OXO、SHAQ Photo（CC BY 4.0，來源 Wikimedia Commons，已縮小尺寸）", w / 2, 92); }), aniso);
          const cp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.4), new THREE.MeshStandardMaterial({ map: cr, roughness: 0.7 })); cp.position.set(9.0, UY + 0.5, NZ + 0.01); scene.add(cp);
        }
        poster(EX, 1.5, -7.2, -Math.PI / 2, 1);                                                                                      // 東牆
      }

      // 門口地墊與信箱
      const homeT = mkTex(THREE, decalCanvas(512, 200, (c, w, h) => { c.fillStyle = "#6a4a2e"; c.fillRect(0, 0, w, h); c.strokeStyle = "#e8c98a"; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); c.textAlign = "center"; c.fillStyle = "#e8c98a"; c.font = "800 78px Georgia, serif"; c.fillText("HOME", w / 2, 118); c.font = "500 34px 'Noto Sans TC', sans-serif"; c.fillText("David & ARIES", w / 2, 168); }), aniso);
      const mat0 = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), new THREE.MeshStandardMaterial({ map: homeT, roughness: 1 })); mat0.rotation.x = -PI / 2; mat0.rotation.z = PI / 2; mat0.position.set(X1 + 0.9, 0.04, (DW0 + DW1) / 2); scene.add(mat0);
      mk(new THREE.BoxGeometry(0.06, 1.0, 0.06), M(0x5a4028, 0.8), X1 + 1.5, 0.5, -0.9); mk(new THREE.BoxGeometry(0.38, 0.22, 0.24), M(0xc0392b, 0.6), X1 + 1.5, 1.1, -0.9); addObs(X1 + 1.5, -0.9, 0.2, 0.2);

      // ===== 公園（房子外面，一路到美術館入口）=====
      const tree = (x, z, s = 1) => {
        mk(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 1.6 * s, 8), M(0x6a4a2e, 0.9), x, 0.8 * s, z);
        [[0, 2.1, 0, 0.95, 0x2f6a34], [0.45, 1.7, 0.25, 0.7, 0x3a7a3c], [-0.4, 1.8, -0.2, 0.75, 0x285c2e]].forEach(([dx, dy, dz, r, col]) => mk(new THREE.SphereGeometry(r * s, 14, 10), M(col, 0.9), x + dx * s, dy * s, z + dz * s));
        addObs(x, z, 0.2 * s, 0.2 * s);
      };
      [[13.6, 3.0, 1.1], [16.4, -5.2, 1.0], [24.2, 3.6, 1.15], [24.6, -6.6, 0.95], [3.6, 7.0, 1.2], [8.4, 3.4, 1.0], [10.2, 5.8, 0.9], [22.0, 6.4, 1.0], [13.0, -6.6, 1.1], [19.8, -2.2, 0.0001]].forEach(([x, z, s]) => { if (s > 0.01) tree(x, z, s); });
      const bush = (x, z, r = 0.45) => { mk(new THREE.SphereGeometry(r, 12, 9), M(0x2f6a34, 0.95), x, r * 0.8, z); };
      [[12.6, 1.4], [14.8, 1.8], [17.6, 2.2], [23.0, 1.2], [6.0, 2.6], [5.0, 3.2], [12.6, 6.8], [25.0, -3.0], [14.2, -7.2]].forEach(([x, z]) => bush(x, z, 0.5));
      const flowers = (x, z, w, d) => { mk(new THREE.BoxGeometry(w, 0.18, d), M(0x4a3524, 1), x, 0.09, z, false); for (let k = 0; k < 18; k++) mk(new THREE.SphereGeometry(0.075, 8, 6), M([0xff6b8a, 0xffd25a, 0xfff1f4, 0xb48cff][k % 4], 0.7), x + (rnd() - 0.5) * (w - 0.2), 0.26, z + (rnd() - 0.5) * (d - 0.2), false); };
      flowers(15.6, 1.9, 2.6, 0.9); flowers(21.0, 1.9, 2.4, 0.9); flowers(7.0, 5.0, 2.8, 1.0);
      const bench = (x, z, rot = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.5), wood); b.position.y = 0.45; b.castShadow = true; g.add(b); const bk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.05), wood); bk.position.set(0, 0.75, -0.22); g.add(bk); for (const dx of [-0.75, 0.75]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), dk); l.position.set(dx, 0.22, 0); g.add(l); } addObs(x, z, rot ? 0.35 : 1.0, rot ? 1.0 : 0.35, undefined, 0.55); };
      bench(14.4, 1.2); bench(20.8, 2.8); bench(14.0, 6.9); bench(23.4, 2.2);
      { // 路燈只放在走道（石板小徑）兩側，左右交錯、約每 4.6 公尺一盞，不亂放
        const lamp = (x, z) => { mk(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 8), M(0x15121f, 0.5, 0.5), x, 1.15, z); mk(new THREE.BoxGeometry(0.34, 0.05, 0.34), M(0x15121f, 0.5, 0.5), x, 2.32, z, false); const lm = lampMat.clone(); mk(new THREE.SphereGeometry(0.15, 14, 10), lm, x, 2.22, z, false); lampPts.push({ x, y: 2.22, z, mat: lm }); };
        let acc = 2.2, side = 1;
        for (let k = 0; k < pathPts.length - 1; k++) { const [ax, az] = pathPts[k], [bx, bz] = pathPts[k + 1], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
          while (acc < len) { lamp(ax + ux * acc - uz * 1.6 * side, az + uz * acc + ux * 1.6 * side); side = -side; acc += 4.6; } acc -= len; }
        lamp(4.4, 5.6); lamp(-1.6, 5.6);   // 通往船尾的小徑
      }
      // 池塘（有睡蓮與石頭）
      { const PX = 19.0, PZ = 5.2, pr = 3.0, ps = 0.78;
        const pw = new THREE.Mesh(new THREE.CircleGeometry(pr, 40), new THREE.MeshStandardMaterial({ color: 0x3a8fc0, roughness: 0.05, metalness: 0.3, emissive: 0x12405e, emissiveIntensity: 0.35 })); pw.rotation.x = -PI / 2; pw.scale.set(1, ps, 1); pw.position.set(PX, 0.03, PZ); scene.add(pw);
        for (let k = 0; k < 26; k++) { const a = (k / 26) * PI * 2, r2 = mk(new THREE.SphereGeometry(0.3 + rnd() * 0.12, 8, 6), M([0x8e887a, 0x9a9486, 0x827c70][k % 3], 0.9), PX + Math.cos(a) * (pr + 0.1), 0.15, PZ + Math.sin(a) * (pr * ps + 0.1)); r2.scale.set(1.1, 0.6, 1.1); }
        for (const [dx, dz] of [[-0.8, 0.2], [0.9, -0.4], [0.2, 0.9], [-1.4, -0.7]]) { const lp = mk(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 14), M(0x3f9a5a, 0.8), PX + dx, 0.045, PZ + dz, false); mk(new THREE.SphereGeometry(0.08, 8, 6), M(0xffa8c8, 0.6), PX + dx + 0.05, 0.08, PZ + dz, false); }
        addObs(PX, PZ, pr * 0.92, pr * ps * 0.92, undefined, 0.3); }
      // 噴水廣場
      { const FX = 22.6, FZ = -4.6; mk(new THREE.CylinderGeometry(2.3, 2.3, 0.03, 32), M(0xb9b4a8, 0.9), FX, 0.04, FZ, false); mk(new THREE.CylinderGeometry(1.3, 1.4, 0.45, 24), M(0xcfcac0, 0.8), FX, 0.225, FZ); mk(new THREE.CylinderGeometry(1.15, 1.15, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x4aa0d0, roughness: 0.05, metalness: 0.3 }), FX, 0.44, FZ, false);
        mk(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 10), M(0xcfcac0, 0.8), FX, 0.95, FZ); mk(new THREE.CylinderGeometry(0.55, 0.3, 0.12, 16), M(0xcfcac0, 0.8), FX, 1.5, FZ); mk(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0x6ab0e0, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }), FX, 1.7, FZ, false); addObs(FX, FZ, 1.4, 1.4, undefined, 0.5); }
      // 兒童遊戲區：鞦韆、溜滑梯、沙坑
      { const sx = 15.2, sz = -6.2, fr = M(0xd8352a, 0.5, 0.2);
        for (const dx of [-1.6, 1.6]) { const a = mk(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), fr, sx + dx, 1.25, sz - 0.5); a.rotation.x = 0.2; const b = mk(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), fr, sx + dx, 1.25, sz + 0.5); b.rotation.x = -0.2; }
        mk(new THREE.CylinderGeometry(0.05, 0.05, 3.5, 8), fr, sx, 2.45, sz).rotation.z = PI / 2;
        for (const dx of [-0.6, 0.6]) { mk(new THREE.BoxGeometry(0.02, 1.9, 0.02), dk, sx + dx - 0.2, 1.5, sz, false); mk(new THREE.BoxGeometry(0.02, 1.9, 0.02), dk, sx + dx + 0.2, 1.5, sz, false); mk(new THREE.BoxGeometry(0.5, 0.05, 0.28), M(0x2f6a9a, 0.7), sx + dx, 0.52, sz); }
        addObs(sx, sz, 1.8, 0.7);
        const lx = 18.4; mk(new THREE.BoxGeometry(0.1, 1.9, 0.9), M(0x2f6a9a, 0.5), lx - 0.7, 0.95, sz - 0.3); mk(new THREE.BoxGeometry(0.6, 0.08, 0.7), M(0xf2c14e, 0.6), lx - 0.7, 1.9, sz - 0.3); const sl = mk(new THREE.BoxGeometry(2.4, 0.06, 0.7), M(0xe8b030, 0.35, 0.3), lx + 0.45, 1.0, sz - 0.3); sl.rotation.z = -0.62; addObs(lx + 0.2, sz - 0.3, 1.5, 0.55);
        const sd = mk(new THREE.BoxGeometry(2.4, 0.2, 2.0), M(0xe8d29a, 1), 21.0, 0.1, -6.2); addObs(21.0, -6.2, 1.25, 1.05, undefined, 0.25); for (const [dx, dz] of [[-1.25, 0], [1.25, 0]]) mk(new THREE.BoxGeometry(0.1, 0.3, 2.1), wood, 21.0 + dx, 0.15, -6.2 + dz * 0); }
      // 涼亭
      { const GX = 14.0, GZ = 4.6; for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) mk(new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8), M(0xf2ece0, 0.6), GX + dx, 1.25, GZ + dz);
        mk(new THREE.CylinderGeometry(0.1, 2.2, 0.9, 6), M(0xa3492f, 0.7), GX, 2.95, GZ); mk(new THREE.BoxGeometry(2.8, 0.1, 2.8), M(0xd9c9a8, 0.8), GX, 0.06, GZ, false); addObs(GX, GZ, 1.2, 1.2); }
      // 路標：往美術館
      const signT = mkTex(THREE, decalCanvas(512, 160, (c, w, h) => { c.fillStyle = "#3a2e24"; c.fillRect(0, 0, w, h); c.strokeStyle = "#e8c98a"; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.textAlign = "center"; c.fillStyle = "#e8c98a"; c.font = "800 52px Georgia, serif"; c.fillText("Gallery  →", w / 2, 78); c.font = "500 34px 'Noto Sans TC', sans-serif"; c.fillText("美術館 往這走", w / 2, 128); }), aniso);
      mk(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), M(0x5a4028, 0.8), 14.2, 0.85, -3.3);
      { const sb = mk(new THREE.BoxGeometry(1.3, 0.42, 0.06), M(0x3a2e24, 0.6), 14.2, 1.55, -3.3); sb.rotation.y = -PI / 2; const sf = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.38), new THREE.MeshStandardMaterial({ map: signT, roughness: 0.7 })); sf.position.set(14.2 - 0.035, 1.55, -3.3); sf.rotation.y = -PI / 2; scene.add(sf); }
      addObs(14.2, -3.3, 0.15, 0.15);
      // 通往船尾（泳池 / 後甲板）：石板小徑 + 路標
      { const st = [0x8e887a, 0x9a9486, 0x827c70, 0xa39d8f]; for (let k = 0; k < 11; k++) { const tile = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 1.5), M(st[k % 4], 0.9)); tile.position.set(5.8 - k * 0.8, 0.028, 4.0 + Math.sin(k * 0.7) * 0.12); tile.receiveShadow = true; scene.add(tile); }
        const poolT = mkTex(THREE, decalCanvas(512, 160, (c, w, h) => { c.fillStyle = "#1d5a7a"; c.fillRect(0, 0, w, h); c.strokeStyle = "#bfe8ff"; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12); c.textAlign = "center"; c.fillStyle = "#e8f6ff"; c.font = "800 50px Georgia, serif"; c.fillText("←  Pool Deck", w / 2, 78); c.font = "500 34px 'Noto Sans TC', sans-serif"; c.fillText("泳池 · 後甲板 往這走", w / 2, 128); }), aniso);
        mk(new THREE.CylinderGeometry(0.05, 0.06, 1.7, 8), M(0x5a4028, 0.8), 3.4, 0.85, 2.3);
        const sb2 = mk(new THREE.BoxGeometry(1.5, 0.46, 0.06), M(0x1d5a7a, 0.6), 3.4, 1.55, 2.3); sb2.rotation.y = PI / 2; const sf2 = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.42), new THREE.MeshStandardMaterial({ map: poolT, roughness: 0.7 })); sf2.position.set(3.4 + 0.035, 1.55, 2.3); sf2.rotation.y = PI / 2; scene.add(sf2); addObs(3.4, 2.3, 0.15, 0.15); }

      // ===== 美術館門面（入口）=====
      const FW = 0.5, GZ = 1.9;
      shellBox(FW, 4.2, DECK_HD - GZ + 0.2, ENTRY, -(DECK_HD + GZ) / 2, plasterH, "M", 0.45); addObs(ENTRY, -(DECK_HD + GZ) / 2, FW / 2 + 0.05, (DECK_HD - GZ) / 2 + 0.1);
      shellBox(FW, 4.2, DECK_HD - GZ + 0.2, ENTRY, (DECK_HD + GZ) / 2, plasterH, "M", 0.45); addObs(ENTRY, (DECK_HD + GZ) / 2, FW / 2 + 0.05, (DECK_HD - GZ) / 2 + 0.1);
      mk(new THREE.BoxGeometry(FW, 1.3, GZ * 2 + 0.2), plasterH, ENTRY, 3.55, 0);
      for (const z of [-GZ, GZ]) { mk(new THREE.CylinderGeometry(0.2, 0.2, 3.0, 16), bronze, ENTRY - 0.05, 1.5, z); mk(new THREE.BoxGeometry(0.62, 0.12, 0.62), bronze, ENTRY - 0.05, 3.05, z); }
      const facT = mkTex(THREE, decalCanvas(2048, 400, (c, w, h) => {
        c.fillStyle = "#2a2230"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a35c"; c.lineWidth = 8; c.strokeRect(12, 12, w - 24, h - 24);
        c.textAlign = "center"; c.fillStyle = "#e8c98a"; c.font = "800 168px Georgia, serif"; if ("letterSpacing" in c) c.letterSpacing = "14px"; c.fillText("DAVID'S GALLERY", w / 2, 210); if ("letterSpacing" in c) c.letterSpacing = "6px";
        c.fillStyle = "rgba(255,255,255,.8)"; c.font = "500 58px 'Noto Sans TC', sans-serif"; c.fillText("美術館　·　把夢想變成 Real", w / 2, 320);
      }), aniso);
      const facSign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.76), new THREE.MeshStandardMaterial({ map: facT, roughness: 0.6, metalness: 0.2, emissive: 0xffffff, emissiveMap: facT, emissiveIntensity: 0.12 }));
      facSign.position.set(ENTRY - FW / 2 - 0.02, 3.3, 0); facSign.rotation.y = -PI / 2; scene.add(facSign);
      const welT = mkTex(THREE, decalCanvas(1024, 300, (c, w, h) => { c.textAlign = "center"; c.fillStyle = "#3a2e24"; c.font = "800 120px Georgia, serif"; if ("letterSpacing" in c) c.letterSpacing = "10px"; c.fillText("WELCOME", w / 2, 130); c.fillStyle = "rgba(58,46,36,.75)"; c.font = "500 54px 'Noto Sans TC', sans-serif"; c.fillText("歡迎光臨　→", w / 2, 220); }), aniso);
      const wel = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.88), decalMat(welT, 0.95)); wel.rotation.x = -PI / 2; wel.position.set(ENTRY + 1.8, 0.014, 0); scene.add(wel);
      // 讓小徑看起來接到門口的門墊
      const wm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x7a2230, roughness: 1 })); wm.rotation.x = -PI / 2; wm.position.set(ENTRY + 0.3, 0.02, 0); wm.receiveShadow = true; scene.add(wm);

      // ===== 屋頂與外牆：從外面看是有屋頂的建築，走進去才切到室內視角 =====
      const addRoof = (geo, mat, x, y, z, grp, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); roofs.push({ m, mat, grp }); return m; };
      const MW = WORLD_W - ENTRY;
      const roofM = new THREE.MeshStandardMaterial({ color: 0x3a3640, roughness: 0.75, metalness: 0.1, transparent: true }), skyM = new THREE.MeshStandardMaterial({ color: 0x9cc4ff, roughness: 0.2, metalness: 0.3, transparent: true, emissive: 0x6a8fd0, emissiveIntensity: 0.5 });
      addRoof(new THREE.BoxGeometry(MW + 0.8, 0.35, DECK_HD * 2 + 0.8), roofM, ENTRY + MW / 2, 4.38, 0, "M");
      for (let x = ENTRY + 9; x < WORLD_W - 6; x += 12) addRoof(new THREE.BoxGeometry(6, 0.08, 3), skyM, x, 4.6, 0, "M");
      const ext = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.92 });
      shellBox(MW, 4.2, 0.3, ENTRY + MW / 2, -DECK_HD, ext, "M", 0.1); shellBox(MW, 4.2, 0.3, ENTRY + MW / 2, DECK_HD, ext, "M", 0.1); shellBox(0.3, 4.2, DECK_HD * 2, WORLD_W, 0, ext, "M", 0.1);
      // 家：斜屋頂（蓋在二樓牆頂）
      const roofH = new THREE.MeshStandardMaterial({ color: 0xa3492f, roughness: 0.8, transparent: true });
      const hw = (Z1 - Z0 + 0.8) / 2, rshape = new THREE.Shape(); rshape.moveTo(-hw, 0); rshape.lineTo(hw, 0); rshape.lineTo(0, 2.4); rshape.closePath();
      const roofGeo = new THREE.ExtrudeGeometry(rshape, { depth: X1 - X0 + 0.8, bevelEnabled: false });
      addRoof(roofGeo, roofH, X0 - 0.4, TOP, ZC, "H", Math.PI / 2);
      addRoof(new THREE.BoxGeometry(0.6, 1.4, 0.6), roofH, X1 - 1.8, TOP + 1.6, ZC - 1.4, "H");
    }

    /* ----- 辦公室（玻璃隔間） ----- */
    (() => {
      const OZ = -ROW_DZ - 1.0; const g = new THREE.Group(); g.position.set(OFFICE_X, 0, OZ); scene.add(g);
      const M = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
      add(new THREE.PlaneGeometry(8.6, 4.2), M(0x2b2740, 1), 0, 0.014, -3.1, false).rotation.x = -Math.PI / 2;
      const gw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 4.2), glass); gw.position.set(-4.4, 1.3, -3.1); g.add(gw);
      const gw2 = gw.clone(); gw2.position.x = 4.4; g.add(gw2);
      const gb = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.6, 0.04), glass); gb.position.set(0, 1.3, -5.2); g.add(gb);
      for (const [x, z] of [[-4.4, -1.0], [4.4, -1.0], [-4.4, -5.2], [4.4, -5.2]]) add(new THREE.BoxGeometry(0.1, 2.65, 0.1), brass, x, 1.32, z);
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
      for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) add(new THREE.BoxGeometry(0.1, 0.38, 0.28), M(new THREE.Color().setHSL((k * 0.11 + r * 0.2) % 1, 0.32, 0.4), 0.8), -3.1 + k * 0.23, 0.35 + r * 0.52, -4.72);
      // 盆栽
      for (const [px, pz] of [[3.4, -1.8], [-3.7, -1.9]]) {
        add(new THREE.CylinderGeometry(0.28, 0.2, 0.42, 16), M(0xff9b78, 0.7), px, 0.21, pz);
        for (let k = 0; k < 9; k++) { const a = k * 2.4; add(new THREE.SphereGeometry(0.2, 12, 10), M(0x3f9a6a, 0.8), px + Math.cos(a) * 0.14, 0.7 + k * 0.07, pz + Math.sin(a) * 0.14); }
        addObs(OFFICE_X + px, pz + OZ, 0.45, 0.45);
      }
      // 吊燈
      const pl = new THREE.PointLight(0xffd9a0, 1.1, 9); pl.position.set(0, 2.3, -2.6); g.add(pl);
      for (const m of [desk, screen]) { m.userData = { station: 0, kind: "office" }; pickables.push(m); }
      addObs(OFFICE_X, -3.0 + OZ, 1.75, 0.8); addObs(OFFICE_X - 2.2, -4.9 + OZ, 1.3, 0.35);
      // 地面標示
      const t = mkTex(THREE, decalCanvas(1024, 256, (c, w, h) => {
        c.textAlign = "center"; c.fillStyle = "#3a2e24"; c.font = "800 120px Georgia, serif"; if ("letterSpacing" in c) c.letterSpacing = "14px"; c.fillText("OFFICE", w / 2, 130);
        c.fillStyle = "rgba(58,46,36,.75)"; c.font = "500 54px 'Noto Sans TC', sans-serif"; if ("letterSpacing" in c) c.letterSpacing = "10px"; c.fillText("辦公室 · 儀表板", w / 2, 220);
      }), aniso);
      const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), decalMat(t)); d.rotation.x = -Math.PI / 2; d.position.set(OFFICE_X, 0.013, -0.9); scene.add(d);
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true })); bang.position.set(OFFICE_X, 3.3, -2.6 + OZ); bang.scale.set(0.9, 0.9, 1); bang.renderOrder = 10; scene.add(bang); bangs[0] = bang;
    })();

    /* ----- 專案房間：玻璃隔間 + 門 + 房內白板；門外展台放畫 ----- */
    const plaster = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.92, envMapIntensity: 0.4 });
    P.forEach((p, i) => {
      const s = i + 1, sx = stationsX[s], hue = H.hue(i);
      if (slots[i] < 0) return;   // 匹克球 = 室內球場，不另蓋房間
      const rw = rowOf[s], g = new THREE.Group(); g.position.set(rw.sx, 0, rw.zoff); g.rotation.y = rw.rot ? Math.PI : 0; scene.add(g);
      const toW = (lx, lz) => L2W(s, lx, lz), obsL = (lx, lz, hw, hd) => { const w = toW(lx, lz); addObs(w.x, w.z, hw, hd); };
      const M = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
      const add = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
      const mark = (m, kind) => { m.userData = { station: s, kind }; pickables.push(m); return m; };
      const zc = (ROOM_Z0 + ROOM_Z1) / 2, zl = ROOM_Z1 - ROOM_Z0;

      add(new THREE.PlaneGeometry(ROOM_HW * 2 - 0.2, zl - 0.2), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.2, 0.6), roughness: 1 }), 0, 0.014, zc, false).rotation.x = -Math.PI / 2;
      for (const x of [-ROOM_HW, ROOM_HW]) { mark(add(new THREE.BoxGeometry(0.12, 1.5, zl), plaster, x, 0.75, zc), "room"); add(new THREE.BoxGeometry(0.04, 1.1, zl), glass, x, 2.05, zc, false); }
      if (rw.rot) { mark(add(new THREE.BoxGeometry(ROOM_HW * 2, 1.5, 0.12), plaster, 0, 0.75, ROOM_Z0), "room"); add(new THREE.BoxGeometry(ROOM_HW * 2, 1.1, 0.04), glass, 0, 2.05, ROOM_Z0, false); }   // 南排：後牆矮，從走道方向看得到室內
      else mark(add(new THREE.BoxGeometry(ROOM_HW * 2, 2.6, 0.12), plaster, 0, 1.3, ROOM_Z0), "room");
      { const stex = mkTex(THREE, signCanvas(p, i, H), aniso); roomSignTex[s] = stex;
        const sg3 = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.36), new THREE.MeshStandardMaterial({ map: stex, roughness: 0.6, emissive: 0xffffff, emissiveMap: stex, emissiveIntensity: 0.4 }));
        sg3.position.set(0, 0.76, ROOM_Z0 - 0.07); sg3.rotation.y = Math.PI; g.add(sg3); }                   // 後牆外側（朝外）的招牌
      for (const [cx, w] of [[(-ROOM_HW + DOOR_DX - 0.8) / 2, DOOR_DX - 0.8 + ROOM_HW], [(DOOR_DX + 0.8 + ROOM_HW) / 2, ROOM_HW - DOOR_DX - 0.8]]) {
        mark(add(new THREE.BoxGeometry(w, 1.5, 0.12), plaster, cx, 0.75, ROOM_Z1), "room"); add(new THREE.BoxGeometry(w, 1.1, 0.04), glass, cx, 2.05, ROOM_Z1, false);
      }
      for (const [x, z] of [[-ROOM_HW, ROOM_Z0], [ROOM_HW, ROOM_Z0], [-ROOM_HW, ROOM_Z1], [ROOM_HW, ROOM_Z1]]) add(new THREE.BoxGeometry(0.1, 2.65, 0.1), brass, x, 1.32, z);
      for (const dx of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.12, 2.4, 0.12), brass, DOOR_DX + dx, 1.2, ROOM_Z1);
      obsL(-ROOM_HW, zc, 0.06, zl / 2); obsL(ROOM_HW, zc, 0.06, zl / 2); obsL(0, ROOM_Z0, ROOM_HW, 0.06);
      obsL((-ROOM_HW + DOOR_DX - 0.8) / 2, ROOM_Z1, (DOOR_DX - 0.8 + ROOM_HW) / 2, 0.06); obsL((DOOR_DX + 0.8 + ROOM_HW) / 2, ROOM_Z1, (ROOM_HW - DOOR_DX - 0.8) / 2, 0.06);
      // 門（點它進出）
      const door = add(new THREE.BoxGeometry(1.6, 2.2, 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), DOOR_DX, 1.1, ROOM_Z1, false); mark(door, "door");
      add(new THREE.BoxGeometry(1.6, 0.03, 0.22), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc878, emissiveIntensity: 1.8 }), DOOR_DX, 0.02, ROOM_Z1, false);
      // 門前地面名牌
      const nameTex = mkTex(THREE, decalCanvas(1024, 300, (c, w, h) => {
        c.textAlign = "center"; c.fillStyle = "#3a2e24"; let fs = 110; do { c.font = `800 ${fs}px Georgia, 'Noto Serif TC', serif`; fs -= 6; } while (c.measureText(p.name).width > w - 80 && fs > 40);
        c.fillText(p.name, w / 2, 130); c.fillStyle = "rgba(58,46,36,.72)"; c.font = "500 46px 'Noto Sans TC', sans-serif"; c.fillText("▲ 站在門前 1 秒 / Enter 進門", w / 2, 230);
      }), aniso);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.94), decalMat(nameTex, 0.95)); nm.rotation.x = -Math.PI / 2; { const w = toW(DOOR_DX, 0.7); nm.position.set(w.x, 0.013, w.z); } scene.add(nm);
      // 室內：燈、盆栽
      const pl = new THREE.PointLight(0xffd9a0, 0.9, 9); pl.position.set(0, 2.3, zc + 0.4); g.add(pl);
      add(new THREE.CylinderGeometry(0.26, 0.19, 0.4, 16), M(0xff9b78, 0.7), 2.5, 0.2, ROOM_Z0 + 0.6);
      for (let k = 0; k < 8; k++) { const a = k * 2.4; add(new THREE.SphereGeometry(0.19, 12, 10), M(0x3f9a6a, 0.8), 2.5 + Math.cos(a) * 0.13, 0.66 + k * 0.07, ROOM_Z0 + 0.6 + Math.sin(a) * 0.13); }
      obsL(2.5, ROOM_Z0 + 0.6, 0.42, 0.42);

      // 房內白板（斜面立架，從上往下看也讀得到）
      const bw = 2.3, bh = bw * 900 / 1400, bd = 1.25, rise = bd * Math.tan(TILT), hF = 0.55, hB = hF + rise;
      const bg = new THREE.Group(); bg.position.set(-0.4, 0, ROOM_Z0 + 1.55); g.add(bg);
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
      const bart2 = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bmat); bart2.position.z = -0.03; bart2.rotation.set(0, Math.PI, Math.PI); bpg.add(bart2);   // 背面也貼上，南排從走道另一側看也讀得到
      mark(bart, "board"); mark(bart2, "board"); mark(bframe, "board"); boardMats[s] = bmat; boardTex[s] = btex;
      obsL(-0.4, ROOM_Z0 + 1.55 - bd / 2, bw / 2 + 0.12, bd / 2 + 0.1);

      // 門外展台（掛畫）
      const pg = new THREE.Group(); pg.position.set(PL_DX, 0, PL_Z); g.add(pg);
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
      if (!rw.rot) {
        const wf = new THREE.Mesh(new THREE.BoxGeometry(2.36, 1.6, 0.06), brass); wf.position.set(1.25, 1.55, ROOM_Z0 + 0.09); wf.castShadow = true; g.add(wf);
        const wa = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.45), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, envMapIntensity: 0.3 })); wa.position.set(1.25, 1.55, ROOM_Z0 + 0.125); g.add(wa);
        const pbar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.1), new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffd9a0, emissiveIntensity: 1.8 })); pbar.position.set(1.25, 2.5, ROOM_Z0 + 0.2); g.add(pbar);
      }
      obsL(PL_DX, PL_Z - PL_D / 2, PL_W / 2 + 0.1, PL_D / 2 + 0.1);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 5.2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.14 }));
      pool.rotation.x = -Math.PI / 2; { const w = toW(0, 0.4); pool.position.set(w.x, 0.02, w.z); } scene.add(pool); pools[s] = pool;
      const bang = new THREE.Sprite(new THREE.SpriteMaterial({ map: bangTex, depthTest: false, transparent: true })); { const w = toW(DOOR_DX, ROOM_Z1); bang.position.set(w.x, 2.9, w.z); } bang.scale.set(0.6, 0.6, 1); bang.renderOrder = 10; scene.add(bang); bangs[s] = bang;
    });
    // 大廳點綴：靠門面兩側的長椅與盆栽
    for (const z of [-DECK_HD + 1.2, DECK_HD - 1.2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.6 })); bench.position.set(ENTRY + 5, 0.45, z); bench.castShadow = true; scene.add(bench);
      for (const dx of [-0.95, 0.95]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.5, roughness: 0.4 })); lg.position.set(ENTRY + 5 + dx, 0.22, z); scene.add(lg); }
      addObs(ENTRY + 5, z, 1.2, 0.35);
    }

    /* ----- 人物 ----- */
    const av = window.PERSONA === "aeris" && window.Aeris ? window.Aeris.buildPlayer(THREE, (o) => buildAvatar(THREE, o)) : buildAvatar(THREE, window.Faces ? window.Faces.opts("david") : undefined); if (window.PERSONA !== "aeris" && window.Faces) window.Faces.apply(THREE, av, "david"); scene.add(av.root);

    /* ----- 狀態 ----- */
    const sxOf = (s) => stationsX[s];
    const inHall = (x, z) => sPB > 0 && x > COURT_CX - HX + 0.3 && x < COURT_CX + HXE - 0.3 && Math.abs(z) < HZ - 0.2;
    const doorX = (s) => (s === sPB ? COURT_CX - HX - 1.0 : L2W(s, DOOR_DX, ROOM_Z1).x);
    const anchor = (s) => (s === 0 ? { x: OFFICE_X, z: -0.9 } : s === sPB ? { x: COURT_CX - HX - 2.0, z: 0.2 } : L2W(s, -0.2, STAND_Z));
    const boardAnchor = (s) => (s === sPB ? { x: COURT_CX + HXE - 1.8, z: 0 } : L2W(s, -0.4, ROOM_Z0 + 2.4));
    const roomAt = (x, z) => {
      if (inHall(x, z)) return sPB;
      for (let s = 1; s <= N; s++) {
        if (s === sPB) continue; const r = rowOf[s], lx = r.rot ? r.sx - x : x - r.sx, lz = r.rot ? r.zoff - z : z - r.zoff;
        if (Math.abs(lx) < ROOM_HW - 0.25 && lz < ROOM_Z1 - 0.1 && lz > ROOM_Z0) return s;
      }
      return -1;
    };
    // 球場內不能穿過場地：沿南側走道（z≈4）繞到對面牆的白板
    const enterPts = (s) => (s === sPB
      ? [{ x: COURT_CX - HX - 1.0, z: 0 }, { x: COURT_CX - HX + 1.3, z: 0 }, { x: COURT_CX - HX + 1.3, z: 4.0 }, { x: COURT_CX + HXE - 1.8, z: 4.0 }, boardAnchor(s)]
      : [L2W(s, DOOR_DX, 0.1), L2W(s, DOOR_DX, -2.4), boardAnchor(s)]);
    const exitPts = (s, from = pos) => {
      if (s !== sPB) return [L2W(s, DOOR_DX, -2.3), L2W(s, DOOR_DX, 0.4)];
      if (from.x < COURT_CX - HX + 2.6) return [{ x: COURT_CX - HX + 1.3, z: 0 }, { x: COURT_CX - HX - 1.0, z: 0 }];
      const pts = []; if (Math.abs(from.z) < 3.6) pts.push({ x: from.x, z: 4.0 });
      pts.push({ x: COURT_CX - HX + 1.3, z: 4.0 }, { x: COURT_CX - HX + 1.3, z: 0 }, { x: COURT_CX - HX - 1.0, z: 0 });
      return pts;
    };

    const spawn = api.lastId === "__office" ? 0 : (api.lastId ? P.findIndex((p) => p.id === api.lastId) + 1 : -1);
    const bedZ = window.PERSONA === "aeris" ? -3.15 : -4.05;                         // 開場：躺在二樓雙人床上（David 睡北側、ARIES 睡南側）
    const standZ = window.PERSONA === "aeris" ? -2.0 : -5.2, standX = 2.0;           // 起床後站在自己那一側的床邊
    const pos = spawn >= 0 ? { ...anchor(spawn) } : { x: 2.55, z: bedZ };
    let yaw = -0.55, elev = 38 * Math.PI / 180, dist = 10.5, facing = Math.PI;
    const view0 = { yaw, elev, dist };
    if (spawn < 0) facing = Math.PI / 2;
    const inHouseNow = () => pos.x > HOUSE.x0 && pos.x < HOUSE.x1 && pos.z > HOUSE.z0 && pos.z < HOUSE.z1;
    const camT = new THREE.Vector3(pos.x, 0.9, pos.z), bias = { x: 0, z: 0 };
    const lastTap = {}, dbl = { l: 0, r: 0, u: 0, d: 0 };
    let lastDown = 0;
    let keys = { l: 0, r: 0, u: 0, d: 0, q: 0, e: 0 }, run = false, touch = { l: 0, r: 0, u: 0, d: 0 }, rotHold = 0, auto = false;
    let boardArmed = true, officeArmed = true;
    let lvl = 0, lvlS = 0, py = 0, swimT = 0, wasSwim = false, jy = 0, jv = 0, jumpReq = false;
    let wake = spawn < 0 ? { t: 0 } : null;                                           // 開場動畫：躺床 → 起身 → 走去餐桌（ARIES 先下樓）
    if (wake) { lvl = 1; py = UY; lvlS = 1; }   // 開場在二樓
    camT.y = 0.9 + py;   // jy：跳起的高度（Space）   // 樓層（0 = 一樓 / 1 = 二樓）、平滑樓層、目前高度
    let sitting = -1, sitA = 0, insM = pos.x > ENTRY + 0.4 ? 1 : 0, insH = (pos.x > HOUSE.x0 && pos.x < HOUSE.x1 && pos.z > HOUSE.z0 && pos.z < HOUSE.z1) ? 1 : 0;
    let route = [], afterFn = null, nearIdx = -1, speedNow = 0, inside = -1, zoomK = 0, lastWheel = 0, promptKey = "", boardS = -1;
    const tickHooks = [];

    if (spawn < 0) root.insertAdjacentHTML("beforeend", '<div class="g-start">你在自己的家裡。往東走出家門，沿著小徑走到<b>美術館入口</b>，再走進去。</div>');
    const prompt = root.querySelector("#gPrompt"), dots = [...root.querySelectorAll("#gMap button")], ov = root.querySelector("#gBoardOv");
    const infoEl = root.querySelector("#gInfo"); let lastInfoS = 0, dwell = 0, dwellS = -1;
    const dOut = (s) => (s === sPB ? { x: COURT_CX - HX - 1.0, z: 0 } : L2W(s, DOOR_DX, ROOM_Z1 + 0.9));          // 門外一步的位置
    const renderInfo = (s) => {                                                                                       // 門前介紹卡：直接看到裡面的細節
      if (!s) { infoEl.hidden = true; return; }
      const p = P[s - 1], stt = H.st(p), ms = p.milestones || [], done = ms.filter((m) => m.done).length, lu = (p.updates || [])[0];
      infoEl.innerHTML = `<div class="gi-head"><b>${H.esc(p.name)}</b><span>${H.esc(p.zh || "")}</span></div>
        <div class="gi-meta">${p.wbStatus ? `<b>${H.esc(p.wbStatus)}</b>` : "狀態未設定"}${p.wbNote ? ` · ${H.esc(p.wbNote)}` : ""}</div>
        <p class="gi-goal">${p.goal ? "目標：" + H.esc(p.goal) : "尚未設定目標"}</p>
        <p class="gi-last">${p.next ? "Next：" + H.esc(p.next) : "Next Step 尚未設定"}</p>
        <div class="gi-dwell"><span>停在門前 1 秒自動進入　或按 Enter</span><div><i id="gDwellBar"></i></div></div>`;
      infoEl.hidden = false;
    };
    const goRoute = (pts, fn) => { route = pts.slice(); afterFn = fn || null; };
    const cancelRoute = () => { route = []; afterFn = null; };

    /* ----- 白板總覽（點白板 / 走近按 Enter） ----- */
    const closeBoard = () => { if (ov.hidden) return false; ov.hidden = true; document.body.classList.remove("board-open"); return true; };
    const renderBoard = () => {
      const p = P[boardS - 1], i = boardS - 1;
      if (window.Journal) { ov.innerHTML = window.Journal.card(p, i, H); window.Journal.bind(ov, p, i, H, { close: closeBoard, rerender: renderBoard }); }
      else ov.innerHTML = `<div class="wb-card"><button class="wb-x" data-x>✕</button><h2>${H.esc(p.name)}</h2></div>`;
    };
    const openBoard = (s) => { boardS = s; if (typeof clearKeys === "function") clearKeys(); renderBoard(); ov.hidden = false; document.body.classList.add("board-open"); };
    ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) closeBoard(); });
    const refreshBoardTexture = (s) => {
      const p = P[s - 1]; if (!p) return;
      if (boardTex[s]) { boardTex[s].image = boardCanvas(p, s - 1, H); boardTex[s].needsUpdate = true; }
      if (panelTex[s]) { panelTex[s].image = panelCanvas(p, s - 1, H); panelTex[s].needsUpdate = true; }
      if (roomSignTex[s]) { roomSignTex[s].image = signCanvas(p, s - 1, H); roomSignTex[s].needsUpdate = true; }
    };
    const onStore = () => { for (let s = 1; s <= N; s++) refreshBoardTexture(s); if (!ov.hidden && boardS > 0) renderBoard(); if (lastInfoS > 0) renderInfo(lastInfoS); };
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
    const chairNearIdx = () => { if (sitting >= 0) return -1; let best = -1, bd = 1e9; for (let c = 0; c < chairSpots.length; c++) { const q = chairSpots[c]; if (q.sofa ? lvl !== 1 : (inside !== sPB || sPB <= 0)) continue; const d = Math.hypot(pos.x - q.front.x, pos.z - q.front.z); if (d < (q.sofa ? 0.85 : 1.3) && d < bd) { bd = d; best = c; } } return best; };
    const stand = () => { if (sitting < 0) return; const c = chairSpots[sitting]; pos.x = c.front.x; pos.z = c.front.z; sitting = -1; };
    const sitDown = (c) => { sitting = c; pos.x = chairSpots[c].x; pos.z = chairSpots[c].z; facing = chairSpots[c].face; cancelRoute(); };
    const activate = () => {
      if (!ov.hidden) return;
      if (sitting >= 0) return stand();
      { const cn = chairNearIdx(); if (cn >= 0) return goRoute([chairSpots[cn].front], () => sitDown(cn)); }
      if (inside >= 0) return toBoard(inside);
      if (nearIdx === 0) return H.office();
      if (nearIdx > 0) enterRoom(nearIdx);
    };
    dots.forEach((d) => d.addEventListener("click", () => toStation(+d.dataset.s, false)));
    prompt.addEventListener("click", activate);

    /* ----- 輸入 ----- */
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    const blocked = () => document.body.classList.contains("locked") || document.body.classList.contains("news-open") || document.body.classList.contains("board-open") || document.body.classList.contains("dir-typing");
    // 雙擊「← / A」＝退出一層：白板 → 館長對話 → 房間 / 球場（有東西可退時優先於「雙擊跑步」）
    const dblBackExit = () => {
      if (!ov.hidden) { closeBoard(); return true; }
      if (window.Director && window.Director.dismiss()) return true;
      if (window.Aeris && window.Aeris.dismiss()) return true;
      if (inside >= 0) { exitRoom(); return true; }
      return false;
    };
    const onKey = (e) => {
      if (e.type === "keydown" && !e.repeat && (e.code === "ArrowLeft" || e.code === "KeyA") && !e.__dsbHandled && !typing(e) && !e.metaKey && !e.ctrlKey && !e.altKey && !document.body.classList.contains("locked") && !document.body.classList.contains("news-open")) {
        const n = performance.now(), second = n - lastDown < 350; lastDown = n;
        if (second && dblBackExit()) { lastDown = 0; keys.l = 0; dbl.l = 0; e.preventDefault(); e.__dsbHandled = true; return; }
      }
      if (e.type === "keyup") {            // 放開鍵一律處理，避免白板彈出時按鍵「卡住」讓小人自己走去撞牆
        run = e.shiftKey;
        switch (e.code) {
          case "ArrowLeft": case "KeyA": keys.l = 0; dbl.l = 0; break;
          case "ArrowRight": case "KeyD": keys.r = 0; dbl.r = 0; break;
          case "ArrowUp": case "KeyW": keys.u = 0; dbl.u = 0; break;
          case "ArrowDown": case "KeyS": keys.d = 0; dbl.d = 0; break;
          case "KeyQ": keys.q = 0; break;
          case "KeyE": keys.e = 0; break;
        }
        return;
      }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || blocked()) return;
      const down = e.type === "keydown"; run = e.shiftKey;
      const set = (k) => { keys[k] = down ? 1 : 0; if (down) { cancelRoute(); if (!e.repeat) { const n = performance.now(); if (n - (lastTap[k] || 0) < 320) dbl[k] = 1; lastTap[k] = n; } } else dbl[k] = 0; e.preventDefault(); };
      switch (e.code) {
        case "ArrowLeft": case "KeyA": set("l"); break;
        case "ArrowRight": case "KeyD": set("r"); break;
        case "ArrowUp": case "KeyW": set("u"); break;
        case "ArrowDown": case "KeyS": set("d"); break;
        case "Backspace": if (down && inside >= 0) { e.preventDefault(); exitRoom(); } break;
        case "KeyQ": keys.q = down ? 1 : 0; break;
        case "KeyE": keys.e = down ? 1 : 0; break;
        case "Enter": if (down && !e.repeat) { e.preventDefault(); activate(); } break;
        case "Space": if (down && !e.repeat) { e.preventDefault(); if (sitting >= 0) activate(); else jumpReq = true; } break;   // Space = 跳；Enter = 互動（進門 / 看白板 / 坐下）
      }
    };
    const clearKeys = () => { dbl.l = dbl.r = dbl.u = dbl.d = 0; keys = { l: 0, r: 0, u: 0, d: 0, q: 0, e: 0 }; run = false; touch = { l: 0, r: 0, u: 0, d: 0 }; rotHold = 0; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey); window.addEventListener("blur", clearKeys); document.addEventListener("visibilitychange", clearKeys);

    // 滑鼠 / 觸控：拖曳轉 360°、滾輪（門口：上滑進門 / 下滑出門；其他：縮放）、點擊
    const ptrs = new Map(); let dragMoved = 0, pinch = 0;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pickHit = (ev) => {
      const r = cv.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(pickables, false)[0]; return hit ? hit.object.userData : null;
    };
    const autoBtn = root.querySelector("#gAuto");
    const stopAuto = () => { auto = false; autoBtn.setAttribute("aria-pressed", "false"); };
    // 按住左鍵 → David 往指標指的地面方向走；單擊空地 → 走過去；右鍵拖曳 / Alt+左鍵 / 雙指 → 轉視角
    // 點地面走路：自動找路（繞過樹 / 涼亭 / 池塘 / 家具，穿過船尾欄杆缺口、門口）。找不到路就退回直線。
    const NAV = 0.25, NAVX0 = -11, NAVZ0 = -8.2, NAVW = Math.ceil((WORLD_W + 2 - NAVX0) / NAV), NAVH = Math.ceil(16.4 / NAV), navCache = [null, null];
    const navBlocked = (x, z, l) => {
      if (x < -10.4 || x > WORLD_W - 1.2 || Math.abs(z) > DECK_HD - 0.5) return true;
      if (x < -0.2) { const ex = (-x - 1) / 10.4, lim = 7.2 * Math.sqrt(Math.max(0, 1 - ex * ex)); if (Math.abs(z) > lim) return true; }
      if (x > STAIR.x0 - 0.3 && x < STAIR.x1 + 0.3 && z > STAIR.z0 - 0.3 && z < STAIR.z1 + 0.3) return true;      // 樓梯要自己走上去
      for (const o of obstacles) { if (o.lv !== undefined && o.lv !== l) continue; if (x > o.minX - 0.24 && x < o.maxX + 0.24 && z > o.minZ - 0.24 && z < o.maxZ + 0.24) return true; }
      return false;
    };
    const navGrid = (l) => { if (navCache[l] && navCache[l].n === obstacles.length) return navCache[l].g; const g = new Uint8Array(NAVW * NAVH); for (let j = 0; j < NAVH; j++) for (let i = 0; i < NAVW; i++) g[j * NAVW + i] = navBlocked(NAVX0 + i * NAV, NAVZ0 + j * NAV, l) ? 1 : 0; navCache[l] = { g, n: obstacles.length }; return g; };
    const planRoute = (t) => {
      const g = navGrid(lvl), ci = (x) => Math.round((x - NAVX0) / NAV), cj = (z) => Math.round((z - NAVZ0) / NAV);
      let si = clamp(ci(pos.x), 0, NAVW - 1), sj = clamp(cj(pos.z), 0, NAVH - 1), ti = clamp(ci(t.x), 0, NAVW - 1), tj = clamp(cj(t.z), 0, NAVH - 1);
      if (g[tj * NAVW + ti]) { let best = null, bd = 1e9; for (let dj = -12; dj <= 12; dj++) for (let di = -12; di <= 12; di++) { const ni = ti + di, nj = tj + dj; if (ni < 0 || nj < 0 || ni >= NAVW || nj >= NAVH || g[nj * NAVW + ni]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = [ni, nj]; } } if (!best) return [{ x: t.x, z: t.z }]; ti = best[0]; tj = best[1]; }
      const prev = new Int32Array(NAVW * NAVH).fill(-1), q = [sj * NAVW + si]; prev[q[0]] = q[0]; let h = 0, found = false;
      while (h < q.length) { const cur = q[h++], ci0 = cur % NAVW, cj0 = (cur / NAVW) | 0; if (ci0 === ti && cj0 === tj) { found = true; break; }
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ni = ci0 + di, nj = cj0 + dj; if (ni < 0 || nj < 0 || ni >= NAVW || nj >= NAVH) continue; const k = nj * NAVW + ni; if (prev[k] >= 0 || g[k]) continue; if (di && dj && (g[cj0 * NAVW + ni] || g[nj * NAVW + ci0])) continue; prev[k] = cur; q.push(k); } }
      if (!found) return [{ x: t.x, z: t.z }];
      let cells = []; for (let k = tj * NAVW + ti; k !== sj * NAVW + si; k = prev[k]) cells.push(k); cells.reverse();
      const P = cells.map((k) => ({ x: NAVX0 + (k % NAVW) * NAV, z: NAVZ0 + ((k / NAVW) | 0) * NAV }));
      const clear = (a, b) => { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.15); for (let m = 1; m < n; m++) { const u = m / n; if (navBlocked(lerp(a.x, b.x, u), lerp(a.z, b.z, u), lvl)) return false; } return true; };
      const out = []; let from = { x: pos.x, z: pos.z }, k = 0;
      while (k < P.length) { let far = k; for (let m = P.length - 1; m >= k; m--) { if (clear(from, P[m])) { far = m; break; } } out.push(P[far]); from = P[far]; k = far + 1; }
      if (!navBlocked(t.x, t.z, lvl)) out.push({ x: t.x, z: t.z });
      return out;
    };
    const sternRoute = planRoute;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp = new THREE.Vector3();
    const groundAt = (ev) => { const r = cv.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(groundPlane, gp) ? { x: gp.x, z: gp.z } : null; };
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0.9, depthTest: false })); marker.rotation.x = -Math.PI / 2; marker.renderOrder = 12; marker.visible = false; scene.add(marker);
    let mouse = null, markT = 0;
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    const skipWake = () => { if (wake) { wake.skipped = true; wake.t = Math.max(wake.t, 99); } };
    window.addEventListener("keydown", skipWake); cv.addEventListener("pointerdown", skipWake);   // 開場動畫：任何按鍵或點擊都跳過
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); stopAuto();
      if (ptrs.size === 2) { mouse = null; pinch = 0; return; }
      const orbit = e.button === 2 || e.button === 1 || (e.altKey && e.button === 0);
      mouse = { id: e.pointerId, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, mode: orbit ? "orbit" : null, pickU: orbit ? null : pickHit(e), steer: null };
    });
    cv.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) { cv.style.cursor = pickHit(e) ? "pointer" : "crosshair"; return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) dist = clamp(dist * (pinch / d), 4.5, 40); pinch = d; yaw -= dx * 0.003; return; }
      if (!mouse || mouse.id !== e.pointerId) return;
      mouse.moved += Math.abs(dx) + Math.abs(dy); mouse.x = e.clientX; mouse.y = e.clientY;
      if (mouse.mode === "orbit") { yaw -= dx * 0.006; elev = clamp(elev + dy * 0.004, 16 * Math.PI / 180, 84 * Math.PI / 180); cv.style.cursor = "grabbing"; return; }
      if (!mouse.pickU && (mouse.moved > 6 || performance.now() - mouse.t0 > 160)) mouse.mode = "steer";
      if (mouse.mode === "steer") { const g = groundAt(e); if (g) mouse.steer = g; }
    });
    const up = (e) => {
      if (ptrs.has(e.pointerId) && ptrs.size === 1 && mouse && mouse.id === e.pointerId) {
        const quick = mouse.moved < 7 && (mouse.pickU || (performance.now() - mouse.t0 < 260 && !mouse.mode));
        if (quick) {
          const u = mouse.pickU || pickHit(e);
          if (u) {
            if (u.kind === "office") toStation(0, true);
            else if (u.kind === "board") toBoard(u.station);
            else if (u.kind === "door") (inside === u.station ? exitRoom() : enterRoom(u.station));
            else if (u.kind === "room" && inside !== u.station) enterRoom(u.station);
          } else { const g = groundAt(e); if (g) { sitting >= 0 && stand(); goRoute(sternRoute(g)); marker.position.set(g.x, 0.05, g.z); marker.visible = true; markT = 1.2; } }
        }
      }
      if (mouse && mouse.id === e.pointerId) mouse = null;
      ptrs.delete(e.pointerId); pinch = 0; cv.style.cursor = "crosshair";
    };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const now = performance.now();
      const atDoor = !e.ctrlKey && (inside >= 0 || nearIdx >= 0);
      if (atDoor && Math.abs(e.deltaY) > 2) {
        if (now - lastWheel > 650) {
          if (e.deltaY < 0) { lastWheel = now; activate(); return; }         // 上滑：進門 / 看白板 / 進辦公室
          if (e.deltaY > 0 && inside >= 0) { lastWheel = now; exitRoom(); return; } // 下滑：出門
        } else if (inside >= 0 || e.deltaY < 0) return;
      }
      dist = clamp(dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.012 : 0.0012)), 4.5, 40);
    }, { passive: false });
    cv.style.cursor = "crosshair"; cv.style.touchAction = "none";

    root.querySelector("#gJump").addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); jumpReq = true; });   // 手機：跳躍鈕
    const holdBtn = (el, on, off) => { el.addEventListener("pointerdown", (e) => { e.preventDefault(); on(); }); for (const t of ["pointerup", "pointerleave", "pointercancel"]) el.addEventListener(t, off); };
    holdBtn(root.querySelector("#gRotL"), () => (rotHold = -1), () => (rotHold = 0));
    holdBtn(root.querySelector("#gRotR"), () => (rotHold = 1), () => (rotHold = 0));
    root.querySelectorAll("#gDpad button").forEach((b) => holdBtn(b, () => { const k = b.dataset.d, n = performance.now(); touch[k] = 1; cancelRoute(); if (n - (lastTap["t" + k] || 0) < 320) { if (k === "l" && dblBackExit()) { touch.l = 0; lastTap["t" + k] = 0; return; } dbl[k] = 1; } lastTap["t" + k] = n; }, () => { touch[b.dataset.d] = 0; dbl[b.dataset.d] = 0; }));
    autoBtn.addEventListener("click", () => { auto = !auto; autoBtn.setAttribute("aria-pressed", String(auto)); });
    root.querySelector("#gReset").addEventListener("click", () => { yaw = view0.yaw; elev = view0.elev; dist = view0.dist; stopAuto(); });

    const refreshBangs = () => bangs.forEach((b) => { if (b) b.visible = false; });   // 驚嘆號已拿掉（未讀邏輯保留在 NEWS 裡）
    window.addEventListener("news:change", refreshBangs); refreshBangs();

    const layers = [...document.querySelectorAll("#painting .layer")];
    const resize = () => {
      const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
      renderer.setSize(w, h, false); cv.style.width = "100%"; cv.style.height = "100%";
      camera.aspect = w / h; camera.fov = w / h < 0.9 ? 46 : 36; camera.updateProjectionMatrix();
    };
    resize(); window.addEventListener("resize", resize);

    const ctx = { THREE, scene, camera, root, P, H, pos, stationsX, anchor, boardAnchor, enterPts, exitPts, doorX, roomAt, hooks: tickHooks, buildAvatar: (o) => buildAvatar(THREE, o), openBoard, getInside: () => inside, SPACING, DECK_HD, seatPose, getMe: () => ({ x: pos.x, z: pos.z, y: py + jy, f: facing, sp: speedNow, sit: sitA, sw: swimT > 0.5 ? 1 : 0 }), swimPose, POOL, getSwim: () => swimT, obstacles, HOUSE, ENTRY, getSunHeight: () => sunH, getHour: () => hourNow, lamps: lampPts, lampMat, sPB, hallX0: COURT_CX - HX, COURT_CX, HX, WORLD_W, seaY: -14, roofs, getInsideMuseum: () => insM, getInsideHome: () => insH, getInside: () => inside, UY, STAIR, getLevel: () => lvl };
    const toScreen = (v) => { const p = v.clone().project(camera); const r = cv.getBoundingClientRect(); return { x: (p.x * 0.5 + 0.5) * r.width + r.left, y: (-p.y * 0.5 + 0.5) * r.height + r.top, behind: p.z > 1 }; };
    ctx.toScreen = toScreen;

    /* ----- 日夜循環：一天 = 12 分鐘（早晨→中午→黃昏→夜晚），兩個人用同一個時鐘所以看到的時間一樣 ----- */
    const DAY_SEC = 720; let hourOverride = null, hourNow = 9, lastEnvH = -9, sunH = 1;
    const KF = [   // 小時, 天頂, 地平線, 地面, 太陽/月光色, 太陽強度, 半球天光, 半球地光, 半球強度, 海, 雲, 曝光
      [0, 0x030816, 0x0b1830, 0x050912, 0x8fa8ff, 0.30, 0x2a3b66, 0x10141f, 0.42, 0x0b1a33, 0x3a4a6a, 1.05],
      [5, 0x0a1230, 0x1c2c55, 0x0a1020, 0x8fa8ff, 0.28, 0x2a3b66, 0x10141f, 0.42, 0x0d1f3d, 0x3a4a6a, 1.05],
      [6.2, 0x35609c, 0xf4a878, 0x20304a, 0xffc890, 0.85, 0xffd9b8, 0x6a5a50, 0.55, 0x4a7aa4, 0xffd0b0, 0.95],
      [8, 0x4f9be6, 0xcfe8ff, 0x28466a, 0xfff0d8, 1.25, 0xe4eeff, 0x8a7a68, 0.65, 0x3a86b4, 0xffffff, 0.9],
      [12, 0x2f86e4, 0xbfe4ff, 0x28466a, 0xffffff, 1.45, 0xe4eeff, 0x8a7a68, 0.7, 0x2f80b8, 0xffffff, 0.88],
      [16.5, 0x3f86d6, 0xffe9c4, 0x28466a, 0xffe2b0, 1.3, 0xffeedd, 0x8a7a68, 0.65, 0x3a86b4, 0xfff4e4, 0.9],
      [18.4, 0x3a5a9c, 0xff9a5c, 0x20304a, 0xff9f60, 0.85, 0xffcfa8, 0x6a5a50, 0.55, 0x3a6a94, 0xffc090, 0.95],
      [19.8, 0x14264f, 0x3a5a86, 0x0c1424, 0xa0b4ff, 0.32, 0x34466e, 0x10141f, 0.45, 0x12284a, 0x4a5c80, 1.02],
      [21.5, 0x050c20, 0x0f1e3a, 0x060a14, 0x8fa8ff, 0.30, 0x2a3b66, 0x10141f, 0.42, 0x0b1a33, 0x3a4a6a, 1.05],
      [24, 0x030816, 0x0b1830, 0x050912, 0x8fa8ff, 0.30, 0x2a3b66, 0x10141f, 0.42, 0x0b1a33, 0x3a4a6a, 1.05],
    ];
    const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _l = new THREE.Vector3();
    const mixC = (dst, a, b, k) => dst.setHex(a).lerp(_c2.setHex(b), k);
    const applyTime = (h) => {
      hourNow = h; let i = 0; while (i < KF.length - 2 && h >= KF[i + 1][0]) i++;
      const A = KF[i], B = KF[i + 1], k = (h - A[0]) / (B[0] - A[0]), n = (idx) => lerp(A[idx], B[idx], k);
      mixC(skyU.zen.value, A[1], B[1], k); mixC(skyU.hor.value, A[2], B[2], k); mixC(skyU.gnd.value, A[3], B[3], k);
      mixC(sun.color, A[4], B[4], k); mixC(hemi.color, A[6], B[6], k); mixC(hemi.groundColor, A[7], B[7], k);
      mixC(seaMat.color, A[9], B[9], k); mixC(clouds.material.color, A[10], B[10], k);
      scene.fog.color.copy(skyU.hor.value);
      hemi.intensity = n(8); renderer.toneMappingExposure = n(11);
      const sa = ((h - 6) / 12.4) * Math.PI, ma = ((h - 18.4) / 11.6) * Math.PI;      // 太陽 6:00→18:24 升落，月亮 18:24→30:00
      const sy = Math.sin(sa), my = Math.sin(((h < 6 ? h + 24 : h) - 18.4) / 11.6 * Math.PI);
      skyU.sunDir.value.set(Math.cos(sa), sy, -0.35).normalize(); skyU.moonDir.value.set(Math.cos(((h < 6 ? h + 24 : h) - 18.4) / 11.6 * Math.PI), my, -0.35).normalize();
      sunH = sy; const night = clamp(1 - smooth(-0.18, 0.12, sy), 0, 1); skyU.night.value = night; skyU.sunI.value = clamp(sy * 4, 0, 1);
      // 平行光：太陽在地平線上用太陽，否則用月光
      const useSun = sy > 0.02, L = useSun ? skyU.sunDir.value : skyU.moonDir.value;
      _l.copy(L); _l.y = Math.max(_l.y, 0.24); _l.normalize(); sun._dir = _l.clone();
      sun.intensity = useSun ? lerp(0.3, n(5), clamp(sy * 3, 0, 1)) : n(5);
      clouds.material.opacity = lerp(0.35, 0.95, 1 - night);
      glitter.material.opacity = 0.95 * clamp(1 - Math.abs(sy - 0.12) * 5, 0, 1) * (sy > -0.05 ? 1 : 0);
      if (Math.abs(h - lastEnvH) > 0.4 && Math.abs(h - lastEnvH) < 23.6) { lastEnvH = h; updateEnv(); }
    };
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const clockHour = () => (hourOverride != null ? hourOverride : ((Date.now() / 1000) % DAY_SEC) / DAY_SEC * 24);
    applyTime(clockHour());

    /* ----- 主迴圈 ----- */
    const fwd = new THREE.Vector3(), rgt = new THREE.Vector3();
    let hourTick = 0, raf = 0, last = performance.now(), time = 0, qAcc = 0, qN = 0, quality3 = 0, lowN = 0, hiN = 0, stuckT = 0, stuckX = 0, stuckZ = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const rawDt = (now - last) / 1000; last = now;
      const dt = Math.min(0.25, rawDt); time += dt;
      // 自動調畫質：太卡就降解析度 / 陰影
      // 自動調畫質（保守版）：開頭 10 秒不算（載入、編譯 shader 會卡），連續兩個 3 秒窗口都低於 20 fps 才降一級；
      // 降的是解析度比例（0.8 → 0.62），不是一次砍到很糊；順暢（>50 fps）三個窗口後會自動升回來
      if (rawDt < 0.3 && !document.hidden && time > 10) { qAcc += rawDt; qN++; }
      if (qAcc > 3) {
        const fps = qN / qAcc; qAcc = 0; qN = 0;
        const apply = () => {
          const full = Math.min(window.devicePixelRatio || 1, 2), pr = [full, Math.max(1, full * 0.8), Math.max(0.9, full * 0.62), 0.75][quality3];
          renderer.setPixelRatio(pr); resize();
          if (quality3 >= 3) sun.castShadow = false; else sun.castShadow = true;
        };
        if (fps < 20) { lowN++; hiN = 0; if (lowN >= 2 && quality3 < 3) { quality3++; lowN = 0; apply(); } }
        else if (fps > 50) { hiN++; lowN = 0; if (hiN >= 3 && quality3 > 0) { quality3--; hiN = 0; apply(); } }
        else { lowN = 0; hiN = 0; }
      }

      if (blocked() && (keys.l | keys.r | keys.u | keys.d | keys.q | keys.e | dbl.l | dbl.r | dbl.u | dbl.d | touch.l | touch.r | touch.u | touch.d)) clearKeys();
      if (route.length) {
        stuckT += dt;
        if (stuckT > 0.8) { if (Math.hypot(pos.x - stuckX, pos.z - stuckZ) < 0.1) cancelRoute(); stuckT = 0; stuckX = pos.x; stuckZ = pos.z; }
      } else { stuckT = 0; stuckX = pos.x; stuckZ = pos.z; }
      const rot = (keys.e - keys.q) + rotHold;
      if (rot) { yaw += rot * 1.6 * dt; stopAuto(); }
      if (auto) yaw += 0.16 * dt;

      const ix = (keys.r | touch.r) - (keys.l | touch.l), iz = (keys.u | touch.u) - (keys.d | touch.d);
      let sp = 0, lmx = 0, lmz = 0;
      if (mouse && !mouse.mode && !mouse.pickU && performance.now() - mouse.t0 > 160) { mouse.mode = "steer"; mouse.steer = groundAt({ clientX: mouse.x, clientY: mouse.y }); }
      const steering = mouse && mouse.mode === "steer" && mouse.steer;
      if (steering) { cancelRoute(); marker.position.set(mouse.steer.x, 0.05, mouse.steer.z); marker.visible = true; markT = 0.4; }
      else if (markT > 0) { markT -= dt; if (markT <= 0 && !route.length) marker.visible = false; }
      if (sitting >= 0 && (ix || iz || steering)) stand();
      const steps = Math.max(1, Math.ceil(dt / 0.04)), sdt = dt / steps;
      for (let k = 0; k < (sitting >= 0 || wake ? 0 : steps); k++) {
        let mx = 0, mz = 0; sp = 0;
        if (ix || iz) {
          cancelRoute();
          fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); rgt.set(Math.cos(yaw), 0, -Math.sin(yaw));
          mx = rgt.x * ix + fwd.x * iz; mz = rgt.z * ix + fwd.z * iz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; sp = (run || dbl.l || dbl.r || dbl.u || dbl.d) ? RUN : WALK;
        } else if (steering) {
          const dx = mouse.steer.x - pos.x, dz = mouse.steer.z - pos.z, d = Math.hypot(dx, dz);
          if (d > 0.4) { mx = dx / d; mz = dz / d; sp = d > 11 ? RUN : clamp(d * 1.5, 1.4, WALK * 1.4); }
        } else if (route.length) {
          const t = route[0], dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
          if (d < 0.2) { route.shift(); if (!route.length) { const f = afterFn; afterFn = null; if (f) f(); } }
          else { mx = dx / d; mz = dz / d; sp = Math.min(WALK * 1.6, d * 3 + 1.2); }
        }
        if (!sp) continue;
        lmx = mx; lmz = mz;
        { const wf = (pos.x > POOL.x0 && pos.x < POOL.x1 && pos.z > POOL.z0 && pos.z < POOL.z1) ? 0.55 : 1; pos.x += mx * sp * sdt * wf; pos.z += mz * sp * sdt * wf; }
        for (const o of obstacles) {
          if (o.lv !== undefined && o.lv !== lvl) continue;
          if (o.h !== undefined && jy > o.h - 0.06) continue;      // 跳得夠高 → 越過低矮障礙物
          const L = o.minX - 0.24, R = o.maxX + 0.24, T = o.minZ - 0.24, B = o.maxZ + 0.24;
          if (pos.x > L && pos.x < R && pos.z > T && pos.z < B) {
            const pl = pos.x - L, pr = R - pos.x, pt = pos.z - T, pb = B - pos.z, m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = L; else if (m === pr) pos.x = R; else if (m === pt) pos.z = T; else pos.z = B;
          }
        }
        pos.x = clamp(pos.x, -10.4, WORLD_W - 1.2); pos.z = clamp(pos.z, -(DECK_HD - 0.5), DECK_HD - 0.5);
        if (pos.x < -0.2) { const ex = (-pos.x - 1) / 10.4, lim = 7.2 * Math.sqrt(Math.max(0, 1 - ex * ex)); pos.z = clamp(pos.z, -lim, lim); }   // 船尾弧形欄杆
      }
      if (sp) facing += angDiff(facing, Math.atan2(lmx, lmz)) * Math.min(1, dt * 10);
      speedNow = lerp(speedNow, sp, Math.min(1, dt * 12));
      { // 樓梯：在樓梯範圍內高度跟著斜坡走；其他地方高度 = 樓層高度
        const inSt = pos.x > STAIR.x0 && pos.x < STAIR.x1 && pos.z > STAIR.z0 && pos.z < STAIR.z1;
        if (inSt) { py = clamp(UY * (STAIR.x1 - pos.x) / (STAIR.x1 - STAIR.x0), 0, UY); lvl = py > UY * 0.5 ? 1 : 0; } else py = lvl * UY;
        lvlS = lerp(lvlS, py / UY, Math.min(1, dt * 6)); groundPlane.constant = -py;
      }
      if (jumpReq) { jumpReq = false; if (jy < 0.01 && jv <= 0 && swimT < 0.3 && sitting < 0) { jv = 5.2; if (window.Music) window.Music.sfx("bounce", pos.x, pos.z, 0.4); } }
      if (jy > 0 || jv > 0) { jv -= 13.5 * dt; jy += jv * dt; if (jy <= 0) { jy = 0; jv = 0; if (window.Music) window.Music.sfx("bounce", pos.x, pos.z, 0.4); } }
      const inWater = pos.x > POOL.x0 && pos.x < POOL.x1 && pos.z > POOL.z0 && pos.z < POOL.z1 && lvl === 0;
      if (inWater !== wasSwim) { wasSwim = inWater; if (window.Music) window.Music.sfx("splash", pos.x, pos.z, 1.3); }
      swimT = lerp(swimT, inWater ? 1 : 0, Math.min(1, dt * 5));
      if (swimT < 0.01 && !wake) { av.root.rotation.order = "XYZ"; av.root.rotation.x = 0; av.root.rotation.z = 0; }   // 修正：開場動畫之後角色身體殘留的歪斜（倒著走）
      av.root.position.set(pos.x, lerp(py + jy, POOL.surface - 0.02, swimT), pos.z); av.root.rotation.y = facing; av.update(dt, speedNow, time); swimPose(av, swimT, time, speedNow > 0.3);
      if (wake) {   // 開場動畫（任何按鍵或點擊都可以跳過）
        wake.t += dt; const T = wake.t, bx = 2.55, by = UY + 0.74, ex = standX, lieQ = (wake.lieQ = wake.lieQ || new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)))), standQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        if (T < 2.2) { av.root.position.set(bx, by, bedZ); av.root.quaternion.copy(lieQ); av.torso.rotation.x = Math.sin(T * 1.6) * 0.02; }              // 躺著（輕輕呼吸）
        else if (T < 3.2) { const u = (T - 2.2) / 1.0, e = u * u * (3 - 2 * u); av.root.position.set(lerp(bx, ex, e), lerp(by, py, Math.pow(e, 1.5)), lerp(bedZ, standZ, e)); av.root.quaternion.copy(lieQ).slerp(standQ, e); }   // 起身
        else {
          const skipped = wake.skipped; wake = null; pos.x = ex; pos.z = standZ; facing = Math.PI / 2; camT.x = pos.x; camT.z = pos.z;
          const way = (window.PERSONA === "aeris" ? [{ x: 3.7, z: -2.0 }] : [{ x: 3.7, z: -5.2 }]).concat([{ x: 5.4, z: -6.1 }, { x: 5.4, z: -7.05 }, { x: 6.6, z: -7.05 }, { x: 10.8, z: -7.05 }, { x: 11.5, z: -6.2 }, { x: 9.9, z: -4.7 }, { x: 7.5, z: -3.5 }]);   // 先離開床邊 → 樓梯口 → 下樓 → 一樓 → 餐桌
          if (!skipped) goRoute(way);
        }
      }
      if (jy > 0.04 && swimT < 0.3) { av.legL.hip.rotation.x = -0.75; av.legL.knee.rotation.x = 1.15; av.legR.hip.rotation.x = -0.25; av.legR.knee.rotation.x = 0.55; av.armL.sh.rotation.x = -2.5; av.armR.sh.rotation.x = -2.5; av.armL.el.rotation.x = -0.25; av.armR.el.rotation.x = -0.25; }   // 跳起來的姿勢
      sitA = lerp(sitA, sitting >= 0 ? 1 : 0, Math.min(1, dt * 6)); if (sitA > 0.01) seatPose(av, sitA);

      // 是否在房間裡 → 鏡頭拉近
      inside = roomAt(pos.x, pos.z);
      zoomK = lerp(zoomK, inside >= 0 ? 1 : 0, Math.min(1, dt * 3));
      // 走近白板 / 辦公桌 → 自動秀出資訊
      if (ov.hidden && !document.body.classList.contains("dir-typing") && !document.body.classList.contains("news-open")) {
        if (inside >= 0) {
          const b = boardAnchor(inside), bd = Math.hypot(pos.x - b.x, pos.z - b.z);
          if (bd < 1.3 && boardArmed) { boardArmed = false; openBoard(inside); } else if (bd > 2.6) boardArmed = true;
        } else boardArmed = true;
        const od = Math.hypot(pos.x - OFFICE_X, pos.z - (-1.75 - ROW_DZ - 1.0));
        if (od < 1.5 && officeArmed) { officeArmed = false; H.office(); } else if (od > 3.2) officeArmed = true;
      }
      const rcC = inside >= 0 ? (inside === sPB ? { x: sxOf(inside), z: 0 } : L2W(inside, 0, -3.2)) : null, bx = rcC ? (rcC.x - pos.x) * 0.4 : 0, bz = rcC ? (rcC.z - pos.z) * 0.4 : 0;
      bias.x = lerp(bias.x, bx, Math.min(1, dt * 3)); bias.z = lerp(bias.z, bz, Math.min(1, dt * 3));
      camT.x = lerp(camT.x, pos.x + bias.x, Math.min(1, dt * 5)); camT.z = lerp(camT.z, pos.z + bias.z, Math.min(1, dt * 5)); camT.y = lerp(camT.y, 0.9 + py, Math.min(1, dt * 4));
      const dd = dist * (camera.aspect < 0.9 ? 1.3 : 1) * (1 - 0.3 * zoomK), hd = Math.cos(elev) * dd, vd = Math.sin(elev) * dd;
      camera.position.set(camT.x + Math.sin(yaw) * hd, camT.y + vd, camT.z + Math.cos(yaw) * hd);
      camera.lookAt(camT);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      clouds.rotation.y += dt * 0.004; hourTick += dt; if (hourTick > 0.25) { hourTick = 0; applyTime(clockHour()); }
      waveTex.offset.x += dt * 0.3; waveTex.offset.y += dt * 0.002;   // 船往東開，海面往船尾（西）流 glTex.offset.y -= dt * 0.012;
      { const d = sun._dir || { x: 0.3, y: 0.8, z: -0.5 }; sun.position.set(camT.x + d.x * 24, d.y * 24, camT.z + d.z * 24); sun.target.position.set(camT.x, 0, camT.z); }
      layers.forEach((l) => (l.style.transform = ""));

      // 靠近哪個站點
      let nn = -1;
      if (inside >= 0) nn = inside;
      else {
        let best = -1, bd = 1e9;
        stationsX.forEach((sx, s) => { const a = anchor(s), d = Math.hypot(pos.x - a.x, pos.z - a.z); if (d < bd) { bd = d; best = s; } });
        nn = bd < (best === 0 ? NEAR + 0.6 : NEAR) ? best : -1;
      }
      const cn = chairNearIdx(), pk = sitting >= 0 ? "sit" : cn >= 0 ? "chair" + cn : (inside >= 0 ? "in" : "out") + nn;
      if (pk !== promptKey) {
        promptKey = pk; nearIdx = inside >= 0 ? -1 : nn; dots.forEach((d, i) => d.classList.toggle("on", i === nn));
        lastInfoS = (inside < 0 && sitting < 0 && cn < 0 && nn > 0) ? nn : 0; renderInfo(lastInfoS);
        if (sitting >= 0) { prompt.innerHTML = "<kbd>Enter</kbd> 起身　或按任意方向鍵"; prompt.hidden = false; }
        else if (cn >= 0) { prompt.innerHTML = chairSpots[cn].sofa ? "<kbd>Enter</kbd> 坐在毛毛蟲沙發上" : "<kbd>Enter</kbd> 坐下休息"; prompt.hidden = false; }
        else if (nn >= 0) {
          prompt.innerHTML = inside >= 0
            ? `<kbd>Enter</kbd> 查看白板 · <b>${H.esc(P[nn - 1].name)}</b> <small>　雙擊 ← 或滾輪下滑出門</small>`
            : nn === 0 ? `<kbd>Enter</kbd> 進入 <b>辦公室</b> · 儀表板總覽 <small>　滾輪上滑</small>`
              : `<kbd>Enter</kbd> 進入 <b>${H.esc(P[nn - 1].name)}</b> 房間 · ${P[nn - 1].progress ?? 0}% <small>　滾輪上滑</small>`;
          prompt.hidden = false;
        } else prompt.hidden = true;
      }
      { // 貼住門前 1 秒 → 自動進入
        let dS = -1;
        if (inside < 0 && sitting < 0 && ov.hidden && !blocked() && !route.length) for (let s = 1; s <= N; s++) { const d = dOut(s); if (Math.hypot(pos.x - d.x, pos.z - d.z) < 1.25) { dS = s; break; } }
        if (dS > 0 && speedNow < 1.2) { if (dwellS !== dS) { dwellS = dS; dwell = 0; } dwell += dt; if (dwell >= 1.0) { dwell = 0; dwellS = -1; enterRoom(dS); } } else { dwell = 0; dwellS = -1; }
        const bar = infoEl.hidden ? null : infoEl.querySelector("#gDwellBar"); if (bar) bar.style.width = Math.min(100, dwell * 100) + "%";
      }
      for (let s = 1; s <= N; s++) {
        const on = s === nn, k = Math.min(1, dt * 6);
        panelMats[s].emissiveIntensity = lerp(panelMats[s].emissiveIntensity, on && inside < 0 ? 0.28 : 0.06, k);
        boardMats[s].emissiveIntensity = lerp(boardMats[s].emissiveIntensity, on && inside >= 0 ? 0.25 : 0.1, k);
        pools[s].material.opacity = lerp(pools[s].material.opacity, on ? 0.34 : 0.14, k);
      }
      bangs.forEach((b, s) => { if (b && b.visible) { const k = 1 + Math.sin(time * 5 + s) * 0.12, sc = camera.position.distanceTo(b.position) * 0.05 * k; b.scale.set(sc, sc, 1); b.position.y = (s === 0 ? 3.3 : 2.9) + Math.sin(time * 2.4 + s) * 0.08; } });
      for (const h of tickHooks) h(dt, time);
      if (courtUpdate) courtUpdate(dt, time);

      // 屋頂 / 外牆：在外面是完整的建築，走進門才淡出屋頂、牆降低成室內視角
      insM = lerp(insM, pos.x > ENTRY + 0.4 ? 1 : 0, Math.min(1, dt * 4)); insH = lerp(insH, inHouseNow() ? 1 : 0, Math.min(1, dt * 4));
      for (const r of roofs) { const k = r.grp === "M" ? insM : r.grp === "H2" ? insH * (1 - lvlS) : insH; r.mat.opacity = 1 - k; r.mat.depthWrite = k < 0.02; r.m.visible = k < 0.97; }   // H2：二樓地板（人在一樓時消失，才看得到一樓）
      for (const w of shells) {
        if (w.grp === "U") w.m.scale.y = lerp(1, lerp(0.01, w.low, lvlS), insH);     // 二樓牆：人在二樓變矮牆，在一樓時收起來
        else { const k = w.grp === "M" ? insM : insH; w.m.scale.y = lerp(1, w.low, k); }
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);
    if (window.Director) window.Director.mount(ctx);
    if (window.Aeris) try { window.Aeris.mount(ctx); } catch (err) { console.error("Aeris 載入失敗：", err); }
    if (window.Lights) try { window.Lights.mount(ctx); } catch (err) { console.error("燈光載入失敗：", err); }
    if (window.Doors) try { window.Doors.mount(ctx); } catch (err) { console.error("自動門載入失敗：", err); }
    if (window.Music) try { window.Music.mount(ctx); } catch (err) { console.error("音樂載入失敗：", err); }
    if (window.Ship) try { window.Ship.mount(ctx); } catch (err) { console.error("郵輪載入失敗：", err); }
    if (window.Animals) try { window.Animals.mount(ctx); } catch (err) { console.error("動物載入失敗：", err); }
    if (window.Presence) try { window.Presence.mount(ctx); } catch (err) { console.error("兩人同步載入失敗：", err); }

    S = {
      root, cv, renderer, raf: () => cancelAnimationFrame(raf), onKey, clearKeys, resize, refreshBangs, onStore, scene, closeBoard, camera, sun, openBoard, teleport: (x, z, up) => { pos.x = x; pos.z = z; camT.x = x; camT.z = z; if (up !== undefined) { lvl = up ? 1 : 0; py = lvl * UY; } }, getState: () => ({ x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), y: +py.toFixed(2), jy: +jy.toFixed(2), lvl, inside, nearIdx, route: route.length, tgt: route[0] ? [+route[0].x.toFixed(2), +route[0].z.toFixed(2)] : null, sitting, overlay: !ov.hidden, armed: boardArmed }), obstacles, exitRoom: () => { if (inside >= 0) { exitRoom(); return true; } return false; }, skipIntro: () => { if (wake) { wake.skipped = true; wake.t = 99; } }, walkTo: (x, z) => { sitting >= 0 && stand(); goRoute(sternRoute({ x, z })); }, setHour: (h) => { hourOverride = h; applyTime(clockHour()); }, getHour: () => hourNow, stepFrames: (n = 1, ms = 50, cb) => { let nowT = Math.max(performance.now(), last + 1); for (let i = 0; i < n; i++) { nowT += ms; const keep = raf; tick(nowT); cancelAnimationFrame(raf); raf = keep; if (cb) cb(i); } },   // 測試用：面板被藏起來時手動推進畫面
      
    };
    api.active = true; api.debug = S; document.body.classList.add("gl3d");
    return true;
  }

  function unmount() {
    if (!S) return;
    S.raf();
    window.removeEventListener("keydown", S.onKey); window.removeEventListener("keyup", S.onKey);
    window.removeEventListener("blur", S.clearKeys); document.removeEventListener("visibilitychange", S.clearKeys); window.removeEventListener("resize", S.resize);
    window.removeEventListener("news:change", S.refreshBangs); window.removeEventListener("store:change", S.onStore);
    if (window.Director) window.Director.unmount(); if (window.Lights) window.Lights.unmount(); if (window.Doors) window.Doors.unmount(); if (window.Music) window.Music.unmount(); if (window.Ship) window.Ship.unmount(); if (window.Animals) window.Animals.unmount(); if (window.Presence) window.Presence.unmount(); if (window.Aeris) window.Aeris.unmount(); document.body.classList.remove("board-open", "dir-typing");
    S.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }); } });
    S.renderer.dispose(); S.renderer.forceContextLoss && S.renderer.forceContextLoss(); S.cv.remove();
    S = null; api.active = false; document.body.classList.remove("gl3d");
  }
})();
