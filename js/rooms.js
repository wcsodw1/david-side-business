/* ============================================================
   主題房間：每個專案房間的佈景都配合它的名字
   · Luka Film   → 攝影棚（綠幕、攝影機、燈架、場記板、ON AIR）
   · LINE ERP    → 倉儲出貨（貨架、棧板、包裝桌、庫存儀表板）
   · House Renting → 溫馨的屋子（沙發、鑰匙牆、迷你房屋模型、出租中）
   · BB (Bugs & Bar) → 昆蟲館 + 酒吧（守宮、蟋蟀、杜比亞、螳螂、鍬形蟲、標本、吧台）
   · ZINZINO     → 北歐健康店（Omega-3 瓶架、檢測櫃台、天平、魚雕塑）
   · Gumroad     → 數位商品工作室（雙螢幕、旋轉金幣、環繞的商品方塊、銷售跑馬燈）
   座標都是房間座標：x 往右、z 往前（-z 是後牆，門在 z = -1.6）；南排的房間整個轉 180°，所以這裡不用另外處理。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Rooms = { mount, unmount, state: () => (R ? R.rooms.slice() : null) });
  let R = null;
  const PI = Math.PI;
  const ROOM_HW = 3.2, ROOM_Z0 = -6.2, ROOM_Z1 = -1.6, DOOR_DX = 1.2;

  function mount(ctx) {
    unmount();
    const { THREE, scene, P, rowOf, L2W, addObs, mkTex, aniso, hooks } = ctx;
    if (!rowOf || !mkTex || !L2W) return;
    const root = new THREE.Group(); scene.add(root);
    const anim = [], tex = [], mats = new Map(), rooms = [];
    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();   // 這個版本的 three 不做色彩管理：純色要先轉線性，才會和 canvas 貼圖一樣的顏色
    const M = (c, r = 0.65, m = 0) => { const k = `${c}|${r}|${m}`; let x = mats.get(k); if (!x) { x = new THREE.MeshStandardMaterial({ color: lin(c), roughness: r, metalness: m }); mats.set(k, x); } return x; };
    const E = (c, i = 1.4) => { const k = `e${c}|${i}`; let x = mats.get(k); if (!x) { x = new THREE.MeshStandardMaterial({ color: lin(c), emissive: lin(c), emissiveIntensity: i, roughness: 0.5 }); mats.set(k, x); } return x; };
    const GL = (c = 0xcfeaff, o = 0.22) => { const k = `g${c}|${o}`; let x = mats.get(k); if (!x) { x = new THREE.MeshStandardMaterial({ color: lin(c), transparent: true, opacity: o, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }); mats.set(k, x); } return x; };
    const cvs = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return c; };
    const mkT = (c) => { const t = mkTex(THREE, c, aniso); tex.push(t); return t; };
    const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const rnd = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

    /* ---------- 每個房間用的工具箱 ---------- */
    function kit(s, p, rw) {
      const g = new THREE.Group(); g.position.set(rw.sx, 0, rw.zoff); g.rotation.y = rw.rot ? PI : 0; root.add(g);
      const K = { g, rot: !!rw.rot, wh: rw.rot ? 1.45 : 2.55, M, E, GL, rnd, rr, lin, THREE };
      K.put = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.r) m.rotation.set(o.r[0] || 0, o.r[1] || 0, o.r[2] || 0); if (o.s) m.scale.set(o.s[0], o.s[1], o.s[2]); m.castShadow = !!o.k; m.receiveShadow = true; (o.p || g).add(m); return m; };
      K.box = (w, h, d, mat, x, y, z, o) => K.put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, o);
      K.cyl = (rt, rb, h, mat, x, y, z, o, seg = 20) => K.put(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, o);
      K.sph = (r, mat, x, y, z, o) => K.put(new THREE.SphereGeometry(r, 14, 10), mat, x, y, z, o);
      K.grp = (x, y, z, ry = 0, parent) => { const q = new THREE.Group(); q.position.set(x, y, z); q.rotation.y = ry; (parent || g).add(q); return q; };
      K.tx = (w, h, draw) => mkT(cvs(w, h, draw));
      // 貼圖平面：ry = 0 朝 +z（門外）、PI/2 朝 +x（貼左牆）、-PI/2 朝 -x（貼右牆）、PI 朝 -z（貼後牆）
      K.pln = (w, h, map, x, y, z, ry = 0, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, roughness: o.rough || 0.6, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? map : null, emissiveIntensity: o.glow || 0, transparent: !!o.alpha, polygonOffset: !!o.off, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })); m.position.set(x, y, z); m.rotation.set(o.rx || 0, ry, o.rz || 0); m.receiveShadow = true; (o.p || g).add(m); return m; };
      K.obs = (lx, lz, hw, hd, h) => { const w = L2W(s, lx, lz); addObs(w.x, w.z, hw, hd, undefined, h); };
      K.anim = (fn) => anim.push(fn);
      // 地板：畫布 → 蓋在原本地板上；X(x)、Z(z) 把房間座標換成畫布像素
      K.floor = (draw) => {
        const W = 1240, Hh = 880, c = cvs(W, Hh, (gx) => draw(gx, W, Hh, (x) => (x + 3.1) / 6.2 * W, (z) => (z + 6.1) / 4.4 * Hh, W / 6.2, (t, x, y) => { gx.save(); gx.translate(x, y); if (K.rot) gx.rotate(PI); gx.fillText(t, 0, 0); gx.restore(); }));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.4), new THREE.MeshStandardMaterial({ map: mkT(c), roughness: 0.82, envMapIntensity: 0.3 })); m.rotation.x = -PI / 2; m.position.set(0, 0.017, -3.9); m.receiveShadow = true; g.add(m); return m;
      };
      // 牆面：後牆 + 左右牆（貼在隔間內側）；draw(g, w, h, kind)，kind = "back" / "side"
      K.walls = (draw) => {
        const wm = (w, h, kind) => new THREE.MeshStandardMaterial({ map: mkT(cvs(1024, Math.round(1024 * h / w), (gx, W, Hh) => draw(gx, W, Hh, kind))), roughness: 0.9, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        const b = new THREE.Mesh(new THREE.PlaneGeometry(6.2, K.wh), wm(6.2, K.wh, "back")); b.position.set(0, K.wh / 2, -6.135); b.receiveShadow = true; g.add(b);
        for (const sg of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.45), wm(4.5, 1.45, "side")); w.position.set(sg * 3.135, 0.725, -3.9); w.rotation.y = sg < 0 ? PI / 2 : -PI / 2; w.receiveShadow = true; g.add(w); }
      };
      K.label = (txt, w = 512, h = 128, o = {}) => K.tx(w, h, (c) => { c.fillStyle = o.bg || "#222"; c.fillRect(0, 0, w, h); c.fillStyle = o.fg || "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; let fs = o.fs || h * 0.5; do { c.font = `800 ${fs}px ${o.font || "'Noto Sans TC', system-ui, sans-serif"}`; fs -= 4; } while (c.measureText(txt).width > w - 24 && fs > 12); c.fillText(txt, w / 2, h / 2 + 2); });
      return K;
    }

    /* ---------- 小動物 / 昆蟲（朝 +x，本地座標） ---------- */
    const beast = {
      gecko(K, x, y, z, ry, sc = 1.5, col = 0xe6b95c, spot = 0x6b4420) {
        const q = K.grp(x, y, z, ry, K.cur); q.scale.setScalar(sc);
        K.sph(0.05, M(col, 0.55), 0, 0.034, 0, { p: q, s: [2.3, 0.6, 1] }); K.sph(0.04, M(col, 0.55), 0.14, 0.036, 0, { p: q, s: [1.5, 0.7, 1] });
        for (const sz of [-0.022, 0.022]) K.sph(0.01, M(0x111111, 0.2), 0.16, 0.052, sz, { p: q });
        for (const [lx, lz] of [[0.07, 1], [0.07, -1], [-0.07, 1], [-0.07, -1]]) K.cyl(0.009, 0.011, 0.04, M(col, 0.6), lx, 0.018, lz * 0.05, { p: q, r: [lz * 0.7, 0, 0] }, 6);
        const tail = K.grp(-0.1, 0.03, 0, 0, q); K.cyl(0.004, 0.028, 0.2, M(col, 0.55), -0.1, 0, 0, { p: tail, r: [0, 0, PI / 2] }, 8);
        for (let k = 0; k < 7; k++) K.sph(0.011, M(spot, 0.7), -0.07 + k * 0.045 - (k > 3 ? 0.02 : 0), 0.06 - (k > 3 ? 0.02 : 0), ((k * 37) % 3 - 1) * 0.02, { p: q, s: [1.2, 0.5, 1.2] });
        q.userData.tail = tail; return q;
      },
      cricket(K, x, y, z, ry, sc = 2) {
        const q = K.grp(x, y, z, ry, K.cur); q.scale.setScalar(sc); const b = M(0x4b3421, 0.6);
        K.sph(0.02, b, 0, 0.02, 0, { p: q, s: [2.2, 0.75, 0.8] }); K.sph(0.013, b, 0.045, 0.024, 0, { p: q });
        for (const sz of [-0.01, 0.01]) { K.cyl(0.0012, 0.0012, 0.07, b, 0.07, 0.04, sz, { p: q, r: [0, 0, -1.2] }, 4); K.box(0.05, 0.004, 0.004, b, -0.02, 0.012, sz * 1.8, { p: q, r: [0, sz * 20, 0.5] }); }
        return q;
      },
      roach(K, x, y, z, ry, sc = 2) {
        const q = K.grp(x, y, z, ry, K.cur); q.scale.setScalar(sc);
        K.sph(0.03, M(0x6b3a22, 0.45), 0, 0.012, 0, { p: q, s: [1.5, 0.45, 1] }); K.sph(0.014, M(0x2a1a10, 0.5), 0.042, 0.011, 0, { p: q, s: [1, 0.6, 1.2] });
        for (const sz of [-0.006, 0.006]) K.cyl(0.0008, 0.0008, 0.04, M(0x2a1a10), 0.06, 0.016, sz, { p: q, r: [0, 0, -1.3] }, 4);
        return q;
      },
      beetle(K, x, y, z, ry, sc = 2) {
        const q = K.grp(x, y, z, ry, K.cur); q.scale.setScalar(sc); const b = M(0x2b1a12, 0.35, 0.3);
        K.sph(0.035, b, 0, 0.03, 0, { p: q, s: [1.5, 0.8, 1] }); K.sph(0.024, b, 0.06, 0.03, 0, { p: q, s: [1, 0.8, 1] });
        for (const sz of [-1, 1]) { K.box(0.045, 0.008, 0.008, M(0x1a0f0a, 0.3, 0.3), 0.1, 0.034, sz * 0.012, { p: q, r: [0, sz * -0.4, 0] }); for (const lx of [-0.02, 0.01, 0.04]) K.cyl(0.0035, 0.0035, 0.05, b, lx, 0.012, sz * 0.04, { p: q, r: [sz * 1.0, 0, 0] }, 4); }
        return q;
      },
      mantis(K, x, y, z, ry, sc = 1.7) {
        const q = K.grp(x, y, z, ry, K.cur); q.scale.setScalar(sc); const gr = M(0x7fb04b, 0.6);
        K.cyl(0.008, 0.012, 0.13, gr, 0.03, 0.1, 0, { p: q, r: [0, 0, -0.5] }, 6); K.sph(0.016, gr, 0.095, 0.15, 0, { p: q, s: [1, 0.9, 1.4] });
        K.cyl(0.014, 0.01, 0.16, gr, -0.07, 0.05, 0, { p: q, r: [0, 0, PI / 2 + 0.15] }, 6);
        for (const sz of [-0.014, 0.014]) { K.box(0.05, 0.006, 0.006, gr, 0.1, 0.12, sz, { p: q, r: [0, 0, 0.5] }); K.box(0.04, 0.006, 0.006, gr, 0.125, 0.09, sz, { p: q, r: [0, 0, -0.9] }); }
        for (const lz of [-1, 1]) for (const lx of [-0.02, 0.02]) K.cyl(0.002, 0.002, 0.08, gr, lx, 0.04, lz * 0.025, { p: q, r: [lz * 0.8, 0, 0] }, 4);
        return q;
      },
    };

    /* ---------- 各主題 ---------- */
    const THEMES = {
      /* ===== Luka Film：攝影棚 ===== */
      "luka-film"(K) {
        const { M, E, box, cyl, sph, pln, tx, obs, anim: an } = K;
        K.floor((c, w, h, X, Z, pxm, ft) => {
          c.fillStyle = "#1b1a22"; c.fillRect(0, 0, w, h); const r = rnd(5);
          for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`; c.fillRect(r() * w, r() * h, 2 + r() * 14, 1 + r() * 2); }
          // 站位膠帶：黃色十字 + 白色 T
          c.strokeStyle = "#f2c230"; c.lineWidth = 7; for (const [mx, mz] of [[-1.95, -3.7], [-1.95, -4.6]]) { c.beginPath(); c.moveTo(X(mx) - 22, Z(mz)); c.lineTo(X(mx) + 22, Z(mz)); c.moveTo(X(mx), Z(mz) - 22); c.lineTo(X(mx), Z(mz) + 22); c.stroke(); }
          c.strokeStyle = "#e8e8ee"; c.lineWidth = 6; c.beginPath(); c.moveTo(X(2.0), Z(-2.4)); c.lineTo(X(2.0), Z(-5.0)); c.stroke();
          c.fillStyle = "rgba(255,255,255,.22)"; c.font = "800 70px Georgia, serif"; c.textAlign = "center"; if ("letterSpacing" in c) c.letterSpacing = "16px"; ft("STUDIO  A", X(0.2), Z(-2.1));
        });
        K.walls((c, w, h) => {   // 隔音泡棉牆
          c.fillStyle = "#26242d"; c.fillRect(0, 0, w, h); const n = 34;
          for (let y = 0; y < h; y += n) for (let x = 0; x < w; x += n) { const gr = c.createLinearGradient(x, y, x + n, y + n); gr.addColorStop(0, "#3a3744"); gr.addColorStop(0.5, "#1c1a22"); gr.addColorStop(1, "#2e2b37"); c.fillStyle = gr; c.fillRect(x + 1, y + 1, n - 2, n - 2); }
          c.fillStyle = "#c8232c"; c.fillRect(0, h - 10, w, 10);
        });
        // 綠幕 + 地面延伸
        pln(2.9, 1.4, tx(256, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#14a644"); gr.addColorStop(0.5, "#22c658"); gr.addColorStop(1, "#14a644"); c.fillStyle = gr; c.fillRect(0, 0, w, h); }), -3.12, 0.75, -4.35, PI / 2, { rough: 0.95 });
        const sw = K.pln(2.9, 0.9, tx(128, 128, (c, w, h) => { c.fillStyle = "#1cb84e"; c.fillRect(0, 0, w, h); }), -2.68, 0.022, -4.35, 0, { rough: 0.95, rx: -PI / 2 }); sw.rotation.set(-PI / 2, 0, PI / 2);
        // 攝影機 + 三腳架
        const cam = K.grp(-1.95, 0, -3.5, 0.92);
        for (let k = 0; k < 3; k++) { const a = k * 2.094; cyl(0.014, 0.014, 1.0, M(0x2a2a30, 0.4, 0.6), Math.sin(a) * 0.2, 0.46, Math.cos(a) * 0.2, { p: cam, r: [Math.cos(a) * 0.38, 0, -Math.sin(a) * 0.38] }, 8); }
        cyl(0.04, 0.04, 0.1, M(0x1a1a1f, 0.4, 0.5), 0, 0.96, 0, { p: cam }, 12);
        box(0.18, 0.2, 0.42, M(0x1d1d22, 0.45, 0.3), 0, 1.12, 0, { p: cam, k: 1 }); cyl(0.07, 0.07, 0.22, M(0x0e0e12, 0.3, 0.4), 0, 1.12, -0.32, { p: cam, r: [PI / 2, 0, 0], k: 1 }, 16); cyl(0.085, 0.085, 0.05, M(0x15151a, 0.3, 0.4), 0, 1.12, -0.46, { p: cam, r: [PI / 2, 0, 0] }, 16);
        box(0.3, 0.2, 0.02, M(0x101014, 0.5), 0, 1.12, -0.52, { p: cam }); sph(0.045, E(0x2a6cff, 0.8), 0, 1.12, -0.44, { p: cam, s: [1, 1, 0.3] });
        cyl(0.008, 0.008, 0.28, M(0x777777, 0.3, 0.8), 0, 1.3, 0.06, { p: cam, r: [0, 0, PI / 2] }, 6); box(0.07, 0.02, 0.07, E(0xff2d2d, 1.6), -0.02, 1.235, 0.16, { p: cam });   // 錄影紅燈
        obs(-1.95, -3.5, 0.32, 0.32);
        // 監視器推車
        { const q = K.grp(-2.6, 0, -2.25, 0.5); box(0.55, 0.04, 0.4, M(0x25252b, 0.5, 0.5), 0, 0.72, 0, { p: q, k: 1 }); for (const [dx, dz] of [[-0.24, -0.16], [0.24, -0.16], [-0.24, 0.16], [0.24, 0.16]]) { cyl(0.015, 0.015, 0.7, M(0x888888, 0.3, 0.8), dx, 0.36, dz, { p: q }, 6); sph(0.03, M(0x111111), dx, 0.03, dz, { p: q }); }
          box(0.5, 0.3, 0.025, M(0x0c0c10, 0.4), 0, 0.92, -0.04, { p: q, r: [-0.15, 0, 0], k: 1 });
          pln(0.46, 0.26, tx(256, 150, (c, w, h) => { const cols = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"]; cols.forEach((cl, i) => { c.fillStyle = cl; c.fillRect(i * w / 7, 0, w / 7 + 1, h * 0.7); }); c.fillStyle = "#111"; c.fillRect(0, h * 0.7, w, h * 0.3); c.fillStyle = "#fff"; c.fillRect(w * 0.55, h * 0.74, w * 0.12, h * 0.22); }), 0, 0.92, -0.025, 0, { glow: 0.9, p: q, rx: -0.15 }); obs(-2.6, -2.25, 0.36, 0.3); }
        // 軌道燈 / 燈架：後方燈桿 + 4 盞 PAR 燈
        const truss = K.grp(0, 0, -5.78); cyl(0.03, 0.03, 6.0, M(0x16161a, 0.35, 0.7), 0, 2.3, 0, { p: truss, r: [0, 0, PI / 2] }, 8);
        for (const sx of [-3.0, 3.0]) cyl(0.03, 0.03, 2.3, M(0x16161a, 0.35, 0.7), sx, 1.15, 0, { p: truss }, 8);
        for (const lx of [-2.1, -0.7, 0.7, 2.1]) { const l = K.grp(lx, 2.2, 0.03, 0, truss); l.rotation.x = 0.55; cyl(0.1, 0.12, 0.26, M(0x1b1b20, 0.4, 0.5), 0, 0, 0, { p: l, k: 1 }, 14); cyl(0.09, 0.09, 0.02, E(0xfff0c8, 2.2), 0, -0.135, 0, { p: l }, 14); box(0.2, 0.01, 0.02, M(0x333338), 0, 0.15, 0, { p: l }); }
        // 補光燈：柔光箱
        { const q = K.grp(2.65, 0, -2.4, -1.0); cyl(0.012, 0.012, 1.5, M(0x1e1e24, 0.4, 0.6), 0, 0.75, 0, { p: q }, 8); for (let k = 0; k < 3; k++) { const a = k * 2.094; cyl(0.01, 0.01, 0.45, M(0x1e1e24, 0.4, 0.6), Math.sin(a) * 0.18, 0.1, Math.cos(a) * 0.18, { p: q, r: [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9] }, 6); }
          box(0.62, 0.62, 0.3, M(0x16161a, 0.7), 0, 1.5, 0, { p: q, k: 1 }); box(0.54, 0.54, 0.02, E(0xfff4dc, 1.7), 0, 1.5, 0.16, { p: q }); obs(2.65, -2.4, 0.3, 0.3); }
        // 導演椅
        { const q = K.grp(2.55, 0, -3.35, -PI / 2); const fr = M(0x2a1f17, 0.6), cv = M(0x16161c, 0.9);
          for (const [dx, dz] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]]) box(0.03, 0.46, 0.03, fr, dx, 0.23, dz, { p: q });
          box(0.46, 0.03, 0.5, cv, 0, 0.47, 0, { p: q, k: 1 }); box(0.03, 0.03, 0.5, fr, -0.2, 0.7, 0, { p: q }); box(0.03, 0.03, 0.5, fr, 0.2, 0.7, 0, { p: q });
          for (const dz of [-0.24, 0.24]) box(0.46, 0.03, 0.03, fr, 0, 0.65, dz, { p: q });
          pln(0.44, 0.14, K.label("DIRECTOR", 512, 160, { bg: "#16161c", fg: "#f2e8d0", font: "Georgia, serif" }), 0, 0.82, 0.01, 0, { p: q }); obs(2.55, -3.35, 0.3, 0.3); }
        // 器材箱 + 場記板 + 底片盤
        { box(0.62, 0.36, 0.95, M(0x1a1a20, 0.5, 0.2), 2.62, 0.18, -4.45, { k: 1 }); box(0.6, 0.34, 0.8, M(0x23232a, 0.5, 0.2), 2.62, 0.53, -4.45, { k: 1 });
          for (const [dx, dy, dz] of [[-0.31, 0.02, -0.46], [-0.31, 0.02, 0.46], [-0.31, 0.7, -0.4], [-0.31, 0.7, 0.4]]) box(0.03, 0.06, 0.06, M(0xb8bcc8, 0.3, 0.8), 2.62 + dx, dy + 0.12, -4.45 + dz);
          const cb = K.grp(2.5, 0.72, -4.2, -1.2); box(0.5, 0.36, 0.02, M(0x111114, 0.6), 0, 0.18, 0, { p: cb, r: [-0.35, 0, 0], k: 1 });
          pln(0.48, 0.34, tx(512, 360, (c, w, h) => { c.fillStyle = "#15151a"; c.fillRect(0, 0, w, h); c.fillStyle = "#f4f4f4"; c.font = "700 44px monospace"; c.textAlign = "left"; c.fillText("PROD   LUKA FILM", 24, 90); c.fillText("SCENE  01", 24, 170); c.fillText("TAKE   03", 24, 250); c.fillText("ROLL   A", 24, 330); }), 0, 0.17, 0.016, 0, { p: cb, rx: -0.35 });
          const arm = K.grp(0, 0.4, 0.01, 0, cb); arm.rotation.x = -0.35; arm.rotation.z = 0.35; arm.position.set(-0.25, 0.4, 0.01);
          pln(0.5, 0.07, tx(512, 72, (c, w, h) => { c.fillStyle = "#f4f4f4"; c.fillRect(0, 0, w, h); c.fillStyle = "#111"; for (let x = -40; x < w + 40; x += 80) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 40, h); c.lineTo(x + 80, 0); c.lineTo(x + 40, 0); c.fill(); } }), 0.25, 0, 0.015, 0, { p: arm });
          for (let k = 0; k < 2; k++) { cyl(0.17, 0.17, 0.03, M(0xb8bcc8, 0.3, 0.8), 2.45, 0.73 + k * 0.04, -4.85, { k: 1 }, 24); cyl(0.04, 0.04, 0.045, M(0x2a2a30, 0.5), 2.45, 0.73 + k * 0.04, -4.85, {}, 12); }
          obs(2.62, -4.45, 0.34, 0.5); }
        // ON AIR 燈（門上；門外門內都看得到，會輕輕閃）
        const air = tx(512, 160, (c, w, h) => { c.fillStyle = "#4a0508"; c.fillRect(0, 0, w, h); c.strokeStyle = "#ff3b3b"; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); c.fillStyle = "#ff4a4a"; c.font = "800 100px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; if ("letterSpacing" in c) c.letterSpacing = "10px"; c.fillText("ON AIR", w / 2, h / 2 + 6); });
        const a1 = pln(0.9, 0.28, air, DOOR_DX, 2.35, -1.55, 0, { glow: 1.2 }), a2 = pln(0.9, 0.28, air, DOOR_DX, 2.35, -1.65, PI, { glow: 1.2 }); an((dt, t) => { const v = 1.0 + 0.45 * Math.sin(t * 2.2); a1.material.emissiveIntensity = a2.material.emissiveIntensity = v; });
      },

      /* ===== LINE ERP：倉儲出貨 ===== */
      "line-erp"(K) {
        const { M, E, box, cyl, sph, pln, tx, obs, rnd } = K, GREEN = 0x06c755;
        K.floor((c, w, h, X, Z, pxm, ft) => {
          c.fillStyle = "#8d9097"; c.fillRect(0, 0, w, h); const r = rnd(9);
          for (let i = 0; i < 2200; i++) { c.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.02 + r() * 0.04})`; c.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
          c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 3; for (let x = 0; x <= 6.2; x += 2.07) { c.beginPath(); c.moveTo(X(-3.1 + x), 0); c.lineTo(X(-3.1 + x), h); c.stroke(); }
          // 黃黑安全走道線
          const hz = (x0, x1, z0, z1) => { c.save(); c.beginPath(); c.rect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0)); c.clip(); c.fillStyle = "#f2c230"; c.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0)); c.fillStyle = "#222"; for (let k = -400; k < 800; k += 44) { c.beginPath(); c.moveTo(X(x0) + k, Z(z1)); c.lineTo(X(x0) + k + 22, Z(z1)); c.lineTo(X(x0) + k + 22 + 90, Z(z0)); c.lineTo(X(x0) + k + 90, Z(z0)); c.fill(); } c.restore(); };
          hz(-1.95, -1.85, -5.9, -1.9); hz(1.85, 1.95, -5.9, -1.9);
          c.fillStyle = "rgba(6,199,85,.85)"; c.fillRect(X(-1.4), Z(-2.25), X(1.7) - X(-1.4), Z(-1.95) - Z(-2.25)); c.fillStyle = "#fff"; c.font = "800 50px 'Noto Sans TC', sans-serif"; c.textAlign = "center"; ft("收貨區  RECEIVING", X(0.15), Z(-2.03));
          c.fillStyle = "rgba(0,0,0,.25)"; c.font = "800 90px Arial"; ft("A", X(-2.55), Z(-2.1)); ft("B", X(2.6), Z(-2.1));
        });
        K.walls((c, w, h, kind) => {
          c.fillStyle = "#dfe2e6"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(0,0,0,.05)"; for (let x = 0; x < w; x += w / (kind === "back" ? 8 : 6)) c.fillRect(x, 0, 3, h);
          c.fillStyle = "#06c755"; c.fillRect(0, h * 0.78, w, h * 0.22); c.fillStyle = "#fff"; c.font = `800 ${h * 0.1}px Arial`; c.textAlign = "center"; c.textBaseline = "middle"; if ("letterSpacing" in c) c.letterSpacing = "6px"; for (let x = w * 0.12; x < w; x += w * 0.25) c.fillText("LINE · ERP", x, h * 0.89);
          if (kind === "back") { c.fillStyle = "#2a5db0"; c.fillRect(0, 0, w, h * 0.04); }
        });
        // 貨架（左牆）
        const R = rnd(21), card = [0xc9a06f, 0xb98c58, 0xd7b283, 0xa87a4a];
        for (const zc of [-5.15, -3.75]) {
          const q = K.grp(-2.8, 0, zc), blue = M(0x2a5db0, 0.45, 0.4), org = M(0xe8832a, 0.5, 0.3);
          for (const dx of [-0.26, 0.26]) for (const dz of [-0.63, 0.63]) box(0.05, 1.42, 0.05, blue, dx, 0.71, dz, { p: q });
          for (const y of [0.12, 0.56, 1.0, 1.4]) { box(0.55, 0.03, 1.3, org, 0, y, 0, { p: q, k: 1 }); }
          for (const y of [0.135, 0.575, 1.015]) { let zz = -0.58; const hmax = y > 0.9 ? 0.3 : 0.36; while (zz < 0.55) { const bw = 0.2 + R() * 0.16, bh = 0.14 + R() * (hmax - 0.14), bd = 0.3 + R() * 0.16; if (zz + bw > 0.62) break; const b = box(bd, bh, bw, M(card[(R() * 4) | 0], 0.85), (R() - 0.5) * 0.04, y + bh / 2, zz + bw / 2, { p: q, k: 0 }); zz += bw + 0.02 + R() * 0.04; if (R() < 0.5) pln(0.09, 0.06, K.label("A-" + ((R() * 90 + 10) | 0), 128, 80, { bg: "#fff", fg: "#222", fs: 38 }), bd / 2 + 0.003, y + bh * 0.6, zz - bw / 2 - 0.02, PI / 2, { p: q }); } }
          obs(-2.8, zc, 0.32, 0.66);
        }
        // 圖騰：綠色對話框（LINE 風）立牌
        { const q = K.grp(-2.45, 0, -2.35, 0.5); cyl(0.025, 0.025, 1.0, M(0x333840, 0.4, 0.6), 0, 0.5, 0, { p: q }, 8); box(0.5, 0.04, 0.4, M(0x333840, 0.4, 0.6), 0, 0.02, 0, { p: q });
          pln(0.9, 0.7, tx(512, 400, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = "#06c755"; rr(c, 20, 20, w - 40, h - 90, 70); c.fill(); c.beginPath(); c.moveTo(130, h - 75); c.lineTo(90, h - 15); c.lineTo(210, h - 72); c.fill(); c.fillStyle = "#fff"; c.font = "800 130px Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("ERP", w / 2, h * 0.38); c.font = "700 54px 'Noto Sans TC'"; c.fillText("進 · 銷 · 存", w / 2, h * 0.64); }), 0, 1.35, 0.03, 0, { p: q, alpha: true, glow: 0.25 }); obs(-2.45, -2.35, 0.3, 0.25); }
        // 棧板 + 紙箱 + 膠膜
        { const q = K.grp(2.6, 0, -4.5), wd = M(0xb98a52, 0.85); for (let k = 0; k < 3; k++) box(0.95, 0.04, 0.12, wd, 0, 0.05, -0.38 + k * 0.38, { p: q }); for (const dx of [-0.42, 0, 0.42]) box(0.1, 0.08, 0.9, wd, dx, 0.02, 0, { p: q });
          for (let lyr = 0; lyr < 3; lyr++) for (const [dx, dz] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.22], [0.24, 0.22]]) { const b = box(0.44, 0.27, 0.4, M(card[(lyr + (dz > 0 ? 1 : 0) + (dx > 0 ? 2 : 0)) % 4], 0.85), dx, 0.23 + lyr * 0.28, dz, { p: q, k: 1 }); }
          box(1.0, 0.82, 0.96, GL(0xf4f8ff, 0.14), 0, 0.5, 0, { p: q });
          pln(0.2, 0.14, K.label("SKU 2041", 256, 160, { bg: "#fff", fg: "#111", fs: 44 }), -0.505, 0.55, 0.0, -PI / 2, { p: q }); q.rotation.y = 0; obs(2.6, -4.5, 0.55, 0.55); }
        // 包裝桌：螢幕 + 掃描槍 + 標籤機
        { const q = K.grp(2.65, 0, -2.75), top = M(0xd5d8de, 0.4, 0.2); box(0.7, 0.05, 1.45, top, 0, 0.8, 0, { p: q, k: 1 }); for (const dz of [-0.65, 0.65]) for (const dx of [-0.3, 0.3]) box(0.05, 0.78, 0.05, M(0x2a5db0, 0.5, 0.4), dx, 0.39, dz, { p: q });
          box(0.04, 0.3, 0.55, M(0x15171c, 0.4), 0.2, 1.0, -0.2, { p: q }); box(0.03, 0.32, 0.58, M(0x15171c, 0.4), 0.2, 1.01, -0.2, { p: q });
          pln(0.52, 0.28, tx(512, 280, (c, w, h) => { c.fillStyle = "#0f1a14"; c.fillRect(0, 0, w, h); c.fillStyle = "#06c755"; c.fillRect(0, 0, w, 44); c.fillStyle = "#fff"; c.font = "700 28px Arial"; c.textAlign = "left"; c.fillText("LINE ERP · 庫存", 14, 31); const v = [0.5, 0.75, 0.4, 0.9, 0.65, 0.8]; v.forEach((t, i) => { c.fillStyle = i % 2 ? "#06c755" : "#7ff0b0"; c.fillRect(40 + i * 72, h - 20 - t * 150, 44, t * 150); }); c.fillStyle = "#fff"; c.font = "700 26px Arial"; c.fillText("STOCK 1,284   OUT 86", 26, 82); }), 0.175, 1.01, -0.2, -PI / 2, { p: q, glow: 0.9 });
          box(0.12, 0.05, 0.22, M(0xf2f2f2, 0.5), -0.05, 0.855, 0.35, { p: q }); box(0.025, 0.1, 0.06, M(0x2a2a30, 0.5), -0.05, 0.89, 0.43, { p: q, r: [0.5, 0, 0] }); sph(0.012, E(0xff2d2d, 2), -0.05, 0.86, 0.26, { p: q });   // 掃描槍
          box(0.2, 0.12, 0.16, M(0x1f2229, 0.5), -0.05, 0.89, -0.5, { p: q }); box(0.2, 0.01, 0.12, M(0xffffff, 0.8), -0.05, 0.84, -0.7, { p: q });
          cyl(0.07, 0.07, 0.05, M(0xd9ae7b, 0.8), 0.12, 0.845, 0.52, { p: q }, 14); obs(2.65, -2.75, 0.38, 0.75); }
      },

      /* ===== House Renting：溫馨的屋子 ===== */
      "house-renting"(K) {
        const { M, E, GL, box, cyl, sph, pln, tx, obs, rnd } = K;
        K.floor((c, w, h, X, Z, pxm, ft) => {
          c.fillStyle = "#c79a68"; c.fillRect(0, 0, w, h); const r = rnd(3), pw = 0.16 * pxm;
          for (let row = 0, y = 0; y < h; y += pw, row++) { for (let x = -(row % 3) * pw * 2.2; x < w; x += pw * 6) { const tone = 0.78 + r() * 0.3; c.fillStyle = `rgb(${(205 * tone) | 0},${(160 * tone) | 0},${(108 * tone) | 0})`; c.fillRect(x + 1, y + 1, pw * 6 - 2, pw - 2); for (let k = 0; k < 4; k++) { c.fillStyle = "rgba(90,55,25,.1)"; c.fillRect(x + r() * pw * 6, y + 2 + r() * pw * 0.8, 20 + r() * 60, 1.5); } } }
          // 地毯（沙發區）
          const cx = X(-1.9), cz = Z(-3.6); c.fillStyle = "#e9d9bd"; c.beginPath(); c.ellipse(cx, cz, 1.45 * pxm, 1.0 * pxm, 0, 0, 7); c.fill(); c.strokeStyle = "#c4553d"; c.lineWidth = 14; c.beginPath(); c.ellipse(cx, cz, 1.3 * pxm, 0.88 * pxm, 0, 0, 7); c.stroke(); c.strokeStyle = "#7fa389"; c.lineWidth = 6; c.beginPath(); c.ellipse(cx, cz, 1.12 * pxm, 0.74 * pxm, 0, 0, 7); c.stroke();
          // 玄關踏墊
          c.fillStyle = "#6e4a2b"; c.fillRect(X(DOOR_DX - 0.55), Z(-2.1), 1.1 * pxm, 0.45 * pxm); c.fillStyle = "#f3e7d3"; c.font = "800 34px Georgia"; c.textAlign = "center"; ft("WELCOME", X(DOOR_DX), Z(-1.84));
        });
        K.walls((c, w, h, kind) => {
          c.fillStyle = "#f3e9d6"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(180,140,100,.12)"; for (let x = 0; x < w; x += 46) c.fillRect(x, 0, 14, h);   // 淡淡直條壁紙
          c.fillStyle = "#8cae98"; c.fillRect(0, h * 0.7, w, h * 0.3); c.fillStyle = "#fff6e6"; c.fillRect(0, h * 0.7, w, 6); c.fillStyle = "#6e4a2b"; c.fillRect(0, h - 16, w, 16);
        });
        // 沙發 + 茶几 + 迷你房屋模型
        { const q = K.grp(-2.6, 0, -3.6), sf = M(0xd0674d, 0.85), sf2 = M(0xe07a5f, 0.85);
          box(0.85, 0.28, 1.75, sf, 0, 0.2, 0, { p: q, k: 1 }); box(0.2, 0.6, 1.75, sf, -0.33, 0.45, 0, { p: q, k: 1 }); for (const dz of [-0.9, 0.9]) box(0.85, 0.46, 0.14, sf, 0, 0.3, dz, { p: q, k: 1 });
          for (const dz of [-0.42, 0.42]) { box(0.6, 0.12, 0.8, sf2, 0.08, 0.4, dz, { p: q }); box(0.12, 0.42, 0.78, sf2, -0.22, 0.6, dz, { p: q, r: [0, 0, -0.12] }); }
          box(0.36, 0.36, 0.1, M(0xf2c45a, 0.9), -0.12, 0.62, 0.62, { p: q, r: [0, 0.4, 0.2] }); for (const dz of [-0.78, 0.78]) for (const dx of [-0.35, 0.35]) cyl(0.025, 0.02, 0.1, M(0x4a3020), dx, 0.05, dz, { p: q }, 8); obs(-2.55, -3.6, 0.5, 0.95); }
        { const q = K.grp(-1.7, 0, -3.6); cyl(0.3, 0.3, 0.04, M(0x6e4a2b, 0.5), 0, 0.4, 0, { p: q, k: 1 }, 24); for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.78; cyl(0.015, 0.015, 0.4, M(0x6e4a2b, 0.5), Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2, { p: q }, 6); }
          const h = K.grp(0, 0.42, 0, 0.4, q); box(0.28, 0.14, 0.2, M(0xf6eedd, 0.8), 0, 0.07, 0, { p: h, k: 1 }); const roof = cyl(0.01, 0.23, 0.12, M(0xc4553d, 0.7), 0, 0.2, 0, { p: h, r: [0, PI / 4, 0], s: [1.0, 1, 0.78], k: 1 }, 4);
          box(0.04, 0.07, 0.01, M(0x6e4a2b), 0, 0.035, 0.105, { p: h }); for (const dx of [-0.08, 0.08]) box(0.045, 0.045, 0.01, E(0xffe08a, 1.5), dx, 0.09, 0.105, { p: h }); box(0.04, 0.06, 0.04, M(0xa05a3a, 0.8), 0.07, 0.25, 0, { p: h });
          cyl(0.004, 0.004, 0.2, M(0x888), -0.2, 0.52, 0.1, {}, 4); obs(-1.7, -3.6, 0.32, 0.32, 0.45); }
        // 立燈 + 綠植
        { const q = K.grp(-2.85, 0, -5.4); cyl(0.12, 0.14, 0.03, M(0x2a2a2a, 0.4, 0.6), 0, 0.015, 0, { p: q }); cyl(0.012, 0.012, 1.25, M(0x2a2a2a, 0.4, 0.6), 0, 0.64, 0, { p: q }, 6); cyl(0.12, 0.2, 0.26, M(0xfff0cf, 0.9), 0, 1.35, 0, { p: q, k: 0 }, 16); sph(0.07, E(0xffe9b0, 1.8), 0, 1.3, 0, { p: q }); obs(-2.85, -5.4, 0.22, 0.22); }
        // 右牆：出租中屋形牌、鑰匙牆、平面圖、紙箱
        K.pln(0.82, 0.86, tx(400, 420, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = "#c4553d"; c.beginPath(); c.moveTo(w / 2, 14); c.lineTo(w - 10, 170); c.lineTo(w - 50, 170); c.lineTo(w - 50, h - 14); c.lineTo(50, h - 14); c.lineTo(50, 170); c.lineTo(10, 170); c.closePath(); c.fill(); c.fillStyle = "#fff6e6"; c.textAlign = "center"; c.font = "800 70px Georgia"; c.fillText("FOR", w / 2, 250); c.fillText("RENT", w / 2, 322); c.font = "700 44px 'Noto Sans TC'"; c.fillText("出租中", w / 2, 388); }), 3.12, 0.95, -2.55, -PI / 2, { alpha: true, glow: 0.2 });
        { const q = K.grp(3.1, 0, -3.75); q.rotation.y = -PI / 2; box(1.15, 0.7, 0.04, M(0x6e4a2b, 0.7), 0, 1.0, 0, { p: q, k: 1 }); box(1.15, 0.05, 0.1, M(0x4a3020, 0.7), 0, 1.38, 0.03, { p: q });
          const cols = [0xf2c45a, 0x6ab0de, 0xe07a5f, 0x7fa389, 0xb59cd8];
          for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { const x = -0.42 + k * 0.21, y = 1.18 - r * 0.28; sph(0.012, M(0xb8bcc8, 0.3, 0.8), x, y, 0.03, { p: q }); const t = torusKey(K, M(0xd8b24a, 0.3, 0.8)); t.position.set(x, y - 0.1, 0.045); t.scale.setScalar(0.8 + ((k + r) % 3) * 0.1); q.add(t); box(0.06, 0.035, 0.01, M(cols[(k + r * 2) % 5], 0.7), x, y - 0.03, 0.04, { p: q }); }
          pln(0.5, 0.08, K.label("KEYS  鑰匙", 512, 100, { bg: "#4a3020", fg: "#f3e7d3", fs: 56 }), 0, 1.46, 0.015, 0, { p: q }); }
        K.pln(0.8, 0.55, tx(512, 352, (c, w, h) => { c.fillStyle = "#1c4f8a"; c.fillRect(0, 0, w, h); c.strokeStyle = "#cfe4ff"; c.lineWidth = 6; c.strokeRect(30, 30, w - 60, h - 60); c.lineWidth = 3; for (const [x, y, ww, hh] of [[30, 30, 190, 150], [220, 30, 262, 150], [30, 180, 130, 142], [160, 180, 322, 142]]) c.strokeRect(x, y, ww, hh); c.fillStyle = "#cfe4ff"; c.font = "700 24px monospace"; c.fillText("LIVING", 54, 120); c.fillText("BED 1", 300, 120); c.fillText("KITCHEN", 40, 270); c.fillText("BED 2", 300, 270); }), 3.12, 1.0, -4.85, -PI / 2, { glow: 0.12 });
        for (let k = 0; k < 2; k++) { box(0.52, 0.4 + k * 0.08, 0.5, M(k ? 0xc49a6c : 0xb98c58, 0.85), 2.7, 0.2 + k * 0.45, -1.95 - k * 0.04, { k: 1, r: [0, k * 0.2, 0] }); } pln(0.18, 0.1, K.label("房", 160, 100, { bg: "#fff", fg: "#c4553d", fs: 80 }), 2.44, 0.2, -1.95, -PI / 2); obs(2.7, -1.97, 0.3, 0.3);
      },

      /* ===== BB (Bugs & Bar)：昆蟲館 + 酒吧 ===== */
      "bb"(K) {
        const { M, E, GL, box, cyl, sph, pln, tx, obs, rnd } = K;
        K.floor((c, w, h, X, Z, pxm, ft) => {
          c.fillStyle = "#2a1c14"; c.fillRect(0, 0, w, h); const r = rnd(7), pw = 0.14 * pxm;
          for (let y = 0, row = 0; y < h; y += pw, row++) for (let x = -(row % 2) * pw * 2; x < w; x += pw * 4) { const t = 0.6 + r() * 0.5; c.fillStyle = `rgb(${(70 * t) | 0},${(46 * t) | 0},${(30 * t) | 0})`; c.fillRect(x + 1, y + 1, pw * 4 - 2, pw - 2); }
          c.fillStyle = "rgba(255,170,60,.22)"; c.font = "800 80px Georgia"; c.textAlign = "center"; if ("letterSpacing" in c) c.letterSpacing = "10px"; ft("BUGS & BAR", X(0.0), Z(-2.1));
        });
        K.walls((c, w, h) => {
          c.fillStyle = "#13261f"; c.fillRect(0, 0, w, h); const r = rnd(2);
          for (let x = 0; x < w; x += 58) { c.fillStyle = (x / 58) % 2 ? "#17302a" : "#112119"; c.fillRect(x, 0, 58, h); }
          for (let i = 0; i < 200; i++) { c.fillStyle = "rgba(120,200,140,.05)"; c.beginPath(); c.arc(r() * w, r() * h, 4 + r() * 14, 0, 7); c.fill(); }
          c.fillStyle = "#4a3020"; c.fillRect(0, h * 0.85, w, h * 0.15); c.fillStyle = "#6b4630"; c.fillRect(0, h * 0.85, w, 6);
        });
        // 爬蟲箱牆（左牆）：3 欄 × 2 層
        const tanks = [
          { z: -5.1, tier: 0, name: "豹紋守宮  Leopard Gecko", floorC: 0xd9bb88, lamp: 0xffa860, fill(q, K2) { K.put(new THREE.SphereGeometry(0.16, 12, 8, 0, PI * 2, 0, PI / 2), M(0x8c8c92, 0.9), 0.0, 0.025, -0.35, { p: q, s: [1.5, 1, 1] }); beast.gecko(K, 0.02, 0.05, 0.1, 0.6, 1.8, 0xe6b95c); beast.gecko(K, -0.05, 0.05, -0.22, 2.6, 1.3, 0xd49b3e); } },
          { z: -3.8, tier: 0, name: "蟋蟀  Crickets", floorC: 0x6b4c30, lamp: 0xffd890, fill(q) { for (let k = 0; k < 9; k++) beast.cricket(K, ((k * 53) % 9 - 4) * 0.04, 0.04, ((k * 37) % 11 - 5) * 0.085, k * 1.3, 2.3); for (let k = 0; k < 3; k++) box(0.14, 0.1, 0.22, M(0xa89a78, 0.9), -0.12 + k * 0.1, 0.07 + k * 0.02, -0.38, { p: q, r: [0, k * 0.4, 0] }); } },
          { z: -2.5, tier: 0, name: "杜比亞  Dubia Roach", floorC: 0x5a4a38, lamp: 0xff9a5a, fill(q) { for (let k = 0; k < 10; k++) beast.roach(K, ((k * 29) % 10 - 5) * 0.035, 0.03, ((k * 41) % 11 - 5) * 0.08, k * 1.1, 2.6); box(0.26, 0.2, 0.04, M(0x8a7650, 0.9), 0.0, 0.12, -0.38, { p: q, r: [0.3, 0.3, 0] }); box(0.26, 0.2, 0.04, M(0x8a7650, 0.9), 0.04, 0.12, -0.3, { p: q, r: [-0.3, 0.9, 0] }); } },
          { z: -5.1, tier: 1, name: "鍬形蟲  Stag Beetle", floorC: 0x4b3a24, lamp: 0xb48cff, fill(q) { cyl(0.05, 0.05, 0.4, M(0x6b4a2a, 0.9), 0, 0.06, 0, { p: q, r: [PI / 2, 0, 0.3] }, 10); beast.beetle(K, 0.03, 0.11, 0.0, 0.5, 2.6); beast.beetle(K, -0.04, 0.05, 0.2, 3.4, 2.0); } },
          { z: -3.8, tier: 1, name: "螳螂  Mantis", floorC: 0x6a7a44, lamp: 0xfff0c0, fill(q) { cyl(0.012, 0.02, 0.5, M(0x6b4a2a, 0.9), -0.05, 0.28, 0, { p: q, r: [0.1, 0, 0.35] }, 6); cyl(0.008, 0.012, 0.3, M(0x6b4a2a, 0.9), 0.1, 0.25, 0.05, { p: q, r: [0.5, 0, -0.5] }, 6); beast.mantis(K, 0.0, 0.16, 0.0, 0.3, 1.6); for (let k = 0; k < 4; k++) sph(0.05, M(0x4f8a3a, 0.8), -0.06 + k * 0.05, 0.26 + (k % 2) * 0.12, 0.08 - k * 0.06, { p: q, s: [1.2, 0.4, 1] }); } },
          { z: -2.5, tier: 1, name: "睫角守宮  Crested Gecko", floorC: 0x3f5a2e, lamp: 0xc890ff, fill(q) { cyl(0.014, 0.022, 0.5, M(0x6b4a2a, 0.9), 0.0, 0.26, 0.0, { p: q, r: [0, 0, 0.5] }, 6); beast.gecko(K, 0.04, 0.34, 0.0, 0.2, 1.6, 0xc47a3a, 0x8a4a1a); for (let k = 0; k < 5; k++) sph(0.06, M(0x3f8a3a, 0.8), -0.1 + k * 0.05, 0.2 + k * 0.05, -0.12 + (k % 2) * 0.2, { p: q, s: [1.2, 0.35, 1] }); } },
        ];
        box(0.6, 0.28, 3.9, M(0x2a1a12, 0.7), -2.82, 0.14, -3.8, { k: 1 }); obs(-2.82, -3.8, 0.34, 1.98);   // 下層櫃體
        for (const T of tanks) {
          const y0 = T.tier ? 0.9 : 0.28, hh = 0.5, q = K.grp(-2.76, y0, T.z), zl = 1.12;
          // 這裡 y0 是缸底（櫃體頂 = 0.28 以下改成矮櫃，所以先用另一個矮櫃隱藏）
          box(0.54, 0.04, zl + 0.04, M(0x1a110c, 0.6), 0, 0.02, 0, { p: q });
          box(0.5, 0.03, zl, M(T.floorC, 0.95), 0, 0.055, 0, { p: q });
          for (const [dx, dz] of [[-0.25, -zl / 2], [0.25, -zl / 2], [-0.25, zl / 2], [0.25, zl / 2]]) box(0.025, hh, 0.025, M(0x111111, 0.4, 0.5), dx, hh / 2 + 0.04, dz, { p: q });
          box(0.5, hh, zl, GL(0xcfeaff, 0.16), 0, hh / 2 + 0.04, 0, { p: q });
          box(0.46, 0.03, zl - 0.1, E(T.lamp, 1.6), 0, hh + 0.04, 0, { p: q }); box(0.54, 0.03, zl + 0.04, M(0x14100c, 0.5), 0, hh + 0.075, 0, { p: q });
          const lb = pln(0.5, 0.075, K.label(T.name, 512, 80, { bg: "#0f0d0a", fg: "#ffd48a", fs: 34 }), 0.275, 0.02, 0, PI / 2, { p: q, glow: 0.5 }); lb.position.y = -0.02;
          q.position.y = y0 - 0.0; K.cur = q; T.fill(q, K); K.cur = null;
          if (T.tier === 0) { }
        }
        // 下層矮櫃讓下層缸「坐」在櫃子上：把櫃體做在 0~0.28
        // 吧台（右牆）+ 吧椅 + 酒瓶 + 啤酒龍頭
        { const q = K.grp(2.55, 0, -3.4); box(0.62, 1.0, 2.3, M(0x1c120d, 0.6), 0, 0.5, 0, { p: q, k: 1 }); box(0.78, 0.06, 2.46, M(0x7a4a2a, 0.4, 0.1), -0.06, 1.03, 0, { p: q, k: 1 }); cyl(0.02, 0.02, 2.3, M(0xd8b24a, 0.3, 0.9), -0.4, 0.3, 0, { p: q, r: [PI / 2, 0, 0] }, 8);
          for (let k = 0; k < 6; k++) box(0.01, 0.62, 0.3, M(k % 2 ? 0x2a1a12 : 0x32201a, 0.6), -0.315, 0.5, -0.9 + k * 0.36, { p: q });
          const bc = [0x2e7d4a, 0x8a4a1a, 0x9a1f2a, 0x3a6aa8, 0xc8a030, 0x2e7d4a];
          bc.forEach((c0, k) => { const z = -0.9 + k * 0.3, bq = K.grp(0.0, 1.06, z, 0, q); cyl(0.04, 0.04, 0.2, M(c0, 0.25, 0.1), 0, 0.1, 0, { p: bq, k: 0 }, 12); cyl(0.018, 0.04, 0.07, M(c0, 0.25, 0.1), 0, 0.235, 0, { p: bq }, 12); cyl(0.018, 0.018, 0.06, M(c0, 0.25, 0.1), 0, 0.3, 0, { p: bq }, 8); cyl(0.042, 0.042, 0.08, M(0xf2e8d0, 0.8), 0, 0.11, 0, { p: bq }, 12); });
          for (let k = 0; k < 3; k++) cyl(0.035, 0.028, 0.1, GL(0xfff2d0, 0.35), -0.2, 1.11, -0.6 + k * 0.28, { p: q }, 12);
          cyl(0.025, 0.025, 0.28, M(0xd8d8e0, 0.2, 0.9), 0.15, 1.2, 0.95, { p: q }, 8); for (let k = 0; k < 3; k++) box(0.02, 0.13, 0.03, M([0xc8232c, 0x2e7d4a, 0xc8a030][k], 0.4), 0.0 + 0.05, 1.3, 0.85 + k * 0.1, { p: q });
          for (let k = 0; k < 3; k++) { const z = -0.8 + k * 0.8, st = K.grp(-1.0, 0, z, 0, q); cyl(0.17, 0.17, 0.05, M(0x7a2a2a, 0.5), 0, 0.64, 0, { p: st, k: 1 }, 16); cyl(0.02, 0.02, 0.6, M(0xb8bcc8, 0.3, 0.8), 0, 0.32, 0, { p: st }, 6); cyl(0.14, 0.14, 0.02, M(0xb8bcc8, 0.3, 0.8), 0, 0.01, 0, { p: st }, 14); }
          obs(2.55, -3.4, 0.45, 1.25);
          // 吊燈泡
          for (let k = 0; k < 3; k++) { cyl(0.004, 0.004, 0.5, M(0x111), 2.4, 2.1, -4.0 + k * 0.6, {}, 4); sph(0.07, E(0xffc874, 2.0), 2.4, 1.82, -4.0 + k * 0.6); } }
        // 酒吧招牌（吊在右牆，朝走道）
        { const q = K.grp(2.68, 0, -3.15); box(0.8, 0.03, 0.03, M(0x111114, 0.5, 0.6), 0, 1.5, 0, { p: q, r: [0, PI / 2, 0] }); box(0.03, 0.03, 0.8, M(0x111114, 0.5, 0.6), 0.4, 1.5, 0, { p: q });
          const bs = tx(640, 200, (c, w, h) => { c.fillStyle = "#0b0b0d"; rr(c, 6, 6, w - 12, h - 12, 24); c.fill(); c.strokeStyle = "#ff6ec7"; c.lineWidth = 6; rr(c, 14, 14, w - 28, h - 28, 20); c.stroke(); c.shadowColor = "#7cff6b"; c.shadowBlur = 28; c.fillStyle = "#b9ff9a"; c.font = "800 78px 'Arial Black', Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("BUGS", w / 2, 70); c.fillStyle = "#ffd38a"; c.shadowColor = "#ffa030"; c.fillText("& BAR", w / 2, 148); });
          pln(0.95, 0.3, bs, -0.45, 1.34, 0.0, 0, { p: q, glow: 1.1 }); pln(0.95, 0.3, bs, -0.45, 1.34, 0.0, PI, { p: q, glow: 1.1 }); for (const dx of [-0.8, -0.1]) cyl(0.004, 0.004, 0.14, M(0xd8b24a, 0.3, 0.9), dx, 1.43, 0, { p: q }, 4); }
        // 昆蟲標本展示櫃（玻璃頂）
        { const sp = tx(512, 320, (c, w, h) => { c.fillStyle = "#e9e0c4"; c.fillRect(0, 0, w, h); c.strokeStyle = "rgba(120,100,60,.25)"; c.lineWidth = 2; for (let x = 20; x < w; x += 44) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
            const bf = (cx, cy, s, a, b) => { c.save(); c.translate(cx, cy); c.scale(s, s); for (const sg of [-1, 1]) { c.fillStyle = a; c.beginPath(); c.ellipse(sg * 34, -22, 34, 24, sg * -0.45, 0, 7); c.fill(); c.fillStyle = b; c.beginPath(); c.ellipse(sg * 26, 22, 22, 16, sg * 0.5, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.7)"; c.beginPath(); c.arc(sg * 40, -26, 5, 0, 7); c.fill(); } c.fillStyle = "#222"; c.fillRect(-3, -34, 6, 70); c.fillRect(-12, -46, 2, 14); c.fillRect(10, -46, 2, 14); c.restore(); };
            bf(110, 100, 1.2, "#2a74c8", "#183c78"); bf(270, 90, 0.95, "#e8832a", "#8a3a10"); bf(420, 110, 1.05, "#7a4ad0", "#3a2070"); bf(180, 240, 0.9, "#2ea84a", "#1a5a2a");
            c.save(); c.translate(390, 245); c.fillStyle = "#1f1410"; c.beginPath(); c.ellipse(0, 0, 36, 24, 0.3, 0, 7); c.fill(); c.fillRect(30, -6, 26, 6); c.fillRect(30, 4, 26, 6); for (let k = -1; k <= 1; k++) { c.fillRect(-16 + k * 18, -40, 4, 18); c.fillRect(-16 + k * 18, 22, 4, 18); } c.restore();
            c.fillStyle = "#6a5a3a"; c.font = "600 14px serif"; c.textAlign = "left"; c.fillText("Morpho · Papilio · Lucanus", 18, h - 10); });
          const q = K.grp(2.55, 0, -5.0); box(0.7, 0.62, 0.95, M(0x1c120d, 0.6), 0, 0.31, 0, { p: q, k: 1 }); box(0.74, 0.04, 0.99, M(0x7a4a2a, 0.4), 0, 0.64, 0, { p: q }); pln(0.62, 0.87, sp, 0, 0.665, 0, 0, { p: q, rx: -PI / 2, rz: PI / 2 }); box(0.64, 0.12, 0.88, GL(0xdff2ff, 0.22), 0, 0.72, 0, { p: q }); obs(2.55, -5.0, 0.4, 0.52); }
        if (!K.rot) for (let k = 0; k < 3; k++) { K.pln(0.5, 0.4, tx(320, 256, (c, w, h) => { c.fillStyle = "#e9e0c4"; c.fillRect(0, 0, w, h); const r = rnd(k + 4), cs = ["#2a74c8", "#e8832a", "#7a4ad0"], cx = w / 2, cy = h / 2, a = cs[k]; c.save(); c.translate(cx, cy); c.scale(1.5, 1.5); for (const sg of [-1, 1]) { c.fillStyle = a; c.beginPath(); c.ellipse(sg * 30, -16, 30, 22, sg * -0.5, 0, 7); c.fill(); c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(sg * 24, 18, 20, 14, sg * 0.5, 0, 7); c.fill(); } c.fillStyle = "#222"; c.fillRect(-3, -28, 6, 60); c.restore(); c.strokeStyle = "#4a3020"; c.lineWidth = 14; c.strokeRect(0, 0, w, h); }), -1.95 + k * 0.62, 1.95, -6.1, 0, { glow: 0.2 }); }
      },

      /* ===== ZINZINO：北歐健康店 ===== */
      "zinzino"(K) {
        const { M, E, GL, box, cyl, sph, pln, tx, obs, rnd } = K;
        K.floor((c, w, h, X, Z, pxm, ft) => {
          c.fillStyle = "#e9d8bd"; c.fillRect(0, 0, w, h); const r = rnd(8), pw = 0.18 * pxm;
          for (let y = 0; y < h; y += pw) for (let x = -(((y / pw) | 0) % 2) * pw * 3; x < w; x += pw * 6) { const t = 0.94 + r() * 0.1; c.fillStyle = `rgb(${(233 * t) | 0},${(214 * t) | 0},${(184 * t) | 0})`; c.fillRect(x + 1, y + 1, pw * 6 - 2, pw - 2); }
          // 北歐波浪地毯
          const cx = X(0.1), cz = Z(-3.5); c.fillStyle = "#1f6f78"; rr(c, cx - 1.1 * pxm, cz - 0.7 * pxm, 2.2 * pxm, 1.4 * pxm, 40); c.fill(); c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 5; for (let k = 0; k < 5; k++) { c.beginPath(); for (let x = -1.0; x <= 1.0; x += 0.04) { const yy = cz - 0.5 * pxm + k * 0.25 * pxm + Math.sin(x * 7 + k) * 10; x === -1.0 ? c.moveTo(cx + x * pxm, yy) : c.lineTo(cx + x * pxm, yy); } c.stroke(); }
          c.fillStyle = "rgba(31,111,120,.75)"; c.font = "800 54px Georgia"; c.textAlign = "center"; ft("BALANCE · OMEGA-3", X(0.2), Z(-2.0));
        });
        K.walls((c, w, h, kind) => {
          c.fillStyle = "#f6f8f8"; c.fillRect(0, 0, w, h); c.fillStyle = "#cfe5e7"; c.fillRect(0, h * 0.65, w, h * 0.35); c.fillStyle = "#1f6f78"; c.fillRect(0, h * 0.65, w, 5);
          c.fillStyle = "rgba(31,111,120,.12)"; c.beginPath(); c.moveTo(0, h * 0.65); for (let x = 0; x <= w; x += 8) c.lineTo(x, h * 0.65 - 24 - 44 * Math.abs(Math.sin(x / (kind === "back" ? 130 : 90))) ); c.lineTo(w, h * 0.65); c.fill();   // 淡淡的山稜線
        });
        // 左牆：瓶架
        { const q = K.grp(-2.88, 0, -4.1), wd = M(0xe6d3ad, 0.6), wh = M(0xf4f4f2, 0.5);
          for (const dz of [-1.6, 1.6]) box(0.34, 1.4, 0.05, wh, 0, 0.7, dz, { p: q, k: 1 });
          for (const y of [0.1, 0.55, 0.95, 1.35]) box(0.34, 0.035, 3.25, wd, 0, y, 0, { p: q, k: 1 });
          for (const y of [0.55, 0.95, 1.35]) box(0.02, 0.012, 3.1, E(0xffe6b0, 1.5), -0.1, y - 0.03, 0, { p: q });
          const bt = [0x6b3f12, 0x7a4a14, 0x2a5a66], R = rnd(31);
          for (const y of [0.1, 0.55, 0.95]) for (let k = 0; k < 9; k++) { const z = -1.45 + k * 0.36, tall = 0.13 + R() * 0.06, c0 = bt[(k + (y > 0.5 ? 1 : 0)) % 3], bq = K.grp(0, y + 0.02, z, 0, q);
            cyl(0.05, 0.05, tall, M(c0, 0.2, 0.15), 0, tall / 2, 0, { p: bq }, 14); cyl(0.022, 0.05, 0.04, M(c0, 0.2, 0.15), 0, tall + 0.02, 0, { p: bq }, 14); cyl(0.022, 0.022, 0.05, M(c0, 0.2, 0.15), 0, tall + 0.065, 0, { p: bq }, 10); cyl(0.026, 0.026, 0.025, M(0xf4f4f4, 0.5), 0, tall + 0.1, 0, { p: bq }, 10);
            cyl(0.052, 0.052, 0.07, M(0xf2ead6, 0.8), 0, tall * 0.45, 0, { p: bq }, 14); cyl(0.0525, 0.0525, 0.012, M(0x1f6f78, 0.7), 0, tall * 0.45 + 0.02, 0, { p: bq }, 14); }
          obs(-2.88, -4.1, 0.2, 1.65);
          pln(0.9, 0.16, K.label("OMEGA-3  ·  BALANCE", 800, 130, { bg: "#1f6f78", fg: "#fff", fs: 64, font: "Georgia, serif" }), 0.172, 1.46, 0, PI / 2, { p: q, glow: 0.2 }); }
        // 右側：檢測櫃台 + 天平 + 平板
        { const q = K.grp(2.65, 0, -3.35); box(0.62, 0.95, 2.0, M(0xf4f4f2, 0.5), 0, 0.475, 0, { p: q, k: 1 }); box(0.7, 0.05, 2.08, M(0xe6d3ad, 0.5), -0.03, 0.97, 0, { p: q, k: 1 }); box(0.02, 0.9, 1.9, M(0x1f6f78, 0.6), -0.32, 0.45, 0, { p: q });
          for (let k = 0; k < 4; k++) { const kb = K.grp(-0.1, 1.0, -0.8 + k * 0.22, 0.1 * k, q); box(0.12, 0.05, 0.18, M(0x1f6f78, 0.6), 0, 0.025, 0, { p: kb }); pln(0.09, 0.14, tx(128, 192, (c, w, h) => { c.fillStyle = "#1f6f78"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(w / 2, 36); c.bezierCurveTo(w * 0.9, h * 0.5, w * 0.7, h * 0.78, w / 2, h * 0.78); c.bezierCurveTo(w * 0.3, h * 0.78, w * 0.1, h * 0.5, w / 2, 36); c.fill(); }), 0, 0.052, 0, 0, { p: kb, rx: -PI / 2 }); }
          box(0.04, 0.3, 0.46, M(0x15171c, 0.4), 0.15, 1.12, 0.35, { p: q, r: [0, 0.2, -0.2] });
          pln(0.42, 0.26, tx(400, 250, (c, w, h) => { c.fillStyle = "#f6f8f8"; c.fillRect(0, 0, w, h); c.fillStyle = "#1f6f78"; c.fillRect(0, 0, w, 44); c.fillStyle = "#fff"; c.font = "700 26px Arial"; c.textAlign = "left"; c.fillText("OMEGA-6 : 3", 14, 31); c.fillStyle = "#cfe5e7"; c.beginPath(); c.arc(w / 2, 190, 100, PI, 0); c.fill(); c.fillStyle = "#2ea84a"; c.beginPath(); c.moveTo(w / 2, 190); c.arc(w / 2, 190, 100, PI, PI * 1.35); c.fill(); c.strokeStyle = "#e8832a"; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, 190); c.lineTo(w / 2 - 66, 130); c.stroke(); c.fillStyle = "#222"; c.font = "800 38px Arial"; c.textAlign = "center"; c.fillText("3 : 1", w / 2, 235); }), 0.173, 1.12, 0.35, -PI / 2 + 0.2, { p: q, glow: 0.8, rz: 0.0 });
          const sc = K.grp(-0.1, 1.0, 0.82, 0, q); cyl(0.05, 0.07, 0.03, M(0xb8bcc8, 0.3, 0.8), 0, 0.015, 0, { p: sc }, 14); cyl(0.012, 0.012, 0.3, M(0xb8bcc8, 0.3, 0.8), 0, 0.17, 0, { p: sc }, 8);
          const beam = K.grp(0, 0.32, 0, 0, sc); box(0.02, 0.012, 0.36, M(0xd8b24a, 0.3, 0.9), 0, 0, 0, { p: beam }); for (const dz of [-0.18, 0.18]) { cyl(0.001, 0.001, 0.12, M(0xd8b24a), 0, -0.06, dz, { p: beam }, 4); cyl(0.07, 0.05, 0.015, M(0xd8b24a, 0.3, 0.9), 0, -0.12, dz, { p: beam }, 16); }
          K.anim((dt, t) => { beam.rotation.x = 0.12 * Math.sin(t * 0.9); });
          obs(2.65, -3.35, 0.4, 1.05); }
        // 魚雕塑（Omega-3）+ 底座
        { const q = K.grp(2.55, 0, -5.0); box(0.5, 0.5, 0.5, M(0xf4f4f2, 0.5), 0, 0.25, 0, { p: q, k: 1 }); const f = K.grp(0, 0.82, 0, -0.5, q); sph(0.14, M(0x1f6f78, 0.25, 0.3), 0, 0, 0, { p: f, s: [2.0, 0.9, 0.6], k: 1 }); const tl = K.put(new THREE.ConeGeometry(0.1, 0.2, 3), M(0x1f6f78, 0.25, 0.3), -0.3, 0, 0, { p: f, r: [0, 0, PI / 2] }); tl.scale.set(1, 1, 0.3); sph(0.025, E(0xffffff, 1.2), 0.22, 0.04, 0.07, { p: f }); K.put(new THREE.ConeGeometry(0.06, 0.12, 3), M(0x2a8a95, 0.3, 0.3), -0.02, 0.15, 0, { p: f }).scale.set(1, 1, 0.3);
          K.anim((dt, t) => { f.position.y = 0.82 + 0.03 * Math.sin(t * 1.4); f.rotation.y = -0.5 + 0.15 * Math.sin(t * 0.7); }); obs(2.55, -5.0, 0.3, 0.3); }
        // 瑜珈墊 + 啞鈴
        { box(0.62, 0.02, 0.05, M(0x1f6f78, 0.8), -2.2, 0.01, -1.95, { r: [0, 0.3, 0] }); cyl(0.07, 0.07, 0.62, M(0x2a8a95, 0.9), -1.55, 0.07, -2.1, { r: [PI / 2, 0, 0.6] }, 16); for (let k = 0; k < 2; k++) { cyl(0.012, 0.012, 0.2, M(0x333), -2.4 + k * 0.25, 0.06, -2.35, { r: [0, 0, PI / 2] }, 6); for (const dx of [-0.1, 0.1]) sph(0.045, M(0x2a2a30, 0.4, 0.5), -2.4 + k * 0.25 + dx, 0.06, -2.35); } }
      },

      /* ===== Coffee Shop：咖啡廳 ===== */
      "cafe"(K) {
        const { M, E, GL, box, cyl, sph, pln, tx, obs, rnd } = K;
        K.floor((c, w, h, X, Z, pxm) => { const s0 = 0.4 * pxm; for (let y = 0; y < h; y += s0) for (let x = 0; x < w; x += s0) { c.fillStyle = ((x / s0 + y / s0) | 0) % 2 ? "#e8d9bf" : "#8a5a3a"; c.fillRect(x, y, s0 + 1, s0 + 1); } c.fillStyle = "rgba(40,20,10,.35)"; c.font = "800 70px Georgia"; c.textAlign = "center"; ft("COFFEE & BEANS", X(0.1), Z(-2.1)); });
        K.walls((c, w, h) => { c.fillStyle = "#6b4630"; c.fillRect(0, 0, w, h); c.fillStyle = "#f0e2c8"; c.fillRect(0, h * 0.68, w, h * 0.32); c.fillStyle = "#3a2416"; c.fillRect(0, h * 0.68, w, 8); c.fillStyle = "rgba(255,255,255,.06)"; for (let x = 0; x < w; x += 64) c.fillRect(x, 0, 3, h * 0.68); });
        // 吧台 + 咖啡機 + 磨豆機
        { const q = K.grp(2.6, 0, -3.5); box(0.7, 1.0, 2.3, M(0x3a2416, 0.6), 0, 0.5, 0, { p: q, k: 1 }); box(0.82, 0.06, 2.42, M(0xe8d9bf, 0.35), -0.04, 1.03, 0, { p: q, k: 1 });
          box(0.45, 0.32, 0.7, M(0xc0c4cc, 0.25, 0.8), 0.1, 1.22, -0.55, { p: q, k: 1 }); box(0.47, 0.05, 0.72, M(0x2a2a30, 0.4, 0.5), 0.1, 1.4, -0.55, { p: q }); for (const dz of [-0.75, -0.35]) { box(0.06, 0.04, 0.14, M(0x1a1a1f, 0.4), -0.17, 1.14, dz, { p: q }); cyl(0.03, 0.03, 0.1, M(0x1a1a1f), -0.17, 1.2, dz, { p: q }, 8); }
          const gr = K.grp(0.1, 1.06, 0.3, 0, q); box(0.2, 0.3, 0.2, M(0x222228, 0.4, 0.4), 0, 0.15, 0, { p: gr, k: 1 }); cyl(0.1, 0.05, 0.2, GL(0xffd9a0, 0.45), 0, 0.4, 0, { p: gr }, 14); for (let k = 0; k < 8; k++) sph(0.018, M(0x3a2214, 0.5), Math.cos(k) * 0.05, 0.35 + (k % 3) * 0.04, Math.sin(k) * 0.05, { p: gr });
          for (let k = 0; k < 4; k++) { cyl(0.04, 0.03, 0.06, M(0xffffff, 0.3), -0.2, 1.09, 0.45 + k * 0.17, { p: q }, 12); cyl(0.035, 0.035, 0.005, M(0x3a2214, 0.3), -0.2, 1.12, 0.45 + k * 0.17, { p: q }, 12); }
          cyl(0.07, 0.1, 0.16, M(0x7c5cff, 0.35, 0.4), 0.0, 1.14, 0.95, { p: q }, 14); box(0.015, 0.2, 0.015, M(0x333), 0.0, 1.3, 0.95, { p: q, r: [0, 0, 0.6] });
          obs(2.6, -3.5, 0.45, 1.25); for (let k = 0; k < 3; k++) { cyl(0.004, 0.004, 0.5, M(0x111), 2.35, 2.1, -4.2 + k * 0.7, {}, 4); const d = K.put(new THREE.SphereGeometry(0.13, 16, 10, 0, PI * 2, 0, PI / 2), E(0xffc874, 1.4), 2.35, 1.82, -4.2 + k * 0.7); } }
        // 咖啡豆麻布袋
        for (let k = 0; k < 3; k++) { const q = K.grp(-2.7, 0, -5.2 + (k % 2) * 0.05 + k * 0.0, k * 0.5); cyl(0.26, 0.3, 0.55 - k * 0.0, M(0xc9a36a, 0.95), k === 2 ? 0.1 : 0, k === 2 ? 0.8 : 0.28, k === 2 ? 0.1 : (k - 0.5) * 0.62, { k: 1, p: K.g }, 14).position.set(-2.7 + (k === 2 ? 0.1 : 0), k === 2 ? 0.82 : 0.28, -5.2 + (k === 2 ? 0.2 : (k - 0.5) * 0.62)); pln(0.22, 0.14, K.label("BEANS", 256, 160, { bg: "#c9a36a", fg: "#3a2214", fs: 70 }), -2.7 + 0.28, k === 2 ? 0.82 : 0.28, -5.2 + (k === 2 ? 0.2 : (k - 0.5) * 0.62), PI / 2); }
        obs(-2.7, -5.2, 0.4, 0.7);
        // 小圓桌 + 椅子
        for (const z of [-2.5, -3.7]) { const q = K.grp(-2.3, 0, z); cyl(0.36, 0.36, 0.04, M(0xe8d9bf, 0.4), 0, 0.72, 0, { p: q, k: 1 }, 24); cyl(0.03, 0.03, 0.7, M(0x2a1a12, 0.5), 0, 0.36, 0, { p: q }, 8); cyl(0.2, 0.2, 0.03, M(0x2a1a12, 0.5), 0, 0.015, 0, { p: q }, 14);
          cyl(0.05, 0.04, 0.06, M(0xffffff, 0.3), 0.05, 0.77, 0.04, { p: q }, 12); cyl(0.045, 0.045, 0.005, M(0x3a2214, 0.3), 0.05, 0.8, 0.04, { p: q }, 12);
          for (const sg of [-1, 1]) { cyl(0.16, 0.16, 0.04, M(0xc4553d, 0.6), 0.0, 0.45, sg * 0.55, { p: q, k: 1 }, 14); cyl(0.018, 0.018, 0.43, M(0x2a1a12), 0, 0.22, sg * 0.55, { p: q }, 6); } obs(-2.3, z, 0.5, 0.7, 0.8); }
        // 菜單黑板（後牆）
        K.pln(1.3, 1.0, tx(520, 400, (c, w, h) => { c.fillStyle = "#23261f"; c.fillRect(0, 0, w, h); c.strokeStyle = "#c9a36a"; c.lineWidth = 10; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = "#f4f0e0"; c.textAlign = "center"; c.font = "800 40px Georgia"; c.fillText("COFFEE BEANS  半磅", w / 2, 56); c.font = "600 27px 'Noto Sans TC'"; [["黃金曼特寧", 450], ["PNG 天堂鳥", 450], ["耶加雪菲", 350], ["貝拉卡摩娜花神", 350], ["達特拉甜蜜總匯", 350], ["曼特寧綜合", 330], ["經典黃金曼巴", 220]].forEach(([n, pr], k) => { c.textAlign = "left"; c.fillText(n, 36, 108 + k * 40); c.textAlign = "right"; c.fillStyle = "#ffd48a"; c.fillText("$" + pr, w - 36, 108 + k * 40); c.fillStyle = "#f4f0e0"; }); }), -2.3, K.wh - 0.85, -6.11, 0, { glow: 0.15 });
      },

      /* ===== Gumroad Digital Products：數位商品工作室 ===== */
      "gumroad"(K) {
        const { M, E, GL, box, cyl, sph, pln, tx, obs, rnd } = K;
        const cover = (txt, bg, fg, sub) => tx(256, 340, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = "800 52px 'Arial Black', Arial"; c.textAlign = "center"; c.fillText(txt, w / 2, 130); c.font = "700 24px Arial"; c.fillText(sub, w / 2, 176); c.fillRect(46, 214, w - 92, 6); c.fillRect(46, 234, (w - 92) * 0.6, 6); c.fillRect(46, 254, (w - 92) * 0.8, 6); c.strokeStyle = fg; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20); });
        const covers = [cover("E-BOOK", "#ff90e8", "#111", "PDF · 120 pages"), cover("TEMPLATE", "#ffd23f", "#111", "Notion · Figma"), cover("PRESETS", "#23a094", "#fff", "Lightroom pack"), cover("COURSE", "#111", "#ff90e8", "Video · Lifetime")];
        K.floor((c, w, h, X, Z, pxm, ft) => {
          const s0 = 0.5 * pxm; for (let y = 0; y < h; y += s0) for (let x = 0; x < w; x += s0) { c.fillStyle = ((x / s0 + y / s0) | 0) % 2 ? "#fff" : "#ffd3f4"; c.fillRect(x, y, s0 + 1, s0 + 1); }
          c.strokeStyle = "#111"; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12); c.fillStyle = "rgba(17,17,17,.78)"; c.font = "800 80px 'Arial Black', Arial"; c.textAlign = "center"; ft("$ DIGITAL", X(0.1), Z(-2.05));
        });
        K.walls((c, w, h) => { c.fillStyle = "#ff90e8"; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(17,17,17,.12)"; for (let y = 14; y < h; y += 34) for (let x = 14; x < w; x += 34) { c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill(); } c.fillStyle = "#111"; c.fillRect(0, h - 22, w, 22); c.fillRect(0, 0, w, 6); });
        // 工作桌（右）：雙螢幕
        { const q = K.grp(2.65, 0, -3.2), dk = M(0x111111, 0.4, 0.2); box(0.78, 0.05, 1.7, dk, 0, 0.78, 0, { p: q, k: 1 }); for (const dz of [-0.78, 0.78]) box(0.7, 0.75, 0.05, M(0xffffff, 0.5), 0, 0.38, dz, { p: q });
          const scr = [tx(320, 200, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.fillStyle = "#111"; c.fillRect(0, 0, w, 24); c.fillStyle = "#ff90e8"; c.fillRect(18, 40, 120, 150); c.fillStyle = "#111"; c.font = "800 22px Arial"; c.fillText("E-BOOK", 30, 100); c.font = "600 18px Arial"; c.fillText("Product page", 160, 70); c.fillStyle = "#ff90e8"; rr(c, 160, 100, 120, 40, 8); c.fill(); c.fillStyle = "#111"; c.fillText("$29  Buy", 186, 126); }),
            tx(320, 200, (c, w, h) => { c.fillStyle = "#111"; c.fillRect(0, 0, w, h); c.fillStyle = "#ff90e8"; c.font = "800 22px Arial"; c.fillText("SALES", 16, 34); const v = [0.3, 0.45, 0.4, 0.62, 0.55, 0.8, 0.95]; v.forEach((t, i) => { c.fillStyle = i === 6 ? "#ffd23f" : "#ff90e8"; c.fillRect(24 + i * 42, h - 20 - t * 130, 30, t * 130); }); c.fillStyle = "#fff"; c.font = "700 26px Arial"; c.fillText("$1,284", 200, 34); })];
          [-0.4, 0.4].forEach((dz, i) => { const mq = K.grp(0.2, 0.84, dz, 0, q); mq.rotation.y = -PI / 2 + (i ? 0.25 : -0.25); box(0.52, 0.3, 0.03, M(0x111111, 0.4), 0, 0.22, 0, { p: mq, k: 1 }); pln(0.48, 0.27, scr[i], 0, 0.22, 0.017, 0, { p: mq, glow: 0.9 }); box(0.05, 0.16, 0.05, M(0x333333, 0.4, 0.5), 0, 0.075, 0, { p: mq }); box(0.2, 0.01, 0.12, M(0x333333, 0.4, 0.5), 0, 0.005, 0, { p: mq }); });
          box(0.14, 0.015, 0.4, M(0xeeeeee, 0.5), -0.2, 0.82, 0.0, { p: q }); cyl(0.04, 0.035, 0.09, M(0xffd23f, 0.6), -0.2, 0.865, 0.62, { p: q }, 12);
          for (let k = 0; k < 3; k++) box(0.07, 0.003, 0.07, M([0xffd23f, 0xff90e8, 0x23a094][k], 0.9), -0.18 + k * 0.03, 0.806 + k * 0.003, -0.7, { p: q, r: [0, k * 0.5, 0] });
          const ch = K.grp(1.95, 0, -3.2, PI / 2); cyl(0.2, 0.2, 0.05, M(0xff90e8, 0.6), 0, 0.45, 0, { p: ch, k: 1 }, 18); box(0.4, 0.4, 0.05, M(0x111111, 0.6), 0, 0.72, -0.18, { p: ch, r: [0.12, 0, 0], k: 1 }); cyl(0.02, 0.02, 0.4, M(0x333333, 0.4, 0.6), 0, 0.22, 0, { p: ch }, 8); for (let k = 0; k < 5; k++) box(0.34, 0.02, 0.03, M(0x333333, 0.4, 0.6), Math.cos(k * 1.256) * 0.0, 0.02, 0, { p: ch, r: [0, k * 1.256, 0] });
          obs(2.65, -3.2, 0.42, 0.9); obs(1.95, -3.2, 0.24, 0.24, 0.5); }
        // 銷售跑馬燈（右牆）
        const tk = document.createElement("canvas"); tk.width = 640; tk.height = 160; const tkT = mkT(tk), tkMsg = ["NEW SALE  +$29", "E-BOOK  SOLD  ×3", "TOTAL  $1,284", "NEW SALE  +$49", "PRESETS  SOLD  ×1", "COURSE  +$99"]; let tkI = -1, tkAt = 0;
        const paintTk = (i) => { const c = tk.getContext("2d"); c.fillStyle = "#111"; c.fillRect(0, 0, 640, 160); c.strokeStyle = "#ff90e8"; c.lineWidth = 8; c.strokeRect(6, 6, 628, 148); c.fillStyle = "#ffd23f"; c.font = "800 64px 'Arial Black', Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(tkMsg[i % tkMsg.length], 320, 84); tkT.needsUpdate = true; };
        paintTk(0); K.pln(1.5, 0.375, tkT, 3.12, 1.15, -3.2, -PI / 2, { glow: 1.0 });
        K.anim((dt, t) => { const i = Math.floor(t / 2.6); if (i !== tkI) { tkI = i; paintTk(i); } });
        // 左側：旋轉金幣 + 環繞的商品方塊
        { const q = K.grp(-2.3, 0, -3.0); cyl(0.36, 0.4, 0.45, M(0xffffff, 0.4), 0, 0.225, 0, { p: q, k: 1 }, 24); cyl(0.37, 0.37, 0.04, M(0x111111, 0.4), 0, 0.46, 0, { p: q }, 24);
          const coinTex = tx(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, "#ffe27a"); gr.addColorStop(1, "#e0a81c"); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = "#a8780a"; c.lineWidth = 12; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 22, 0, 7); c.stroke(); c.fillStyle = "#8a5f06"; c.font = "800 170px 'Arial Black', Arial"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("$", w / 2, h / 2 + 10); });
          const coin = K.grp(0, 0.95, 0, 0, q), cm = M(0xe8b830, 0.25, 0.7), face = new THREE.MeshStandardMaterial({ map: coinTex, roughness: 0.3, metalness: 0.5 });
          const cy = K.put(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 40), [cm, face, face], 0, 0, 0, { p: coin, r: [PI / 2, 0, 0], k: 1 });
          const orb = [], cm2 = [0, 1, 2, 3];
          cm2.forEach((k) => { const cube = K.put(new THREE.BoxGeometry(0.22, 0.22, 0.22), [0, 1, 2, 3, 4, 5].map((f) => new THREE.MeshStandardMaterial({ map: covers[(k + f) % 4], roughness: 0.5, emissive: 0xffffff, emissiveMap: covers[(k + f) % 4], emissiveIntensity: 0.22 })), 0, 0, 0, { p: q, k: 1 }); orb.push(cube); });
          K.anim((dt, t) => { coin.rotation.y = t * 1.1; coin.position.y = 0.95 + 0.04 * Math.sin(t * 1.6); orb.forEach((cu, k) => { const a = t * 0.7 + k * PI / 2; cu.position.set(Math.cos(a) * 0.72, 1.0 + 0.1 * Math.sin(t * 1.2 + k), Math.sin(a) * 0.72); cu.rotation.set(t * 0.6 + k, t * 0.9, 0); }); });
          obs(-2.3, -3.0, 0.42, 0.42); }
        // 商品展示架（左牆後）+ 懶骨頭
        { const q = K.grp(-2.9, 0, -5.0); box(0.3, 1.2, 1.7, M(0xffffff, 0.5), 0, 0.6, 0, { p: q, k: 1 }); for (const y of [0.4, 0.8, 1.2]) box(0.32, 0.03, 1.72, M(0x111111, 0.5), 0, y, 0, { p: q });
          for (let k = 0; k < 4; k++) pln(0.28, 0.36, covers[k], 0.17, 0.62 + (k % 2) * 0.4, -0.58 + k * 0.4, PI / 2, { p: q, glow: 0.2 }), box(0.24, 0.015, 0.1, M(0x111111), 0.09, 0.42 + (k % 2) * 0.4, -0.58 + k * 0.4, { p: q });
          for (let k = 0; k < 4; k++) box(0.04, 0.3, 0.22, M([0xff90e8, 0xffd23f, 0x23a094, 0x111111][k], 0.7), 0.0, 0.95, -0.7 + k * 0.45, { p: q, r: [0, 0.2 * k, 0] }); obs(-2.9, -5.0, 0.2, 0.9); }
        sph(0.34, M(0xffd23f, 0.85), -2.35, 0.2, -2.0, { s: [1.2, 0.62, 1], k: 1 }); obs(-2.35, -2.0, 0.4, 0.34, 0.4);
      },
    };

    // 鑰匙：圓環 + 柄 + 齒
    function torusKey(K, mat) { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 14), mat); g.add(ring); const sh = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.006), mat); sh.position.y = -0.055; g.add(sh); for (const dy of [-0.07, -0.05]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.006), mat); t.position.set(0.012, dy, 0); g.add(t); } return g; }

    P.forEach((p, i) => {
      const s = i + 1, rw = rowOf[s], fn = THEMES[p.id];
      if (!rw || !fn) return;
      try { fn(kit(s, p, rw)); rooms.push(p.id); } catch (e) { console.error("房間佈景失敗：" + p.id, e); }
    });
    const tick = (dt, t) => { for (const f of anim) f(dt, t); };
    hooks.push(tick);
    R = { root, hooks, tick, tex, rooms, scene };
  }

  function unmount() {
    if (!R) return;
    const i = R.hooks.indexOf(R.tick); if (i >= 0) R.hooks.splice(i, 1);
    R.scene.remove(R.root); R.tex.forEach((t) => t.dispose && t.dispose()); R = null;
  }
})();
