# 教學簡報生成器 — Phase 3（手動編輯器 + 圖片插入）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老師可逐頁手動編輯簡報（加 / 刪 / 改文字 / 換版面類型 / 排序 / 講者備註 / 換樣板），並由三個來源（內建插圖 / 上載 / 免費圖庫）插圖；圖片喺 app 預覽同 .pptx 匯出都顯示。

**Architecture:** 沿用「內容（SlideDeck）/ 設計（Theme）分離」。新增純函數層（`editorOps.ts`：reorder / changeType / 內建插圖清單 / 上載縮圖）做可測核心；UI 層 `DeckEditor` + `SlideEditor` + `ImagePicker` 改 deck 後經 `slideDecksCol.update(id, …)` 持久化。圖片以 **data URL** 存入 `Slide.imageRef`（kind 'upload'|'stock'|'builtin'），HTML renderer 與 PptxGenJS 都直接食 data URL —— 免 Supabase Storage bucket，離線可用。

**Tech Stack:** 既有 React/TS、vitest、Phase 1/2 模組。**無新依賴**（縮圖用瀏覽器 `canvas`；圖庫沿用 Phase 1 `images/provider.ts`）。

**已落地可依賴嘅接口（確認過）：**
- types：`SlideDeck`、`Slide`（`{ id, content, imageRef?, speakerNotes? }`）、`SlideContent`（discriminated union，`type` 判別）、`SLIDE_TYPES`、`emptyContent(type)`。
- `ImageRef { kind: 'builtin'|'upload'|'stock'; src; credit?; alt? }`。
- themes：`getTheme(id)`、`allThemes`、`Theme.tokens.palette`。
- store：`slideDecksCol`（`get/set/add/update(id,patch)/remove`）、`useCollection`、`uid`（from '../../../lib/store'）。
- ui（`src/ui`）：`Button, Input, Textarea, Select, Field, Modal, IconButton, SegmentedControl, EmptyState, Card, Tabs, cx`。
- images：`searchImages(query): Promise<ImageRef[]>`、`isImageSearchConfigured()`。
- pptx：`buildSlideOps(slide, theme): SlideOp[]`、`SlideOp`（已有 `fill|text|bullets|table|shape`，本期加 `image`）、`applyOp`、`exportDeckPptx`。
- SlidePreview.tsx：單頁 HTML render（switch by `content.type`）。
- DeckView.tsx：deck 操作列（放映 / 匯出 PDF / 匯出 PPTX / 刪除）—— 加「編輯」掣。
- i18n.ts：ns `slides`（只加 `en`）。

**規範（全程）：** 絕不改 `ntk.*` key；i18n 只加 `en`、zh-HK 靠 `defaultValue`；單引號無分號；每 task commit；維持測試全綠；NEVER `git stash`；commit 結尾 `https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK`。

---

## File Structure（Phase 3）

```
src/features/work/slides/
  editorOps.ts        editorOps.test.ts   # 純：reorderSlides / changeSlideType / newSlide
  images/
    builtin.ts        builtin.test.ts     # 內建 SVG 插圖清單（data URL）
    downscale.ts                          # canvas 縮圖 + mime/size 守（薄 glue）
    ImagePicker.tsx                        # 3 來源插圖揀選 Modal
  pptx/spec.ts        (modify) + spec.test.ts (modify)   # 加 image op
  pptx/export.ts      (modify) + export.test.ts (modify) # applyOp 處理 image
  SlidePreview.tsx    (modify)            # imageText / 任意頁顯示 imageRef
  SlideEditor.tsx                         # 單頁內容編輯表單（by type）
  DeckEditor.tsx                          # 編輯器外殼：slide 列 + CRUD + 排序 + 換樣板 + 存檔
  Slides.tsx          (modify)            # 接編輯器（從 DeckView 開）
  DeckView.tsx        (modify)            # 加「編輯」掣
  i18n.ts             (modify)            # 加編輯器 / 圖片 en key
docs/SETUP.md         (modify)            # 圖片上載＝內嵌 data URL 說明
```

---

## Task 1：編輯器純核心（editorOps.ts）

