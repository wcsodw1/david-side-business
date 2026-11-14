/* ============================================================
   動物：
   · 天上的飛鳥（白天繞著藝廊上空盤旋，晚上休息）
   · 花園裡的走獸（野兔、梅花鹿、赤狐）：會閒晃、看到人會躲；不能進房子（David 的家、美術館）
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

  /* ---------- 四足動物（寫實版）：每種動物各有真實的毛色花紋、身形比例與五官 ---------- */
  const PI2 = Math.PI * 2;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hexCss = (h) => "#" + h.toString(16).padStart(6, "0");
  const tint = (h, f) => { const r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255, m = (v) => clamp(Math.round(v * f), 0, 255); return (m(r) << 16) | (m(g) << 8) | m(b); };

  // 毛的凹凸（細短毛）
  let bumpT = null;
  const furBump = (THREE) => {
    if (bumpT) return bumpT;
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5200; i++) { const x = Math.random() * 256, y = Math.random() * 256, l = 3 + Math.random() * 6, a = Math.PI / 2 + (Math.random() - 0.5) * 0.7; g.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    bumpT = new THREE.CanvasTexture(c); bumpT.wrapS = bumpT.wrapT = THREE.RepeatWrapping; bumpT.repeat.set(2, 2); bumpT.anisotropy = 4; return bumpT;
  };

  // 身體毛色貼圖：u = 繞著身體一圈（背在 0.75、肚子在 0.25），v = 由尾到頭
  const coatCache = {};
  function coatTexture(THREE, o) {
    if (coatCache[o.kind]) return coatCache[o.kind];
    const W = 1536, H = 768, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const back = new THREE.Color(o.col), belly = new THREE.Color(o.belly || o.col), dk = new THREE.Color(o.dorsal || o.col).multiplyScalar(0.72);
    const colAt = (u, v) => { let d = Math.abs(u - 0.75); if (d > 0.5) d = 1 - d; const k = d / 0.5, kk = sstep(0.38, 0.9, k), c0 = back.clone().lerp(belly, kk); if (o.dorsal) c0.lerp(dk, 0.7 * (1 - sstep(0, 0.28, k))); return c0; };
    for (let x = 0; x < W; x++) { const c0 = colAt(x / W, 0); g.fillStyle = `rgb(${Math.round(c0.r * 255)},${Math.round(c0.g * 255)},${Math.round(c0.b * 255)})`; g.fillRect(x, 0, 1, H); }
    // 毛色深淺不均的雲斑
    for (let i = 0; i < 160; i++) { const x = Math.random() * W, y = Math.random() * H, r = 20 + Math.random() * 70, q = g.createRadialGradient(x, y, 0, x, y, r), dark = Math.random() < 0.5; q.addColorStop(0, dark ? "rgba(30,20,10,.10)" : "rgba(255,240,220,.10)"); q.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = q; g.fillRect(x - r, y - r, r * 2, r * 2); }
    // 一根一根的毛（順著身體長度）
    for (let i = 0; i < 90000; i++) { const x = Math.random() * W, y = Math.random() * H, l = 3 + Math.random() * 6; g.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,245,230" : "30,20,10"},${0.02 + Math.random() * 0.05})`; g.lineWidth = 0.55; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y + l); g.stroke(); }
    const sideU = (s) => (s > 0 ? 0.5 : 0.0), band = (fn) => { for (const s of [1, -1]) fn(s); };
    if (o.kind === "deer") {                                        // 梅花鹿 / 黃鹿：背和身側的白斑
      for (let i = 0; i < 190; i++) { const side = Math.random() < 0.5 ? 0.5 : 0.0, u = side + (Math.random() - 0.5) * 0.4 + (Math.random() < 0.5 ? 0.0 : 0), v = 0.2 + Math.random() * 0.6; const x = ((u % 1) + 1) % 1 * W, y = v * H, r = 3 + Math.random() * 5; g.fillStyle = `rgba(255,245,225,${0.6 + Math.random() * 0.35})`; g.beginPath(); g.ellipse(x, y, r * 0.8, r, 0, 0, 7); g.fill(); }
    } else if (o.kind === "cat") {                                  // 虎斑貓：一圈一圈的深色條紋
      for (let i = 0; i < 22; i++) { const v = (i + 0.3 + Math.random() * 0.4) / 22; for (const s of [0, 0.5]) { g.strokeStyle = `rgba(38,32,28,${0.28 + Math.random() * 0.25})`; g.lineWidth = 3 + Math.random() * 5; g.lineCap = "round"; g.beginPath(); g.moveTo(((s + 0.74) % 1) * W, v * H + Math.random() * 6); g.bezierCurveTo(((s + 0.6) % 1) * W, v * H + 10 + Math.random() * 14, ((s + 0.42) % 1) * W, v * H - 12 + Math.random() * 14, ((s + 0.24 + Math.random() * 0.06) % 1) * W, v * H + Math.random() * 12 - 4); g.stroke(); } }
      g.strokeStyle = "rgba(25,22,20,.45)"; g.lineWidth = 9; g.beginPath(); g.moveTo(0.75 * W, 0); g.lineTo(0.75 * W, H); g.stroke();
    } else if (o.kind === "fox") {                                  // 赤狐：胸前、下巴白色
      const q = g.createLinearGradient(0, H * 0.7, 0, H); q.addColorStop(0, "rgba(255,246,236,0)"); q.addColorStop(1, "rgba(255,246,236,.95)"); g.fillStyle = q; g.fillRect(0.0 * W, H * 0.62, W, H * 0.38);
    } else if (o.kind === "rabbit") {                               // 野兔：背上黑色細毛尖（agouti）
      for (let i = 0; i < 16000; i++) { const u = 0.75 + (Math.random() - 0.5) * 0.7, x = ((u % 1) + 1) % 1 * W, y = Math.random() * H; g.fillStyle = `rgba(40,28,18,${0.06 + Math.random() * 0.12})`; g.fillRect(x, y, 0.9, 2 + Math.random() * 3); }
    } else if (o.kind === "dog") {                                  // 黃金獵犬：背上深一點、胸腹淡金色
      const q = g.createLinearGradient(0, 0, W, 0); q.addColorStop(0.75 - 0.1, "rgba(120,70,20,0)"); q.addColorStop(0.75, "rgba(120,70,20,.2)"); q.addColorStop(0.75 + 0.1, "rgba(120,70,20,0)"); g.fillStyle = q; g.fillRect(0, 0, W, H);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
    return (coatCache[o.kind] = t);
  }

  // 身體：流線的橢球，胸腔深、腰收、臀圓，肚子線條自然（單一曲面，不是一堆圓球拼起來）
  function bodyGeometry(THREE, L, H, W, o) {
    const g = new THREE.SphereGeometry(1, 56, 40); g.rotateX(Math.PI / 2);   // 兩端（頭、尾）在 ±z
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);                      // 單位球，z = -1 尾 .. +1 頭
      const chest = sstep(-0.1, 0.55, z) * (1 - sstep(0.7, 1, z)), waist = Math.exp(-Math.pow((z + 0.15) / 0.3, 2)), rump = Math.exp(-Math.pow((z + 0.62) / 0.3, 2));
      let sy = 1 + (o.chestDeep || 0.14) * chest - (o.waist || 0.1) * waist, sx = 1 + 0.06 * chest - 0.05 * waist + 0.05 * rump;
      if (y < 0) sy *= 1 - 0.1 * waist;                                      // 腰腹上收
      x *= sx * W * 0.5; y *= sy * H * 0.5; z *= L * 0.5;
      if (o.hump) y += o.hump * H * Math.exp(-Math.pow((z / (L * 0.5) - 0.3) / 0.25, 2)) * Math.max(0, y > 0 ? 1 : 0);    // 肩隆
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }

  function quad(THREE, o) {
    const bump = furBump(THREE), coat = coatTexture(THREE, o);
    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();   // 單色材質轉成線性色，才會和貼圖畫出來的毛色一致
    const fm = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: lin(c), roughness: r, envMapIntensity: 0.3, bumpMap: bump, bumpScale: 0.3 });
    const plain = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: lin(c), roughness: r, metalness: m, envMapIntensity: 0.4 });
    const bodyMat = new THREE.MeshStandardMaterial({ map: coat, roughness: 0.95, envMapIntensity: 0.3, bumpMap: bump, bumpScale: 0.35 });
    const fur = fm(o.col), light = fm(o.light || o.belly || o.col), dark = plain(o.dark || 0x2a2018, 0.7), sock = fm(o.sock || o.col), pink = plain(0xe8a0a8, 0.7), white = plain(0xffffff, 0.3);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const sph = (r, ws = 24, hs = 16) => new THREE.SphereGeometry(r, ws, hs);
    const [L, H, W] = o.body, lh = o.legH, by = lh + H * 0.5, up = new THREE.Vector3(0, 1, 0);
    const limb = (a, b, r0, r1, mat, parent) => { const d = b.clone().sub(a), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 14), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(up, d.normalize()); m.castShadow = true; parent.add(m); return m; };

    add(bodyGeometry(THREE, L, H, W, o), bodyMat, body, 0, by, 0);
    if (o.chest) add(sph(0.5, 20, 14), plain(o.chest, 0.95), body, 0, by - H * 0.12, L * 0.36).scale.set(W * 0.5, H * 0.62, L * 0.2);   // 胸前白毛
    // 臀部肌肉（後腿根部的隆起）
    for (const sx of [-1, 1]) add(sph(0.5, 18, 14), fm(o.dorsal || o.col), body, sx * W * 0.27, by - H * 0.06, -L * 0.3).scale.set(W * 0.3, H * (o.haunch || 0.62), L * 0.25);

    // 腿：大腿（粗）→ 小腿（細，有關節）→ 蹄 / 腳掌
    const legs = [], hipY = lh + H * 0.34;
    for (const [sx, sz] of [[-1, 1], [1, -1], [1, 1], [-1, -1]]) {
      const front = sz > 0, hip = new THREE.Group(); hip.position.set(sx * W * 0.3, hipY, sz * L * 0.3); body.add(hip);
      const u = hipY * (front ? 0.5 : 0.46), l2 = hipY - u;
      limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -u, front ? 0 : -0.02), o.legR * (front ? 1.25 : 1.7), o.legR * 0.8, fur, hip);
      const knee = new THREE.Group(); knee.position.set(0, -u, front ? 0 : -0.02); hip.add(knee);
      add(sph(o.legR * 0.9, 12, 10), fur, knee, 0, 0, 0);
      limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -l2 + 0.025, front ? 0 : 0.035), o.legR * 0.7, o.legR * 0.5, sock, knee);
      if (o.hoof) add(new THREE.CylinderGeometry(o.legR * 0.55, o.legR * 0.7, 0.045, 10), dark, knee, 0, -l2 + 0.012, front ? 0.01 : 0.04);
      else add(sph(o.legR * 1.0, 12, 10), sock, knee, 0, -l2 + 0.025, 0.02).scale.set(1, 0.6, 1.5);
      legs.push({ hip, knee, front });
    }

    // 頭 + 脖子
    const head = new THREE.Group(), hr = o.headR, hy = by + H * (o.neck || 0.35), hz = L * 0.5 + (o.neck > 0.6 ? 0.2 : 0.04); head.position.set(0, hy, hz); body.add(head);
    limb(new THREE.Vector3(0, by + H * 0.1, L * 0.3), new THREE.Vector3(0, hy - hr * 0.2, hz - hr * 0.3), hr * (o.neck > 0.6 ? 0.85 : 1.05), hr * (o.neck > 0.6 ? 0.55 : 0.8), fur, body);
    add(sph(hr, 32, 22), fur, head, 0, 0, hr * 0.1).scale.set(0.92, 0.9, 1.08);                                   // 頭骨
    const sn = o.snout || 1;
    const mz = add(sph(hr * 0.6, 24, 16), light, head, 0, -hr * 0.22, hr * 0.85); mz.scale.set(0.74 * (o.snW || 1), 0.62, 1.2 * sn);   // 口鼻（依物種拉長）
    add(sph(hr * 0.18, 14, 10), plain(0x1a1210, 0.4), head, 0, -hr * 0.05, hr * (1.35 + 0.35 * sn)).scale.set(1.1, 0.85, 0.9);   // 鼻頭（濕潤、有光澤）
    if (o.cheek) for (const sx of [-1, 1]) add(sph(hr * 0.45, 16, 12), light, head, sx * hr * 0.48, -hr * 0.3, hr * 0.7);
    const iris = plain(o.eye || 0x2a1a10, 0.15), pupil = plain(0x050403, 0.2);
    for (const sx of [-1, 1]) {   // 眼睛：虹膜 + 瞳孔 + 反光（深色、有濕潤感）
      const ey = add(sph(hr * 0.2, 16, 12), iris, head, sx * hr * 0.46, hr * 0.2, hr * 0.78); ey.scale.set(0.8, o.slit ? 1.1 : 1, 0.6);
      const pu = add(sph(hr * (o.slit ? 0.07 : 0.11), 10, 8), pupil, head, sx * hr * 0.5, hr * 0.2, hr * 0.84); pu.scale.set(o.slit ? 0.45 : 0.8, o.slit ? 1.9 : 1, 0.5);
      add(sph(hr * 0.045, 8, 6), white, head, sx * hr * 0.53, hr * 0.27, hr * 0.88);
      if (o.ear === "long") { const e = add(sph(hr * 0.3, 14, 10), fur, head, sx * hr * 0.38, hr * 1.5, -hr * 0.1); e.scale.set(0.42, 3.3, 0.7); e.rotation.z = -sx * 0.18; const ei = add(sph(hr * 0.2, 10, 8), pink, head, sx * hr * 0.38, hr * 1.5, hr * 0.02); ei.scale.set(0.3, 2.7, 0.4); ei.rotation.z = -sx * 0.18; }
      else if (o.ear === "point") { const e = add(new THREE.ConeGeometry(hr * 0.5, hr * 1.25, 18), o.earBack ? plain(o.earBack, 0.9) : fur, head, sx * hr * 0.55, hr * 1.0, -hr * 0.15); e.rotation.z = -sx * 0.25; add(new THREE.ConeGeometry(hr * 0.32, hr * 0.8, 14), o.earIn ? plain(o.earIn, 0.8) : dark, head, sx * hr * 0.55, hr * 0.96, -hr * 0.03).rotation.z = -sx * 0.25; }
      else if (o.ear === "deer") { const e = add(sph(hr * 0.5, 16, 12), fur, head, sx * hr * 0.9, hr * 0.7, -hr * 0.15); e.scale.set(0.35, 1.35, 0.75); e.rotation.z = -sx * 0.9; add(sph(hr * 0.34, 12, 10), pink, head, sx * hr * 0.9, hr * 0.68, -hr * 0.07).scale.set(0.25, 1.1, 0.45); }
      else { const e = add(sph(hr * 0.55, 16, 12), fm(o.earCol || o.dark || 0x4a3626), head, sx * hr * 0.8, hr * 0.42, -hr * 0.05); e.scale.set(0.36, 1.25, 0.8); e.rotation.z = -sx * 0.5; }   // 垂耳
    }
    if (o.whisk) for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const w = add(new THREE.CylinderGeometry(0.0022, 0.0012, hr * 1.7, 4), white, head, sx * hr * 0.7, -hr * 0.2 + k * hr * 0.08, hr * 1.2); w.rotation.z = Math.PI / 2 + sx * (0.08 + k * 0.1); w.rotation.y = sx * -0.25; }
    if (o.antlers) for (const sx of [-1, 1]) { const A = plain(0x7a5a38, 0.8); const a = add(new THREE.CylinderGeometry(0.012, 0.022, hr * 2.8, 8), A, head, sx * hr * 0.5, hr * 1.95, -hr * 0.12); a.rotation.z = -sx * 0.28; for (const [h2, sd] of [[0.9, 0.7], [1.5, 0.55], [2.1, 0.4]]) { const t = add(new THREE.CylinderGeometry(0.008, 0.014, hr * 1.2 * sd, 6), A, head, sx * (hr * 0.5 + h2 * hr * 0.2), hr * (1.2 + h2 * 0.5), -hr * 0.12 + (h2 > 1.4 ? hr * 0.25 : 0)); t.rotation.z = sx * 0.55; } }
    if (o.collar) add(new THREE.TorusGeometry(hr * 0.78, 0.014, 8, 20), plain(o.collar, 0.5), body, 0, hy - hr * 0.55, hz - hr * 0.55).rotation.x = 1.2;
    if (o.tongue) { const t = add(sph(hr * 0.17, 10, 8), pink, head, 0, -hr * 0.58, hr * 1.25); t.scale.set(0.8, 0.4, 1.4); }

    // 尾巴
    const tail = new THREE.Group(); tail.position.set(0, by + H * 0.14, -L * 0.5); body.add(tail);
    if (o.tail === "fluff") add(sph(o.tailR || 0.1, 16, 12), plain(0xf4eee4, 0.95), tail, 0, 0.03, -0.05);
    else if (o.tail === "long") { const t = add(new THREE.CylinderGeometry(o.legR * 0.7, o.legR * 0.42, o.tailL || 0.5, 12), fur, tail, 0, 0.14, -0.12); t.rotation.x = -0.95; if (o.tailTip) add(sph(o.legR * 0.5, 8, 6), plain(o.tailTip, 0.8), tail, 0, 0.3, -0.27); }
    else if (o.tail === "brush") { const t = add(sph(0.08, 20, 14), fur, tail, 0, 0.0, -0.18); t.scale.set(0.85, 0.85, 3.1); add(sph(0.06, 14, 10), plain(o.tailTip || 0xffffff, 0.9), tail, 0, 0, -0.42).scale.set(0.9, 0.9, 1.7); }
    else add(sph(0.05, 10, 8), light, tail, 0, 0.0, -0.03);
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
    rabbit: { body: [0.44, 0.26, 0.24], legH: 0.1, legR: 0.03, headR: 0.1, ear: "long", tail: "fluff", tailR: 0.06, col: 0x8d7556, belly: 0xefe7da, light: 0xd9cbb5, sock: 0xb09a7c, eye: 0x3a2412, haunch: 1.0, snout: 0.8, cheek: true, whisk: true, speed: 1.2, hop: 0.1, stride: 8, flee: 4.2, wag: 0, scale: 1.1, chestDeep: 0.05, waist: 0.02 },
    deer: { body: [1.0, 0.4, 0.28], legH: 0.7, legR: 0.04, headR: 0.14, ear: "deer", antlers: true, tail: "short", col: 0x9a6a3e, belly: 0xefe2cb, dorsal: 0x8c5a30, light: 0xcdb391, sock: 0x6e4a2c, dark: 0x1a1410, hoof: true, eye: 0x1a110a, neck: 0.85, snout: 1.25, snW: 0.85, speed: 0.8, stride: 3.5, flee: 3.6, scale: 1.05, chestDeep: 0.18, waist: 0.14 },
    fox: { body: [0.66, 0.26, 0.2], legH: 0.26, legR: 0.036, headR: 0.115, ear: "point", earBack: 0x1c120c, tail: "brush", tailTip: 0xfff6ee, col: 0xc4571c, belly: 0xf3e6d6, light: 0xf5ebe0, sock: 0x20140e, dark: 0x1a100a, earIn: 0xe8d6c4, chest: 0xf6eee4, eye: 0xb88a2a, slit: false, neck: 0.4, snout: 1.4, snW: 0.8, whisk: true, speed: 1.1, stride: 5.5, flee: 4.4, chestDeep: 0.12, waist: 0.14 },
    dog: { body: [0.66, 0.3, 0.25], legH: 0.32, legR: 0.05, headR: 0.14, ear: "round", earCol: 0xa8762f, tail: "long", tailL: 0.42, col: 0xd2a05a, belly: 0xf1ddb8, light: 0xe8c890, sock: 0xe8c890, dark: 0x2a1e14, collar: 0xc7352b, tongue: true, eye: 0x3a2412, neck: 0.45, snout: 1.15, speed: 1.0, stride: 5, wag: 7, wagAmp: 0.5, tailUp: -0.2, chestDeep: 0.16, waist: 0.16 },
    cat: { body: [0.48, 0.19, 0.16], legH: 0.18, legR: 0.03, headR: 0.095, ear: "point", earIn: 0xe9a4ac, tail: "long", tailL: 0.5, col: 0x8b7d6a, belly: 0xe6dccb, dorsal: 0x6c5f4f, light: 0xe6dccb, sock: 0xddd2bf, dark: 0x2a2622, eye: 0x9fb040, slit: true, whisk: true, collar: 0x2f9bd0, neck: 0.4, snout: 0.7, speed: 0.8, stride: 6, wag: 1.2, wagAmp: 0.35, tailUp: -0.4, chestDeep: 0.1, waist: 0.12 },
  };
  Object.keys(KINDS).forEach((k) => (KINDS[k].kind = k));

  /* ---------- 飛鳥：海鷗（白身、灰色翅膀、黑色翼尖、黃嘴、分岔尾），拍翅時翅膀會彎折 ---------- */
  function makeBird(THREE, mat) {
    const g = new THREE.Group(), wingM = new THREE.MeshStandardMaterial({ color: 0xaeb4bc, roughness: 0.8, side: THREE.DoubleSide }), tipM = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8, side: THREE.DoubleSide }), whiteM = new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.75, side: THREE.DoubleSide }), beakM = new THREE.MeshStandardMaterial({ color: 0xe6a823, roughness: 0.5 });
    const tri = (pts, m) => { const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); geo.computeVertexNormals(); const q = new THREE.Mesh(geo, m); return q; };
    const wing = (s) => {   // 內翼（灰） + 外翼（灰→黑色翼尖），外翼繞「腕關節」彎折
      const w = new THREE.Group(), inner = tri([0, 0, 0.2, 0, 0, -0.16, s * 0.42, 0.015, -0.1, 0, 0, 0.2, s * 0.42, 0.015, -0.1, s * 0.4, 0.01, 0.12], wingM); w.add(inner);
      const outer = new THREE.Group(); outer.position.set(s * 0.4, 0.01, 0); w.add(outer);
      outer.add(tri([0, 0, 0.12, 0, 0, -0.1, s * 0.46, 0.0, -0.12, 0, 0, 0.12, s * 0.46, 0.0, -0.12, s * 0.4, -0.005, 0.04], wingM));
      outer.add(tri([s * 0.3, 0, 0.0, s * 0.46, 0, -0.12, s * 0.5, 0, -0.04, s * 0.3, 0, 0.0, s * 0.5, 0, -0.04, s * 0.44, 0, 0.04], tipM));
      w.userData.outer = outer; return w;
    };
    const L = wing(-1), R = wing(1); g.add(L, R);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), whiteM); body.scale.set(0.8, 0.72, 2.3); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), whiteM); head.position.set(0, 0.015, 0.2); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.075, 8), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.008, 0.27); g.add(beak);
    g.add(tri([-0.035, 0, -0.16, 0.035, 0, -0.16, 0, 0, -0.3, -0.035, 0, -0.16, 0, 0, -0.3, 0.04, 0, -0.26], whiteM));    // 尾羽
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
        b.L.rotation.z = -fl; b.R.rotation.z = fl; if (b.L.userData.outer) { b.L.userData.outer.rotation.z = -fl * 0.9 - 0.12; b.R.userData.outer.rotation.z = fl * 0.9 + 0.12; }   // 外翼（翼尖）跟著彎折
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
