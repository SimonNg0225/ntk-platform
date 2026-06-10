# 教學簡報生成（Teaching Slides Generator）— 設計 Spec

- **日期**：2026-06-10
- **Feature id**：`work-slides`（教學組）
- **品牌**：EziTeach 教學易
- **狀態**：設計已批准，分 4 階段實作（全部 phase 落實）

---

## 1. 目標與背景

平台現時**未有**簡報生成功能。「簡報」只係資源庫的一個分類標籤。本功能新開一個
**教學簡報生成器**：老師由課題 / 教案 / 手動產出一份簡報，每個樣板（Theme）有
**鮮明個人特色**（設計風格、圖片、展示方式），並可**喺 app 內放映**亦可**匯出真
.pptx**。

### 核心原則：內容與設計徹底分離

```
SlideDeck（語意 model，無樣式）
  └─ slides[]：每頁有 type + 結構化內容
        ↓
Theme（design tokens + 每種 slide-type 版面食譜 + 裝飾/插圖 motif + 可選 overrides）
        ↓
   ┌──────────────┴──────────────┐
HTML Renderer                 Pptx Exporter（PptxGenJS）
（app 內預覽 / 放映 / PDF）      （.pptx 下載，食同一套 theme tokens）
```

- 內容生成一次（AI / 教案 / 手動）→ 同一份 `SlideDeck`
- 兩個 renderer 食同一個 theme → 加新樣板＝加一個 theme object，唔使改 renderer
- 加新內容源（教案匯入）＝ 加一個 `→ SlideDeck` 轉換器

---

## 2. 資料 Model（`src/features/work/slides/types.ts`）

```ts
type SlideType =
  | 'title' | 'section' | 'bullets' | 'twoCol' | 'imageText'
  | 'quote' | 'compare' | 'timeline' | 'quiz' | 'summary'

interface ImageRef {
  kind: 'builtin' | 'upload' | 'stock'
  src: string            // builtin: asset id；upload: storage path；stock: URL
  credit?: string        // 圖庫授權標註（stock 必填）
  alt?: string
}

interface Slide {
  id: string
  type: SlideType
  content: SlideContent  // 按 type 有對應 shape（discriminated union）
  imageRef?: ImageRef
  speakerNotes?: string
}

interface SlideDeck {
  id: string
  title: string
  subjectPackId?: string // 沿用現有 subjects pack
  themeId: string
  slides: Slide[]
  createdAt: string
  updatedAt: string
}
```

`SlideContent` 為 discriminated union（以 `type` 判別），例：
- `bullets`：`{ heading: string; items: string[] }`
- `twoCol`：`{ heading: string; left: string[]; right: string[] }`
- `imageText`：`{ heading: string; body: string; imageSide: 'left'|'right'|'full' }`
- `quote`：`{ text: string; attribution?: string }`
- `compare`：`{ heading: string; rows: { label: string; a: string; b: string }[] }`
- `quiz`：`{ question: string; options: string[]; answerIndex?: number }`
- …（其餘 type 同理，欄位由 vitest 守住）

**語意純淨：model 內絕無顏色 / 字體 / 座標等樣式資訊。**

---

## 3. Theme 系統（`src/features/work/slides/themes/`）

採用**混合做法（Approach C）**：八成由 token + 版面食譜驅動（加 template 主要寫
data），但每個 theme 可 **override 招牌版面**（自訂 HTML 組件 + 對應 pptx layout
fn），並各帶一套 motif pack。