**Files:** Create `src/features/work/slides/editorOps.ts` + `editorOps.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/editorOps.test.ts
import { describe, it, expect } from 'vitest'
import { reorderSlides, changeSlideType, newSlide } from './editorOps'
import type { Slide } from './types'

const mk = (id: string, type: Slide['content']['type'] = 'bullets'): Slide =>
  ({ id, content: type === 'bullets' ? { type, heading: 'H', items: ['a'] } : { type, heading: 'H' } as Slide['content'] })

describe('slides/editorOps', () => {
  it('reorderSlides 上移 / 下移；邊界唔郁', () => {
    const arr = [mk('1'), mk('2'), mk('3')]
    expect(reorderSlides(arr, 2, -1).map((s) => s.id)).toEqual(['1', '3', '2'])
    expect(reorderSlides(arr, 0, -1).map((s) => s.id)).toEqual(['1', '2', '3']) // 頂部上移無效
    expect(reorderSlides(arr, 2, 1).map((s) => s.id)).toEqual(['1', '2', '3'])  // 底部下移無效
  })

  it('changeSlideType 換 type 並用 emptyContent 重置，保留 id / imageRef / notes', () => {
    const s: Slide = { id: 'x', content: { type: 'bullets', heading: 'H', items: ['a'] }, speakerNotes: 'n', imageRef: { kind: 'stock', src: 'u' } }
    const out = changeSlideType(s, 'quiz')
    expect(out.id).toBe('x')
    expect(out.content.type).toBe('quiz')
    expect(out.content).toMatchObject({ question: '', options: [] })
    expect(out.speakerNotes).toBe('n')
    expect(out.imageRef).toEqual({ kind: 'stock', src: 'u' })
  })

  it('newSlide 造一張帶 id 嘅指定 type 空白頁', () => {
    const s = newSlide('summary')
    expect(s.id).toBeTruthy()
    expect(s.content).toEqual({ type: 'summary', heading: '', points: [] })
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/editorOps.test.ts`
Expected: FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/editorOps.ts
import { uid } from '../../../lib/store'
import { emptyContent, type Slide, type SlideContent, type SlideType } from './types'

// 移動一張 slide（dir = -1 上移 / +1 下移）；邊界回傳原陣列副本
export function reorderSlides(slides: Slide[], index: number, dir: -1 | 1): Slide[] {
  const j = index + dir
  if (index < 0 || index >= slides.length || j < 0 || j >= slides.length) return slides.slice()
  const next = slides.slice()
  ;[next[index], next[j]] = [next[j], next[index]]
  return next
}

// 換版面 type：重置 content（emptyContent），保留 id / imageRef / speakerNotes
export function changeSlideType(slide: Slide, type: SlideType): Slide {
  const content = { type, ...emptyContent(type) } as SlideContent
  return { ...slide, content }
}

// 新空白 slide（指定 type）
export function newSlide(type: SlideType): Slide {
  return { id: uid(), content: { type, ...emptyContent(type) } as SlideContent }
}
```

- [ ] **Step 4：跑測試確認 pass** — Run: `npx vitest run src/features/work/slides/editorOps.test.ts` → PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/editorOps.ts src/features/work/slides/editorOps.test.ts
git commit -m "feat(slides): 編輯器純核心 reorder / changeType / newSlide

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 2：內建插圖清單（images/builtin.ts）

**Files:** Create `src/features/work/slides/images/builtin.ts` + `builtin.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/images/builtin.test.ts
import { describe, it, expect } from 'vitest'
import { BUILTIN_ILLUSTRATIONS } from './builtin'

describe('slides/images/builtin', () => {
  it('有一批內建插圖，每個有 id / label / data URL svg', () => {
    expect(BUILTIN_ILLUSTRATIONS.length).toBeGreaterThanOrEqual(4)
    for (const x of BUILTIN_ILLUSTRATIONS) {
      expect(x.id).toBeTruthy()
      expect(x.label).toBeTruthy()
      expect(x.src.startsWith('data:image/svg+xml')).toBe(true)
    }
  })
})
```

- [ ] **Step 2：跑測試確認 fail** — `npx vitest run src/features/work/slides/images/builtin.test.ts` → FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/images/builtin.ts
// 一小批通用教學插圖（內聯 SVG → data URL）；風格中性、適配各 theme。
// 之後可逐步擴充；用 encodeURIComponent 包成 utf8 data URL（HTML <img> 同 PptxGenJS 都食到）。

interface Illustration { id: string; label: string; src: string }

const svg = (inner: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`,
  )

