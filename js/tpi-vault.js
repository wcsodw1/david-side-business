/* TPI 加密內容：需要「TPI 密碼 + 金鑰」才能解開（AES-GCM，金鑰由 PBKDF2 推導）。
   密碼只留在這個分頁的 sessionStorage，關掉分頁就沒了；網站檔案裡只有密文。 */
(function () {
  const V = window.TPI_VAULT, SK = "dsb-tpi";
  const u8 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const api = { locked: true, has: !!V };
  async function open(pw, key) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw + "\u0000" + key), "PBKDF2", false, ["deriveKey"]);
    const k = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: u8(V.salt), iterations: V.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8(V.iv) }, k, u8(V.ct))));
  }
  function merge(d) {
    const p = (window.PROJECTS || []).find((x) => x.id === "tpi"); if (!p) return;
    Object.assign(p, { summary: d.summary, wbDefault: d.wbDefault, tasks: d.tasks, tasks0: d.tasks, updates: d.updates, links: d.links || [] });
    api.locked = false;
  }
  api.unlock = async (pw, key) => {
    if (!V || !crypto.subtle) return false;
    try { merge(await open(String(pw).trim(), String(key).trim())); try { sessionStorage.setItem(SK, JSON.stringify([String(pw).trim(), String(key).trim()])); } catch (_) {} return true; } catch (_) { return false; }
  };
  api.ready = (async () => { let s = null; try { s = JSON.parse(sessionStorage.getItem(SK) || "null"); } catch (_) {} return s ? api.unlock(s[0], s[1]) : false; })();
  window.TpiVault = api;
})();
