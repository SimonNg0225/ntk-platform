# 掃描 PDF（拍照變掃描文件）— 設計文件

- **日期**：2026-06-10
- **Feature id**：`work-scan`
- **狀態**：設計已批准，待寫 implementation plan
- **路線**：A（jscanify 包住 OpenCV.js，手動拖四角做 fallback）

---

## 1. 目標 / 範圍

畀教師喺手機／平板／桌面用鏡頭（或上載相片）「拍照即變掃描文件」，自動偵文件邊框、拉正透視、套掃描濾鏡，輸出**可搜尋 PDF**。

### 已拍板嘅範圍決定（brainstorm 結論）

| 題目 | 決定 |
|---|---|
| 輸出去向 | **三樣都做**：①下載（主打）②存資源庫 ③綁班級／學生 |
| 頁數 | **多頁拼合做預設** ＋「逐張分檔」選項（掃一疊功課 → 每生一個 PDF） |
| OCR | **可搜尋 PDF**（隱形文字層疊圖底，可 ⌘F 搜尋／選字複製） |
| 文件類型 | 主要**印刷體**；手寫可㩒掣熄 OCR（純掃描） |
| 重檔載入 | **混合**：OpenCV 自存（永遠離線可偵邊）；Tesseract 中文字庫 + CJK 字型走 CDN（OCR 當 bonus，冇網照純掃描） |
| 掃描管線 | 路線 **A**：jscanify（OpenCV.js）自動偵邊 + 透視校正，手動拖四角 fallback |

### 非目標（YAGNI）
- 唔做雲端 OCR／AI 內容抽取（純本地 Tesseract）。
- 唔做手寫辨識準確度優化。
- MVP 唔做「掃完直接餵 AI 批改／出題」（日後可接現有 pipeline）。

---

## 2. 功能定位

- 新 feature，元件放 `src/features/work/scan/`。
- 喺 `src/features/registry.ts` 註冊：
  - `id: 'work-scan'`
  - `modes: ['work']`
  - `name: '掃描 PDF'`
  - `description`：影低文件即變掃描檔，自動拉正、可搜尋，輸出 PDF。
  - `icon: '📷'`
  - `group: '行政'`（同 `work-admin-docs`、`work-doc-digest` 同組）
  - `component: Scan`（`lazyFeature`）
  - `status: 'ready'`
  - `selfManagedHeader: true`
- **零後端成本**（全部 client / CDN）→ 唔耗 AI 額度，預設免費。是否日後當 Pro 賣＝商業決定，本 spec 不處理。

---

## 3. 狀態機（`Scan.tsx` 主控）

```
capture  →  review  →  export
 拍/揀照     逐頁執靚    出 PDF
```

- **capture**：開鏡頭即影 或 揀現有相（手機叫起原生相機）。
- **review**：縮圖列表（拖曳排序／刪／重影／加頁）＋ 逐頁編輯（裁切＋濾鏡）。
- **export**：揀輸出方式（合併／逐張分檔、OCR 開關）→ 生成 → 下載／存庫／綁班級。

可由 review 返去 capture 加更多頁。

---

## 4. 元件 / 模組拆解

```
src/features/work/scan/
  Scan.tsx                  主控 + bespoke masthead + 狀態機
  capture/
    CameraCapture.tsx       getUserMedia 即影（<video>+快門）+ <input capture> fallback
  edit/
    PageEditor.tsx          四角可拖裁切框 + 濾鏡(彩色/灰階/黑白) + 重影掣
    CornerOverlay.tsx       四角拖曳控制點（純 UI）
  pages/
    PageStrip.tsx           縮圖列：排序 / 刪 / 重影 / 加頁
  ExportBar.tsx             合併 vs 逐張分檔 · OCR 開關 · 下載/存庫/綁班級
  lib/
    cv.ts                   懶載自存 OpenCV.js + jscanify；detectCorners() / warpEnhance()
    ocr.ts                  懶載 CDN Tesseract(chi_tra+eng)；recognize(canvas)→{text, words[bbox]}
    buildPdf.ts             pdf-lib：pages[]→PDF（合併/逐頁）+ 隱形 OCR 文字層
    pdfText.ts              純函數：mapBboxToPdf() bbox(px)→PDF(pt) 座標換算
    types.ts                ScanPage / Corners / Filter / OutputMode
  scanStore.ts              （可選）存資源庫時用嘅 metadata wiring
```