export const BUILTIN_ILLUSTRATIONS: Illustration[] = [
  { id: 'book', label: '書本', src: svg('<path d="M20 28h32a8 8 0 0 1 8 8v60a8 8 0 0 0-8-8H20z"/><path d="M100 28H68a8 8 0 0 0-8 8v60a8 8 0 0 1 8-8h32z"/>') },
  { id: 'bulb', label: '燈泡', src: svg('<path d="M46 86a26 26 0 1 1 28 0c-4 3-6 7-6 12H52c0-5-2-9-6-12z"/><path d="M52 104h16M54 96h12"/>') },
  { id: 'chart', label: '圖表', src: svg('<path d="M24 24v72h72"/><path d="M40 80V60M58 80V44M76 80V52M94 80V36"/>') },
  { id: 'target', label: '目標', src: svg('<circle cx="60" cy="60" r="36"/><circle cx="60" cy="60" r="20"/><circle cx="60" cy="60" r="5" fill="currentColor"/>') },
  { id: 'chat', label: '對話', src: svg('<path d="M24 32h72v48H56L40 96V80H24z"/><path d="M40 50h40M40 62h28"/>') },
  { id: 'gear', label: '齒輪', src: svg('<circle cx="60" cy="60" r="16"/><path d="M60 20v12M60 88v12M20 60h12M88 60h12M32 32l8 8M80 80l8 8M88 32l-8 8M40 80l-8 8"/>') },
]
```

- [ ] **Step 4：跑測試確認 pass** — PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/images/builtin.ts src/features/work/slides/images/builtin.test.ts
git commit -m "feat(slides): 內建插圖清單（內聯 SVG data URL）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 3：上載縮圖 util（images/downscale.ts）

**Files:** Create `src/features/work/slides/images/downscale.ts`

> 純瀏覽器 canvas glue（jsdom 難測，故唔寫單元測試；保持極薄、有 try/catch）。回傳 data URL（JPEG，最長邊 ≤ 1280），控制 deck 體積。

- [ ] **Step 1：寫實作**

```ts
// src/features/work/slides/images/downscale.ts
import type { ImageRef } from '../types'

const MAX_EDGE = 1280
const QUALITY = 0.82

// File（相片）→ 縮圖 data URL → ImageRef(kind 'upload')。失敗 reject。
export function fileToImageRef(file: File): Promise<ImageRef> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('唔係圖片檔'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas 唔支援')
        ctx.drawImage(img, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
        resolve({ kind: 'upload', src: dataUrl, alt: file.name })
      } catch (e) {
        reject(e instanceof Error ? e : new Error('圖片處理失敗'))
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('讀唔到圖片'))
    }
    img.src = url
  })
}
```

- [ ] **Step 2：型別檢查** — Run: `npx tsc --noEmit` → 零錯誤

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/images/downscale.ts
git commit -m "feat(slides): 上載圖片 canvas 縮圖 → data URL ImageRef

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 4：pptx 加 image op（spec.ts + export.ts）

**Files:** Modify `pptx/spec.ts` (+ spec.test.ts), `pptx/export.ts` (+ export.test.ts)

- [ ] **Step 1：擴充 spec.test.ts**

加：

```ts
import type { Slide } from '../types'
it('slide 有 imageRef 時，buildSlideOps 末尾加一個 image op（右側）', () => {
  const s: Slide = { id: 'i', content: { type: 'bullets', heading: 'H', items: ['a'] }, imageRef: { kind: 'stock', src: 'data:image/png;base64,xx' } }
  const ops = buildSlideOps(s, theme)
  const img = ops.find((o) => o.kind === 'image')
  expect(img).toMatchObject({ kind: 'image', src: 'data:image/png;base64,xx' })
})
```

- [ ] **Step 2：跑測試確認 fail** — `npx vitest run src/features/work/slides/pptx/spec.test.ts` → FAIL（無 image op）

- [ ] **Step 3：spec.ts 加 image op**

1. 喺 `SlideOp` union 加（喺 `shape` 旁）：

```ts
  | { kind: 'image'; src: string; x: number; y: number; w: number; h: number }
```

2. 喺 `buildSlideOps` 末段、`return ops` 之前（喺 switch 之後），若有圖就加 image op（放右側，content 用左半邊唔變亦可接受）：

```ts
  if (slide.imageRef?.src) {
    ops.push({ kind: 'image', src: slide.imageRef.src, x: 6.2, y: 1.6, w: 3.2, h: 3.2 })
  }
```

> 注意：呢段要喺 exhaustive `default` guard 之後、`return ops` 之前。switch 已 narrow `c`，唔影響。

- [ ] **Step 4：export.ts applyOp 處理 image + 擴充 export.test.ts**

`export.ts` `applyOp` 加 case：

```ts
    case 'image':
      slide.addImage({ data: op.src.startsWith('data:') ? op.src : undefined, path: op.src.startsWith('data:') ? undefined : op.src, x: op.x, y: op.y, w: op.w, h: op.h })
      break
