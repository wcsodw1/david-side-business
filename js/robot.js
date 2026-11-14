/* ============================================================
   辦公室機器人：走進辦公室，站到機器人旁邊按 Enter（或直接點它）→ 跳出 AI 總管對話框，直接跟它聊。
   · 它會轉頭看著你、靠近時揮手、眨眼；天線燈會呼吸
   · 對話框用的就是辦公室頁的 AI 總管（同一個對話紀錄，連到 AISO1 或你設定的模型）
   · Esc 或右上 ✕ 關閉
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Robot = { mount, unmount, open: () => R && R.open(), state: () => (R ? { x: +R.x.toFixed(2), z: +R.z.toFixed(2), near: R.near, open: !!R.box } : null) });
  let R = null;
  const PI = Math.PI;

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, pos, stationsX, officeZ, addObs, interact, pickables, aniso } = ctx;
    if (!interact || officeZ === undefined) return;
    const X = stationsX[0] - 2.0, Z = officeZ - 2.0;   // 辦公室裡、桌子左前方
    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
    const M = (c, r = 0.35, m = 0.1) => new THREE.MeshStandardMaterial({ color: lin(c), roughness: r, metalness: m });
    const E = (c, i = 1.6) => new THREE.MeshStandardMaterial({ color: lin(c), emissive: lin(c), emissiveIntensity: i, roughness: 0.5 });
    const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const tex = (c) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso || 1; return t; };

    const root = new THREE.Group(); root.position.set(X, 0, Z); scene.add(root);
    const put = (geo, mat, x, y, z, p = root, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; p.add(m); return m; };
    const WHITE = M(0xf4f2fb, 0.3, 0.15), ACC = M(0x7c5cff, 0.4, 0.2), DARK = M(0x1a1630, 0.35, 0.3);

    // 懸浮底座 + 光環
    put(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 28), DARK, 0, 0.06, 0);
    const ring = put(new THREE.TorusGeometry(0.3, 0.018, 8, 40), E(0x59e0ff, 1.8), 0, 0.05, 0, root, false); ring.rotation.x = PI / 2;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ color: 0x59e0ff, transparent: true, opacity: 0.18, depthWrite: false })); glow.rotation.x = -PI / 2; glow.position.y = 0.02; root.add(glow);
    const bob = new THREE.Group(); bob.position.y = 0.12; root.add(bob);

    // 身體
    put(new THREE.SphereGeometry(0.26, 24, 18), WHITE, 0, 0.5, 0, bob).scale.set(1, 1.15, 0.9);
    const panel = put(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.52, 0.233, bob, false);
    const pc = cv(160, 112), pt = tex(pc); panel.material.map = pt; panel.material.toneMapped = false;
    const paintPanel = (t) => { const c = pc.getContext("2d"); c.fillStyle = "#12102a"; c.fillRect(0, 0, 160, 112); for (let k = 0; k < 5; k++) { const h = 14 + 52 * (0.5 + 0.5 * Math.sin(t * 3 + k * 1.3)); c.fillStyle = ["#59e0ff", "#7c5cff", "#ff7ac8", "#6be3a4", "#ffd23f"][k]; c.fillRect(12 + k * 28, 100 - h, 20, h); } pt.needsUpdate = true; };
    paintPanel(0);
    const belt = put(new THREE.TorusGeometry(0.245, 0.02, 8, 32), ACC, 0, 0.36, 0, bob, false); belt.rotation.x = PI / 2; belt.scale.set(1, 0.9, 1);
    // 手臂
    const arms = [-1, 1].map((sg) => { const a = new THREE.Group(); a.position.set(sg * 0.31, 0.62, 0); bob.add(a); put(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 12), WHITE, 0, -0.12, 0, a); put(new THREE.SphereGeometry(0.06, 12, 10), ACC, 0, -0.26, 0, a); a.rotation.z = sg * 0.35; return a; });
    // 頭
    const head = new THREE.Group(); head.position.set(0, 0.98, 0); bob.add(head);
    put(new THREE.SphereGeometry(0.23, 28, 20), WHITE, 0, 0.1, 0, head).scale.set(1.12, 0.92, 1);
    const vis = put(new THREE.SphereGeometry(0.2, 24, 16, -PI * 0.42, PI * 0.84, PI * 0.2, PI * 0.56), M(0x14112b, 0.12, 0.5), 0, 0.1, 0.045, head, false); vis.scale.set(1.15, 0.9, 1.05);
    const fc = cv(256, 128), ft = tex(fc), face = put(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: ft, transparent: true, toneMapped: false, depthWrite: false }), 0, 0.105, 0.248, head, false); face.rotation.x = -0.02;
    let faceKey = "";
    const paintFace = (mode, talk) => {
      const k = mode + (talk ? "t" : ""); if (k === faceKey) return; faceKey = k; const c = fc.getContext("2d"); c.clearRect(0, 0, 256, 128); c.strokeStyle = c.fillStyle = "#59e0ff"; c.lineWidth = 12; c.lineCap = "round"; c.shadowColor = "#59e0ff"; c.shadowBlur = 16;
      for (const ex of [82, 174]) { if (mode === "blink") { c.beginPath(); c.moveTo(ex - 20, 52); c.lineTo(ex + 20, 52); c.stroke(); } else if (mode === "happy") { c.beginPath(); c.arc(ex, 62, 20, PI * 1.1, PI * 1.9); c.stroke(); } else { c.beginPath(); c.ellipse(ex, 52, 14, 20, 0, 0, 7); c.fill(); } }
      c.lineWidth = 9; c.beginPath(); if (talk) c.ellipse(128, 100, 14, 9, 0, 0, 7); else c.arc(128, 82, 26, 0.25 * PI, 0.75 * PI); c.stroke(); ft.needsUpdate = true;
    };
    paintFace("open", false);
    for (const sg of [-1, 1]) { const e = put(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 14), ACC, sg * 0.265, 0.1, 0, head); e.rotation.z = PI / 2; }
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), DARK, 0, 0.4, 0, head);
    const bulb = put(new THREE.SphereGeometry(0.04, 14, 10), E(0xff7ac8, 1.5), 0, 0.5, 0, head, false);
    // 名牌 + 提示泡泡
    const tag = (txt, sub) => { const c = cv(384, 112); const x = c.getContext("2d"); x.fillStyle = "rgba(26,22,48,.9)"; x.beginPath(); x.roundRect ? x.roundRect(6, 6, 372, 100, 30) : x.rect(6, 6, 372, 100); x.fill(); x.strokeStyle = "#7c5cff"; x.lineWidth = 5; x.stroke(); x.fillStyle = "#fff"; x.textAlign = "center"; x.font = "800 40px 'Noto Sans TC', system-ui, sans-serif"; x.fillText(txt, 192, 52); x.fillStyle = "#b9a6ff"; x.font = "600 26px 'Noto Sans TC', system-ui, sans-serif"; x.fillText(sub, 192, 88); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthTest: false })); sp.renderOrder = 12; return sp; };
    const nameTag = tag("🤖 AI 總管", "辦公室機器人"), hint = tag("找我聊聊吧", "按 Enter"); nameTag.position.set(0, 1.78, 0); nameTag.scale.set(0.92, 0.27, 1); hint.position.set(0, 1.78, 0); hint.scale.set(0.92, 0.27, 1); hint.visible = false; root.add(nameTag, hint);

    addObs(X, Z, 0.36, 0.36);
    const st = { x: X, z: Z, stand: { x: X + 0.5, z: Z + 0.95 } };

    /* ----- 對話框 ----- */
    const close = () => { if (!R || !R.box) return; R.box.remove(); R.box = null; document.body.classList.remove("robot-open"); };
    const open = () => {
      if (!R || R.box) return;
      if (!window.AIChat) return;
      const box = document.createElement("div"); box.className = "robot-chat";
      box.innerHTML = `<section class="office-ai"><header class="rc-h"><b>🤖 AI 總管</b><span>我看得到所有專案的目標、狀態與 Next Step</span><button type="button" data-x aria-label="關閉">✕</button></header><div class="ai-mount" data-m></div></section>`;
      document.body.appendChild(box); R.box = box; document.body.classList.add("robot-open");
      window.AIChat.mount(box.querySelector("[data-m]"), { id: "__office", name: "辦公室", office: true, projects: ctx.P });
      box.querySelector("[data-x]").addEventListener("click", close);
      const ta = box.querySelector("textarea"); if (ta) setTimeout(() => ta.focus(), 60);
    };
    const onKey = (e) => { if (e.key === "Escape" && R && R.box) { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);

    /* ----- 互動 ----- */
    const act = { id: "robot", x: X, z: Z + 0.2, r: 1.7, lvl: 0, html: "<kbd>Enter</kbd> 跟 <b>AI 總管機器人</b> 聊天 <small>　直接問它：現在該先做哪個專案？</small>", fn: open };
    interact.push(act);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.85; hit.userData = { station: 0, kind: "act", act: open, stand: st.stand }; root.add(hit); pickables.push(hit);

    /* ----- 動畫 ----- */
    let blinkT = 2.5, blinkOn = 0, yaw = 0, near = 0, tAcc = 0;
    const tick = (dt, t) => {
      tAcc = t; const d = Math.hypot(pos.x - X, pos.z - Z), isNear = d < 3.2 ? 1 : 0; near += (isNear - near) * Math.min(1, dt * 4);
      bob.position.y = 0.12 + 0.035 * Math.sin(t * 1.8); ring.scale.setScalar(1 + 0.05 * Math.sin(t * 3)); glow.material.opacity = 0.14 + 0.06 * Math.sin(t * 3);
      bulb.material.emissiveIntensity = 1.2 + 0.9 * (0.5 + 0.5 * Math.sin(t * 4));
      // 轉頭看你
      const want = Math.atan2(pos.x - X, pos.z - Z), lim = 1.0; let da = want - yaw; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
      const target = isNear ? Math.max(-lim, Math.min(lim, want)) : 0; head.rotation.y += (target - head.rotation.y) * Math.min(1, dt * 5);
      root.rotation.y += ((isNear ? Math.max(-0.9, Math.min(0.9, want * 0.5)) : 0) - root.rotation.y) * Math.min(1, dt * 3);
      // 揮手
      arms[1].rotation.z = -0.35 - near * (1.0 + 0.45 * Math.sin(t * 7)); arms[1].rotation.x = 0; arms[0].rotation.z = 0.35 + 0.05 * Math.sin(t * 1.8);
      // 臉
      blinkT -= dt; if (blinkT <= 0) { blinkOn = 0.12; blinkT = 2.5 + Math.random() * 2.5; } if (blinkOn > 0) blinkOn -= dt;
      const talking = !!(R && R.box && document.querySelector(".robot-chat .ai-msgs .live, .robot-chat [data-live]"));
      paintFace(blinkOn > 0 ? "blink" : near > 0.6 ? "happy" : "open", talking);
      if (((t * 8) | 0) % 2 === 0) paintPanel(t);
      nameTag.visible = near < 0.5; hint.visible = near >= 0.5 && !(R && R.box); R.near = near > 0.5;
    };
    hooks.push(tick);
    R = { ctx, root, hooks, tick, act, hit, interact, pickables, scene, onKey, open, close, box: null, x: X, z: Z, near: false };
  }

  function unmount() {
    if (!R) return;
    R.close && R.close(); window.removeEventListener("keydown", R.onKey, true);
    const i = R.hooks.indexOf(R.tick); if (i >= 0) R.hooks.splice(i, 1);
    const j = R.interact.indexOf(R.act); if (j >= 0) R.interact.splice(j, 1);
    const k = R.pickables.indexOf(R.hit); if (k >= 0) R.pickables.splice(k, 1);
    R.scene.remove(R.root); R = null;
  }
})();
