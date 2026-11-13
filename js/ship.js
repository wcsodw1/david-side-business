/* ============================================================
   巨型郵輪：整個藝廊 / 家 / 花園 / 匹克球館都在一艘郵輪的甲板上。
   · 船體：白色上層 + 深藍船身 + 紅色水線，船首（東）尖、船尾（西）圓，兩側有一排排舷窗（夜晚亮燈）
   · 船首甲板與船尾甲板（船尾有泳池）、煙囪（冒煙）、救生艇、救生圈、桅杆
   · 船在航行：海面往船尾流、兩側有浪花、船尾拖著白色尾流
   · 海上：偶爾有海豚躍出水面、鯨魚浮上來噴水、飛魚與魚群
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Ship = { mount, unmount, spawn: (k) => Sh && Sh.spawn(k), state: () => (Sh ? { events: Sh.ev.length, seaY: Sh.seaY } : null) });
  let Sh = null;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const PI = Math.PI;

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, camera, pos } = ctx;
    const W = ctx.WORLD_W, HD = ctx.DECK_HD, ENTRY = ctx.ENTRY, SEA = ctx.seaY;       // SEA：海面高度（負值）
    const root = new THREE.Group(); scene.add(root);
    const M = (c, r = 0.7, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMapIntensity: 0.5, ...extra });
    const add = (geo, mat, x, y, z, parent = root, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
    const wH = HD + 0.5;                                                                // 船體半寬
    const D = -SEA;                                                                     // 甲板到海面的高度

    /* ----- 船體輪廓（x = 船首方向，y = 世界 z）----- */
    const outline = (k = 1, grow = 0) => {
      const w = wH * k + grow, sh = new THREE.Shape();
      sh.moveTo(-1, -w); sh.lineTo(W, -w);
      sh.bezierCurveTo(W + 16, -w, W + 24, -w * 0.45, W + 28 + grow, 0);
      sh.bezierCurveTo(W + 24, w * 0.45, W + 16, w, W, w);
      sh.lineTo(-1, w);
      sh.bezierCurveTo(-8, w, -12 - grow, w * 0.55, -12 - grow, 0);
      sh.bezierCurveTo(-12 - grow, -w * 0.55, -8, -w, -1, -w);
      return sh;
    };
    const layer = (shape, depth, top, mats) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
      const m = new THREE.Mesh(g, mats); m.rotation.x = PI / 2; m.position.y = top; m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
    };
    const deckWood = M(0xb88c5c, 0.65), white = M(0xf2f3f5, 0.6), navy = M(0x1d2a44, 0.6), red = M(0x8a1f1f, 0.7);
    const POOL = ctx.POOL;
    const topShape = outline(1), hole = new THREE.Path(); hole.moveTo(POOL.x0, POOL.z0); hole.lineTo(POOL.x1, POOL.z0); hole.lineTo(POOL.x1, POOL.z1); hole.lineTo(POOL.x0, POOL.z1); hole.closePath(); topShape.holes.push(hole);   // 泳池挖洞
    layer(topShape, 4.6, -0.03, [deckWood, white]);                                       // 白色上層（頂面 = 船首 / 船尾甲板）
    layer(outline(0.97, -0.1), D - 4.6 - 1.3, -4.63, [navy, navy]);                         // 深藍船身
    layer(outline(0.93, -0.3), 1.9, SEA + 1.9 - 0.45, [red, red]);                          // 紅色水線帶（一半在水下）

    // 船名（兩側船身）
    const nameC = document.createElement("canvas"); nameC.width = 2048; nameC.height = 256; const ng = nameC.getContext("2d");
    ng.fillStyle = "rgba(0,0,0,0)"; ng.clearRect(0, 0, 2048, 256); ng.fillStyle = "#f4efe2"; ng.font = "800 150px Georgia, serif"; ng.textAlign = "center"; if ("letterSpacing" in ng) ng.letterSpacing = "26px"; ng.fillText("DAVID'S GALLERY", 1024, 175);
    const nameT = new THREE.CanvasTexture(nameC); if ("colorSpace" in nameT) nameT.colorSpace = THREE.SRGBColorSpace; else nameT.encoding = THREE.sRGBEncoding;
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(28, 3.5), new THREE.MeshBasicMaterial({ map: nameT, transparent: true })); p.position.set(W * 0.7, -8.4, s * (wH * 0.97 + 0.05)); p.rotation.y = s > 0 ? 0 : PI; root.add(p); }

    // 舷窗：兩排，夜晚亮燈
    const portMat = M(0x16202e, 0.3, 0.2, { emissive: 0xffd58a, emissiveIntensity: 0.05 });
    const nPort = Math.floor((W - 4) / 2.4);
    for (const s of [-1, 1]) for (const y of [-1.9, -3.4]) {
      const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14), portMat, nPort), m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(PI / 2, 0, 0));
      for (let i = 0; i < nPort; i++) { m4.compose(new THREE.Vector3(2 + i * 2.4, y, s * (wH + 0.02)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); }
      root.add(im);
    }

    // 船首 / 船尾甲板欄杆（沿輪廓）
    const brass = M(0x7d6446, 0.38, 0.85), glass = M(0xa8b8ff, 0.08, 0, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const railAlong = (pts) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 0.01) continue;
        const cx = (a.x + b.x) / 2, cz = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
        const r = add(new THREE.BoxGeometry(len, 0.05, 0.08), brass, cx, 1.08, cz, root, false); r.rotation.y = -ang;
        const g = add(new THREE.BoxGeometry(len, 1.0, 0.03), glass, cx, 0.55, cz, root, false); g.rotation.y = -ang;
        add(new THREE.BoxGeometry(0.07, 1.1, 0.07), brass, a.x, 0.55, a.y, root, false);
      }
    };
    { const bow = [], stern = [];
      const pb = outline(1).getSpacedPoints(160);
      for (const p of pb) { if (p.x > W + 0.2) bow.push(p); else if (p.x < -1.2) stern.push(p); }
      railAlong(bow.sort((a, b) => (a.x === b.x ? a.y - b.y : 0)).length ? pbSort(bow, true) : bow); railAlong(pbSort(stern, false)); }
    function pbSort(arr, isBow) { // 以角度排序（從 -z 側繞到 +z 側）
      const cx = isBow ? W : -1; return arr.slice().sort((a, b) => Math.atan2(a.y, (a.x - cx) * (isBow ? 1 : -1)) - Math.atan2(b.y, (b.x - cx) * (isBow ? 1 : -1)));
    }

    // ===== 船尾泳池（立體、可下水）+ 休閒區 =====
    const pcx = (POOL.x0 + POOL.x1) / 2, pcz = (POOL.z0 + POOL.z1) / 2, pw = POOL.x1 - POOL.x0, pd = POOL.z1 - POOL.z0, FLOOR = -1.8, WY = POOL.surface;
    const tileC = document.createElement("canvas"); tileC.width = tileC.height = 256; const tg = tileC.getContext("2d");
    tg.fillStyle = "#6cc7e8"; tg.fillRect(0, 0, 256, 256); tg.strokeStyle = "rgba(255,255,255,.55)"; tg.lineWidth = 2; for (let k = 0; k <= 256; k += 32) { tg.beginPath(); tg.moveTo(k, 0); tg.lineTo(k, 256); tg.stroke(); tg.beginPath(); tg.moveTo(0, k); tg.lineTo(256, k); tg.stroke(); }
    for (let k = 0; k < 60; k++) { tg.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`; tg.lineWidth = 2 + Math.random() * 3; tg.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; tg.moveTo(x, y); tg.bezierCurveTo(x + 20, y - 20, x + 40, y + 20, x + 60, y); tg.stroke(); }
    const tileT = new THREE.CanvasTexture(tileC); tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping;
    const tileMat = (rx, ry) => { const t = tileT.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.05 }); };
    const pfloor = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), tileMat(pw / 1.2, pd / 1.2)); pfloor.rotation.x = -PI / 2; pfloor.position.set(pcx, FLOOR, pcz); pfloor.receiveShadow = true; root.add(pfloor);
    for (const [wx, wz, rw, ry] of [[pcx, POOL.z0, pw, 0], [pcx, POOL.z1, pw, PI], [POOL.x0, pcz, pd, PI / 2], [POOL.x1, pcz, pd, -PI / 2]]) {      // 池壁內襯
      const w = new THREE.Mesh(new THREE.PlaneGeometry(rw, -FLOOR), tileMat(rw / 1.2, 1.5)); w.position.set(wx, FLOOR / 2, wz); w.rotation.y = ry; root.add(w);
    }
    // 池緣（白色石材）
    const cop = M(0xf4f1ea, 0.5);
    add(new THREE.BoxGeometry(pw + 0.7, 0.1, 0.35), cop, pcx, 0.05, POOL.z0 - 0.17, root, false); add(new THREE.BoxGeometry(pw + 0.7, 0.1, 0.35), cop, pcx, 0.05, POOL.z1 + 0.17, root, false);
    add(new THREE.BoxGeometry(0.35, 0.1, pd), cop, POOL.x0 - 0.17, 0.05, pcz, root, false); add(new THREE.BoxGeometry(0.35, 0.1, pd), cop, POOL.x1 + 0.17, 0.05, pcz, root, false);
    // 水面：半透明、會起伏、有流動的亮紋
    const wC = document.createElement("canvas"); wC.width = wC.height = 256; const wg = wC.getContext("2d"); wg.fillStyle = "#4fc3ee"; wg.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 70; k++) { wg.strokeStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.25})`; wg.lineWidth = 1 + Math.random() * 2; wg.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; for (const dx of [0, 256, -256]) { wg.moveTo(x + dx, y); wg.quadraticCurveTo(x + dx + 18, y - 8, x + dx + 36, y); } wg.stroke(); }
    const wT = new THREE.CanvasTexture(wC); wT.wrapS = wT.wrapT = THREE.RepeatWrapping; wT.repeat.set(pw / 2, pd / 2); if ("colorSpace" in wT) wT.colorSpace = THREE.SRGBColorSpace; else wT.encoding = THREE.sRGBEncoding;
    const waterGeo = new THREE.PlaneGeometry(pw, pd, 26, 24), water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ map: wT, color: 0xbfeaff, transparent: true, opacity: 0.66, roughness: 0.04, metalness: 0.15, envMapIntensity: 1.6, depthWrite: false }));
    water.rotation.x = -PI / 2; water.position.set(pcx, WY, pcz); water.renderOrder = 5; root.add(water);
    const underLight = new THREE.PointLight(0x40c8ff, 0, 9); underLight.position.set(pcx, -1.1, pcz); root.add(underLight);
    // 池邊扶梯、漂浮的沙灘球
    for (const dz of [-0.45, 0.45]) { const t = add(new THREE.TorusGeometry(0.32, 0.03, 8, 16, PI), M(0xd7dbe2, 0.25, 0.9), POOL.x1 + 0.03, 0.55, pcz + 1.6 + dz, root, false); t.rotation.y = PI / 2; t.rotation.z = 0; }
    const ballC = document.createElement("canvas"); ballC.width = 256; ballC.height = 128; const bg = ballC.getContext("2d"); ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#ffffff", "#ff9f1c"].forEach((c, i) => { bg.fillStyle = c; bg.fillRect(i * 43, 0, 44, 128); });
    const ballT = new THREE.CanvasTexture(ballC); if ("colorSpace" in ballT) ballT.colorSpace = THREE.SRGBColorSpace; else ballT.encoding = THREE.sRGBEncoding;
    const beach = add(new THREE.SphereGeometry(0.26, 18, 14), new THREE.MeshStandardMaterial({ map: ballT, roughness: 0.4 }), pcx + 1.2, WY + 0.15, pcz - 0.8);
    // 躺椅（木框 + 白色軟墊 + 靠背 + 枕頭 + 毛巾）、遮陽傘、邊桌、棕櫚、沖水柱
    const woodM = M(0xa8794a, 0.6), cush = M(0xf7f4ec, 0.85), towel = [M(0x2f9bd0, 0.9), M(0xef476f, 0.9), M(0xffd166, 0.9), M(0x06d6a0, 0.9)];
    const lounger = (x, z, rot, ti) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
      for (const [lx, lz] of [[-0.3, -0.8], [0.3, -0.8], [-0.3, 0.8], [0.3, 0.8]]) add(new THREE.BoxGeometry(0.06, 0.28, 0.06), woodM, lx, 0.14, lz, g, false);
      add(new THREE.BoxGeometry(0.72, 0.06, 1.7), woodM, 0, 0.3, 0, g); add(new THREE.BoxGeometry(0.64, 0.1, 1.0), cush, 0, 0.38, 0.28, g);
      const back = add(new THREE.BoxGeometry(0.64, 0.1, 0.8), cush, 0, 0.62, -0.62, g); back.rotation.x = 0.7; add(new THREE.CapsuleGeometry(0.1, 0.34, 4, 8), cush, 0, 0.74, -0.95, g, false).rotation.z = PI / 2;
      add(new THREE.BoxGeometry(0.5, 0.03, 0.9), towel[ti % 4], 0, 0.45, 0.35, g, false);
    };
    [[-10.0, -3.6, PI / 2, 0], [-10.0, -2.2, PI / 2, 1], [-10.0, 2.2, PI / 2, 2], [-10.0, 3.6, PI / 2, 3], [-2.0, -4.6, -PI / 2, 1], [-2.0, 4.6, -PI / 2, 0]].forEach(([x, z, r, t]) => lounger(x, z, r, t));
    const umbrella = (x, z, col) => { add(new THREE.CylinderGeometry(0.03, 0.035, 2.4, 8), M(0xe8e8ee, 0.4, 0.5), x, 1.2, z); const cn = add(new THREE.ConeGeometry(1.5, 0.55, 12, 1, true), M(col, 0.8, 0, { side: THREE.DoubleSide }), x, 2.5, z); add(new THREE.SphereGeometry(0.05, 8, 6), M(0xe8e8ee, 0.4, 0.5), x, 2.8, z, root, false); return cn; };
    umbrella(-10.8, -3.0, 0xffffff); umbrella(-10.8, 3.0, 0xef476f); umbrella(-1.6, -4.6, 0xffd166);
    for (const [x, z] of [[-10.0, -2.9], [-10.0, 2.9]]) { add(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 14), woodM, x, 0.2, z); add(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10), M(0xffd166, 0.5), x, 0.47, z, root, false); }
    const palm = (x, z, h) => { const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g); add(new THREE.CylinderGeometry(0.1, 0.18, h, 8), M(0x8a6a44, 0.9), 0.15, h / 2, 0, g).rotation.z = -0.08; for (let k = 0; k < 8; k++) { const f = add(new THREE.SphereGeometry(0.7, 8, 6), M(0x2f8f4a, 0.8), Math.cos(k * 0.785) * 0.8 + 0.3, h - 0.1 - (k % 2) * 0.15, Math.sin(k * 0.785) * 0.8, g, false); f.scale.set(1.5, 0.08, 0.28); f.rotation.y = -k * 0.785; f.rotation.z = -0.25; } add(new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12), M(0xb4643a, 0.8), 0, 0.2, 0, g); };
    palm(-11.0, 0.0, 3.0); palm(-1.6, 5.8, 2.6);
    add(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8), M(0xd7dbe2, 0.25, 0.9), -2.2, 1.1, 3.9); add(new THREE.SphereGeometry(0.16, 10, 8), M(0xd7dbe2, 0.25, 0.9), -2.2, 2.25, 3.9, root, false);

    // 船首：繫纜柱與旗桿
    for (const z of [-3, 3]) add(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 12), M(0x2a2d36, 0.5, 0.6), W + 12, 0.35, z);
    add(new THREE.CylinderGeometry(0.06, 0.08, 8, 8), M(0xe8e8ee, 0.4, 0.4), W + 17, 4, 0);
    const flag = add(new THREE.PlaneGeometry(2.2, 1.3), new THREE.MeshBasicMaterial({ color: 0xc23a2a, side: THREE.DoubleSide }), W + 18.2, 7.2, 0, root, false);

    // 救生艇（掛在兩側船舷外）與救生圈
    const boatM = M(0xf28a1f, 0.6), boatW = M(0xf4f4f4, 0.6);
    for (const s of [-1, 1]) for (let x = 9; x < W - 6; x += 15) {
      const g = new THREE.Group(); g.position.set(x, 0.4, s * (wH + 0.9)); root.add(g);
      const hull = add(new THREE.CapsuleGeometry(0.55, 4.2, 6, 12), boatM, 0, 0, 0, g); hull.rotation.z = PI / 2; hull.scale.set(1, 1, 0.9);
      add(new THREE.BoxGeometry(4.6, 0.12, 0.7), boatW, 0, 0.5, 0, g, false);
      for (const dx of [-1.6, 1.6]) add(new THREE.BoxGeometry(0.08, 1.4, 0.08), brass, dx, 0.7, -s * 0.5, g, false);
    }
    const ringM = M(0xd8352a, 0.6), ringW = M(0xffffff, 0.6);
    for (const s of [-1, 1]) for (let x = 12; x < W - 8; x += 22) { const r = add(new THREE.TorusGeometry(0.28, 0.09, 8, 18), ringM, x, 0.8, s * (HD - 0.2), root, false); r.rotation.x = s > 0 ? 0 : 0; add(new THREE.TorusGeometry(0.28, 0.092, 8, 18), ringW, x + 0.0, 0.8, s * (HD - 0.2) + 0.001, root, false).scale.set(1, 1, 0.5); }

    // 煙囪（在美術館屋頂上，走進去會跟著屋頂一起變透明）+ 煙
    const fadeMats = [];
    const roofPart = (geo, color, x, y, z) => { const mat = M(color, 0.6, 0.1, { transparent: true }); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; scene.add(m); ctx.roofs.push({ m, mat, grp: "M" }); fadeMats.push(m); return m; };
    const funnelX = [ENTRY + 24, ENTRY + 46];
    for (const fx of funnelX) {
      const f = roofPart(new THREE.CylinderGeometry(1.5, 1.8, 7.5, 24), 0xf4f0e6, fx, 4.5 + 3.75, 0); f.scale.set(1.5, 1, 1);
      roofPart(new THREE.CylinderGeometry(1.52, 1.52, 1.4, 24), 0xc23a2a, fx, 4.5 + 5.6, 0).scale.set(1.5, 1, 1.0);
      roofPart(new THREE.CylinderGeometry(1.55, 1.55, 0.9, 24), 0x1a1a22, fx, 4.5 + 7.4, 0).scale.set(1.5, 1, 1.0);
    }
    roofPart(new THREE.CylinderGeometry(0.07, 0.1, 9, 8), 0xe8e8ee, ENTRY + 8, 4.5 + 4.5, 0);   // 雷達桅杆
    roofPart(new THREE.BoxGeometry(2.6, 0.12, 0.5), 0x9aa4b4, ENTRY + 8, 4.5 + 8.6, 0);
    const smokeC = document.createElement("canvas"); smokeC.width = smokeC.height = 64; const sg = smokeC.getContext("2d"), gr = sg.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, "rgba(255,255,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)"); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    const smokeT = new THREE.CanvasTexture(smokeC), puffs = [];
    for (const fx of funnelX) for (let i = 0; i < 10; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, color: 0xcfd3da })); sp.renderOrder = 6; root.add(sp); puffs.push({ sp, fx, t: i / 10 }); }

    /* ----- 航行：浪花 + 尾流 ----- */
    const foamC = document.createElement("canvas"); foamC.width = 256; foamC.height = 64; const fg = foamC.getContext("2d");
    for (let i = 0; i < 260; i++) { fg.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.6})`; const x = Math.random() * 256, y = Math.random() * 64, w = 6 + Math.random() * 22; for (const dx of [0, 256, -256]) fg.fillRect(x + dx, y, w, 1.5 + Math.random() * 2.5); }
    const foamT = new THREE.CanvasTexture(foamC); foamT.wrapS = foamT.wrapT = THREE.RepeatWrapping;
    const foamMat = (rep) => { const t = foamT.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, 1); return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.85, fog: true }); };
    const foams = [];
    for (const s of [-1, 1]) { const fm = foamMat(14), p = new THREE.Mesh(new THREE.PlaneGeometry(W + 26, 3.2), fm); p.rotation.x = -PI / 2; p.position.set((W + 26) / 2 - 12, SEA + 0.06, s * (wH * 0.93 + 1.2)); root.add(p); foams.push(fm); }
    const wakeM = foamMat(14); wakeM.opacity = 0.9;
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(260, 14), wakeM); wake.rotation.x = -PI / 2; wake.position.set(-12 - 130, SEA + 0.07, 0); root.add(wake); foams.push(wakeM);
    { const g = wake.geometry, p = g.attributes.position; // 尾流越遠越窄越淡：用頂點色做不到，改以縮放近似
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) * (0.35 + 0.65 * (1 - (x + 130) / 260))); } }

    /* ----- 海洋生物 ----- */
    const sea = (x, z) => new THREE.Vector3(x, SEA, z);
    const ringTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 8; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); return new THREE.CanvasTexture(c); })();
    const splash = (x, z, big = 1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0.9 })); m.rotation.x = -PI / 2; m.position.set(x, SEA + 0.1, z); root.add(m);
      Sh.ev.push({ kind: "ring", m, age: 0, big, upd(dt, e) { e.age += dt; const k = e.age / 1.6; m.scale.setScalar((0.6 + k * 3.2) * big); m.material.opacity = 0.9 * (1 - k); if (k >= 1) e.done = true; } });
    };
    const dolphinModel = () => {
      const g = new THREE.Group(), body = M(0x6f8aa0, 0.45), belly = M(0xdfe8ee, 0.5);
      const b = add(new THREE.CapsuleGeometry(0.22, 1.2, 6, 12), body, 0, 0, 0, g); b.rotation.x = PI / 2;
      add(new THREE.CapsuleGeometry(0.15, 0.8, 4, 10), belly, 0, -0.07, 0.05, g, false).rotation.x = PI / 2;
      add(new THREE.ConeGeometry(0.06, 0.34, 8), body, 0, -0.02, 1.0, g, false).rotation.x = PI / 2;
      add(new THREE.ConeGeometry(0.1, 0.3, 6), body, 0, 0.24, -0.1, g, false).rotation.x = -0.4;
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.4, 0.03, 0.16), body, s * 0.22, 0, -1.0, g, false).rotation.z = s * 0.15;
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.03, 0.12), body, s * 0.28, -0.1, 0.3, g, false).rotation.z = s * -0.5;
      return g;
    };
    const dolphinJump = (x, z, n, dirx) => {
      for (let i = 0; i < n; i++) {
        const g = dolphinModel(); g.visible = false; root.add(g);
        const T = rand(1.5, 2.1), L = rand(7, 11), H = rand(2.2, 3.6), t0 = -i * rand(0.45, 0.8), zz = z + rand(-1.2, 1.2), xx = x + i * rand(-2, 2);
        let splashed = false, splashedOut = false;
        Sh.ev.push({ kind: "dolphin", g, upd(dt, e) {
          t0 === undefined || (e.t = (e.t ?? t0) + dt); const k = e.t / T;
          if (k < 0) return; if (k >= 1) { g.parent && g.parent.remove(g); e.done = true; return; }
          g.visible = true; const px = xx + k * L * dirx, py = SEA + H * 4 * k * (1 - k) - 0.3, vy = H * 4 * (1 - 2 * k), vx = (L / T) * dirx;
          g.position.set(px, py, zz); g.rotation.set(0, dirx > 0 ? PI / 2 : -PI / 2, 0); g.rotateX(-Math.atan2(vy, Math.abs(vx)) * (dirx > 0 ? -1 : -1) * -1);
          g.rotateZ(Math.sin(k * PI * 3) * 0.12);
          if (!splashedOut && k > 0.04) { splashedOut = true; splash(px, zz, 0.8); }
          if (!splashed && k > 0.94) { splashed = true; splash(px, zz, 0.8); }
        } });
      }
    };
    const whale = (x, z, dirx) => {
      const g = new THREE.Group(), body = M(0x32475c, 0.55), under = M(0xc9d3dc, 0.6);
      const b = add(new THREE.CapsuleGeometry(1.35, 8, 8, 16), body, 0, 0, 0, g); b.rotation.x = PI / 2; b.scale.set(1, 0.9, 1);
      add(new THREE.CapsuleGeometry(1.1, 6, 6, 12), under, 0, -0.55, 0.4, g, false).rotation.x = PI / 2;
      const fl = new THREE.Group(); fl.position.set(0, 0, -6.2); g.add(fl);
      for (const s of [-1, 1]) { const w = add(new THREE.SphereGeometry(1, 12, 8), body, s * 1.6, 0.1, -0.2, fl); w.scale.set(1.8, 0.14, 0.9); }
      const fin = add(new THREE.SphereGeometry(1, 10, 8), body, 0, 0.7, -4.3, g, false); fin.scale.set(0.18, 0.55, 0.5);
      for (const s of [-1, 1]) { const p = add(new THREE.SphereGeometry(1, 10, 8), body, s * 1.3, -0.7, 2.2, g, false); p.scale.set(2.2, 0.12, 0.6); p.rotation.y = s * -0.5; p.rotation.z = s * 0.4; }
      g.rotation.y = dirx > 0 ? PI / 2 : -PI / 2; root.add(g);
      const spoutSp = []; for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false, color: 0xe8f4ff })); sp.renderOrder = 7; sp.visible = false; root.add(sp); spoutSp.push(sp); }
      const T = 16, spX = () => g.position.x + dirx * 2.2;
      let rung = false;
      Sh.ev.push({ kind: "whale", g, t: 0, upd(dt, e) {
        e.t += dt; const k = e.t / T; if (k >= 1) { g.parent.remove(g); spoutSp.forEach((s) => s.parent && s.parent.remove(s)); e.done = true; return; }
        // 浮上（0–0.2）→ 換氣噴水（0.2–0.75）→ 抬尾下潛（0.75–1）
        const up = k < 0.2 ? Math.sin(k / 0.2 * PI / 2) : k < 0.75 ? 1 : Math.cos((k - 0.75) / 0.25 * PI / 2);
        const px = x + dirx * e.t * 3.2; g.position.set(px, SEA - 1.9 + up * 1.7 + Math.sin(e.t * 0.9) * 0.08, z);
        g.rotation.x = k > 0.75 ? -(k - 0.75) * 3.0 : 0.05 * up; fl.rotation.x = Math.sin(e.t * 1.4) * 0.15;
        if (k > 0.2 && !rung) { rung = true; splash(px, z, 3); }
        spoutSp.forEach((sp, i) => { const ph = ((e.t - 3.5) * 0.45 + i / spoutSp.length) % 1, on = k > 0.22 && k < 0.7 && ((e.t - 3.5) % 6.5) < 2.4; sp.visible = on; if (on) { const hgt = ph * 5; sp.position.set(px + dirx * 2.4, SEA + 0.8 + hgt, z); const s = 0.8 + ph * 1.6; sp.scale.set(s, s, 1); sp.material.opacity = 0.9 * (1 - ph); } });
      } });
    };
    const flyingFish = (x, z, dirx) => {
      const n = Math.floor(rand(5, 9));
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group(), fm = M(0xb9d2e6, 0.3, 0.4);
        add(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), fm, 0, 0, 0, g, false).rotation.x = PI / 2;
        for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.01, 0.1), M(0xd8ecff, 0.3), s * 0.1, 0.01, 0, g, false);
        g.visible = false; root.add(g);
        const T = rand(1.2, 1.9), L = rand(6, 12), H = rand(0.5, 1.1), t0 = -rand(0, 0.7), px0 = x + rand(-3, 3), pz = z + rand(-2.5, 2.5);
        Sh.ev.push({ kind: "fish", g, upd(dt, e) { e.t = (e.t ?? t0) + dt; const k = e.t / T; if (k < 0) return; if (k >= 1) { g.parent.remove(g); e.done = true; return; }
          g.visible = true; g.position.set(px0 + k * L * dirx, SEA + H * 4 * k * (1 - k) + 0.1, pz); g.rotation.set(0, dirx > 0 ? PI / 2 : -PI / 2, 0); g.rotation.z = Math.sin(e.t * 40) * 0.12; } });
      }
    };
    const school = (x, z, dirx) => {   // 浮在水面附近的魚群（深色小魚影，一起游）
      const fish = [], mat = new THREE.MeshBasicMaterial({ color: 0x0f2438, transparent: true, opacity: 0.7, depthWrite: false });
      for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), mat); m.rotation.x = -PI / 2; m.position.set(x, SEA + 0.12, z); root.add(m); fish.push({ m, ox: rand(-2.5, 2.5), oz: rand(-2.5, 2.5), ph: rand(0, 6.28) }); }
      Sh.ev.push({ kind: "school", t: 0, upd(dt, e) { e.t += dt; const k = e.t / 22; if (k >= 1) { fish.forEach((f) => f.m.parent.remove(f.m)); e.done = true; return; }
        const cx = x + dirx * e.t * 3.0, cz = z + Math.sin(e.t * 0.4) * 2;
        fish.forEach((f) => { f.m.position.set(cx + f.ox + Math.sin(e.t * 2 + f.ph) * 0.4, SEA + 0.12, cz + f.oz + Math.cos(e.t * 1.7 + f.ph) * 0.4); f.m.rotation.z = dirx > 0 ? 0 : PI; f.m.scale.setScalar(clamp(Math.min(k * 8, (1 - k) * 8), 0, 1)); }); } });
    };

    const splash2 = (x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0.7 })); m.rotation.x = -PI / 2; m.position.set(x, WY + 0.02, z); root.add(m); Sh.ev.push({ kind: "ring", m, age: 0, upd(dt, e) { e.age += dt; const k = e.age / 1.3; m.scale.setScalar(0.4 + k * 1.8); m.material.opacity = 0.7 * (1 - k); if (k >= 1) { e.done = true; m.parent && m.parent.remove(m); } } }); };
    Sh = { root, hooks, ev: [], seaY: SEA, puffs: [], t: 0, nextD: 4, nextW: 25, nextF: 9, nextS: 13, hook: null };
    const place = (near = true) => { const side = Math.random() < 0.7 ? -1 : 1; return { x: pos.x + rand(-18, 26), z: side * rand(wH + (near ? 9 : 22), wH + (near ? 26 : 48)), dirx: 1 }; };
    Sh.spawn = (kind) => {
      const p = place(kind !== "whale"); const dirx = 1;
      if (kind === "dolphin") dolphinJump(p.x, p.z, 2 + Math.floor(Math.random() * 3), dirx);
      else if (kind === "whale") whale(p.x, p.z, dirx);
      else if (kind === "fish") flyingFish(p.x, p.z, dirx);
      else if (kind === "school") school(p.x, p.z, dirx);
    };

    Sh.hook = (dt, t) => {
      Sh.t += dt;
      Sh.nextD -= dt; Sh.nextW -= dt; Sh.nextF -= dt; Sh.nextS -= dt;
      if (Sh.nextD <= 0) { Sh.spawn("dolphin"); Sh.nextD = rand(14, 32); }
      if (Sh.nextW <= 0) { Sh.spawn("whale"); Sh.nextW = rand(50, 95); }
      if (Sh.nextF <= 0) { Sh.spawn("fish"); Sh.nextF = rand(9, 20); }
      if (Sh.nextS <= 0) { Sh.spawn("school"); Sh.nextS = rand(20, 40); }
      for (const e of Sh.ev) e.upd(dt, e);
      Sh.ev = Sh.ev.filter((e) => !e.done);
      // 尾流 / 浪花往船尾流動
      for (const fm of foams) { fm.map.offset.x += dt * 0.5; }
      // 煙囪冒煙：往船尾飄、變大、變淡
      for (const p of puffs) { p.t = (p.t + dt / 5) % 1; const k = p.t; p.sp.position.set(p.fx - k * 14, 4.5 + 8.2 + k * 3.2, 0); const s = 1.4 + k * 5; p.sp.scale.set(s, s, 1); p.sp.material.opacity = 0.6 * (1 - k); }
      flag.rotation.y = Math.sin(t * 3) * 0.35;
      { const p = waterGeo.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, Math.sin(x * 1.5 + t * 1.5) * 0.018 + Math.cos(y * 1.9 + t * 1.2) * 0.018); } p.needsUpdate = true; wT.offset.x = t * 0.01; wT.offset.y = t * 0.006;
        beach.position.set(pcx + Math.sin(t * 0.23) * 1.6, WY + 0.17 + Math.sin(t * 1.7) * 0.02, pcz + Math.cos(t * 0.19) * 1.2); beach.rotation.y = t * 0.4;
        if (ctx.getSwim && ctx.getSwim() > 0.5 && (Sh.ripT = (Sh.ripT || 0) - dt) <= 0) { Sh.ripT = 0.45; splash2(pos.x, pos.z); } }
      // 夜晚舷窗亮燈
      const sy = ctx.getSunHeight ? ctx.getSunHeight() : 1, night = clamp(1 - (sy + 0.18) / 0.3, 0, 1);
      portMat.emissiveIntensity = 0.05 + night * 2.4; underLight.intensity = night * 2.2;
    };
    hooks.push(Sh.hook);
    Sh.fade = fadeMats;
  }

  function unmount() {
    if (!Sh) return;
    const i = Sh.hooks.indexOf(Sh.hook); if (i >= 0) Sh.hooks.splice(i, 1);
    Sh.root.parent && Sh.root.parent.remove(Sh.root);
    Sh.fade.forEach((m) => m.parent && m.parent.remove(m));
    Sh = null;
  }
})();