```

`export.test.ts` mock `slideObj` 加 `addImage: vi.fn()`，並加測試：deck 一張 slide 帶 `imageRef:{kind:'upload',src:'data:image/jpeg;base64,zz'}` → `addImage` 被呼叫。

- [ ] **Step 5：跑測試確認 pass** — `npx vitest run src/features/work/slides/pptx` → PASS

- [ ] **Step 6：型別檢查** — `npx tsc --noEmit` → 零錯誤（`addImage` 參數型別以 pptxgenjs 4.x 為準；若 `data`/`path` 同時存在型別不容，改為條件構造 options 物件再傳，並報告）

- [ ] **Step 7：commit**

```bash
git add src/features/work/slides/pptx/
git commit -m "feat(slides): pptx 支援 image op（imageRef → addImage）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 5：HTML 預覽顯示圖片（SlidePreview.tsx）

**Files:** Modify `src/features/work/slides/SlidePreview.tsx`

- [ ] **Step 1：改實作**

1. `imageText` case：若有 `slide.imageRef`，按 `imageSide` 左/右/滿版顯示圖（用 `<img src={slide.imageRef.src}>`）；無圖維持現狀（只標題 + 內文）。需要將 `slide` 傳入 `Body`（目前 `Body` 已收 `slide`）。
2. 其他 type：若 `slide.imageRef` 存在，喺右下角顯示一個細圖（约 28% 寬），唔遮內容（簡單做法：絕對定位右側）。可選，但建議做 `imageText` 至少完整。

示例（`imageText` 分支）：

```tsx
    case 'imageText': {
      const img = slide.imageRef?.src
      const full = c.imageSide === 'full'
      return (
        <>
          <Heading>{c.heading}</Heading>
          {full && img ? (
            <img src={img} alt={slide.imageRef?.alt ?? ''} className="mx-auto max-h-[55%] rounded object-contain" />
          ) : (
            <div className={cx('flex gap-[4%]', c.imageSide === 'left' && 'flex-row-reverse')}>
              <p className="flex-1 text-[1.5vw]">{c.body}</p>
              {img && <img src={img} alt={slide.imageRef?.alt ?? ''} className="w-[38%] rounded object-contain" />}
            </div>
          )}
        </>
      )
    }
```

> `cx` 由 '../../ui' import（SlidePreview 喺 slides/ 下 → '../../../ui'？確認：SlidePreview.tsx 喺 src/features/work/slides/，到 src/ui 係 '../../../ui'）。跟檔案現有 import 深度為準。

- [ ] **Step 2：型別檢查 + build** — `npx tsc --noEmit && npm run build` → 成功

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/SlidePreview.tsx
git commit -m "feat(slides): 預覽顯示 imageRef（imageText 左/右/滿版）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 6：圖片揀選器（ImagePicker.tsx）

**Files:** Create `src/features/work/slides/images/ImagePicker.tsx`

> Modal，3 個 tab：內建插圖 / 上載 / 圖庫搜尋。揀好回傳 `ImageRef`。圖庫未配置 key 時該 tab 顯示停用提示。

- [ ] **Step 1：寫實作**

