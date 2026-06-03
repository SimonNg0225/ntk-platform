# 工作模式「教材生成區」— 設計 spec

> 日期：2026-06-03 · 狀態：待 user review
> 流程：brainstorm（問答）→ 本 spec → writing-plans → 分階段實作

## 目標

工作模式加一個 **「教材生成」hub**，集中 5 種 AI 教材生成，**主要存入 BAFS 題庫**（再可組卷 / 出自測 / 重用）：
1. MC 生成　2. 短答題生成　3. 教學練習生成　4. 試卷生成　5. 教學個案 case study 生成

## 關鍵發現（落手前先睇現有）

- **題庫已有完整 AI 出題引擎**（`QuestionBank.tsx` 的 `AIGenerateModal`）：
  - `AIType = 'mc' | 'short'` ＋ 課題 / 難度 / 數量 / 補充指示 ＋ 範例 chips。
  - `buildPrompt()`（要 AI 回 JSON）→ `extractJsonArray()` ＋ `toDraft()` 解析 → setup→review→存 `questionsCol`。
  - 用 `complete()`（`lib/aiClient`）＋ `isAIConfigured` gate。
- **題庫 model 已涵蓋 4 種**：`QuestionType = 'mc' | 'short' | 'long' | 'case'`，有 `options/answerIndex/answer/marks/difficulty/stem/topicId`。
- 組卷已有 `papersCol`（`'questionbank.papers'`，`SavedPaper`）。

→ **即係 MC + 短答已經做到。** 真正缺：個案、試卷、練習（＋順手加結構式長題）。

## 已拍板（user）

- 生成完**主要存入 📚 題庫**（questionsCol）。
- 行 superpowers spec → **分階段**。

## 設計原則：擴充，唔重造

**唔好整一個同題庫割裂嘅平行引擎。** 做法：
1. **抽共用引擎** → `src/features/work/materialGen/engine.ts`：
   - `buildPrompt(kind, topicName, opts)`、`parseDrafts(kind, raw)`、`generate(kind, opts)`（包 `complete()` + `extractJsonArray`）。
   - 由現有 `QuestionBank` `buildPrompt/toDraft/extractJsonArray` 抽出嚟（題庫個 modal 改用呢個共用引擎，零行為改變）。
2. **擴充 kind**：`mc | short | long | case`（長題＝結構式 a/b/c＋marking；個案＝情境＋引導小題＋marking）。
3. **新增** 試卷組合 + 練習 worksheet。
4. **新 feature「教材生成」hub** 做 5 個入口；題庫嗰個「AI 出題」掣最終跳入 hub（過渡期可並存）。

## 5 個 generator + 輸出 / 存去邊

| # | Generator | 輸出（JSON schema）| 存 |
|---|---|---|---|
| 1 | MC 生成 | `{stem, options[≥3], answerIndex, marks}` | 題庫 `type:'mc'` |
| 2 | 短答題生成 | `{stem, answer, marks}` | 題庫 `type:'short'` |
| 5 | 個案生成 | `{stem(情境), parts:[{q, answer, marks}], answer(整體 marking)}` | 題庫 `type:'case'` |
| (＋) | 結構式長題 | `{stem, parts:[a/b/c…], answer(marking scheme), marks}` | 題庫 `type:'long'` |
| 4 | 試卷生成 | 揀課題範圍 + 各類題數/分數 → 由**題庫抽現有題 + 唔夠先生成** → 一份 `SavedPaper` | `papersCol` |
| 3 | 教學練習生成 | 混合 worksheet（數條 mc+short）| 拆成多條入**題庫**（user 揀），＋可印 |

> 個案 / 長題嘅 `parts[]` 喺存題庫時平鋪入 `stem`（含小題）+ `answer`（含 marking），維持現有 Question model 不變（YAGNI，唔加新欄）。

## UI / UX

- 新 feature「教材生成」（work，教學組）：5 張 generator 卡（印刷廠 / 工作枱概念，跟你 bespoke 風格）。
- 每個 generator：表單（課題下拉＝BAFS 27 課題 / 程度 / 數量 / 難度 / 補充）→ 生成 → **預覽逐題可編輯 / 揀要邊條** → 「存入題庫」（試卷→存組卷）。
- 結果加「**喺 AI 助手繼續傾**」捷徑（連返自由追問）。
- 未接 AI（`isAIConfigured` false）→ 友善降級（同 AI 助手 gate 一致）。

## 分階段

| 階段 | 範圍 | 點解 |
|---|---|---|
| **A** | 抽共用引擎 + 擴 `case` / `long` → 入題庫 | 重用現成引擎，最快補齊「個案/結構式」；驗證共用引擎 |
| **B** | 試卷生成（題庫抽題 + 生成補足 → SavedPaper，可印） | 接 papersCol，組卷自動化 |
| **C** | 教學練習 worksheet + 「教材生成」hub 頁（5 入口）+ 題庫「AI 出題」改跳 hub | 收尾整合成一個區 |

## 硬性規範

1. 重用 `complete()` / `questionsCol` / `papersCol` / `topicsCol` / `Question` model（唔加新 collection；YAGNI）。
2. 抽引擎時，題庫現有 AI 出題**行為不變**（只係改用共用 module）。
3. AI gate（`isAIConfigured`）；tsc 0；唔破壞題庫 / AI 助手 / 組卷。
4. mode 色（work＝teal）/ 深色 / 375px。
5. 結構化輸出靠 prompt 要 JSON ＋ 寬鬆 parser（`extractJsonArray` 已有）＋ parse 失敗友善提示。

## 範圍外

- 唔做圖片 / 圖表題（純文字）。
- 唔做自動評分（生成 + 入庫；批改仍靠老師 / 現有流程）。
- 試卷美術排版 = 簡潔可印即可，唔做 LaTeX 級。
