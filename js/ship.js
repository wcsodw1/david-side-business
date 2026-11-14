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
      Sh.ev.push({ kind: "ring", m, age: 0, big, upd(dt, e) { e.age += dt; const k = e.age / 1.6; m.scale.setScalar((0.6 + k * 3.2) * big); m.material.opacity = 0.9 * (1 - k); if (k >= 1) { e.done = true; m.parent && m.parent.remove(m); m.material.dispose(); m.geometry.dispose(); } } });
    };
    /* ----- 寫實海洋生物：共用工具 -----
       · loft()：依「剖面曲線」放樣出流線形身體（u=0 尾端 → u=1 吻端，頭朝 +z），每一截是上下不對稱的橢圓
       · 顏色用頂點色畫：背深腹淺（反蔭蔽）、斑紋、喉部溝紋；鰭用薄板擠出 + 圓角
       · fleshMat()：在頂點著色器裡讓身體往尾巴逐漸彎曲（鯨豚上下擺、魚左右擺），一個 draw call 就有自然的游動 */
    const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const cA = new THREE.Color();
    const curve = (k) => (u) => {                       // 非均勻 Hermite 曲線（剖面用）
      let i = 0; while (i < k.length - 2 && u > k[i + 1][0]) i++;
      const p0 = k[Math.max(i - 1, 0)], p1 = k[i], p2 = k[i + 1], p3 = k[Math.min(i + 2, k.length - 1)], d = p2[0] - p1[0];
      const t = clamp((u - p1[0]) / d, 0, 1), t2 = t * t, t3 = t2 * t;
      const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * d, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * d;
      return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (3 * t2 - 2 * t3) * p2[1] + (t3 - t2) * m2;
    };
    const loft = (o) => {
      const { len, nu, nv } = o, P = [], C = [], I = [], c = new THREE.Color();
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, w = Math.max(o.w(u), 0.0004), ht = Math.max(o.top(u), 0.0004), hb = Math.max(o.bot(u), 0.0004), yc = o.y ? o.y(u) : 0, z = (u - 0.5) * len;
        for (let j = 0; j < nv; j++) {
          const a = j / nv * PI * 2, s = Math.sin(a), cs = Math.cos(a), gr = o.groove ? o.groove(u, a, s) : 1;
          P.push(w * cs * gr, yc + (s > 0 ? ht : hb) * s * gr, z); o.color(u, s, cs, a, c); C.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * nv + j, b = i * nv + (j + 1) % nv, d = a + nv, e = b + nv; I.push(a, b, d, b, e, d); }
      const n0 = P.length / 3;                          // 兩端封口
      for (const [ring, u] of [[0, 0], [nu, 1]]) { P.push(0, o.y ? o.y(u) : 0, (u - 0.5) * len); C.push(C[ring * nv * 3], C[ring * nv * 3 + 1], C[ring * nv * 3 + 2]); }
      for (let j = 0; j < nv; j++) { const j1 = (j + 1) % nv; I.push(n0, j1, j); I.push(n0 + 1, nu * nv + j, nu * nv + j1); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
    };
    const fin = (pts, th, mirror = false) => {          // pts：外形（x, y）；mirror：只給右半邊，自動補左半邊（尾鰭）
      const all = mirror ? pts.concat(pts.slice(1, -1).reverse().map(([x, y]) => [-x, y])) : pts, sh = new THREE.Shape();
      sh.moveTo(all[0][0], all[0][1]); sh.splineThru(all.slice(1).map(([x, y]) => new THREE.Vector2(x, y))); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: th * 0.4, bevelEnabled: true, bevelThickness: th * 0.3, bevelSize: th * 0.3, bevelSegments: 2, curveSegments: 5, steps: 1 });
      g.translate(0, 0, -th * 0.2); g.deleteAttribute("uv"); return g;
    };
    const merge = (parts) => {                          // [[geometry, 上色函式(p, n, out) 或 null（用自身頂點色）]] → 一個非索引幾何
      const gs = parts.map(([g, f]) => [g.index ? g.toNonIndexed() : g, f]); let n = 0; gs.forEach(([g]) => (n += g.attributes.position.count));
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), p = new THREE.Vector3(), q = new THREE.Vector3(), c = new THREE.Color(); let o = 0;
      for (const [g, f] of gs) {
        const ps = g.attributes.position, ns = g.attributes.normal, cs = g.attributes.color;
        for (let i = 0; i < ps.count; i++, o += 3) {
          p.fromBufferAttribute(ps, i); q.fromBufferAttribute(ns, i); P[o] = p.x; P[o + 1] = p.y; P[o + 2] = p.z; N[o] = q.x; N[o + 1] = q.y; N[o + 2] = q.z;
          if (f) f(p, q, c); else c.fromBufferAttribute(cs, i); C[o] = c.r; C[o + 1] = c.g; C[o + 2] = c.b;
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.BufferAttribute(N, 3)); g.setAttribute("color", new THREE.BufferAttribute(C, 3)); g.computeBoundingSphere(); return g;
    };
    const BEND = `#include <begin_vertex>
      float zn = transformed.z / uLen;                       // 吻端 +0.5、尾端 -0.5
      float wb = smoothstep(0.12, -0.55, zn);                // 越靠尾巴彎得越多
      #ifdef USE_INSTANCING
        float ph = uPh + instanceMatrix[3].x * 2.3 + instanceMatrix[3].z * 1.7;
      #else
        float ph = uPh;
      #endif
      float bend = (uAmp * sin(ph + zn * 6.0) + uArch) * wb * wb * uLen;
      transformed.y += bend * (1.0 - uYaw); transformed.x += bend * uYaw;`;
    const fleshMat = (len, yaw, rough, metal = 0, env = 0.7, extra = {}) => {
      const u = { uPh: { value: 0 }, uAmp: { value: 0 }, uArch: { value: 0 }, uYaw: { value: yaw }, uLen: { value: len } };
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, envMapIntensity: env, ...extra });
      m.onBeforeCompile = (s) => { Object.assign(s.uniforms, u); s.vertexShader = "uniform float uPh, uAmp, uArch, uYaw, uLen;\n" + s.vertexShader.replace("#include <begin_vertex>", BEND); };
      m.userData.u = u; return m;
    };
    const meshOf = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = false; parent.add(m); return m; };
    const dispose = (o) => o.traverse((x) => { if (x.material && !x.material.userData.shared) x.material.dispose(); });

    /* ----- 水花：噴濺水滴 / 鯨魚噴氣（共用粒子池，避免一直建立新物件） ----- */
    const FX = { pool: [], live: [], on: false };
    const drop = (x, y, z, vx, vy, vz, s0, s1, life, grav, drag = 0, op = 0.9, col = 0xffffff) => {
      let sp = FX.pool.pop();
      if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeT, transparent: true, depthWrite: false })); sp.renderOrder = 7; }
      sp.material.color.setHex(col); sp.position.set(x, y, z); sp.visible = true; root.add(sp);
      FX.live.push({ sp, vx, vy, vz, s0, s1, life, grav, drag, op, age: 0 });
      if (!FX.on) { FX.on = true; Sh.ev.push({ kind: "fx", upd(dt, e) {
        FX.live = FX.live.filter((d) => {
          d.age += dt; const k = d.age / d.life;
          if (k >= 1) { d.sp.parent && d.sp.parent.remove(d.sp); FX.pool.push(d.sp); return false; }
          const dm = Math.exp(-d.drag * dt); d.vx *= dm; d.vz *= dm; d.vy = d.vy * dm - d.grav * dt;
          d.sp.position.x += d.vx * dt; d.sp.position.y += d.vy * dt; d.sp.position.z += d.vz * dt;
          if (d.grav > 3 && d.sp.position.y < SEA) d.age = d.life;      // 水滴落回海面就消失
          const s = lerp(d.s0, d.s1, k); d.sp.scale.set(s, s, 1); d.sp.material.opacity = d.op * Math.pow(1 - k, 1.3); return true;
        });
        if (!FX.live.length) { FX.on = false; e.done = true; }
      } }); }
    };
    const spray = (x, z, n, pow = 1, vx0 = 0) => {     // 出水 / 入水的水花
      for (let i = 0; i < n; i++) { const a = rand(0, PI * 2), r = rand(0.3, 1.4) * pow;
        drop(x + rand(-0.2, 0.2) * pow, SEA + 0.05, z + rand(-0.2, 0.2) * pow, vx0 + Math.cos(a) * r, rand(2.2, 4.6) * pow, Math.sin(a) * r, 0.18 * pow, 0.42 * pow, rand(0.55, 0.95), 9.8, 0.4, 0.95); }
      for (let i = 0; i < Math.ceil(n / 3); i++) drop(x + rand(-0.4, 0.4) * pow, SEA + 0.15, z + rand(-0.4, 0.4) * pow, vx0, rand(0.3, 0.8), 0, 0.5 * pow, 1.6 * pow, rand(0.8, 1.3), 0.2, 1.5, 0.55, 0xf2f8ff);
    };

    /* ----- 海豚（瓶鼻海豚）：長吻、隆起的額隆、鐮刀狀背鰭、水平尾鰭；背深灰、側淺灰、腹近白 ----- */
    const G = {};                                       // 共用幾何：每種生物只建一次
    const dolphinGeo = () => G.dolphin || (G.dolphin = (() => {
      const L = 2.3, DK = 0x434f59, MID = 0x6f7c87;
      const body = loft({ len: L, nu: 72, nv: 28,
        w: curve([[0, 0.004], [0.04, 0.032], [0.12, 0.042], [0.3, 0.11], [0.5, 0.19], [0.62, 0.205], [0.75, 0.19], [0.85, 0.15], [0.9, 0.1], [0.93, 0.058], [0.97, 0.042], [1, 0.006]]),
        top: curve([[0, 0.004], [0.04, 0.05], [0.12, 0.085], [0.3, 0.15], [0.5, 0.21], [0.62, 0.22], [0.75, 0.2], [0.84, 0.172], [0.88, 0.125], [0.91, 0.052], [0.97, 0.034], [1, 0.006]]),
        bot: curve([[0, 0.004], [0.04, 0.048], [0.12, 0.078], [0.3, 0.14], [0.5, 0.19], [0.62, 0.19], [0.75, 0.17], [0.85, 0.13], [0.9, 0.08], [0.93, 0.044], [0.97, 0.03], [1, 0.006]]),
        y: curve([[0, 0], [0.5, 0], [0.88, -0.01], [0.95, -0.055], [1, -0.065]]),
        color(u, s, cs, a, out) {
          out.setHex(0xe4e1df).convertSRGBToLinear().lerp(cA.setHex(0x7b8893).convertSRGBToLinear(), sstep(-0.55, 0.05, s + 0.12 * Math.sin(u * 11 + 1.2) + (u > 0.88 ? 0.2 : 0)));
          out.lerp(cA.setHex(DK).convertSRGBToLinear(), 0.9 * sstep(0.3, 0.78, s + 0.25 * Math.sin(u * PI * 1.6 - 0.6)));      // 背上深色披風
          if (u > 0.9 && Math.abs(s + 0.12) < 0.07) out.lerp(cA.setHex(0x3a4148).convertSRGBToLinear(), 0.5);                  // 嘴線
          const du = (u - 0.862) / 0.013, ds = (s + 0.03) / 0.12; if (Math.abs(cs) > 0.6 && du * du + ds * ds < 1) out.setHex(0x14171a).convertSRGBToLinear();   // 小小的眼睛
        } });
      const dorsal = fin([[0.19, 0], [0.12, 0.1], [0.03, 0.2], [-0.08, 0.27], [-0.19, 0.3], [-0.15, 0.23], [-0.12, 0.13], [-0.13, 0.05], [-0.18, 0]], 0.035);
      dorsal.rotateY(-PI / 2); dorsal.translate(0, 0.175, -0.06);
      const fluke = fin([[0, 0.05], [0.09, 0.035], [0.17, -0.02], [0.24, -0.1], [0.27, -0.155], [0.21, -0.14], [0.13, -0.11], [0.05, -0.1], [0, -0.065]], 0.028, true);
      fluke.rotateX(PI / 2); fluke.translate(0, 0, -L / 2 + 0.09);
      const parts = [[body, null], [dorsal, (p, n, o) => o.setHex(DK).convertSRGBToLinear()], [fluke, (p, n, o) => o.setHex(n.y > 0 ? DK : MID).convertSRGBToLinear()]];
      for (const s of [-1, 1]) {
        const f = fin([[0, 0.06], [0.08, 0.05], [0.17, 0.005], [0.24, -0.055], [0.2, -0.065], [0.11, -0.045], [0, -0.05]].map(([x, y]) => [x * s, y]), 0.026);
        f.rotateX(PI / 2); f.rotateY(s * 0.55); f.rotateZ(-s * 0.5); f.translate(s * 0.13, -0.11, 0.52); parts.push([f, (p, n, o) => o.setHex(n.y > 0 ? DK : MID).convertSRGBToLinear()]);
      }
      return merge(parts);
    })());
    const dolphinModel = () => { const g = new THREE.Group(), mat = fleshMat(2.3, 0, 0.34, 0, 0.55); meshOf(dolphinGeo(), mat, g); g.userData.u = mat.userData.u; return g; };
    const dolphinJump = (x, z, n, dirx) => {
      for (let i = 0; i < n; i++) {
        const g = dolphinModel(), u = g.userData.u; g.visible = false; root.add(g);
        const T = rand(1.5, 2.1), L = rand(7, 11), H = rand(2.2, 3.6), t0 = -i * rand(0.45, 0.8), zz = z + rand(-1.2, 1.2), xx = x + i * rand(-2, 2), ph0 = rand(0, 6);
        let splashed = false, splashedOut = false;
        Sh.ev.push({ kind: "dolphin", g, upd(dt, e) {
          e.t = (e.t ?? t0) + dt; const k = e.t / T;
          if (k < 0) return; if (k >= 1) { g.parent && g.parent.remove(g); dispose(g); e.done = true; return; }
          g.visible = true; const px = xx + k * L * dirx, py = SEA + H * 4 * k * (1 - k) - 0.3;
          const slope = H * 4 * (1 - 2 * k) / L;           // 拋物線的切線：頭先出水、頭先入水
          g.position.set(px, py, zz); g.rotation.set(0, dirx > 0 ? PI / 2 : -PI / 2, 0); g.rotateX(-Math.atan(slope)); g.rotateZ(Math.sin(k * PI * 2 + ph0) * 0.05);
          const near = 1 - sstep(0.12, 0.25, k) * sstep(0.88, 0.75, k);   // 靠近水面時尾鰭用力上下擺，空中則微微弓背
          u.uPh.value += dt * 13; u.uAmp.value = 0.06 * near; u.uArch.value = -0.035 * Math.sin(k * PI);
          if (!splashedOut && k > 0.05) { splashedOut = true; splash(px, zz, 0.8); spray(px, zz, 14, 0.85, (L / T) * dirx * 0.3); }
          if (!splashed && k > 0.94) { splashed = true; splash(px, zz, 0.9); spray(px, zz, 20, 1.05, (L / T) * dirx * 0.3); }
        } });
      }
    };

    /* ----- 鯨魚（座頭鯨）：長條身軀、扁平頭上的疣突、喉腹溝紋、超長胸鰭、小背鰭、鋸齒邊尾鰭；換氣時噴出霧狀水柱 ----- */
    const WL = 13;
    const whaleGeo = () => G.whale || (G.whale = (() => {
      const DK = 0x1f252b, WH = 0xd5d8d4;
      const W = curve([[0, 0.02], [0.05, 0.17], [0.15, 0.32], [0.3, 0.75], [0.45, 1.2], [0.6, 1.38], [0.72, 1.36], [0.84, 1.18], [0.92, 0.92], [0.97, 0.58], [0.995, 0.2], [1, 0.02]]);
      const TOP = curve([[0, 0.02], [0.05, 0.38], [0.15, 0.55], [0.3, 0.95], [0.45, 1.2], [0.6, 1.25], [0.72, 1.12], [0.84, 0.9], [0.92, 0.7], [0.97, 0.45], [0.995, 0.16], [1, 0.02]]);
      const BOT = curve([[0, 0.02], [0.05, 0.3], [0.15, 0.45], [0.3, 0.85], [0.45, 1.2], [0.6, 1.4], [0.72, 1.46], [0.84, 1.36], [0.92, 1.05], [0.97, 0.6], [0.995, 0.2], [1, 0.02]]);
      const YC = curve([[0, 0.1], [0.2, 0.05], [0.5, 0], [0.85, -0.1], [1, -0.2]]);
      const pleat = (u, s) => sstep(0.5, 0.58, u) * sstep(0.985, 0.93, u) * sstep(-0.18, -0.45, s);
      const body = loft({ len: WL, nu: 96, nv: 78, w: W, top: TOP, bot: BOT, y: YC,
        groove: (u, a, s) => 1 - 0.022 * pleat(u, s) * (0.5 + 0.5 * Math.cos(a * 26)),             // 喉腹溝紋（真的凹進去）
        color(u, s, cs, a, out) {
          const nz = Math.sin(u * 41 + a * 3) * Math.sin(u * 17 - a * 5) * 0.5 + Math.sin(u * 93 + a * 11) * 0.2;
          out.setHex(DK).convertSRGBToLinear().lerp(cA.setHex(0x2f373e).convertSRGBToLinear(), sstep(0.25, -0.35, s));
          out.lerp(cA.setHex(WH).convertSRGBToLinear(), sstep(-0.25, -0.62, s + nz * 0.28) * (0.5 + 0.5 * sstep(0.35, 0.6, u)));   // 斑駁的白色腹部
          const pg = pleat(u, s) * Math.pow(0.5 + 0.5 * Math.cos(a * 26), 4); if (pg > 0) out.lerp(cA.setHex(0x3a4249).convertSRGBToLinear(), pg * 0.8);
          if (Math.abs(u - 0.79) < 0.008 && Math.abs(cs) < 0.09 && s > 0) out.setHex(0x0c0f12).convertSRGBToLinear();           // 噴氣孔
        } });
      const parts = [[body, null]];
      // 頭頂的疣突（座頭鯨特徵）
      for (let r = 0; r < 6; r++) for (const side of [-1, 1]) for (let q = 0; q < 2; q++) {
        const u = 0.86 + r * 0.023, xx = side * (0.18 + q * 0.28) * W(u) / 0.9, ss = Math.sqrt(Math.max(0, 1 - (xx / W(u)) ** 2));
        const b = new THREE.SphereGeometry(0.075, 7, 5); b.translate(xx, YC(u) + TOP(u) * ss - 0.01, (u - 0.5) * WL); parts.push([b, (p, n, o) => o.setHex(0x272e34).convertSRGBToLinear()]);
      }
      const dorsal = fin([[0.6, 0], [0.3, 0.14], [0, 0.32], [-0.22, 0.42], [-0.3, 0.33], [-0.36, 0.12], [-0.6, 0]], 0.12);
      dorsal.rotateY(-PI / 2); dorsal.translate(0, 0.86, (0.3 - 0.5) * WL); parts.push([dorsal, (p, n, o) => o.setHex(DK).convertSRGBToLinear()]);
      // 尾鰭：後緣鋸齒、腹面白底黑斑（每隻座頭鯨都不一樣）
      const fl = [[0, 0.35], [0.5, 0.3], [1.1, 0.06], [1.7, -0.33], [2.15, -0.7]];
      for (let i = 1; i <= 10; i++) { const t = i / 11, xx = 2.15 * (1 - t); fl.push([xx * 0.98, -0.7 + 0.32 * t - 0.12 * Math.sin(t * PI) + (i % 2 ? 0.05 : -0.03)]); }
      fl.push([0, -0.26]);
      const fluke = fin(fl, 0.13, true); fluke.rotateX(PI / 2); fluke.translate(0, 0.02, -WL / 2 + 0.3);
      parts.push([fluke, (p, n, o) => { if (n.y > 0.3) o.setHex(DK).convertSRGBToLinear(); else { o.setHex(0xe2e3df).convertSRGBToLinear().lerp(cA.setHex(DK).convertSRGBToLinear(), clamp(sstep(0.35, 0.95, Math.abs(p.x) / 2.15) + 0.6 * Math.max(0, Math.sin(p.x * 5.3) * Math.sin(p.z * 7.1)), 0, 0.92)); } }]);
      // 超長胸鰭（約身長 1/3）：前緣有一顆顆結節、略往後彎；上面深色、前緣與下面白色
      for (const s of [-1, 1]) {
        const lead = [], trail = [], S = 4.0;
        for (let i = 0; i <= 22; i++) { const t = i / 22, c = -0.4 * t * t, h = 0.45 * (1 - 0.55 * Math.pow(t, 1.5)); lead.push([t * S, c + h + (t > 0.12 ? 0.045 * Math.abs(Math.sin(t * PI * 8)) : 0)]); trail.push([t * S, c - h]); }
        const pts = lead.concat([[S + 0.12, -0.4]], trail.reverse()).map(([x, y]) => [x * s, y]);
        const f = fin(pts, 0.14); f.rotateX(PI / 2); f.rotateY(s * 0.6); f.rotateZ(-s * 0.42); f.translate(s * 1.05, -0.75, (0.7 - 0.5) * WL);
        parts.push([f, (p, n, o) => o.setHex(n.y > 0.35 ? 0x353d44 : WH).convertSRGBToLinear()]);
      }
      return merge(parts);
    })());
    const whale = (x, z, dirx) => {
      const g = new THREE.Group(), pitch = new THREE.Group(), mat = fleshMat(WL, 0, 0.45, 0, 0.45), u = mat.userData.u;
      g.add(pitch); meshOf(whaleGeo(), mat, pitch);
      g.rotation.y = dirx > 0 ? PI / 2 : -PI / 2; root.add(g);
      const T = 16, V = 3.2, blowLocal = new THREE.Vector3(0, 0.75, (0.79 - 0.5) * WL), v = new THREE.Vector3();
      let rung = false, blows = 0, dripT = 0, tailIn = false;
      Sh.ev.push({ kind: "whale", g, t: 0, upd(dt, e) {
        e.t += dt; const k = e.t / T; if (k >= 1) { g.parent && g.parent.remove(g); dispose(g); e.done = true; return; }
        // 浮上（0–0.2）→ 換氣噴水（0.2–0.72）→ 弓背、抬尾下潛（0.72–1）
        const up = k < 0.2 ? Math.sin(k / 0.2 * PI / 2) : 1, dk = clamp((k - 0.72) / 0.28, 0, 1);
        const px = x + dirx * e.t * V;
        g.position.set(px, SEA - 2.6 + up * 2.05 - 7.5 * Math.pow(dk, 1.6) + Math.sin(e.t * 0.9) * 0.06, z);
        pitch.rotation.x = k < 0.2 ? -0.07 * Math.sin(k / 0.2 * PI) : 1.05 * sstep(0, 0.7, dk);          // 正值＝低頭（下潛）
        pitch.rotation.z = Math.sin(e.t * 0.5) * 0.03;
        u.uPh.value += dt * 1.3; u.uAmp.value = 0.012 * (1 - dk); u.uArch.value = -0.025 * Math.sin(dk * PI);
        if (k > 0.18 && !rung) { rung = true; splash(px, z, 3); spray(px + dirx * 3.5, z, 16, 1.6, V * dirx); }
        // 噴氣：每 3.6 秒一次，霧狀水柱往上衝、散開、往後飄
        if (k > 0.22 && k < 0.68 && e.t > 3.6 + blows * 3.6) {
          blows++; g.updateMatrixWorld(true); v.copy(blowLocal); pitch.localToWorld(v);
          for (let i = 0; i < 26; i++) { const sp = rand(0.2, 1);
            drop(v.x + rand(-0.15, 0.15), v.y, v.z + rand(-0.15, 0.15), V * dirx * 0.55 + rand(-0.6, 0.6), rand(5.5, 9) * sp + 2, rand(-0.6, 0.6), 0.5, rand(2.2, 3.6), rand(1.8, 2.8), 3.2, 1.1, 0.8, 0xeef6ff); }
        }
        // 下潛時尾鰭抬出水面，水從尾鰭後緣滴下；尾鰭入水時一圈水花
        if (dk > 0.2 && dk < 0.85) {
          g.updateMatrixWorld(true); v.set(rand(-1.9, 1.9), 0, -WL / 2 - 0.35); pitch.localToWorld(v);
          if (v.y > SEA + 0.2 && (dripT -= dt) <= 0) { dripT = 0.05; drop(v.x, v.y, v.z, V * dirx * 0.8, rand(-0.5, 0.3), rand(-0.2, 0.2), 0.12, 0.2, 1.2, 9.8, 0, 0.9); }
          if (v.y > SEA + 0.5) tailIn = true; else if (tailIn && v.y < SEA + 0.1) { tailIn = false; splash(v.x, v.z, 1.8); spray(v.x, v.z, 14, 1.1, V * dirx); }
        }
      } });
    };

    /* ----- 飛魚：魚雷形身體、展開的大胸鰭滑翔、下尾葉較長（拍水起飛） ----- */
    const flyGeo = () => G.fly || (G.fly = (() => {
      const L = 0.4;
      const body = loft({ len: L, nu: 28, nv: 12,
        w: curve([[0, 0.003], [0.12, 0.011], [0.3, 0.028], [0.6, 0.036], [0.85, 0.029], [0.95, 0.017], [1, 0.003]]),
        top: curve([[0, 0.003], [0.12, 0.013], [0.3, 0.032], [0.6, 0.04], [0.85, 0.032], [0.95, 0.018], [1, 0.003]]),
        bot: curve([[0, 0.003], [0.12, 0.012], [0.3, 0.03], [0.6, 0.037], [0.85, 0.03], [0.95, 0.016], [1, 0.003]]),
        color(u, s, cs, a, out) { out.setHex(0xeef1f4).convertSRGBToLinear().lerp(cA.setHex(0xc4d0db).convertSRGBToLinear(), sstep(-0.6, -0.1, s)).lerp(cA.setHex(0x1b3a6b).convertSRGBToLinear(), sstep(0.15, 0.55, s)); } });
      const tail = fin([[0.02, 0], [-0.05, 0.05], [-0.085, 0.065], [-0.055, 0.012], [-0.055, -0.01], [-0.1, -0.095], [-0.045, -0.045]], 0.008);
      tail.rotateY(-PI / 2); tail.translate(0, 0, -L / 2 + 0.01);
      const body2 = merge([[body, null], [tail, (p, n, o) => o.setHex(0x274a73).convertSRGBToLinear()]]);
      const wingPts = [[0, 0.028], [0.08, 0.032], [0.17, 0.012], [0.245, -0.025], [0.27, -0.048], [0.215, -0.056], [0.13, -0.05], [0.05, -0.034], [0, -0.02]], wp = [];
      for (const s of [-1, 1]) for (const [sc, zz] of [[1, 0.075], [0.42, -0.07]]) {     // 大胸鰭 + 小腹鰭
        const f = fin(wingPts.map(([x, y]) => [x * s * sc, y * sc]), 0.004); f.rotateX(PI / 2); f.rotateZ(s * 0.09); f.translate(s * 0.022, 0.006, zz);
        wp.push([f, (p, n, o) => o.setHex(0x34495c).convertSRGBToLinear().lerp(cA.setHex(0x7d90a2).convertSRGBToLinear(), clamp(Math.abs(p.x) / 0.27, 0, 1))]);
      }
      return { body: body2, wings: merge(wp) };
    })());
    const flyingFish = (x, z, dirx) => {
      const n = Math.floor(rand(5, 9)), geo = flyGeo(), mat = fleshMat(0.4, 1, 0.3, 0.55, 1.0), u = mat.userData.u;
      const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
      let alive = n;
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group(); meshOf(geo.body, mat, g); meshOf(geo.wings, wingMat, g).renderOrder = 6; g.visible = false; root.add(g);
        const T = rand(1.2, 1.9), L = rand(6, 12), H = rand(0.5, 1.1), t0 = -rand(0, 0.7), px0 = x + rand(-3, 3), pz = z + rand(-2.5, 2.5), bank = rand(-0.25, 0.25);
        let inN = 0, outN = false, trailT = 0;
        Sh.ev.push({ kind: "fish", g, upd(dt, e) { e.t = (e.t ?? t0) + dt; const k = e.t / T; if (k < 0) return;
          if (k >= 1) { g.parent && g.parent.remove(g); if (--alive === 0) { mat.dispose(); wingMat.dispose(); } e.done = true; return; }
          if (i === 0) u.uPh.value += dt * 45;
          // 出水滑行（尾巴拍水）→ 張開胸鰭貼著海面滑翔、慢慢下降 → 落水
          const env = k < 0.12 ? Math.sin(k / 0.12 * PI / 2) : k < 0.88 ? 1 - 0.35 * (k - 0.12) / 0.76 : 0.65 * Math.cos((k - 0.88) / 0.12 * PI / 2);
          const px = px0 + k * L * dirx; g.visible = true; g.position.set(px, SEA + 0.06 + H * env, pz);
          g.rotation.set(0, dirx > 0 ? PI / 2 : -PI / 2, 0); g.rotateX(k < 0.12 ? -0.35 : k > 0.88 ? 0.4 : 0.05); g.rotateZ(bank * Math.sin(k * PI));
          if (i === 0) u.uAmp.value = k < 0.1 || k > 0.9 ? 0.06 : 0.008;
          if (!outN && k > 0.02) { outN = true; splash(px, pz, 0.22); spray(px, pz, 3, 0.35); }
          if (k < 0.1 && (trailT -= dt) <= 0) { trailT = 0.05; splash(px, pz, 0.12); }
          if (inN === 0 && k > 0.96) { inN = 1; splash(px, pz, 0.3); spray(px, pz, 5, 0.4); }
        } });
      }
    };

    /* ----- 魚群（鯖魚 / 沙丁魚）：海面下一大團暗影，銀色魚身翻轉時閃光，背鰭劃破水面、偶爾有魚跳出 ----- */
    const sardineGeo = () => G.sardine || (G.sardine = (() => {
      const L = 0.32;
      const body = loft({ len: L, nu: 22, nv: 10,
        w: curve([[0, 0.003], [0.1, 0.009], [0.35, 0.026], [0.6, 0.03], [0.85, 0.024], [1, 0.003]]),
        top: curve([[0, 0.004], [0.1, 0.015], [0.35, 0.042], [0.6, 0.047], [0.85, 0.035], [1, 0.005]]),
        bot: curve([[0, 0.004], [0.1, 0.013], [0.35, 0.036], [0.6, 0.04], [0.85, 0.03], [1, 0.005]]),
        color(u, s, cs, a, out) { out.setHex(0xf0f2f2).convertSRGBToLinear().lerp(cA.setHex(0xcfd9df).convertSRGBToLinear(), sstep(-0.5, 0, s)).lerp(cA.setHex(0x1f4b5c).convertSRGBToLinear(), sstep(0.3, 0.6, s));
          if (s > 0.5 && Math.sin(u * 70 + s * 9) > 0.4) out.lerp(cA.setHex(0x0d2229).convertSRGBToLinear(), 0.6); } });
      const tail = fin([[0.02, 0], [-0.04, 0.045], [-0.07, 0.065], [-0.045, 0.012], [-0.04, 0], [-0.045, -0.012], [-0.07, -0.065], [-0.04, -0.045]], 0.006);
      tail.rotateY(-PI / 2); tail.translate(0, 0, -L / 2 + 0.012);
      return merge([[body, null], [tail, (p, n, o) => o.setHex(0x2a4a55).convertSRGBToLinear()]]);
    })());
    const shadowTex = () => G.shadow || (G.shadow = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
      gr.addColorStop(0, "rgba(8,22,34,.75)"); gr.addColorStop(0.6, "rgba(8,22,34,.35)"); gr.addColorStop(1, "rgba(8,22,34,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })());
    const school = (x, z, dirx) => {
      const N = 60, mat = fleshMat(0.32, 1, 0.22, 0.85, 1.3), u = mat.userData.u, im = new THREE.InstancedMesh(sardineGeo(), mat, N);
      im.frustumCulled = false; im.castShadow = false; root.add(im);
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, opacity: 0 }));
      patch.rotation.x = -PI / 2; patch.scale.set(8, 5, 1); patch.renderOrder = 1; root.add(patch);
      const fish = [], d = new THREE.Object3D(); d.rotation.order = "YXZ";
      for (let i = 0; i < N; i++) { const r = Math.sqrt(Math.random()), a = rand(0, PI * 2); fish.push({ ox: Math.cos(a) * r * 3.2, oz: Math.sin(a) * r * 2.0, ph: rand(0, 6.28), sp: rand(0.8, 1.3), jt: -1, jT: 0, jH: 0 }); }
      let leapT = 0.5;
      Sh.ev.push({ kind: "school", t: 0, upd(dt, e) { e.t += dt; const k = e.t / 22;
        if (k >= 1) { im.parent && im.parent.remove(im); patch.parent && patch.parent.remove(patch); mat.dispose(); patch.material.dispose(); patch.geometry.dispose(); im.dispose(); e.done = true; return; }
        const cx = x + dirx * e.t * 3.0, cz = z + Math.sin(e.t * 0.4) * 2, fade = clamp(Math.min(k * 8, (1 - k) * 8), 0, 1), turn = Math.cos(e.t * 0.4) * 0.8 * 0.4 / 3.0;
        patch.position.set(cx, SEA + 0.03, cz); patch.material.opacity = 0.55 * fade; u.uPh.value += dt * 16; u.uAmp.value = 0.05;
        if ((leapT -= dt) <= 0 && fade > 0.5) { leapT = rand(0.12, 0.45); const f = fish[Math.floor(Math.random() * N)]; if (f.jt < 0) { f.jt = 0; f.jT = rand(0.35, 0.6); f.jH = rand(0.25, 0.6); f.splashed = false; splash(cx + f.ox, cz + f.oz, 0.15); } }
        for (let i = 0; i < N; i++) { const f = fish[i], wob = e.t * 2 * f.sp + f.ph;
          let y = SEA - 0.03 + Math.sin(wob * 1.3) * 0.028, pitch = 0;
          const fx = cx + f.ox + Math.sin(wob) * 0.35, fz = cz + f.oz + Math.cos(wob * 0.85) * 0.35;
          if (f.jt >= 0) { f.jt += dt; const q = f.jt / f.jT; if (q >= 1) { f.jt = -1; splash(fx, fz, 0.18); } else { y += f.jH * 4 * q * (1 - q) + 0.05; pitch = -Math.atan(f.jH * 4 * (1 - 2 * q) / (3 * f.jT)); } }
          d.position.set(fx, y, fz); d.rotation.set(pitch, (dirx > 0 ? PI / 2 : -PI / 2) + turn + Math.cos(wob) * 0.25, Math.sin(wob * 1.7) * 0.7);   // 側翻：銀色魚腹反光一閃一閃
          d.scale.setScalar(fade); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
        im.instanceMatrix.needsUpdate = true;
      } });
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
