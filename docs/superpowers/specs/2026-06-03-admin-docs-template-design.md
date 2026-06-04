# 工作模式「行政文件」— Word 範本填充編輯區 設計 spec

> 日期：2026-06-03 · 狀態：待 user review
> 流程：brainstorm（已完成）→ 本 spec → writing-plans → 分階段實作

## 目標

老師上載 Word（.docx）範本（表格 / 通知 / 申請表等），系統認到要填嘅欄位 → 老師逐欄輸入（可 AI 草擬）→ 系統以**100% 一模一樣嘅格式**生成 .docx 下載去印。

## 已拍板（brainstorm）

1. **欄位機制**：兩者都要 —— 手動 `{標籤}`（地面真相）+ AI 建議/自動加標籤（best-effort，用戶確認）。
2. **輸出/列印**：生成 .docx 下載（Word/Google Docs 開咗印 = 100%）+ app 內 `docx-preview` 近似預覽核對。
3. **AI 角色**：AI 幫**草擬內容**填入欄位。
4. **依賴**：OK 加 `docxtemplater` + `pizzip`（+ `docx-preview` 預覽）。

## 關鍵技術現實（誠實記錄）

- **「100% 一樣」只能靠佔位填充**：保留原 .docx，docxtemplater 淨係換 `{標籤}` 文字，其餘 XML/格式原封不動 → 輸出係真正 .docx。**唔做** HTML 重 render（必走樣）。
- **列印**：輸出係 .docx；真正 100% 列印喺 Word/Google Docs。client-side **冇得 100% 轉 PDF**（要 server）。app 內 `docx-preview` 只係近似核對用。
- **AI 自動加標籤係 best-effort**：docx 文字分散喺多個 `<w:t>` run，自動替換「＿＿」「（　）」等空格唔保證 100%；**手動 `{標籤}` 永遠係可靠後路**，預覽核對 + 唔啱重上。

## 依賴

`pizzip`、`docxtemplater`、`docx-preview`（全部 client-side，Vite 直接 import）。AI 讀範本文字 = PizZip 讀 `word/document.xml` strip tag（唔加 mammoth）。

## 儲存（重要：本機，唔同步）

⚠️ `attachSync` 會 loop 成個 `collectionRegistry` 同步**所有** `createCollection` 出嚟嘅集合。base64 .docx 會谷大 Supabase sync。
→ 範本**唔用 `createCollection`**，改寫細本機 store `adminDocStore.ts`（自管 localStorage key `ntk.admin_doc_templates` + `useSyncExternalStore`，**唔登記入 collectionRegistry → 唔同步**）。
- 範本 shape：`{ id, name, base64, fields: {tag, label, type:'text'|'multiline'|'date'}[], createdAt }`。
- 跨裝置留作將來（可選：之後接 Drive 或專屬 Supabase 表，唔行 app_rows）。
- 加大小 guard：單個範本 > ~1MB 提示（localStorage 上限）。

## 架構 `src/features/work/adminDocs/`

- **`docxEngine.ts`**（純邏輯，可測）：
  - `extractTags(buf: ArrayBuffer): string[]` —— PizZip 讀 document.xml，正則抽 `{標籤}`（去重、處理 run 分裂用 docxtemplater 的 parser）。
  - `fillDocx(buf: ArrayBuffer, data: Record<string,string>): Blob` —— docxtemplater render，回 .docx Blob。
  - `extractText(buf: ArrayBuffer): string` —— strip tag 攞純文字（畀 AI）。
- **`adminDocStore.ts`** —— 本機範本 store（上述）。
- **`AdminDocs.tsx`** —— feature 頁：範本庫卡片 +「＋ 新範本」+ 每範本「填寫 / 刪除」；selfManagedHeader masthead。
- **`TemplateUpload.tsx`** —— 上載 .docx → `extractTags` 認標籤 →（Phase 2：AI 讀 text 建議欄位 + 試自動加標籤）→ 確認欄位（tag/label/type）→ 存。
- **`FillForm.tsx`** —— 揀範本 → 表單逐欄 →（Phase 2：AI 草擬內容）→ `fillDocx` → `docx-preview` 預覽 + 下載 .docx。
- 重用：`Modal`/`Field`/`Button`/`Textarea`（ui）、`useToast`、`complete()`/`isAIConfigured`（Phase 2 AI）、`useNav`。下載用 Blob + anchor（唔加 file-saver）。

## 資料流

```
上載 .docx
  → extractTags() 認 {標籤} +（P2）AI 建議欄位/自動加標籤
  → 確認欄位清單 → adminDocStore 存（base64 + fields）
填寫：揀範本 → 表單逐欄輸入 →（P2）AI 草擬內容
  → fillDocx(base64→buf, data) → Blob（格式 100% 不變）
  → docx-preview 渲染預覽 + 下載 .docx → Word 開咗印
```

## 錯誤處理

- 非 .docx / 壞檔 → 友善提示。
- docxtemplater 標籤錯（未閉合 `{` 等）→ 捕捉錯誤、指出問題標籤。
- `docx-preview` render 失敗 → 仍可下載（預覽係輔助，唔阻生成）。
- 未接 AI → Phase 2 AI（建議欄位/草擬）gate 住；**Phase 1 手動填仍照用**。
- localStorage 滿 → 提示刪舊範本 / 範本太大。

## 測試

- `docxEngine.test.ts`：用 PizZip 砌一個含 `{a}{b}` 嘅最小 docx fixture → 斷言 `extractTags` 抽到 `['a','b']`、`fillDocx({a:'X',b:'Y'})` 出嘅 Blob 解返開內含 'X'/'Y' 且仍係有效 zip/docx。
- `extractText`：斷言抽到純文字。
- 收尾：`tsc` 0 · `build`（確認 3 個 lib bundle 到）· preview 實開（上載一個 `{標籤}` 範本 → 填 → 下載 → 預覽）。

## 範圍外（YAGNI）

- 唔做 client-side .docx→PDF（要 server）。
- 唔做範本跨裝置同步（MVP 本機；將來可接 Drive）。
- 唔做 .doc（舊格式）/ Excel / PDF 表單。
- 唔做欄位邏輯（條件/重複段落）—— 第一版淨係簡單文字替換。

## 分階段

- **Phase 1（可靠核心，唔靠 AI）**：deps + `docxEngine`(+test) + `adminDocStore` + 上載 `{標籤}` 範本 + `FillForm` 填表 + `fillDocx` 生成 + `docx-preview` 預覽 + 下載 + registry 註冊「行政文件」。**即刻有用。**
- **Phase 2（AI 輔助）**：上載冇標籤 docx 時 AI 建議欄位 + 試自動加標籤；FillForm 加「AI 草擬內容」。
