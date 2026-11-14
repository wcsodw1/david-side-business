/* ============================================================
   Aeris：在藝廊裡散步的女生 NPC（原創角色）。
   長髮（栗色）、咖啡色洋裝、身高約 1.65m。
   會在中央走道散步、停在畫作前欣賞；David 走近時轉身揮手打招呼，
   頭上跳出對話泡泡；也會在房間之間走進走出，並不時主動走到 David 身邊聊天（可點選回答）。
   純規則式行為，不是 AI。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Aeris = { mount, unmount, buildPlayer: (THREE, fn) => { const av = makeLook(THREE, fn).av; if (window.Faces) window.Faces.apply(THREE, av, "aeris"); return av; }, hide: (on) => { if (A) A.hideNpc(on); }, dismiss: () => !!(A && A.dismiss()), chat: () => A && A.seek(), visit: (s) => A && A.goVisit(s), state: () => (A ? { x: +A.npc.x.toFixed(2), z: +A.npc.z.toFixed(2), mode: A.mode, line: A.line, visit: A.visit, route: A.route() } : null) });
  let A = null;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const HELLO = ["嗨，David！", "今天也要加油喔！", "你的夢想一定會成真", "這裡越來越漂亮了～", "要不要一起去看看畫？", "記得寫進度喔 ✏️", "我最喜歡夕陽了"];
  const ART = ["這幅畫好美～", "好想快點看到完成！", "嗯…這個專案好有趣"];

  /* ----- Aeris 外觀（NPC 與玩家模式共用）：長髮、淡紫洋裝、髮夾小花 ----- */
  function makeLook(THREE, buildAvatar) {
    const SKIN = 0xf0cbb0, HAIR = 0x2a1a13, DRESS = 0x3a3d43, COLLAR = 0x3a3d43, PANTS = 0x25272d, PI = Math.PI;
    const av = buildAvatar({ blazer: DRESS, shirt: COLLAR, pants: PANTS, skin: SKIN, hair: HAIR, shoe: 0xf2f2f2 });
    const M = (color, rough = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, envMapIntensity: 0.5, ...extra });
    const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const hairM = M(HAIR, 0.45, { side: THREE.DoubleSide }), dressM = M(DRESS, 0.8, { side: THREE.DoubleSide });
    const pinkM = M(0xf4a3b8, 0.5), blushM = M(0xf2a0a0, 0.9, { transparent: true, opacity: 0.45 });

    // 洋裝裙襬（A 字微張）+ 腰帶
    const skirtProf = [[0.165, 0], [0.19, -0.12], [0.235, -0.3], [0.285, -0.47], [0.29, -0.49]].map(([x, y]) => new THREE.Vector2(x, y));
    const skirt = add(new THREE.LatheGeometry(skirtProf, 32), dressM, av.body, 0, 0.99, 0); skirt.scale.set(1, 1, 0.82);  skirt.visible = false;   // 不穿洋裝：改穿 T 恤 + 寬褲
    add(new THREE.TorusGeometry(0.168, 0.012, 8, 32), M(0xffffff, 0.5), av.body, 0, 0.985, 0).visible = false;

    // 長髮：換掉通用短髮 → 頭頂 + 一圈蓬鬆的髮幕（包住兩側與後面，前面留出臉）+ 瀏海
    const h = av.head;
    h.children.filter((m) => m.geometry && m.geometry.type === "SphereGeometry" && m.material && m.material.color && m.material.color.getHex() === HAIR && m.geometry.parameters.radius > 0.1).forEach((m) => (m.visible = false));
    add(new THREE.SphereGeometry(0.124, 28, 14, 0, PI * 2, 0, PI * 0.43), hairM, h, 0, 0.092, -0.006).scale.set(0.98, 1.12, 1.08);
    const curtainProf = [[0.12, 0.13], [0.134, 0.06], [0.146, -0.06], [0.158, -0.2], [0.168, -0.3], [0.17, -0.37], [0.15, -0.42]].map(([r, y]) => new THREE.Vector2(r, y));
    const back = add(new THREE.LatheGeometry(curtainProf, 30, PI * 0.34, PI * 1.32), hairM, h, 0, 0, -0.024); back.scale.set(1, 1, 0.9);
    const strands = [];
    const bang = add(new THREE.SphereGeometry(0.118, 24, 12, PI * 0.15, PI * 0.7, PI * 0.18, PI * 0.2), hairM, h, 0.006, 0.105, 0.012);
    bang.scale.set(1, 1.05, 1.08); bang.rotation.y = -0.08;
    for (const sx of [-1, 1]) {                                                    // 腮紅、細睫毛
      add(new THREE.SphereGeometry(0.016, 10, 8), blushM, h, sx * 0.055, 0.058, 0.088).scale.set(1.3, 0.7, 0.35);
      const lash = add(new THREE.BoxGeometry(0.03, 0.003, 0.004), M(0x3a2218, 0.6), h, sx * 0.039, 0.104, 0.1); lash.rotation.z = sx * 0.18; lash.scale.set(0.8, 0.6, 1);
    }
    for (const m of h.children) {                                                  // 眉毛上揚、眼睛放大、鼻子縮小、拿掉直線嘴
      if (!m.geometry) continue; const gp = m.geometry.parameters;
      if (m.geometry.type === "BoxGeometry" && gp.width === 0.04 && gp.height === 0.007) { const sx = Math.sign(m.position.x); m.rotation.z = sx * -0.14; m.position.y += 0.004; m.scale.set(0.85, 0.8, 1); }
      if (m.geometry.type === "BoxGeometry" && gp.width === 0.04 && gp.height === 0.006) m.visible = false;
      if (m.geometry.type === "SphereGeometry" && (gp.radius === 0.015 || gp.radius === 0.0085)) m.scale.multiplyScalar(1.22);
      if (m.geometry.type === "ConeGeometry") m.scale.set(0.65, 0.6, 0.65);
    }
    av.torso.children.forEach((m) => { if (m.geometry && m.geometry.type === "CircleGeometry") m.visible = false; });
    { const sm = add(new THREE.TorusGeometry(0.017, 0.0028, 6, 16, PI * 0.8), M(0xc95f73, 0.5), h, 0, 0.034, 0.092); sm.rotation.z = PI * 1.1; sm.scale.set(1, 1, 0.25); }  // 貼著臉的微笑
    av.root.scale.setScalar(0.92);
    return { av, back, skirt, strands };
  }


  function mount(ctx) {
    unmount();
    const { THREE, scene, P, pos, anchor, hooks, camera } = ctx;
    const N = P.length; if (!N) return;
    if (window.PERSONA === "aeris" || window.Presence) return;   // 不再有 NPC 版：Aeris 是真人（上線）或在家睡覺（沒上線），由 presence.js 負責
    const { av, back, skirt, strands } = makeLook(THREE, ctx.buildAvatar);
    const PI = Math.PI;
    scene.add(av.root);

    // 名牌
    const c = document.createElement("canvas"); c.width = 256; c.height = 80; const g = c.getContext("2d");
    g.fillStyle = "rgba(255,240,250,.92)"; g.beginPath(); g.roundRect ? g.roundRect(28, 10, 200, 60, 30) : g.rect(28, 10, 200, 60); g.fill();
    g.strokeStyle = "#e58fb0"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#b0466e"; g.font = "700 34px 'Noto Sans TC', -apple-system, sans-serif"; g.textAlign = "center"; g.fillText("ARIES ✿", 128, 52);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); tag.renderOrder = 11; scene.add(tag);

    // 對話泡泡（3D sprite）
    const bubCache = {};
    const bubTex = (txt) => {
      if (bubCache[txt]) return bubCache[txt];
      const cv = document.createElement("canvas"); cv.width = 360; cv.height = 140; const b = cv.getContext("2d");
      b.fillStyle = "#fff6fb"; b.beginPath(); b.moveTo(40, 6); b.lineTo(320, 6); b.quadraticCurveTo(352, 6, 352, 38); b.lineTo(352, 78); b.quadraticCurveTo(352, 110, 320, 110); b.lineTo(200, 110); b.lineTo(180, 134); b.lineTo(160, 110); b.lineTo(40, 110); b.quadraticCurveTo(8, 110, 8, 78); b.lineTo(8, 38); b.quadraticCurveTo(8, 6, 40, 6); b.fill();
      b.strokeStyle = "#f0b6cc"; b.lineWidth = 4; b.stroke();
      b.fillStyle = "#5a2a44"; b.textAlign = "center"; let fs = 44; do { b.font = `700 ${fs}px 'Noto Sans TC', -apple-system, sans-serif`; fs -= 3; } while (b.measureText(txt).width > 310 && fs > 22);
      b.fillText(txt, 180, 76); const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; bubCache[txt] = t; return t;
    };
    const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubTex("…"), transparent: true, depthTest: false })); bub.renderOrder = 12; bub.visible = false; scene.add(bub);
    const say = (txt, sec) => { A.line = txt; A.lineT = sec; const t = bubTex(txt); if (bub.material.map !== t) { bub.material.map = t; bub.material.needsUpdate = true; } };

    // 散步範圍：中央走道（美術館入口之後 → 匹克球館門口之前）
    const xs = []; for (let s = 0; s <= N; s++) xs.push(anchor(s).x);
    const X0 = Math.min(...xs) - 4, X1 = Math.max(...xs) - 2.5;
    const npc = { x: anchor(Math.min(2, N)).x + 1.5, z: 0.9, face: -PI / 2 };
    let route = [], wait = 2, lookFace = null, waveT = 0, greetCool = 0, speed = 0;

    const ROOM = ["來看看白板～", "這間進度如何呢？", "哇，這間好可愛", "偷看一下里程碑 👀"];
    // 規劃下一段：①走進某間專案房間（含匹克球館）逛一逛 ②到門前看畫 ③在走道隨意散步
    // 若人在房內，一律先照館長的出口路線走出來，不穿牆
    const plan = () => {
      lookFace = null; A.lookAt = null; A.atArt = false; A.visit = -1;
      const inRoom = ctx.roomAt(npc.x, npc.z), pts = inRoom >= 0 ? [...ctx.exitPts(inRoom, npc)] : [];
      const from = pts.length ? pts[pts.length - 1] : npc;
      const r = Math.random();
      let s = 1 + Math.floor(Math.random() * N); if (s === inRoom && N > 1) s = (s % N) + 1;   // 1..N（辦公室沒有門，不進）
      if (r < 0.5) {
        pts.push({ x: from.x, z: lerp(from.z, 0.4, 0.8) }, { x: ctx.doorX(s), z: 0.4 }, ...ctx.enterPts(s));
        A.visit = s;
      } else if (r < 0.8 && anchor(s).x <= X1 + 2.6) {
        const a = anchor(s);
        pts.push({ x: from.x, z: lerp(from.z, 0, 0.6) }, { x: a.x + rand(-0.4, 0.4), z: lerp(0, a.z, 0.75) });
        A.lookAt = a.z < 0 ? PI : 0; A.atArt = true;
      } else {
        pts.push({ x: from.x, z: lerp(from.z, 0, 0.6) }, { x: rand(X0, X1), z: rand(-1.4, 1.4) });
      }
      route = pts;
    };

    /* ----- 主動聊天：不時走到 David 身邊，跳出可回答的對話框 ----- */
    const box = document.createElement("div"); box.className = "dir-bubble aeris-chat"; box.hidden = true; document.body.appendChild(box);
    let chatCool = rand(20, 35), seekT = 0;
    const realProjects = () => P.filter((p) => !/pickle/i.test(p.id + p.name));
    const show = (msg, replies) => {
      box.innerHTML = `<div class="dir-name">AERIS ✿</div><div class="dir-msg">${msg}</div><div class="dir-btns">${replies.map((r, i) => `<button type="button" data-r="${i}">${esc(r.label)}</button>`).join("")}</div>`;
      box.hidden = false;
      box.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => replies[+b.dataset.r].fn()));
    };
    const bye = { label: "掰掰", fn: () => endChat("掰掰～") };
    const reply = (msg) => show(msg, [{ label: "嗯！", fn: () => endChat("✿") }]);
    const TOPICS = [
      () => { const p = pick(realProjects().length ? realProjects() : P);
        return show(`David～我剛剛去看了 <b>${esc(p.name)}</b>，現在完成度 <b>${p.progress}%</b>。最近有在忙它嗎？`, [
          { label: "有，正在推進", fn: () => reply("好棒！做完一段記得到白板寫一下，我會幫你看著 ✏️") },
          { label: "還沒開始", fn: () => reply("沒關係，一步一步來～先想好第一個里程碑就好 ✿") }, bye]); },
      () => show("今天的夕陽好漂亮…你今天過得怎麼樣？", [
          { label: "很好！", fn: () => reply("太好了～那我們一起把夢想變成 Real 吧！") },
          { label: "有點累", fn: () => reply("辛苦了…去球館的休息區喝口水、坐一下吧 🥤") }, bye]),
      () => show("剛剛匹克球那局好精彩！要不要一起去看？", [
          { label: "走吧", fn: () => { endChat("我先去球館等你～"); goVisit(P.findIndex((p) => /pickle/i.test(p.id + p.name)) + 1); } },
          { label: "下次吧", fn: () => reply("好～那下次一定喔！") }]),
      () => { const ps = realProjects().slice().sort(() => Math.random() - 0.5).slice(0, 3);
        return show("我一直很好奇…你最想先完成哪個夢想？", [
          ...ps.map((p) => ({ label: p.name, fn: () => reply(`<b>${esc(p.name)}</b>！我會一直幫你加油的 ✿`) })), bye]); },
      () => show("我發現一件事：你最近好常來美術館耶～是不是有新點子了？", [
          { label: "被你發現了", fn: () => reply("嘿嘿，那趕快去辦公室記下來吧！") },
          { label: "只是來散步", fn: () => reply("那我陪你走一段～") }]),
    ];
    let lastTopic = -1;
    const openChat = () => {
      A.mode = "chat"; A.seeking = false; route = []; waveT = 2.4; A.lineT = 0;
      let i = Math.floor(Math.random() * TOPICS.length); if (i === lastTopic) i = (i + 1) % TOPICS.length; lastTopic = i;
      TOPICS[i]();
    };
    const endChat = (line) => {
      box.hidden = true; if (A.mode === "chat") { A.mode = "pause"; wait = rand(1.5, 3); }
      A.seeking = false; chatCool = rand(60, 110); greetCool = 20; if (line) say(line, 3);
    };
    const goVisit = (s) => {
      if (s < 1) return;
      const inRoom = ctx.roomAt(npc.x, npc.z), pts = inRoom >= 0 && inRoom !== s ? [...ctx.exitPts(inRoom, npc)] : [];
      const from = pts.length ? pts[pts.length - 1] : npc;
      pts.push({ x: from.x, z: lerp(from.z, 0.4, 0.8) }, { x: ctx.doorX(s), z: 0.4 }, ...ctx.enterPts(s)); route = pts; wait = 0.8; A.visit = s; A.atArt = false; A.lookAt = null;
    };
    const davidInCorridor = () => ctx.getInside() < 0 && ctx.roomAt(pos.x, pos.z) < 0;
    const seek = () => {
      if (A.mode === "chat") return;
      const inRoom = ctx.roomAt(npc.x, npc.z);
      route = inRoom >= 0 ? [...ctx.exitPts(inRoom, npc)] : []; wait = 0; A.seeking = true; seekT = 0; A.mode = "walk"; A.visit = -1; A.atArt = false; A.lookAt = null;
    };

    const hook = (dt, t) => {
      if (A.off) return;
      const dx = pos.x - npc.x, dz = pos.z - npc.z, dist = Math.hypot(dx, dz);
      const blocked = document.body.classList.contains("board-open") || document.body.classList.contains("news-open") || document.body.classList.contains("locked");
      greetCool -= dt; A.lineT -= dt;
      let want = npc.face;
      const dirOpen = !!document.querySelector(".dir-bubble:not(.aeris-chat):not([hidden])");
      if (A.mode !== "chat" && !A.seeking) { chatCool -= dt; if (chatCool <= 0 && !blocked && !dirOpen && davidInCorridor() && dist < 30) seek(); }
      if (A.seeking) {
        seekT += dt;
        if (seekT > 25 || blocked || dirOpen || (!route.length && !davidInCorridor())) { A.seeking = false; chatCool = rand(30, 50); }
        else if (!route.length && dist < 1.7) openChat();
        else if (!route.length) {                       // 朝 David 走過去（距離遠就小跑步）
          A.mode = "walk"; const sp = dist > 6 ? 2.6 : 1.3; speed = lerp(speed, sp, Math.min(1, dt * 4));
          npc.x += (dx / dist) * speed * dt; npc.z += (dz / dist) * speed * dt; want = Math.atan2(dx, dz);
          if (Math.random() < dt * 0.4 && A.lineT <= 0 && dist > 4) say("David～", 1.6);
        }
      }
      if (A.mode === "chat") {
        want = Math.atan2(dx, dz); speed = lerp(speed, 0, Math.min(1, dt * 8));
        if (dist > 6 || blocked) endChat();
      } else if (A.seeking && !route.length) {
        /* 上面已處理移動 */
      } else if (dist < 3.2 && !blocked && !A.seeking) {                        // David 走近：停下、轉身、揮手、打招呼
        if (A.mode !== "greet") { A.mode = "greet"; if (greetCool <= 0) { waveT = 2.4; say(HELLO[Math.floor(Math.random() * HELLO.length)], 4.5); greetCool = 14; } }
        want = Math.atan2(dx, dz); speed = lerp(speed, 0, Math.min(1, dt * 8));
      } else {
        if (A.mode === "greet") { A.mode = "pause"; wait = route.length ? 0 : rand(0.8, 2); }
        if (route.length && (wait -= dt) <= 0) {
          A.mode = "walk";
          const tg = route[0], ex = tg.x - npc.x, ez = tg.z - npc.z, d = Math.hypot(ex, ez);
          if (d < 0.15) { route.shift(); if (!route.length) { A.mode = "pause"; wait = A.visit >= 0 ? rand(5, 9) : A.atArt ? rand(4, 7) : rand(1.5, 3.5); if (A.visit >= 0 && Math.random() < 0.6) say(ROOM[Math.floor(Math.random() * ROOM.length)], 3.2); if (A.atArt) { waveT = 0; if (Math.random() < 0.5) say(ART[Math.floor(Math.random() * ART.length)], 3.2); } } }
          else { speed = lerp(speed, 1.15, Math.min(1, dt * 4)); npc.x += (ex / d) * speed * dt; npc.z += (ez / d) * speed * dt; want = Math.atan2(ex, ez); }
        } else {
          speed = lerp(speed, 0, Math.min(1, dt * 8)); if (A.lookAt != null) want = A.lookAt;
          if (!route.length) { wait -= dt; if (wait <= 0) plan(); }
        }
      }
      npc.face += angDiff(npc.face, want) * Math.min(1, dt * 6);
      av.root.position.set(npc.x, 0, npc.z); av.root.rotation.y = npc.face; av.update(dt, speed, t);

      // 女生的小動作：手臂靠近身體、走路時頭髮輕晃、停下時偶爾歪頭
      av.armL.sh.rotation.z = lerp(av.armL.sh.rotation.z, 0.02, 1); av.armR.sh.rotation.z = -0.02;
      const sway = Math.sin(t * 6.8) * 0.05 * Math.min(1, speed) + Math.sin(t * 1.3) * 0.015;
      back.rotation.x = 0.05 + Math.abs(sway) * 0.6; for (const st of strands) st.rotation.x = -0.08 - Math.abs(sway);
      skirt.rotation.y = Math.sin(t * 6.8) * 0.06 * Math.min(1, speed);
      if (speed < 0.1) av.head.rotation.z = Math.sin(t * 0.7) * 0.07;
      if (A.mode === "pause" && A.atArt) { av.armL.sh.rotation.x = -0.25; av.armL.el.rotation.x = -1.3; av.armR.sh.rotation.x = -0.25; av.armR.el.rotation.x = -1.3; }  // 雙手在身前交握
      if (waveT > 0) {                                     // 揮手（右手舉高左右擺）
        waveT -= dt; const k = Math.min(1, waveT * 3, (2.4 - waveT) * 5);
        av.armR.sh.rotation.z = lerp(-0.02, 2.55, k); av.armR.sh.rotation.x = lerp(av.armR.sh.rotation.x, -0.2, k);
        av.armR.el.rotation.x = lerp(av.armR.el.rotation.x, -0.25, k); av.armR.el.rotation.z = Math.sin(t * 11) * 0.45 * k;
        av.head.rotation.z = 0.12 * k;
      } else av.armR.el.rotation.z = 0;

      const top = 2.1;
      tag.position.set(npc.x, top, npc.z); { const w = camera.position.distanceTo(tag.position) * 0.07; tag.scale.set(w, w * 0.3125, 1); }
      if (!box.hidden) {
        const p = ctx.toScreen(new THREE.Vector3(npc.x, 2.0, npc.z)), w = box.offsetWidth || 300, hh = box.offsetHeight || 140;
        box.style.left = Math.max(12 + w / 2, Math.min(innerWidth - 12 - w / 2, p.x)) + "px"; box.style.top = Math.max(hh + 74, Math.min(innerHeight - 90, p.y - 18)) + "px";
      }
      bub.visible = A.lineT > 0 && !blocked && box.hidden;
      if (bub.visible) { bub.position.set(npc.x, top + 0.42, npc.z); const w = camera.position.distanceTo(bub.position) * 0.085; bub.scale.set(w, w * 0.389, 1); }
    };
    hooks.push(hook);
    const hideNpc = (on) => { A.off = on; for (const o of [av.root, tag, bub]) o.visible = !on && (o !== bub); if (on) { box.hidden = true; A.seeking = false; } };
    A = { hideNpc, off: false, box, seek, goVisit, dismiss: () => { if (box.hidden) return false; endChat("掰掰～"); return true; }, seeking: false, route: () => route.length, visit: -1, av, tag, bub, hook, hooks, npc, mode: "pause", line: "", lineT: 0, lookAt: null, atArt: false };
  }

  function unmount() {
    if (!A) return;
    const i = A.hooks.indexOf(A.hook); if (i >= 0) A.hooks.splice(i, 1);
    for (const o of [A.av.root, A.tag, A.bub]) o.parent && o.parent.remove(o);
    A.box.remove();
    A = null;
  }
})();
