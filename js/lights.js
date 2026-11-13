/* ============================================================
   夜間燈光：
   · 天黑後路燈是熄的；你走近（約 9 公尺內）才會亮起（燈泡發光 + 光暈 + 照亮地面），走遠就慢慢熄掉
   · 匹克球場有明亮的場館照明（天花板燈條 + 強光），晚上打球很亮
   · 白天燈是熄的
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Lights = { mount, unmount, state: () => (L ? { night: +L.night.toFixed(2), lamps: L.lamps.length, on: L.lamps.filter((l) => l.on > 0.6).length, court: +L.courtI.toFixed(2) } : null) });
  let L = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, pos } = ctx, lampMat = ctx.lampMat;
    const root = new THREE.Group(); scene.add(root);
    // 光暈貼圖
    const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,244,214,1)"); gr.addColorStop(0.25, "rgba(255,214,150,.55)"); gr.addColorStop(1, "rgba(255,190,110,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const glowT = new THREE.CanvasTexture(c);
    const lamps = (ctx.lamps || []).map((p) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); sp.position.set(p.x, p.y + 0.05, p.z); sp.renderOrder = 8; root.add(sp);
      return { x: p.x, y: p.y, z: p.z, sp, on: 0 };
    });
    // 會真的照亮地面的燈：只給離你最近的 3 盞（其他只有光暈，省效能）
    const pool = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffd9a0, 0, 9); l.position.set(0, 2.4, 0); root.add(l); return l; });

    // 匹克球場照明：天花板燈條 + 兩盞強光
    const CX = ctx.COURT_CX, barMat = new THREE.MeshStandardMaterial({ color: 0xf4f6ff, emissive: 0xdfe8ff, emissiveIntensity: 0.1, roughness: 0.4 });
    for (const dx of [-5.2, -1.7, 1.7, 5.2]) for (const dz of [-2.0, 2.0]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.26), barMat); b.position.set(CX + dx, 4.15, dz); root.add(b); }
    const flood = [-4.4, 4.4].map((dx) => { const l = new THREE.PointLight(0xeaf1ff, 0, 17); l.position.set(CX + dx, 3.9, 0); root.add(l); return l; });

    L = { root, hooks, lamps, pool, flood, barMat, night: 0, courtI: 0 };
    L.hook = (dt) => {
      const sy = ctx.getSunHeight ? ctx.getSunHeight() : 1, night = clamp(1 - (sy + 0.18) / 0.3, 0, 1); L.night = night;
      // 近的燈更亮（走過去亮）
      const near = [];
      for (const l of lamps) {
        const d = Math.hypot(pos.x - l.x, pos.z - l.z), target = night > 0.02 && d < 9 ? 1 : 0;   // 人走過去才亮，離開就熄
        l.on = lerp(l.on, target, Math.min(1, dt * (target ? 3.5 : 1.2)));      // 亮得快、慢慢熄
        if (l.mat) l.mat.emissiveIntensity = 0.08 + night * l.on * 1.3;
        const dc = ctx.camera.position.distanceTo(l.sp.position), fade = clamp(dc / 14, 0.25, 1);   // 離鏡頭越近光暈越小，避免疊成一片白
        l.sp.material.opacity = night * l.on * 0.38 * fade; const s = (0.7 + 1.1 * l.on) * (0.55 + 0.45 * fade); l.sp.scale.set(s, s, 1);
        if (night > 0.05 && l.on > 0.05) near.push([d, l]);
      }
      near.sort((a, b) => a[0] - b[0]);
      pool.forEach((pl, i) => { const t = near[i] ? near[i][1] : null; if (t) { pl.position.x = lerp(pl.position.x, t.x, Math.min(1, dt * 6)); pl.position.y = t.y; pl.position.z = lerp(pl.position.z, t.z, Math.min(1, dt * 6)); } pl.intensity = lerp(pl.intensity, t ? 1.0 * night * t.on : 0, Math.min(1, dt * 4)); });
      // 球場：晚上全亮（白天也有一點室內光）
      L.courtI = lerp(L.courtI, night, Math.min(1, dt * 2));
      barMat.emissiveIntensity = 0.15 + L.courtI * 2.6; flood.forEach((f) => (f.intensity = L.courtI * 2.2));
    };
    hooks.push(L.hook);
  }

  function unmount() {
    if (!L) return;
    const i = L.hooks.indexOf(L.hook); if (i >= 0) L.hooks.splice(i, 1);
    L.root.parent && L.root.parent.remove(L.root); L = null;
  }
})();
