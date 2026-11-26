# ENLIGHT SPACE DESIGN · Interior Design App（手機版 POC）

依 10 張 UI 截圖還原（版面以 390pt 寬 @2.226x 量測，逐畫面並排比對）。純 HTML/CSS/JS，不需要建置。

本機預覽：`cd interior-design-app && python3 -m http.server 5174`
線上：`https://wcsodw1.github.io/david-side-business/interior-design-app/`

## 畫面與跳轉關係

```
專案列表 ──點案場卡片──► 專案首頁
  │ 新增專案（表單）        ├ ‹ → 列表        🔔 → 通知
  │ 全部/進行中/已完工 篩選   ├ 已收款進度「查看明細 ›」 → 請款進度（‹ → 首頁）
  │ 地區標籤、搜尋           ├ 最新工程進度「查看更多 ›」 → 最新工程進度列表
                            │     ├ 分頁：工程進度(9) / 設計調整(1)、搜尋
                            │     ├ 🗑 刪除模式、⬇ 匯出 JSON、新增工程進度（表單）
                            │     └ 點卡片 → 進度詳情（輪播、✎ 編輯）
                            ├ 最新工程進度卡片 → 進度詳情
                            ├ 工程備忘錄「查看更多 ›」→ 備忘錄列表；「＋請新增備忘錄」→ 新增
                            ├ 重點工程確認「查看更多 ›」→ 6 項清單；卡片 → 確認詳情（✎ 編輯）
                            └ 採購清單「查看更多 ›」→ 採購清單
請款進度：點「完成／待收」切換、✎ 編輯日期與備註、編輯設定（合約金額）、新增設計費用／追加減款項
```

## 品牌 Logo

- `img/brand/`：`logo-dark.svg`（黑底白線，主要版本）、`logo-white.svg` / `logo-black.svg`（透明底）、`icon.svg`、PNG 匯出檔。
- 由 `tools/make_logo.py` 產生（字母全部用線條路徑畫，不依賴字型）。改尺寸或線寬就改這支再執行。

## 五款風格（只換背景色與文字顏色）

| 風格 | 網址 | 色調 |
|---|---|---|
| 工業風 | `themes/industrial/` | 清水模深灰、鏽鐵、黃銅 |
| 歐風 | `themes/european/` | 象牙白、酒紅、古典金 |
| 美式 Tropical | `themes/tropical/` | 薄荷白、棕櫚綠、珊瑚橘 |
| 日系無印良品 | `themes/muji/` | 牛皮紙米色、暖灰、低彩度紅 |
| 日系京都 | `themes/kyoto/` | 和紙、抹茶綠、朱紅 |

- 顏色全部是 `style.css` 的 CSS 變數；每款風格是一個 `[data-theme=...]` 區塊，改色只改那裡。
- 每款有自己的 manifest 與圖示，可以各自安裝到主畫面（共用同一份程式與資料）。
- 總覽頁 `themes/`（預覽 + QR Code）；`tools/make_themes.py` 重新產生各風格頁面。

## 安裝到主畫面（PWA）

- `manifest.webmanifest` + `sw.js`（離線可開）+ `icons/`。
- iPhone：Safari → 分享 → 加入主畫面。Android：Chrome → ⋮ → 安裝應用程式（頁面底部也會跳出安裝提示）。
- 分享用的說明頁（含 QR Code）：`install.html`。
- 改了檔案要讓已安裝的 App 更新：調整 `sw.js` 的 `CACHE` 版本字串即可。

## 資料

- `data.js`：示範資料。標「（示意）」的項目，是截圖沒有、為了讓流程完整而補的。
- 新增 / 編輯存在瀏覽器 localStorage；頁尾「重設示範資料」可還原。
- `img/`：從截圖裁出的照片與插圖。

> ⚠ 這個 repo 與網頁是公開的（頁面有 noindex）。資料含案名與屋主姓氏，若不想公開，改 `data.js` 即可。

之後整合進 Gallery：`#app` 容器可直接掛進房間白板或 iframe。
