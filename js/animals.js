/* ============================================================
   動物：
   · 天上的飛鳥（白天繞著藝廊上空盤旋，晚上休息）
   · 花園裡的走獸（兔子、小鹿、狐狸）：會閒晃、看到人會躲；不能進房子（David 的家、美術館）
   · 家裡的一隻貓、一隻狗：只在家裡走動，不會跑出去
   全部是程序生成的簡單模型，純規則式行為。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Animals = { mount, unmount, state: () => (Z ? { wild: Z.wild.map((a) => [a.kind, +a.x.toFixed(1), +a.z.toFixed(1)]), pets: Z.pets.map((a) => [a.kind, +a.x.toFixed(1), +a.z.toFixed(1)]), birds: Z.birds.length } : null) });
  let Z = null;
  // 測試用：快轉模擬 n 步（每步 dt 秒），回報有沒有走獸進了房子 / 寵物跑出家
  api.sim = (n = 6000, dt = 0.1) => {
    if (!Z) return null; const bad = { wildInHouse: 0, wildInMuseum: 0, petOutside: 0 }; let t = 0;
    for (let i = 0; i < n; i++) { t += dt; Z.hook(dt, t);
      for (const a of Z.wild) { if (a.x > Z.H.x0 - 0.2 && a.x < Z.H.x1 + 0.2 && a.z > Z.H.z0 - 0.2 && a.z < Z.H.z1 + 0.2) bad.wildInHouse++; if (a.x > Z.E - 0.3) bad.wildInMuseum++; }
      for (const a of Z.pets) if (!(a.x > Z.H.x0 && a.x < Z.H.x1 && a.z > Z.H.z0 && a.z < Z.H.z1)) bad.petOutside++; }
    return bad;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  /* ---------- 四足動物模型（面朝 +z）：毛皮紋理、肚皮漸層、兩節腿、脖子、耳內側、鬍鬚、眼睛高光 ---------- */
  const furTexCache = {};
  const furTex = (THREE, kind) => {
    if (furTexCache[kind]) return furTexCache[kind];
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1800; i++) { const v = 205 + Math.random() * 50; g.strokeStyle = `rgba(${v},${v},${v},${0.1 + Math.random() * 0.22})`; g.lineWidth = 0.6 + Math.random() * 0.7; const x = Math.random() * 128, y = Math.random() * 128, l = 3 + Math.random() * 6, a = kind === "stripe" ? 1.2 + Math.random() * 0.4 : Math.random() * 6.28; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    if (kind === "stripe") for (let i = 0; i < 9; i++) { g.fillStyle = "rgba(90,90,100,.22)"; g.fillRect(0, i * 15 + Math.random() * 4, 128, 4 + Math.random() * 3); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return (furTexCache[kind] = t);
  };

  function quad(THREE, o) {
    const tex = furTex(THREE, o.stripe ? "stripe" : "fur");
    const M = (c, r = 0.9, withTex = true) => new THREE.MeshStandardMaterial({ color: c, roughness: r, envMapIntensity: 0.35, map: withTex ? tex : null });
    const fur = M(o.col), light = M(o.light || o.col), dark = M(o.dark || 0x2a2018, 0.6, false), sock = M(o.sock || o.col), pink = M(0xf2a6b4, 0.7, false), white = M(0xffffff, 0.3, false);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const sph = (r, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
    const [L, H, W] = o.body, lh = o.legH, by = lh + H * 0.5, up = new THREE.Vector3(0, 1, 0);
    const limb = (a, b, r0, r1, mat, parent) => { const d = b.clone().sub(a), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 12), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(up, d.normalize()); m.castShadow = true; parent.add(m); return m; };

    // 身體：背部顏色 → 肚皮顏色的漸層（頂點色）
    const bodyGeo = sph(0.5, 32, 22), pos = bodyGeo.attributes.position, cols = [], cTop = new THREE.Color(o.col), cBel = new THREE.Color(o.belly || o.col);
    for (let i = 0; i < pos.count; i++) { const k = Math.min(1, Math.max(0, (0.5 - pos.getY(i)) / 0.75)), c = cTop.clone().lerp(cBel, k * k); cols.push(c.r, c.g, c.b); }
    bodyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    const torso = add(bodyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, roughness: 0.92, envMapIntensity: 0.35 }), body, 0, by, 0); torso.scale.set(W, H, L);
    add(sph(0.5), fur, body, 0, by + H * 0.02, L * 0.3).scale.set(W * 0.98, H * 0.95, L * 0.4);                 // 胸 / 肩
    add(sph(0.5), fur, body, 0, by + H * (o.haunch ? 0.12 : 0.0), -L * 0.28).scale.set(W * 1.02, H * (o.haunch || 0.95), L * (o.haunch ? 0.5 : 0.42));   // 臀 / 後腿肌肉
    if (o.chest) add(sph(0.5), M(o.chest), body, 0, by - H * 0.12, L * 0.38).scale.set(W * 0.6, H * 0.7, L * 0.25);   // 胸前白毛

    // 腿：大腿 + 小腿（會彎）+ 腳掌
    const legs = [], hipY = lh + H * 0.14;
    for (const [sx, sz] of [[-1, 1], [1, -1], [1, 1], [-1, -1]]) {
      const front = sz > 0, hip = new THREE.Group(); hip.position.set(sx * W * 0.32, hipY, sz * L * 0.3); body.add(hip);
      const u = hipY * 0.5, l2 = hipY - u;
      limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -u, front ? 0 : 0.03), o.legR * (front ? 1.15 : 1.5), o.legR * 0.85, fur, hip);
      const knee = new THREE.Group(); knee.position.set(0, -u, front ? 0 : 0.03); hip.add(knee);
      add(sph(o.legR * 0.95, 10, 8), fur, knee, 0, 0, 0);
      limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -l2 + 0.03, front ? 0 : -0.03), o.legR * 0.8, o.legR * 0.62, sock, knee);
      add(sph(o.legR * 1.05, 10, 8), dark, knee, 0, -l2 + 0.02, 0.015).scale.set(1, 0.6, 1.5);
      legs.push({ hip, knee, front });
    }

    // 頭 + 脖子
    const head = new THREE.Group(), hr = o.headR, hy = by + H * (o.neck || 0.35), hz = L * 0.5 + (o.neck > 0.6 ? 0.18 : 0.02); head.position.set(0, hy, hz); body.add(head);
    if ((o.neck || 0) > 0.5) limb(new THREE.Vector3(0, by + H * 0.15, L * 0.34), new THREE.Vector3(0, hy - hr * 0.3, hz - hr * 0.2), hr * 0.85, hr * 0.5, fur, body);
    add(sph(hr, 26, 18), fur, head, 0, 0, hr * 0.15).scale.set(0.95, 0.95, 1.08);                                  // 頭骨
    const mz = add(sph(hr * 0.55, 18, 12), light, head, 0, -hr * 0.22, hr * 0.92); mz.scale.set(0.88, 0.72, 1.25);   // 口鼻
    add(sph(hr * 0.2, 12, 8), dark, head, 0, -hr * 0.05, hr * 1.55).scale.set(1.1, 0.8, 0.9);                       // 鼻頭
    if (o.cheek) for (const sx of [-1, 1]) add(sph(hr * 0.42, 14, 10), light, head, sx * hr * 0.5, -hr * 0.3, hr * 0.7);   // 臉頰
    for (const sx of [-1, 1]) {
      add(sph(hr * 0.17, 12, 10), dark, head, sx * hr * 0.47, hr * 0.22, hr * 0.84); add(sph(hr * 0.06, 8, 6), white, head, sx * hr * 0.5, hr * 0.3, hr * 0.96);   // 眼睛 + 高光
      if (o.ear === "long") { const e = add(sph(hr * 0.3, 12, 10), fur, head, sx * hr * 0.4, hr * 1.55, -hr * 0.1); e.scale.set(0.5, 3.0, 0.9); e.rotation.z = -sx * 0.16; const ei = add(sph(hr * 0.2, 10, 8), pink, head, sx * hr * 0.4, hr * 1.5, -hr * 0.0); ei.scale.set(0.4, 2.6, 0.5); ei.rotation.z = -sx * 0.16; }
      else if (o.ear === "point") { const e = add(new THREE.ConeGeometry(hr * 0.45, hr * 1.1, 14), fur, head, sx * hr * 0.55, hr * 1.0, -hr * 0.1); e.rotation.z = -sx * 0.22; add(new THREE.ConeGeometry(hr * 0.28, hr * 0.7, 12), o.earIn ? M(o.earIn, 0.7, false) : dark, head, sx * hr * 0.55, hr * 0.96, hr * 0.02).rotation.z = -sx * 0.22; }
      else if (o.ear === "deer") { const e = add(sph(hr * 0.45, 12, 10), fur, head, sx * hr * 0.85, hr * 0.75, -hr * 0.1); e.scale.set(0.45, 1.25, 0.8); e.rotation.z = -sx * 0.8; add(sph(hr * 0.3, 10, 8), pink, head, sx * hr * 0.86, hr * 0.74, -hr * 0.02).scale.set(0.3, 1.0, 0.5); }
      else { const e = add(sph(hr * 0.5, 14, 10), dark.clone ? M(o.earCol || o.dark || 0x4a3626, 0.9) : fur, head, sx * hr * 0.78, hr * 0.5, -hr * 0.05); e.scale.set(0.42, 1.15, 0.8); e.rotation.z = -sx * 0.5; }   // 垂耳
    }
    if (o.whisk) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const w = add(new THREE.CylinderGeometry(0.003, 0.002, hr * 1.5, 4), white, head, sx * hr * 0.75, -hr * 0.18 + k * hr * 0.1, hr * 1.25); w.rotation.z = Math.PI / 2 + sx * (0.1 + k * 0.12); w.rotation.y = sx * -0.2; }
    if (o.antlers) for (const sx of [-1, 1]) { const A = M(0x6a4a2c, 0.8, false); const a = add(new THREE.CylinderGeometry(0.012, 0.022, hr * 2.6, 6), A, head, sx * hr * 0.5, hr * 1.9, -hr * 0.1); a.rotation.z = -sx * 0.3; for (const [h2, sd] of [[0.9, 0.7], [1.5, 0.55], [2.1, 0.4]]) { const t = add(new THREE.CylinderGeometry(0.008, 0.014, hr * 1.2 * sd, 5), A, head, sx * (hr * 0.5 + h2 * hr * 0.2), hr * (1.2 + h2 * 0.5), -hr * 0.1 + (h2 > 1.4 ? hr * 0.25 : 0)); t.rotation.z = sx * 0.55; } }
    if (o.collar) add(new THREE.TorusGeometry(hr * 0.78, 0.014, 8, 20), M(o.collar, 0.5, false), body, 0, hy - hr * 0.55, hz - hr * 0.55).rotation.x = 1.2;
    if (o.tongue) { const t = add(sph(hr * 0.17, 8, 6), pink, head, 0, -hr * 0.55, hr * 1.25); t.scale.set(0.8, 0.4, 1.4); }

    // 尾巴
    const tail = new THREE.Group(); tail.position.set(0, by + H * 0.12, -L * 0.5); body.add(tail);
    if (o.tail === "fluff") add(sph(o.tailR || 0.1, 14, 10), light, tail, 0, 0.03, -0.05);
    else if (o.tail === "long") { const t = add(new THREE.CylinderGeometry(o.legR * 0.55, o.legR * 0.4, o.tailL || 0.5, 10), fur, tail, 0, 0.14, -0.12); t.rotation.x = -0.95; if (o.tailTip) add(sph(o.legR * 0.5, 8, 6), M(o.tailTip, 0.8, false), tail, 0, 0.3, -0.27); }
    else if (o.tail === "brush") { const t = add(sph(0.1, 16, 12), fur, tail, 0, 0.0, -0.2); t.scale.set(0.95, 0.95, 2.8); add(sph(0.075, 12, 10), M(o.tailTip || 0xffffff, 0.85, false), tail, 0, 0, -0.43).scale.set(1, 1, 1.4); }
    else add(sph(0.05, 8, 6), light, tail, 0, 0.0, -0.03);
    if (o.spots) for (let k = 0; k < 14; k++) { const sp = add(sph(0.022, 6, 5), M(0xfff1d8, 0.8, false), body, rand(-W * 0.32, W * 0.32), by + H * 0.42 + rand(-0.03, 0.02), rand(-L * 0.35, L * 0.32)); sp.scale.set(1, 0.4, 1); }
    root.scale.setScalar(o.scale || 1);
    let ph = Math.random() * 6;
    function update(dt, speed, t, lie = 0, hop = 0) {
      ph += dt * speed * (o.stride || 5);
      const k = Math.min(0.8, speed * 0.55), a = Math.sin(ph) * k;
      legs[0].hip.rotation.x = a; legs[1].hip.rotation.x = a; legs[2].hip.rotation.x = -a; legs[3].hip.rotation.x = -a;
      const lift = (v) => Math.max(0, Math.cos(v)) * k * 1.1;
      legs[0].knee.rotation.x = lift(ph + 0.4); legs[1].knee.rotation.x = lift(ph + 0.4); legs[2].knee.rotation.x = lift(ph + Math.PI + 0.4); legs[3].knee.rotation.x = lift(ph + Math.PI + 0.4);
      if (lie > 0) { for (const l of legs) { l.hip.rotation.x = lerp(l.hip.rotation.x, 1.4, lie); l.knee.rotation.x = lerp(l.knee.rotation.x, -1.5, lie); } body.position.y = -lh * 0.72 * lie; head.rotation.x = 0.32 * lie; }
      else { body.position.y = hop ? Math.abs(Math.sin(ph * 1.3)) * hop * Math.min(1, speed) : Math.abs(Math.sin(ph)) * 0.014 * speed; head.rotation.x = Math.sin(t * 0.7 + ph) * 0.06 + (speed > 0.2 ? Math.sin(ph * 2) * 0.05 : 0); }
      tail.rotation.y = Math.sin(t * (o.wag || 2) + ph) * (o.wagAmp || 0.25); tail.rotation.x = o.tailUp || 0;
    }
    return { root, update };
  }

  const KINDS = {
    rabbit: { body: [0.42, 0.28, 0.25], legH: 0.1, legR: 0.03, headR: 0.1, ear: "long", tail: "fluff", tailR: 0.07, col: 0xc9b49a, belly: 0xf3ece2, light: 0xf6f0e8, sock: 0xe9dfd0, haunch: 1.15, cheek: true, whisk: true, speed: 1.2, hop: 0.1, stride: 8, flee: 4.2, wag: 0, scale: 1.1 },
    deer: { body: [0.98, 0.42, 0.3], legH: 0.66, legR: 0.042, headR: 0.15, ear: "deer", antlers: true, tail: "short", col: 0xa87a4c, belly: 0xefe0c6, light: 0xefe0c6, sock: 0x6a4a30, dark: 0x1e1610, neck: 0.8, speed: 0.8, stride: 3.5, flee: 3.6, spots: true, scale: 1.05 },
    fox: { body: [0.64, 0.28, 0.2], legH: 0.24, legR: 0.04, headR: 0.12, ear: "point", tail: "brush", tailTip: 0xffffff, col: 0xd8742c, belly: 0xf6e8d8, light: 0xfaf3ea, sock: 0x2a1a12, dark: 0x1a100a, earIn: 0x2a1a12, chest: 0xfaf3ea, neck: 0.4, whisk: true, speed: 1.1, stride: 5.5, flee: 4.4 },
    dog: { body: [0.64, 0.3, 0.26], legH: 0.3, legR: 0.05, headR: 0.14, ear: "round", earCol: 0x6a4326, tail: "long", tailL: 0.4, col: 0xc89a5c, belly: 0xf0dcc0, light: 0xf0dcc0, sock: 0xf0dcc0, dark: 0x2a1e14, collar: 0xd8352a, tongue: true, neck: 0.45, speed: 1.0, stride: 5, wag: 7, wagAmp: 0.5, tailUp: -0.2 },
    cat: { body: [0.46, 0.2, 0.17], legH: 0.18, legR: 0.03, headR: 0.095, ear: "point", earIn: 0xf2a6b4, tail: "long", tailL: 0.5, col: 0x8f8f98, belly: 0xe8e8ee, light: 0xe8e8ee, sock: 0xe8e8ee, dark: 0x3a3a44, stripe: true, whisk: true, collar: 0x2f9bd0, neck: 0.4, speed: 0.8, stride: 6, wag: 1.2, wagAmp: 0.35, tailUp: -0.4 },
  };

  /* ---------- 飛鳥 ---------- */
  function makeBird(THREE, mat) {
    const g = new THREE.Group();
    const wing = (s) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.14, 0, 0, -0.14, s * 0.62, 0.03, -0.04, 0, 0, 0.14, s * 0.62, 0.03, -0.04, s * 0.5, 0.0, 0.1], 3));
      const w = new THREE.Group(); w.add(new THREE.Mesh(geo, mat)); return w;
    };
    const L = wing(-1), R = wing(1); g.add(L, R);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat); body.scale.set(0.8, 0.7, 2.2); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat); head.position.set(0, 0.01, 0.17); g.add(head);
    return { g, L, R };
  }

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, obstacles, HOUSE, ENTRY, DECK_HD, pos, camera, STAIR } = ctx;
    const root = new THREE.Group(); scene.add(root);
    Z = { root, hooks, wild: [], pets: [], birds: [], hook: null, H: HOUSE, E: ENTRY };

    /* --- 通行判斷：走獸只在戶外花園；不能進 David 的家與美術館；避開家具 / 樹 / 長椅 / 路燈 --- */
    const blockedBy = (x, z, pad) => {
      for (const o of obstacles) if ((o.lv === undefined || o.lv === 0) && x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad) return true;
      return false;
    };
    const inHouse = (x, z, pad = 0) => x > HOUSE.x0 - pad && x < HOUSE.x1 + pad && z > HOUSE.z0 - pad && z < HOUSE.z1 + pad;
    const GX0 = 1.6, GX1 = ENTRY - 1.5, GZ0 = -(DECK_HD - 1.2), GZ1 = DECK_HD - 1.2;
    const wildOK = (x, z) => x > GX0 && x < GX1 && z > GZ0 && z < GZ1 && !inHouse(x, z, 1.0) && !blockedBy(x, z, 0.45);
    const inStairs = (x, z) => x > STAIR.x0 - 0.6 && x < STAIR.x1 + 0.6 && z > STAIR.z0 - 0.4 && z < STAIR.z1 + 0.4;
    const petOK = (x, z) => x > HOUSE.x0 + 0.5 && x < HOUSE.x1 - 0.5 && z > HOUSE.z0 + 0.5 && z < HOUSE.z1 - 0.45 && !inStairs(x, z) && !blockedBy(x, z, 0.3);

    const spawn = (kind, ok, list, sx, sz) => {
      const cfg = KINDS[kind], q = quad(THREE, cfg); root.add(q.root);
      let x = sx, z = sz, n = 0; while (!ok(x, z) && n++ < 400) { if (list === Z.pets) { x = rand(HOUSE.x0 + 1, HOUSE.x1 - 1); z = rand(HOUSE.z0 + 1, HOUSE.z1 - 0.8); } else { x = rand(GX0, GX1); z = rand(GZ0, GZ1); } }
      const a = { kind, cfg, q, x, z, f: rand(0, 6.28), tx: x, tz: z, wait: rand(0.5, 4), sp: 0, lie: 0, lying: false, ok, pet: list === Z.pets };
      list.push(a); return a;
    };
    // 走獸：3 隻兔子、2 隻小鹿、1 隻狐狸
    [["rabbit", 9.5, 2.0], ["rabbit", 17.5, -2.0], ["rabbit", 22.5, 1.5], ["deer", 13.5, -2.5], ["deer", 19.5, 3.0], ["fox", 11.5, 4.0]].forEach(([k, x, z]) => spawn(k, wildOK, Z.wild, x, z));
    // 家裡：一隻貓、一隻狗
    spawn("dog", petOK, Z.pets, 7.4, -2.6); spawn("cat", petOK, Z.pets, 4.6, -2.4);

    const step = (a, dt, t) => {
      const { cfg } = a;
      const dxp = pos.x - a.x, dzp = pos.z - a.z, dp = Math.hypot(dxp, dzp);
      let want = a.sp > 0.05 ? a.f : a.f, speed = 0, lieTarget = 0;
      const scared = !a.pet && dp < 3.2;
      if (scared) {                                                   // 看到 David 靠近：往反方向跑
        const ang = Math.atan2(-dxp, -dzp) + rand(-0.4, 0.4);
        a.tx = a.x + Math.sin(ang) * 3; a.tz = a.z + Math.cos(ang) * 3; a.wait = 0; a.lying = false;
      }
      if (a.pet && dp < 1.6 && a.lying) a.lying = false;
      if (a.lying) { lieTarget = 1; a.wait -= dt; if (a.wait <= 0) { a.lying = false; a.wait = rand(0.5, 2); } }
      else if (a.wait > 0) { a.wait -= dt; }
      else {
        const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
        if (d < 0.2) {
          a.wait = rand(1.5, 5);
          if (a.pet && Math.random() < 0.4) { a.lying = true; a.wait = rand(6, 14); }
          let k = 0, nx, nz; do { nx = a.x + rand(-4, 4); nz = a.z + rand(-3, 3); k++; } while (!a.ok(nx, nz) && k < 30); a.tx = k < 30 ? nx : a.x; a.tz = k < 30 ? nz : a.z;
        } else {
          speed = cfg.speed * (scared ? cfg.flee / cfg.speed * 0.6 : 1);
          const nx = a.x + (dx / d) * speed * dt, nz = a.z + (dz / d) * speed * dt;
          if (a.ok(nx, nz)) { a.x = nx; a.z = nz; want = Math.atan2(dx, dz); }
          else { speed = 0; a.tx = a.x; a.tz = a.z; a.wait = rand(0.3, 1.2); }         // 撞到東西 / 要進房子了：停下、換方向
        }
      }
      a.f += angDiff(a.f, want) * Math.min(1, dt * 7); a.sp = lerp(a.sp, speed, Math.min(1, dt * 6)); a.lie = lerp(a.lie, lieTarget, Math.min(1, dt * 3));
      a.q.root.position.set(a.x, 0, a.z); a.q.root.rotation.y = a.f; a.q.update(dt, a.sp, t, a.lie, cfg.hop || 0);
    };

    // 飛鳥：幾群鳥繞著玩家附近的上空盤旋
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x20242e, side: THREE.DoubleSide });
    const center = { x: pos.x, z: pos.z };
    for (let i = 0; i < 16; i++) {
      const b = makeBird(THREE, birdMat); root.add(b.g);
      const near = i < 6;
      Z.birds.push({ ...b, rad: near ? rand(10, 26) : rand(30, 90), h: near ? rand(5, 11) : rand(16, 38), w: rand(0.12, 0.3) * (Math.random() < 0.5 ? 1 : -1), ph: rand(0, 6.28), fl: rand(6, 10), bob: rand(0.5, 2) });
    }
    Z.center = center;

    Z.hook = (dt, t) => {
      for (const a of Z.wild) step(a, dt, t);
      for (const a of Z.pets) step(a, dt, t);
      // 鳥：白天出現、夜晚休息
      const day = ctx.getSunHeight ? ctx.getSunHeight() : 1, show = day > -0.02;
      center.x = lerp(center.x, pos.x, Math.min(1, dt * 0.4)); center.z = lerp(center.z, pos.z, Math.min(1, dt * 0.4));
      for (const b of Z.birds) {
        b.g.visible = show; if (!show) continue;
        const a = b.ph + t * b.w, x = center.x + Math.cos(a) * b.rad, z = center.z + Math.sin(a) * b.rad * 0.7;
        b.g.position.set(x, b.h + Math.sin(t * b.bob + b.ph) * 0.8, z);
        const vx = -Math.sin(a) * Math.sign(b.w), vz = Math.cos(a) * 0.7 * Math.sign(b.w);
        b.g.rotation.y = Math.atan2(vx, vz); b.g.rotation.z = -0.25 * Math.sign(b.w);
        const fl = Math.sin(t * b.fl + b.ph) * 0.55;
        b.L.rotation.z = -fl; b.R.rotation.z = fl;
      }
    };
    hooks.push(Z.hook);
  }

  function unmount() {
    if (!Z) return;
    const i = Z.hooks.indexOf(Z.hook); if (i >= 0) Z.hooks.splice(i, 1);
    Z.root.parent && Z.root.parent.remove(Z.root);
    Z.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    Z = null;
  }
})();
