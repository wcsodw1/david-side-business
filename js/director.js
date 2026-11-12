/* ============================================================
   館長（Director）：在藝廊裡巡邏的 NPC。
   看到 David 走近，會停下來報告「他正在看的專案」的現況與完成度，
   並依狀況主動提問：
     · 這個專案要做到什麼程度才算完成？（設定目標）
     · 要拆成哪幾個里程碑？（讓完成度自動計算）
     · 已經幾天沒更新了，卡在哪？
     · 下一個里程碑做完了嗎？
   所有回答都會存進 Store（這台瀏覽器），並即時更新白板與完成度。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Director = { mount, unmount, dismiss: () => !!(D && D.dismissFn && D.dismissFn()) });
  let D = null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const rand = (a, b) => a + Math.random() * (b - a);

  function mount(ctx) {
    unmount();
    const { THREE, scene, P, H, pos, stationsX, anchor, enterPts, exitPts, hooks, toScreen } = ctx;
    const N = P.length; if (!N) return;
    const av = ctx.buildAvatar({ blazer: 0x3b404c, pants: 0x25262c, hair: 0xc4c1ba, shirt: 0xf3f1ea, skin: 0xd9a785, tie: 0x7a2230 });
    if (av.head) {
      const gm = new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.6, roughness: 0.3 });
      for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 8, 20), gm); r.position.set(sx * 0.04, 0.012, 0.112); av.head.add(r); }
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), gm); br.position.set(0, 0.016, 0.114); av.head.add(br);
    }
    scene.add(av.root);

    // 名牌
    const c = document.createElement("canvas"); c.width = 256; c.height = 80; const g = c.getContext("2d");
    g.fillStyle = "rgba(20,17,43,.88)"; g.beginPath(); g.roundRect ? g.roundRect(8, 10, 240, 60, 30) : g.rect(8, 10, 240, 60); g.fill();
    g.strokeStyle = "#ffe9b8"; g.lineWidth = 3; g.stroke();
    g.fillStyle = "#ffe9b8"; g.font = "700 32px 'Noto Sans TC', sans-serif"; g.textAlign = "center"; g.fillText("館長 Director", 128, 52);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); tag.scale.set(1.3, 0.4, 1); tag.renderOrder = 11; av.root.add(tag); tag.position.y = 2.25;

    const npc = { x: anchor(Math.min(3, N)).x, z: 0.2, face: Math.PI, speed: 0 };
    let route = [], state = "pause", timer = 2, focus = 1, inRoom = -1, cool = 6, speed = 0, talk = null;
    const snooze = {};

    const bubble = document.createElement("div"); bubble.className = "dir-bubble"; bubble.hidden = true; document.body.appendChild(bubble);

    /* ----- 巡邏 ----- */
    const lane = 0;
    const planVisit = () => {
      let s = 1 + Math.floor(Math.random() * N); if (N > 1) while (s === focus) s = 1 + Math.floor(Math.random() * N);
      focus = s;
      const pts = [];
      if (inRoom >= 0) pts.push(...exitPts(inRoom, npc));
      pts.push({ x: npc.x, z: lane }, { x: anchor(s).x, z: lane });
      const visitRoom = Math.random() < 0.5;
      if (visitRoom) { pts.push({ x: ctx.doorX(s), z: 0.4 }, ...enterPts(s)); route = pts; state = "walk"; D.entering = s; }
      else { pts.push(anchor(s)); route = pts; state = "walk"; D.entering = -1; }
    };
    const stepRoute = (dt) => {
      if (!route.length) return 0;
      const t = route[0], dx = t.x - npc.x, dz = t.z - npc.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { route.shift(); return 0; }
      const sp = 1.5; npc.x += (dx / d) * sp * dt; npc.z += (dz / d) * sp * dt;
      npc.face += angDiff(npc.face, Math.atan2(dx, dz)) * Math.min(1, dt * 6); return sp;
    };

    /* ----- 對話 ----- */
    const projectNow = () => P[(inRoom >= 0 ? inRoom : focus) - 1] || P[0];
    const render = (view) => {
      bubble.innerHTML = `<div class="dir-name">館長</div><div class="dir-msg">${view.msg}</div>
        ${view.input ? `<form class="dir-form"><input name="a" placeholder="${esc(view.input.ph || "")}" autocomplete="off"><button type="submit">回答</button></form>` : ""}
        <div class="dir-btns">${(view.buttons || []).map((b, i) => `<button type="button" data-b="${i}">${esc(b.label)}</button>`).join("")}</div>`;
      bubble.hidden = false;
      const form = bubble.querySelector(".dir-form");
      if (form) {
        form.addEventListener("submit", (e) => { e.preventDefault(); const v = String(new FormData(form).get("a") || "").trim(); if (v) { document.body.classList.remove("dir-typing"); view.input.submit(v); } });
        const inp = form.querySelector("input"); inp.addEventListener("focus", () => document.body.classList.add("dir-typing")); inp.addEventListener("blur", () => document.body.classList.remove("dir-typing"));

      }
      bubble.querySelectorAll("[data-b]").forEach((b) => b.addEventListener("click", () => view.buttons[+b.dataset.b].fn()));
    };
    const end = (coolSec = 25) => { talk = null; bubble.hidden = true; document.body.classList.remove("dir-typing"); cool = coolSec; state = "pause"; timer = 1.5; };
    const later = (p) => ({ label: "稍後再說", fn: () => { snooze[p.id] = Date.now() + 180000; end(40); } });
    const ok = { label: "好", fn: () => end(35) };

    const finish = (p, msg) => { render({ msg, buttons: [ok] }); };
    const goalStep = (p, pre = "") => render({
      msg: `${pre}<b>${esc(p.name)}</b> 要做到什麼程度才算完成？`,
      input: { ph: "例如：上架 10 個商品 / 月營收 3 萬 / 簽滿 5 位租客", submit: (t) => { window.Store.setGoal(p.id, t); milestoneStep(p, `記下了：「${esc(t)}」。`); } },
      buttons: [later(p)],
    });
    const milestoneStep = (p, pre = "") => render({
      msg: `${pre}那要拆成哪幾個里程碑？（用逗號分隔，我會用它自動算完成度）`,
      input: { ph: "例如：確定商品、做好封面、上架第一批、拿到第一筆訂單", submit: (t) => { const n = window.Store.addMilestones(p.id, t); finish(p, `收到 ${n} 個里程碑。完成度現在是 <b>${p.progress}%</b>，之後你記錄進度時我會自動比對打勾。`); } },
      buttons: [later(p)],
    });
    const staleStep = (p, d, pre = "") => render({
      msg: `${pre}<b>${esc(p.name)}</b> 已經 <b>${d}</b> 天沒有更新了。最近做了什麼，或卡在哪裡？`,
      input: { ph: "例如：在等廠商回覆 / 已完成封面設計", submit: (t) => { const r = window.Store.addUpdate(p.id, { type: "事件", text: t }); finish(p, `已記錄。${r && r.ticked.length ? `並自動打勾：${esc(r.ticked.join("、"))}。` : ""}`); } },
      buttons: [later(p)],
    });
    const nextMsStep = (p, m, pre = "") => render({
      msg: `${pre}下一個里程碑是「<b>${esc(m.text)}</b>」，完成了嗎？`,
      buttons: [
        { label: "完成了", fn: () => { window.Store.toggleMilestone(p.id, m.id); finish(p, `太好了！<b>${esc(p.name)}</b> 的完成度更新為 <b>${p.progress}%</b>。`); } },
        { label: "還沒，補充進度", fn: () => render({ msg: `目前做到哪了？`, input: { ph: "簡短描述目前狀況", submit: (t) => { window.Store.addUpdate(p.id, { type: "事件", title: `${m.text}：進行中`, text: t }); finish(p, "已記錄，我會再追蹤。"); } }, buttons: [later(p)] }) },
        later(p),
      ],
    });

    const startTalk = () => {
      const p = projectNow(), st = H.st(p), real = (p.updates || []).filter((u) => !/專案頁建立/.test(u.title))[0];
      const intro = inRoom >= 0 ? `${window.PERSONA === "aeris" ? "Aeris" : "David"}，我正在檢查 <b>${esc(p.name)}</b> 的白板。` : `${window.PERSONA === "aeris" ? "Aeris" : "David"}，我剛巡到 <b>${esc(p.name)}</b>。`;
      const report = `${intro}目前<b>${esc(st.label)}</b>，完成度 <b>${p.progress}%</b>（${esc(p.progressReason || "")}）。${real ? `最近一次更新：${esc(real.title)}（${esc(String(real.date).replace(/-/g, "."))}）。` : "還沒有實際的進度紀錄。"}`;
      talk = { pid: p.id }; state = "talk";
      const snoozed = (snooze[p.id] || 0) > Date.now();
      const d = window.Store.daysSinceUpdate(p);
      const open = (p.milestones || []).find((m) => !m.done);
      const noGoal = P.filter((x) => !x.goal).length;
      if (snoozed) return finish(p, report);
      if (!p.goal) return goalStep(p, report + "<br><br>");
      if (!(p.milestones || []).length) return milestoneStep(p, report + "<br><br>");
      if (d == null || d >= 7) return staleStep(p, d == null ? "好多" : d, report + "<br><br>");
      if (open) return nextMsStep(p, open, report + "<br><br>");
      return finish(p, report + `<br><br>目標「${esc(p.goal)}」的里程碑都完成了，做得好！${noGoal ? `另外還有 ${noGoal} 個專案沒設定目標。` : ""}`);
    };

    /* ----- 每幀 ----- */
    const hook = (dt, t) => {
      const dx = pos.x - npc.x, dz = pos.z - npc.z, dist = Math.hypot(dx, dz);
      inRoom = ctx.roomAt(npc.x, npc.z);
      const blocked = document.body.classList.contains("board-open") || document.body.classList.contains("news-open") || document.body.classList.contains("locked");
      cool -= dt;
      if (state === "talk") {
        speed = 0; npc.face += angDiff(npc.face, Math.atan2(dx, dz)) * Math.min(1, dt * 7);
        if (dist > 9.5 && !document.body.classList.contains("dir-typing")) end(20);
      } else if (state === "pause") {
        speed = 0; timer -= dt; if (timer <= 0) planVisit();
        if (dist < 4.6 && cool <= 0 && !blocked) { startTalk(); }
      } else {
        speed = stepRoute(dt);
        if (dist < 3.6 && cool <= 0 && !blocked) { route = []; startTalk(); }
        else if (!route.length) { state = "pause"; timer = D.entering >= 0 ? rand(4, 7) : rand(2, 4); D.entering = -1; if (inRoom >= 0) { /* 在房內停一下，再出來 */ route = []; } }
      }
      av.root.position.set(npc.x, 0, npc.z); av.root.rotation.y = npc.face; av.update(dt, speed, t);
      { const w = ctx.camera.position.distanceTo(av.root.position) * 0.075; tag.scale.set(w, w * 0.3125, 1); }
      // 對話框位置
      if (!bubble.hidden) {
        const p = toScreen(new THREE.Vector3(npc.x, 2.3, npc.z));
        const w = bubble.offsetWidth || 300, h = bubble.offsetHeight || 140;
        const x = Math.max(12 + w / 2, Math.min(innerWidth - 12 - w / 2, p.x)), y = Math.max(h + 74, Math.min(innerHeight - 90, p.y - 18));
        bubble.style.left = x + "px"; bubble.style.top = y + "px";
      }
    };
    hooks.push(hook);
    D = { av, bubble, hook, hooks, entering: -1, dismissFn: () => { if (bubble.hidden) return false; const p = talk && P.find((x) => x.id === talk.pid); if (p) snooze[p.id] = Date.now() + 180000; end(40); return true; } };
  }

  function unmount() {
    if (!D) return;
    const i = D.hooks.indexOf(D.hook); if (i >= 0) D.hooks.splice(i, 1);
    D.bubble.remove(); D.av.root.parent && D.av.root.parent.remove(D.av.root);
    document.body.classList.remove("dir-typing"); D = null;
  }
})();