```ts
interface Theme {
  id: string
  name: string            // 中英（經 i18n）
  tokens: {
    palette: { bg; surface; primary; accent; text; muted }
    fonts: { display: string; body: string }
    bg: 'solid' | 'gradient' | 'geometric' | 'grid' | 'paper' | 'chalk'
    shape: { radius: number; border: boolean; shadow: boolean; accentBar: boolean }
  }
  recipe: Record<SlideType, LayoutParams>   // 每種 slide-type 的版面參數
  motif: {
    iconStyle: 'flat' | 'line' | 'doodle' | 'sketch'
    illustrations: string[]   // 內建 SVG 資產 id
    decorations?: ...          // 角飾 / 分隔 / 底圖
  }
  favors: SlideType[]         // 「展示方式 / 教學法」個性：偏好邊種版面
  overrides?: Partial<Record<SlideType, {
    html: React.ComponentType<SlideRenderProps>
    pptx: (slide, theme, pptxSlide) => void
  }>>
}
```

### 開檔即 4 個有個性樣板

| 樣板 | 設計風格 | 圖片 | 展示方式（偏好版面 / 教學法） |
|---|---|---|---|
| **學術藍** Academic | 襯線標題＋乾淨 sans；深藍＋暖灰；細格線底＋標題下幼 accent 線 | line-art 學科插圖 | 結構 bullets、對比表、來源註腳 → 講授式、DSE 高中 |
| **活力橙** Playful | 圓潤粗黑體；橙青 duotone；blob/碎彩背景；大圓角圖框 | doodle icon | 大圖、一頁一概念、提問頁、quiz → 互動探究、初中/小學 |
| **極簡墨** Minimalist | 近單色（墨黑＋一 accent）；大量留白、大字、零裝飾 | 滿版相片＋細 caption | 金句/重點頁、滿版圖 → 概念引入、週會 |
| **黑板綠** Chalkboard | 深綠黑板底＋粉筆手寫體；手繪底線/箭嘴 | sketch icon | 逐步推演、手繪圖解、重點圈起 → 數理推導 |

四者喺 palette、字體、背景、icon 風格、圖片處理、**偏好版面/教學法**全方位唔同。

---

## 4. 內容來源（三者皆做，分階段）

1. **AI 由課題生成**（Phase 1）：課題 / 貼筆記 → `buildSlidesPrompt()` → 現有
   Gemini edge function（`streamChat`，受 AI 額度 / Pro 白名單管制）→ `parseDeck()`
   （AI JSON → SlideDeck，沿用 `parseJsonArray` 套路）。
2. **手動編輯**（Phase 3）：逐頁加 / 刪 / 改文字、換版面、換圖、拖拉排序。
3. **教案轉簡報**（Phase 4）：接 `LessonPlanner`，一個 `lessonPlan → SlideDeck`
   轉換器。

---

## 5. 圖片 Pipeline（`src/features/work/slides/images/`）

Phase 1 三源（AI 生圖留 Phase 4+）：
- **主題內建插圖 / icon**：每 theme 一套統一風格 SVG，收進 repo（開源授權）。零成本。
- **老師自己上載**：存 Supabase storage，拖入 slide。要 storage bucket + 上載 UI。
- **免費圖庫搜尋**：可插拔 provider，**預設 Pexels**（授權寬鬆），關鍵字搜圖插入；
  需部署方提供 API key（deploy-time secret，類似現有 Resend / Gemini 做法），附授權
  標註（`ImageRef.credit`）。Unsplash 可作替代 provider。

---

## 6. Renderer

- **HTML / 放映**（`SlidePreview.tsx` + `PresentMode.tsx`，Phase 1）：16:9 canvas、
  鍵盤翻頁、全螢幕、講者備註；**匯出 PDF** 用瀏覽器列印（沿用 `Timetable/PrintView`
  套路）。
- **Pptx 匯出**（`pptxExport.ts`，Phase 2）：用 **PptxGenJS**，食同一套 theme
  tokens（palette / fonts / 版面座標）approximate HTML 外觀；裝飾 SVG → pptx shape
  或預先 render 的 PNG 背景。新增 dependency：`pptxgenjs`。

---

## 7. 平台慣例整合

- registry 新增 `work-slides`（教學組），feature icon。
- 儲存用 `createCollection`（`ntk.` 前綴）；**絕不更改既有 `ntk.*` storage key**。
  新 collection：`ntk.slides.decks`。
