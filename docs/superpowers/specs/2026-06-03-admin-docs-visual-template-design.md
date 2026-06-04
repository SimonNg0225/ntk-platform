# 行政文件 — 範本「AI 識別 + 視覺化彩色預覽」設計 spec

> 日期：2026-06-03 · 狀態：已 brainstorm + design approved，準備 workflow 實作
> 升級現有 adminDocs 範本建立流程（換走 Phase 2「逐項接受建議」list）

## 目標

上載 Word 範本 → 撳「AI 識別欄位」自動偵測空位 → **視覺化兩欄預覽**：左邊渲染檔案原貌、每個欄位位置**彩色 highlight**；右邊欄位清單（同色、可增/改/刪）→ 確認後存做範本。

## 已拍板（brainstorm）

1. **新增欄位**：靠錨點文字（打欄位名 + 文中錨點 → injectTags best-effort 加 {標籤}）。
2. **AI 觸發**：上載後撳「AI 識別欄位」先跑（唔自動）。
3. **舊流程**：換成新視覺預覽流程；保留手動 `{標籤}` 路徑。

## 重用現有（adminDocs）

- `docxEngine`: `extractTags(buf)`、`base64ToArrayBuffer`/`arrayBufferToBase64`、`fillDocx`。
- `docxAi`: `suggestFields(text) → SuggestedField[]{tag,label,type,anchor}`、`injectTags(buf, [{tag,anchor}]) → { base64, injected[], failed[] }`。
- `adminDocStore`: `addTemplate({name, base64, fields:[{tag,label,type}]})`；`AdminDocFieldType='text'|'multiline'|'date'`。
- `docx-preview`: `renderAsync(blob, container)`。

## 核心設計：tagged buffer = 純函數

狀態 = `{ originalBase64, fields: {tag,label,type,anchor}[] }`。
- **tagged buffer** = `injectTags(originalBuf, fields.filter(有 anchor).map({tag,anchor}))`.base64。
  - 預先已有 `{標籤}`（手動）嘅維持喺原檔，injectTags 唔郁佢哋。
  - 改 fields（增/刪/錨點）→ 重算 tagged buffer → 重渲染。
- **placed**（有色）= `extractTags(taggedBuf)` 入面有嘅 tag；**unplaced**（清單標「未對應」）= fields 入面但 tag 唔喺 taggedBuf。

## 彩色標示（核心新邏輯）

`highlight.ts`（可測）：
- `TAG_COLORS: string[]` —— 8 隻柔和、light/dark 都讀到嘅背景色盤。
- `colorForIndex(i): string` —— `TAG_COLORS[i % n]`。
- `highlightTagsInElement(el: HTMLElement, tagColors: Map<string,string>): void` —— **純 DOM**：`TreeWalker` 行 text node，搵 `{tagname}`（`/\{([^{}]+)\}/g`），若 tagname 喺 tagColors → 拆出嗰段包一個 `<mark class="adoc-tag-hl" style="background:色">{標籤}</mark>`（其餘文字保留）。**呢個係單元測試重點**（jsdom：餵含 `{a}{b}` 的 element → 斷言包到對應色 mark、唔影響其他文字）。
- `renderWithHighlights(container, blob, tagColors)` —— 薄 wrapper：`await renderAsync(blob, container)` 後 call `highlightTagsInElement(container, tagColors)`。render 失敗 throw（畀上層 fallback）。

## UI：`TemplatePreview.tsx`（兩欄）

- **左／主**：渲染容器（`renderWithHighlights`），每欄位位置彩色 highlight；render 失敗 → 退「純清單」模式（仍可編輯/存）。
- **右／側**：欄位清單，每行 = 色 swatch + label（可改）+ 類型 select + 刪除；unplaced 標「未對應」。撳一行 → 捲到/閃對應 highlight（nice-to-have）。
- **＋新增欄位**：欄位名 + 錨點字 input → injectTags 試加 → 成功上色 + 入清單，失敗 toast「搵唔到錨點，請換一段文中原字」。
- 範本名 input + 「儲存範本」/「返回」。
- 改 label/類型 → 只更新清單，**唔重渲染**（唔變 doc）；增/刪/錨點 → 重算 tagged buffer + 重渲染。
- 存：`addTemplate({ name, base64: taggedBuf, fields: fields.map({tag,label,type}) })`（丟 anchor）。

## 整合 `TemplateUpload.tsx`

流程改成：上載 .docx → extractTags：
- 已有標籤 → 直接入 TemplatePreview（既有 tag 當 fields，全部 placed、有色）。
- 冇/少標籤 → 顯示「AI 識別欄位」掣 → suggestFields + 初次 injectTags → 入 TemplatePreview。
- 移除舊「逐項接受建議」list UI（功能由 TemplatePreview 取代）。保留手動 `{標籤}`：用戶上載已含標籤嘅檔即直接預覽。

## 錯誤處理

- AI 未接 / 未登入 → 「AI 識別」gate（友善提示，同題庫一致）；手動 `{標籤}` 上載照行。
- `renderWithHighlights` 失敗 → TemplatePreview 退純清單編輯模式（唔阻存）。
- injectTags 對個別欄位失敗 → 該欄入 unplaced + 提示。
- 大檔重渲染：只喺結構（增/刪/錨點）變先重渲染，debounce 唔需要（編輯唔頻密）。

## 測試

- `highlight.test.ts`：`highlightTagsInElement` 餵 `<p>姓名：{name} 日期：{date}</p>` + tagColors → 斷言 2 個 `mark.adoc-tag-hl`、背景色正確、`{未知tag}` 唔包、純文字保留；`colorForIndex` 循環。
- 收尾：`tsc` 0 · `build` · preview 實測（上載 / seed 一個 tagged docx → 見彩色預覽 + 改/刪/新增 + 存）。

## 範圍外（YAGNI）

- 唔做「喺預覽揀文字設為欄位」（選取 map 返 docx XML 太 fragile）。
- 唔做拖拉排序 / 條件欄位。
- 填寫頁（FillForm）暫唔加彩色（呢次淨係建立範本流程）。

## 階段（workflow，2 sequential agent）

- **Agent 1**：`highlight.ts`（色盤 + `highlightTagsInElement` 純函數 + `renderWithHighlights` wrapper）+ `highlight.test.ts`。tsc 0 + vitest 綠 + build。
- **Agent 2**：`TemplatePreview.tsx`（兩欄預覽編輯）+ 改 `TemplateUpload.tsx`（換走舊 list、接 AI識別 → TemplatePreview → 存）+ 錨點新增。tsc 0 + build。
