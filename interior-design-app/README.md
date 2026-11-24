# Interior Design App（手機版 POC）

純 HTML/CSS/JS，不需要建置。本機預覽：

```bash
cd interior-design-app && python3 -m http.server 5174
```

線上：`https://wcsodw1.github.io/david-side-business/interior-design-app/`

- `data.js`：**虛構**的示範資料（不放真實客戶資料，這個 repo 是公開的）。
- `app.js`：畫面與互動（hash 路由）。新增 / 編輯存在瀏覽器 localStorage，頁尾可「重設示範資料」。
- 畫面：專案列表 → 專案首頁 → 工程進度（含詳情）/ 請款進度 / 重點工程確認 / 備忘錄 / 採購清單。

之後整合進 Gallery：把 `index.html` 的 `#app` 當成容器掛進房間的白板或 iframe 即可。