```tsx
// src/features/work/slides/images/ImagePicker.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import type { ImageRef } from '../types'
import { BUILTIN_ILLUSTRATIONS } from './builtin'
import { fileToImageRef } from './downscale'
import { searchImages, isImageSearchConfigured } from './provider'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (ref: ImageRef) => void
}

export default function ImagePicker({ open, onClose, onPick }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [tab, setTab] = useState<'builtin' | 'upload' | 'stock'>('builtin')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ImageRef[]>([])
  const [busy, setBusy] = useState(false)

  const pick = (ref: ImageRef) => { onPick(ref); onClose() }

  const doSearch = async () => {
    setBusy(true)
    try { setResults(await searchImages(q)) } finally { setBusy(false) }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try { pick(await fileToImageRef(file)) }
    catch (e) { toast.error(e instanceof Error ? e.message : t('slides.imgUploadFailed', { defaultValue: '圖片上載失敗' })) }
  }

  const tabs = [
    { id: 'builtin' as const, label: t('slides.imgTabBuiltin', { defaultValue: '內建插圖' }) },
    { id: 'upload' as const, label: t('slides.imgTabUpload', { defaultValue: '上載' }) },
    { id: 'stock' as const, label: t('slides.imgTabStock', { defaultValue: '圖庫' }) },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('slides.imgPickTitle', { defaultValue: '插入圖片' })} size="lg">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cx('flex-1 rounded-md px-3 py-1.5 font-medium transition',
              tab === tb.id ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'builtin' && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {BUILTIN_ILLUSTRATIONS.map((x) => (
            <button key={x.id} onClick={() => pick({ kind: 'builtin', src: x.src, alt: x.label })}
              className="flex flex-col items-center gap-1 rounded-lg border border-[color:var(--border)] p-3 text-slate-600 hover:border-accent hover:text-accent dark:text-slate-300">
              <img src={x.src} alt={x.label} className="h-12 w-12" />
              <span className="text-xs">{x.label}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color:var(--border)] py-10 text-sm text-slate-500 hover:border-accent">
          <span>{t('slides.imgUploadHint', { defaultValue: '揀一張相片上載（會自動縮細）' })}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      )}

      {tab === 'stock' && (
        !isImageSearchConfigured() ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('slides.imgDisabled', { defaultValue: '圖庫搜尋未設定' })}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('slides.imgSearchPh', { defaultValue: '關鍵字…' })} />
              <Button onClick={() => void doSearch()} disabled={busy}>{t('slides.imgSearch', { defaultValue: '搜尋圖片' })}</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {results.map((r, i) => (
                <button key={i} onClick={() => pick(r)} className="overflow-hidden rounded-lg border border-[color:var(--border)] hover:border-accent">
                  <img src={r.src} alt={r.alt ?? ''} className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </Modal>
  )
}
```

- [ ] **Step 2：型別檢查 + build** — `npx tsc --noEmit && npm run build` → 成功（確認 `Modal` 支援 `size="lg"`；若無此 size，用實際支援值）

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/images/ImagePicker.tsx
git commit -m "feat(slides): 圖片揀選器（內建 / 上載 / 圖庫 三來源）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 7：單頁編輯表單（SlideEditor.tsx）

**Files:** Create `src/features/work/slides/SlideEditor.tsx`

> 受控組件：收 `slide` + `onChange(slide)`。按 `content.type` 出對應欄位。多行清單（items/options/points/left/right/rows/steps）用「每行一條」textarea 互轉，簡單可靠。含「插入圖片」掣（開 ImagePicker）+ 講者備註。

- [ ] **Step 1：寫實作**

