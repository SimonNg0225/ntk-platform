# 行政文件 — 支援 fillable PDF（AcroForm）設計 spec

> 日期：2026-06-04 · 狀態：已 brainstorm（問答）→ spec → workflow
> 為現有 adminDocs（docx）加多一條 PDF 管線：讀表單欄位 → 彩色預覽 → 填 → 下載

## 目標

老師上載**有填寫欄位嘅 PDF（AcroForm）** → 系統讀出欄位 → **pdf.js 渲染 + 彩色標出每個欄位位置** → 逐欄填（文字/多行/勾選/下拉）→ 生成填好嘅 PDF 下載，**100% 保留版面**。

## 已拍板（brainstorm）

- PDF 類型：**fillable（AcroForm，有真欄位）**。普通/掃描 PDF（無欄位）= 範圍外。
- 預覽：**完整** —— pdf.js 渲染頁面 + 彩色標出欄位位置（似 docx 嗰個）。
- 欄位類型：**文字 + 多行 + 勾選格(checkbox) + 下拉(dropdown)** 都支援。
- AcroForm 本身有明確欄位 → **唔使 AI 偵測**（比 docx 乾淨）。

## 依賴（新加）

- `pdf-lib`：讀 AcroForm 欄位（名/類型/選項/座標）+ 填值 + 存 PDF（client-side）。
- `pdfjs-dist`：渲染 PDF 頁面落 canvas 做預覽。Vite worker：`import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'` → `GlobalWorkerOptions.workerSrc = workerUrl`。

## 架構（`src/features/work/adminDocs/`）

- **`pdfEngine.ts`**（pdf-lib，純邏輯，可測）：
  - `interface PdfField { name: string; type: 'text'|'multiline'|'checkbox'|'dropdown'; options?: string[]; rects: { page: number; x: number; y: number; w: number; h: number }[] }`
  - `extractPdfFields(buf): PdfField[]` —— `PDFDocument.load` → `getForm().getFields()`；逐個取 name、類型（PDFTextField→text，`isMultiline()`→multiline；PDFCheckBox→checkbox；PDFDropdown/PDFOptionList→dropdown + `getOptions()`）；widget 座標由 `field.acroField.getWidgets()[].getRectangle()` + 對應頁 index（掃每頁 `node.Annots`）。
  - `fillPdf(buf, values: Record<string,string>): Promise<Blob>` —— 逐欄按類型填：text→`setText`、checkbox→`check()/uncheck()`（值 'yes'/'true'/'1' 當勾）、dropdown→`select(value)`（值唔喺 options 就略過）；`form.flatten()?`（可選，先唔 flatten 保持可再改）→ `save()` → PDF Blob。
  - 安全：load/fill 包 try/catch，壞檔友善 Error。
- **`pdfPreview.ts`**：
  - `renderPdfWithFieldBoxes(container, buf, fieldColors: Map<string,string>): Promise<void>` —— pdf.js 逐頁 render 落 `<canvas>`；每頁上面疊一層 `position:absolute` 容器，按 `PdfField.rects` 畫彩色框（`mark`/`div`，`data-tag=field name`、background=色、border）。座標換算：PDF 原點左下 → HTML 左上要 **y 翻轉** + 乘 render scale。
- **`PdfTemplatePreview.tsx`**（兩欄，平行 TemplatePreview）：左 = pdf.js 渲染 + 彩色欄位框；右 = 欄位清單（色 swatch + 顯示名 + 類型 + 撳一下捲到/閃對應框）；底 = 範本名 + 儲存。render 失敗退純清單。
- **`adminDocStore.ts`**：`AdminDocTemplate` 加 `kind?: 'docx' | 'pdf'`（**預設 'docx'，向後相容**舊範本）；`AdminDocFieldType` 加 `'checkbox' | 'dropdown'`；PDF 欄位：`tag` = PDF field name、`label` = 友善名、`type` = pdf 類型、（dropdown）`options` 存喺另一 map 或 field 擴充。
- **`TemplateUpload.tsx`**：file input `accept=".docx,.pdf"`；上載按副檔名分流 —— `.docx` 走現有；`.pdf` → `extractPdfFields` → `PdfTemplatePreview`。
- **`FillForm.tsx`**：按 `template.kind` 分支 —— `docx` 走現有（fillDocx + docx-preview）；`pdf` 走 `fillPdf` + pdf.js 渲染預覽 + 下載 `.pdf`（checkbox 用切換、dropdown 用 select 輸入）。
- **`AdminDocs.tsx`**：hub 文案 + 上載提示更新（支援 Word／PDF 表單）。

## 資料流（PDF）

```
上載 .pdf → extractPdfFields（pdf-lib）→ PdfField[]（名/類型/選項/座標）
  → PdfTemplatePreview：pdf.js 渲染 + 按座標疊彩色框 + 右邊清單可改名/類型
  → 命名 → 存範本（kind:'pdf', base64=PDF, fields）
填寫：揀範本(kind=pdf) → 表單（text/multiline/checkbox/dropdown）→ fillPdf → 下載填好 PDF
```

## 錯誤處理 / 邊界

- 上載 .pdf 但**冇 AcroForm 欄位**（普通/掃描）→ 友善提示「此 PDF 冇填寫欄位，請用 fillable PDF 或改用 Word 範本」。
- pdf.js render 失敗 → 退純清單編輯（唔阻填/存/下載）。
- fillPdf 壞檔 → toast.error。
- 欄位名重複 / 無名 → 用 index fallback 命名。
- pdf-lib 對加密 PDF 可能失敗 → 友善提示。

## 測試

- `pdfEngine.test.ts`：用 **pdf-lib 自建 fillable PDF fixture**（addPage + form：textfield「姓名」、multiline textfield、checkbox「同意」、dropdown「班別」options）→ 斷言 `extractPdfFields` 抽到 4 欄 + 正確類型 + options；`fillPdf({姓名:'陳大文',同意:'yes',班別:'5A'})` → 重 load 確認值入咗、輸出仍有效 PDF。
- pdf.js 渲染 / overlay 屬 UI（瀏覽器）→ 收尾 preview 實測（唔寫 jsdom 單元測試，pdf.js 需真 canvas）。
- 收尾：tsc 0 · build ✓（pdf-lib + pdfjs 入 bundle/worker）· preview 上載 fillable PDF → 彩色框 → 填 → 下載。

## 範圍外（YAGNI）

- 普通/掃描 PDF（無 AcroForm）—— 唔做座標疊字/OCR。
- 簽名欄位、radio group（第一版可當 dropdown/略過）。
- PDF → docx 互轉。
- 範本跨裝置同步（沿用本機）。

## 階段（workflow，3 sequential agent）

- **A**：`pdf-lib` 裝 + `pdfEngine.ts`（extractPdfFields/fillPdf 全類型）+ `pdfEngine.test.ts`（自建 fixture）。tsc 0 + vitest + build。
- **B**：`pdfjs-dist` 裝 + worker 設定 + `pdfPreview.ts`（渲染 + 彩色欄位框）+ `PdfTemplatePreview.tsx`（兩欄）。tsc 0 + build。
- **C**：整合 —— adminDocStore `kind`/類型擴充、`TemplateUpload` .pdf 分流、`FillForm` kind 分支、AdminDocs 文案。tsc 0 + build + 全測試。
