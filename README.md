# David's Side Business

> A place where dreams come true

靜態網站（純 HTML / CSS / JS），可直接部署到 GitHub Pages。進入需輸入密碼。

## 更新進度

只要編輯 [`data/projects.js`](data/projects.js)：

- **新增 Side Business**：複製任一專案區塊貼進 `PROJECTS` 陣列
- **新增進度**：在該專案 `updates` 最上面加一行 `{ date, title, text }`
- `status`：`idea` / `building` / `live` / `paused`，`progress`：0–100

存檔後 `git push`，GitHub Pages 約 1 分鐘內更新。

## 換密碼

```bash
printf '新密碼' | shasum -a 256
```

把輸出貼到 `js/app.js` 的 `PASS_HASH`。

> ⚠ 密碼檢查在瀏覽器端執行，雜湊值公開在原始碼中。只能擋一般訪客，請勿放真正機密的資料。

## 本機預覽

```bash
python3 -m http.server 5173
```
