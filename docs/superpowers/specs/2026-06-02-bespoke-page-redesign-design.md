# 全功能頁「訂造美學」重塑 — 設計 spec

> 日期：2026-06-02 · 狀態：待 user review
> 流程：superpowers brainstorming → 本 spec → writing-plans → Workflow 執行

## 目標

將 NTK Platform 全部 31 個功能頁嘅設計美感**再進一步提升**，延續「個人儀表板（bento）+ 個人日誌（editorial diary）」嗰種「有溫度、唔似 AI 生成、有層次」嘅水準。

## 已拍板參數（user 決定）

1. **方向 = 每頁訂造獨特風格**（bespoke per page）—— 每頁有自己一個同功能呼應嘅 aesthetic 概念，似日誌嗰種「diary」identity。
2. **範圍 = 全部 31 個 feature component**（連已 redesigned 嘅都納入；已達標嘅只做 preserve / 輕度 refine，避免 regress）。
3. **護欄 = 騎用同一套 token**：mode 色（`accent` / `accent-soft` / `accent-strong`，唔硬寫 hex）、深色模式、共用 `src/ui` kit。獨特係**概念 / 排版 / 質感**，唔係各自一套色系 → 防止 31 頁變拼盤。

## 設計憲法（每個 agent 必收嘅硬約束）

1. **只改自己嗰頁嘅 feature 檔**（`src/features/.../<Feature>.tsx` + 同 folder 嘅 presentation 子檔）。**嚴禁改任何 shared**：`src/ui/*`、`src/index.css`、`tailwind.config.js`、`src/context/*`、`src/lib/*`、`src/data/*`、`src/modes/*`、registry、或第二個 feature 嘅檔。要改 shared → 唔好改，喺 report 寫低建議（我集中處理，杜絕並行衝突）。
2. **保留一切功能**：資料流、collection 用法、props、state、event handler、**default export 同其簽名**（registry 以 lazy default import 載入，唔可以改簽名）。呢次淨係動外觀 / 排版 / 文案。
3. **mode 色**：用 `accent` 系 class（會跟個人=靛藍 / 工作=青藍自動變），唔好硬寫 hex 主題色。
4. **深色模式**：所有顏色加 `dark:` 對應。
5. **唔好水平溢出**：375px 手機只准上下捲；闊內容自己包 `overflow-x-auto`。
6. **唔加新 npm 依賴**；唔改 `package.json`。
7. **emoji 唔當 UI icon**（用 `lucide-react`）；用戶自選分類 emoji 例外。
8. **TypeScript 乾淨**：完成後 `npx tsc --noEmit 2>&1 | grep <自己檔名>` 應無自己造成嘅 error（清走未用 import / 變數 —— 專案有 `noUnusedLocals` / `noUnusedParameters`）。權威全專案 tsc 由我喺每波 barrier 後跑。
9. 收貨標竿 = `src/features/learning/dashboard/BentoOverview.tsx`（bento）+ `src/features/learning/Journal.tsx`（diary）。

## Art Direction：31 頁 × 訂造概念

> status：`preserve` = 已達標只校對 / 輕 refine；`elevate` = 由 Wave-1 暖色 pass 升級到獨特概念；`new` = 未做過獨特 pass，全新訂造。

### 個人模式（learning）

| # | 功能 | 檔 | 訂造概念 | status |
|---|---|---|---|---|
| 1 | 個人儀表板 | `learning/LearningDashboard` | Bento 概覽（標竿本尊） | preserve |
| 2 | 個人 AI 助手 | `shared/AIAssistant` | 沉穩對話（啱啱重塑） | preserve |
| 3 | AI 生成知識卡 | `learning/CardGenerator` | 生成爐 / 流水線：輸入→火花→卡片逐張現身 | new |
| 4 | 個人筆記 | `learning/NotesWidget` | 手稿稿紙 / 旁注 marginalia，暖紙感、ruled lines | new |
| 5 | 知識卡 + 複習 | `learning/Flashcards` | 實體索引卡牌組，翻卡 affordance，複習隊列平靜 | new |
| 6 | 閱讀清單 | `learning/ReadingList` | 書架書脊 / 圖書館，進度做書籤緞帶 | new |
| 7 | 個人目標 | `learning/GoalsWidget` | 登山 / 里程碑路徑，進度做攀升 | new |
| 8 | 習慣追蹤 | `learning/HabitTracker` | 老黃曆格 + 連續鏈條，dot-matrix | new |
| 9 | 專注計時器 | `learning/FocusTimer` | 禪意極簡 / 呼吸，大量留白、單一呼吸盤，偏深色靜 | new |
| 10 | 個人日誌 | `learning/Journal` | Editorial diary（啱啱重塑） | preserve |
| 11 | 健康追蹤 | `learning/HealthTracker` | 生命徵象儀表，柔和臨床、sparklines | new |
| 12 | 健身中心 | `learning/Fitness` | 運動計分板 / 能量感，粗大數字、動態 | new |

### 工作模式（work）

