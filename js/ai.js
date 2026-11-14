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
  const DEFAULT_MODEL = { openai: "gpt-4.1", anthropic: "claude-sonnet-5-5", custom: "", aiso1: "" };
  // AISO1：公司那台跑 llama.cpp 的機器。這台 Mac 開 SSH 通道後，瀏覽器直接打 localhost:18082（llama.cpp 有開 CORS）
  const AISO_BASE = "http://localhost:18082/v1", AISO_TUNNEL = "ssh -f -N -L 18082:127.0.0.1:18082 AISO1-key";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sessions = {};
  let cfg = { provider: "openai", key: "", model: "", baseUrl: "", aisoBase: "", think: false, temp: "", maxTok: "" };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch (_) {}
  // 沒填雲端金鑰時，預設直接用 AISO1 本地模型（打開就能聊，不用設定）
  if ((cfg.provider === "openai" || cfg.provider === "anthropic") && !cfg.key) cfg.provider = "aiso1";
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };
  const modelOf = () => cfg.model.trim() || DEFAULT_MODEL[cfg.provider];
  const isLocal = () => cfg.provider === "custom" || cfg.provider === "aiso1";   // OpenAI 相容端點（串流輸出）
  const needKey = () => !isLocal();   // 自訂端點 / AISO1 可以不用金鑰
  // 用 Mac 上的「AISO1 辦公室 AI.command」開網站時（http://localhost），走同源的 /aiso1 轉送（做法同 AISO Platform 的 launcher），不會被瀏覽器擋
  const baseOf = () => (cfg.provider === "aiso1" ? (cfg.aisoBase || "").trim() || (aiso.proxy ? location.origin + "/aiso1/v1" : AISO_BASE) : cfg.baseUrl.trim()).replace(/\/+$/, "");
  const ready = () => (needKey() ? !!cfg.key : !!baseOf());
  const provName = () => ({ openai: "OpenAI", anthropic: "Claude", custom: "自訂", aiso1: "AISO1 本地" }[cfg.provider]);
  const aiso = { ok: null, name: "", wait: false, proxy: false };   // 連線狀態、偵測到的模型名稱、是否卡在等瀏覽器允許
  // Chrome「區域網路存取」：公開網站（github.io）連本機 localhost 要宣告目標是 loopback，Chrome 才會跳出允許詢問
  const LNA = () => (cfg.provider === "aiso1" && /^http:\/\/(localhost|127\.0\.0\.1)/.test(baseOf()) && location.protocol === "https:" ? { targetAddressSpace: "loopback" } : {});
  const LAUNCH_HELP = "最穩的方式：在 Mac 上雙擊 Side Business 資料夾裡的「AISO1 辦公室 AI.command」，它會自動開通道並打開本機版辦公室（http://localhost:5180），AI 直接連 AISO1。";
  const LNA_HELP = "Chrome 網址列左側（或右側）若跳出「要存取區域網路上的裝置」→ 按「允許」。沒看到的話：點網址列左邊的圖示 →「網站設定」→「區域網路存取」設為允許，再重新整理。";
  const pingAiso = async () => {
    aiso.wait = false;
    if (!cfg.aisoBase && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {   // 本機啟動器有沒有在？
      try { const h = await fetch("/aiso1/health", { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }); aiso.proxy = h.status === 200 || h.status === 502; } catch (_) { aiso.proxy = false; }
    }
    try { const r = await fetch(baseOf() + "/models", { ...LNA(), signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined }); const j = await r.json(); const id = (j.data && j.data[0] && j.data[0].id) || ""; aiso.ok = r.ok; aiso.name = id.split("/").pop().replace(/\.gguf$/i, ""); }
    catch (e) { aiso.ok = false; aiso.wait = e && e.name === "TimeoutError"; }
    return aiso;
  };

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

  /* ---------- 讓 AI 直接更新藝廊（工具呼叫，AISO1 / 自訂端點）----------
     模型回傳 tool_calls → 這裡用 Store 直接改白板資料（和按「✎ 更新」、白板、時程表是同一套），藝廊 / 辦公室 / NEWS 立刻更新。
     資料一樣只存在這個瀏覽器；每次改動前先存快照，對話裡有「復原」。 */
  const STORE_KEY = "dsb-local", P_ST = ["TODO", "ON PROCESS", "PENDING", "BLOCK", "FINISH"], T_ST = ["To Do", "Doing", "Done", "Blocked"];
  const projList = (p) => (p.office ? p.projects || [] : [p]);
  const squash = (x) => String(x || "").toLowerCase().replace(/[\s\-_]+/g, "");
  const findProj = (p, q) => {
    if (!q && !p.office) return p; const n = squash(q), L = projList(p); if (!n) return null;
    return L.find((x) => squash(x.id) === n) || L.find((x) => squash(x.name) === n || squash(x.zh) === n) || L.find((x) => squash(x.name).includes(n) || n.includes(squash(x.name)) || (x.zh && (squash(x.zh).includes(n) || n.includes(squash(x.zh))))) || null;
  };
  const fn = (name, description, props, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties: props, required } } });
  const PJ = { type: "string", description: "專案 id 或名稱，例如 coffee-shop / Coffee Shop" };
  const TOOLS = [
    fn("update_project", "更新專案白板：狀態、目前進度一句話（會寫進進度紀錄與 NEWS）、Next Step、目標。只填要改的欄位。", { project: PJ, status: { type: "string", enum: P_ST }, note: { type: "string", description: "目前進度 / 最新狀況一句話" }, next: { type: "string", description: "下一步" }, goal: { type: "string", description: "專案目標" } }, ["project"]),
    fn("add_milestones", "替專案加里程碑（完成度會依里程碑計算）", { project: PJ, items: { type: "array", items: { type: "string" } } }, ["project", "items"]),
    fn("add_task", "在專案時程表（PM 甘特圖）新增任務", { project: PJ, name: { type: "string" }, pri: { type: "string", enum: ["P0", "P1", "P2"] }, owner: { type: "string" }, status: { type: "string", enum: T_ST }, progress: { type: "number", description: "0–100" }, start: { type: "string", description: "YYYY-MM-DD" }, end: { type: "string", description: "YYYY-MM-DD" } }, ["project", "name"]),
    fn("update_task", "更新時程表上既有的任務（用任務名稱找）", { project: PJ, task: { type: "string", description: "任務名稱" }, status: { type: "string", enum: T_ST }, progress: { type: "number" }, end: { type: "string" }, owner: { type: "string" }, pri: { type: "string", enum: ["P0", "P1", "P2"] } }, ["project", "task"]),
  ];
  const toolPrompt = (p) => `\n\n你可以用工具直接更新 David 的藝廊（白板狀態、進度、Next Step、目標、里程碑、時程表任務）。今天是 ${window.Store ? window.Store.today() : ""}。` +
    `David 要你記錄、更新、改狀態、排任務時，一定要真的呼叫工具去做（每次都要，即使之前做過類似的事），不要只在文字裡說「已更新」、不要寫「[已執行]」之類的字，也不要叫他自己改；只是問問題時就不要動資料。工具執行完再用一兩句話回報。` +
    `\n各專案的時程表任務：\n` + projList(p).map((q) => `- ${q.id}（${q.name}）：${(q.tasks || []).length ? q.tasks.map((t) => `${t.name}［${t.status} ${t.progress || 0}% ${t.start}~${t.end}］`).join("、") : "沒有任務"}`).join("\n");
  const runTool = (p, name, a) => {
    const S = window.Store; if (!S) return { ok: false, error: "藝廊資料還沒載入" };
    const pj = findProj(p, a.project); if (!pj) return { ok: false, error: `找不到專案「${a.project || ""}」` };
    const done = [], nm = pj.name;
    try {
      if (name === "update_project") {
        const st = P_ST.find((x) => squash(x) === squash(a.status));
        if (st && st !== pj.wbStatus) { S.setStatus(pj.id, st); done.push("狀態 → " + (st === "ON PROCESS" ? "ON-PROCESS" : st)); }
        if (a.goal && String(a.goal).trim()) { S.setGoal(pj.id, a.goal); done.push("目標 → " + String(a.goal).trim()); }
        if (a.next !== undefined && String(a.next).trim() !== (pj.next || "")) { S.setNext(pj.id, a.next); done.push("Next Step → " + (String(a.next).trim() || "（清空）")); }
        if (a.note && String(a.note).trim()) { S.setNote(pj.id, a.note); done.push("進度 → " + String(a.note).trim()); }
        if (!done.length) return { ok: true, text: `${nm}：沒有需要改的` };
      } else if (name === "add_milestones") {
        const n = S.addMilestones(pj.id, a.items || []); done.push(`新增 ${n} 個里程碑`);
      } else if (name === "add_task") {
        const t = S.addTask(pj.id, { name: a.name, pri: a.pri, owner: a.owner, start: a.start, end: a.end }); if (!t) return { ok: false, error: "任務名稱是空的" };
        const patch = {}; if (T_ST.includes(a.status)) patch.status = a.status; if (a.progress !== undefined && !isNaN(+a.progress)) patch.progress = Math.max(0, Math.min(100, +a.progress)); if (Object.keys(patch).length) S.updateTask(pj.id, t.id, patch);
        done.push(`時程表新增「${t.name}」（${t.start}~${t.end}）`);
      } else if (name === "update_task") {
        const L = pj.tasks || [], q = squash(a.task), t = L.find((x) => squash(x.name) === q) || L.find((x) => squash(x.name).includes(q) || q.includes(squash(x.name)));
        if (!t) return { ok: false, error: `${nm} 的時程表找不到任務「${a.task || ""}」` };
        const patch = {}; if (T_ST.includes(a.status)) patch.status = a.status; if (a.progress !== undefined && !isNaN(+a.progress)) patch.progress = Math.max(0, Math.min(100, +a.progress)); if (a.end) patch.end = a.end; if (a.owner) patch.owner = a.owner; if (a.pri) patch.pri = a.pri;
        S.updateTask(pj.id, t.id, patch); done.push(`任務「${t.name}」→ ` + Object.entries(patch).map(([k, v]) => `${k} ${v}${k === "progress" ? "%" : ""}`).join("、"));
      } else return { ok: false, error: "不認得的工具：" + name };
    } catch (e) { return { ok: false, error: `${nm}：${e.message || e}` }; }
    return { ok: true, text: `${nm}：${done.join("；")}` };
  };

  async function callAI(s, p, signal, onDelta) {
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
    if (isLocal()) {
      const base = baseOf(), useTools = cfg.tools !== false && !!window.Store, messages = [{ role: "system", content: sysPrompt(p) + (useTools ? toolPrompt(p) : "") }];
      for (const m of hist) {
        if (m.role === "user") messages.push({ role: "user", content: (m.imgs || []).length ? [...m.imgs.map((u) => ({ type: "image_url", image_url: { url: u } })), { type: "text", text: m.text || "（圖片）" }] : (m.text || "（圖片）") });
        else {
          const calls = (m.actions || []).filter((a) => a.name);   // 之前真的呼叫過的工具：照原樣放回去（工具呼叫 + 結果），模型才會學到要真的呼叫
          if (calls.length) { messages.push({ role: "assistant", content: "", tool_calls: calls.map((a, k) => ({ id: "h" + hist.indexOf(m) + "_" + k, type: "function", function: { name: a.name, arguments: JSON.stringify(a.args || {}) } })) });
            calls.forEach((a, k) => messages.push({ role: "tool", tool_call_id: "h" + hist.indexOf(m) + "_" + k, content: JSON.stringify(a.fail ? { ok: false, error: a.text } : { ok: true, text: a.text + (m.undone ? "（之後被 David 復原了）" : "") }) })); }
          messages.push({ role: "assistant", content: m.text || (calls.length ? "完成。" : "（圖片）") });
        }
      }
      const headers = { "content-type": "application/json" }; if (cfg.key) headers.authorization = "Bearer " + cfg.key;
      const tidy = (t) => String(t || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^\s+/, "");
      const stats = (tm, us, model) => { const name = String(model || "").split("/").pop().replace(/\.gguf$/i, ""), n = tm ? tm.predicted_n : us && us.completion_tokens;
        return [name, n ? n + " tokens" : "", tm && tm.predicted_per_second ? tm.predicted_per_second.toFixed(1) + " tok/s" : "", tm && tm.prompt_n ? "讀入 " + tm.prompt_n + " tokens" : ""].filter(Boolean).join(" · "); };
      let text = "", think = "", tm = null, us = null, model = "", undo = null; const actions = [];
      const push = () => onDelta && onDelta({ text: tidy(text), think, actions });
      // 最多 4 輪：模型呼叫工具 → 這裡執行（直接改藝廊資料）→ 把結果交回模型 → 模型回報做了什麼
      for (let round = 0; round < 4; round++) {
        const body = { messages, stream: true }; if (modelOf()) body.model = modelOf();
        body.chat_template_kwargs = { enable_thinking: !!cfg.think };          // llama.cpp：要不要先「思考」再回答
        if (cfg.temp !== "" && !isNaN(+cfg.temp)) body.temperature = +cfg.temp;
        if (+cfg.maxTok > 0) body.max_tokens = Math.round(+cfg.maxTok);
        if (useTools && round < 3) body.tools = TOOLS;
        let r;
        try { r = await fetch(base + "/chat/completions", { ...LNA(), method: "POST", signal, headers, body: JSON.stringify(body) }); }
        catch (e) { if (e.name === "AbortError") throw e; throw new Error(cfg.provider === "aiso1" ? `連不到 AISO1（${base}）。${LAUNCH_HELP} 或確認：① 瀏覽器允許這個網站存取本機：${LNA_HELP} ② 這台 Mac 的 SSH 通道有開：${AISO_TUNNEL}（出現 Address already in use 代表已經開著，沒問題）③ AISO1 上的模型服務在跑。` : `連不到 ${base}：${e.message}`); }
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${r.status}`); }
        const calls = []; let rtext = "";
        if (!/event-stream/.test(r.headers.get("content-type") || "") || !r.body) {   // 端點不支援串流：當成一般回應
          const j = await r.json().catch(() => ({})), ch = (j.choices && j.choices[0] && j.choices[0].message) || {};
          rtext = ch.content || ""; think += ch.reasoning_content || ""; tm = j.timings || tm; us = j.usage || us; model = j.model || model;
          (ch.tool_calls || []).forEach((c) => calls.push({ id: c.id, name: c.function.name, args: c.function.arguments || "" }));
          text += (text && rtext ? "\n\n" : "") + rtext; push();
        } else {
          // 串流：像 llama.cpp WebUI 一樣一個字一個字出來
          const rd = r.body.getReader(), dec = new TextDecoder(), lead = text ? "\n\n" : ""; let buf = "";
          for (;;) {
            const { value, done } = await rd.read(); if (done) break;
            buf += dec.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop();
            for (const ln of lines) {
              const d = ln.trim(); if (!d.startsWith("data:")) continue; const pl = d.slice(5).trim(); if (pl === "[DONE]") continue;
              let j; try { j = JSON.parse(pl); } catch (_) { continue; }
              if (j.error) throw new Error(j.error.message || String(j.error));
              const dl = (j.choices && j.choices[0] && j.choices[0].delta) || {};
              if (dl.content) rtext += dl.content; if (dl.reasoning_content) think += dl.reasoning_content;
              for (const tc of dl.tool_calls || []) { const k = tc.index ?? calls.length; const c = (calls[k] = calls[k] || { id: "", name: "", args: "" }); if (tc.id) c.id = tc.id; if (tc.function) { if (tc.function.name) c.name += tc.function.name; if (tc.function.arguments) c.args += tc.function.arguments; } }
              if (j.timings) tm = j.timings; if (j.usage) us = j.usage; if (j.model) model = j.model;
              if (onDelta) onDelta({ text: tidy(text + (rtext ? lead + rtext : "")), think, actions });
            }
          }
          if (rtext) text += lead + rtext;
        }
        const todo = calls.filter((c) => c && c.name); if (!todo.length) break;
        if (undo === null) { try { undo = localStorage.getItem(STORE_KEY) || "{}"; } catch (_) { undo = "{}"; } }   // 第一次改動前先存一份，讓 David 可以一鍵復原
        messages.push({ role: "assistant", content: rtext || "", tool_calls: todo.map((c, k) => ({ id: c.id || "call_" + round + "_" + k, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
        todo.forEach((c, k) => { let a = {}; try { a = JSON.parse(c.args || "{}"); } catch (_) {}
          const res = runTool(p, c.name, a); actions.push(res.ok ? { text: res.text, name: c.name, args: a } : { text: res.error, fail: true, name: c.name, args: a });
          messages.push({ role: "tool", tool_call_id: c.id || "call_" + round + "_" + k, content: JSON.stringify(res) }); });
        push();
      }
      const out = { text: tidy(text).trim(), think: think.trim(), imgs: [], meta: stats(tm, us, model) };
      if (actions.length) { out.actions = actions; if (actions.some((a) => !a.fail)) out.undo = undo; }
      return out;
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
    const live = { role: "ai", text: "", imgs: [], at: Date.now(), live: true }; let raf = 0;   // 串流中的那則回覆（第一個字到了才放進對話）
    const onDelta = (d) => { if (!s.msgs.includes(live)) s.msgs.push(live); live.text = d.text; live.think = d.think; if (d.actions && d.actions.length) live.actions = d.actions.slice(); if (!raf) raf = requestAnimationFrame(() => { raf = 0; s.notify(); }); };
    try {
      const out = await callAI(s, p, s.ctl.signal, onDelta), i = s.msgs.indexOf(live);
      const m = { role: "ai", text: out.text || (out.imgs.length || (out.actions || []).length ? "" : "（沒有回應）"), imgs: out.imgs, at: Date.now() }; if (out.think) m.think = out.think; if (out.meta) m.meta = out.meta; if (out.actions) m.actions = out.actions; if (out.undo) m.undo = out.undo;
      if (i >= 0) s.msgs[i] = m; else s.msgs.push(m);
    }
    catch (e) {
      const i = s.msgs.indexOf(live); if (i >= 0) { delete live.live; live.meta = e.name === "AbortError" ? "（已停止）" : "（中斷）"; }
      else if (e.name === "AbortError") s.msgs.push({ role: "ai", text: "", imgs: [], meta: "（已停止）", at: Date.now() });   // 還沒收到字就停了，也要看得到
      if (e.name !== "AbortError") s.msgs.push({ role: "err", text: String(e.message || e), at: Date.now() });
    }
    cancelAnimationFrame(raf);
    s.pending = false; s.ctl = null; s.notify(); s.save();
    const lastAi = s.msgs[s.msgs.length - 1]; if (lastAi && (lastAi.actions || []).some((x) => !x.fail)) window.dispatchEvent(new CustomEvent("ai:applied"));
  }

  /* ---------- 介面 ---------- */
  // 本地模型常回 LaTeX 小符號（例如 $\rightarrow$），轉成一般字元
  const TEX = { rightarrow: "→", Rightarrow: "⇒", leftarrow: "←", to: "→", times: "×", le: "≤", leq: "≤", ge: "≥", geq: "≥", approx: "≈", neq: "≠", pm: "±", cdot: "·" };
  const unTex = (t) => String(t).replace(/\$\s*\\([A-Za-z]+)\s*\$|\\(rightarrow|Rightarrow|leftarrow|times|approx|neq|leq|geq)\b/g, (m, a, b) => TEX[a || b] || m);
  const fmt = (t) => esc(unTex(t)).replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.replace(/^\w*\n/, "")}</pre>`).replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");

  function mount(el, p) {
    const s = session(p.id); let draft = [];
    el.innerHTML = `<div class="ai">
      <div class="ai-bar"><span class="ai-title"></span><span class="ai-sp"></span><button type="button" data-new>新對話</button><button type="button" data-cfg aria-label="設定">⚙</button></div>
      <div class="ai-cfg" hidden>
        <label>服務商<select data-prov><option value="openai">OpenAI（文字 + 圖片回應）</option><option value="anthropic">Anthropic Claude（文字回應，看得懂圖）</option><option value="custom">自訂端點（OpenAI 相容，例如公司內網模型）</option><option value="aiso1">AISO1 本地模型（llama.cpp · Gemma，免金鑰）</option></select></label>
        <label data-base-row hidden>端點網址（到 /v1 為止）<input data-base placeholder="http://主機:埠/v1" autocomplete="off"></label>
        <label data-key-row>API Key（自訂端點可留空）<input type="password" data-key placeholder="貼上你自己的金鑰" autocomplete="off"></label>
        <label>模型（留空用預設）<input data-model autocomplete="off"></label>
        <div class="ai-local" data-local-row hidden>
          <label>溫度（0–2，留空用預設）<input data-temp inputmode="decimal" placeholder="例如 0.7" autocomplete="off"></label>
          <label>最多輸出 tokens（留空不限）<input data-maxtok inputmode="numeric" placeholder="例如 2048" autocomplete="off"></label>
          <label class="ai-chk"><input type="checkbox" data-think> 先思考再回答（顯示思考過程，比較慢）</label>
        </div>
        <p data-aiso-help hidden>AISO1 不經過網路服務商：瀏覽器直接連這台 Mac 的 <code>localhost:18082</code>，再經 SSH 通道到 AISO1。<br>通道沒開時，在終端機執行 <code>${AISO_TUNNEL}</code>；模型服務要在 AISO1 上跑著。<span data-aiso-st></span></p>
        <p data-cloud-help>金鑰只存在這個瀏覽器，請求直接送到服務商，不會經過其他地方。用量由你的帳號計費。</p>
        <button type="button" data-save>儲存</button>
      </div>
      <div class="ai-msgs" role="log"></div>
      <div class="ai-prev"></div>
      <form class="ai-form"><button type="button" class="ai-att" data-att aria-label="附加圖片">📎</button><textarea rows="1" placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行，可貼上或拖進圖片）"></textarea><button type="submit" data-send>送出</button><input type="file" accept="image/*" multiple hidden></form>
    </div>`;
    const q = (x) => el.querySelector(x), msgs = q(".ai-msgs"), ta = q("textarea"), prev = q(".ai-prev"), cfgBox = q(".ai-cfg"), file = q("input[type=file]"), sendBtn = q("[data-send]");
    const title = () => {
      const st = cfg.provider !== "aiso1" ? "" : aiso.ok === null ? " · 連線中…（等瀏覽器允許）" : aiso.ok ? " · ● 已連線" : aiso.wait ? " · ◌ 等待瀏覽器允許" : " · ○ 未連線";
      const mdl = modelOf() || (cfg.provider === "aiso1" && aiso.name) || "預設模型";
      q(".ai-title").textContent = `AI · ${provName()} · ${mdl}${st}`; q(".ai-title").classList.toggle("ai-off", cfg.provider === "aiso1" && aiso.ok === false);
      const hs = q("[data-aiso-st]"); if (hs) hs.textContent = cfg.provider !== "aiso1" ? "" : aiso.ok ? `　目前：已連線（${aiso.name}）` : aiso.ok === false ? "　目前：連不到" : "";
    };
    const checkAiso = () => { if (cfg.provider !== "aiso1") return; aiso.ok = null; title(); pingAiso().then(() => { if (el.isConnected) { title(); paint(); } }); };
    const paintPrev = () => { prev.innerHTML = draft.map((u, i) => `<span class="ai-th"><img src="${u}" alt=""><button type="button" data-rm="${i}" aria-label="移除">×</button></span>`).join(""); prev.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { draft.splice(+b.dataset.rm, 1); paintPrev(); })); };
    const paint = () => {
      const empty = cfg.provider === "aiso1" && aiso.ok === false ? `<p class="ai-empty">還連不到 AISO1 本地模型。<br><b>${esc(LAUNCH_HELP)}</b><br><br>在線上網站直接連的話：<br><b>① 允許瀏覽器連本機：</b>${esc(LNA_HELP)}<br><b>② SSH 通道：</b>終端機執行 <code>${esc(AISO_TUNNEL)}</code>（出現 Address already in use 代表已經開著）<br><b>③</b> AISO1 上的模型服務要在跑。都好了就按 <button type="button" class="ai-retry" data-retry>重新連線</button></p>` : !ready() ? `<p class="ai-empty">先按右上角 ⚙ 設定${needKey() ? "你的 API Key" : "端點網址"}，就能開始聊天。</p>` : `<p class="ai-empty">${p.office ? "問我整體進度、該先做哪個專案、下一步怎麼走都可以" : "問我關於「" + esc(p.name) + "」的任何事"}。可以丟文字或圖片。</p>`;
      const last = s.msgs[s.msgs.length - 1];
      msgs.innerHTML = (s.msgs.length ? s.msgs.map((m) => `<div class="ai-m ai-${m.role}${m.live ? " ai-live" : ""}"><div class="ai-b">${m.think ? `<details class="ai-think"${m.live && !m.text ? " open" : ""}><summary>思考過程</summary>${fmt(m.think)}</details>` : ""}${m.text ? fmt(m.text) : ""}${(m.imgs || []).map((u) => `<a class="ai-imgwrap" href="${u}" download="image.${/png/.test(u.slice(0, 20)) ? "png" : "jpg"}" title="點一下下載"><img class="ai-img" src="${u}" alt=""></a>`).join("")}${(m.actions || []).length ? `<div class="ai-acts">${m.actions.map((x) => `<div class="${x.fail ? "fail" : ""}${m.undone ? " undone" : ""}">${x.fail ? "✗" : "✓"} ${esc(x.text)}</div>`).join("")}${m.undo && !m.live ? (m.undone ? `<span class="ai-undone">已復原</span>` : `<button type="button" class="ai-undo" data-undo="${s.msgs.indexOf(m)}">復原這次改動</button>`) : ""}</div>` : ""}${m.meta ? `<div class="ai-meta">${esc(m.meta)}</div>` : ""}</div></div>`).join("") : empty) + (s.pending && !(last && last.live) ? `<div class="ai-m ai-ai"><div class="ai-b ai-dots"><i></i><i></i><i></i></div>${cfg.provider === "aiso1" && !aiso.ok ? `<div class="ai-hint">等待連到 AISO1…${esc(LNA_HELP)}</div>` : ""}</div>` : "");
      msgs.scrollTop = msgs.scrollHeight; sendBtn.textContent = s.pending ? "停止" : "送出";
      const rb = msgs.querySelector("[data-retry]"); if (rb) rb.addEventListener("click", checkAiso);
      msgs.querySelectorAll("[data-undo]").forEach((b) => b.addEventListener("click", () => {   // 還原成這次改動前的白板資料，重新整理讓藝廊全部重畫
        const m = s.msgs[+b.dataset.undo]; if (!m || !m.undo || !confirm("把這次 AI 做的改動全部復原？")) return;
        try { localStorage.setItem(STORE_KEY, m.undo); } catch (_) {} m.undone = true; s.save().then(() => location.reload());
      }));
    };
    const sub = () => { if (!el.isConnected) { s.subs.delete(sub); return; } paint(); };
    s.subs.add(sub); s.ready.then(paint); title(); paint();
    const go = () => { if (s.pending) { s.ctl && s.ctl.abort(); return; } if (!ready()) { cfgBox.hidden = false; return; } const t = ta.value, im = draft; ta.value = ""; draft = []; paintPrev(); ta.style.height = ""; send(s, p, t, im); };
    q(".ai-form").addEventListener("submit", (e) => { e.preventDefault(); go(); });
    // 中文輸入法選字的 Enter 不算送出（Safari 的 isComposing 不可靠，所以也看 keyCode 229）；回覆中按 Enter 不會停止，要停只能按「停止」鈕
    ta.addEventListener("keydown", (e) => { if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return; e.preventDefault(); if (!s.pending) go(); });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
    const addFiles = async (fs) => { for (const f of [...fs].filter((x) => /^image\//.test(x.type)).slice(0, 4 - draft.length)) { try { draft.push(await fileToImg(f)); } catch (_) {} } paintPrev(); };
    q("[data-att]").addEventListener("click", () => file.click()); file.addEventListener("change", () => { addFiles(file.files); file.value = ""; });
    ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
    const area = q(".ai"); area.addEventListener("dragover", (e) => { e.preventDefault(); }); area.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    q("[data-new]").addEventListener("click", () => { if (s.pending && s.ctl) s.ctl.abort(); s.msgs = []; s.pending = false; s.save(); s.notify(); });
    q("[data-cfg]").addEventListener("click", () => { cfgBox.hidden = !cfgBox.hidden; });
    const baseRow = q("[data-base-row]"), base = q("[data-base]");
    const showRows = (pv) => {   // 依服務商顯示需要的欄位
      const loc = pv === "custom" || pv === "aiso1";
      baseRow.hidden = !loc; q("[data-key-row]").hidden = pv === "aiso1"; q("[data-local-row]").hidden = !loc;
      q("[data-aiso-help]").hidden = pv !== "aiso1"; q("[data-cloud-help]").hidden = loc;
      base.value = pv === "aiso1" ? cfg.aisoBase || AISO_BASE : cfg.baseUrl;
      q("[data-model]").placeholder = DEFAULT_MODEL[pv] || (pv === "aiso1" ? "（留空 = AISO1 上正在跑的模型）" : "（留空 = 端點預設模型）");
    };
    q("[data-prov]").value = cfg.provider; q("[data-key]").value = cfg.key; q("[data-model]").value = cfg.model;
    q("[data-temp]").value = cfg.temp; q("[data-maxtok]").value = cfg.maxTok; q("[data-think]").checked = !!cfg.think; showRows(cfg.provider);
    q("[data-prov]").addEventListener("change", (e) => showRows(e.target.value));
    q("[data-save]").addEventListener("click", () => {
      cfg.provider = q("[data-prov]").value; cfg.key = q("[data-key]").value.trim(); cfg.model = q("[data-model]").value.trim();
      if (cfg.provider === "aiso1") cfg.aisoBase = base.value.trim() === AISO_BASE ? "" : base.value.trim(); else cfg.baseUrl = base.value.trim();
      cfg.temp = q("[data-temp]").value.trim(); cfg.maxTok = q("[data-maxtok]").value.trim(); cfg.think = q("[data-think]").checked;
      saveCfg(); cfgBox.hidden = true; title(); paint(); checkAiso();
    });
    checkAiso();
    if (!ready()) cfgBox.hidden = false;
  }

  window.AIChat = { mount, session, config: () => ({ provider: cfg.provider, model: modelOf(), hasKey: !!cfg.key, ready: ready() }), _setCfg: (c) => { Object.assign(cfg, c); saveCfg(); } };
})();
