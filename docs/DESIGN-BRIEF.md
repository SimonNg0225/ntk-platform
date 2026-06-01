# NTK Platform — 介面重塑設計綱領（Wave 1）

> 目標：將頁面由「generic、AI 生成、生硬」變成**有溫度、有層次、精緻**的產品介面。
> 品質標竿 = 個人儀表板（`src/features/learning/dashboard/BentoOverview.tsx`）。
> 這是**純表現層 / UX 重塑**——唔可以改邏輯、資料流、props、export。

---

## 1. 設計系統（直接重用，唔好重新發明）

**主色（會跟模式自動變：個人=靛藍 / 工作=青藍，唔好硬寫 hex）**
- 用 Tailwind class：`accent`、`accent-soft`、`accent-strong`（已對應 CSS 變數）。
  例：`bg-accent text-white`、`bg-accent-soft text-accent-strong`、`text-accent`、`border-accent/40`、`focus-visible:ring-accent/40`。

**中性色（Slate）**
- 表面：`bg-white dark:bg-slate-800`；次表面 `bg-slate-50 dark:bg-slate-800/60`。
- 邊框：`border-slate-200/80 dark:border-slate-700/60`。
- 文字：標題 `text-slate-800 dark:text-slate-100`；正文 `text-slate-600 dark:text-slate-300`；弱 `text-slate-400`（**唔好用 slate-400 做正文**，對比不足）。

**分類色（categorical，配 1×1 磚 / icon chip；淺底 + 深字 + 深色 /15）**
- violet / blue / amber / rose / emerald / sky。
  例：`bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300`。

**圓角 / 陰影 / 動效**
- 卡片磚：`rounded-3xl`；內部控件 `rounded-xl`~`rounded-2xl`；pill `rounded-full`。
- 陰影：預設 `shadow-xs`，hover `shadow-md`；hero `shadow-lg shadow-accent/25`。
- 過渡：`transition ... duration-200`（150–300ms）；可互動磚 hover 微升 `hover:-translate-y-0.5`。
- 數字 / 時間：加 `tabular-nums`。

**圖示**
- 一律用 `lucide-react`（24×24、stroke 2）或現有 `FeatureIcon`（`src/features/featureIcons.tsx`，會將 emoji 轉 lucide）。
- **唔好用 emoji 當 UI icon**（用戶自選分類 emoji 例外，保留）。

**現成可重用元件（喺 `src/ui`，相對路徑 import）**
- `Card`、`Button`、`IconButton`、`Modal`、`SectionTitle`、`SegmentedControl`、`Badge`、`Tooltip`、`StatCard`、`cx` 等。**優先重用，唔好自己砌一套。**

**參考檔（落手前必讀）**
- `src/features/learning/dashboard/BentoOverview.tsx`（品質標竿）
- `src/components/FeatureCard.tsx`（分類色 chip 寫法）
- `src/pages/Home.tsx`（hero + 分組）
- `src/ui/index.tsx`（睇清楚有咩元件 / props 可用）

---

## 2. 「抹除 AI 生成感 / 去生硬」具體指令（最重要）

**要殺死的 anti-pattern：**
- 一大幅「一模一樣的卡 / 輸入框排成 grid」——冇主次、冇呼吸。
- 死板均勻間距、硬 grid 線、spreadsheet 感。
- 機械式 / 系統感文案（「無資料」「請輸入」）。
- emoji 當 icon、scale hover 令版面跳動。

**要加入的溫度與層次：**
- **層次**：每頁要有清楚的主視覺 / 主行動（primary CTA），其餘退後；用大小、留白、分組營造節奏。
- **空狀態要有溫度**：柔和插圖或大 icon ＋ 一句友善文案（Cantonese 口吻，配合現有語氣）＋ 一個明確「下一步」CTA，唔好淨係寫「無資料」。
- **微文案**：保持繁中 / 廣東話口吻，可改得更親切自然（但保留原意）。
- **聚焦頁面（AI 助手 / 問資料 / 生卡）**：要似一個沉穩、premium 的對話，唔好似一張死板表單。
  - 歡迎區：友善標題 ＋ 幾個「範例提問」chips（撳一下即填入）。
  - 對話：柔和氣泡、寬鬆行距、清楚的「你 / AI」區隔、串流打字感、載入用骨架或柔和點動。
  - 輸入區：圓潤、貼底、focus 有 accent 環；送出掣明顯。
- **行事曆**：減少硬格線、加大可讀性；今日 / 選中態用 accent；事件用圓角彩色 chip；月 / 週切換用 SegmentedControl；唔好似 Excel。
- **動效**：150–300ms ease；hover 用顏色 / 陰影 / 輕微位移（唔好用會推版面的 scale）；尊重 `prefers-reduced-motion`。

---

## 3. 硬性規範（一定要守，否則會整爛個 app）

1. **只准改你被指派嗰幾個檔案。** 嚴禁改任何 shared 檔：`src/ui/*`、`src/index.css`、`src/modes/*`、`src/lib/*`、`src/data/*`、`src/context/*`、registry、或其他 feature 的檔。若你覺得需要改 shared，**唔好改**，喺報告寫低建議。
2. **保留一切功能**：資料流、collection 用法、props、state、event handler、**default export 同其 props 簽名**（呢啲組件由 registry 以 lazy default import 載入，唔可以改簽名）。呢次只動「外觀 / 排版 / 文案」。
3. **TypeScript 要乾淨**：完成前喺 `/Users/ntk/ntk-platform/ntk-platform` 行 `npx tsc --noEmit`，必須 0 error（專案有 `noUnusedLocals` / `noUnusedParameters`——清走你造成的未用 import / 變數）。
4. **唔好水平溢出**：頁面只准上下捲；闊內容（表格等）要自己包 `overflow-x-auto`。手機（375px）唔可以橫向捲。
5. 唔好加新 npm 依賴；唔好改 `package.json`。
6. 深色模式要照顧（所有顏色加 `dark:` 對應）。

---

## 4. 你的流程

1. 先讀「參考檔」＋ `src/ui/index.tsx` ＋ 你被指派嘅目標檔。
2. 做表現層重塑（focused diff，唔好掃埋邏輯）。
3. 行 `npx tsc --noEmit` 確認 0 error。
4. 回報：改咗邊幾個檔、每個做咗咩、有冇 shared 改動建議、tsc 結果。
