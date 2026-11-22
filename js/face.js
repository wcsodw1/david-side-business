/* 人臉解鎖（只在你這台瀏覽器內比對；影像不上傳，只存臉部特徵數字）。
   方便功能，不是保全：沒有活體偵測，照片可能騙過；TPI 密碼與金鑰會存在這個瀏覽器的 localStorage（你已同意）。網站與辦公室不存密碼：登錄時必須已登入，人臉比對成功就沿用登入狀態（辦公室只有登錄當下已解鎖才有）。
   模型：@vladmandic/face-api（第一次使用才從 jsDelivr 載入，約 8MB）。 */
(() => {
  "use strict";
  const KEY = "dsb-face", CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13", TH = 0.45;
  let loading = null;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && Array.isArray(v.d) && v.d.length ? v : null; } catch (_) { return null; } };
  const load = () => loading || (loading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = CDN + "/dist/face-api.js";
    s.onload = async () => { try { const f = window.faceapi; await f.nets.tinyFaceDetector.loadFromUri(CDN + "/model"); await f.nets.faceLandmark68TinyNet.loadFromUri(CDN + "/model"); await f.nets.faceRecognitionNet.loadFromUri(CDN + "/model"); res(f); } catch (e) { loading = null; rej(e); } };
    s.onerror = () => { loading = null; rej(new Error("模型載入失敗（網路？）")); }; document.head.appendChild(s);
  }));
  const dist = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function panel(title, extra) {
    const ov = document.createElement("div"); ov.id = "faceOv";
    ov.innerHTML = `<div class="fc-box"><button type="button" class="fc-x" aria-label="關閉">✕</button><h3>${esc(title)}</h3>${extra || ""}<video class="fc-v" playsinline muted></video><p class="fc-s">啟動中…</p><div class="fc-b"></div></div>`;
    document.body.appendChild(ov);
    const o = { ov, video: ov.querySelector(".fc-v"), status: (t) => { ov.querySelector(".fc-s").textContent = t; }, btns: ov.querySelector(".fc-b"), stream: null, dead: false,
      close() { o.dead = true; try { o.stream && o.stream.getTracks().forEach((t) => t.stop()); } catch (_) {} ov.remove(); } };
    ov.querySelector(".fc-x").addEventListener("click", () => o.close());
    return o;
  }
  async function camera(o) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("這個瀏覽器不支援鏡頭");
    o.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } }, audio: false });
    o.video.muted = true; o.video.setAttribute("playsinline", ""); o.video.setAttribute("webkit-playsinline", "");   // iOS Safari 需要
    o.video.srcObject = o.stream; await o.video.play();
  }
  const safeDetect = async (f, v) => { try { return await detect(f, v); } catch (_) { return null; } };
  const detect = (f, v) => f.detectSingleFace(v, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })).withFaceLandmarks(true).withFaceDescriptor();

  /* 辨識：比對成功回傳 {pw,tp,tk}，取消 / 逾時回傳 null */
  async function scan() {
    const saved = get(); if (!saved) return null;
    const o = panel("👤 人臉解鎖");
    o.btns.innerHTML = `<button type="button" class="fc-cancel">改用密碼</button>`; o.btns.firstChild.addEventListener("click", () => o.close());
    try {
      o.status("載入辨識模型…（第一次較久）"); const f = await load(); if (o.dead) return null;
      o.status("開啟鏡頭…"); await camera(o); if (o.dead) return null;
      o.status("請看著鏡頭"); let hits = 0; const t0 = Date.now();
      while (!o.dead && Date.now() - t0 < 45000) {
        const r = await safeDetect(f, o.video);
        if (r) { const m = Math.min(...saved.d.map((d) => dist(d, r.descriptor))); hits = m < TH ? hits + 1 : 0; o.status(m < TH ? "確認中…" : "不是已登錄的人"); if (hits >= 3) { o.close(); return { pw: saved.pw, tp: saved.tp, tk: saved.tk, op: saved.op || "" }; } }
        else { hits = 0; o.status("沒看到臉，請正對鏡頭"); }
        await sleep(350);
      }
      if (!o.dead) o.status("逾時，請改用密碼"); await sleep(1200);
    } catch (e) { o.status("無法使用人臉：" + (e && e.message || e)); await sleep(2200); }
    o.close(); return null;
  }

  /* 登錄：先驗證 TPI（verify 回傳空字串=通過，否則是錯誤訊息；網站／辦公室沿用目前登入狀態，不輸入也不存密碼），再拍 6 張特徵 */
  async function enroll(opts) {
    const o = panel("👤 人臉登錄", `<p class="fc-p">登錄後，這個裝置開啟網站會用鏡頭自動進入，並自動解鎖 TPI。<br>建議拍兩種樣子（例如戴眼鏡、不戴眼鏡），認得比較穩。<br>TPI 密碼與金鑰（有用到才填）會存在這個瀏覽器（localStorage），請確認這是你自己的裝置。</p>
      <div class="fc-f"><input type="password" name="tp" placeholder="TPI 密碼" autocomplete="off"><input type="password" name="tk" placeholder="金鑰" autocomplete="off"></div>`);
    const q = (n) => o.ov.querySelector(`[name=${n}]`);
    const grab = async (n, label) => {   // 拍 n 張特徵；回傳陣列或 null
      const f = await load(); if (o.dead) return null; if (!o.stream) { o.status("開啟鏡頭…"); await camera(o); if (o.dead) return null; }
      const d = [], t0 = Date.now();
      while (!o.dead && d.length < n && Date.now() - t0 < 40000) {
        const r = await safeDetect(f, o.video);
        if (r) { d.push(Array.from(r.descriptor)); o.status(`${label} ${d.length}/${n}（稍微轉動頭部）`); await sleep(600); } else { o.status("沒看到臉，請正對鏡頭"); await sleep(300); }
      }
      return o.dead ? null : d.length < n ? (o.status("拍攝不足，請重試"), null) : d;
    };
    const saved = () => get();
    const paintBtns = () => {
      const has = !!saved(), fld = o.ov.querySelector(".fc-f"), pr = o.ov.querySelector(".fc-p");
      if (fld) fld.hidden = has && !o.redo; if (pr) pr.hidden = has && !o.redo;   // 登錄過就不用再輸入密碼
      o.btns.innerHTML = has && !o.redo
        ? `<button type="button" class="fc-add fc-main">＋ 再加一種樣子（戴 / 不戴眼鏡）</button><button type="button" class="fc-done">完成</button><button type="button" class="fc-redo">重新登錄</button><button type="button" class="fc-del">刪除已登錄的臉與 TPI 密碼</button>`
        : `<button type="button" class="fc-go">開始登錄</button>${has ? `<button type="button" class="fc-done">取消</button>` : ""}`;
      o.btns.querySelector(".fc-done")?.addEventListener("click", () => o.close());
      o.btns.querySelector(".fc-redo")?.addEventListener("click", () => { o.redo = true; o.status("請按「開始登錄」重新拍攝；有用 TPI 的話再填一次 TPI 密碼。"); paintBtns(); });
      o.btns.querySelector(".fc-del")?.addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch (_) {} o.redo = false; o.status("已刪除。"); paintBtns(); });
      o.btns.querySelector(".fc-add")?.addEventListener("click", async (e) => {
        const btn = e.target; btn.disabled = true;
        try { o.status("載入辨識模型…"); const cur = saved(); const d = await grab(5, "加入新樣子"); if (!d) { btn.disabled = false; return; }
          cur.d = cur.d.concat(d).slice(-24); localStorage.setItem(KEY, JSON.stringify(cur)); o.status(`✅ 已加入新樣子（共 ${cur.d.length} 筆特徵）。可以按「完成」了。`); btn.disabled = false;
        } catch (er) { o.status("失敗：" + (er && er.message || er)); btn.disabled = false; }
      });
      o.btns.querySelector(".fc-go")?.addEventListener("click", async (e) => {
        const btn = e.target; btn.disabled = true;
        try {
          const tp = q("tp").value.trim(), tk = q("tk").value.trim();
          const err = opts && opts.verify ? await opts.verify(tp, tk) : ""; if (err) { o.status(err); btn.disabled = false; return; }
          o.status("載入辨識模型…"); const d = await grab(6, "登錄中（目前的樣子）"); if (!d) { btn.disabled = false; return; }
          localStorage.setItem(KEY, JSON.stringify({ d, site: 1, office: 1, tp, tk, at: Date.now() })); ["tp", "tk"].forEach((n) => { q(n).value = ""; });
          o.redo = false; o.status("✅ 已登錄，以後用鏡頭就能進入（不用再輸入網站密碼）。想更穩可以換一種樣子（拿下／戴上眼鏡）再加一次，不需要就按「完成」。"); paintBtns();
        } catch (er) { o.status("失敗：" + (er && er.message || er)); btn.disabled = false; }
      });
    };
    o.status(saved() ? "已登錄過。可再加一種樣子，或重新登錄。" : "尚未登錄。");
    paintBtns();
  }
  /* 舊版登錄存了網站／辦公室明碼：密碼驗證通過後改存「權限旗標」並刪掉明碼 */
  const upgrade = (o) => { const r = get(); if (!r) return; if (o.office !== undefined) { delete r.op; r.office = o.office ? 1 : 0; } if (o.site) { delete r.pw; r.site = 1; } try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (_) {} };
  window.FaceLogin = { enrolled: () => !!get(), hasOffice: () => !!(get() && (get().op || get().office)), upgrade, scan, enroll };
})();
