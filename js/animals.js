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

  /* ---------- 四足動物模型（面朝 +z） ---------- */
  function quad(THREE, o) {
    const M = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, envMapIntensity: 0.4 });
    const fur = M(o.col), belly = M(o.belly || o.col), dark = M(o.dark || 0x2a2018, 0.7), light = M(o.light || o.col);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const [L, H, W] = o.body, lh = o.legH, by = lh + H * 0.5;
    const torso = add(new THREE.SphereGeometry(0.5, 16, 12), fur, body, 0, by, 0); torso.scale.set(W, H, L);
    if (o.belly) { const b = add(new THREE.SphereGeometry(0.5, 14, 10), belly, body, 0, by - H * 0.18, 0.02); b.scale.set(W * 0.9, H * 0.7, L * 0.92); }
    const legs = [];
    for (const [sx, sz] of [[-1, 1], [1, -1], [1, 1], [-1, -1]]) {   // 對角線一組
      const hip = new THREE.Group(); hip.position.set(sx * W * 0.32, lh + H * 0.12, sz * L * 0.3); body.add(hip);
      add(new THREE.CylinderGeometry(o.legR, o.legR * 0.75, lh + H * 0.12, 8), fur, hip, 0, -(lh + H * 0.12) / 2, 0);
      add(new THREE.SphereGeometry(o.legR * 1.1, 8, 6), dark, hip, 0, -(lh + H * 0.12) + 0.01, 0.01).scale.set(1, 0.6, 1.4);
      legs.push(hip);
    }
    const head = new THREE.Group(); head.position.set(0, by + H * (o.neck || 0.35), L * 0.5); body.add(head);
    const hr = o.headR;
    add(new THREE.SphereGeometry(hr, 14, 10), fur, head, 0, 0, hr * 0.2).scale.set(1, 0.95, 1.1);
    add(new THREE.SphereGeometry(hr * 0.5, 10, 8), light, head, 0, -hr * 0.2, hr * 1.0).scale.set(0.9, 0.75, 1.1);   // 口鼻
    add(new THREE.SphereGeometry(hr * 0.16, 8, 6), dark, head, 0, -hr * 0.1, hr * 1.5);                              // 鼻
    for (const sx of [-1, 1]) {
      add(new THREE.SphereGeometry(hr * 0.13, 8, 6), dark, head, sx * hr * 0.42, hr * 0.2, hr * 0.82);                  // 眼
      if (o.ear === "long") { const e = add(new THREE.CylinderGeometry(hr * 0.16, hr * 0.2, hr * 2.2, 8), fur, head, sx * hr * 0.4, hr * 1.5, -hr * 0.1); e.rotation.z = -sx * 0.18; }
      else if (o.ear === "point") { const e = add(new THREE.ConeGeometry(hr * 0.42, hr * 0.95, 8), fur, head, sx * hr * 0.55, hr * 0.95, 0); e.rotation.z = -sx * 0.2; add(new THREE.ConeGeometry(hr * 0.24, hr * 0.6, 8), dark, head, sx * hr * 0.55, hr * 0.92, hr * 0.06).rotation.z = -sx * 0.2; }
      else if (o.ear === "deer") { const e = add(new THREE.SphereGeometry(hr * 0.42, 8, 6), fur, head, sx * hr * 0.8, hr * 0.7, -hr * 0.1); e.scale.set(0.5, 1.1, 0.8); e.rotation.z = -sx * 0.7; }
      else { const e = add(new THREE.SphereGeometry(hr * 0.4, 8, 6), fur, head, sx * hr * 0.72, hr * 0.7, 0); e.scale.set(0.6, 1, 0.8); }
    }
    if (o.antlers) for (const sx of [-1, 1]) { const a = add(new THREE.CylinderGeometry(0.012, 0.018, hr * 2.4, 6), M(0x7a5a3c), head, sx * hr * 0.45, hr * 1.7, -hr * 0.05); a.rotation.z = -sx * 0.35; const b2 = add(new THREE.CylinderGeometry(0.01, 0.014, hr * 1.1, 6), M(0x7a5a3c), head, sx * hr * 0.75, hr * 2.0, -hr * 0.05); b2.rotation.z = sx * 0.5; }
    const tail = new THREE.Group(); tail.position.set(0, by + H * 0.1, -L * 0.48); body.add(tail);
    if (o.tail === "fluff") add(new THREE.SphereGeometry(o.tailR || 0.1, 10, 8), light, tail, 0, 0.03, -0.04);
    else if (o.tail === "long") { const t = add(new THREE.CylinderGeometry(o.legR * 0.7, o.legR * 0.5, o.tailL || 0.5, 8), fur, tail, 0, 0.12, -0.12); t.rotation.x = -0.9; }
    else if (o.tail === "brush") { const t = add(new THREE.SphereGeometry(0.1, 10, 8), fur, tail, 0, 0.0, -0.18); t.scale.set(0.9, 0.9, 2.6); add(new THREE.SphereGeometry(0.06, 8, 6), light, tail, 0, 0, -0.34); }
    else add(new THREE.SphereGeometry(0.05, 8, 6), light, tail, 0, 0.0, -0.03);
    if (o.spots) for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.03, 6, 5), M(0xfff1d8), body, rand(-W * 0.3, W * 0.3), by + H * 0.4, rand(-L * 0.3, L * 0.3));
    root.scale.setScalar(o.scale || 1);
    let ph = Math.random() * 6;
    function update(dt, speed, t, lie = 0, hop = 0) {
      ph += dt * speed * (o.stride || 5);
      const a = Math.sin(ph) * Math.min(0.8, speed * 0.55);
      legs[0].rotation.x = a; legs[1].rotation.x = a; legs[2].rotation.x = -a; legs[3].rotation.x = -a;
      if (lie > 0) { for (const l of legs) l.rotation.x = lerp(l.rotation.x, 1.35, lie); body.position.y = -lh * 0.7 * lie; head.rotation.x = 0.35 * lie; }
      else { body.position.y = hop ? Math.abs(Math.sin(ph * 1.3)) * hop * Math.min(1, speed) : Math.abs(Math.sin(ph)) * 0.012 * speed; head.rotation.x = Math.sin(t * 0.7 + ph) * 0.06; }
      tail.rotation.y = Math.sin(t * (o.wag || 2) + ph) * (o.wagAmp || 0.25); tail.rotation.x = o.tailUp || 0;
    }
    return { root, update };
  }

  const KINDS = {
    rabbit: { body: [0.42, 0.26, 0.24], legH: 0.1, legR: 0.035, headR: 0.1, ear: "long", tail: "fluff", tailR: 0.07, col: 0xcdbba5, belly: 0xf1e8dc, light: 0xf4eee6, speed: 1.2, hop: 0.1, stride: 8, flee: 4.2, wag: 0, scale: 1.0 },
    deer: { body: [0.95, 0.42, 0.3], legH: 0.62, legR: 0.045, headR: 0.15, ear: "deer", antlers: true, tail: "short", col: 0xa87a4c, belly: 0xe9d9bf, light: 0xe9d9bf, neck: 0.75, speed: 0.8, stride: 3.5, flee: 3.6, spots: true },
    fox: { body: [0.62, 0.28, 0.2], legH: 0.24, legR: 0.04, headR: 0.12, ear: "point", tail: "brush", col: 0xd8742c, belly: 0xf6e8d8, light: 0xfaf3ea, dark: 0x2a1a12, neck: 0.4, speed: 1.1, stride: 5.5, flee: 4.4 },
    dog: { body: [0.62, 0.3, 0.26], legH: 0.3, legR: 0.05, headR: 0.14, ear: "round", tail: "long", tailL: 0.4, col: 0xc89a5c, belly: 0xf0dcc0, light: 0xf0dcc0, dark: 0x3a2a1e, neck: 0.45, speed: 1.0, stride: 5, wag: 7, wagAmp: 0.5, tailUp: -0.2 },
    cat: { body: [0.46, 0.2, 0.17], legH: 0.18, legR: 0.03, headR: 0.095, ear: "point", tail: "long", tailL: 0.5, col: 0x8f8f98, belly: 0xe8e8ee, light: 0xe8e8ee, dark: 0x3a3a44, neck: 0.4, speed: 0.8, stride: 6, wag: 1.2, wagAmp: 0.35, tailUp: -0.4 },
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
    const { THREE, scene, hooks, obstacles, HOUSE, ENTRY, DECK_HD, pos, camera } = ctx;
    const root = new THREE.Group(); scene.add(root);
    Z = { root, hooks, wild: [], pets: [], birds: [], hook: null, H: HOUSE, E: ENTRY };

    /* --- 通行判斷：走獸只在戶外花園；不能進 David 的家與美術館；避開家具 / 樹 / 長椅 / 路燈 --- */
    const blockedBy = (x, z, pad) => {
      for (const o of obstacles) if (x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad) return true;
      return false;
    };
    const inHouse = (x, z, pad = 0) => x > HOUSE.x0 - pad && x < HOUSE.x1 + pad && z > HOUSE.z0 - pad && z < HOUSE.z1 + pad;
    const GX0 = 1.6, GX1 = ENTRY - 1.5, GZ0 = -4.4, GZ1 = Math.min(DECK_HD - 1.2, 5.0);
    const wildOK = (x, z) => x > GX0 && x < GX1 && z > GZ0 && z < GZ1 && !inHouse(x, z, 1.0) && !blockedBy(x, z, 0.45);
    const petOK = (x, z) => x > HOUSE.x0 + 0.5 && x < HOUSE.x1 - 0.5 && z > HOUSE.z0 + 0.5 && z < HOUSE.z1 - 0.45 && !blockedBy(x, z, 0.3);

    const spawn = (kind, ok, list, sx, sz) => {
      const cfg = KINDS[kind], q = quad(THREE, cfg); root.add(q.root);
      let x = sx, z = sz, n = 0; while (!ok(x, z) && n++ < 200) { x = rand(GX0, GX1); z = rand(GZ0, GZ1); }
      const a = { kind, cfg, q, x, z, f: rand(0, 6.28), tx: x, tz: z, wait: rand(0.5, 4), sp: 0, lie: 0, lying: false, ok, pet: list === Z.pets };
      list.push(a); return a;
    };
    // 走獸：3 隻兔子、2 隻小鹿、1 隻狐狸
    [["rabbit", 9.5, 2.0], ["rabbit", 17.5, -2.0], ["rabbit", 22.5, 1.5], ["deer", 13.5, -2.5], ["deer", 19.5, 3.0], ["fox", 11.5, 4.0]].forEach(([k, x, z]) => spawn(k, wildOK, Z.wild, x, z));
    // 家裡：一隻貓、一隻狗
    spawn("dog", petOK, Z.pets, 5.0, -1.6); spawn("cat", petOK, Z.pets, 2.8, -0.8);

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