| # | 功能 | 檔 | 訂造概念 | status |
|---|---|---|---|---|
| 13 | 工作儀表板 | `work/WorkDashboard` | Bento 概覽（標竿） | preserve |
| 14 | 課程進度 | `work/CurriculumProgress` | 教學大綱 / 路線圖，進度鐵軌 | elevate |
| 15 | 備課 / 教案 | `work/LessonPlanner` | 教案卡 / 黑板暖感 | elevate |
| 16 | 時間表 | `work/Timetable` | 週記時間網格（cycle-day），去 Excel 化 | elevate |
| 17 | BAFS 題庫 | `work/QuestionBank` | 試卷 / 考評檔案，題卡 + marking-scheme 語氣 | new |
| 18 | 教學資源庫 | `work/ResourceLibrary` | 資料館 / 卡片目錄，tagged 資源卡 | new |
| 19 | 班別管理 | `work/ClassesWidget` | 點名冊 / 班牌 | elevate |
| 20 | 成績管理 | `work/Gradebook` | 成績冊 / 分數矩陣 ledger | elevate |
| 21 | 點名 / 出席 | `work/Attendance` | 出席卡 / 蓋章 | elevate |
| 22 | 家長溝通 | `work/ParentComms` | 書信 / 通訊錄 correspondence | elevate |
| 23 | 待辦 / 批改 | `work/TodoWidget` | checklist + 批改紅筆 accent | elevate |
| 24 | 會議筆記 | `work/MeetingNotes` | 速記簿 / 議程 steno | elevate |
| 25 | 收支記帳 | `work/BudgetTracker` | 帳本 / 收據，tabular-nums 金額、信封預算 | new |

### 共用（shared）

| # | 功能 | 檔 | 訂造概念 | status |
|---|---|---|---|---|
| 26 | 問我嘅資料 AI | `shared/AskData` | 資料偵探 / 查詢台（同 AIAssistant 區隔：data-grounded） | new |
| 27 | 行事曆 | `shared/Calendar` | 精緻週記，柔和事件 chip，today/選中 accent，去 Excel | new |
| 28 | 全域搜尋 | `shared/GlobalSearch` | 指揮中心 / 探照燈，結果分類，keyboard-forward | new |
| 29 | 快速擷取 | `shared/Inbox` | 收件匣 / 便條捕捉，triage flow | new |
| 30 | 重要日子倒數 | `shared/Countdown` | 機場離境牌 / 車票，split-flap 數字感 | new |
| 31 | 自我測驗 | `shared/QuizMode` | 問答遊戲卡 / 競賽，score reveal | new |

## Workflow 架構

- **Phase 0（我 inline）**：本 spec 即係 art direction（概念 + 檔 + status 已定齊）。
- **Phase 1（fan-out，分 3 波）**：每頁一個深度 design agent，按其概念 + 設計憲法重塑。每波之間我 review 一致性 + 跑權威 tsc，先放下一波。
  - **Agent 類型**：用 Workflow 預設 subagent（有 `Edit`/`Write`）。**唔用 `feature-dev:code-architect`**（佢係 read-only、冇 Edit/Write，淨係識規劃）。
  - **frontend-design 落地方式**：唔靠 subagent 自己 invoke skill；直接喺每個 agent prompt **內嵌 frontend-design 核心原則**（distinctive typography、commit 一個 bold 方向、motion 用喺高影響時刻、spatial composition、避免 generic AI 美學）+ 該頁訂造概念 + 設計憲法。
  - **Wave A（高影響力、未做過，~10）**：Flashcards, HabitTracker, ReadingList, Fitness, GoalsWidget, Calendar, Inbox, Countdown, QuizMode, FocusTimer
  - **Wave B（其餘 content 頁，~11）**：CardGenerator, NotesWidget, HealthTracker, QuestionBank, ResourceLibrary, BudgetTracker, AskData, GlobalSearch, CurriculumProgress, LessonPlanner(elevate), Timetable(elevate)
  - **Wave C（Wave-1 工作頁 elevate ~6 + preserve 校對 4）**：ClassesWidget, Gradebook, Attendance, ParentComms, TodoWidget, MeetingNotes ＋ preserve-check：LearningDashboard, WorkDashboard, Journal, AIAssistant
- **Phase 2（我 inline，每波 barrier 後）**：`npx tsc --noEmit` → 有 error 派定點 fix agent 或我手修；全做完跑 `npm run build`。
- **Phase 3（我 inline）**：preview 抽查每波代表頁（淺 / 深色 + 375px 無溢出）。

每個 agent 回傳 structured report：改咗邊幾個檔、概念點落地、有無 shared 改動建議、自己檔 tsc 是否乾淨。

## 驗證

- 每波後權威 `tsc --noEmit` = 0 error 先繼續。
- 全部做完 `npm run build` 綠燈（連 PWA）。
- Preview 抽查：淺色 + 深色 + 375px，確認無橫向溢出、mode 色正常、無 regress。

## 成本與煞車

- 31 個深度 agent ≈ 大量 token。分 3 波 → 每波後可睇進度、隨時叫停 / 調整。
- 並行上限 = min(16, cores-2)，每波 ~10 個會排住跑。

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 31 頁變風格拼盤 | 共用 token 護欄 + 預定概念（呼應功能）+ 每波 review |
| 並行改檔衝突 | 嚴禁改 shared；每 agent 只動自己 feature 檔（互不相干）|
| 改爛邏輯 / 簽名 | 設計憲法 #2 明令保留；tsc + build 把關 |
| 中途 tsc 紅 | 每波 barrier 後我跑權威 tsc + 定點修，先放下一波 |
| preserve 頁被 regress | status=preserve 嗰 4 個只校對，唔重寫 |