### 型別草稿（`lib/types.ts`）
```ts
type Filter = 'color' | 'gray' | 'bw'
type OutputMode = 'merged' | 'perPage'
interface Corners { tl: Pt; tr: Pt; br: Pt; bl: Pt }   // Pt = {x:number;y:number}
interface ScanPage {
  id: string
  rawDataUrl: string        // 原圖（可重新裁切）
  corners: Corners | null   // null = 未偵到 / 全幅
  filter: Filter
  processedDataUrl: string  // 拉正＋濾鏡後（render / OCR / PDF 用）
}
```

---

## 5. 資料流

1. **影相**：`getUserMedia({video:{facingMode:'environment'}})` → `<video>` → 快門將 frame 畫入 canvas → 原圖 dataURL。
   Fallback：`<input type="file" accept="image/*" capture="environment">`（手機原生相機 / 揀舊相）。
2. **執靚（每頁）**：懶載 `cv.ts` → jscanify 自動偵四角 → `CornerOverlay` 顯示可拖框 → 確認後 `warpPerspective` 拉正去近 A4 比例 → 套濾鏡（彩色 passthrough／灰階／黑白 adaptive threshold「掃描感」）→ 存 `processedDataUrl`。原圖＋四角保留，可再改／重影。
3. **出 PDF**：每頁可選跑 OCR → `buildPdf` 用 pdf-lib：
   - 開一頁，尺寸跟圖片比例；`drawImage` 嵌 JPEG。
   - 若 OCR 開：每個 word 用 `mapBboxToPdf` 換算座標，畫**透明文字**（`opacity: 0`，字級填滿 bbox 高度）做可搜尋層。
   - 合併 → 一個 Blob；逐張分檔 → 多個 Blob。

---

## 6. 可搜尋 PDF ＋ 中文字層（關鍵技術點 ⚠️）

- Tesseract.js 回 `data.words[]`，每個有 `text` 同 `bbox {x0,y0,x1,y1}`（像素）。
- `mapBboxToPdf(bbox, imgPx, pagePt)` 純函數換算到 PDF 點座標（pdf-lib 原點喺左下，要翻 Y）。
- **pdf-lib 預設字型（Helvetica 等）唔支援中文** → 畫中文隱形層**必須嵌一隻 CJK 字型**（Noto Sans TC）。用 `@pdf-lib/fontkit` `registerFontkit` + `embedFont(..., { subset: true })` **子集化**，最終 PDF 只嵌用到嘅字 → 檔案唔脹。
- 跟 Q4：**Tesseract 字庫 + CJK 字型一齊行 CDN**。冇網 / 載入失敗 → 跳過 OCR，照出純掃描（非搜尋）PDF。

---

## 7. 三個輸出去向（下載做主）

| 去向 | 做法 | MVP 程度 |
|---|---|---|
| **下載** | Blob → `<a download>`。合併＝一個 PDF；逐張分檔＝`jszip` 打包一次下載（避免瀏覽器擋多重下載） | ✅ 打穩 |
| **存資源庫** | 寫一筆 `Resource` / `resourceMetaCol`；若已連 Google Drive（`src/lib/googleDrive.ts`）就上載 PDF 落 Drive，否則存本地 ref | 用現有 collection 接，細節留 plan |
| **綁班級／學生** | 揀班 → 揀學生 → 連 `{classId, studentId}` metadata 存庫 | 用現有 classes collection 接，細節留 plan |

