/* ============================================================
   自動門：走近會自動往兩側滑開，離開幾秒後自動關上（靜音）。
   · 美術館大門（入口）
   · 匹克球館大門
   · 家門（一樓）
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Doors = { mount, unmount, state: () => (D ? D.doors.map((d) => [d.name, +d.open.toFixed(2)]) : null) });
  let D = null;
  const lerp = (a, b, t) => a + (b - a) * t;

  function mount(ctx) {
    unmount();
    const { THREE, scene, hooks, pos, ENTRY, HOUSE } = ctx;
    const root = new THREE.Group(); scene.add(root);
    const glass = new THREE.MeshStandardMaterial({ color: 0xa9d6ff, roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.32, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false });
    const frame = new THREE.MeshStandardMaterial({ color: 0x2b2d36, roughness: 0.35, metalness: 0.8 });
    const led = new THREE.MeshStandardMaterial({ color: 0x9fffd0, emissive: 0x30ff9a, emissiveIntensity: 1.6 });

    // name：名稱；x：門的 x（沿 z 方向開）；zc：門中心；w：開口總寬；h：門高；r：感應距離
    const make = (name, x, zc, w, h, r) => {
      const panels = [], pw = w / 2 + 0.04;
      for (const s of [-1, 1]) {
        const g = new THREE.Group(); root.add(g);
        const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = false; g.add(m); return m; };
        add(new THREE.BoxGeometry(0.04, h - 0.1, pw - 0.1), glass, 0, h / 2, 0);                              // 玻璃
        add(new THREE.BoxGeometry(0.07, h, 0.07), frame, 0, h / 2, s * (pw / 2 - 0.02));                       // 外側門框
        add(new THREE.BoxGeometry(0.07, h, 0.07), frame, 0, h / 2, -s * (pw / 2 - 0.02));                      // 內側門框
        add(new THREE.BoxGeometry(0.07, 0.08, pw), frame, 0, h - 0.04, 0); add(new THREE.BoxGeometry(0.07, 0.08, pw), frame, 0, 0.04, 0);
        add(new THREE.BoxGeometry(0.09, 0.9, 0.04), frame, 0.0, h * 0.5, -s * 0.12);                           // 把手
        panels.push({ g, s });
      }
      add0(new THREE.BoxGeometry(0.16, 0.22, w + 0.3), frame, x, h + 0.11, zc); add0(new THREE.BoxGeometry(0.02, 0.05, 0.4), led, x - 0.09, h + 0.11, zc);   // 門上感應器 + 狀態燈
      function add0(geo, mat, px, py, pz) { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); root.add(m); return m; }
      return { name, x, zc, w, h, r, panels, open: 0, was: false };
    };
    const doors = [
      make("美術館大門", ENTRY - 0.28, 0, 3.8, 2.95, 3.4),
      make("匹克球館", (ctx.hallX0 || 0) - 0.16, 0, 2.4, 2.6, 3.0),
      make("家門", HOUSE.x1 + 0.12, -2.4, 1.6, 2.1, 2.4),
    ];
    D = { root, hooks, doors };
    D.hook = (dt) => {
      for (const d of doors) {
        const near = Math.hypot(pos.x - d.x, pos.z - d.zc) < d.r && (d.name !== "家門" || ctx.getLevel() === 0);
        if (near !== d.was) d.was = near;   // 自動門：靜音（沒有聲音）
        d.open = lerp(d.open, near ? 1 : 0, Math.min(1, dt * (near ? 3.2 : 1.8)));      // 開得快、關得慢
        const half = d.w / 4 + 0.02, slide = d.w / 2 * d.open * 0.96;
        for (const p of d.panels) p.g.position.set(d.x, 0, d.zc + p.s * (half + slide));
      }
    };
    hooks.push(D.hook);
  }

  function unmount() {
    if (!D) return;
    const i = D.hooks.indexOf(D.hook); if (i >= 0) D.hooks.splice(i, 1);
    D.root.parent && D.root.parent.remove(D.root); D = null;
  }
})();
