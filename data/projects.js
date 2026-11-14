/* ============================================================
   David's Side Business — 資料檔
   以後只要改這個檔案就能新增 / 更新進度，網站會自動更新。

   ▸ 新增一個 Side Business：複製下面任一區塊，貼在陣列裡即可
   ▸ 新增一筆進度：在該專案的 updates 最上面加一行
        { date: "2026-11-12", title: "標題", text: "內容" },
   ▸ status 可用： "backlog"(Backlog，先放著) | "idea"(發想中) | "building"(進行中) | "live"(已上線) | "paused"(暫停)
   ▸ progress：0 ~ 100
   ============================================================ */

window.SITE = {
  name: "David's Side Business",
  tagline: "A place where dreams come true",
  taglineZh: '把夢想變成 "Real"',
  // 二樓房間的海報照片：把圖片放進 img/posters/，再把檔名依序寫在這裡（例如 ["p1.jpg", "p2.jpg"]）。
  // 留空 = 用程式畫的舞台風格海報。⚠ 這個 repo 是公開的，請只放你有權使用的圖片。
  // 藝廊背景音樂：貼上 YouTube 影片或播放清單網址（走進藝廊才會播，右下角會出現小播放器）。留空 = 使用內建合成的波薩諾瓦。
  galleryMusicYouTube: "",
  posterPhotos: ["chanyeol-1.jpg", "chanyeol-2.jpg", "chanyeol-3.jpg", "chanyeol-4.jpg", "chanyeol-5.jpg", "chanyeol-6.jpg", "chanyeol-7.jpg"],   // 照片來源與授權見 README 與二樓海報旁的標註（CC BY 4.0）
};

window.STATUS = {
  backlog:  { label: "Backlog", color: "#7fb4ff" },
  idea:     { label: "發想中", color: "#b9a6ff" },
  building: { label: "進行中", color: "#ffb86b" },
  live:     { label: "已上線", color: "#6be3a4" },
  paused:   { label: "暫停",   color: "#9aa3b2" },
};

window.PROJECTS = [
  {
    id: "luka-film",
    name: "Luka Film",
    zh: "影像創作",
    category: "Creative",
    status: "building",
    progress: 30,
    wbDefault: { status: "ON PROCESS", note: "三份字幕（日文、雙語、繁中）都已產出並修正，每份 503 段，時間軸一致。", noteAt: "2026-11-14", next: "校對繁中翻譯，並對著影片檢查時間軸，再重新匯入 Filmora。" },   // 白板預設值（來自 Luka Film session 的最新進度）
    summary: "以影像說故事的創作品牌。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入 David's Side Business 平台，之後在這裡記錄進度。" },
    ],
  },
  {
    id: "line-erp",
    name: "LINE ERP System",
    zh: "LINE 進銷存系統",
    category: "Software",
    status: "building",
    progress: 40,
    summary: "以 LINE 為入口的輕量 ERP，處理訂單、庫存與客戶。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充目前開發進度。" },
    ],
  },
  {
    id: "house-renting",
    name: "House Renting",
    zh: "房屋出租",
    category: "Real Estate",
    status: "live",
    progress: 80,
    summary: "房屋出租管理與租客資訊整理。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充出租狀況。" },
    ],
  },
  {
    id: "bb",
    name: "BB",
    zh: "Bugs & Bar",
    category: "F&B",
    status: "building",
    progress: 50,
    summary: "Bugs & Bar 訂單與營運整理。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充營運進度。" },
    ],
  },
  {
    id: "zinzino",
    name: "ZINZINO",
    zh: "健康產品事業",
    category: "Network / Health",
    status: "building",
    progress: 35,
    summary: "ZINZINO 事業經營與客戶追蹤。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充經營進度。" },
    ],
  },
  {
    id: "gumroad",
    name: "Gumroad Digital Products",
    zh: "數位商品",
    category: "Digital",
    status: "building",
    progress: 45,
    summary: "在 Gumroad 販售的數位商品與模板。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充商品上架進度。" },
    ],
  },
  {
    id: "cafe",
    name: "Coffee Shop",
    zh: "咖啡廳",
    category: "F&B",
    status: "idea",
    progress: 5,
    wbDefault: { status: "TODO", note: "咖啡豆報價單已拿到：7 款莊園豆，半磅 $220–450（一磅約為兩倍）。", noteAt: "2026-11-14", next: "挑 3–4 款主打豆（曼特寧、耶加雪菲、曼巴），算成本與售價，先用半磅開始。" },
    summary: "咖啡廳籌備：豆子選品、成本與菜單。",
    links: [],
    updates: [
      { date: "2026-11-14", title: "專案頁建立", text: "加入平台，開始整理咖啡豆報價與品項。" },
    ],
  },
  {
    id: "pickleball",
    name: "PickleBall",
    zh: "匹克球",
    category: "Sports",
    status: "backlog",
    progress: 15,
    summary: "匹克球相關活動與商機。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充想法與進度。" },
    ],
  },
];
