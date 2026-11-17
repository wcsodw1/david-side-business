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
  const cmpSel = {};   // 比較模式各題目前看的是第幾個模型的回答
  let cfg = { provider: "openai", key: "", model: "", baseUrl: "", aisoBase: "", aisoModel: "", think: false, temp: "", maxTok: "" };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || "{}")); } catch (_) {}
  // 沒填雲端金鑰時，預設直接用 AISO1 本地模型（打開就能聊，不用設定）
  if ((cfg.provider === "openai" || cfg.provider === "anthropic") && !cfg.key) cfg.provider = "aiso1";
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} };
  const modelOf = () => cfg.model.trim() || DEFAULT_MODEL[cfg.provider];
  const isLocal = () => cfg.provider === "custom" || cfg.provider === "aiso1";   // OpenAI 相容端點（串流輸出）
  const needKey = () => !isLocal();   // 自訂端點 / AISO1 可以不用金鑰
  // 用 Mac 上的「AISO1 辦公室 AI.command」開網站時（http://localhost），走同源的 /aiso1 轉送（做法同 AISO Platform 的 launcher），不會被瀏覽器擋
  const baseOf = () => (cfg.provider === "aiso1" ? (cfg.aisoBase || "").trim() || (aiso.proxy ? location.origin + "/aiso1/v1" : aiso.direct || AISO_BASE) : cfg.baseUrl.trim()).replace(/\/+$/, "");
  // AISO1 是 llama.cpp router（~/llama-models.ini）：每段對話自己選模型（存在對話裡），請求帶 model 就會自動載入（最多同時 2 個）
  const MODEL_NAMES = { "gemma26-q4": "Gemma 4 26B Q4", "qwen38-27b-q4": "Qwen3.8 27B Q4", "qwen36-35b-q4": "Qwen3.6 35B Q4" };
  const mName = (id) => MODEL_NAMES[id] || id;
  const aisoModelOf = (s) => { const L = aiso.models || [], ok = (id) => id && (!L.length || L.some((m) => m.id === id)); return ok(s && s.model) ? s.model : ok(cfg.aisoModel) ? cfg.aisoModel : (L.find((m) => m.loaded) || L[0] || {}).id || aiso.name || ""; };
  const AISO_DIRECT = ["http://localhost:18080/v1", "http://localhost:18082/v1"];   // 線上版直接連：先試看圖版（啟動器開的 18080 通道），再試文字版 18082
  const ready = () => (needKey() ? !!cfg.key : !!baseOf());
  const provName = () => ({ openai: "OpenAI", anthropic: "Claude", custom: "自訂", aiso1: "AISO1 本地" }[cfg.provider]);
  const aiso = { ok: null, name: "", wait: false, proxy: false, direct: "", vision: null, models: [] };   // 連線狀態、偵測到的模型名稱、是否卡在等瀏覽器允許
  // Chrome「區域網路存取」：公開網站（github.io）連本機 localhost 要宣告目標是 loopback，Chrome 才會跳出允許詢問
  const LNA = () => (cfg.provider === "aiso1" && /^http:\/\/(localhost|127\.0\.0\.1)/.test(baseOf()) && location.protocol === "https:" ? { targetAddressSpace: "loopback" } : {});
  const LAUNCH_HELP = "最穩的方式：在 Mac 上雙擊 Side Business 資料夾裡的「AISO1 辦公室 AI.command」，它會自動開通道並打開本機版辦公室（http://localhost:5180），AI 直接連 AISO1。";
  const LNA_HELP = "Chrome 網址列左側（或右側）若跳出「要存取區域網路上的裝置」→ 按「允許」。沒看到的話：點網址列左邊的圖示 →「網站設定」→「區域網路存取」設為允許，再重新整理。";
  const pingAiso = async () => {
    aiso.wait = false;
    if (!cfg.aisoBase && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {   // 本機啟動器有沒有在？
      try { const h = await fetch("/aiso1/health", { signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined }); aiso.proxy = h.status === 200 || h.status === 502; } catch (_) { aiso.proxy = false; }
    }
    const T = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
    if (!cfg.aisoBase && !aiso.proxy) {   // 沒有啟動器：挑一個連得到的（看圖版優先）
      for (const b of AISO_DIRECT) { try { const r = await fetch(b + "/models", { ...LNA(), signal: T(b === AISO_DIRECT[0] ? 5000 : 15000) }); if (r.ok) { aiso.direct = b; break; } } catch (_) {} }
    }
    try { const r = await fetch(baseOf() + "/models", { ...LNA(), signal: T(15000) }); const j = await r.json(); const id = (j.data && j.data[0] && j.data[0].id) || ""; aiso.models = (j.data || []).map((m) => ({ id: m.id, loaded: !m.status || m.status.value === "loaded", vision: m.architecture ? (m.architecture.input_modalities || []).includes("image") : null })); aiso.ok = r.ok; aiso.name = id.split("/").pop().replace(/\.gguf$/i, ""); }
    catch (e) { aiso.ok = false; aiso.wait = e && e.name === "TimeoutError"; }
    aiso.vision = null; if (aiso.models.length && aiso.models.every((m) => m.vision !== null)) aiso.vision = aiso.models.every((m) => m.vision);   // router：清單裡就寫了能不能看圖
    if (aiso.ok) { try { const pr = await (await fetch(baseOf().replace(/\/v1$/, "") + "/props", { ...LNA(), signal: T(5000) })).json(); if (pr && pr.modalities) aiso.vision = !!pr.modalities.vision; } catch (_) {} }
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
    s.ready = idbGet("chat:" + pid).then((v) => { if (v && Array.isArray(v.msgs) && !s.msgs.length) s.msgs = v.msgs; if (v && v.model && !s.model) s.model = v.model; s.notify(); });
    s.notify = () => s.subs.forEach((f) => f());
    s.save = () => idbSet("chat:" + pid, { msgs: s.msgs.slice(-60), model: s.model || "" });
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
  const officePrompt = (p) => `你是「AI 總管」：David 的 Side Business 辦公室總管，住在 David's Gallery（他的 3D 藝廊網站）裡，跑在公司機器 AISO1 的本地模型上。用繁體中文（台灣用語）、簡潔直接地回答。

【你的任務】
1. 掌握全局：你看得到每個 side business 專案白板上的目標、狀態、完成度、里程碑、Next Step、時程表。David 問「現在怎樣」「該先做哪個」「哪個卡住了」時，根據這些資料直接給判斷和理由，不要只複述資料。
2. 推進專案：幫 David 找出每個專案的瓶頸、排優先順序，建議要能執行、能衡量、能驗證（診斷瓶頸 → 小規模實驗 → 驗證），也要主動指出他可能沒想到但重要的問題。簡單問題簡單答，不要每題都套大框架。
3. 動手更新：David 說要記錄、更新、改狀態、改完成度、打勾里程碑、排任務時，你直接用工具改好白板（每次改動他都能一鍵復原），改完用一兩句話回報。只是問問題時不要動資料。
4. 回答網站問題：被問到藝廊 / 辦公室 / 你自己怎麼運作時，用 repo 工具查程式碼再回答（本機版才有）。你不能改程式碼——要改的話說清楚改哪個檔、哪幾行、改成什麼，交給 Claude Code 檢查後執行。
5. 看圖：David 貼截圖或照片時，說出你看到的重點，並連結到他的專案（如果目前的模型能看圖）。

` +
    `以下是目前所有專案的白板資料（需要時再引用，不要整份複述）：\n` +
    (p.projects || []).map((q) => `- ${q.name}${q.zh ? "（" + q.zh + "）" : ""}｜目標：${q.goal || "未設定"}｜狀態：${q.wbStatus || "未設定"}${q.wbNote ? "（" + q.wbNote + "）" : ""}｜Next Step：${q.next || "未設定"}｜完成度：${q.progress ?? 0}%${(q.milestones || []).length ? "（里程碑：" + q.milestones.map((m) => (m.done ? "✓" : "○") + m.text).join("、") + "）" : ""}`).join("\n");
  const sysPrompt = (p) => p.sys ? (typeof p.sys === "function" ? p.sys() : String(p.sys)) : p.office ? officePrompt(p) : `你是「${p.name}${p.zh ? "（" + p.zh + "）" : ""}」這個專案白板上的助理，用繁體中文、簡潔直接地回答。` +
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
    fn("complete_milestone", "把專案的某個里程碑打勾（完成）或取消打勾；有里程碑的專案，完成度就是依這個算", { project: PJ, milestone: { type: "string", description: "里程碑名稱（可以只寫部分）" }, done: { type: "boolean", description: "true = 完成（預設），false = 取消" } }, ["project", "milestone"]),
    fn("set_progress", "設定專案完成度 0–100%（只用在「沒有里程碑」的專案；有里程碑的請改用 complete_milestone）", { project: PJ, percent: { type: "number" } }, ["project", "percent"]),
    fn("add_task", "在專案時程表（PM 甘特圖）新增任務", { project: PJ, name: { type: "string" }, pri: { type: "string", enum: ["P0", "P1", "P2"] }, owner: { type: "string" }, status: { type: "string", enum: T_ST }, progress: { type: "number", description: "0–100" }, start: { type: "string", description: "YYYY-MM-DD" }, end: { type: "string", description: "YYYY-MM-DD" } }, ["project", "name"]),
    fn("update_task", "更新時程表上既有的任務（用任務名稱找）", { project: PJ, task: { type: "string", description: "任務名稱" }, status: { type: "string", enum: T_ST }, progress: { type: "number" }, end: { type: "string" }, owner: { type: "string" }, pri: { type: "string", enum: ["P0", "P1", "P2"] } }, ["project", "task"]),
  ];
  // 唯讀看 repo：只有從 Mac 上的啟動器（AISO1 辦公室 AI.command）打開時才有，由啟動器讀 david-side-business/ 的檔案與 git 紀錄
  const REPO_TOOLS = [
    fn("repo_tree", "列出網站 repo（david-side-business）的檔案與大小", { dir: { type: "string", description: "子資料夾，例如 js；留空 = 全部" } }, []),
    fn("repo_search", "在 repo 程式碼裡搜尋文字（不分大小寫），回傳 檔案:行號:內容", { query: { type: "string" }, glob: { type: "string", description: "限定檔案，例如 js/*.js" } }, ["query"]),
    fn("repo_read", "讀 repo 裡的文字檔（附行號，一次最多約 9000 字；太長就用 start_line 分段讀）", { path: { type: "string", description: "例如 js/store.js" }, start_line: { type: "number" }, end_line: { type: "number" } }, ["path"]),
    fn("repo_git", "看 git 紀錄：log = 最近的 commit，status = 目前未提交的改動", { kind: { type: "string", enum: ["log", "status"] }, n: { type: "number" } }, ["kind"]),
  ];
  const repoOn = () => aiso.proxy && cfg.provider === "aiso1";
  const repoTool = async (name, a) => {
    const q = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== null).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    const url = name === "repo_tree" ? "/repo/tree?" + q({ dir: a.dir }) : name === "repo_search" ? "/repo/search?" + q({ q: a.query, glob: a.glob }) : name === "repo_read" ? "/repo/read?" + q({ path: a.path, start: a.start_line, end: a.end_line }) : "/repo/" + (a.kind === "status" ? "status" : "log") + "?" + q({ n: a.n });
    let j; try { j = await (await fetch(url)).json(); } catch (e) { return { res: { ok: false, error: "讀不到 repo：" + e.message }, label: "✗ 讀不到 repo" }; }
    const label = !j.ok ? j.error : name === "repo_tree" ? `看了檔案列表${a.dir ? "（" + a.dir + "）" : ""}：${(j.files || []).length} 個檔案` : name === "repo_search" ? `搜尋「${a.query}」：${j.total} 筆` : name === "repo_read" ? `讀了 ${a.path} 第 ${j.from}–${j.to} 行（共 ${j.total_lines} 行）` : `看了 git ${a.kind === "status" ? "status" : "log"}`;
    return { res: j, label };
  };
  /* 做事的方式（照 Claude Code 的習慣寫給本地模型）：自己查、自己做、講結論，不要叫 David 跑工具、不要空泛教學 */
  const WAY = (p) => `\n\n【你是怎麼做事的】
1. 工具是你自己呼叫的。絕對不要叫 David 去執行 repo_tree / repo_search 之類的工具、也不要說「請把程式碼貼給我」——${repoOn() ? "需要看程式就自己查" : "（現在是線上版，沒有 repo 工具；需要看程式時說明要從 Mac 上的「AISO1 辦公室 AI.command」打開本機版）"}。
2. 先查證再說。不知道就查；查不到就說查不到。不要猜架構（這個網站是純 HTML / CSS / JS，沒有 React / Vue）。
3. 直接給結論和做法，不要寫「三層架構」「第一層、第二層」那種教科書式的大綱，也不要反問「你要現在開始嗎？」。
4. 誠實說明能力邊界：你能改白板資料（狀態、進度、完成度 %、里程碑打勾、Next Step、目標、時程表）${repoOn() ? "、能讀程式碼 repo" : ""}；你「不能」改網站程式碼、不能操作 AISO1 主機。被要求改介面 / 程式時：${repoOn() ? "先自己用工具找到相關程式，" : ""}說清楚「改哪個檔、哪幾行、改成什麼」，並說這種程式改動要交給 Claude Code（David 電腦上的開發助理）執行。
5. 錯誤訊息要翻成白話、講原因和解法。這裡的已知狀況：
   - 「image input is not supported … mmproj」= 目前連到的模型沒有載入看圖用的 mmproj（AISO1 的 18082 是純文字版；8080 才是看圖版）。解法：從 Mac 雙擊「AISO1 辦公室 AI.command」打開本機版，它會自動用看圖版；或在 AISO1 上執行 ~/start-llama-8080.sh。
   - 連不到 AISO1 = SSH 通道或模型服務沒開；同樣是用那個 .command 啟動器最簡單。
6. 資料改了會「立刻」反映在畫面上（同一個瀏覽器，不用重新整理）。絕對不要叫 David 重新整理、清快取、重開分頁。各欄位顯示在哪：
   - 辦公室列表每一列 = 專案名 + 狀態 + 「目前進度一句話」（update_project 的 note）+ 完成度 %；note 沒填時才顯示最近一筆進度紀錄，再沒有才顯示目標。
   - 目標、里程碑、Next Step 完整顯示在專案頁（#/p/專案id）的白板。
   所以 David 要「更新某專案」時，除了 goal，也要寫一句 note，辦公室那列才看得到變化；回報時說清楚「改了什麼、在哪裡看得到」。
7. David 說「沒改」「不能用」時：不要辯解、不要怪網站或瀏覽器，先看上面的專案資料確認有沒有寫進去，沒有就重做一次工具呼叫；有寫進去就直接告訴他在哪裡看得到。回答控制在三五句。
8. 這個介面本身：AI 總管的程式在 js/ai.js（對話、工具、對話紀錄側欄 mountConv）、js/santa.js（報紙下的聖誕老人）、js/robot.js（3D 辦公室機器人），樣式在 css/style.css。對話存在這個瀏覽器的 IndexedDB，對話清單在 localStorage（dsb-convs:*）。

【範例】David 問：「報紙下面的聖誕老人可以換成麋鹿嗎？」
好的回答（先 repo_search「santa」、repo_read js/santa.js）：「可以，但這是改程式：聖誕老人的圖是 js/santa.js 開頭的 SVG 常數（第 8–23 行），搖擺動畫在 css/style.css 的 .santa-sway。要換成麋鹿就是把那段 SVG 換成麋鹿的造型，動畫和『滑鼠移過去跳出對話』都不用動。我不能直接改程式，請交給 Claude Code 執行，跟它說『把 js/santa.js 的聖誕老人 SVG 換成麋鹿』就好。」
不好的回答：叫 David 自己執行 repo_tree、沒查就猜是 React、列三層架構大綱、最後問「要開始嗎？」。`;
  const toolPrompt = (p) => `\n\n你可以用工具直接更新 David 的藝廊（白板狀態、進度、Next Step、目標、里程碑、時程表任務）。今天是 ${window.Store ? window.Store.today() : ""}。` +
    `David 要你記錄、更新、改狀態、排任務時，一定要真的呼叫工具去做（每次都要，即使之前做過類似的事），不要只在文字裡說「已更新」、不要寫「[已執行]」之類的字，也不要叫他自己改；只是問問題時就不要動資料。工具執行完再用一兩句話回報。` +
    (repoOn() ? `\n你也能「唯讀」查看這個網站的程式碼 repo（david-side-business：3D 藝廊、辦公室、AI 總管本身的程式都在裡面）：repo_tree / repo_search / repo_read / repo_git。被問到網站怎麼運作、程式在哪、最近改了什麼時，先用工具查證再回答，引用檔名與行號，不要猜；你不能改程式碼，要改的話提出具體建議（哪個檔、哪幾行、改成什麼）。檔案大就先 repo_search 找位置再分段 repo_read。` : "") +
    WAY(p) +
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
      } else if (name === "complete_milestone") {
        const L = pj.milestones || [], q = squash(a.milestone), m = L.find((x) => squash(x.text) === q) || L.find((x) => squash(x.text).includes(q) || q.includes(squash(x.text)));
        if (!m) return { ok: false, error: `${nm} 找不到里程碑「${a.milestone || ""}」` + (L.length ? `（現有：${L.map((x) => x.text).join("、")}）` : "（這個專案還沒有里程碑）") };
        const want = a.done !== false; if (!!m.done !== want) S.toggleMilestone(pj.id, m.id);
        done.push(`里程碑「${m.text}」${want ? "✓ 完成" : "取消完成"} → 完成度 ${pj.progress}%`);
      } else if (name === "set_progress") {
        if ((pj.milestones || []).length) return { ok: false, error: `${nm} 有 ${pj.milestones.length} 個里程碑，完成度是依里程碑算的（目前 ${pj.progress}%）；請改用 complete_milestone 打勾` };
        const v = S.setProgress(pj.id, a.percent); if (v === null) return { ok: false, error: "設定失敗" };
        done.push(`完成度 → ${v}%`);
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

  async function callAI(s, p, signal, onDelta, opt = {}) {
    const useM = opt.model || (cfg.provider === "aiso1" && !cfg.model.trim() ? aisoModelOf(s) : "");
    // 比較模式的回答（cmp）每個模型各一則：只把「同一個模型」自己的那則放回對話紀錄
    const hist = s.msgs.filter((m) => m.role === "user" || (m.role === "ai" && !m.live && (!m.cmp || m.model === useM || (!useM && m.cmpFirst)))).slice(-24);
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
      const base = baseOf(), useTools = cfg.tools !== false && !!window.Store && !opt.compare && !p.noTools, messages = [{ role: "system", content: sysPrompt(p) + (useTools ? toolPrompt(p) : "") }];
      for (const m of hist) {
        if (m.role === "user") {
          const noEyes = cfg.provider === "aiso1" && aiso.vision === false;   // 目前的模型不能看圖：不要把圖送過去（不然整段對話都會報錯），改成文字說明
          if (noEyes && (m.imgs || []).length) messages.push({ role: "user", content: (m.text || "") + `\n（附了 ${m.imgs.length} 張圖片，但目前連到的模型不能看圖）` });
          else messages.push({ role: "user", content: (m.imgs || []).length ? [...m.imgs.map((u) => ({ type: "image_url", image_url: { url: u } })), { type: "text", text: m.text || "（圖片）" }] : (m.text || "（圖片）") });
        }
        else {
          const calls = (m.actions || []).filter((a) => a.name);   // 之前真的呼叫過的工具：照原樣放回去（工具呼叫 + 結果），模型才會學到要真的呼叫
          if (calls.length) { messages.push({ role: "assistant", content: "", tool_calls: calls.map((a, k) => ({ id: "h" + hist.indexOf(m) + "_" + k, type: "function", function: { name: a.name, arguments: JSON.stringify(a.args || {}) } })) });
            calls.forEach((a, k) => messages.push({ role: "tool", tool_call_id: "h" + hist.indexOf(m) + "_" + k, content: JSON.stringify(a.fail ? { ok: false, error: a.text } : { ok: true, text: a.text + (a.read ? "（內容已省略，需要的話再讀一次）" : "") + (m.undone ? "（之後被 David 復原了）" : "") }) })); }
          messages.push({ role: "assistant", content: m.text || (calls.length ? "完成。" : "（圖片）") });
        }
      }
      const headers = { "content-type": "application/json" }; if (cfg.key) headers.authorization = "Bearer " + cfg.key;
      const tidy = (t) => String(t || "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^\s+/, "");
      const stats = (tm, us, model) => { const name = String(model || "").split("/").pop().replace(/\.gguf$/i, ""), n = tm ? tm.predicted_n : us && us.completion_tokens;
        // TTFT = 按下送出到第一個字（含思考 / 工具呼叫）出現，瀏覽器端實測；TPOT = 每個輸出 token 平均幾 ms（伺服器 timings）
        const sec = (ms) => (ms >= 10000 ? (ms / 1000).toFixed(0) : (ms / 1000).toFixed(1)) + " s", tpot = tm && tm.predicted_n > 1 && tm.predicted_ms ? tm.predicted_ms / tm.predicted_n : 0;
        return [name, n ? n + " tokens" : "", tm && tm.predicted_per_second ? tm.predicted_per_second.toFixed(1) + " tok/s" : "", tFirst ? "TTFT " + sec(tFirst - t0) : "", tpot ? "TPOT " + Math.round(tpot) + " ms" : "", tm && tm.prompt_n ? "讀入 " + tm.prompt_n + " tokens" : "", "總共 " + sec(performance.now() - t0)].filter(Boolean).join(" · "); };
      let text = "", think = "", tm = null, us = null, model = "", undo = null, tFirst = 0; const actions = [], t0 = performance.now();
      const push = () => onDelta && onDelta({ text: tidy(text), think, actions });
      // 最多 4 輪：模型呼叫工具 → 這裡執行（直接改藝廊資料）→ 把結果交回模型 → 模型回報做了什麼
      for (let round = 0; round < 8; round++) {
        const body = { messages, stream: true }; const mdlId = useM || modelOf(); if (mdlId) body.model = mdlId;
        body.chat_template_kwargs = { enable_thinking: !!cfg.think };          // llama.cpp：要不要先「思考」再回答
        if (cfg.temp !== "" && !isNaN(+cfg.temp)) body.temperature = +cfg.temp;
        if (+cfg.maxTok > 0) body.max_tokens = Math.round(+cfg.maxTok);
        if (useTools && round < 7) body.tools = repoOn() ? TOOLS.concat(REPO_TOOLS) : TOOLS;
        let r;
        try { r = await fetch(base + "/chat/completions", { ...LNA(), method: "POST", signal, headers, body: JSON.stringify(body) }); }
        catch (e) { if (e.name === "AbortError") throw e; throw new Error(cfg.provider === "aiso1" ? `連不到 AISO1（${base}）。${LAUNCH_HELP} 或確認：① 瀏覽器允許這個網站存取本機：${LNA_HELP} ② 這台 Mac 的 SSH 通道有開：${AISO_TUNNEL}（出現 Address already in use 代表已經開著，沒問題）③ AISO1 上的模型服務在跑。` : `連不到 ${base}：${e.message}`); }
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${r.status}`); }
        const calls = []; let rtext = "";
        if (!/event-stream/.test(r.headers.get("content-type") || "") || !r.body) {   // 端點不支援串流：當成一般回應
          const j = await r.json().catch(() => ({})), ch = (j.choices && j.choices[0] && j.choices[0].message) || {};
          if (!tFirst) tFirst = performance.now(); rtext = ch.content || ""; think += ch.reasoning_content || ""; tm = j.timings || tm; us = j.usage || us; model = j.model || model;
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
              if (!tFirst && (dl.content || dl.reasoning_content || dl.tool_calls)) tFirst = performance.now();
              for (const tc of dl.tool_calls || []) { const k = tc.index ?? calls.length; const c = (calls[k] = calls[k] || { id: "", name: "", args: "" }); if (tc.id) c.id = tc.id; if (tc.function) { if (tc.function.name) c.name += tc.function.name; if (tc.function.arguments) c.args += tc.function.arguments; } }
              if (j.timings) tm = j.timings; if (j.usage) us = j.usage; if (j.model) model = j.model;
              if (onDelta) onDelta({ text: tidy(text + (rtext ? lead + rtext : "")), think, actions });
            }
          }
          if (rtext) text += lead + rtext;
        }
        const todo = calls.filter((c) => c && c.name); if (!todo.length) break;
        if (undo === null && todo.some((c) => !/^repo_/.test(c.name))) { try { undo = localStorage.getItem(STORE_KEY) || "{}"; } catch (_) { undo = "{}"; } }   // 第一次改動前先存一份，讓 David 可以一鍵復原
        messages.push({ role: "assistant", content: rtext || "", tool_calls: todo.map((c, k) => ({ id: c.id || "call_" + round + "_" + k, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) });
        for (const [k, c] of todo.entries()) { let a = {}; try { a = JSON.parse(c.args || "{}"); } catch (_) {}
          if (/^repo_/.test(c.name)) {   // 唯讀查 repo：結果完整交給模型，畫面上只顯示「看了什麼」
            const { res, label } = await repoTool(c.name, a); actions.push({ text: label, read: true, fail: !res.ok, name: c.name, args: a });
            messages.push({ role: "tool", tool_call_id: c.id || "call_" + round + "_" + k, content: JSON.stringify(res) }); push(); continue;
          }
          const res = runTool(p, c.name, a); actions.push(res.ok ? { text: res.text, name: c.name, args: a } : { text: res.error, fail: true, name: c.name, args: a });
          messages.push({ role: "tool", tool_call_id: c.id || "call_" + round + "_" + k, content: JSON.stringify(res) }); }
        push();
      }
      const out = { text: tidy(text).trim(), think: think.trim(), imgs: [], meta: stats(tm, us, model) };
      if (actions.length) { out.actions = actions; if (undo !== null && actions.some((a) => !a.fail && !a.read)) out.undo = undo; }
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

  // 比較模式：同一個問題同時丟給 AISO1 上的每個模型，並排顯示（只回答、不改白板，避免同一件事被改三次）
  const CMP = "__all";
  async function sendCompare(s, p) {
    const L = aiso.models.map((m) => m.id); let raf = 0;
    const lives = L.map((id, k) => ({ role: "ai", cmp: true, cmpFirst: k === 0, model: id, text: "", imgs: [], at: Date.now(), live: true, meta: mName(id) + " · 等待中…" }));
    s.msgs.push(...lives); s.notify();
    await Promise.all(L.map(async (id, k) => {
      const m = lives[k], onDelta = (d) => { m.text = d.text; m.think = d.think; m.meta = mName(id) + " · 回答中…"; if (!raf) raf = requestAnimationFrame(() => { raf = 0; s.notify(); }); };
      try { const out = await callAI(s, p, s.ctl.signal, onDelta, { model: id, compare: true }); m.text = out.text || "（沒有回應）"; if (out.think) m.think = out.think; m.meta = out.meta || mName(id); }
      catch (e) { m.meta = mName(id) + (e.name === "AbortError" ? " · （已停止）" : " · （中斷）" + (e.message ? "：" + e.message : "")); }
      delete m.live; s.notify();
    }));
    cancelAnimationFrame(raf); s.pending = false; s.ctl = null; s.notify(); s.save();
  }

  async function send(s, p, text, imgs) {
    if (s.pending) return; text = String(text || "").trim(); if (!text && !imgs.length) return;
    s.msgs.push({ role: "user", text, imgs: imgs.slice(), at: Date.now() }); s.pending = true; s.ctl = new AbortController(); s.notify();
    if (s.model === CMP && cfg.provider === "aiso1" && (aiso.models || []).length > 1) return sendCompare(s, p);
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
  // 簡易 Markdown：標題、清單、分隔線、粗體、程式碼（本地模型很愛用 ### 和 *）
  const inl = (x) => x.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
  const fmt = (t) => {
    const blocks = []; let h = esc(unTex(t)).replace(/```([\s\S]*?)```/g, (_, c) => { blocks.push(`<pre>${c.replace(/^\w*\n/, "")}</pre>`); return `\u0000${blocks.length - 1}\u0000`; });
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`<${list.tag}${list.start > 1 ? ` start="${list.start}"` : ""}>${list.items.map((x) => `<li>${inl(x)}</li>`).join("")}</${list.tag}>`); list = null; } };
    for (const ln of h.split("\n")) {
      let m;
      if (/^\u0000\d+\u0000$/.test(ln.trim())) { close(); out.push(ln.trim()); }
      else if ((m = /^\s*#{1,6}\s+(.*)$/.exec(ln))) { close(); out.push(`<h4 class="ai-h">${inl(m[1].replace(/\*\*/g, ""))}</h4>`); }
      else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { close(); out.push("<hr>"); }
      else if ((m = /^\s*[*\-•]\s+(.*)$/.exec(ln))) { if (!list || list.tag !== "ul") { close(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); }
      else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { if (!list || list.tag !== "ol") { close(); list = { tag: "ol", items: [], start: parseInt(ln, 10) || 1 }; } list.items.push(m[1]); }
      else if (!ln.trim()) { close(); out.push("<br>"); }
      else { close(); out.push(`<span class="ai-p">${inl(ln)}</span>`); }
    }
    close();
    return out.join("").replace(/(<br>){2,}/g, "<br>").replace(/^<br>|<br>$/g, "").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
  };

  function mount(el, p) {
    const s = session(p.id); let draft = [];
    el.innerHTML = `<div class="ai">
      <div class="ai-bar"><span class="ai-title"></span><span class="ai-sp"></span><select data-mdl hidden aria-label="這段對話用的模型" title="這段對話用哪個模型（沒載入的會自動載入，約 5–10 秒）"></select><button type="button" data-new>新對話</button><button type="button" data-cfg aria-label="設定">⚙</button></div>
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
      <form class="ai-form ai-composer"><textarea rows="1" placeholder="想問什麼，都可以寫在這裡⋯" aria-label="訊息"></textarea>
        <div class="ai-comp-row"><button type="button" class="ai-att" data-att aria-label="附加圖片" title="附加圖片（也可以直接貼上或拖進來）"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5 12.6 19.9a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8"/></svg></button>
          <span class="ai-comp-hint">Enter 送出　·　Shift + Enter 換行</span><button type="submit" data-send>送出</button></div>
        <input type="file" accept="image/*" multiple hidden></form>
    </div>`;
    const q = (x) => el.querySelector(x), msgs = q(".ai-msgs"), ta = q("textarea"), prev = q(".ai-prev"), cfgBox = q(".ai-cfg"), file = q("input[type=file]"), sendBtn = q("[data-send]");
    const pickCmp = (e) => { const b = e.target.closest && e.target.closest("[data-ct]"); if (!b) return; const g = b.closest(".ai-cmpgrid"), k = +b.dataset.ct; if (!g || b.classList.contains("on")) return; cmpSel[g.dataset.ck] = k; g.querySelectorAll("[data-ct]").forEach((x) => x.classList.toggle("on", x === b)); g.querySelectorAll("[data-cc]").forEach((x) => (x.hidden = +x.dataset.cc !== k)); };
    msgs.addEventListener("mouseover", pickCmp); msgs.addEventListener("click", pickCmp); msgs.addEventListener("focusin", pickCmp);
    const title = () => {
      const st = cfg.provider !== "aiso1" ? "" : aiso.ok === null ? " · 連線中…（等瀏覽器允許）" : aiso.ok ? " · ● 已連線" + (aiso.vision === true ? " · 可看圖" : aiso.vision === false ? " · 不能看圖" : "") : aiso.wait ? " · ◌ 等待瀏覽器允許" : " · ○ 未連線";
      const mdl = modelOf() || (cfg.provider === "aiso1" && (s.model === CMP ? `${(aiso.models || []).length} 個模型比較` : mName(aisoModelOf(s)))) || "預設模型";
      q(".ai-title").textContent = `AI · ${provName()} · ${mdl}${st}`; q(".ai-title").classList.toggle("ai-off", cfg.provider === "aiso1" && aiso.ok === false);
      const sel = q("[data-mdl]"), L = aiso.models || []; if (sel) { sel.hidden = cfg.provider !== "aiso1" || !!cfg.model.trim() || L.length < 2; const cur = aisoModelOf(s);
        if (!sel.hidden) { sel.innerHTML = L.map((m) => `<option value="${esc(m.id)}">${esc(mName(m.id))}${m.loaded ? "" : "（需載入）"}</option>`).join("") + `<option value="${CMP}">⚡ ${L.length} 個一起比較</option>`; sel.value = s.model === CMP ? CMP : cur; } }
      const hs = q("[data-aiso-st]"); if (hs) hs.textContent = cfg.provider !== "aiso1" ? "" : aiso.ok ? `　目前：已連線（${aiso.name}）` : aiso.ok === false ? "　目前：連不到" : "";
    };
    const checkAiso = () => { if (cfg.provider !== "aiso1") return; aiso.ok = null; title(); pingAiso().then(() => { if (el.isConnected) { title(); paint(); } }); };
    const paintPrev = () => { prev.innerHTML = draft.map((u, i) => `<span class="ai-th"><img src="${u}" alt=""><button type="button" data-rm="${i}" aria-label="移除">×</button></span>`).join(""); prev.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { draft.splice(+b.dataset.rm, 1); paintPrev(); })); };
    const paint = () => {
      const empty = cfg.provider === "aiso1" && aiso.ok === false ? `<p class="ai-empty">還連不到 AISO1 本地模型。<br><b>${esc(LAUNCH_HELP)}</b><br><br>在線上網站直接連的話：<br><b>① 允許瀏覽器連本機：</b>${esc(LNA_HELP)}<br><b>② SSH 通道：</b>終端機執行 <code>${esc(AISO_TUNNEL)}</code>（出現 Address already in use 代表已經開著）<br><b>③</b> AISO1 上的模型服務要在跑。都好了就按 <button type="button" class="ai-retry" data-retry>重新連線</button></p>` : !ready() ? `<p class="ai-empty">先按右上角 ⚙ 設定${needKey() ? "你的 API Key" : "端點網址"}，就能開始聊天。</p>` : `<p class="ai-empty">${p.office ? "問我整體進度、該先做哪個專案、下一步怎麼走都可以" : "問我關於「" + esc(p.name) + "」的任何事"}。可以丟文字或圖片。</p>`;
      const last = s.msgs[s.msgs.length - 1];
      const one = (m) => `<div class="ai-m ai-${m.role}${m.live ? " ai-live" : ""}${m.cmp ? " ai-cmp" : ""}"><div class="ai-b">${m.think ? `<details class="ai-think"${m.live && !m.text ? " open" : ""}><summary>思考過程</summary>${fmt(m.think)}</details>` : ""}${m.text ? fmt(m.text) : ""}${(m.imgs || []).map((u) => `<a class="ai-imgwrap" href="${u}" download="image.${/png/.test(u.slice(0, 20)) ? "png" : "jpg"}" title="點一下下載"><img class="ai-img" src="${u}" alt=""></a>`).join("")}${(m.actions || []).length ? `<div class="ai-acts">${m.actions.map((x) => `<div class="${x.fail ? "fail" : ""}${x.read ? " read" : ""}${m.undone && !x.read ? " undone" : ""}">${x.fail ? "✗" : x.read ? "⌕" : "✓"} ${esc(x.text)}</div>`).join("")}${m.undo && !m.live ? (m.undone ? `<span class="ai-undone">已復原</span>` : `<button type="button" class="ai-undo" data-undo="${s.msgs.indexOf(m)}">復原這次改動</button>`) : ""}</div>` : ""}${m.meta ? `<div class="ai-meta">${esc(m.meta)}</div>` : ""}</div></div>`;
      let html = ""; for (let i = 0; i < s.msgs.length; i++) { const m = s.msgs[i]; if (!m.cmp) { html += one(m); continue; } const grp = []; while (i < s.msgs.length && s.msgs[i].cmp) grp.push(s.msgs[i++]); i--;   // 比較模式：同一題的幾個模型回答，上方一排分頁，滑鼠移過去（或點）就切換看哪一個
        const ck = String(grp[0].at), cs = Math.min(cmpSel[ck] ?? 0, grp.length - 1);
        html += `<div class="ai-cmpgrid ai-cmptabbed" data-ck="${ck}"><div class="ai-cmptabs" role="tablist">${grp.map((m, k) => `<button type="button" role="tab" data-ct="${k}" class="${k === cs ? "on" : ""}${m.live ? " live" : ""}">${esc(mName(m.model))}</button>`).join("")}</div>${grp.map((m, k) => `<div class="ai-cmpcol" data-cc="${k}"${k === cs ? "" : " hidden"}>${one(m)}</div>`).join("")}</div>`; }
      msgs.innerHTML = (s.msgs.length ? html : empty) + (s.pending && !(last && (last.live || last.cmp)) ? `<div class="ai-m ai-ai"><div class="ai-b ai-dots"><i></i><i></i><i></i></div>${cfg.provider === "aiso1" && !aiso.ok ? `<div class="ai-hint">等待連到 AISO1…${esc(LNA_HELP)}</div>` : ""}</div>` : "");
      msgs.scrollTop = msgs.scrollHeight; sendBtn.textContent = s.pending ? "停止" : "送出"; sendBtn.classList.toggle("stop", !!s.pending);
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
    // 輸入框跟著文字長高（最多到視窗高度的 45%，再多就在框內捲動）
    const grow = () => { ta.style.height = "auto"; const max = Math.round(innerHeight * 0.45); ta.style.height = Math.min(max, ta.scrollHeight) + "px"; ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden"; };
    ta.addEventListener("input", grow); ta.addEventListener("paste", () => setTimeout(grow, 0));
    const addFiles = async (fs) => { for (const f of [...fs].filter((x) => /^image\//.test(x.type)).slice(0, 4 - draft.length)) { try { draft.push(await fileToImg(f)); } catch (_) {} } paintPrev(); };
    q("[data-att]").addEventListener("click", () => file.click()); file.addEventListener("change", () => { addFiles(file.files); file.value = ""; });
    ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData ? e.clipboardData.files : [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
    const area = q(".ai"); area.addEventListener("dragover", (e) => { e.preventDefault(); }); area.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    q("[data-new]").addEventListener("click", () => { if (p.onNew) { p.onNew(); return; } if (s.pending && s.ctl) s.ctl.abort(); s.msgs = []; s.pending = false; s.save(); s.notify(); });   // 有對話清單時：開新的一段，舊的留著
    q("[data-cfg]").addEventListener("click", () => { cfgBox.hidden = !cfgBox.hidden; });
    q("[data-mdl]").addEventListener("change", (e) => { s.model = e.target.value; if (s.model !== CMP) { cfg.aisoModel = s.model; saveCfg(); } s.save(); title(); });   // 這段對話換模型；之後開的新對話也預設用它
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

  /* ---------- 工作階段（像 VS Code 的終端機面板）----------
     右側清單：好幾個 AI 對話 + AISO1 終端機，點一下切換，＋ 新增；背景裡的對話照樣在跑（清單上有橘點）。
     AISO1 的 llama.cpp 有 NP 個 slot（目前 2）：同時最多 NP 個一起算，其餘自動排隊。上方顯示即時 slot 使用量。 */
  const PANES_KEY = "dsb-ai-panes", SEL_KEY = "dsb-ai-sel";
  const TERM_ITEMS = [];   // { n, box, h }：終端機在重畫時保留（AI 改了白板會重畫辦公室）
  function mountMulti(el, p) {
    let ids = [1]; try { const v = JSON.parse(localStorage.getItem(PANES_KEY) || "[1]"); if (Array.isArray(v) && v.length) ids = v.filter((x) => Number.isInteger(x) && x > 0).slice(0, 8); } catch (_) {}
    if (!ids.length) ids = [1];
    let sel = "ai:" + ids[0]; try { const v = localStorage.getItem(SEL_KEY) || ""; if (/^ai:\d+$/.test(v) && ids.includes(+v.slice(3))) sel = v; } catch (_) {}
    if (window.__aiSel && (window.__aiSel === "dash" || (/^term:/.test(window.__aiSel) ? TERM_ITEMS.some((t) => "term:" + t.n === window.__aiSel) : ids.includes(+window.__aiSel.slice(3))))) sel = window.__aiSel;
    const keep = () => { try { localStorage.setItem(PANES_KEY, JSON.stringify(ids)); if (/^ai:/.test(sel)) localStorage.setItem(SEL_KEY, sel); } catch (_) {} window.__aiSel = sel; };
    const sid = (k) => (k === 1 ? p.id : p.id + "#" + k);
    let timer = 0, slotsCool = 0;
    const slots = async () => {   // AISO1 正在算幾個 / 總共幾個
      const box = el.querySelector("[data-slots]"); if (!box || !el.isConnected) { clearInterval(timer); return; }
      if (cfg.provider !== "aiso1" || Date.now() < slotsCool) { if (cfg.provider !== "aiso1") box.textContent = ""; return; }
      try { const r = await fetch(baseOf().replace(/\/v1$/, "") + "/slots" + ((aiso.models || []).length > 1 ? "?model=" + encodeURIComponent(aisoModelOf(null)) : ""), { ...LNA(), signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined }); const j = await r.json();
        if (Array.isArray(j)) { const busy = j.filter((x) => x.is_processing).length, waiting = Object.values(sessions).filter((x) => x.pending).length - busy;
          box.innerHTML = `AISO1 並行 <b>${busy}</b> / ${j.length} 個 slot 運算中${waiting > 0 ? `　·　${waiting} 個排隊` : ""}`; box.classList.toggle("busy", busy > 0); } }
      catch (_) { box.textContent = ""; slotsCool = Date.now() + 20000; }   // 連不到就先停 20 秒，不要一直刷錯誤
    };
    const label = (k) => { const s2 = sessions[sid(k)], first = s2 && s2.msgs.find((m) => m.role === "user"); return first && first.text ? first.text.slice(0, 18) + (first.text.length > 18 ? "…" : "") : "新對話"; };
    const termOK = !!(window.AisoTerm && window.AisoTerm.available());
    el.innerHTML = `<div class="ai-multi-bar"><span class="ai-slots" data-slots></span></div>
      <div class="vs"><div class="vs-main" data-main></div>
        <aside class="vs-side" aria-label="工作階段">
          <div class="vs-side-h"><span>工作階段</span><span class="ai-sp"></span>
            <button type="button" class="vs-plus" data-plus title="新增 AI 對話" aria-label="新增 AI 對話">＋</button>
            <button type="button" class="vs-more" data-more aria-haspopup="menu" aria-label="新增其他">⌄</button>
            <div class="vs-menu" data-menu hidden role="menu"><button type="button" role="menuitem" data-mk="ai">✦　AI 對話</button><button type="button" role="menuitem" data-mk="term" ${termOK ? "" : "disabled title=\"要從 AISO1 辦公室 AI.command 打開的本機版才能開\""}>⌨　AISO1 終端機${termOK ? "" : "（本機版才有）"}</button></div>
          </div>
          <ul class="vs-list" data-list></ul>
        </aside></div>`;
    const main = el.querySelector("[data-main]"), list = el.querySelector("[data-list]"), menu = el.querySelector("[data-menu]");
    const views = {};   // key → view div
    const aiView = (k) => { const d = document.createElement("div"); d.className = "vs-view"; d.dataset.key = "ai:" + k; main.appendChild(d); mount(d, { ...p, id: sid(k), onNew: () => newAI() }); /* 「新對話」= 在右邊清單開一個新的，舊的留著 */ views["ai:" + k] = d; return d; };
    ids.forEach(aiView);
    // 「儀表板」分頁：右側清單最上面，點一下在同一個視窗看到全部專案現況（不用關掉 AI 視窗）
    const dashView = document.createElement("div"); dashView.className = "vs-view vs-dashview"; dashView.dataset.key = "dash"; dashView.hidden = true; main.appendChild(dashView); views.dash = dashView;
    const drawDash = () => { dashView.innerHTML = window.Dash ? window.Dash.html(p.projects || []) : "<p class=\"dh-empty\">儀表板載入失敗。</p>"; };
    TERM_ITEMS.forEach((t) => { const d = document.createElement("div"); d.className = "vs-view vs-termview"; d.dataset.key = "term:" + t.n; d.appendChild(t.box); main.appendChild(d); views["term:" + t.n] = d; });
    const paintList = () => {
      if (!el.isConnected) return;
      const rows = [`<li class="vs-dash ${sel === "dash" ? "on" : ""}" data-key="dash" title="全部專案現況"><span class="vs-ic">▦</span><span class="vs-name">儀表板</span></li>`].concat(ids.map((k) => { const s2 = sessions[sid(k)], run = s2 && s2.pending; return `<li class="${sel === "ai:" + k ? "on" : ""}" data-key="ai:${k}" title="AI 對話 ${k}"><span class="vs-ic">✦</span><span class="vs-name">${esc(label(k))}</span>${run ? `<i class="vs-run" title="正在回答"></i>` : ""}${ids.length > 1 ? `<button type="button" data-x="ai:${k}" aria-label="關閉">×</button>` : ""}</li>`; })
        .concat(TERM_ITEMS.map((t) => `<li class="${sel === "term:" + t.n ? "on" : ""}${t.h && !t.h.alive ? " dead" : ""}" data-key="term:${t.n}"><span class="vs-ic">⌨</span><span class="vs-name">AISO1 · bash ${t.n}${t.h ? (t.h.alive ? "" : "（已斷線）") : "（連線中…）"}</span><button type="button" data-x="term:${t.n}" aria-label="關閉">×</button></li>`)));
      list.innerHTML = rows.join("");
      list.querySelectorAll("li").forEach((li) => li.addEventListener("click", (e) => { const x = e.target.closest("[data-x]"); if (x) { e.stopPropagation(); closeItem(x.dataset.x); return; } show(li.dataset.key); }));
    };
    const show = (key) => {
      if (!views[key]) key = "ai:" + ids[0]; sel = key; keep(); if (key === "dash") drawDash();
      Object.entries(views).forEach(([k2, d]) => (d.hidden = k2 !== key));
      paintList();
      const t = TERM_ITEMS.find((x) => "term:" + x.n === key);
      if (t && t.h) requestAnimationFrame(() => { t.h.fit(); t.h.focus(); }); else { const ta = views[key] && views[key].querySelector("textarea"); ta && !matchMedia("(hover: none)").matches && ta.focus({ preventScroll: true }); }
    };
    const newAI = () => { let k = 1; while (ids.includes(k)) k++; ids.push(k); aiView(k); show("ai:" + k); };
    const newTerm = async () => {
      let n = 1; while (TERM_ITEMS.some((t) => t.n === n)) n++;
      const box = document.createElement("div"); box.className = "tm-box"; const it = { n, box, h: null }; TERM_ITEMS.push(it);
      const d = document.createElement("div"); d.className = "vs-view vs-termview"; d.dataset.key = "term:" + n; d.appendChild(box); main.appendChild(d); views["term:" + n] = d; show("term:" + n);
      try { it.h = await window.AisoTerm.create(box, paintList); } catch (e) { box.innerHTML = `<p class="tm-note"><b>開不起來：</b>${esc(e.message)}。請確認是用「AISO1 辦公室 AI.command」打開的本機版，而且啟動器是最新版（關掉那個視窗再雙擊一次）。</p>`; it.h = { alive: false, fit() {}, focus() {}, close: async () => {} }; }
      paintList(); if (sel === "term:" + n) show(sel);
    };
    const closeItem = async (key) => {
      if (key.startsWith("ai:")) { const k = +key.slice(3), s2 = sessions[sid(k)]; if (s2 && s2.pending && s2.ctl) s2.ctl.abort(); ids = ids.filter((x) => x !== k); }
      else { const i = TERM_ITEMS.findIndex((t) => "term:" + t.n === key); if (i >= 0) { const t = TERM_ITEMS.splice(i, 1)[0]; t.h && t.h.close(); } }
      if (views[key]) { views[key].remove(); delete views[key]; }
      if (sel === key) sel = "ai:" + ids[0]; keep(); show(sel);
    };
    el.querySelector("[data-plus]").addEventListener("click", newAI);
    el.querySelector("[data-more]").addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    menu.querySelectorAll("[data-mk]").forEach((b) => b.addEventListener("click", () => { menu.hidden = true; if (b.dataset.mk === "ai") newAI(); else newTerm(); }));
    document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
    // 對話開始 / 結束時更新清單（橘點、標題）
    const watch = (k) => { const s2 = session(sid(k)); if (s2.__vsWatch) return; s2.__vsWatch = true; s2.subs.add(() => { const l = document.querySelector(".vs-list"); if (l && l.__repaint) l.__repaint(); }); };
    ids.forEach(watch); list.__repaint = paintList;
    show(sel); slots(); clearInterval(timer); timer = setInterval(slots, 1500);
    new MutationObserver(() => ids.forEach(watch)).observe(main, { childList: true });
  }

  /* ---------- 對話紀錄（像 Claude / ChatGPT 左邊的清單）----------
     「新對話」不會再清掉舊的：每段對話各自存（IndexedDB），左邊列出來，點一下切回去、× 刪掉。
     清單本身存在 localStorage（dsb-convs:<id>）；舊版只有一段對話的，會自動變成清單裡的第一筆。 */
  const convKey = (pid) => "dsb-convs:" + pid;
  const loadConvs = (pid) => { try { const v = JSON.parse(localStorage.getItem(convKey(pid)) || "null"); if (Array.isArray(v)) return v; } catch (_) {} return [{ cid: "", at: Date.now() }]; };
  const saveConvs = (pid, L) => { try { localStorage.setItem(convKey(pid), JSON.stringify(L.slice(0, 80))); } catch (_) {} };
  const convSid = (pid, cid) => (cid ? pid + "~" + cid : pid);
  const ago = (t) => { const d = (Date.now() - t) / 1000; return d < 60 ? "剛剛" : d < 3600 ? Math.floor(d / 60) + " 分鐘前" : d < 86400 ? Math.floor(d / 3600) + " 小時前" : d < 86400 * 7 ? Math.floor(d / 86400) + " 天前" : new Date(t).toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" }); };
  function mountConv(el, p) {
    let L = loadConvs(p.id), cur = L[0].cid;
    el.innerHTML = `<div class="cv"><aside class="cv-side"><button type="button" class="cv-new" data-cnew>＋ 新對話</button><div class="cv-label">對話紀錄</div><ul class="cv-list" data-clist></ul></aside>
      <div class="cv-main"><button type="button" class="cv-toggle" data-ctog aria-label="顯示對話紀錄">☰ 對話紀錄</button><div data-cchat></div></div></div>`;
    const root = el.querySelector(".cv"), list = el.querySelector("[data-clist]"), chat = el.querySelector("[data-cchat]");
    const title = (c) => { if (c.name) return c.name; const s2 = sessions[convSid(p.id, c.cid)], m = s2 && s2.msgs.find((x) => x.role === "user"); const t = (m && m.text) || c.t || ""; return t ? t.replace(/\s+/g, " ").slice(0, 40) : "新對話"; };
    const paint = () => {
      if (!el.isConnected || list.querySelector(".cv-edit")) return;   // 正在改名時不要重畫
      list.innerHTML = L.map((c) => { const s2 = sessions[convSid(p.id, c.cid)], run = s2 && s2.pending; return `<li class="${c.cid === cur ? "on" : ""}" data-cid="${esc(c.cid)}"><span class="cv-t">${esc(title(c))}</span><span class="cv-at">${run ? `<i class="vs-run"></i>回答中` : esc(ago(c.at))}</span><button type="button" data-cren="${esc(c.cid)}" aria-label="重新命名" title="重新命名（也可以連點兩下標題）">✎</button><button type="button" data-cdel="${esc(c.cid)}" aria-label="刪除這段對話">×</button></li>`; }).join("");
      list.querySelectorAll("li").forEach((li) => li.addEventListener("click", (e) => { const rn = e.target.closest("[data-cren]"); if (rn) { e.stopPropagation(); rename(rn.dataset.cren); return; } const d = e.target.closest("[data-cdel]"); if (d) { e.stopPropagation(); del(d.dataset.cdel); return; } if (e.target.closest(".cv-edit")) return; open(li.dataset.cid); root.classList.remove("side-on"); }));
    };
    list.addEventListener("dblclick", (e) => { const li = e.target.closest("li[data-cid]"); if (li && e.target.closest(".cv-t")) { e.preventDefault(); rename(li.dataset.cid); } });
    const rename = (cid) => {   // 對話改名：Enter 儲存、Esc 取消；清空 = 回到自動標題（第一句話）
      const c = L.find((x) => x.cid === cid), li = list.querySelector(`li[data-cid="${cid}"]`); if (!c || !li) return;
      const tEl = li.querySelector(".cv-t"), inp = document.createElement("input"); inp.className = "cv-edit"; inp.maxLength = 40; inp.value = c.name || title(c); inp.setAttribute("aria-label", "對話名稱"); tEl.replaceWith(inp); inp.focus(); inp.select();
      let done = false; const fin = (save) => { if (done) return; done = true; if (save) { const v = inp.value.trim(); if (v) c.name = v; else delete c.name; saveConvs(p.id, L); } inp.remove(); paint(); };
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); fin(true); } else if (e.key === "Escape") { e.preventDefault(); fin(false); } });
      inp.addEventListener("blur", () => fin(true)); inp.addEventListener("click", (e) => e.stopPropagation());
    };
    const touch = (cid) => { const c = L.find((x) => x.cid === cid); if (!c) return; const s2 = sessions[convSid(p.id, cid)], m = s2 && s2.msgs.find((x) => x.role === "user"); if (m && m.text) c.t = m.text.slice(0, 60); c.at = s2 && s2.msgs.length ? s2.msgs[s2.msgs.length - 1].at || c.at : c.at; L.sort((a, b) => b.at - a.at); saveConvs(p.id, L); paint(); };
    const open = (cid) => {
      cur = cid; const sid2 = convSid(p.id, cid), s2 = session(sid2);
      if (!s2.__cvWatch) { s2.__cvWatch = true; let last = -1; s2.subs.add(() => { if (s2.msgs.length !== last) { last = s2.msgs.length; touch(cid); } else paint(); }); }
      mount(chat, { ...p, id: sid2, onNew: newConv }); paint();
    };
    const newConv = () => {
      const empty = L.find((c) => { const s2 = sessions[convSid(p.id, c.cid)]; return s2 && !s2.msgs.length && !s2.pending; });
      if (empty) { open(empty.cid); return; }   // 已經有一段空白的就直接用
      const cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); L.unshift({ cid, at: Date.now() }); saveConvs(p.id, L); open(cid);
      const ta = chat.querySelector("textarea"); ta && ta.focus();
    };
    const del = async (cid) => {
      if (!confirm("刪除這段對話？刪掉就找不回來了。")) return;
      const s2 = sessions[convSid(p.id, cid)]; if (s2) { if (s2.pending && s2.ctl) s2.ctl.abort(); s2.msgs = []; s2.save(); }
      L = L.filter((c) => c.cid !== cid); if (!L.length) L = [{ cid: Date.now().toString(36), at: Date.now() }]; saveConvs(p.id, L);
      if (cid === cur) open(L[0].cid); else paint();
    };
    el.querySelector("[data-cnew]").addEventListener("click", newConv);
    el.querySelector("[data-ctog]").addEventListener("click", () => root.classList.toggle("side-on"));
    // 先把每段對話的內容載進來，清單標題才拿得到第一句話
    L.forEach((c) => { const s2 = session(convSid(p.id, c.cid)); s2.ready.then(paint); });
    open(cur);
  }

  window.AIChat = { mount, mountMulti, mountConv, session, config: () => ({ provider: cfg.provider, model: modelOf(), hasKey: !!cfg.key, ready: ready() }), _setCfg: (c) => { Object.assign(cfg, c); saveCfg(); } };
})();
