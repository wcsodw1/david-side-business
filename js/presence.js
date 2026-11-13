/* ============================================================
   兩人同在（Presence）：David 與 Aeris 各用自己的密碼登入。
   · 對方有上線 → 看到對方的角色即時在藝廊裡走（WebRTC 點對點，不存任何資料）
   · 對方沒上線 → 對方的角色在家裡睡覺（頭上飄 Zzz）
   · 對方上線時，原本的 NPC 版 Aeris 會消失，換成真人
   連線靠免費的 PeerJS 公開轉接服務牽線；兩人要「同時在線」才看得到彼此即時動作。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Presence = { mount, unmount, state: () => (Pz ? { status: Pz.status, remote: Pz.remote, peer: !!Pz.peer } : null) });
  const PEER_SRC = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
  const ROOM = (() => { try { const r = new URLSearchParams(location.search).get("room"); return r ? "-" + r.replace(/[^a-z0-9]/gi, "").slice(0, 12) : ""; } catch (_) { return ""; } })();   // 測試用：?room=xxx 使用獨立代號，不干擾正式的兩個身分
  const ID = { david: "dsb7f3a-david-v1" + ROOM, aeris: "dsb7f3a-aeris-v1" + ROOM };
  const NAME = { david: "David", aeris: "Aeris ✿" };
  const BED = { david: { x: 2.55, z: -6.85, y: 0.74 }, aeris: { x: 2.55, z: -3.6, y: 3.3 + 0.74 } };   // David 睡一樓大床；Aeris 睡二樓自己的床（y = 床面高度）   // 睡覺時「腳」的位置（床尾）；頭朝西躺在枕頭上
  let Pz = null;
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  const loadPeer = () => new Promise((res, rej) => {
    if (window.Peer) return res();
    const s = document.createElement("script"); s.src = PEER_SRC; s.onload = res; s.onerror = () => rej(new Error("PeerJS 載入失敗"));
    document.head.appendChild(s);
  });

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, camera } = ctx;
    const me = window.PERSONA === "aeris" ? "aeris" : "david", other = me === "aeris" ? "david" : "aeris";
    const av = other === "aeris" && window.Aeris ? window.Aeris.buildPlayer(THREE, (o) => ctx.buildAvatar(o)) : ctx.buildAvatar();
    const W = new THREE.Group(); W.add(av.root); scene.add(W);

    const tagTex = (txt, fill, stroke, ink) => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 80; const g = c.getContext("2d");
      g.fillStyle = fill; g.beginPath(); g.roundRect ? g.roundRect(28, 10, 200, 60, 30) : g.rect(28, 10, 200, 60); g.fill();
      g.strokeStyle = stroke; g.lineWidth = 3; g.stroke(); g.fillStyle = ink; g.font = "700 34px 'Noto Sans TC', -apple-system, sans-serif"; g.textAlign = "center"; g.fillText(txt, 128, 52);
      return new THREE.CanvasTexture(c);
    };
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: other === "aeris" ? tagTex(NAME.aeris, "rgba(255,240,250,.92)", "#e58fb0", "#b0466e") : tagTex(NAME.david, "rgba(20,17,43,.88)", "#ffe9b8", "#ffe9b8"), transparent: true, depthTest: false }));
    tag.renderOrder = 11; scene.add(tag);
    const zc = document.createElement("canvas"); zc.width = 128; zc.height = 128; const zg = zc.getContext("2d");
    zg.fillStyle = "#fff"; zg.strokeStyle = "#3a3358"; zg.lineWidth = 6; zg.font = "800 70px sans-serif"; zg.textAlign = "center"; zg.strokeText("Z", 48, 80); zg.fillText("Z", 48, 80); zg.font = "800 46px sans-serif"; zg.strokeText("z", 92, 56); zg.fillText("z", 92, 56);
    const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(zc), transparent: true, depthTest: false })); zzz.renderOrder = 12; scene.add(zzz);

    // 左上角狀態小膠囊
    const pill = document.createElement("div");
    pill.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:40;padding:6px 14px;border-radius:999px;background:rgba(20,17,43,.78);color:#fff;font:600 12px -apple-system,'Noto Sans TC',sans-serif;pointer-events:none;letter-spacing:.04em;opacity:.0;transition:opacity .4s";
    document.body.appendChild(pill);
    let pillBase = "", dbg = "";
    const paint = () => { const t = pillBase ? pillBase + (dbg ? "  ·  " + dbg : "") : ""; pill.textContent = t; pill.style.opacity = t ? "1" : "0"; };
    const setPill = (txt) => { pillBase = txt; paint(); };
    const setDbg = (d) => { dbg = d; if (pillBase) paint(); };

    Pz = { peer: null, conns: null, status: "連線中", remote: null, timers: [], av, W, tag, zzz, pill, hooks, ctx };
    const rm = { x: 0, z: 0, f: 0, sp: 0, sit: 0, t: 0, on: false };    // 對方最新狀態
    let sendT = 0, vis = 0;

    // 連線管理：可能同時有好幾條連線（重連時），全部都收、全部都送，避免「A 以為連上、B 以為沒連上」的平行宇宙
    const conns = new Set(); Pz.conns = conns;
    const anyOpen = () => [...conns].some((c) => c.open);
    const drop = () => { rm.on = false; Pz.remote = null; conns.forEach((c) => { try { c.close(); } catch (_) {} }); conns.clear(); setPill(`${NAME[other].replace(" ✿", "")} 睡覺中 💤`); Pz.status = "對方離線"; };
    const adopt = (c) => {
      conns.add(c); c.__t = performance.now();
      c.on("open", () => { Pz.status = "對方在線"; setPill(`${NAME[other].replace(" ✿", "")} 在線上`); setTimeout(() => setPill(""), 3500); });
      c.on("data", (d) => { if (d && typeof d.x === "number") { if (!rm.on) { rm.x = d.x; rm.z = d.z; } Object.assign(rm, d, { t: performance.now(), on: true }); Pz.remote = { x: +d.x.toFixed(1), z: +d.z.toFixed(1) }; } });
      const gone = () => { conns.delete(c); setTimeout(() => { if (Pz && rm.on && !anyOpen()) drop(); }, 4000); };   // 4 秒內沒有任何連線恢復，才當作下線
      c.on("close", gone); c.on("error", gone);
    };
    Pz.me = me;
    loadPeer().then(() => {
      if (!Pz) return;
      const peer = new window.Peer(ID[me], { debug: 0, config: { iceServers: [      // 跨網路（手機 4G/5G、公司網路）需要中繼，否則兩邊註冊了但連不起來
        { urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" },
        { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }] } }); Pz.peer = peer;
      peer.on("open", () => {
        // NPC 版 Aeris：有連上同步服務，就由「真人上線 / 睡覺」取代；沒連上則保留 NPC
                setPill(`${NAME[other].replace(" ✿", "")} 睡覺中 💤`); Pz.status = "對方離線"; setDbg(me === "david" ? "已連上同步服務，找對方中" : "已登記，等 David 連入");
        if (me === "david") {
          const tryConn = () => {
            if (!Pz || anyOpen()) return;
            const now = performance.now();
            for (const c of [...conns]) { if (!c.open && now - c.__t > 12000) { try { c.close(); } catch (_) {} conns.delete(c); } }   // 清掉卡住的舊連線
            if ([...conns].some((c) => !c.open)) return;                                                                          // 還有一條在連，不要再開新的
            const c = peer.connect(ID[other], { reliable: false }); adopt(c); setDbg("嘗試連線中");
            let n = 0; const iv = setInterval(() => { const st = c.peerConnection && c.peerConnection.iceConnectionState; if (c.open || !Pz) return clearInterval(iv); if (st) setDbg("連線狀態：" + st + (st === "new" ? "（對方沒回應）" : "")); if (++n > 3) clearInterval(iv); }, 1000);
          };
          tryConn(); Pz.timers.push(setInterval(tryConn, 4000));
        }
      });
      peer.on("connection", (c) => { setDbg("收到對方連入…"); adopt(c); });
      peer.on("error", (e) => {
        if (e.type === "unavailable-id") { Pz.status = "此身分已在別處登入"; setPill("此身分已在別的視窗登入，這裡只能單機走走"); }
        else if (e.type === "peer-unavailable") { setDbg("同步服務上找不到對方"); }
        else setDbg("服務錯誤：" + e.type);
      });
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (_) {} });
    }).catch(() => { Pz.status = "同步服務連不上"; });

    const hook = (dt, t) => {
      // 送出自己的狀態
      if (rm.on && performance.now() - rm.t > 15000) drop();   // 15 秒都沒收到才當作下線（手機切到背景時會變慢）
      // 對方：在線 → 站在對方位置；離線 → 躺在床上睡覺
      const on = rm.on;
      vis = lerp(vis, on ? 1 : 0, Math.min(1, dt * 5));
      if (on) {
        rm.x += 0; const k = Math.min(1, dt * 9);
        av.root.rotation.set(0, av.root.rotation.y, 0); W.position.set(0, 0, 0); W.rotation.set(0, 0, 0);
        const px = av.root.position.x, pz = av.root.position.z;
        av.root.position.set(lerp(px || rm.x, rm.x, k), lerp(av.root.position.y, rm.y || 0, k), lerp(pz || rm.z, rm.z, k));
        av.root.rotation.y += angDiff(av.root.rotation.y, rm.f) * Math.min(1, dt * 10);
        av.update(dt, rm.sp || 0, t); if (rm.sit > 0.5 && ctx.seatPose) ctx.seatPose(av, rm.sit);
        tag.visible = true; tag.position.set(av.root.position.x, av.root.position.y + 2.0, av.root.position.z); zzz.visible = false;
      } else {
        const b = BED[other]; W.position.set(b.x, b.y, b.z); W.rotation.set(0, Math.PI / 2, 0); av.root.rotation.set(-Math.PI / 2, 0, 0); av.root.position.set(0, 0, 0);
        av.update(dt, 0, t); av.torso.rotation.x = Math.sin(t * 1.4) * 0.02; av.head.rotation.set(0, 0.3, 0);
        tag.visible = false; zzz.visible = true; const f = (t * 0.5) % 1; zzz.position.set(b.x - 1.45 + f * 0.1, b.y + 0.4 + f * 0.5, b.z); zzz.material.opacity = 1 - f * 0.9;
        { const w = camera.position.distanceTo(zzz.position) * 0.06; zzz.scale.set(w, w, 1); }
      }
      { const w = camera.position.distanceTo(tag.position) * 0.07; tag.scale.set(w, w * 0.3125, 1); }
    };
    hooks.push(hook); Pz.hook = hook;
    // 送出自己的狀態：用計時器而不是畫面更新，這樣分頁在背景、手機暫時切走時也不會停送（背景分頁最慢約每秒一次）
    Pz.timers.push(setInterval(() => {
      const m = ctx.getMe(), msg = { x: m.x, z: m.z, y: m.y, f: m.f, sp: m.sp, sit: m.sit };
      conns.forEach((c) => { if (c.open) { try { c.send(msg); } catch (_) {} } });
    }, 100));
  }

  function unmount() {
    if (!Pz) return;
    const i = Pz.hooks.indexOf(Pz.hook); if (i >= 0) Pz.hooks.splice(i, 1);
    Pz.timers.forEach(clearInterval);
    try { Pz.conns.forEach((c) => c.close()); Pz.peer && Pz.peer.destroy(); } catch (_) {}
    for (const o of [Pz.W, Pz.tag, Pz.zzz]) o.parent && o.parent.remove(o);
    Pz.pill.remove();
    Pz = null;
  }
})();
