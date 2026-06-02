# 全功能頁「訂造美學」重塑 — 實作計劃

> **For agentic workers:** 執行機制 = **Workflow tool**（user 明確要求多 agent fan-out），唔行 TDD subagent-per-task。每波一個 Workflow script，波與波之間由主 loop 做驗證 gate。

**Goal:** 用多 agent workflow 將全部 31 個 NTK Platform 功能頁逐頁訂造獨特美學，純表現層，騎用同一套 token。

**Architecture:** 3 波 Workflow（A/B/C）。每波 = 一個 `Workflow({script})`，script 內每頁 spawn 一個深度 design agent（預設 subagent，有 Edit/Write），各收「訂造概念 + frontend-design 原則 + 設計憲法」。每波 barrier 後，主 loop inline 跑 `tsc` →（有 error）定點修 → preview 抽查 → 先放下一波。

**Tech Stack:** React 18 + TS + Tailwind（mode-aware CSS vars）+ vite + 共用 `src/ui` kit。Fraunces serif 已載入（`font-serif`）。

來源 spec：`docs/superpowers/specs/2026-06-02-bespoke-page-redesign-design.md`

---

## Agent Prompt 模板（每頁注入概念）

每個 Workflow agent 收以下 prompt（`<…>` 由 script 按頁替換）：

```
你係資深 UI/UX 設計工程師，重塑 NTK Platform 一個功能頁嘅【外觀】。

【目標頁】<NAME>
  主檔：<FILE>.tsx；可連埋同 folder 嘅 presentation 子檔一齊提升。
【訂造概念】<CONCEPT>
  ← 呢頁要呈現嘅獨特 aesthetic identity（呼應功能）。概念獨特，但色票/元件共用。
【模式】<new = 全新訂造 | elevate = 由暖色 pass 升級到呢個概念 | preserve = 只校對輕 refine，唔重寫>

【frontend-design 核心原則】
- Commit 一個清晰 bold 方向，精準執行（minimal 或 maximalist 都得，要 intentional）。
- Typography 層次分明；可用 font-serif（Fraunces）做 display 點綴，唔好濫；唔好淨係靠 serif 當「設計」。
- Motion 只喺高影響時刻（入場 stagger、hover 位移/陰影），尊重 prefers-reduced-motion；唔好用會推版面嘅 scale。
- Spatial：留白節奏、清楚主次/primary CTA、避免「一排一模一樣嘅卡」。
- 殺死 generic AI 感：唔好死板均勻 grid、spreadsheet 感、機械文案；空狀態要有溫度（友善廣東話 + 明確下一步）。

【設計憲法 — 硬約束（違反即係整爛 app）】
1. 只改呢頁嘅 feature 檔（主檔 + 同 folder 子檔）。嚴禁改任何 shared：src/ui/*、src/index.css、
   tailwind.config.js、src/context/*、src/lib/*、src/data/*、src/modes/*、registry、或第二個 feature。
   要改 shared → 唔好改，喺 report 寫低建議。
2. 保留一切功能：資料流、collection、props、state、event handler、default export 同其簽名（registry
   lazy import，唔可以改簽名）。淨係動外觀 / 排版 / 文案。
3. mode 色用 accent / accent-soft / accent-strong class（唔硬寫主題 hex）；分類色（violet/blue/amber/
   rose/emerald/sky）可用。所有色加 dark: 對應。
4. 375px 手機零橫向溢出（闊內容自己包 overflow-x-auto）；唔加新 npm dep。
5. emoji 唔當 UI icon（用 lucide-react）；用戶自選分類 emoji 例外。
6. 收貨標竿 = src/features/learning/dashboard/BentoOverview.tsx 同 src/features/learning/Journal.tsx。
7. 改完 `npx tsc --noEmit 2>&1 | grep <主檔名>`，唔可以有自己造成嘅 error（清走未用 import/變數）。

【交付】真係改好檔案（唔係只描述）。然後回傳 structured report：
  files（改咗邊幾個）、concept_applied（2-3 句點落地）、shared_suggestions（有/無）、self_tsc_clean（bool）。
```

Workflow script 每頁用 `agent(prompt, { label, phase, schema: REPORT_SCHEMA })`；REPORT_SCHEMA = {files:string[], concept_applied:string, shared_suggestions:string, self_tsc_clean:boolean}。並行由 `parallel()` / 直接多 `agent()` 帶起（並行上限自動 min(16,cores-2)）。

---

## Wave A — 高影響力、未做過獨特 pass（10 頁）

