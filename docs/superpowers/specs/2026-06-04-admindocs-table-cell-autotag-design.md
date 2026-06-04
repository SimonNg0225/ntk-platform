# 行政文件 — 表格格 auto-tag（AI 識別插入空格）設計 spec

> 日期：2026-06-04 · 狀態：design approved（用戶「全部做」）→ workflow
> 升級：令 AI 識別對「表格型」未填表單真正有用（現 injectTags 只做同 run inline，表格格命中率 22%）

## 目標

AI 識別欄位後，自動把 `{標籤}` 插入**表格內 label 格旁邊嘅空格**，令港式「一格 label + 隔離格填寫」表單可自動建範本（目標命中率 22% → ~90%+）。

## Grounding（真表單結構，已剖開 /tmp/ntk_blank.docx）

- 表1（2 格/行）：`[label] | [空格]` —— 經典 key-value。
- 表2（4 格/行）：`[label] | [空] | [label] | [空]` —— 一行兩對。
- 特例：`參加人數 | 老師︰` / `空 | 學生︰`（label 喺 value 格內、填喺冒號後）→ 走 inline 冒號（已加 U+FE30）。

## 設計

新檔 `src/features/work/adminDocs/docxTableInject.ts`：
- `injectTagsIntoCells(buf: ArrayBuffer, fields: {tag:string; label:string}[]): InjectResult`（{base64, injected[], failed[]}，同 docxAi InjectResult 形狀）。
  1. Parse document.xml：`<w:tbl>` → `<w:tr>` → `<w:tc>`；每格文字 = concat 格內 `<w:t>` → trim。
  2. 對每個 field：搵「整格 trimmed 文字 == field.label（或去掉尾冒號後相等）」嘅 label 格。
  3. **目標格**：(a) 同行**右鄰** `<w:tc>` 且係空（無 `<w:t>` 文字）→ 用佢；(b) 否則**正下方**（下一 `<w:tr>` 同 column index）且空 → 用佢；(c) 都唔得 → failed。
  4. 插入：喺目標格第一個 `<w:p>`（`<w:pPr>` 之後、`</w:p>` 之前）加 `<w:r><w:t xml:space="preserve">{escaped tag}</w:t></w:r>`。
  5. **安全**：全部插完 → 重砌 zip + sanity 重讀 document.xml；任何 throw → 放棄全部、回原檔 + 全 failed（沿用 injectTags「寧願唔改唔好整爛」）。compression: 'DEFLATE'。
- column index 計算要考慮 `<w:gridSpan>`（合併格）——簡化：按 `<w:tc>` 順序索引；遇 gridSpan 時 below 規則保守跳過（寧失唔錯）。

整合：`docxAi` 或 TemplateUpload AI 流程加一個 combined `autoTagFields(buf, fields)`：
- 對整批 fields：先跑 `injectTags`（inline：底線/空括號/冒號）→ 再對「inline failed」嘅跑 `injectTagsIntoCells`（表格格）→ 合併。某 field 任一成功即 injected，兩者都唔得先 failed。
- 兩步都用同一安全原則；最後一次重砌。
- TemplateUpload 嘅「AI 識別欄位」改 call autoTagFields（取代淨 injectTags）。TemplatePreview 顯示 placed（有色）/ failed（未對應，提示手動）不變。

## 測試

- `docxTableInject.test.ts`（committed，用**合成 docx** fixture，PizZip 砌）：
  - 2 欄 `[label]|[空]` 表 → injectTagsIntoCells 後該空格含 `{tag}`、其餘不變、輸出有效 docx。
  - 4 欄 `[a]|[空]|[b]|[空]` 表 → a/b 各自右鄰格入 tag。
  - 下方格規則：`[label]` 上、空格喺正下方 → 入下方格。
  - 目標格非空 → 該 field failed（唔覆蓋）。
  - 安全：merged/壞結構 → 回原檔 + failed（唔 throw）。
- **即棄 probe**（agent 跑、唔 commit、跑完刪）：對真檔 `/tmp/ntk_blank.docx` 用合理 fields 跑 autoTagFields → report 真實命中率（目標 ~90%+，對比舊 22%）。

## 範圍外 / 限制

- 合併格（gridSpan/vMerge）保守處理（寧 failed 唔錯插）。
- label 喺 value 格內（老師︰）靠 inline 冒號，best-effort。
- 唔改 fillDocx / FillForm / highlight / TemplatePreview UI（純加 auto-tag 能力 + 換 TemplateUpload 個 call）。
- AI suggestFields 質素仍需 gemini（Vercel）實測；本 spec 只保證「畀啱 label，就插到格」。

## 階段（workflow 2 sequential agent）

- **Agent 1**：`docxTableInject.ts`（injectTagsIntoCells 右鄰+下方+安全重砌）+ `docxTableInject.test.ts`（合成 fixture）+ 即棄 probe 量真檔命中率。tsc 0 + vitest + build。
- **Agent 2**：`autoTagFields`（inline + 表格格合併）+ 改 TemplateUpload AI 識別 call 佢 + 即棄 probe 重量真檔。tsc 0 + build + 全測試。
