# 全域「快速加入」（AI 一鍵輸入 → 待辦／提醒／行事曆）— 設計 spec

> 日期：2026-06-03 · 狀態：待 user review
> 流程：brainstorm（已完成問答）→ 本 spec → writing-plans → 實作

## 目標

App 右上角一個全域入口：用戶用**自然語言**打一句（例：「下星期三 3pm 同 5A 家長開會」），**AI 自動分析**並分類成 **待辦 / 提醒（倒數）/ 行事曆事件**，出**預覽卡**畀用戶確認/修改後存入對應 collection。

## 已拍板（brainstorm）

1. **分流目標**：3 類 —— 待辦 `Task`（無日期）、提醒倒數 `Countdown`（有明確日子）、行事曆事件 `CalendarEvent`（有時間/時段）。AI 自動分類。
2. **落入方式**：AI 分析 → **預覽卡（類型/標題/日期/時間可即改）→ 撳確認先存**（防 AI 估錯日子）。
3. **未接 AI**：友善提示去設定（同其他 AI 功能一致，唔寫本地 parser）。
4. **擺位**：桌面內容區右上固定掣 + 手機 `MobileTopBar` 右邊。

## 架構

新目錄 `src/features/shared/quickAdd/`：
- **`parse.ts`** — 純函數 + AI 包裝：
  - `interface ParsedDraft { kind: 'task'|'countdown'|'event'; title: string; date?: string; time?: string; endTime?: string; category?: CountdownCategory; notes?: string; mode: 'learning'|'work' }`
  - `buildQuickAddPrompt(text, today, weekday, mode): string` —— 要 AI 回**單一 JSON 物件**，內附今日日期/星期，令佢解到「聽日 / 下星期三 / 3pm」。
  - `toDraft(raw: unknown, mode, today): ParsedDraft | null` —— **純函數**，容錯解析 + 正規化（date 補成 YYYY-MM-DD、time 補成 HH:mm、kind 校驗）。**寫單元測試。**
  - `async parseQuickAdd(text, mode): Promise<ParsedDraft | null>` —— 包 `complete()` + `extractJsonObject` + `toDraft`。
- **`QuickAddModal.tsx`** — 輸入 textarea →「分析」→ 預覽卡（類型 segmented：待辦/提醒/行事曆 + 標題/日期/時間/分類可改）→「加入」→ 寫 collection → toast +「檢視」捷徑。未接 AI 顯示友善 gate；parse 失敗退做手動預覽。
- **`QuickAddButton.tsx`** — 觸發掣（`＋`/Sparkles icon + 「快速加入」），開 modal。

共用既有（**零新 collection、零改 model**）：`complete()`/`isAIConfigured`（aiClient）、`countdownsCol`/`tasksCol`/`eventsCol`（collections）、`useNav`、`Modal`/`Field`/`OptionButtons`/`Textarea`/`SegmentedControl`（ui）、`todayStr()`/`localDateStr()`（srs）、`useMode()`（目前模式）。

`lib/aiJson` 新增 **`extractJsonObject<T>(raw): T | null`**（沿用 `stripJsonFence`；補返 object 版，現只有 `extractJsonArray`）。

## 擺位接線

- `App.tsx`：主內容區掛一次 `QuickAddButton`（桌面右上角固定/sticky，所有頁可見），開 `QuickAddModal`。
- `MobileTopBar.tsx`：右邊（搜尋掣隔籬）加一個 `onQuickAdd` IconButton。
- （順手、低成本）`CommandPalette` 加一條「快速加入」+ 全域鍵盤捷徑開 modal。

## 資料流

```
輸入「下星期三 3pm 同 5A 家長開會」
  → parseQuickAdd(text, mode)
      complete({ prompt: buildQuickAddPrompt(text, todayStr(), 星期, mode) })
      → extractJsonObject → toDraft
  → ParsedDraft { kind:'event', title:'同 5A 家長開會', date:'2026-06-10', time:'15:00', mode:'work' }
  → 預覽卡（可改類型/標題/日期/時間）
  → 確認 → 寫對應 collection → toast「已加入行事曆」+「檢視」→ nav.open(目標頁)
```

## AI 分類規則（prompt 內明確）

- 有**明確時間/時段**（「3pm」「下午兩點到四點」）→ `event`（CalendarEvent；`allDay = !time`）
- 有**日子但似死線/考試/重要日**（「6 月 20 號交報告」「下月 5 號測驗」）→ `countdown`（自動估 `category`：exam/deadline/assessment/event/other）
- **無日期、純一件要做嘅事**（「影印筆記」「跟進家長電郵」）→ `task`
- 繁體中文；`title` 精煉；解唔到日期就留 null（預覽卡再由用戶填）。
- `mode` 跟目前 app 模式；`Countdown`/`CalendarEvent` 帶 `mode` tag，`Task` 入 `tasksCol`。

## 目標映射（確認後寫入）

| kind | collection | 寫入 |
|---|---|---|
| task | `tasksCol`（待辦/批改）| `{ text: title, done:false, createdAt }` |
| countdown | `countdownsCol` | `{ title, date, time?, category?, mode, notes?, createdAt }` |
| event | `eventsCol` | `{ title, date, time?, endTime?, allDay:!time, mode, notes? }` |

toast 後「檢視」→ `nav.open`：task→`work-tasks`、countdown→`countdown`、event→`calendar`。

## 錯誤處理

- `!isAIConfigured` → modal 內友善 gate（機械人 icon + 去 docs/SETUP；同題庫 AI 出題一致）。
- parse 回 null / 格式錯 → 預覽卡退做**手動模式**（kind 預設 task、title = 原文，用戶自己揀類型/填日期），唔卡死、唔靜靜存錯。
- `complete()` 出錯/逾時 → toast 提示，保留輸入可重試。
- 日期：相對詞由 AI 配合 `todayStr()` 解；最終以預覽卡為準（用戶可改）。

## 測試

- `parse.test.ts`：餵多句 JSON（event/countdown/task、相對日期、缺日期、亂格式）→ 斷言 `toDraft` 輸出 kind/date/time/正規化/null fallback。
- `extractJsonObject`：fence/雜訊/非物件 → 斷言取到 object 或 null。
- 收尾：`tsc` 0 · `build` · preview 實開（未接 AI 見 gate；接咗試 3 類各一）。

## 範圍外（YAGNI）

- 唔做本地（離線）日期 parser。
- 唔做重複事件/地點/提醒分鐘嘅 AI 抽取（預覽卡可後續手動加；第一版淨係 title/date/time/category）。
- 唔做語音輸入。
- 待辦唔分 learning/work（沿用單一 `tasksCol`）。

## 階段

單一階段（功能自足、體積中等）：aiJson helper + parse(+test) → QuickAddModal → QuickAddButton + App/MobileTopBar 接線 (+⌘K/捷徑) → 驗證。