```tsx
// src/features/work/slides/SlideEditor.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, X } from 'lucide-react'
import { Field, Input, Textarea, Button } from '../../../ui'
import type { Slide, SlideContent } from './types'
import ImagePicker from './images/ImagePicker'

const linesToArr = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean)
const arrToLines = (a: string[]): string => a.join('\n')

export default function SlideEditor({ slide, onChange }: { slide: Slide; onChange: (s: Slide) => void }) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const c = slide.content
  const setContent = (patch: Partial<SlideContent>) => onChange({ ...slide, content: { ...c, ...patch } as SlideContent })

  return (
    <div className="space-y-3">
      {renderFields()}

      <Field label={t('slides.fNotes', { defaultValue: '講者備註（選填）' })}>
        <Textarea rows={2} value={slide.speakerNotes ?? ''} onChange={(e) => onChange({ ...slide, speakerNotes: e.target.value })} />
      </Field>

      <div className="flex items-center gap-2">
        {slide.imageRef ? (
          <div className="flex items-center gap-2">
            <img src={slide.imageRef.src} alt="" className="h-12 w-12 rounded object-cover" />
            <Button variant="ghost" icon={X} onClick={() => { const s = { ...slide }; delete s.imageRef; onChange(s) }}>
              {t('slides.imgRemove', { defaultValue: '移除圖片' })}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" icon={ImagePlus} onClick={() => setPicking(true)}>
            {t('slides.imgInsert', { defaultValue: '插入圖片' })}
          </Button>
        )}
      </div>

      <ImagePicker open={picking} onClose={() => setPicking(false)} onPick={(ref) => onChange({ ...slide, imageRef: ref })} />
    </div>
  )

  function renderFields() {
    switch (c.type) {
      case 'title':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fSub', { defaultValue: '副標題' })}><Input value={c.subheading ?? ''} onChange={(e) => setContent({ subheading: e.target.value })} /></Field>
        </>)
      case 'section':
        return (<>
          <Field label={t('slides.fKicker', { defaultValue: '小標' })}><Input value={c.kicker ?? ''} onChange={(e) => setContent({ kicker: e.target.value })} /></Field>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
        </>)
      case 'bullets':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fItems', { defaultValue: '重點（每行一條）' })}><Textarea rows={5} value={arrToLines(c.items)} onChange={(e) => setContent({ items: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'twoCol':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fLeft', { defaultValue: '左欄（每行一條）' })}><Textarea rows={4} value={arrToLines(c.left)} onChange={(e) => setContent({ left: linesToArr(e.target.value) })} /></Field>
          <Field label={t('slides.fRight', { defaultValue: '右欄（每行一條）' })}><Textarea rows={4} value={arrToLines(c.right)} onChange={(e) => setContent({ right: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'imageText':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fBody', { defaultValue: '內文' })}><Textarea rows={4} value={c.body} onChange={(e) => setContent({ body: e.target.value })} /></Field>
        </>)
      case 'quote':
        return (<>
          <Field label={t('slides.fQuote', { defaultValue: '引言' })}><Textarea rows={3} value={c.text} onChange={(e) => setContent({ text: e.target.value })} /></Field>
          <Field label={t('slides.fAttrib', { defaultValue: '出處' })}><Input value={c.attribution ?? ''} onChange={(e) => setContent({ attribution: e.target.value })} /></Field>
        </>)
      case 'quiz':
        return (<>
          <Field label={t('slides.fQuestion', { defaultValue: '題目' })}><Input value={c.question} onChange={(e) => setContent({ question: e.target.value })} /></Field>
          <Field label={t('slides.fOptions', { defaultValue: '選項（每行一個）' })}><Textarea rows={4} value={arrToLines(c.options)} onChange={(e) => setContent({ options: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'summary':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fPoints', { defaultValue: '要點（每行一條）' })}><Textarea rows={5} value={arrToLines(c.points)} onChange={(e) => setContent({ points: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'compare':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fCompare', { defaultValue: '每行：標籤 | A | B' })}>
            <Textarea rows={5}
              value={c.rows.map((r) => `${r.label} | ${r.a} | ${r.b}`).join('\n')}
              onChange={(e) => setContent({ rows: e.target.value.split('\n').map((ln) => ln.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ label: p[0] ?? '', a: p[1] ?? '', b: p[2] ?? '' })) })} />
          </Field>
        </>)
      case 'timeline':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fSteps', { defaultValue: '每行：步驟 | 說明（說明選填）' })}>
            <Textarea rows={5}
              value={c.steps.map((s) => (s.detail ? `${s.label} | ${s.detail}` : s.label)).join('\n')}
              onChange={(e) => setContent({ steps: e.target.value.split('\n').map((ln) => ln.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ label: p[0] ?? '', detail: p[1] || undefined })) })} />
          </Field>
        </>)
    }
  }
}
```

- [ ] **Step 2：型別檢查 + build** — `npx tsc --noEmit && npm run build` → 成功

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/SlideEditor.tsx
git commit -m "feat(slides): 單頁內容編輯表單（按 type）+ 插圖 + 備註

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 8：編輯器外殼（DeckEditor.tsx）+ 接線 + i18n + 驗證

**Files:** Create `DeckEditor.tsx`；Modify `DeckView.tsx`、`Slides.tsx`、`i18n.ts`、`docs/SETUP.md`

- [ ] **Step 1：DeckEditor.tsx**

