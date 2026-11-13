/* ============================================================
   David's Side Business — 資料檔
   以後只要改這個檔案就能新增 / 更新進度，網站會自動更新。

   ▸ 新增一個 Side Business：複製下面任一區塊，貼在陣列裡即可
   ▸ 新增一筆進度：在該專案的 updates 最上面加一行
        { date: "2026-11-12", title: "標題", text: "內容" },
   ▸ status 可用： "idea"(發想中) | "building"(進行中) | "live"(已上線) | "paused"(暫停)
   ▸ progress：0 ~ 100
   ============================================================ */

window.SITE = {
  name: "David's Side Business",
  tagline: "A place where dreams come true",
  taglineZh: '把夢想變成 "Real"',
  // 二樓房間的海報照片：把圖片放進 img/posters/，再把檔名依序寫在這裡（例如 ["p1.jpg", "p2.jpg"]）。
  // 留空 = 用程式畫的舞台風格海報。⚠ 這個 repo 是公開的，請只放你有權使用的圖片。
  posterPhotos: ["chanyeol-1.jpg", "chanyeol-2.png"],   // 照片來源與授權見 README 與二樓海報旁的標註（CC BY 4.0）
};

window.STATUS = {
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
    id: "pickleball",
    name: "PickleBall",
    zh: "匹克球",
    category: "Sports",
    status: "idea",
    progress: 15,
    summary: "匹克球相關活動與商機。",
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充想法與進度。" },
    ],
  },
];
