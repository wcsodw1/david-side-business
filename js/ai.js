/* ============================================================
   AI 助理：每塊白板一個獨立的聊天（像 ChatGPT）。
   · 輸入：文字 + 圖片（按迴紋針、貼上、或拖進來）
   · 回應：文字 + 圖片（OpenAI 的 image_generation 工具；Claude 只回文字，但看得懂圖）
   · 每個專案白板各有自己的對話（session），存在這台瀏覽器的 IndexedDB，重新整理還在
   · AI 會知道這塊白板的專案名稱、目標、目前狀態、Next Step
   ⚠ 這是靜態網站，沒有伺服器：請求從瀏覽器直接送到 OpenAI / Anthropic。
     API Key 由你自己在 ⚙ 設定裡貼上，只存在這個瀏覽器（localStorage），不會寫進程式碼或 GitHub。
   ============================================================ */
(() => {
  "use strict";
  const CFG_KEY = "dsb-ai";
  const DEFAULT_MODEL = { openai: "gpt-4.1", anthropic: "claude-sonnet-5-5", custom: "" };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sessions = {};
  let cfg = { provider: "openai", key: "", model: "", baseUrl: "" };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch (_) {}
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };
  const modelOf = () => cfg.model.trim() || DEFAULT_MODEL[cfg.provider];
  const needKey = () => cfg.provider !== "custom";   // 自訂端點（例如公司內網的模型）可以不用金鑰
  const ready = () => (needKey() ? !!cfg.key : !!cfg.baseUrl.trim());
  const provName = () => ({ openai: "OpenAI", anthropic: "Claude", custom: "自訂" }[cfg.provider]);

  /* ---------- 儲存（IndexedDB，圖片放得下）---------- */
  let dbP = null;
  const db = () => dbP || (dbP = new Promise((res) => {
    try { const r = indexedDB.open("dsb-ai", 1); r.onupgradeneeded = () => r.result.createObjectStore("chats"); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (_) { res(null); }
  }));
  const idbGet = async (k) => { const d = await db(); if (!d) return null; return new Promise((res) => { const q = d.transaction("chats").objectStore("chats").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); };
  const idbSet = async (k, v) => { const d = await db(); if (!d) return; return new Promise((res) => { const t = d.transaction("chats", "readwrite"); t.objectStore("chats").put(v, k); t.oncomplete = res; t.onerror = res; }); };

  const session = (pid) => {
    if (sessions[pid]) return sessions[pid];
    const s = (sessions[pid] = { pid, msgs: [], pending: false, ctl: null, subs: new Set(), ready: null });
    s.ready = idbGet("chat:" + pid).then((v) => { if (v && Array.isArray(v.msgs) && !s.msgs.length) s.msgs = v.msgs; s.notify(); });
    s.notify = () => s.subs.forEach((f) => f());
    s.save = () => idbSet("chat:" + pid, { msgs: s.msgs.slice(-60) });
    return s;
  };

  /* ---------- 圖片：縮小再送（省流量、省 token）---------- */
  const fileToImg = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { const m = 1280, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.85)); }; im.onerror = rej; im.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });

  /* ---------- 呼叫 AI ---------- */
  // 辦公室總管：看得到所有專案的目標 / 狀態 / Next Step（取自 p.projects，每次送出時即時讀取）
  const officePrompt = (p) => `你是 David 的 Side Business「辦公室總管」AI，用繁體中文、簡潔直接地回答。` +
    `原則：不要每題都套大框架，簡單問題簡單答；除了回答問題，也要指出 David 可能沒想到但重要的問題；建議要能執行、能衡量、能驗證（診斷瓶頸 → 小規模實驗 → 驗證，而不是只鼓勵繼續做）。` +
    `以下是目前所有專案的白板資料（需要時再引用，不要整份複述）：\n` +
    (p.projects || []).map((q) => `- ${q.name}${q.zh ? "（" + q.zh + "）" : ""}｜目標：${q.goal || "未設定"}｜狀態：${q.wbStatus || "未設定"}${q.wbNote ? "（" + q.wbNote + "）" : ""}｜Next Step：${q.next || "未設定"}`).join("\n");
  const sysPrompt = (p) => p.office ? officePrompt(p) : `你是「${p.name}${p.zh ? "（" + p.zh + "）" : ""}」這個專案白板上的助理，用繁體中文、簡潔直接地回答。` +
    `專案目標：${p.goal || "尚未設定"}。目前狀態：${p.wbStatus || "未設定"}${p.wbNote ? "（" + p.wbNote + "）" : ""}。Next Step：${p.next || "尚未設定"}。需要時可以參考這些資訊，不需要時不要複述。`;
  const dataParts = (u) => { const m = /^data:(.*?);base64,(.*)$/.exec(u) || []; return { type: m[1] || "image/jpeg", data: m[2] || "" }; };

  async function callAI(s, p, signal) {
    const hist = s.msgs.filter((m) => m.role === "user" || m.role === "ai").slice(-24);
    if (cfg.provider === "anthropic") {
      const messages = []; for (const m of hist) {
        const role = m.role === "user" ? "user" : "assistant", content = [];
        if (role === "user") for (const u of m.imgs || []) { const d = dataParts(u); content.push({ type: "image", source: { type: "base64", media_type: d.type, data: d.data } }); }
        const t = (m.text || "") + (role === "assistant" && (m.imgs || []).length ? "\n[已生成圖片]" : ""); content.push({ type: "text", text: t || "（圖片）" });
        if (messages.length && messages[messages.length - 1].role === role) messages[messages.length - 1].content.push(...content); else messages.push({ role, content });
      }
      if (messages[0] && messages[0].role !== "user") messages.shift();
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal, headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: modelOf(), max_tokens: 2048, system: sysPrompt(p), messages }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || `HTTP ${r.status}`);
      return { text: (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n"), imgs: [] };
    }
    if (cfg.provider === "custom") {
      const base = cfg.baseUrl.trim().replace(/\/+$/, ""), messages = [{ role: "system", content: sysPrompt(p) }];
      for (const m of hist) {
        if (m.role === "user") messages.push({ role: "user", content: (m.imgs || []).length ? [...m.imgs.map((u) => ({ type: "image_url", image_url: { url: u } })), { type: "text", text: m.text || "（圖片）" }] : (m.text || "（圖片）") });
        else messages.push({ role: "assistant", content: m.text || "（圖片）" });
      }
      const headers = { "content-type": "application/json" }; if (cfg.key) headers.authorization = "Bearer " + cfg.key;
      const body = { messages, stream: false }; if (modelOf()) body.model = modelOf();
      const r = await fetch(base + "/chat/completions", { method: "POST", signal, headers, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${r.status}`);
      const ch = (j.choices && j.choices[0] && j.choices[0].message) || {};
      return { text: String(ch.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim(), imgs: [] };
    }
    // OpenAI Responses API（可用 image_generation 工具產圖）
    const input = hist.map((m) => m.role === "user"
      ? { role: "user", content: [...(m.imgs || []).map((u) => ({ type: "input_image", image_url: u })), { type: "input_text", text: m.text || "（圖片）" }] }
      : { role: "assistant", content: [{ type: "output_text", text: (m.text || "") + ((m.imgs || []).length ? "\n[已生成圖片]" : "") || "（圖片）" }] });
    const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal, headers: { "content-type": "application/json", authorization: "Bearer " + cfg.key }, body: JSON.stringify({ model: modelOf(), instructions: sysPrompt(p), input, tools: [{ type: "image_generation" }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || `HTTP ${r.status}`);
    let text = "", imgs = [];
    for (const o of j.output || []) {
      if (o.type === "message") for (const c of o.content || []) { if (c.type === "output_text") text += (text ? "\n" : "") + c.text; }
      else if (o.type === "image_generation_call" && o.result) imgs.push("data:image/png;base64," + o.result);
    }
    return { text, imgs };
  }

  async function send(s, p, text, imgs) {
    if (s.pending) return; text = String(text || "").trim(); if (!text && !imgs.length) return;
    s.msgs.push({ role: "user", text, imgs: imgs.slice(), at: Date.now() }); s.pending = true; s.ctl = new AbortController(); s.notify();
    try { const out = await callAI(s, p, s.ctl.signal); s.msgs.push({ role: "ai", text: out.text || (out.imgs.length ? "" : "（沒有回應）"), imgs: out.imgs, at: Date.now() }); }
    catch (e) { if (e.name !== "AbortError") s.msgs.push({ role: "err", text: String(e.message || e), at: Date.now() }); }
    s.pending = false; s.ctl = null; s.notify(); s.save();
  }

  /* ---------- 介面 ---------- */
  const fmt = (t) => esc(t).replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.replace(/^\w*\n/, "")}</pre>`).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

  function mount(el, p) {
    const s = session(p.id); let draft = [];
    el.innerHTML = `<div class="ai">
      <div class="ai-bar"><span class="ai-title"></span><span class="ai-sp"></span><button type="button" data-new>新對話</button><button type="button" data-cfg aria-label="設定">⚙</button></div>
      <div class="ai-cfg" hidden>
        <label>服務商<select data-prov><option value="openai">OpenAI（文字 + 圖片回應）</option><option value="anthropic">Anthropic Claude（文字回應，看得懂圖）</option><option value="custom">自訂端點（OpenAI 相容，例如公司內網模型）</option></select></label>
        <label data-base-row hidden>端點網址（到 /v1 為止）<input data-base placeholder="http://主機:埠/v1" autocomplete="off"></label>
        <label>API Key（自訂端點可留空）<input type="password" data-key placeholder="貼上你自己的金鑰" autocomplete="off"></label>
        <label>模型（留空用預設）<input data-model autocomplete="off"></label>
        <p>金鑰只存在這個瀏覽器，請求直接送到服務商，不會經過其他地方。用量由你的帳號計費。</p>
        <button type="button" data-save>儲存</button>
      </div>
      <div class="ai-msgs" role="log"></div>
      <div class="ai-prev"></div>
      <form class="ai-form"><button type="button" class="ai-att" data-att aria-label="附加圖片">📎</button><textarea rows="1" placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行，可貼上或拖進圖片）"></textarea><button type="submit" data-send>送出</button><input type="file" accept="image/*" multiple hidden></form>
    </div>`;
    const q = (x) => el.querySelector(x), msgs = q(".ai-msgs"), ta = q("textarea"), prev = q(".ai-prev"), cfgBox = q(".ai-cfg"), file = q("input[type=file]"), sendBtn = q("[data-send]");
    const title = () => { q(".ai-title").textContent = `AI · ${provName()} · ${modelOf() || "預設模型"}`; };
    const paintPrev = () => { prev.innerHTML = draft.map((u, i) => `<span class="ai-th"><img src="${u}" alt=""><button type="button" data-rm="${i}" aria-label="移除">×</button></span>`).join(""); prev.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { draft.splice(+b.dataset.rm, 1); paintPrev(); })); };
    const paint = () => {
      const empty = !ready() ? `<p class="ai-empty">先按右上角 ⚙ 設定${needKey() ? "你的 API Key" : "端點網址"}，就能開始聊天。</p>` : `<p class="ai-empty">${p.office ? "問我整體進度、該先做哪個專案、下一步怎麼走都可以" : "問我關於「" + esc(p.name) + "」的任何事"}。可以丟文字或圖片。</p>`;
      msgs.innerHTML = (s.msgs.length ? s.msgs.map((m) => `<div class="ai-m ai-${m.role}"><div class="ai-b">${m.text ? fmt(m.text) : ""}${(m.imgs || []).map((u) => `<a class="ai-imgwrap" href="${u}" download="image.${/png/.test(u.slice(0, 20)) ? "png" : "jpg"}" title="點一下下載"><img class="ai-img" src="${u}" alt=""></a>`).join("")}</div></div>`).join("") : empty) + (s.pending ? `<div class="ai-m ai-ai"><div class="ai-b ai-dots"><i></i><i></i><i></i></div></div>` : "");
      msgs.scrollTop = msgs.scrollHeight; sendBtn.textContent = s.pending ? "停止" : "送出";
    };
    const sub = () => { if (!el.isConnected) { s.subs.delete(sub); return; } paint(); };
    s.subs.add(sub); s.ready.then(paint); title(); paint();
    const go = () => { if (s.pending) { s.ctl && s.ctl.abort(); return; } if (!ready()) { cfgBox.hidden = false; return; } const t = ta.value, im = draft; ta.value = ""; draft = []; paintPrev(); ta.style.height = ""; send(s, p, t, im); };
    q(".ai-form").addEventListener("submit", (e) => { e.preventDefault(); go(); });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
    const addFiles = async (fs) => { for (const f of [...fs].filter((x) => /^image\//.test(x.type)).slice(0, 4 - draft.length)) { try { draft.push(await fileToImg(f)); } catch (_) {} } paintPrev(); };
    q("[data-att]").addEventListener("click", () => file.click()); file.addEventListener("change", () => { addFiles(file.files); file.value = ""; });
    ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
    const area = q(".ai"); area.addEventListener("dragover", (e) => { e.preventDefault(); }); area.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    q("[data-new]").addEventListener("click", () => { if (s.pending && s.ctl) s.ctl.abort(); s.msgs = []; s.pending = false; s.save(); s.notify(); });
    q("[data-cfg]").addEventListener("click", () => { cfgBox.hidden = !cfgBox.hidden; });
    q("[data-prov]").value = cfg.provider; q("[data-key]").value = cfg.key; q("[data-base]").value = cfg.baseUrl; const baseRow = q("[data-base-row]"); baseRow.hidden = cfg.provider !== "custom"; q("[data-model]").value = cfg.model; q("[data-model]").placeholder = DEFAULT_MODEL[cfg.provider];
    q("[data-prov]").addEventListener("change", (e) => { q("[data-model]").placeholder = DEFAULT_MODEL[e.target.value] || "（留空 = 端點預設模型）"; baseRow.hidden = e.target.value !== "custom"; });
    q("[data-save]").addEventListener("click", () => { cfg.provider = q("[data-prov]").value; cfg.key = q("[data-key]").value.trim(); cfg.baseUrl = q("[data-base]").value.trim(); cfg.model = q("[data-model]").value.trim(); saveCfg(); cfgBox.hidden = true; title(); paint(); });
    if (!ready()) cfgBox.hidden = false;
  }

  window.AIChat = { mount, session, config: () => ({ provider: cfg.provider, model: modelOf(), hasKey: !!cfg.key, ready: ready() }), _setCfg: (c) => { Object.assign(cfg, c); saveCfg(); } };
})();