```tsx
// src/features/work/slides/DeckEditor.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { Button, Select, IconButton, SegmentedControl } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import type { SlideDeck, Slide, SlideType } from './types'
import { SLIDE_TYPES } from './types'
import { allThemes, getTheme } from './themes'
import { reorderSlides, changeSlideType, newSlide } from './editorOps'
import { slideDecksCol } from './store'
import SlideEditor from './SlideEditor'
import SlidePreview from './SlidePreview'

const TYPE_LABEL: Record<SlideType, string> = {
  title: '標題頁', section: '章節', bullets: '重點', twoCol: '雙欄', imageText: '圖文',
  quote: '引言', compare: '對比', timeline: '時序', quiz: '測驗', summary: '總結',
}

export default function DeckEditor({ deck, onClose }: { deck: SlideDeck; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [slides, setSlides] = useState<Slide[]>(deck.slides)
  const [themeId, setThemeId] = useState(deck.themeId)
  const [sel, setSel] = useState(0)
  const theme = getTheme(themeId)

  const update = (i: number, s: Slide) => setSlides((arr) => arr.map((x, k) => (k === i ? s : x)))
  const add = (type: SlideType) => { setSlides((arr) => [...arr, newSlide(type)]); setSel(slides.length) }
  const del = (i: number) => { setSlides((arr) => arr.filter((_, k) => k !== i)); setSel((s) => Math.max(0, Math.min(s, slides.length - 2))) }
  const move = (i: number, dir: -1 | 1) => { setSlides((arr) => reorderSlides(arr, i, dir)); setSel((s) => Math.max(0, Math.min(s + dir, slides.length - 1))) }
  const retype = (i: number, type: SlideType) => update(i, changeSlideType(slides[i], type))

  const save = () => {
    slideDecksCol.update(deck.id, { slides, themeId, updatedAt: new Date().toISOString() })
    toast.success(t('slides.editSaved', { defaultValue: '已儲存簡報' }))
    onClose()
  }

  const cur = slides[sel]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('slides.editTitle', { defaultValue: '編輯簡報' })} · {deck.title}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>{t('slides.editCancel', { defaultValue: '取消' })}</Button>
          <Button icon={Check} onClick={save}>{t('slides.editSave', { defaultValue: '儲存' })}</Button>
        </div>
      </div>

      <div>
        <SegmentedControl<string> size="sm" value={themeId} onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* slide 列 */}
        <div className="space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-1 rounded-lg border p-2 ${i === sel ? 'border-accent' : 'border-[color:var(--border)]'}`}>
              <button className="flex-1 truncate text-left text-xs" onClick={() => setSel(i)}>
                {i + 1}. {t(`slides.type_${s.content.type}`, { defaultValue: TYPE_LABEL[s.content.type] })}
              </button>
              <IconButton label={t('slides.moveUp', { defaultValue: '上移' })} size="sm" onClick={() => move(i, -1)}><ChevronUp size={14} /></IconButton>
              <IconButton label={t('slides.moveDown', { defaultValue: '下移' })} size="sm" onClick={() => move(i, 1)}><ChevronDown size={14} /></IconButton>
              <IconButton label={t('slides.delSlide', { defaultValue: '刪除' })} size="sm" onClick={() => del(i)}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          <Select value="" onChange={(e) => { if (e.target.value) add(e.target.value as SlideType) }}>
            <option value="">{t('slides.addSlide', { defaultValue: '＋ 加一頁…' })}</option>
            {SLIDE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`slides.type_${ty}`, { defaultValue: TYPE_LABEL[ty] })}</option>)}
          </Select>
        </div>

        {/* 編輯 + 預覽 */}
        {cur && (
          <div className="space-y-3">
            <SlidePreview slide={cur} theme={theme} className="rounded-md border border-[color:var(--border)]" />
            <Select value={cur.content.type} onChange={(e) => retype(sel, e.target.value as SlideType)}>
              {SLIDE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`slides.type_${ty}`, { defaultValue: TYPE_LABEL[ty] })}</option>)}
            </Select>
            <SlideEditor slide={cur} onChange={(s) => update(sel, s)} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2：i18n.ts 加 en key**

喺 `slides` bundle 加（值為英文）：`editTitle:'Edit deck'`, `editSave:'Save'`, `editCancel:'Cancel'`, `editSaved:'Deck saved'`, `addSlide:'+ Add slide…'`, `delSlide:'Delete'`, `moveUp:'Move up'`, `moveDown:'Move down'`, `imgInsert:'Insert image'`, `imgRemove:'Remove image'`, `imgPickTitle:'Insert image'`, `imgTabBuiltin:'Illustrations'`, `imgTabUpload:'Upload'`, `imgTabStock:'Stock'`, `imgUploadHint:'Pick a photo to upload (auto-resized)'`, `imgUploadFailed:'Image upload failed'`, `fHeading:'Heading'`, `fSub:'Subheading'`, `fKicker:'Kicker'`, `fItems:'Bullets (one per line)'`, `fLeft:'Left column (one per line)'`, `fRight:'Right column (one per line)'`, `fBody:'Body'`, `fQuote:'Quote'`, `fAttrib:'Attribution'`, `fQuestion:'Question'`, `fOptions:'Options (one per line)'`, `fPoints:'Points (one per line)'`, `fCompare:'Each line: label | A | B'`, `fSteps:'Each line: step | detail (detail optional)'`, `fNotes:'Speaker notes (optional)'`, and type labels `type_title:'Title'`,`type_section:'Section'`,`type_bullets:'Bullets'`,`type_twoCol:'Two columns'`,`type_imageText:'Image + text'`,`type_quote:'Quote'`,`type_compare:'Compare'`,`type_timeline:'Timeline'`,`type_quiz:'Quiz'`,`type_summary:'Summary'`. (`imgSearch`/`imgSearchPh`/`imgDisabled` 已喺 Phase 1 bundle，重用。)

