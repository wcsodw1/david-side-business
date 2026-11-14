/* ============================================================
   AISO1 終端機：在辦公室頁直接開一個連到 AISO1 的 terminal（像 VS Code 的 Remote-SSH）。
   · 只有從 Mac 上的「AISO1 辦公室 AI.command」打開（http://localhost:5180）時才有：
     啟動器在本機用 ssh -tt AISO1-key 開 pty，這裡用 xterm.js 顯示、把鍵盤輸入送回去。
   · 線上 github.io 版沒有啟動器，只顯示說明。
   · 可以開好幾個分頁（最多 4 個），各自是獨立的 SSH 連線。
   ============================================================ */
(() => {
  "use strict";
  const XTERM = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0", FIT = "https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const local = () => /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let libP = null, token = null;
  const loadLib = () => libP || (libP = new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = XTERM + "/css/xterm.css"; document.head.appendChild(css);
    const js = (src) => new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("載入失敗：" + src)); document.head.appendChild(s); });
    js(XTERM + "/lib/xterm.js").then(() => js(FIT + "/lib/addon-fit.js")).then(res, rej);
  }));
  const getToken = async () => { if (token) return token; const j = await (await fetch("/term/token")).json(); if (!j.ok) throw new Error("啟動器拒絕連線"); token = j.token; return token; };
  const api = async (path, body) => {
    const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "X-Term-Token": await getToken(), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ ok: false, error: "HTTP " + r.status })); if (!j.ok) throw new Error(j.error || "HTTP " + r.status); return j;
  };
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  const THEME = { background: "#1b1410", foreground: "#efe6d6", cursor: "#e3651d", cursorAccent: "#1b1410", selectionBackground: "rgba(227,101,29,.35)",
    black: "#2a1f17", red: "#e0604a", green: "#8fbf6a", yellow: "#e8b04a", blue: "#7aa2d6", magenta: "#c08bd0", cyan: "#6cbfbf", white: "#efe6d6",
    brightBlack: "#6b5a4a", brightRed: "#f07a5f", brightGreen: "#a8d983", brightYellow: "#f5c76a", brightBlue: "#98bdf0", brightMagenta: "#d6a6e4", brightCyan: "#8ad8d8", brightWhite: "#fffaf0" };

  let root = null;   // 只建一次：辦公室重畫（例如 AI 改了白板）或換頁再回來，終端機都還在
  function mount(el) {
    if (root) { el.appendChild(root); return; }
    if (!local()) {
      el.innerHTML = `<div class="tm-off"><b>AISO1 終端機</b>：要在 Mac 上雙擊「AISO1 辦公室 AI.command」，從本機版辦公室（http://localhost:5180）才能開（線上版沒辦法直接連公司機器）。</div>`;
      return;
    }
    const tabs = [];   // { sid, term, fit, box, alive, stop }
    let cur = -1;
    root = document.createElement("div"); root.className = "tm"; el.appendChild(root);
    root.innerHTML = `
      <div class="tm-bar"><span class="tm-title">AISO1 終端機</span><span class="tm-tabs" data-tabs></span><span class="tm-sp"></span><button type="button" class="tm-new" data-new>＋ 開啟 AISO1 終端機</button></div>
      <div class="tm-body" data-body hidden></div>
      <p class="tm-note" data-note>像 VS Code 的 SSH: AISO1 一樣，直接連進 AISO1 的 shell（金鑰登入，不用密碼）。可以開多個分頁同時操作。</p>`;
    el = root;
    const q = (s) => root.querySelector(s), body = q("[data-body]"), note = q("[data-note]");
    const paintTabs = () => {
      q("[data-tabs]").innerHTML = tabs.map((t, i) => `<button type="button" class="tm-tab${i === cur ? " on" : ""}${t.alive ? "" : " dead"}" data-i="${i}">AISO1 #${i + 1}${t.alive ? "" : "（已斷線）"}<i data-x="${i}" title="關閉">×</i></button>`).join("");
      q("[data-tabs]").querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", (e) => { const x = e.target.closest("[data-x]"); if (x) { close(+x.dataset.x); return; } show(+b.dataset.i); }));
      body.hidden = !tabs.length; note.hidden = !!tabs.length;
    };
    const show = (i) => {   // eslint-disable-line
 cur = i; tabs.forEach((t, k) => (t.box.hidden = k !== i)); paintTabs(); const t = tabs[i]; if (t) requestAnimationFrame(() => { try { t.fit.fit(); } catch (_) {} t.term.focus(); }); };
    const close = async (i) => { const t = tabs[i]; if (!t) return; t.stop = true; try { await api("/term/close", { sid: t.sid }); } catch (_) {} t.term.dispose(); t.box.remove(); tabs.splice(i, 1); show(Math.min(cur, tabs.length - 1)); };
    const open = async () => {
      const btn = q("[data-new]"); btn.disabled = true; btn.textContent = "連線中…";
      try {
        await loadLib();
        const box = document.createElement("div"); box.className = "tm-term"; body.appendChild(box); body.hidden = false;
        const term = new window.Terminal({ fontFamily: '"SF Mono", Menlo, Monaco, "Cascadia Code", monospace', fontSize: 14, lineHeight: 1.25, cursorBlink: true, theme: THEME, scrollback: 5000, allowProposedApi: false });
        const fit = new window.FitAddon.FitAddon(); term.loadAddon(fit); term.open(box); try { fit.fit(); } catch (_) {}
        const { sid } = await api("/term/open", { cols: term.cols, rows: term.rows });
        const t = { sid, term, fit, box, alive: true, stop: false }; tabs.push(t); show(tabs.length - 1);
        term.onData((d) => { if (t.alive) api("/term/write", { sid, data: d }).catch(() => {}); });
        term.onResize(({ cols, rows }) => { if (t.alive) api("/term/resize", { sid, cols, rows }).catch(() => {}); });
        (async () => {   // 長輪詢讀輸出
          let since = 0;
          while (!t.stop) {
            try { const j = await api(`/term/read?sid=${sid}&since=${since}`); if (j.data) term.write(b64(j.data)); since = j.next;
              if (!j.alive && t.alive) { t.alive = false; term.write("\r\n\x1b[33m[連線已結束，按 × 關閉這個分頁]\x1b[0m\r\n"); paintTabs(); break; } }
            catch (e) { if (t.stop) break; t.alive = false; term.write(`\r\n\x1b[31m[${e.message}]\x1b[0m\r\n`); paintTabs(); break; }
          }
        })();
      } catch (e) { note.hidden = false; note.innerHTML = `<b>開不起來：</b>${esc(e.message)}。請確認是用「AISO1 辦公室 AI.command」打開的本機版，而且啟動器是最新版（關掉視窗再雙擊一次）。`; }
      btn.disabled = tabs.length >= 4; btn.textContent = tabs.length >= 4 ? "最多 4 個" : "＋ 開啟 AISO1 終端機";
    };
    q("[data-new]").addEventListener("click", open);
    const ro = new ResizeObserver(() => { const t = tabs[cur]; if (t) try { t.fit.fit(); } catch (_) {} }); ro.observe(body);
  }

  window.AisoTerm = { mount };
})();