> **MVP 策略**：以「下載」打穩整條掃描→PDF 管線；去向 ②③ 用現有 collection 接上，確切接線（欄位、Drive 上載、班級揀選 UI）喺寫 implementation plan 時定。

---

## 8. 新依賴

| 套件 | 用途 | 載入方式 | 備註 |
|---|---|---|---|
| `jscanify` | 文件偵邊 + 透視校正（包 OpenCV.js） | OpenCV.js **自存** `/public/vendor/opencv/`，懶載 | ~8MB，日後可換 slim build |
| `tesseract.js` | 本地 OCR | **CDN** 載 worker + `chi_tra`+`eng` 字庫 | OCR 開先載 |
| Noto Sans TC（CJK 字型） | PDF 隱形中文層嵌字 | **CDN** | 子集化嵌入，輸出 PDF 唔脹 |
| `@pdf-lib/fontkit` | pdf-lib 嵌自訂字型 | npm | 配合 CJK 字型 |
| `jszip` | 「逐張分檔」打包下載 | npm | 細 dep |

已有、唔使再加：`pdf-lib`、`pdfjs-dist`。

---

## 9. 錯誤處理 / 降級

- **冇鏡頭權限 / 無 `getUserMedia`** → 自動退做檔案上載 input。
- **OpenCV 載入失敗**（自存，罕見）→ 跳過自動偵邊，畀簡單矩形裁切、唔做透視校正（仍出到 PDF）。
- **OCR（CDN）失敗 / 離線** → toast「OCR 需要網絡，已用純掃描」，照出非搜尋 PDF。
- **大圖** → 先縮到長邊 ~2000px（慳記憶體、加快處理）。
- **iPhone HEIC** → 瀏覽器可能解唔到，提示改用 JPEG。

---

## 10. 效能 / 載入策略

- 整個 feature lazy chunk（`registry.ts` `lazyFeature`）。
- `cv.ts` + OpenCV.js 只喺**入到 PageEditor** 先 `import()` + 注入自存 script。
- `ocr.ts` + Tesseract + CJK 字型只喺**export 時剔咗 OCR** 先載（CDN）。
- 影相後即時降採樣（長邊上限 ~2000px）。

---

## 11. 測試

- **純函數 vitest**：
  - `buildPdf`：頁面尺寸／比例、合併 vs 分檔數量。
  - `mapBboxToPdf`：bbox(px)→PDF(pt) 座標換算（含翻 Y）。
  - 輸出命名（`掃描-1.pdf` 等）、濾鏡選擇。
- **IO（CV／OCR／相機）**：薄包裝，唔做單元測試（或 mock）。
- **真機**：iPhone／iPad 實影、實掃，喺 Apple 預覽／Books 驗證「可 ⌘F 搜尋」。

---

## 12. i18n

- 新 namespace `scan`；zh-HK（廣東話）靠 `t('scan.key', { defaultValue: '廣東話' })`，英文入 `src/i18n/appEn.ts` 嘅 `scan` namespace。

---

## 13. 落地次序（畀 implementation plan 參考）

1. **管線骨幹**：types + `cv.ts`（偵邊/warp/濾鏡）+ `buildPdf.ts`（純圖片 PDF，未 OCR）+ 純函數測試。
2. **UI 狀態機**：`Scan.tsx` + `CameraCapture` + `PageEditor`/`CornerOverlay` + `PageStrip`，行到「影 → 執靚 → 合併下載」。
3. **OCR 層**：`ocr.ts` + `pdfText.ts` + CJK 字型嵌入 → 可搜尋 PDF；OCR 開關 + 離線降級。
4. **逐張分檔**：`jszip` 打包下載。
5. **去向 ②③**：存資源庫 + 綁班級／學生（接現有 collection）。
6. 註冊 feature、i18n、真機驗證。
