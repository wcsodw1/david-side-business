(() => {
  "use strict";

  /* ============================================================
     密碼：只存 SHA-256 雜湊，不存明碼。
     要換密碼：在終端機執行  printf '新密碼' | shasum -a 256
     再把結果貼到下面 PASS_HASH。
     ⚠ 這是「前端擋門」：網站是靜態的，雜湊會公開在原始碼裡，
       足以擋一般訪客，但擋不住有心人。請勿放真正機密的資料。
     ============================================================ */
  const PASS_HASH = "e35cb0b39a3c9730ea7744c873ba8708f63d7f663acf56223045ab88f3167a1c";
  const KEY = "dsb-unlocked";
  const OFFICE_KEY = "dsb-office", OFFICE_HASH = "e6207542afa9e43cb59bf41af439c06ebb9a5b1c0652e3dcdb14b0b81931873a";   // 辦公室另設密碼（只存 SHA-256，不存明碼）
  let updTab = "gallery";   // 最新動態：藝廊 / TPI
  let officeTab = "tpi";   // 辦公室上方兩個類型：gallery（Side Business 儀表板）/ tpi（TPI 工作區）
  let wbPage = 0;   // 辦公室看板目前在第幾頁
  const officeOpen = () => { try { return sessionStorage.getItem(OFFICE_KEY) === OFFICE_HASH; } catch (_) { return false; } };
  // 辦公室權限閘：機器人 / AI 總管也要先輸入辦公室密碼（這個分頁輸入過一次就不再問）
  window.OfficeGate = {
    isOpen: () => officeOpen(),
    require(cb) {
      if (officeOpen()) return cb();
      if (document.getElementById("ogOv")) return;
      const ov = document.createElement("div"); ov.id = "ogOv";
      ov.innerHTML = `<form class="og-card" autocomplete="off"><h3>🔒 辦公室權限</h3><p>機器人 / AI 總管在辦公室裡，請輸入辦公室密碼。</p><input type="password" placeholder="辦公室密碼" aria-label="辦公室密碼"><div class="og-err"></div><div class="og-b"><button type="button" data-no>取消</button><button type="submit">進入</button></div></form>`;
      document.body.appendChild(ov);
      const f = ov.querySelector("form"), inp = ov.querySelector("input"), err = ov.querySelector(".og-err"), done = () => { ov.parentNode && ov.parentNode.removeChild(ov); };
      ["keydown", "keyup", "keypress"].forEach((t) => ov.addEventListener(t, (e) => { e.stopPropagation(); if (t === "keydown" && e.key === "Escape") done(); }));
      ov.querySelector("[data-no]").addEventListener("click", done);
      f.addEventListener("submit", async (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; if (await sha256(v) === OFFICE_HASH) { try { sessionStorage.setItem(OFFICE_KEY, OFFICE_HASH); } catch (_) {} done(); cb(); } else { err.textContent = "密碼不正確"; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); inp.select(); } });
      setTimeout(() => inp.focus(), 30);
    },
  };
  const AERIS_HASH = "d0f5fe6b15cee2b54a6a8acb222a35cea48bb69171af2ff42d4049bd067fc1f8";                     // Aeris 玩家密碼（不分大小寫，只存雜湊）
  const AERIS_ALT = ["d66a93cd9ae701f79c00514fff5ac6846623e5b61c3113b0a1482369b4861a6c"];                    // 常見的另一種拼法                     // 朋友用的密碼（Aeris 玩家模式），只存雜湊
  const GUEST_HASH = "84983c60f7daadc1cb8698621f802c0d9f9a3c3c295c810748fb048115c186ec";   // 訪客密碼 guest（不分大小寫，只存雜湊）：只能在二樓房間走動，看不到屋外，不能進辦公室 / 白板 / NEWS
  const LYJ_HASH = "de6d23fe62808d9e7e3e324d94db6cffefba6994f935aa630c0826801d6f8f6d";   // 訪客「林晏如」的密碼 LYJ（不分大小寫，只存雜湊）；登入後歡迎詞顯示她的名字
  const HOUSE_HASH = "36b940ab36b32cd70ef1d0922cff8233bff581f67d7b9a00658df21a35b30d00";   // 訪客「guest-house」密碼（不分大小寫，只存雜湊）：只能在 3D 二樓房間走動
  const GALLERY_HASH = "549fdf0c2549bbdefb86167a8a822ec88fc03bd4caedb060b62a2050bf71636a";   // 訪客「guest-gallery」密碼（不分大小寫，只存雜湊）：可逛 3D 藝廊，但沒有機器人 / AI 總管 / 專案進度 / 辦公室 / NEWS
  const GUEST_ALT = [LYJ_HASH, HOUSE_HASH];
  const AGENT_HASH = "3cce5ca57826b4509c7d1ffea69aaa803428a73c7838065a249c9c44f3d0e89e";   // 房仲 David 的密碼 guest-agent（只存雜湊）：跟訪客同一個二樓空間；沒人登入時，房仲 David 站在門口講解
  const VIEWER_HASH = "";   // （唯讀客人模式已停用：david-guest 改為一般訪客，專案進度 / AI / 機器人只有 admin 能用）   // 客人（唯讀）密碼 david-guest（不分大小寫，只存雜湊）：只能看辦公室儀表板 / 專案進度表 / 進度總覽 / 專案頁，不能改任何資料、沒有 AI 總管 / NEWS / 3D 藝廊
  window.PERSONA = "david"; window.GUESTLIKE = false; window.VIEWER = false; window.GALLERYGUEST = false;
  const setGallery = () => { window.PERSONA = "gallery"; window.GALLERYGUEST = true; window.GUESTLIKE = false; window.GUEST_NAME = "訪客"; };
  const setViewer = () => { window.PERSONA = "viewer"; window.VIEWER = true; window.GUESTLIKE = false; document.body.classList.add("viewer"); };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- SHA-256（crypto.subtle 不可用時的備援） ---------- */
  function sha256Fallback(bytes) {
    const K = [], H = [];
    for (let p = 2, n = 0; n < 64; p++) {
      let prime = true;
      for (let i = 2; i * i <= p; i++) if (p % i === 0) { prime = false; break; }
      if (!prime) continue;
      if (n < 8) H[n] = (Math.pow(p, 1 / 2) % 1 * 4294967296) | 0;
      K[n++] = (Math.pow(p, 1 / 3) % 1 * 4294967296) | 0;
    }
    const l = bytes.length, total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, (l * 8) >>> 0);
    dv.setUint32(total - 8, Math.floor(l * 8 / 4294967296));
    let h = H.slice(); const w = new Int32Array(64);
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0, h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(bytes);
  }

  /* ---------- 資料 ---------- */
  /* TPI「最近新增」：新的在上，滑過去展開，可往下捲看更早的；時間到分鐘 */
  const pad2 = (n) => String(n).padStart(2, "0");
  const stamp = (ms, dateOnly) => { const d = new Date(ms); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` + (dateOnly ? "" : ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}`); };
  const feedHtml = (p) => {
    const it = [];
    ((window.Store && window.Store.acts && window.Store.acts(p.id)) || []).forEach((a) => it.push({ at: a.at, text: a.text }));
    (p.updates || []).forEach((u) => { if (/專案頁建立|辦公室建立/.test(u.title || "")) return; const at = u.at || new Date((u.date || "1970-01-01") + "T00:00:00").getTime(); if (!u.local || !u.at) it.push({ at, day: !u.at, text: (u.title || "") + (u.text && u.text !== u.title ? "：" + u.text : "") }); });
    (p.tasks || []).forEach((t) => (t.log || []).forEach((l) => { if (!l.at) it.push({ at: new Date((l.d || "1970-01-01") + "T00:00:00").getTime(), day: true, text: `${t.name}：${l.k || "狀態"} ${l.text}` }); }));
    it.sort((a, b) => b.at - a.at);
    const last = it[0];
    return `<div class="tz-feed" tabindex="0"><div class="tf-bar"><b>最近新增</b><span class="tf-last">${last ? esc(stamp(last.at, last.day)) + " · " + esc(last.text) : "還沒有新增事件"}</span><i>${it.length} 筆 ▾</i></div>${it.length ? `<ul class="tf-list">${it.map((x) => `<li><time>${esc(stamp(x.at, x.day))}</time><span>${esc(x.text)}</span></li>`).join("")}</ul>` : ""}</div>`;
  };

  const P = window.PROJECTS || [];
  const S = window.STATUS || {};
  const SITE = window.SITE || {};
  const HUES = [338, 24, 262, 198, 150, 12, 290, 44, 220, 170];
  const hue = (i) => HUES[i % HUES.length];
  const grad = (i) => {
    const h = hue(i);
    return `radial-gradient(120% 90% at 85% 10%, hsl(${h} 90% 72%) 0, transparent 55%),` +
           `linear-gradient(160deg, hsl(${(h + 30) % 360} 70% 45%), hsl(${(h + 250) % 360} 55% 22%))`;
  };
  const accent = (i) => `hsl(${hue(i)} 90% 72%)`;
  const initial = (p) => esc((p.name.match(/[A-Za-z0-9一-龥]/) || ["•"])[0].toUpperCase());
  const st = (p) => S[p.status] || { label: p.status, color: "#aaa" };
  const latest = (p) => (p.updates && p.updates[0]) || null;
  const fmt = (d) => String(d || "").replace(/-/g, ".");

  /* ---------- Mega menu ---------- */
  function buildMega() {
    const PS = P.filter((p) => p.category !== "Work"), tpi = P.find((p) => p.id === "tpi");
    const item = (p) => `
      <a class="mega-item" role="menuitem" href="#/p/${esc(p.id)}" style="--c:${accent(P.indexOf(p))}">
        <span class="mega-name">${esc(p.name)}</span>
        <span class="mega-meta"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)}</span>
        <span class="mega-pg" title="完成度 ${p.progress ?? 0}%"><i style="width:${p.progress ?? 0}%"></i><b>${p.progress ?? 0}%</b></span>
      </a>`;
    const grids = {
      gallery: PS.map(item).join(""),
      tpi: tpi ? `<a class="mega-item mega-wide" role="menuitem" href="#/office" data-mego="tpi" style="--c:${accent(P.indexOf(tpi))}"><span class="mega-name">TPI 工作區</span><span class="mega-meta">專案進度 + 專屬 AI</span><span class="mega-pg"><b>進入 →</b></span></a>` + (tpi.next ? `<p class="mega-note"><b>NEXT</b>${esc(tpi.next)}</p>` : "") : "",
    };
    const heads = { gallery: `${PS.length} 個正在長大的夢`, tpi: "TPI · 本業工作" };
    const grid = $("#megaGrid"), h3 = $(".mega-intro h3");
    const show = (k) => { grid.innerHTML = grids[k] || grids.gallery; if (h3) h3.textContent = heads[k] || heads.gallery; $$("[data-mo]", $("#mega")).forEach((b) => b.classList.toggle("on", b.dataset.mo === k)); };
    const go = (k) => { officeTab = k; if (location.hash === "#/office") render(); else location.hash = "#/office"; };
    $$("[data-mo]", $("#mega")).forEach((b) => { if (b.__mo) return; b.__mo = true; b.addEventListener("mouseenter", () => show(b.dataset.mo)); b.addEventListener("focus", () => show(b.dataset.mo)); b.addEventListener("click", () => go(b.dataset.mo)); });
    if (!grid.__mg) { grid.__mg = true; grid.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("[data-mego]"); if (a) { e.preventDefault(); go(a.dataset.mego); } }); }
    show(tpi ? "tpi" : "gallery");
    if (window.Schedule && window.Schedule.attachTip) window.Schedule.attachTip($("#megaGrid"), ".mega-item[href^='#/p/']", (el) => { const id = decodeURIComponent((el.getAttribute("href") || "").replace("#/p/", "")); return P.find((x) => x.id === id); }, (p) => accent(P.indexOf(p)));   // 選單裡滑過專案 → 浮出它自己的進度表
  }

  const nav = $("#nav"), mega = $("#mega"), scrim = $("#megaScrim"), trig = $("#megaTrigger"), megaLink = $("#megaLink");
  let megaTimer;
  const openMega = () => {
    if (window.innerWidth <= 960) return;
    clearTimeout(megaTimer);
    mega.classList.add("open"); scrim.classList.add("on"); nav.classList.add("mega-open"); trig.classList.add("hot");
    megaLink.setAttribute("aria-expanded", "true");
  };
  const closeMega = (delay = 160) => {
    clearTimeout(megaTimer);
    megaTimer = setTimeout(() => {
      mega.classList.remove("open"); scrim.classList.remove("on"); nav.classList.remove("mega-open"); trig.classList.remove("hot");
      megaLink.setAttribute("aria-expanded", "false");
    }, delay);
  };
  [trig, mega].forEach((el) => { el.addEventListener("mouseenter", openMega); el.addEventListener("mouseleave", () => closeMega()); });
  trig.addEventListener("focusin", openMega);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (window.News && window.News.isOpen()) { window.News.close(); return; }
    if (window.Gallery3D && window.Gallery3D.closeOverlay()) return;   // 先關白板
    if (window.Director && window.Director.dismiss()) return;           // 再關館長對話
    if (window.Aeris && window.Aeris.dismiss()) return;              // 再關 Aeris 聊天
    if (window.Gallery3D && window.Gallery3D.active && window.Gallery3D.exitRoom()) return; // 在房間裡 → 走出門
    closeMega(0);
    if (!document.body.classList.contains("locked") && location.hash.replace(/^#\/?/, "")) location.hash = "#/";
  });
  mega.addEventListener("click", (e) => { if (e.target.closest("a")) closeMega(0); });

  // 雙擊「← / A」＝退出一層（所有地方通用）。藝廊內的白板 / 房間由 gallery3d 自己處理。
  let lastDownApp = 0;
  document.addEventListener("keydown", (e) => {
    if (e.repeat || (e.code !== "ArrowLeft" && e.code !== "KeyA") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.body.classList.contains("locked")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
    const n = performance.now(), second = n - lastDownApp < 350; lastDownApp = n;
    if (!second) return;
    let acted = false;
    if (window.News && window.News.isOpen()) { window.News.close(); acted = true; }
    else if (location.hash.replace(/^#\/?/, "")) { location.hash = "#/"; acted = true; }   // 專案頁 / 辦公室 / 總覽 / 動態 → 回藝廊
    if (acted) { lastDownApp = 0; e.preventDefault(); e.__dsbHandled = true; }
  });

  $("#burger").addEventListener("click", () => {
    const on = nav.classList.toggle("menu-open");
    $("#burger").setAttribute("aria-expanded", String(on));
  });
  $(".nav-links").addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("menu-open"); $("#burger").setAttribute("aria-expanded", "false"); } });

  /* ---------- 畫作視差 ---------- */
  const layers = $$("#painting .layer");
  window.addEventListener("pointermove", (e) => {
    if (document.body.classList.contains("dim") || (window.Gallery && window.Gallery.active) || (window.Gallery3D && window.Gallery3D.active)) return;
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    layers.forEach((l) => {
      const d = +l.dataset.depth || 0;
      l.style.transform = `translate(${(-x * d * 1.6).toFixed(1)}px, ${(-y * d * 0.8).toFixed(1)}px)`;
    });
  }, { passive: true });

  /* ---------- 畫面 ---------- */
  const app = $("#app");

  function card(p, i) {
    const l = latest(p);
    return `
      <a class="card" href="#/p/${esc(p.id)}" style="--g:${grad(i)}">
        <span class="cat">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <span class="zh">${esc(p.zh)}</span>
        <p class="sum">${esc(l ? l.title : p.summary)}${l ? `<br><small style="opacity:.7">${fmt(l.date)}</small>` : ""}</p>
        <div class="foot">
          <span class="status"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)}<span class="pct">${p.progress ?? 0}%</span></span>
          <div class="bar"><i data-w="${p.progress ?? 0}"></i></div>
        </div>
      </a>`;
  }

  const views = {
    home() {
      return `<section class="gallery" id="gallery" aria-label="藝廊：用左右鍵走路"></section>`;
    },


    office() {
      if (!officeOpen() && !window.VIEWER) return `
        <section class="page office office-locked">
          <a class="back-btn" href="#/" data-office-back>← 返回藝廊 <kbd>Esc</kbd></a>
          <form class="office-gate" id="officeGate" autocomplete="off">
            <p class="eyebrow">OFFICE</p>
            <h1>辦公室</h1>
            <p>這裡有全部專案的儀表板和 AI 總管，請輸入辦公室密碼。</p>
            <input type="password" id="officePw" placeholder="辦公室密碼" autocomplete="off" aria-label="辦公室密碼">
            <button type="submit">進入辦公室</button>
            ${window.FaceLogin && window.FaceLogin.enrolled() ? `<button type="button" id="officeFace" class="og-face">👤 人臉進入</button>` : window.PERSONA === "david" ? `<button type="button" id="officeFaceSet" class="og-face">👤 設定人臉解鎖（用電腦鏡頭）</button>` : ""}
            <p class="og-err" id="officeErr" role="alert"></p>
          </form>
        </section>`;
      const PS = P.filter((p) => p.category !== "Work");   // Side Business 儀表板不含 TPI（本業，另外獨立一塊）
      const tpi = P.find((p) => p.id === "tpi");
      const n = PS.length || 1;
      const avg = Math.round(PS.reduce((a, p) => a + (p.progress || 0), 0) / n);
      const by = (k) => PS.filter((p) => p.status === k);
      const allUps = P.flatMap((p, i) => (p.updates || []).map((u) => ({ ...u, p, i })))
                      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
      const R = 34, C = 2 * Math.PI * R;
      const gauge = (p, i) => `
        <a class="gauge" href="#/p/${esc(p.id)}" style="--c:${accent(i)}">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="${R}" class="g-track"/>
            <circle cx="40" cy="40" r="${R}" class="g-ring" data-ring="${p.progress ?? 0}" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${C.toFixed(2)}"/>
          </svg>
          <b class="g-pct">${p.progress ?? 0}<small>%</small></b>
          <span class="g-name">${esc(p.name)}</span>
          <span class="g-meta"><i class="led" style="background:${st(p).color};color:${st(p).color}"></i>${esc(st(p).label)}</span>
          <span class="g-last">${esc((latest(p) || {}).title || "—")}</span>
        </a>`;
      const permHtml = () => {
        const Y = '<b class="pm-y">✓</b>', N = '<span class="pm-n">✕</span>', R = '<span class="pm-r">唯讀</span>';
        const rows = [
          ["David（ADMIN）", "本人", Y, Y, Y, Y, Y, "全部功能；辦公室需再輸入辦公室密碼"],
          ["ARIES（朋友）", "Aeris 玩家模式", Y, N, N, N, N, "粉色角色；可逛 3D 藝廊與家；不能進辦公室、用機器人 / AI 總管（辦公室密碼不對她開放）"],
          ["訪客・藝廊（guest-gallery）", "訪客", Y, N, N, N, N, "可以逛 3D 藝廊與各專案房間；沒有機器人 / AI 總管 / 專案進度 / 辦公室 / NEWS"],
          ["訪客・房間（guest-house）", "林晏如等", N, N, N, N, N, "只能在 3D 二樓房間走動，屋外全黑；進不了辦公室、白板、NEWS"],
          ["房仲（AGENT）", "David（房仲）", N, N, N, N, N, "跟訪客同一個二樓空間；站在門口講解；穿紫色禮賓員制服"],
        ];
        return `<div class="sch-scroll"><table class="sch-t pm-t"><thead><tr><th>角色</th><th>對象</th><th>3D 藝廊</th><th>進度總覽 / 專案頁</th><th>辦公室儀表板</th><th>專案進度表</th><th>改資料 / AI 總管 / NEWS</th><th>說明</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="nm">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td></tr>`).join("")}</tbody></table></div><p class="sch-empty">密碼不顯示在這裡（網站只存雜湊）。機器人、AI 總管、專案進度（白板 / 時程 / 進度總覽）只有 admin（David）能用；訪客、房仲都只進得了 3D 二樓房間。</p>`;
      };
      const cols = ["backlog", "idea", "building", "live", "paused"];
      // 儀表板整合看板：每個類型條列式，每個專案一行「一句話目前狀態」；右邊的 ✎ 滑鼠移過去會向左展開，直接填更新。
      // 第 1 頁 = ON-PROCESS + TODO；第 2 頁 = Backlog + 其他（PENDING / BLOCK / FINISH）
      const eff = (p) => p.wbStatus || ({ building: "ON PROCESS", idea: "TODO", live: "FINISH", paused: "PENDING", backlog: "BACKLOG" }[p.status] || "TODO");   // 白板有填就用白板的狀態，沒填就由專案狀態換算
      const CLS = { TODO: "TODO", PENDING: "PENDING", BLOCK: "BLOCK", "ON PROCESS": "ON-PROCESS", FINISH: "FINISH", BACKLOG: "BACKLOG" };
      const chip = (e) => `<span class="ps-chip ps-${CLS[e] || "TODO"}">${esc(e === "ON PROCESS" ? "ON-PROCESS" : e)}</span>`;
      const bucket = (p) => { const e = eff(p); return e === "ON PROCESS" ? "proc" : e === "TODO" ? "todo" : e === "BACKLOG" ? "back" : "other"; };
      const inB = (b) => PS.filter((p) => bucket(p) === b);
      const OPTS = ["TODO", "ON PROCESS", "PENDING", "BLOCK", "FINISH"];
      const lastReal = (p) => (p.updates || []).find((u) => !/專案頁建立/.test(u.title));   // 最近一筆真正的更新（略過自動建立的那筆）
      // 沒有進度一句話時，至少顯示目標（AI 總管只設目標時，這列才不會看起來「沒改」）
      const row = (p, showChip) => { const u = lastReal(p), txt = p.wbNote || (u ? u.title : "") || (p.goal && window.PERSONA !== "aeris" ? "🎯 目標：" + p.goal : ""), when = p.wbNote ? p.wbNoteAt : (u ? u.date : ""), isNew = !!(u && window.News && window.News.isUnread && window.News.isUnread(p, u)); return `
        <li class="kb-row" data-pid="${esc(p.id)}" style="--c:${accent(P.indexOf(p))}">
          <a class="kb-name" href="#/p/${esc(p.id)}">${esc(p.name)}</a>${showChip ? chip(eff(p)) : ""}
          <span class="kb-now ${txt ? "" : "none"}" title="${esc(txt)}">${esc(txt || "（還沒有更新）")}</span>${isNew ? `<em class="kb-new">NEW</em>` : ""}${when ? `<time class="kb-t">${esc(String(when).slice(5).replace("-", "."))}</time>` : ""}
          <span class="kb-pg" title="完成度 ${p.progress ?? 0}%"><i style="width:${p.progress ?? 0}%"></i><b>${p.progress ?? 0}%</b></span>
        </li>`; };
      const sect = (title, dot, list, showChip) => `
        <section class="kb-sec">
          <h3><i class="pill-dot" style="background:${dot}"></i>${title}<span>${list.length}</span></h3>
          <ul class="kb-list">${list.map((p) => row(p, showChip)).join("") || `<li class="kb-empty">—</li>`}</ul>
        </section>`;
      const board = `
        <div class="kb">
          <div class="wb-pager" role="tablist">
            <button type="button" data-wbp="0" class="${wbPage === 0 ? "on" : ""}" role="tab">1 · 進行中 / 待辦</button>
            <button type="button" data-wbp="1" class="${wbPage === 1 ? "on" : ""}" role="tab">2 · Backlog</button>
            <button type="button" data-wbp="2" class="${wbPage === 2 ? "on" : ""}" role="tab">3 · 專案進度表</button>
            ${window.VIEWER ? "" : `<button type="button" data-wbp="3" class="${wbPage === 3 ? "on" : ""}" role="tab">4 · 帳號權限</button>`}
          </div>
          <div class="wb-page" data-wbpage="0" ${wbPage === 0 ? "" : "hidden"}>
            ${sect("ON-PROCESS", "#2f7be0", inB("proc"))}
            ${sect("TODO", "#9a9aae", inB("todo"))}
          </div>
          <div class="wb-page" data-wbpage="1" ${wbPage === 1 ? "" : "hidden"}>
            ${sect("Backlog", S.backlog ? S.backlog.color : "#7fb4ff", inB("back"))}
            ${sect("其他", "#9aa3b2", inB("other"), true)}
          </div>
          <div class="wb-page" data-wbpage="2" ${wbPage === 2 ? "" : "hidden"}>
            <section class="office-sched" aria-label="時程表">${window.Schedule ? window.Schedule.officeHtml(PS, accent) : ""}</section>
          </div>
          ${window.VIEWER ? "" : `<div class="wb-page" data-wbpage="3" ${wbPage === 3 ? "" : "hidden"}>${permHtml()}</div>`}
        </div>`;
      const seg = cols.map((k) => `<i style="flex:${by(k).length};background:${S[k].color}" title="${esc(S[k].label)} ${by(k).length}"></i>`).join("");
      return `
        <section class="page office">
          <a class="back-btn" href="#/" data-office-back>← 返回藝廊 <kbd>Esc</kbd></a>
          <div class="page-head">
            <h1>OFFICE</h1>
            <p class="office-sub">TPI &amp; SIDE-BUSINESS</p>
          </div>
          ${tpi ? `<div class="ot-switch" role="tablist" aria-label="辦公室類型">
            <button type="button" role="tab" data-otb="tpi" class="${officeTab === "tpi" ? "on" : ""}">TPI<small>本業工作區</small></button>
            <button type="button" role="tab" data-otb="gallery" class="${officeTab === "gallery" ? "on" : ""}">Gallery<small>Side Business</small></button>
          </div>` : ""}
          <div class="office-room" data-ot="gallery" ${tpi && officeTab === "tpi" ? "hidden" : ""}>

            <div class="monitor">
              <div class="bezel">
                <div class="mon-top"><span><i class="led on"></i> SIDE BUSINESS 儀表板</span><time id="clock"></time></div>
                <div class="kpis">
                  <div><b>${PS.length}</b><span>專案</span></div>
                  <div><b>${by("live").length}</b><span>已上線</span></div>
                  <div><b>${by("building").length}</b><span>進行中</span></div>
                  <div><b>${by("idea").length}</b><span>發想中</span></div>
                  <div><b>${avg}<small>%</small></b><span>平均進度</span></div>
                </div>
                ${board}
                <div class="energy"><span>整體分布</span><div class="seg">${seg}</div></div>
              </div>
              <div class="stand"></div>
              <div class="desk">
                <svg class="mug" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 12h20v14a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="#f6f1ff"/><path d="M28 16h3a4 4 0 0 1 0 8h-3" fill="none" stroke="#f6f1ff" stroke-width="3"/><path class="steam" d="M14 8q2-3 0-6M20 8q2-3 0-6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/></svg>
                <span class="keyboard"></span>
                <svg class="plant" viewBox="0 0 40 50" aria-hidden="true"><path d="M20 30C8 28 6 14 8 6c10 2 14 10 12 24zM20 30c12-2 14-16 12-24-10 2-14 10-12 24z" fill="#6be3a4"/><path d="M10 32h20l-3 16H13z" fill="#ff9b78"/></svg>
              </div>
            </div>

          </div>
          ${tpi ? `<section class="tpi-zone" id="tpiZone" data-ot="tpi" ${officeTab === "tpi" ? "" : "hidden"} style="--c:${accent(P.indexOf(tpi))}">
            <div class="tz-head"><p class="eyebrow">TPI · 本業</p><h2>TPI 工作區</h2><span>獨立於 Side Business：專案進度 + 專屬 AI</span></div>
            <div class="tz-grid">
              <div class="tz-prog">
                ${feedHtml(tpi)}
                <div class="plan-mount" data-tpi-plan>${window.Schedule ? window.Schedule.panel(tpi) : ""}</div>
              </div>
              <div class="tz-ai"><h3>🤖 TPI 專屬 AI</h3><div id="tpiAI"></div></div>
            </div>
          </section>` : ""}
        </section>`;
    },

    overview() {
      const avg = P.length ? Math.round(P.reduce((a, p) => a + (p.progress || 0), 0) / P.length) : 0;
      const live = P.filter((p) => p.status === "live").length;
      const building = P.filter((p) => p.status === "building").length;
      return `
        <section class="page">
          <div class="page-head">
            <p class="eyebrow">OVERVIEW</p>
            <h1>Side Business 總覽</h1>
            <p>所有專案的狀態與進度，一眼看完。</p>
            <div class="stats">
              <div class="stat"><b>${P.length}</b><span>個專案</span></div>
              <div class="stat"><b>${live}</b><span>已上線</span></div>
              <div class="stat"><b>${building}</b><span>進行中</span></div>
              <div class="stat"><b>${avg}%</b><span>平均進度</span></div>
            </div>
          </div>
          <div class="cards">${P.map(card).join("")}</div>
        </section>`;
    },

    updates() {
      const all = P.flatMap((p, i) => (p.updates || []).map((u) => ({ ...u, p, i })))
                   .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const list = (L) => L.length ? `<ul class="timeline" style="--c:#ffb28a">${L.map((u) => `
              <li style="--c:${accent(u.i)}">
                <time>${fmt(u.date)}</time>
                <h4><a href="#/p/${esc(u.p.id)}">${esc(u.title)}</a><span class="tag">${esc(u.p.name)}</span></h4>
                <p>${esc(u.text)}</p>
              </li>`).join("")}</ul>` : `<p class="empty">還沒有任何紀錄。</p>`;
      const gal = all.filter((u) => u.p.category !== "Work"), tp = all.filter((u) => u.p.category === "Work");
      return `
        <section class="page">
          <div class="page-head">
            <p class="eyebrow">UPDATES</p>
            <h1>最新動態</h1>
            <p>藝廊（Side Business）與 TPI 的進度紀錄，依日期排列。</p>
          </div>
          <div class="ot-switch" role="tablist" aria-label="動態類型">
            <button type="button" role="tab" data-upb="gallery" class="${updTab === "gallery" ? "on" : ""}">藝廊<small>${gal.length} 則</small></button>
            <button type="button" role="tab" data-upb="tpi" class="${updTab === "tpi" ? "on" : ""}">TPI<small>${tp.length} 則</small></button>
          </div>
          <div class="panel" data-up="gallery" ${updTab === "gallery" ? "" : "hidden"}>${list(gal)}</div>
          <div class="panel" data-up="tpi" ${updTab === "tpi" ? "" : "hidden"}>${list(tp)}</div>
        </section>`;
    },

    project(id) {
      const i = P.findIndex((p) => p.id === id);
      if (i < 0) return `<section class="page"><div class="page-head"><h1>找不到這個專案</h1><p><a href="#/office" style="color:var(--accent)">← 回到總覽</a></p></div></section>`;
      const p = P[i], prev = P[(i - 1 + P.length) % P.length], next = P[(i + 1) % P.length], c = accent(i);
      const ups = p.updates || [];
      return `
        <section class="page" style="--c:${c}">
          <div class="proj-hero" style="--g:${grad(i)}">
            <div class="crumb">
              <a class="back-btn" href="#/" id="backBtn">← 返回藝廊 <kbd>Esc</kbd></a><br>
              <a href="#/office">Side Business</a> / ${esc(p.category)}
            </div>
            <h1>${esc(p.name)}</h1>
            <p class="zh">${esc(p.zh)}</p>
          </div>
          <div class="proj-grid">
            <div class="jmount" data-jmount="${esc(p.id)}"></div>
            ${p.id === "tpi" ? "" : `<aside class="panel side">
              <h2>專案資訊</h2>
              <div class="row"><span>狀態</span><span class="status"><i class="pill-dot" style="background:${st(p).color}"></i>${esc(st(p).label)}</span></div>
              <div class="row"><span>類別</span><span>${esc(p.category)}</span></div>
              <div class="row"><span>進度</span><span>${p.progress ?? 0}%</span></div>
              <div class="bar"><i data-w="${p.progress ?? 0}"></i></div>
              ${p.summary ? `<p style="margin-top:20px;color:var(--ink-2);font-size:14px">${esc(p.summary)}</p>` : ""}
              ${(p.links || []).length ? `<div class="links">${p.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.label)}</span><span>↗</span></a>`).join("")}</div>` : ""}
            </aside>`}
          </div>
          <nav class="pager" aria-label="上下一個專案">
            <a href="#/p/${esc(prev.id)}"><small>← 上一個</small>${esc(prev.name)}</a>
            <a href="#/p/${esc(next.id)}"><small>下一個 →</small>${esc(next.name)}</a>
          </nav>
        </section>`;
    },
  };

  let clockTimer;
  // 瀏覽器分頁標題前面標上帳號類型：ADMIN（David）/ GUEST（訪客）/ ARIES，開多個分頁時一眼分得出來
  const acctTag = () => ({ david: "[ADMIN] ", guest: "[GUEST] ", gallery: "[GALLERY] ", agent: "[AGENT] ", aeris: "[ARIES] " }[window.PERSONA] || "");
  function render() {
    let hash = window.GUESTLIKE || window.GALLERYGUEST || (window.PERSONA === "aeris" && /^#?\/?office/.test(location.hash)) ? "" : location.hash.replace(/^#\/?/, "");
    if (window.VIEWER && !/^(overview|office|p\/)/.test(hash)) { hash = "overview"; if (location.hash !== "#/overview") history.replaceState(null, "", "#/overview"); }   // 客人：沒有 3D 藝廊 / 最新動態，一律回進度總覽   // 訪客永遠只看得到 3D 房子
    const [seg, arg] = hash.split("/");
    if (window.Gallery) window.Gallery.unmount();
    if (window.Gallery3D) window.Gallery3D.unmount();
    clearInterval(clockTimer);
    let html, home = false;
    if (!seg) { html = views.home(); home = true; }
    else if (seg === "overview") { location.replace("#/office"); return; }   // 進度總覽已移除：舊連結導去辦公室
    else if (seg === "updates") html = views.updates();
    else if (seg === "office") html = views.office();
    else if (seg === "p") html = views.project(decodeURIComponent(arg || ""));
    else { html = views.home(); home = true; }

    document.body.classList.toggle("dim", !home);
    if (home) layers.forEach((l) => (l.style.transform = ""));
    app.innerHTML = html + `<footer class="foot-note">© ${new Date().getFullYear()} David's Side Business</footer>`;
    const GH = { hue, st, esc, go: (id) => { if (!window.GALLERYGUEST) location.hash = "#/p/" + id; }, office: () => { if (!window.GALLERYGUEST && window.PERSONA !== "aeris") location.hash = "#/office"; }, unread: (pid) => (window.News ? window.News.unreadCount(pid) : 0) };
    if (home) {
      let ok = false;
      if (window.Gallery3D && window.Gallery3D.supported()) { try { ok = window.Gallery3D.mount($("#gallery"), P, GH); } catch (err) { console.error("3D 藝廊失敗，改用 2D：", err); window.Gallery3D.unmount(); } }
      if (!ok && window.Gallery) window.Gallery.mount($("#gallery"), P, GH);
    }
    const lastId = seg === "p" ? arg : seg === "office" ? "__office" : null;
    if (lastId) { if (window.Gallery) window.Gallery.lastId = lastId; if (window.Gallery3D) window.Gallery3D.lastId = lastId; }
    if (seg === "p" && window.Journal) {
      const jm = $("[data-jmount]", app), pi = P.findIndex((x) => x.id === arg);
      if (jm && pi >= 0) { jm.innerHTML = window.Journal.card(P[pi], pi, GH, { page: true }); window.Journal.bind(jm, P[pi], pi, GH, { rerender: () => { const y = scrollY; render(); scrollTo(0, y); } }); }
    }
    if (seg === "updates") { const sw = (k) => { updTab = k; $$("[data-upb]", app).forEach((x) => x.classList.toggle("on", x.dataset.upb === k)); $$("[data-up]", app).forEach((x) => (x.hidden = x.dataset.up !== k)); };   // 動態也分藝廊 / TPI：滑過去就切換
      $$("[data-upb]", app).forEach((b) => { b.addEventListener("mouseenter", () => sw(b.dataset.upb)); b.addEventListener("click", () => sw(b.dataset.upb)); b.addEventListener("focus", () => sw(b.dataset.upb)); }); }
    if (window.VIEWER && seg === "p") $$("[data-jmount] form, [data-jmount] button:not([data-tab]), [data-jmount] textarea, [data-jmount] select, [data-jmount] input", app).forEach((e) => { if (!e.closest(".sch-scroll")) e.hidden = true; });   // 客人唯讀：專案頁的編輯控制全部藏起來（資料層本來就擋寫入）
    if (seg === "office" && !officeOpen() && !window.VIEWER) {
      const f = $("#officeGate", app), pw = $("#officePw", app); setTimeout(() => pw && pw.focus(), 50);
      { const fs = $("#officeFaceSet", app); if (fs) fs.addEventListener("click", () => window.__faceEnroll && window.__faceEnroll()); }
      { const fb = $("#officeFace", app), F = window.FaceLogin;
        const faceOffice = async () => { const c = await F.scan(); if (!c) return; if (!c.op) { $("#officeErr", app).textContent = "這個人臉登錄還沒有辦公室密碼，請到「其他 → 人臉登錄」重新登錄"; return; }
          if (await sha256(c.op) === OFFICE_HASH) { try { sessionStorage.setItem(OFFICE_KEY, OFFICE_HASH); } catch (_) {} if (c.tp && window.TpiVault) await window.TpiVault.unlock(c.tp, c.tk); if (window.Store) window.Store.init(P); render(); } else $("#officeErr", app).textContent = "辦公室密碼已變更，請重新登錄人臉"; };
        if (fb && F) { fb.addEventListener("click", faceOffice); if (F.hasOffice() && !window.__officeFaceTried) { window.__officeFaceTried = true; setTimeout(faceOffice, 300); } } }
      if (f) f.addEventListener("submit", async (e) => {
        e.preventDefault(); const v = pw.value.trim(); if (!v) return;
        if (await sha256(v) === OFFICE_HASH) { try { sessionStorage.setItem(OFFICE_KEY, OFFICE_HASH); } catch (_) {} render(); }
        else { $("#officeErr", app).textContent = "密碼不正確"; f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); pw.select(); }
      });
    } else if (seg === "office") {
      $$("[data-wbp]", app).forEach((b) => b.addEventListener("click", () => { wbPage = +b.dataset.wbp; $$("[data-wbp]", app).forEach((x) => x.classList.toggle("on", x === b)); $$("[data-wbpage]", app).forEach((x) => (x.hidden = +x.dataset.wbpage !== wbPage)); }));
      // ✎ 更新：滑鼠移過去自動向左展開；觸控裝置點一下展開 / 收合
      $$(".kb-btn", app).forEach((b) => b.addEventListener("click", () => { const r = b.closest(".kb-row"), was = r.classList.contains("open"); $$(".kb-row.open", app).forEach((x) => x.classList.remove("open")); if (!was) { r.classList.add("open"); const f = r.querySelector("input[name=note]"); f && f.focus(); } }));
      $$(".kb-form", app).forEach((f) => f.addEventListener("submit", (ev) => {
        ev.preventDefault(); const pid = f.closest(".kb-row").dataset.pid, p = P.find((x) => x.id === pid), S2 = window.Store; if (!p || !S2) return;
        const fd = new FormData(f), st = String(fd.get("st") || ""), note = String(fd.get("note") || "").trim(), next = String(fd.get("next") || "").trim();
        if (st && st !== p.wbStatus) S2.setStatus(pid, st);
        if (next !== (p.next || "")) S2.setNext(pid, next);
        if (note) S2.setNote(pid, note);
        const y = scrollY; render(); scrollTo(0, y);
      }));
      if (window.Schedule) window.Schedule.bindOffice($(".office-sched", app), P);
      // 上方 Gallery / TPI：滑鼠移過去就切換（也可以點）
      { const sw = (k) => { officeTab = k; $$("[data-otb]", app).forEach((x) => x.classList.toggle("on", x.dataset.otb === k)); $$("[data-ot]", app).forEach((x) => (x.hidden = x.dataset.ot !== k)); };
        $$("[data-otb]", app).forEach((b) => { b.addEventListener("mouseenter", () => sw(b.dataset.otb)); b.addEventListener("click", () => sw(b.dataset.otb)); b.addEventListener("focus", () => sw(b.dataset.otb)); }); }
      { const tz = $(".tz-grid", app), V = window.TpiVault;   // TPI 內容加密：沒解鎖就只顯示輸入密碼的表單
        if (tz && V && V.has && V.locked) { tz.innerHTML = `<form class="tz-lock" autocomplete="off"><h3>🔒 TPI 內容已加密</h3><p>請輸入 TPI 密碼與金鑰（只記在這個分頁，關掉就失效）。</p><input type="password" name="pw" placeholder="TPI 密碼" autocomplete="off"><input type="password" name="key" placeholder="金鑰" autocomplete="off"><button type="submit">解鎖</button><span class="tz-err" hidden>密碼或金鑰不對</span></form>`;
          const f = tz.querySelector("form"); f.addEventListener("submit", async (e) => { e.preventDefault(); const ok = await V.unlock(f.pw.value, f.key.value); if (ok) { if (window.Store) window.Store.init(P); buildMega(); render(); } else f.querySelector(".tz-err").hidden = false; }); } }
      { const tp = P.find((x) => x.id === "tpi"), pm = $("[data-tpi-plan]", app); const LK = window.TpiVault && window.TpiVault.has && window.TpiVault.locked;    // TPI 獨立區：專案進度表（可編輯）+ 專屬 AI
        if (!LK && tp && pm && window.Schedule) { const again = () => { const y = scrollY; render(); scrollTo(0, y); }; window.Schedule.bind(pm, tp, again); }
        const ai = $("#tpiAI", app); if (!LK && tp && ai && window.AIChat) { try { window.AIChat.mount(ai, tp); } catch (e) { ai.textContent = "AI 載入失敗"; } } }
      // 滑鼠移到專案那一列 → 浮出該專案自己的進度表（辦公室儀表板與 AI 總管視窗共用同一個浮窗）
      if (window.Schedule && window.Schedule.attachTip) window.Schedule.attachTip(app, ".kb-row[data-pid]", (row) => P.find((x) => x.id === row.dataset.pid), (p) => accent(P.indexOf(p)));
      // AI 總管不再嵌在辦公室頁下方（David 2026-11-15：辦公室只留更新區）；要聊天點 NEWS 下的聖誕老人或 3D 辦公室的機器人
      const tick = () => { const c = $("#clock"); if (c) c.textContent = new Date().toLocaleTimeString("zh-TW", { hour12: false }); };
      tick(); clockTimer = setInterval(tick, 1000);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => $$("[data-ring]", app).forEach((r) => { const C = parseFloat(r.style.strokeDasharray); r.style.strokeDashoffset = (C * (1 - r.dataset.ring / 100)).toFixed(2); })));
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => $$("[data-w]", app).forEach((b) => (b.style.width = b.dataset.w + "%"))));
    document.title = acctTag() + (seg === "office" ? "辦公室 · " : "") + (seg === "p" && P.find((p) => p.id === arg) ? P.find((p) => p.id === arg).name + " · " : "") + (SITE.name || "David's Side Business");
  }

  /* ---------- 解鎖 / 鎖定 ---------- */
  function enter() {
    document.body.classList.remove("locked");
    nav.hidden = false; app.hidden = false;
    // 「逛藝廊」＝跟任意門一樣：直接跳到美術館入口（原本只是回首頁，沒什麼意義）
    { const gal = nav.querySelector('.nav-link[href="#/"]');
      if (gal && !gal.dataset.toEntry) {
        gal.dataset.toEntry = "1";
        const toEntry = () => { let n = 0; const t = setInterval(() => { const D = window.Gallery3D && window.Gallery3D.active && window.Gallery3D.debug; if (D) { clearInterval(t); try { D.closeBoard && D.closeBoard(); D.exitRoom && D.exitRoom(); D.skipIntro && D.skipIntro(); D.teleport(23.6, 0, 0); } catch (_) {} } else if (++n > 40) clearInterval(t); }, 150); };
        const f5 = nav.querySelector("#navFloor5");   // 「五樓」＝David 的家（原本的一樓）：快捷鍵，直接跳進家裡
        if (f5) f5.addEventListener("click", (e) => { if (window.GUESTLIKE || window.GALLERYGUEST) return; if (/^#?\/?$/.test(location.hash)) e.preventDefault(); let n = 0; const t = setInterval(() => { const D = window.Gallery3D && window.Gallery3D.active && window.Gallery3D.debug; if (D) { clearInterval(t); try { D.closeBoard && D.closeBoard(); D.exitRoom && D.exitRoom(); D.skipIntro && D.skipIntro(); D.teleport(6.0, -2.6, 0); } catch (_) {} } else if (++n > 40) clearInterval(t); }, 150); });
        gal.addEventListener("click", (e) => { if (window.GUESTLIKE || window.GALLERYGUEST) return; if (/^#?\/?$/.test(location.hash)) e.preventDefault(); toEntry(); });
      } }
    if (window.VIEWER) [...nav.querySelectorAll(".nav-links > *")].forEach((el) => { const a = el.matches("a") ? el : null; if (a && /^#\/(updates)?$/.test(a.getAttribute("href") || "")) el.hidden = true; });   // 客人：拿掉「逛藝廊」「最新動態」
    if (window.PERSONA === "aeris") { const ml = $("#megaLink"), mt = $("#megaTrigger"); if (ml) ml.hidden = true; if (mt) mt.hidden = true; }   // ARIES：沒有辦公室入口
    if (window.GUESTLIKE || window.GALLERYGUEST) [...nav.querySelectorAll(".nav-links > *")].forEach((el) => { if (!el.contains($("#lockBtn"))) el.hidden = true; });   // 訪客：選單只留「鎖定」
    { const dv = window.PERSONA === "david"; const fe = $("#faceEnroll"), fn = $("#faceNav"); if (fe) fe.hidden = !dv; if (fn) fn.hidden = !dv;
      let seen = false; try { seen = localStorage.getItem("dsb-face-nudge") === "1"; } catch (_) {}
      if (dv && window.FaceLogin && !window.FaceLogin.enrolled() && !seen && !$("#faceNudge")) { const n = document.createElement("div"); n.id = "faceNudge"; n.innerHTML = `<b>👤 要用電腦鏡頭設定人臉解鎖嗎？</b><span>以後開網站、辦公室和 TPI 都不用輸入密碼。</span><div><button type="button" data-y>設定</button><button type="button" data-n>不用了</button></div>`; document.body.appendChild(n); n.querySelector("[data-y]").onclick = () => { n.remove(); window.__faceEnroll && window.__faceEnroll(); }; n.querySelector("[data-n]").onclick = () => { try { localStorage.setItem("dsb-face-nudge", "1"); } catch (_) {} n.remove(); }; } }
    if (window.Store) window.Store.init(P);
    buildMega();
    if (window.News && !window.GUESTLIKE && !window.GALLERYGUEST) window.News.mount(P, {});
    render();
    if (window.TpiVault) window.TpiVault.ready.then((ok) => { if (ok) { if (window.Store) window.Store.init(P); buildMega(); render(); } });
  }
  function lock() {
    document.title = SITE.name || "David's Side Business";
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); sessionStorage.removeItem(OFFICE_KEY); sessionStorage.removeItem("dsb-tpi"); } catch (_) {}
    location.hash = "";
    if (window.News) window.News.unmount();
    app.hidden = true; nav.hidden = true; app.innerHTML = "";
    document.body.classList.add("locked"); document.body.classList.remove("dim");
    $("#pw").value = ""; $("#gateError").textContent = "";
    setTimeout(() => $("#pw").focus(), 50);
  }

  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#pw").value;
    if (!v) return;
    const hv = await sha256(v.trim()), ha = await sha256(v.trim().toLowerCase());   // Aeris 的密碼不分大小寫
    if (hv === PASS_HASH || ha === AERIS_HASH || AERIS_ALT.includes(ha) || ha === GUEST_HASH || GUEST_ALT.includes(ha) || ha === AGENT_HASH || ha === GALLERY_HASH) {
      window.PERSONA = hv === PASS_HASH ? "david" : ha === GALLERY_HASH ? "gallery" : ha === AGENT_HASH ? "agent" : (ha === GUEST_HASH || GUEST_ALT.includes(ha)) ? "guest" : "aeris";
      window.GUESTLIKE = window.PERSONA === "guest" || window.PERSONA === "agent";
      if (window.PERSONA === "gallery") setGallery();
      if (window.PERSONA === "guest") window.GUEST_NAME = ha === LYJ_HASH ? "林晏如" : "訪客"; else if (window.PERSONA === "agent") window.GUEST_NAME = "David（房仲）";
      try { ($("#remember").checked ? localStorage : sessionStorage).setItem(KEY, window.PERSONA === "aeris" ? AERIS_HASH : window.GUESTLIKE || window.GALLERYGUEST ? ha : PASS_HASH); } catch (_) {}
      { let sw = false; try { sw = sessionStorage.getItem(SW_KEY) === "1"; sessionStorage.removeItem(SW_KEY); } catch (_) {} if (sw) { freshReload(); return; } }
      enter();
    } else {
      $("#gateError").textContent = "密碼不正確，請再試一次";
      const c = $(".gate-card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake");
      $("#pw").select();
    }
  });
  /* ---------- 切換帳號 ---------- */
  // 按「切換帳號」→ 直接回到密碼區（輸入 David / ARIES / guest 任一密碼）；登入成功後用帶時間戳的網址重新載入，確保一定是最新版網站
  const SW_KEY = "dsb-switching", HASHES = { david: PASS_HASH, aeris: AERIS_HASH, guest: GUEST_HASH };
  const freshReload = () => { location.replace(location.pathname + "?r=" + Date.now() + location.hash); };
  $("#switchBtn").addEventListener("click", () => {
    try { sessionStorage.setItem(SW_KEY, "1"); } catch (_) {}
    lock();
    $("#gateError").textContent = "請輸入要切換的帳號密碼";
  });
  $("#lockBtn").addEventListener("click", () => lock());
  window.addEventListener("hashchange", () => { if (!document.body.classList.contains("locked")) render(); });
  // AI 總管直接改了白板資料（狀態 / Next Step / 時程表…）→ 重畫目前頁面，看板與甘特圖立刻反映（3D 藝廊自己會聽 store:change）
  window.addEventListener("ai:applied", () => { if (document.body.classList.contains("locked") || window.Gallery3D && window.Gallery3D.active) return; const y = scrollY; render(); requestAnimationFrame(() => scrollTo(0, y)); });

  /* ---------- 人臉解鎖（方便功能；詳見 js/face.js）---------- */
  const faceGo = async () => { const F = window.FaceLogin; if (!F || !F.enrolled()) return; const c = await F.scan(); if (!c) return; if (c.tp && window.TpiVault) await window.TpiVault.unlock(c.tp, c.tk); if (c.op && await sha256(c.op) === OFFICE_HASH) { try { sessionStorage.setItem(OFFICE_KEY, OFFICE_HASH); } catch (_) {} } $("#pw").value = c.pw; $("#gateForm").requestSubmit(); };
  { const F = window.FaceLogin, row = $("#gateForm");
    if (F && row && !$("#faceBtn")) { const b = document.createElement("button"); b.type = "button"; b.id = "faceBtn"; b.className = "face-btn"; b.textContent = "👤 人臉解鎖"; b.hidden = !F.enrolled(); row.after(b); b.addEventListener("click", faceGo); } }
  const faceEnroll = () => { if (window.PERSONA !== "david" || !window.FaceLogin) return; return window.FaceLogin.enroll({ verify: async (pw, tp, tk, op) => { if (!pw || await sha256(pw) !== PASS_HASH) return "網站密碼不對"; if (!op || await sha256(op) !== OFFICE_HASH) return "辦公室密碼不對"; if (tp || tk) { if (!(window.TpiVault && await window.TpiVault.unlock(tp, tk))) return "TPI 密碼或金鑰不對"; } return ""; } }).then(() => { const b = $("#faceBtn"); if (b) b.hidden = !window.FaceLogin.enrolled(); const n = $("#faceNudge"); if (n) n.remove(); }); };
  window.__faceEnroll = faceEnroll;
  ["#faceEnroll", "#faceNav"].forEach((q) => { const el = $(q); if (el) el.addEventListener("click", faceEnroll); });
  let ok = false;
  try { const k = sessionStorage.getItem(KEY) || localStorage.getItem(KEY); ok = k === PASS_HASH || k === AERIS_HASH || k === GUEST_HASH || k === LYJ_HASH || k === HOUSE_HASH || k === AGENT_HASH || k === GALLERY_HASH; if (k === GALLERY_HASH) setGallery(); if (k === VIEWER_HASH) setViewer(); if (k === AERIS_HASH) window.PERSONA = "aeris"; if (k === GUEST_HASH || k === LYJ_HASH || k === HOUSE_HASH) { window.PERSONA = "guest"; window.GUESTLIKE = true; window.GUEST_NAME = k === LYJ_HASH ? "林晏如" : "訪客"; } if (k === AGENT_HASH) { window.PERSONA = "agent"; window.GUESTLIKE = true; window.GUEST_NAME = "David（房仲）"; } } catch (_) {}
  if (ok) enter(); else { setTimeout(() => $("#pw").focus(), 50); let sw2 = false; try { sw2 = sessionStorage.getItem(SW_KEY) === "1"; } catch (_) {} if (!sw2 && window.FaceLogin && window.FaceLogin.enrolled()) faceGo(); }
})();
