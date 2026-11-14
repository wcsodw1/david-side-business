/* ============================================================
   角色臉部 / 髮型（David 與 ARIES）：
   · 照著使用者提供的真人照片「看長相」手繪而成（程式繪製，照片本身不放進網站、不進 GitHub）
   · 頭型：高解析度（128×96）曲面，額頭、眉骨、眼窩、鼻樑 / 鼻頭、顴骨、嘴唇、下巴都有立體起伏
   · 臉部貼圖：2048×2048，眼睛（虹膜 / 瞳孔 / 反光 / 睫毛 / 雙眼皮）、眉毛（一根一根畫）、鼻影、嘴唇、雀斑…
   · 髮型：David 黑色短髮、瀏海斜斜帶過額頭；ARIES 深棕色長髮、通透的空氣瀏海、小耳環
   用法：Faces.apply(THREE, av, "david" | "aeris")  —— av 是 buildAvatar 做出來的人物
   ============================================================ */
(() => {
  "use strict";
  const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gs = (x, s) => Math.exp(-(x * x) / (2 * s * s));
  const D2R = PI / 180;
  // 穿搭（參考使用者的照片）：David = 黑色短袖 T、淺色長褲、白色球鞋、銀色項鍊、黑框眼鏡；ARIES = 深灰寬鬆 T、深色寬褲、白球鞋
  const OPTS = {
    david: { blazer: 0x141417, shirt: 0x141417, pants: 0xe8e5de, shoe: 0xf2f2f2, skin: 0xe0ac8a, hair: 0x14100e },
    aeris: { blazer: 0x7b5b4e, shirt: 0x7b5b4e, pants: 0x2b2725, shoe: 0xf2f2f2, skin: 0xf0cbb0, hair: 0x2a1a13 },
  };
  const api = (window.Faces = { apply, opts: (who) => OPTS[who] });
  const cache = {};

  /* 兩個人的長相參數（單位：頭部座標 ux, uy ∈ [-1, 1]；ux 左右、uy 上下，眼睛線約在 uy = 0.06） */
  const SPEC = {
    david: {
      skin: "#e0ac8a", skinShade: "#b9805f", hair: "#14100e", hairHi: "#4a4039", lip: "#b87868", iris: "#2b1a10",
      W: 0.098, H: 0.122, D: 0.108, taper: 0.1, sq: 0.16, long: 0.05, chin: 0.009, brow: 0.0075, browY: 0.235, socket: 0.0048, eyeX: 0.385, eyeY: 0.05,
      noseH: 0.014, noseW: 1.0, cheek: 0.0035, lip3d: 0.0065, mouthY: -0.5,
      eye: { hw: 0.18, hh: 0.056, iris: 0.062, tilt: 0.0, crease: 0.35, lash: 0.4, liner: 0.8 },
      brows: { y: 0.215, inner: 0.15, outer: 0.64, thick: 0.055, arch: 0.006, slope: -0.01, color: "#15110f", n: 520 },
      mouth: { w: 0.22, up: 0.044, lo: 0.074, sad: 0.006 },
      nose: { w: 0.125, tipY: -0.2, shade: 0.2 }, stubble: 0.16, freckles: 0, blush: 0.05,
    },
    aeris: {
      skin: "#f2cdb6", skinShade: "#d9a58b", hair: "#44291f", hairHi: "#97684f", lip: "#e08f8a", iris: "#3a2316",
      W: 0.094, H: 0.118, D: 0.102, taper: 0.15, sq: 0, long: 0.02, chin: 0.006, brow: 0.003, browY: 0.285, socket: 0.003, eyeX: 0.375, eyeY: 0.04,
      noseH: 0.009, noseW: 0.8, cheek: 0.008, lip3d: 0.0062, mouthY: -0.5,
      eye: { hw: 0.165, hh: 0.088, iris: 0.074, tilt: -0.01, crease: 1, lash: 1, liner: 0.5 },
      brows: { y: 0.215, inner: 0.19, outer: 0.58, thick: 0.026, arch: 0.026, slope: 0.0, color: "#6a4838", n: 150 },
      mouth: { w: 0.16, up: 0.036, lo: 0.074, sad: -0.006 },
      nose: { w: 0.1, tipY: -0.19, shade: 0.14 }, stubble: 0, freckles: 130, blush: 0.42,
    },
  };

  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 可重現的亂數（每次開網站眼睫毛 / 雀斑位置都一樣）
  let seed = 7; const srand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const srnd = (a, b) => a + srand() * (b - a);

  /* ---------- 頭型 ---------- */
  function headGeometry(THREE, s) {
    const g = new THREE.SphereGeometry(1, 128, 96), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let X = x * s.W, Y = y * s.H * (y < 0 ? 1 + (s.long || 0) * sm(0, -0.8, y) : 1), Z = z * s.D;
      const low = sm(-0.02, -1, y), w = sm(0.05, 0.55, z);
      X *= 1 - s.taper * Math.pow(low, 1.25);                                 // 下顎收窄
      X *= 1 + s.sq * gs(y + 0.52, 0.2) * sm(0.2, 0.7, Math.abs(x) + 0.3);     // 方一點的下顎線（David）
      Z *= 1 - 0.12 * low;
      if (z > 0) Z += s.chin * gs(x, 0.3) * gs(y + 0.86, 0.17);               // 下巴
      Z += w * s.brow * gs(y - s.browY, 0.1) * sm(0.85, 0.2, Math.abs(x));    // 眉骨
      for (const sx of [-1, 1]) {
        Z -= w * s.socket * gs(x - sx * s.eyeX, 0.19) * gs(y - s.eyeY, 0.11);   // 眼窩
        Z += w * s.cheek * gs(x - sx * 0.52, 0.24) * gs(y + 0.18, 0.2);          // 顴骨 / 蘋果肌
        Z += w * s.noseH * 0.42 * gs(x - sx * 0.13 * s.noseW, 0.06) * gs(y + 0.2, 0.065);   // 鼻翼
      }
      const prof = sm(0.14, -0.2, y) * (1 - sm(-0.2, -0.32, y));
      Z += w * s.noseH * prof * gs(x, 0.058 + 0.05 * sm(0.0, -0.2, y));        // 鼻樑
      Z += w * s.noseH * 0.4 * gs(x, 0.1) * gs(y + 0.2, 0.07);                  // 鼻頭
      Z += w * s.lip3d * gs(x, 0.21) * gs(y - s.mouthY - 0.02, 0.075);          // 嘴唇
      Z -= w * 0.0028 * gs(x, 0.035) * gs(y - s.mouthY - 0.11, 0.04);           // 人中
      Z -= w * 0.003 * gs(x, 0.2) * gs(y - s.mouthY + 0.14, 0.05);               // 下唇下方凹陷
      p.setXYZ(i, X, 0.085 + Y, Z);
      uv.setXY(i, z >= 0 ? 0.5 + x * 0.5 : 0.5 + (x < 0 ? -0.5 : 0.5), 0.5 + y * 0.5);   // 正面平面投影；背面用邊緣色
    }
    g.computeVertexNormals();
    return g;
  }

  /* ---------- 臉部貼圖 ---------- */
  function faceTexture(THREE, s) {
    const S = 2048, c = mk(S, S), g = c.getContext("2d");
    const X = (ux) => (ux + 1) * S / 2, Y = (uy) => (1 - uy) * S / 2, R = (u) => u * S / 2;
    // 底色：自然的膚色漸層（額頭亮、下巴與兩側稍暗）
    g.fillStyle = s.skin; g.fillRect(0, 0, S, S);
    let gr = g.createRadialGradient(X(0), Y(0.15), R(0.1), X(0), Y(0.1), R(1.0)); gr.addColorStop(0, "rgba(255,255,255,.10)"); gr.addColorStop(0.6, "rgba(255,255,255,0)"); gr.addColorStop(1, s.skinShade + "66"); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(${srand() < 0.5 ? "255,235,220" : "120,70,50"},${srnd(0.015, 0.05)})`; g.beginPath(); g.arc(srnd(0, S), srnd(0, S), srnd(1, 3.5), 0, 7); g.fill(); }   // 皮膚細微顆粒
    const blob = (cx, cy, rx, ry, col, a) => { g.save(); g.translate(X(cx), Y(cy)); g.scale(1, ry / rx); const q = g.createRadialGradient(0, 0, 0, 0, 0, R(rx)); q.addColorStop(0, col.replace("A", a)); q.addColorStop(1, col.replace("A", 0)); g.fillStyle = q; g.beginPath(); g.arc(0, 0, R(rx), 0, 7); g.fill(); g.restore(); };
    // 腮紅 + 臉頰紅暈 + 額頭高光 + 眼窩淡影
    for (const sx of [-1, 1]) { blob(sx * 0.5, -0.16, 0.28, 0.2, "rgba(238,112,126,A)", s.blush); blob(sx * s.eyeX, s.eyeY + 0.02, 0.22, 0.13, "rgba(150,90,70,A)", 0.12); blob(sx * 0.62, -0.5, 0.2, 0.22, "rgba(120,70,50,A)", 0.1); }
    blob(0, 0.5, 0.35, 0.18, "rgba(255,248,240,A)", 0.1);
    blob(0, -0.88, 0.3, 0.1, "rgba(130,80,60,A)", 0.14);   // 下巴下緣陰影

    // 鼻子：兩側鼻翼的陰影、鼻頭高光、鼻孔
    const nz = s.nose;
    for (const sx of [-1, 1]) {
      blob(sx * (nz.w * 0.62), (nz.tipY + 0.1) / 2, 0.05, 0.2, "rgba(105,55,40,A)", nz.shade + 0.1);
      blob(sx * nz.w * 0.95, nz.tipY - 0.01, 0.065, 0.045, "rgba(110,60,45,A)", nz.shade + 0.05);
      g.fillStyle = "rgba(60,25,20,.55)"; g.beginPath(); g.ellipse(X(sx * nz.w * 0.55), Y(nz.tipY - 0.055), R(0.034), R(0.017), sx * -0.3, 0, 7); g.fill();   // 鼻孔
    }
    blob(0, nz.tipY + 0.02, 0.06, 0.04, "rgba(255,240,225,A)", 0.09); blob(0, 0.0, 0.04, 0.18, "rgba(255,240,225,A)", 0.04); blob(0, nz.tipY - 0.09, 0.14, 0.05, "rgba(110,60,45,A)", 0.16);

    // 嘴唇
    const m = s.mouth, my = s.mouthY;
    const lipPath = (up) => {
      g.beginPath();
      if (up) { g.moveTo(X(-m.w), Y(my - m.sad)); g.bezierCurveTo(X(-m.w * 0.6), Y(my + m.up * 1.2), X(-m.w * 0.22), Y(my + m.up * 1.35), X(-m.w * 0.1), Y(my + m.up * 1.05)); g.quadraticCurveTo(X(0), Y(my + m.up * 0.7), X(m.w * 0.1), Y(my + m.up * 1.05)); g.bezierCurveTo(X(m.w * 0.22), Y(my + m.up * 1.35), X(m.w * 0.6), Y(my + m.up * 1.2), X(m.w), Y(my - m.sad)); g.quadraticCurveTo(X(0), Y(my - m.up * 0.15), X(-m.w), Y(my - m.sad)); }
      else { g.moveTo(X(-m.w), Y(my - m.sad)); g.quadraticCurveTo(X(0), Y(my - m.up * 0.15), X(m.w), Y(my - m.sad)); g.bezierCurveTo(X(m.w * 0.6), Y(my - m.lo * 1.15), X(m.w * 0.25), Y(my - m.lo * 1.3), X(0), Y(my - m.lo * 1.3)); g.bezierCurveTo(X(-m.w * 0.25), Y(my - m.lo * 1.3), X(-m.w * 0.6), Y(my - m.lo * 1.15), X(-m.w), Y(my - m.sad)); }
      g.closePath();
    };
    for (const up of [true, false]) {
      lipPath(up); const lg = g.createLinearGradient(0, Y(my + m.up), 0, Y(my - m.lo)); lg.addColorStop(0, shade(s.lip, up ? -18 : -4)); lg.addColorStop(1, shade(s.lip, up ? -6 : 14)); g.fillStyle = lg; g.fill();
    }
    g.strokeStyle = "rgba(90,35,35,.7)"; g.lineWidth = R(0.007); g.lineCap = "round"; g.beginPath(); g.moveTo(X(-m.w), Y(my - m.sad)); g.quadraticCurveTo(X(0), Y(my - m.up * 0.15), X(m.w), Y(my - m.sad)); g.stroke();   // 唇縫
    blob(-0.02, my - m.lo * 0.6, 0.07, 0.03, "rgba(255,255,255,A)", 0.3);   // 下唇高光
    blob(0, my - m.lo * 1.55, 0.14, 0.04, "rgba(110,60,45,A)", 0.18);        // 下唇下方陰影
    for (const sx of [-1, 1]) blob(sx * (m.w + 0.025), my - m.sad, 0.035, 0.03, "rgba(100,45,40,A)", 0.3);   // 嘴角

    // 雀斑（ARIES）/ 鬍渣陰影（David）
    for (let i = 0; i < s.freckles; i++) {
      const cheek = srand() < 0.78, sx = srand() < 0.5 ? -1 : 1;
      const px = cheek ? sx * (0.42 + (srand() + srand() - 1) * 0.3) : (srand() + srand() - 1) * 0.1, py = cheek ? -0.08 + (srand() + srand() - 1) * 0.2 : 0.02 - srand() * 0.2;
      g.fillStyle = `rgba(${150 + Math.floor(srand() * 20)},${85 + Math.floor(srand() * 15)},50,${srnd(0.22, 0.6)})`; g.beginPath(); g.ellipse(X(px), Y(py), R(srnd(0.004, 0.011)), R(srnd(0.004, 0.009)), srand() * 3, 0, 7); g.fill();
    }
    if (s.stubble) for (let i = 0; i < 9000; i++) { const px = srnd(-0.8, 0.8), py = srnd(-1, -0.3); const inMouth = Math.abs(px) < m.w + 0.05 && Math.abs(py - my) < 0.1; if (inMouth) continue; const wgt = sm(-0.3, -0.85, py) * (Math.abs(px) < 0.75 ? 1 : 0.3) + gs(py - (my + 0.12), 0.08) * gs(px, 0.4) * 0.8; if (srand() > wgt) continue; g.fillStyle = `rgba(40,30,28,${s.stubble * srnd(0.4, 1)})`; g.fillRect(X(px), Y(py), 2, 2); }

    // 眼睛
    const E = s.eye;
    for (const sx of [-1, 1]) drawEye(g, X, Y, R, sx, s, E);
    // 眉毛：一根一根畫
    const B = s.brows;
    for (const sx of [-1, 1]) {
      g.save(); g.strokeStyle = B.color;
      const cy = (t) => B.y + B.arch * Math.sin(PI * Math.pow(t, 0.8)) * 1.0 - B.slope * t * 4, cx = (t) => sx * (B.inner + (B.outer - B.inner) * t);
      const th = (t) => B.thick * (1 - 0.6 * t) * (0.6 + 0.4 * Math.sin(PI * clamp(t * 1.15, 0, 1)));
      g.globalAlpha = 0.2; g.lineCap = "round"; g.lineWidth = R(0.03); g.beginPath(); for (let k = 0; k <= 20; k++) { const t = k / 20; k ? g.lineTo(X(cx(t)), Y(cy(t))) : g.moveTo(X(cx(t)), Y(cy(t))); } g.stroke();
      for (let i = 0; i < B.n; i++) {
        const t = srand(), off = srnd(-0.5, 0.5) * th(t), x0 = cx(t), y0 = cy(t) + off, dir = sx * (0.5 + 0.9 * (1 - t) * (t < 0.5 ? 1 : 0.2)), len = srnd(0.025, 0.045);
        const ang = (t < 0.4 ? PI / 2 - 0.35 : 0.28) * (t < 0.4 ? 1 : 1);   // 眉頭向上、眉尾向外
        const dx = sx * Math.cos(t < 0.35 ? 1.1 : 0.25) * len, dy = Math.sin(t < 0.35 ? 1.1 : 0.25) * len * (t < 0.35 ? 1 : -0.4 + 0.5 * B.arch);
        g.globalAlpha = srnd(0.35, 0.85); g.lineWidth = srnd(1.2, 2.6) * (S / 2048); g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x0 + dx), Y(y0 + dy)); g.stroke();
      }
      g.restore();
    }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.encoding = THREE.sRGBEncoding; tex.needsUpdate = true;
    return tex;
  }
  function shade(hex, d) { const n = parseInt(hex.slice(1), 16), f = (v) => clamp(v + d, 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }

  function drawEye(g, X, Y, R, sx, s, E) {
    const ex = sx * s.eyeX, ey = s.eyeY, N = 48, up = [], lo = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, x = ex + sx * (t * 2 - 1) * E.hw, tilt = E.tilt * (t - 0.5) * E.hw * 6, sn = Math.pow(Math.sin(PI * t), 0.85), bias = 1 + 0.18 * Math.sin(PI * (t - 0.1));
      up.push([x, ey + tilt + E.hh * sn * bias]); lo.push([x, ey + tilt - E.hh * 0.55 * Math.pow(Math.sin(PI * t), 1.1)]);
    }
    const path = () => { g.beginPath(); up.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); for (let i = lo.length - 1; i >= 0; i--) g.lineTo(X(lo[i][0]), Y(lo[i][1])); g.closePath(); };
    // 眼窩陰影與雙眼皮折線
    g.save(); g.lineCap = "round";
    const crease = (off, a, wd) => { g.strokeStyle = `rgba(110,65,50,${a})`; g.lineWidth = R(wd); g.beginPath(); up.forEach(([x, y], i) => { const xx = x, yy = y + off * Math.sin(PI * clamp(i / N * 1.05, 0, 1)) + 0.012; i ? g.lineTo(X(xx), Y(yy)) : g.moveTo(X(xx), Y(yy)); }); g.stroke(); };
    if (E.crease >= 1) { crease(E.hh * 0.78, 0.55, 0.007); crease(E.hh * 0.92, 0.18, 0.016); } else { crease(E.hh * 0.62, 0.32 * E.crease, 0.005); }
    g.restore();
    // 眼白 + 虹膜（clip 在眼型裡）
    g.save(); path(); g.clip();
    let sc = g.createLinearGradient(0, Y(ey + E.hh), 0, Y(ey - E.hh)); sc.addColorStop(0, "#d9cfc6"); sc.addColorStop(0.45, "#f6f1ea"); sc.addColorStop(1, "#efe3dc"); g.fillStyle = sc; g.fillRect(X(ex - 0.3), Y(ey + 0.2), R(0.6), R(0.4));
    const ix = ex + sx * 0.005, iy = ey + E.hh * 0.05, ir = R(E.iris);
    let ig = g.createRadialGradient(X(ix), Y(iy + E.iris * 0.15), ir * 0.08, X(ix), Y(iy), ir);
    ig.addColorStop(0, shade(s.iris, 55)); ig.addColorStop(0.55, shade(s.iris, 15)); ig.addColorStop(0.9, shade(s.iris, -22)); ig.addColorStop(1, "#0c0705"); g.fillStyle = ig; g.beginPath(); g.arc(X(ix), Y(iy), ir, 0, 7); g.fill();
    g.strokeStyle = "rgba(15,8,5,.9)"; g.lineWidth = ir * 0.14; g.beginPath(); g.arc(X(ix), Y(iy), ir * 0.94, 0, 7); g.stroke();   // 虹膜外圈
    for (let i = 0; i < 40; i++) { const a = srand() * PI * 2, r0 = ir * 0.3, r1 = ir * srnd(0.6, 0.92); g.strokeStyle = `rgba(${srand() < 0.5 ? "20,10,5" : "170,120,80"},${srnd(0.12, 0.3)})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X(ix) + Math.cos(a) * r0, Y(iy) + Math.sin(a) * r0); g.lineTo(X(ix) + Math.cos(a) * r1, Y(iy) + Math.sin(a) * r1); g.stroke(); }   // 虹膜紋路
    g.fillStyle = "#050302"; g.beginPath(); g.arc(X(ix), Y(iy), ir * 0.42, 0, 7); g.fill();   // 瞳孔
    g.fillStyle = "rgba(255,255,255,.95)"; g.beginPath(); g.ellipse(X(ix - sx * E.iris * 0.32), Y(iy + E.iris * 0.38), ir * 0.2, ir * 0.17, 0, 0, 7); g.fill();       // 主反光
    g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.arc(X(ix + sx * E.iris * 0.3), Y(iy - E.iris * 0.3), ir * 0.09, 0, 7); g.fill();
    const sh = g.createLinearGradient(0, Y(ey + E.hh * 1.1), 0, Y(ey - E.hh * 0.1)); sh.addColorStop(0, "rgba(40,20,15,.6)"); sh.addColorStop(0.5, "rgba(40,20,15,.12)"); sh.addColorStop(1, "rgba(40,20,15,0)"); g.fillStyle = sh; g.fillRect(X(ex - 0.3), Y(ey + 0.2), R(0.6), R(0.4));   // 上眼皮落在眼球上的影子
    g.restore();
    // 內眼角淚阜、下眼瞼、上眼線與睫毛
    g.fillStyle = "rgba(205,110,105,.7)"; g.beginPath(); g.ellipse(X(ex - sx * E.hw * 0.95), Y(ey - E.hh * 0.05), R(0.014), R(0.011), 0, 0, 7); g.fill();
    g.strokeStyle = "rgba(150,85,70,.55)"; g.lineWidth = R(0.0045); g.beginPath(); lo.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
    g.strokeStyle = "rgba(20,10,8,.95)"; g.lineCap = "round"; g.lineWidth = R(0.011 * (0.5 + E.liner)); g.beginPath(); up.forEach(([x, y], i) => { const w0 = i / N; i ? g.lineTo(X(x), Y(y + 0.002)) : g.moveTo(X(x), Y(y + 0.002)); }); g.stroke();
    g.lineWidth = R(0.007 * (0.5 + E.liner)); g.beginPath(); for (let i = Math.floor(N * 0.55); i <= N; i++) { const [x, y] = up[i]; const ox = sx * (i / N - 0.55) * 0.05; i === Math.floor(N * 0.55) ? g.moveTo(X(x), Y(y + 0.003)) : g.lineTo(X(x + ox), Y(y + 0.006 + (i / N - 0.55) * 0.012)); } g.stroke();   // 眼尾線
    const nl = Math.floor(22 * E.lash) + 10;
    for (let i = 0; i < nl; i++) {
      const t = 0.12 + 0.88 * (i / (nl - 1)), k = Math.round(t * N), [x, y] = up[k], len = srnd(0.018, 0.034) * (0.6 + E.lash * 0.7) * (0.6 + 0.6 * t), ang = (PI / 2 - 0.15) + sx * -(0.2 + t * 0.9) * -1;
      g.strokeStyle = `rgba(20,10,8,${srnd(0.55, 0.95)})`; g.lineWidth = srnd(1.6, 3) * (X(1) / 1024); g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x) + sx * Math.cos(0.9 - t * 0.5) * R(len) * 0.9, Y(y) - Math.sin(0.9 - t * 0.5) * R(len) * 1.1 + (srand() - 0.5) * 2); g.stroke();
    }
  }

  /* ---------- 頭髮 ---------- */
  function strandTexture(THREE, base, hi, opts = {}) {
    const W = 1024, H = 1024, c = mk(W, H), g = c.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { const x = srnd(0, W), l = srnd(120, 520), y = srnd(-100, H); g.strokeStyle = `${srand() < 0.35 ? hi : "#000"}`; g.globalAlpha = srnd(0.05, 0.22); g.lineWidth = srnd(1, 3); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + srnd(-10, 10), y + l * 0.3, x + srnd(-14, 14), y + l * 0.7, x + srnd(-10, 10), y + l); g.stroke(); }
    g.globalAlpha = 1;
    if (opts.sheen) { const q = g.createLinearGradient(0, 0, 0, H); q.addColorStop(0, "rgba(255,255,255,0)"); q.addColorStop(opts.sheen, "rgba(255,255,255,.16)"); q.addColorStop(Math.min(1, opts.sheen + 0.12), "rgba(255,255,255,0)"); g.fillStyle = q; g.fillRect(0, 0, W, H); }
    if (opts.part) { g.strokeStyle = "rgba(10,6,4,.9)"; g.lineWidth = 7; g.beginPath(); g.moveTo(W * opts.part, H); g.lineTo(W * opts.part, H * 0.74); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
  }
  function capGeometry(THREE, s, thMax, kFn) {
    const g = new THREE.SphereGeometry(1, 128, 80), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.acos(clamp(y, -1, 1)), ph = Math.atan2(z, -x), a0 = ph - PI / 2, A = Math.atan2(Math.sin(a0), Math.cos(a0));
      const tm = thMax(A), t2 = Math.min(th, tm), k = kFn(t2, A, th > tm);
      p.setXYZ(i, -Math.cos(ph) * Math.sin(t2) * s.W * k, 0.085 + Math.cos(t2) * s.H * k, Math.sin(ph) * Math.sin(t2) * s.D * k);
    }
    g.computeVertexNormals(); return g;
  }
  const lerpTab = (tab, v) => { for (let i = 1; i < tab.length; i++) if (v <= tab[i][0]) { const [a, b] = [tab[i - 1], tab[i]]; return a[1] + (b[1] - a[1]) * (v - a[0]) / (b[0] - a[0]); } return tab[tab.length - 1][1]; };

  function davidHair(THREE, s) {
    const grp = new THREE.Group(), tex = strandTexture(THREE, s.hair, s.hairHi, { sheen: 0.16 });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.04, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    // 底層髮片：額頭上緣到耳朵上緣、後面到髮際線
    const line = [[0, 56], [0.45, 59], [1.0, 70], [1.45, 86], [2.0, 106], [3.2, 140]].map(([a, d]) => [a, d * D2R]);
    const thMax = (A) => lerpTab(line, Math.abs(A));
    const kF = (t, A, col) => 1.03 + 0.012 * sm(1.0, 2.8, Math.abs(A)) + 0.03 * sm(1.0, 0.15, t) + (col ? -0.01 : 0);
    const cap = new THREE.Mesh(capGeometry(THREE, s, thMax, kF), mat); cap.castShadow = true; grp.add(cap);
    // 髮束：從頭頂中分線出發，往兩側帶開，髮尾落在額角與耳朵上方（一綹一綹疊起來，才有真的頭髮質感）
    const P = (A, th, k) => new THREE.Vector3(Math.sin(A) * Math.sin(th) * s.W * k, 0.085 + Math.cos(th) * s.H * k, Math.cos(A) * Math.sin(th) * s.D * k);
    const m = 11;
    for (const sx of [-1, 1]) for (let i = 0; i < m; i++) {
      const t = i / (m - 1), Ae = sx * (0.35 + t * 1.35), the = lerpTab(line, Math.abs(Ae)) - 0.03 - 0.02 * (1 - t), As = sx * (0.2 + 0.35 * t), ths = (32 + 24 * t) * D2R, pts = [];
      for (let f = 0; f <= 1.001; f += 0.2) { const A = As + (Ae - As) * Math.pow(f, 0.85) + sx * 0.05 * Math.sin(f * 6 + i), th = ths + (the - ths) * f; pts.push(P(A, th, 1.05 + 0.045 * Math.sin(Math.PI * Math.min(1, f * 1.05)) + 0.012 * (i % 3))); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.0085 + 0.0012 * (i % 2), 6, false), mat); tube.castShadow = true; grp.add(tube);
    }
    return grp;
  }

  function aerisHair(THREE, s) {
    const grp = new THREE.Group(), tex = strandTexture(THREE, s.hair, s.hairHi, { sheen: 0.14, part: 0.25 - 0.06 / (2 * PI) });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.04, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    const P = (A, th, k) => new THREE.Vector3(Math.sin(A) * Math.sin(th) * s.W * k, 0.085 + Math.cos(th) * s.H * k, Math.cos(A) * Math.sin(th) * s.D * k);
    const ribbon = (pts, w0, seg = 36, taper = 0.55) => {   // 沿著曲線的扁平髮片：寬度往髮尾漸細，面朝外
      const cur = new THREE.CatmullRomCurve3(pts), ps = cur.getPoints(seg), pos = [], uv = [], idx = [], c0 = new THREE.Vector3(0, 0.085, 0);
      for (let k = 0; k < ps.length; k++) {
        const f = k / (ps.length - 1), T = cur.getTangent(f), n = ps[k].clone().sub(c0).normalize(), sd = new THREE.Vector3().crossVectors(T, n).normalize(), w = w0 * (1 - taper * Math.pow(f, 1.6)) * 0.5;
        pos.push(ps[k].x - sd.x * w, ps[k].y - sd.y * w, ps[k].z - sd.z * w, ps[k].x + sd.x * w, ps[k].y + sd.y * w, ps[k].z + sd.z * w); uv.push(0, f * 2, 1, f * 2);
        if (k) { const a = (k - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.castShadow = true; grp.add(m); return m;
    };
    // 頭頂髮片：中分，兩側蓋住太陽穴與耳朵上緣，後面到頸後
    const line = [[0, 50], [0.7, 58], [1.2, 88], [1.8, 112], [2.6, 140], [3.2, 152]].map(([a, d]) => [a, d * D2R]);
    const cap = new THREE.Mesh(capGeometry(THREE, s, (A) => lerpTab(line, Math.abs(A)), (t, A, col) => 1.05 + 0.03 * sm(1.0, 0.2, t) + (col ? -0.012 : 0)), mat); cap.castShadow = true; grp.add(cap);
    // 後面的長髮：貼著後腦與脖子垂到背上（波浪）
    const nA = 90, nT = 30, pos = [], uvs = [], idx = [];
    for (let ia = 0; ia <= nA; ia++) for (let it = 0; it <= nT; it++) {
      const f = ia / nA, a = (96 + f * 168) * D2R, t = it / nT, wave = Math.sin(a * 9 + t * 6) * 0.012 * t, bot = -0.4 + 0.04 * Math.sin(a * 4) - 0.02 * Math.abs(Math.cos(a)), y = 0.1 + (bot - 0.1) * t;
      const rx = 0.106 + 0.07 * sm(0.0, 1, t) + wave, rz = 0.1 + 0.075 * sm(0.0, 1, t) + wave;
      pos.push(Math.sin(a) * rx, y, Math.cos(a) * rz - 0.01 * t); uvs.push(f * 3, 1 - t);
    }
    for (let ia = 0; ia < nA; ia++) for (let it = 0; it < nT; it++) { const a = ia * (nT + 1) + it, b = a + nT + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); bg.setIndex(idx); bg.computeVertexNormals();
    const back = new THREE.Mesh(bg, mat); back.castShadow = true; grp.add(back);
    // 臉兩側的長髮束：從頭頂中分線 → 沿著頭皮到太陽穴 → 垂過肩膀落在胸前（一綹一綹，有波浪）
    const nL = 12;
    for (const sx of [-1, 1]) for (let i = 0; i < nL; i++) {
      const u = i / (nL - 1), pts = [];
      const As = sx * (0.05 + 0.1 * u), ths = (12 + 8 * u) * D2R, At = sx * (1.18 + 0.28 * u), tht = (96 + 6 * (1 - u)) * D2R;
      for (let f = 0; f <= 1.001; f += 0.25) pts.push(P(As + (At - As) * Math.pow(f, 0.8), ths + (tht - ths) * Math.pow(f, 0.9), 1.07 + 0.03 * Math.sin(Math.PI * f) + 0.01 * (i % 3)));
      const th = pts[pts.length - 1], w = (k) => Math.sin(i * 1.9 + k * 2.2) * 0.013;
      pts.push(new THREE.Vector3(sx * (Math.abs(th.x) + 0.012), th.y - 0.05, th.z * 0.9 + 0.014));
      pts.push(new THREE.Vector3(sx * (0.128 + 0.012 * u + w(1)), -0.06, 0.092 + 0.01 * u));
      const L = -0.3 - 0.11 * (((i * 37) % 10) / 10), fl = 0.012 + 0.03 * (((i * 53) % 10) / 10);   // 長短不一的層次、髮尾往外翹
      pts.push(new THREE.Vector3(sx * (0.138 + 0.014 * u + w(2)), -0.17 + 0.02 * (L + 0.3), 0.118 + 0.01 * u));
      pts.push(new THREE.Vector3(sx * (0.142 + 0.016 * u + w(3) + 0.4 * fl), L * 0.8, 0.124 + 0.008 * u));
      pts.push(new THREE.Vector3(sx * (0.145 + 0.016 * u + w(4) + fl), L, 0.122 + 0.012 * (i % 3)));
      ribbon(pts, 0.05 + 0.005 * (i % 2), 40, 0.8);
    }
    // 通透的空氣瀏海：從中分線往兩側帶開，髮尾落在眉毛到顴骨之間（細髮絲，看得到額頭）
    const nB = 17;
    for (const sx of [-1, 1]) for (let i = 0; i < nB; i++) {
      const u = i / (nB - 1), As = sx * 0.03, Am = sx * (0.35 + 0.25 * u), Ae = sx * (0.7 + 0.35 * u), pts = [];
      pts.push(P(As, 18 * D2R, 1.06)); pts.push(P(Am, (52 + 8 * u) * D2R, 1.07)); pts.push(P(Ae * 0.9, (74 + 8 * u) * D2R, 1.075)); pts.push(P(Ae, (92 + 18 * u) * D2R, 1.06 - 0.01 * u));
      ribbon(pts, 0.015, 22, 0.8);
    }
    return grp;
  }

  function apply(THREE, av, who) {
    if (!av || !av.head || av.faceDone) return av;
    const s = SPEC[who]; if (!s) return av;
    const C = cache[who] || (cache[who] = {});
    if (!C.geo) { seed = 11; C.geo = headGeometry(THREE, s); C.tex = faceTexture(THREE, s); C.mat = new THREE.MeshStandardMaterial({ map: C.tex, roughness: 0.52, metalness: 0, envMapIntensity: 0.5 }); }
    const head = av.head;
    head.children.slice().forEach((m) => { m.visible = false; });   // 把舊的簡易五官與頭髮藏起來
    const face = new THREE.Mesh(C.geo, C.mat); face.castShadow = true; head.add(face);
    head.position.y -= 0.016;   // 頭稍微往下，脖子不會太長
    if (av.torso) av.torso.children.forEach((m) => { if (m.isMesh && m.geometry && m.geometry.parameters && m.geometry.parameters.radiusTop === 0.052) m.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade(s.skin, -16)), roughness: 0.6 }); });
    const skinM = new THREE.MeshStandardMaterial({ color: new THREE.Color(shade(s.skin, -14)), roughness: 0.6 });
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), skinM); ear.position.set(sx * (s.W - 0.002), 0.075, -0.004); ear.scale.set(0.5, 1.15, 0.85); head.add(ear); }
    seed = 23;
    const hair = who === "david" ? davidHair(THREE, s) : aerisHair(THREE, s); head.add(hair);
    const silver = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.25, metalness: 0.9 });
    if (who === "aeris") for (const sx of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0017, 8, 20), silver); ring.position.set(sx * (s.W + 0.004), 0.04, -0.004); ring.rotation.y = PI / 2; head.add(ring); }   // 小耳環
    if (who === "david") {   // 黑框眼鏡
      const rr = (w, h, r) => { const sh = new THREE.Shape(), x = -w / 2, y = -h / 2; sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); return sh; };
      const outer = rr(0.052, 0.036, 0.0135); outer.holes.push(rr(0.0455, 0.0295, 0.0105));
      const fg = new THREE.ExtrudeGeometry(outer, { depth: 0.0045, bevelEnabled: false }), frameM = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.3, metalness: 0.2 });
      const lensM = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, roughness: 0.05, transparent: true, opacity: 0.1, depthWrite: false });
      const gy = 0.094, gz = 0.112;
      for (const sx of [-1, 1]) {
        const fr = new THREE.Mesh(fg, frameM); fr.position.set(sx * 0.0345, gy, gz); head.add(fr);
        const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.03), lensM); ln.position.set(sx * 0.0345, gy, gz + 0.002); head.add(ln);
        const dx = sx * (s.W - 0.002) - sx * 0.0605, dz = -0.004 - gz, len = Math.hypot(dx, dz), tp = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.004, len), frameM);
        tp.position.set(sx * 0.0605 + dx / 2, gy + 0.004, gz + dz / 2); tp.rotation.y = Math.atan2(dx, dz); head.add(tp);   // 鏡腳
      }
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.005), frameM); br.position.set(0, gy + 0.008, gz + 0.002); head.add(br);   // 鼻樑架
    }
    if (who === "david" && av.torso) { const chain = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.0035, 6, 48), silver); chain.position.set(0, 0.6, 0.008); chain.rotation.x = PI / 2 + 0.25; av.torso.add(chain); }   // 銀色項鍊
    // 短袖：手肘以下改成皮膚（T 恤袖子到上臂）
    try {
      const skinMat = av.armL.wr.children[0].material;
      for (const arm of [av.armL, av.armR]) { if (arm.sh.children[2]) arm.sh.children[2].material = skinMat; arm.el.children.forEach((m) => { if (m.isMesh) m.material = skinMat; }); }
    } catch (_) {}
    av.faceDone = true; av.hairGroup = hair;
    return av;
  }
})();