- per-feature i18n bundle（ns `slides`，中英並行；解耦 side-effect，只加 `'en'`，
  zh-HK 靠 defaultValue byte-identical）。
- AI 走現有 `aiClient.streamChat` + gemini edge function（沿用額度白名單）。
- 圖庫 key / storage 等部署設定寫入 `docs/SETUP.md`。

---

## 8. 檔案結構

```
src/features/work/Slides.tsx                 # 主組件（gate + tabs：生成 / 我的簡報）
src/features/work/slides/
  types.ts                                   # SlideDeck / Slide / Theme（+ 測試守欄位）
  prompts.ts  prompts.test.ts                # buildSlidesSystem / buildSlidesPrompt
  parse.ts    parse.test.ts                  # AI JSON → SlideDeck（容錯）
  store.ts                                   # decksCol（ntk.slides.decks）
  i18n.ts                                    # ns slides（中英）
  Generator.tsx                              # 課題輸入 + 串流生成
  DeckView.tsx                               # 一份 deck 的縮圖列 + 操作
  SlidePreview.tsx                           # 單頁 render（食 theme）
  PresentMode.tsx                            # 全螢幕放映
  themes/
    index.ts    index.test.ts                # theme registry + token 對應
    academic.ts playful.ts minimal.ts chalk.ts
  images/
    provider.ts                              # 圖庫 provider（預設 Pexels，可插拔）
    upload.ts                                # Supabase storage 上載
    builtin/                                 # 內建 SVG 插圖 / icon（每 theme）
  editor/                                    # Phase 3：手動編輯器
  pptxExport.ts pptxExport.test.ts           # Phase 2：PptxGenJS 匯出
  fromLessonPlan.ts ...test.ts               # Phase 4：教案 → SlideDeck
```

---

## 9. 分階段 Roadmap

- **Phase 1 — 地基 + 靈魂**：SlideDeck model、Theme 系統（4 樣板）、HTML renderer、
  放映、PDF、AI 由課題生成、圖片三源、i18n、registry、儲存。**獨立可用。**
- **Phase 2 — .pptx 匯出**：PptxGenJS，食同一 theme tokens。
- **Phase 3 — 手動編輯器**：逐頁加/刪/改/換圖/排序。
- **Phase 4 — 教案轉簡報**：接 LessonPlanner；（可選）AI 生圖。

每個 phase 自成一個 plan → 實作 → 測試 → commit 週期，維持 CI（build + 3728+
測試）全綠。

---

## 10. 測試策略

純函數優先、易測（vitest）：
- `parse.ts`：AI JSON（含殘缺 / 多餘文字）→ SlideDeck 容錯解析。
- `prompts.ts`：prompt builder 輸出穩定（含 subject pack 注入）。
- `themes/index.ts`：每個 theme 對所有 `SlideType` 都有 recipe；token 完整。
- `types` 守欄位：各 slide-type content 必要欄位齊全。
- Phase 2：`pptxExport` 對每種 slide-type 產出對應 pptx 物件（mock PptxGenJS）。
- 維持現有 3728 測試 baseline 全綠。

---

## 11. 非目標（Non-goals）

- 即時多人協作編輯（與現有平台一致：本地 + Supabase 同步，非 realtime CRDT）。
- 動畫 / 轉場特效逐頁自訂（Phase 1 只用 theme 內建的克制轉場）。
- 影片 / 嵌入互動元件（YouTube 等）— 後期評估。
- AI 生圖 — 最早 Phase 4 才評估（成本 / 複雜度）。

---

## 12. 待定 / 部署設定

- **圖庫 provider key**：預設 Pexels，需部署方提供 `PEXELS_API_KEY`（或改用
  Unsplash）。Phase 1 若未配置 key，圖庫搜尋優雅停用，仍可用內建插圖 + 上載。
- **Supabase storage bucket**：簡報上載圖片用，需建立 + RLS。