| 頁 | 檔 | 概念 |
|---|---|---|
| 知識卡 + 複習 | `learning/Flashcards` | 實體索引卡牌組，翻卡 affordance |
| 習慣追蹤 | `learning/HabitTracker` | 老黃曆格 + 連續鏈條 dot-matrix |
| 閱讀清單 | `learning/ReadingList` | 書架書脊 / 圖書館，書籤緞帶進度 |
| 健身中心 | `learning/Fitness` | 運動計分板 / 能量，粗大數字 |
| 個人目標 | `learning/GoalsWidget` | 登山 / 里程碑路徑 |
| 行事曆 | `shared/Calendar` | 精緻週記，柔和事件 chip，去 Excel |
| 快速擷取 | `shared/Inbox` | 收件匣 / 便條捕捉 triage |
| 重要日子倒數 | `shared/Countdown` | 機場離境牌 / 車票，split-flap 感 |
| 自我測驗 | `shared/QuizMode` | 問答遊戲卡 / 競賽，score reveal |
| 專注計時器 | `learning/FocusTimer` | 禪意極簡 / 呼吸盤，偏深靜 |

- [ ] **A1**：`Workflow({script})` — 10 個 agent（上表），每個收模板 prompt（概念注入）。
- [ ] **A2**：主 loop 跑 `npx tsc --noEmit`；有 error → 逐檔睇 + 定點 fix（必要時再派 agent）。
- [ ] **A3**：preview 抽查 3-4 頁（淺 + 深 + 375px），確認無溢出 / mode 色 / 無 regress。
- [ ] **A4**：`git add` 改動檔 + commit（`feat: Wave A 訂造美學 — Flashcards/Habit/...`）。
- [ ] **A5**：報告 user，等放行 Wave B。

## Wave B — 其餘 content 頁（11 頁）

| 頁 | 檔 | 概念 |
|---|---|---|
| AI 生成知識卡 | `learning/CardGenerator` | 生成爐 / 流水線，卡片逐張現身 |
| 個人筆記 | `learning/NotesWidget` | 手稿稿紙 / marginalia |
| 健康追蹤 | `learning/HealthTracker` | 生命徵象儀表，sparklines |
| BAFS 題庫 | `work/QuestionBank` | 試卷 / 考評檔案 |
| 教學資源庫 | `work/ResourceLibrary` | 資料館 / 卡片目錄 |
| 收支記帳 | `work/BudgetTracker` | 帳本 / 收據，tabular-nums |
| 問我嘅資料 AI | `shared/AskData` | 資料偵探 / 查詢台 |
| 全域搜尋 | `shared/GlobalSearch` | 指揮中心 / 探照燈 |
| 課程進度 | `work/CurriculumProgress` | 教學大綱 / 路線圖（elevate）|
| 備課 / 教案 | `work/LessonPlanner` | 教案卡 / 黑板（elevate）|
| 時間表 | `work/Timetable` | 週記時間網格 cycle-day（elevate）|

- [ ] **B1**：`Workflow({script})` — 11 個 agent。
- [ ] **B2–B5**：同 A2–A5（tsc → preview → commit → 報告）。

## Wave C — 工作頁 elevate（6）+ preserve 校對（4）

| 頁 | 檔 | 概念 | 模式 |
|---|---|---|---|
| 班別管理 | `work/ClassesWidget` | 點名冊 / 班牌 | elevate |
| 成績管理 | `work/Gradebook` | 成績冊 / 分數矩陣 | elevate |
| 點名 / 出席 | `work/Attendance` | 出席卡 / 蓋章 | elevate |
| 家長溝通 | `work/ParentComms` | 書信 / 通訊錄 | elevate |
| 待辦 / 批改 | `work/TodoWidget` | checklist + 批改紅筆 | elevate |
| 會議筆記 | `work/MeetingNotes` | 速記簿 / 議程 | elevate |
| 個人儀表板 | `learning/LearningDashboard` | bento（標竿）| preserve |
| 工作儀表板 | `work/WorkDashboard` | bento（標竿）| preserve |
| 個人日誌 | `learning/Journal` | editorial diary | preserve |
| 個人 AI 助手 | `shared/AIAssistant` | 沉穩對話 | preserve |

- [ ] **C1**：`Workflow({script})` — 6 個 elevate agent + 4 個 preserve「校對」agent（preserve 只搵明顯 regress / 加細微 polish，唔重寫）。
- [ ] **C2–C4**：tsc → `npm run build` 綠燈 → preview 抽查。
- [ ] **C5**：最終 commit + 報告（連 shared_suggestions 彙總，等 user 決定要唔要中央處理）。

## 驗證（每波必做）

1. `npx tsc --noEmit` = 0 error（權威，主 loop 跑）。
2. 末波後 `npm run build` 綠燈（連 PWA）。
3. preview：淺 + 深 + 375px 抽查；確認無橫向溢出、mode 色、preserve 頁無 regress。

## 煞車 / 調整

- 每波 barrier 後停低，user 可睇進度、改概念、叫停。
- 任何 agent 提出 shared 改動建議 → 唔即刻做，彙總畀 user 中央決定。
