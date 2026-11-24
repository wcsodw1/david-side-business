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
  // 家（房子裡）的歌單（走進家裡自動依序播放、播完循環；右下角出現小播放器；失敗就退回內建音樂）：
  // 米津玄師〈Lemon〉＋ The Hope 教會點閱最高的三首詩歌（在祢沒有難成的事 / 我唯一渴望 / 跟隨祢心意）。藝廊維持內建的 Bossa Nova。
  homeMusicYouTube: ["f5wCZ0-3Eos", "rUvwUc2_66s", "TrHaapOTf-Q", "TEjKi77Kwj8"],
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
    tasks: [
      {name:"繁中翻譯校對",pri:"P0",owner:"David",status:"Doing",progress:60,start:"2026-11-14",end:"2026-11-18",note:"三份字幕 503 段逐段校對"},
      {name:"對照影片檢查時間軸",pri:"P0",owner:"David",status:"To Do",progress:0,start:"2026-11-18",end:"2026-11-21",note:""},
      {name:"重新匯入 Filmora",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-21",end:"2026-11-23",note:""},
      {name:"剪輯與調色",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-23",end:"2026-12-04",note:""},
      {name:"輸出成片與封面",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-04",end:"2026-12-11",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    tasks: [
      {name:"需求與資料表設計",pri:"P0",owner:"David",status:"Done",progress:100,start:"2026-11-09",end:"2026-11-13",note:"訂單、庫存、客戶"},
      {name:"LINE Bot 訊息流程",pri:"P0",owner:"David",status:"Doing",progress:50,start:"2026-11-16",end:"2026-11-27",note:""},
      {name:"庫存進出貨功能",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-30",end:"2026-12-11",note:""},
      {name:"訂單與客戶查詢",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-12-14",end:"2026-12-23",note:""},
      {name:"內部測試與上線",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-28",end:"2027-01-08",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    tasks: [
      {name:"租客資料整理",pri:"P1",owner:"David",status:"Done",progress:100,start:"2026-11-09",end:"2026-11-13",note:""},
      {name:"租金收款記錄",pri:"P1",owner:"David",status:"Doing",progress:60,start:"2026-11-16",end:"2026-11-20",note:""},
      {name:"合約到期提醒",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-11-23",end:"2026-11-27",note:""},
      {name:"房屋修繕追蹤",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-11-30",end:"2026-12-04",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    tasks: [
      {name:"訂單整理流程（Google Sheet）",pri:"P0",owner:"David",status:"Doing",progress:70,start:"2026-11-09",end:"2026-11-20",note:"多行訂單合併成固定格式"},
      {name:"菜單與成本表",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-23",end:"2026-12-04",note:""},
      {name:"營運數據週報",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-12-07",end:"2026-12-11",note:""},
      {name:"活動與推廣企劃",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-14",end:"2026-12-25",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    tasks: [
      {name:"客戶名單與追蹤表",pri:"P0",owner:"David",status:"Doing",progress:60,start:"2026-11-09",end:"2026-11-20",note:""},
      {name:"健康檢測推廣流程",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-23",end:"2026-12-04",note:""},
      {name:"每週跟進與回訪",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-12-07",end:"2026-12-18",note:""},
      {name:"內容與社群經營",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-07",end:"2026-12-25",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    tasks: [
      {name:"商品清單與定價",pri:"P0",owner:"David",status:"Done",progress:100,start:"2026-11-09",end:"2026-11-13",note:""},
      {name:"模板設計與製作",pri:"P0",owner:"David",status:"Doing",progress:50,start:"2026-11-16",end:"2026-11-27",note:""},
      {name:"Gumroad 上架與文案",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-30",end:"2026-12-08",note:""},
      {name:"宣傳與首批銷售",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-09",end:"2026-12-23",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
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
    wbDefault: { status: "TODO", note: "咖啡豆報價已拿到：兩份，一份曼特寧 / 曼巴等經典豆（半磅 $220–450），一份衣索比亞 / 中南美精品豆 12 款（一磅 $800–1,200）。", noteAt: "2026-11-14", next: "各挑 2–3 款主打（經典 + 精品），算成本與售價，先用半磅開始。" },
    summary: "咖啡廳籌備：豆子選品、成本與菜單。",
    tasks: [
      {name:"咖啡豆報價比較",pri:"P0",owner:"David",status:"Doing",progress:60,start:"2026-11-14",end:"2026-11-18",note:"兩份報價：經典豆 / 精品豆"},
      {name:"挑選主打 2–3 款",pri:"P0",owner:"David",status:"To Do",progress:0,start:"2026-11-18",end:"2026-11-20",note:""},
      {name:"成本與售價試算",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-20",end:"2026-11-25",note:"先用半磅開始"},
      {name:"菜單與品牌雛形",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-11-26",end:"2026-12-09",note:""},
      {name:"場地與設備評估",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-10",end:"2026-12-30",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
    links: [],
    updates: [
      { date: "2026-11-14", title: "專案頁建立", text: "加入平台，開始整理咖啡豆報價與品項。" },
    ],
  },
  {
    id: "tpi",
    name: "TPI",
    zh: "TPI 辦公室",
    category: "Work",
    status: "building",
    progress: 50,
    summary: "TPI 辦公室：內容已加密，到辦公室輸入 TPI 密碼與金鑰後顯示。",
    tasks: [],   // 實際內容在 data/tpi.enc.js（AES-GCM 加密）
    links: [],
    updates: [],
  },
  {
    id: "interior-design-app",
    name: "Interior Design App",
    zh: "室內設計 App",
    category: "Software",
    status: "idea",
    progress: 5,
    summary: "室內設計 App：讓使用者規劃空間、挑選風格與家具。",
    links: [],
    updates: [
      { date: "2026-11-24", title: "專案頁建立", text: "加入平台，開始構想室內設計 App。" },
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
    tasks: [
      {name:"市場與場地調查",pri:"P1",owner:"David",status:"To Do",progress:0,start:"2026-11-23",end:"2026-12-04",note:""},
      {name:"活動型態構想（教學 / 賽事）",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-07",end:"2026-12-18",note:""},
      {name:"成本與合作對象",pri:"P2",owner:"David",status:"To Do",progress:0,start:"2026-12-21",end:"2027-01-08",note:""},
    ],   // 預設時程（草案，可在白板「時程」分頁改）
    links: [],
    updates: [
      { date: "2026-11-12", title: "專案頁建立", text: "加入平台，待補充想法與進度。" },
    ],
  },
];
