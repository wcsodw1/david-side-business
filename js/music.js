/* ============================================================
   藝廊音樂：走進美術館（藝廊）就會漸漸響起屬於藝廊的音樂；走到戶外則漸漸換成海浪聲。
   全部用 Web Audio 即時合成（沒有任何現成曲子或音檔，沒有版權問題）：
   · 柔和的和弦鋪底（Cmaj7 → Am7 → Fmaj7 → G6 循環）
   · 鋼琴般的輕柔分解音與偶爾的鈴聲，加上空間殘響
   右上角有靜音按鈕（記住你的選擇）。瀏覽器規定要先有點擊或按鍵才能出聲，登入後第一次操作就會開始。
   ============================================================ */
(() => {
  "use strict";
  const api = (window.Music = { mount, unmount, sfx: (k, x, z, p) => K && K.sfx && K.sfx(k, x, z, p), state: () => (K ? { ctx: K.ac && K.ac.state, music: +K.vMusic.toFixed(2), ocean: +K.vOcean.toFixed(2), muted: K.muted, started: K.started, notes: K.notes } : null) });
  let K = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const rand = (a, b) => a + Math.random() * (b - a);
  const CHORDS = [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 59, 62]];   // Cmaj7 / Am7 / Fmaj7 / G6
  const SCALE = [72, 74, 76, 79, 81, 84, 86];                                                                 // C 大調五聲音階（高八度）

  function mount(ctx) {
    unmount();
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    let muted = false; try { muted = localStorage.getItem("dsb-muted") === "1"; } catch (_) {}
    K = { ac: null, muted, started: false, vMusic: 0, vOcean: 0, notes: 0, timers: [], hooks: ctx.hooks };

    // 靜音按鈕
    const btn = document.createElement("button");
    btn.type = "button"; btn.setAttribute("aria-label", "音樂開關");
    btn.style.cssText = "position:fixed;right:14px;top:62px;z-index:41;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(20,17,43,.6);color:#fff;font-size:17px;line-height:1;cursor:pointer;backdrop-filter:blur(6px)";
    const paint = () => { btn.textContent = K.muted ? "🔇" : "🎵"; btn.title = K.muted ? "開啟音樂" : "靜音"; };
    btn.addEventListener("click", (e) => { e.stopPropagation(); K.muted = !K.muted; try { localStorage.setItem("dsb-muted", K.muted ? "1" : "0"); } catch (_) {} paint(); start(); });
    document.body.appendChild(btn); K.btn = btn; paint();

    function build() {
      const ac = new AC(); K.ac = ac;
      const master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      // 殘響：合成一段 3.2 秒漸弱的雜訊當作脈衝響應
      const len = Math.floor(ac.sampleRate * 3.2), imp = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      const verb = ac.createConvolver(); verb.buffer = imp; const verbG = ac.createGain(); verbG.gain.value = 0.55; verb.connect(verbG); verbG.connect(master);
      const musicG = ac.createGain(); musicG.gain.value = 0; musicG.connect(master); musicG.connect(verb);
      K.musicG = musicG; K.verb = verb;
      // 海浪聲：棕色雜訊 + 低通 + 慢速起伏
      const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), nd = nb.getChannelData(0); let last = 0;
      for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; nd[i] = last * 3.5; }
      const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
      const swell = ac.createGain(); swell.gain.value = 0.6;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.11; const lfoG = ac.createGain(); lfoG.gain.value = 0.35; lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
      const oceanG = ac.createGain(); oceanG.gain.value = 0; ns.connect(lp); lp.connect(swell); swell.connect(oceanG); oceanG.connect(master); ns.start();
      K.oceanG = oceanG;
    }

    const pad = (t, midi, dur) => {
      const ac = K.ac, g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2.2); g.gain.setValueAtTime(0.05, t + dur - 0.4); g.gain.linearRampToValueAtTime(0, t + dur + 2.4);
      for (const det of [-5, 5]) { const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(midi); o.detune.value = det; o.connect(g); o.start(t); o.stop(t + dur + 2.6); }
      g.connect(K.musicG);
    };
    const pluck = (t, midi, vel = 0.12, bell = false) => {
      const ac = K.ac, g = ac.createGain(), f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = bell ? 5200 : 3200;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + (bell ? 3.2 : 2.4));
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = bell ? "sine" : "triangle"; o2.type = "sine"; o1.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * (bell ? 3.01 : 2);
      const g2 = ac.createGain(); g2.gain.value = bell ? 0.25 : 0.35; o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(K.musicG);
      o1.start(t); o2.start(t); o1.stop(t + 3.4); o2.stop(t + 3.4); K.notes++;
    };

    // 排程：每 7.2 秒一個和弦，每 0.9 秒一拍；只在聽得到的時候才排，省電
    let nextChordT = 0, nextBeatT = 0, chordIdx = 0, beat = 0;
    const sched = () => {
      const ac = K.ac; if (!ac || ac.state !== "running") return;
      if (K.vMusic < 0.02 && K.musicG.gain.value < 0.02) { nextChordT = nextBeatT = 0; return; }
      const now = ac.currentTime;
      if (!nextChordT) { nextChordT = nextBeatT = now + 0.15; chordIdx = Math.floor(Math.random() * CHORDS.length); beat = 0; }
      while (nextChordT < now + 1.2) { for (const m of CHORDS[chordIdx % 4].slice(0, 4)) pad(nextChordT, m, 7.2); nextChordT += 7.2; chordIdx++; }
      while (nextBeatT < now + 1.2) {
        const ch = CHORDS[(chordIdx - 1 + 4) % 4], bi = beat % 8, t = nextBeatT;
        if (bi === 0) pluck(t, ch[0] + 12, 0.1);                                                        // 低音
        if ([1, 3, 5, 7].includes(bi) && Math.random() < 0.8) pluck(t + rand(0, 0.04), ch[1 + (bi >> 1) % 4] + 12 + (Math.random() < 0.3 ? 12 : 0), 0.085);   // 分解和弦
        if ([2, 6].includes(bi) && Math.random() < 0.55) pluck(t, SCALE[Math.floor(Math.random() * SCALE.length)], 0.07);                                   // 旋律
        if (bi === 4 && Math.random() < 0.35) pluck(t + 0.05, SCALE[Math.floor(rand(3, 7))] + 0, 0.05, true);                                            // 鈴聲
        nextBeatT += 0.9; beat++;
      }
    };

    // 音效：位置感（離球場 / 門越遠越小聲）。kind: hit（球拍擊球）、bounce（落地）、net（下網）、door（自動門）、splash（水花）
    K.sfx = (kind, x, z, power = 1) => {
      const ac = K.ac; if (!ac || ac.state !== "running" || K.muted) return;
      const me = ctx.getMe ? ctx.getMe() : { x: 0, z: 0 }, d = Math.hypot((x ?? me.x) - me.x, (z ?? me.z) - me.z);
      const hall = kind === "hit" || kind === "bounce" || kind === "net";
      const vol = Math.min(1, 9 / (4 + d * d * 0.08)) * (hall && ctx.getInside && ctx.getInside() !== ctx.sPB && me.x < (ctx.hallX0 || 0) ? 0.35 : 1);   // 在球館外只聽到悶悶的
      if (vol < 0.03) return;
      const t = ac.currentTime, out = ac.createGain(); out.gain.value = vol * (K.sfxVol ?? 0.7); out.connect(ac.destination);
      const noise = (dur, f, q, gain, type = "bandpass") => { const n = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d0 = n.getChannelData(0); for (let i = 0; i < d0.length; i++) d0[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d0.length, 2.2); const s = ac.createBufferSource(); s.buffer = n; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); g.gain.value = gain; s.connect(fl); fl.connect(g); g.connect(out); s.start(t); };
      const tone = (f0, f1, dur, gain, type = "sine") => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02); };
      if (kind === "hit") { const pw = 0.6 + 0.5 * power; noise(0.05, 2300 + 500 * power, 1.6, 1.1 * pw); noise(0.03, 5200, 0.8, 0.5 * pw, "highpass"); tone(1100 + 300 * power, 520, 0.05, 0.5 * pw, "triangle"); tone(420, 300, 0.07, 0.35 * pw); }   // 「啪」：塑膠球 + 硬拍面
      else if (kind === "bounce") { tone(780, 380, 0.045, 0.5, "triangle"); noise(0.03, 1800, 1.2, 0.35); }                                                              // 「噠」：球落地
      else if (kind === "net") { tone(210, 120, 0.12, 0.7); noise(0.09, 700, 0.9, 0.5); }                                                                              // 「咚」：下網
      else if (kind === "door") { noise(0.7, 900, 0.5, 0.18 * (power || 1), "lowpass"); tone(1320, 1320, 0.12, 0.08); }                                                // 門滑動 + 叮
      else if (kind === "splash") { noise(0.5, 1400, 0.4, 0.5 * (power || 1)); tone(300, 120, 0.25, 0.25); }
    };
    function start() {
      if (!K.ac) build();
      K.ac.resume && K.ac.resume().then(() => { K.started = true; });
      if (!K.timers.length) K.timers.push(setInterval(sched, 300));
    }
    const onGesture = () => { start(); };
    window.addEventListener("pointerdown", onGesture, { passive: true }); window.addEventListener("keydown", onGesture);
    K.off = () => { window.removeEventListener("pointerdown", onGesture); window.removeEventListener("keydown", onGesture); };

    K.hook = (dt) => {
      const inMus = ctx.getInsideMuseum ? ctx.getInsideMuseum() : 0;
      const tM = K.muted ? 0 : inMus, tO = K.muted ? 0 : (1 - inMus * 0.85) * 0.5;
      K.vMusic += (tM - K.vMusic) * Math.min(1, dt * 1.2); K.vOcean += (tO - K.vOcean) * Math.min(1, dt * 1.2);
      if (K.ac && K.musicG) { const t = K.ac.currentTime; K.musicG.gain.setTargetAtTime(K.vMusic * 0.9, t, 0.3); K.oceanG.gain.setTargetAtTime(K.vOcean * 0.55, t, 0.3); }
    };
    ctx.hooks.push(K.hook);
  }

  function unmount() {
    if (!K) return;
    const i = K.hooks.indexOf(K.hook); if (i >= 0) K.hooks.splice(i, 1);
    K.timers.forEach(clearInterval); K.off && K.off(); K.btn && K.btn.remove();
    try { K.ac && K.ac.close(); } catch (_) {}
    K = null;
  }
})();
