/* ============================================================
   Store：在網站上直接記錄更新 / 事件、設定目標與里程碑，並自動評估完成度。
   ⚠ 靜態網站沒有後端，記錄存在「這台瀏覽器」(localStorage)。
     想讓所有裝置都看到：用「匯出」複製，再貼給 Claude 寫進 data/projects.js。
   自動評估是規則式的（不是 AI）：
     · 有里程碑 → 完成度 = 已完成 / 全部
     · 沒有里程碑 → 沿用 data/projects.js 的手動數字，並提醒設定里程碑
     · 記錄更新時，若內容提到某個里程碑，會自動把它打勾
   ============================================================ */
(() => {
  "use strict";
  const KEY = "dsb-local";
  let P = [], data = {};

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const load = () => { try { data = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (_) { data = {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} };
  const rec = (pid) => (data[pid] = data[pid] || { updates: [], goal: "", milestones: [], answers: [], status: "", note: "", noteAt: "", next: "" });
  const emit = (detail) => window.dispatchEvent(new CustomEvent("store:change", { detail: detail || null }));
  const bc = (msg) => { try { window.Presence && window.Presence.broadcast && window.Presence.broadcast({ kind: "proj", who: window.PERSONA || "david", ...msg }); } catch (_) {} };   // 兩人同時在線時，專案更新也傳給對方

  const norm = (s) => String(s || "").toLowerCase().replace(/[\s,.;:!?，。；：！？、'"()（）\-_/]+/g, "");
  const bigrams = (s) => { const n = norm(s), out = new Set(); if (n.length < 2) { if (n) out.add(n); return out; } for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2)); return out; };
  const matches = (milestone, text) => {
    const a = bigrams(milestone); if (!a.size) return false;
    const t = norm(text); if (t.includes(norm(milestone)) && norm(milestone).length >= 2) return true;
    let hit = 0; a.forEach((g) => { if (t.includes(g)) hit++; });
    return hit / a.size >= 0.7;
  };

  function evaluate(p) {
    const r = data[p.id], ms = (r && r.milestones) || [];
    if (ms.length) {
      const done = ms.filter((m) => m.done).length, pct = Math.round((done / ms.length) * 100);
      return { progress: pct, mode: "milestone", reason: `依里程碑自動評估：完成 ${done}/${ms.length}` };
    }
    return { progress: p._base ? p._base.progress : p.progress, mode: "manual", reason: "尚未設定里程碑，目前是手動數字" };
  }

  function apply(p) {
    if (!p._base) p._base = { updates: (p.updates || []).slice(), progress: p.progress ?? 0, status: p.status };
    const r = data[p.id] || { updates: [], goal: "", milestones: [] };
    p.updates = [...r.updates.slice().sort((a, b) => b.at - a.at), ...p._base.updates];
    p.goal = r.goal || "";
    p.milestones = r.milestones || [];
    p.wbStatus = r.status || ""; p.wbNote = r.note || ""; p.wbNoteAt = r.noteAt || ""; p.next = r.next || "";   // 白板三格：目標 / 目前狀態（TODO…FINISH + 一句話）/ Next Step
    const ev = evaluate(p);
    p.progress = ev.progress; p.progressMode = ev.mode; p.progressReason = ev.reason;
    if (ev.mode === "milestone" && ev.progress >= 100 && p._base.status !== "live") p.suggestStatus = "live"; else p.suggestStatus = null;
  }

  const api = (window.Store = {
    init(projects) { P = projects; load(); P.forEach(apply); },
    today,
    daysSinceUpdate(p) {
      const real = (p.updates || []).filter((u) => !/專案頁建立/.test(u.title));
      if (!real.length) return null;
      const d = new Date(real[0].date + "T00:00:00"); return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    },
    addUpdate(pid, { type = "進度", title = "", text = "" }) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      text = String(text).trim(); title = String(title).trim() || (text.length > 24 ? text.slice(0, 24) + "…" : text); if (!title && !text) return null;
      const u = { date: today(), title: `${type === "進度" ? "" : "【" + type + "】"}${title}`, text, type, at: Date.now(), local: true };
      const r = rec(pid); r.updates.unshift(u);
      const ticked = [];
      r.milestones.forEach((m) => { if (!m.done && (type === "完成" || type === "進度") && matches(m.text, title + " " + text)) { m.done = true; ticked.push(m.text); } });
      save(); apply(p);
      if (window.News && window.News.markRead) window.News.markRead(p, u);
      emit();
      return { update: u, ticked };
    },
    setGoal(pid, text) { const p = P.find((x) => x.id === pid); if (!p) return; rec(pid).goal = String(text).trim(); save(); apply(p); emit({ pid, kind: "goal", text: rec(pid).goal }); bc({ pid, goal: rec(pid).goal }); },
    setStatus(pid, st) { const p = P.find((x) => x.id === pid); if (!p) return; const r = rec(pid); r.status = r.status === st ? "" : st; save(); apply(p); emit({ pid, kind: "status", text: r.status }); bc({ pid, status: r.status }); },
    setNote(pid, text) { const p = P.find((x) => x.id === pid); if (!p) return; text = String(text).trim(); if (!text) return; const r = rec(pid); r.note = text; r.noteAt = today(); save(); api.addUpdate(pid, { type: "進度", text }); emit({ pid, kind: "note", text }); bc({ pid, note: text, noteAt: r.noteAt }); },
    setNext(pid, text) { const p = P.find((x) => x.id === pid); if (!p) return; rec(pid).next = String(text).trim(); save(); apply(p); emit({ pid, kind: "next", text: rec(pid).next }); bc({ pid, next: rec(pid).next }); },
    // 收到對方（另一位玩家）傳來的專案更新：寫進自己的紀錄，並讓 NEWS 彈出提示
    applyRemote(m) {
      const p = P.find((x) => x.id === m.pid); if (!p) return; const r = rec(m.pid); let kind = "note", text = "";
      if (m.goal !== undefined) { r.goal = m.goal; kind = "goal"; text = m.goal; }
      if (m.status !== undefined) { r.status = m.status; kind = "status"; text = m.status; }
      if (m.next !== undefined) { r.next = m.next; kind = "next"; text = m.next; }
      if (m.note !== undefined) { r.note = m.note; r.noteAt = m.noteAt || today(); kind = "note"; text = m.note; r.updates.unshift({ date: today(), title: m.note.length > 24 ? m.note.slice(0, 24) + "…" : m.note, text: m.note, type: "進度", at: Date.now(), local: false, remote: true }); }
      save(); apply(p); emit({ pid: m.pid, kind, text, remote: true, who: m.who });
    },
    addMilestones(pid, list) {
      const p = P.find((x) => x.id === pid); if (!p) return 0;
      const items = (Array.isArray(list) ? list : String(list).split(/[\n,，;；、]+/)).map((s) => s.trim()).filter(Boolean);
      const r = rec(pid); let n = 0;
      items.forEach((t) => { if (!r.milestones.some((m) => norm(m.text) === norm(t))) { r.milestones.push({ id: Math.random().toString(36).slice(2, 8), text: t, done: false }); n++; } });
      save(); apply(p); emit(); return n;
    },
    toggleMilestone(pid, id) { const p = P.find((x) => x.id === pid); if (!p) return; const m = rec(pid).milestones.find((x) => x.id === id); if (m) { m.done = !m.done; save(); apply(p); emit(); } },
    removeMilestone(pid, id) { const p = P.find((x) => x.id === pid); if (!p) return; const r = rec(pid); r.milestones = r.milestones.filter((x) => x.id !== id); save(); apply(p); emit(); },
    exportText() {
      const out = {};
      Object.keys(data).forEach((pid) => { const r = data[pid]; if (r.updates.length || r.goal || r.milestones.length || r.status || r.note || r.next) out[pid] = { goal: r.goal, status: r.status || "", note: r.note || "", next: r.next || "", milestones: r.milestones.map((m) => ({ text: m.text, done: m.done })), updates: r.updates.map((u) => ({ date: u.date, title: u.title, text: u.text })) }; });
      return JSON.stringify(out, null, 2);
    },
    hasData: () => Object.keys(data).some((k) => data[k].updates.length || data[k].goal || data[k].milestones.length || data[k].status || data[k].next),
  });
})();
