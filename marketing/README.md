# Marketing 素材

EziTeach AI 宣傳圖素材(向量 SVG,品牌色 indigo `#4f46e5`)。

| 檔案 | 用途 | 尺寸 |
|---|---|---|
| `eziteach-poster-portrait.svg` | 宣傳海報(直度,A 系列比例) | 1080 × 1509 |
| `eziteach-ig-threads-square.svg` | IG / Threads 方圖 | 1080 × 1080(1:1) |
| `eziteach-ai-poster-generated.svg` | AI 主視覺宣傳海報(可編輯源檔) | 1080 × 1509 |
| `eziteach-ai-poster-generated.png` | AI 主視覺宣傳海報(發佈用 PNG) | 1080 × 1509 |
| `eziteach-ai-poster-visual.png` | AI 生成主視覺底圖 | 1062 × 1482 |
| `ig-launch-pack.md` | IG 帳號定位、首批內容、留言回覆模板 | Markdown |
| `ig/launch-grid/` | IG 首 9 格品牌內容圖 | 1080 × 1080 |
| `ig/post-management.md` | IG 舊帖處理、發布順序、caption、營運節奏 | Markdown |

## 轉 PNG / JPG

SVG 係向量,任何尺寸都清。匯出方法:

- **最簡單**:用瀏覽器開個 `.svg`,screenshot 或印成 PDF。
- **CLI**(要裝):
  - `rsvg-convert -w 1080 eziteach-ig-threads-square.svg -o ig.png`
  - 或 `npx svgexport eziteach-poster-portrait.svg poster.png 1080:`
- **設計工具**:Figma / Inkscape / Canva 直接 import SVG。

## 注意

- 字體用系統 CJK(PingFang HK / Noto Sans HK / 微軟正黑)。喺冇呢啲字體嘅機(例如 Linux CI)轉 PNG,中文可能 fallback 走樣 —— 匯出前裝返 Noto Sans HK。
- 文案只講教師生產力功能(避開未上線嘅學生資料功能)。
- 網址 `eziteach.hk`、客服 `support@eziteach.hk`。
- 海報個 QR 係佔位圖,上線前換真 QR(指向 eziteach.hk)。
