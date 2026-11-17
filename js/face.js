/* 人臉解鎖（只在你這台瀏覽器內比對；影像不上傳，只存臉部特徵數字）。
   方便功能，不是保全：沒有活體偵測，照片可能騙過；網站密碼與 TPI 密碼會存在這個瀏覽器的 localStorage（你已同意）。
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
    o.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480 }, audio: false });
    o.video.srcObject = o.stream; await o.video.play();
  }
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
        const r = await detect(f, o.video).catch(() => null);
        if (r) { const m = Math.min(...saved.d.map((d) => dist(d, r.descriptor))); hits = m < TH ? hits + 1 : 0; o.status(m < TH ? "確認中…" : "不是已登錄的人"); if (hits >= 3) { o.close(); return { pw: saved.pw, tp: saved.tp, tk: saved.tk, op: saved.op || "" }; } }
        else { hits = 0; o.status("沒看到臉，請正對鏡頭"); }
        await sleep(350);
      }
      if (!o.dead) o.status("逾時，請改用密碼"); await sleep(1200);
    } catch (e) { o.status("無法使用人臉：" + (e && e.message || e)); await sleep(2200); }
    o.close(); return null;
  }

  /* 登錄：先驗證密碼（verify 回傳空字串=通過，否則是錯誤訊息），再拍 6 張特徵 */
  async function enroll(opts) {
    const o = panel("👤 人臉登錄", `<p class="fc-p">登錄後，這台電腦開啟網站會用鏡頭自動進入，並自動解鎖 TPI。<br>建議拍兩種樣子（例如戴眼鏡、不戴眼鏡），認得比較穩。<br>網站密碼、辦公室密碼、TPI 密碼與金鑰會存在這個瀏覽器（localStorage），請確認這是你自己的電腦。</p>
      <div class="fc-f"><input type="password" name="pw" placeholder="網站密碼" autocomplete="off"><input type="password" name="op" placeholder="辦公室密碼" autocomplete="off"><input type="password" name="tp" placeholder="TPI 密碼" autocomplete="off"><input type="password" name="tk" placeholder="金鑰" autocomplete="off"></div>`);
    const q = (n) => o.ov.querySelector(`[name=${n}]`);
    const grab = async (n, label) => {   // 拍 n 張特徵；回傳陣列或 null
      const f = await load(); if (o.dead) return null; if (!o.stream) { o.status("開啟鏡頭…"); await camera(o); if (o.dead) return null; }
      const d = [], t0 = Date.now();
      while (!o.dead && d.length < n && Date.now() - t0 < 40000) {
        const r = await detect(f, o.video).catch(() => null);
        if (r) { d.push(Array.from(r.descriptor)); o.status(`${label} ${d.length}/${n}（稍微轉動頭部）`); await sleep(600); } else { o.status("沒看到臉，請正對鏡頭"); await sleep(300); }
      }
      return o.dead ? null : d.length < n ? (o.status("拍攝不足，請重試"), null) : d;
    };
    const saved = () => get();
    const paintBtns = () => {
      o.btns.innerHTML = `<button type="button" class="fc-go">${saved() ? "重新登錄（會取代舊的）" : "開始登錄"}</button>${saved() ? `<button type="button" class="fc-add">＋ 再加一種樣子（戴 / 不戴眼鏡）</button><button type="button" class="fc-del">刪除已登錄的臉與密碼</button>` : ""}`;
      o.btns.querySelector(".fc-del")?.addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch (_) {} o.status("已刪除。"); paintBtns(); });
      o.btns.querySelector(".fc-add")?.addEventListener("click", async (e) => {
        const btn = e.target; btn.disabled = true;
        try { o.status("載入辨識模型…"); const cur = saved(); const d = await grab(5, "加入新樣子"); if (!d) { btn.disabled = false; return; }
          cur.d = cur.d.concat(d).slice(-24); localStorage.setItem(KEY, JSON.stringify(cur)); o.status(`✅ 已加入新樣子（共 ${cur.d.length} 筆特徵）。`); btn.disabled = false;
        } catch (er) { o.status("失敗：" + (er && er.message || er)); btn.disabled = false; }
      });
      o.btns.querySelector(".fc-go").addEventListener("click", async (e) => {
        const btn = e.target; btn.disabled = true;
        try {
          const pw = q("pw").value.trim(), op = q("op").value.trim(), tp = q("tp").value.trim(), tk = q("tk").value.trim();
          const err = opts && opts.verify ? await opts.verify(pw, tp, tk, op) : ""; if (err) { o.status(err); btn.disabled = false; return; }
          o.status("載入辨識模型…"); const d = await grab(6, "登錄中（目前的樣子）"); if (!d) { btn.disabled = false; return; }
          localStorage.setItem(KEY, JSON.stringify({ d, pw, op, tp, tk, at: Date.now() }));
          o.status("✅ 已登錄。現在請換一種樣子（拿下或戴上眼鏡），按「＋ 再加一種樣子」。"); paintBtns();
        } catch (er) { o.status("失敗：" + (er && er.message || er)); btn.disabled = false; }
      });
    };
    o.status(saved() ? "已登錄過。可再加一種樣子，或重新登錄。" : "尚未登錄。");
    paintBtns();
  }
  window.FaceLogin = { enrolled: () => !!get(), hasOffice: () => !!(get() && get().op), scan, enroll };
})();
