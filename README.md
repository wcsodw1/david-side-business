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

## 圖片授權 / Image credits

二樓海報使用的照片來自 Wikimedia Commons，皆為 **CC BY 4.0**（需標註作者；已縮小尺寸以利網頁載入）：

| 檔案 | 作者 | Commons 檔名 |
|---|---|---|
| `chanyeol-1.jpg` | ggbye1127 | Chanyeol during the Exo Planet 5 – Exploration concert on December 2019.jpg |
| `chanyeol-2.jpg` | OXO | Park Chan-yeol at Melon Music Awards on November 19, 2016.png |
| `chanyeol-3.jpg` | SHAQ Photo | Park Chan-yeol - 2016 Gaon Chart K-pop Awards red carpet.jpg |
| `chanyeol-4.jpg` | ggbye1127 | Chanyeol at WKF×Chanyeol on September 25, 2019 (3).jpg |
| `chanyeol-5.jpg` | ggbye1127 | Chanyeol at PRADA Escape Pop-up Store Event on November 15, 2019.jpg |
| `chanyeol-6.jpg` | ggbye1127 | Chanyeol during the Exo Planet 5 – Exploration concert on December 2019 (6).jpg |
| `chanyeol-7.jpg` | ggbye1127 | Chanyeol at a Dynamic Duo concert on December 8, 2019.jpg |

授權全文：https://creativecommons.org/licenses/by/4.0/