- [ ] **Step 3：DeckView.tsx 加「編輯」掣**

加 `Pencil` icon import；加一個 `onEdit?: () => void` prop；喺操作列頭加 `{onEdit && <Button size="sm" variant="secondary" icon={Pencil} onClick={onEdit}>{t('slides.edit', { defaultValue: '編輯' })}</Button>}`。i18n 加 `edit:'Edit'`。

- [ ] **Step 4：Slides.tsx 接編輯器**

喺 `Slides.tsx`：加 `const [editId, setEditId] = useState<string|null>(null)`；`import DeckEditor from './slides/DeckEditor'`；當 `editId` 有值時，render `<DeckEditor deck={decks.find(d=>d.id===editId)!} onClose={()=>setEditId(null)} />`（並 early-return 或覆蓋 tabs 區）；`DeckView` 傳 `onEdit={() => setEditId(d.id)}`。確保 `decks.find` 命中（用 useCollection 的最新資料）。

- [ ] **Step 5：docs/SETUP.md**

教學簡報一節補：`圖片上載會喺瀏覽器自動縮細並內嵌入簡報（data URL），毋須額外雲端儲存設定。`

- [ ] **Step 6：全套驗證**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc 乾淨、build 成功、**所有測試通過**（之前 baseline + 新增 editorOps / builtin / pptx image 測試）

- [ ] **Step 7：commit + push**

```bash
git add src/features/work/slides/DeckEditor.tsx src/features/work/slides/DeckView.tsx src/features/work/Slides.tsx src/features/work/slides/i18n.ts docs/SETUP.md
git commit -m "feat(slides): 簡報編輯器外殼（slide CRUD / 排序 / 換樣板）+ 接線 + i18n

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
git push -u origin claude/remote-control-fiz0i
```

---

## Self-Review（對 spec §4「手動編輯」+ §5 圖片）

**Spec coverage：**
- §4「手動編輯：逐頁加/刪/改文字、換版面、換圖、拖拉排序」→ Task 1（reorder/changeType/newSlide）+ Task 7（per-type 編輯）+ Task 8（外殼：加/刪/排序/換樣板/存檔）✓。「拖拉」以上移/下移掣實現（更穩、免新依賴）—— 見「已知缺口」。
- §5 圖片三源「內建插圖 / 老師上載 / 圖庫搜尋」→ Task 2（內建）+ Task 3（上載縮圖）+ Task 6（揀選器整合三源，圖庫用 Phase 1 provider）✓。
- §5「上載存 Supabase storage」→ **改為 data URL 內嵌**（Task 3 縮圖控大小），理由：免 bucket/RLS、離線可用、HTML/pptx 同食；已喺本 plan 架構說明 + SETUP 註明。
- 圖片喺預覽顯示 → Task 5；喺 .pptx 顯示 → Task 4（image op + addImage）✓。

**已知缺口（蓄意）：**
1. **排序用上移/下移掣**而非 HTML5 拖拉（YAGNI：免引入 dnd 依賴，鍵盤/點按更可達）。
2. **上載圖片以 data URL 存 localStorage**：大圖經 canvas 縮至最長邊 1280 控制體積；極端大量圖片仍可能逼近 localStorage 上限，屬可接受權衡，未來可換 Supabase Storage（spec 原構想）。
3. **多行清單編輯**（items/options/compare/timeline）用「每行一條 / `|` 分隔」textarea，而非逐欄 row UI —— 簡單可靠、後期可升級。

**Placeholder scan：** 無 TBD/TODO。UI 接駁點（Modal size、import 深度、Button props）已標明「以實際 ui API 為準」，屬接駁指引非 placeholder。

**Type consistency：** `reorderSlides/changeSlideType/newSlide`、`fileToImageRef`、`BUILTIN_ILLUSTRATIONS`、`ImagePicker(onPick: ImageRef)`、`SlideEditor(slide,onChange)`、`DeckEditor(deck,onClose)`、`SlideOp.image`、`slideDecksCol.update` 跨 task 一致；與 Phase 1 `types.ts`（`SlideContent` 判別欄位、`emptyContent`）、Phase 2 `SlideOp` 對齊 ✓。
