# 教學簡報生成器 — Phase 2（.pptx 匯出）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老師可將任何一份簡報匯出成真‧可編輯嘅 PowerPoint（.pptx），版面同色彩跟返同一個 Theme tokens。

**Architecture:** 沿用 Phase 1 嘅「內容 / 設計分離」。新增一個**純函數** `buildSlideOps(slide, theme): SlideOp[]`（將每種 slide-type 映射成一串序列化、可測試嘅繪製指令），再加一層薄 glue `exportDeckPptx(deck)` 用 **PptxGenJS** 把 ops 落到 .pptx 並觸發下載。`buildSlideOps` 食 `theme.tokens.palette / fonts` 同 `recipe[type].align`，同 Phase 1 HTML renderer 食同一套 tokens。

**Tech Stack:** 新增依賴 `pptxgenjs`（瀏覽器端 `writeFile` 會觸發下載）。其餘沿用既有 React/TS、vitest。

**已落地可依賴嘅 Phase 1 interface（確認過）：**
- `src/features/work/slides/types.ts`：`SlideDeck`、`Slide`、`SlideContent`（discriminated union，`type` 判別）、`SLIDE_TYPES`。
- `src/features/work/slides/themes/layout.ts`：`Theme.tokens.palette { bg, surface, primary, accent, text, muted }`、`Theme.tokens.fonts { display, body }`、`Theme.recipe: Record<SlideType, { align, titleScale, density }>`。
- `src/features/work/slides/themes/index.ts`：`getTheme(id)`。
- `src/features/work/slides/DeckView.tsx`：deck 操作列（放映 / 匯出 PDF / 刪除）—— 喺度加「匯出 PPTX」掣。
- `src/features/work/slides/i18n.ts`：ns `slides`（只 `addResourceBundle('en', …)`，zh-HK 靠 `defaultValue`）。

**規範（全程）：**
- 絕不改任何 `ntk.*` key；只 ADD i18n `en` key，唔加 `zh` bundle。
- code style：單引號、無分號。
- 每 task commit；維持現有 3741 測試全綠。
- NEVER `git stash`。
- commit message 結尾：`https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK`

---

## File Structure（Phase 2）

```
src/features/work/slides/pptx/
  spec.ts        spec.test.ts     # SlideOp 型別 + buildSlideOps（純，重測試）+ hex/pptxFace 助手
  export.ts      export.test.ts   # exportDeckPptx：PptxGenJS glue（mock 測試）
src/features/work/slides/i18n.ts                 # 新增 exportPptx / exportingPptx / exportFailed key（修改）
src/features/work/slides/DeckView.tsx            # 加「匯出 PPTX」掣（修改）
package.json                                     # +pptxgenjs（修改）
docs/SETUP.md                                    # 一句註明 .pptx 匯出純前端、無需設定（修改）
```

座標系：用 PptxGenJS 預設 16:9 版面（`LAYOUT_16x9` = 10in × 5.625in）。共用常數：左右邊距 `MX = 0.6`、內容寬 `CW = 8.8`、標題列 `y=0.4 h=0.9`、內文區 `y=1.6 h=3.6`。

---

## Task 1：加入 pptxgenjs 依賴

**Files:** Modify `package.json`（+ lockfile）

- [ ] **Step 1：安裝**

Run: `npm install pptxgenjs`
Expected: 加到 `dependencies`，無 peer 衝突。

- [ ] **Step 2：確認 build 仍然 OK**

Run: `npm run build`
Expected: 成功（pptxgenjs 只喺匯出時動態用，唔影響主 bundle 建置）。

- [ ] **Step 3：commit**

```bash
git add package.json package-lock.json
git commit -m "build(slides): 加入 pptxgenjs 依賴（Phase 2 .pptx 匯出）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 2：純映射核心（pptx/spec.ts）

**Files:**
- Create: `src/features/work/slides/pptx/spec.ts`
- Test: `src/features/work/slides/pptx/spec.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/pptx/spec.test.ts
import { describe, it, expect } from 'vitest'
import { hex, pptxFace, buildSlideOps } from './spec'
import { getTheme } from '../themes'
import type { Slide } from '../types'

const theme = getTheme('academic') // palette.bg #f8fafc, primary #1e3a8a

function slide(content: Slide['content']): Slide {
  return { id: 's1', content }
}

describe('slides/pptx/spec — 助手', () => {
  it('hex 去 # 並大寫', () => {
    expect(hex('#1e3a8a')).toBe('1E3A8A')
    expect(hex('1e3a8a')).toBe('1E3A8A')
  })
  it('hex 非法值回退黑色', () => {
    expect(hex('var(--x)')).toBe('000000')
  })
  it('pptxFace 抽第一個字體名（去引號）', () => {
    expect(pptxFace('"Source Han Serif", Georgia, serif')).toBe('Source Han Serif')
    expect(pptxFace('system-ui, sans-serif')).toBe('system-ui')
  })
})

describe('slides/pptx/spec — buildSlideOps', () => {
  it('每頁第一個 op 係背景填色（palette.bg）', () => {
    const ops = buildSlideOps(slide({ type: 'title', heading: 'T' }), theme)
    expect(ops[0]).toEqual({ kind: 'fill', color: 'F8FAFC' })
  })

  it('title：置中標題 text op，用 display 字體 + primary 色', () => {
    const ops = buildSlideOps(slide({ type: 'title', heading: '通脹', subheading: '三個成因' }), theme)
    const texts = ops.filter((o) => o.kind === 'text')
    expect(texts[0]).toMatchObject({ kind: 'text', text: '通脹', align: 'center', bold: true, color: '1E3A8A', fontFace: 'Source Han Serif' })
    expect(texts.some((o) => o.kind === 'text' && o.text === '三個成因')).toBe(true)
  })

  it('bullets：標題 text + bullets op（帶 items）', () => {
    const ops = buildSlideOps(slide({ type: 'bullets', heading: '成因', items: ['需求', '成本'] }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '成因')).toBe(true)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ kind: 'bullets', items: ['需求', '成本'], bullet: true })
  })

  it('twoCol：兩個 bullets op（左右）', () => {
    const ops = buildSlideOps(slide({ type: 'twoCol', heading: '對比', left: ['a'], right: ['b'] }), theme)
    const bs = ops.filter((o) => o.kind === 'bullets')
    expect(bs).toHaveLength(2)
    expect(bs[0]).toMatchObject({ items: ['a'] })
    expect(bs[1]).toMatchObject({ items: ['b'] })
  })

  it('quote：置中大字 text，含書名號', () => {
    const ops = buildSlideOps(slide({ type: 'quote', text: '知識就是力量', attribution: '培根' }), theme)
    const q = ops.find((o) => o.kind === 'text' && o.text.includes('知識就是力量'))
    expect(q).toMatchObject({ align: 'center' })
    expect(ops.some((o) => o.kind === 'text' && o.text.includes('培根'))).toBe(true)
  })

  it('compare：table op，rows = [label, a, b]', () => {
    const ops = buildSlideOps(slide({ type: 'compare', heading: '比較', rows: [{ label: '價', a: '高', b: '低' }] }), theme)
    const tbl = ops.find((o) => o.kind === 'table')
    expect(tbl).toMatchObject({ kind: 'table', rows: [['價', '高', '低']] })
  })

  it('timeline：bullets op，每步 "N. label — detail"', () => {
    const ops = buildSlideOps(slide({ type: 'timeline', heading: '步驟', steps: [{ label: '引入', detail: '提問' }, { label: '探究' }] }), theme)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['1. 引入 — 提問', '2. 探究'] })
  })

  it('quiz：題目 text + 選項 bullets "A. ..."', () => {
    const ops = buildSlideOps(slide({ type: 'quiz', question: '邊個啱？', options: ['甲', '乙'] }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '邊個啱？')).toBe(true)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['A. 甲', 'B. 乙'] })
  })

  it('summary：bullets op，每點 "✓ ..."', () => {
    const ops = buildSlideOps(slide({ type: 'summary', heading: '總結', points: ['溫故', '知新'] }), theme)
    const b = ops.find((o) => o.kind === 'bullets')
    expect(b).toMatchObject({ items: ['✓ 溫故', '✓ 知新'] })
  })

  it('section：置中標題；有 kicker 時加一個 muted text', () => {
    const ops = buildSlideOps(slide({ type: 'section', heading: '第二章', kicker: '宏觀經濟' }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '第二章' && o.align === 'center')).toBe(true)
    expect(ops.some((o) => o.kind === 'text' && o.text === '宏觀經濟')).toBe(true)
  })

  it('imageText：標題 + 內文 text（Phase 2 唔處理圖）', () => {
    const ops = buildSlideOps(slide({ type: 'imageText', heading: '圖文', body: '內文', imageSide: 'right' }), theme)
    expect(ops.some((o) => o.kind === 'text' && o.text === '圖文')).toBe(true)
    expect(ops.some((o) => o.kind === 'text' && o.text === '內文')).toBe(true)
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/pptx/spec.test.ts`
Expected: FAIL（找不到 `./spec`）

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/pptx/spec.ts
import type { Slide } from '../types'
import type { Theme } from '../themes'

// ── 序列化繪製指令（純資料，方便測試；export.ts 再落 PptxGenJS）──
export type SlideOp =
  | { kind: 'fill'; color: string }
  | {
      kind: 'text'; text: string
      x: number; y: number; w: number; h: number
      fontSize: number; bold?: boolean; italic?: boolean
      color: string; align: 'left' | 'center'; fontFace: string
    }
  | {
      kind: 'bullets'; items: string[]
      x: number; y: number; w: number; h: number
      fontSize: number; color: string; fontFace: string; bullet: boolean
    }
  | {
      kind: 'table'; rows: string[][]
      x: number; y: number; w: number
      fontSize: number; color: string; headColor: string; fontFace: string
    }
  | { kind: 'shape'; x: number; y: number; w: number; h: number; color: string }

// ── 版面常數（16:9 = 10in × 5.625in）──
const MX = 0.6
const CW = 8.8
const HEAD_Y = 0.4
const HEAD_H = 0.9
const BODY_Y = 1.6
const BODY_H = 3.6

// PptxGenJS 色彩要 6 位 hex（無 #）；非法值回退黑色
export function hex(c: string): string {
  const v = c.replace('#', '').toUpperCase()
  return /^[0-9A-F]{3,8}$/.test(v) ? v : '000000'
}

// CSS font stack → PptxGenJS 單一字體名（PowerPoint 缺字時自動替換）
export function pptxFace(stack: string): string {
  const first = stack.split(',')[0].trim()
  return first.replace(/^["']|["']$/g, '')
}

export function buildSlideOps(slide: Slide, theme: Theme): SlideOp[] {
  const p = theme.tokens.palette
  const disp = pptxFace(theme.tokens.fonts.display)
  const body = pptxFace(theme.tokens.fonts.body)
  const ops: SlideOp[] = [{ kind: 'fill', color: hex(p.bg) }]
  const c = slide.content

  const heading = (text: string): SlideOp => ({
    kind: 'text', text, x: MX, y: HEAD_Y, w: CW, h: HEAD_H,
    fontSize: 28, bold: true, color: hex(p.primary), align: 'left', fontFace: disp,
  })
  const bulletsOp = (items: string[], x = MX, w = CW): SlideOp => ({
    kind: 'bullets', items, x, y: BODY_Y, w, h: BODY_H,
    fontSize: 18, color: hex(p.text), fontFace: body, bullet: true,
  })

  switch (c.type) {
    case 'title':
      ops.push({ kind: 'text', text: c.heading, x: MX, y: 2.1, w: CW, h: 1.2, fontSize: 40, bold: true, color: hex(p.primary), align: 'center', fontFace: disp })
      if (c.subheading) ops.push({ kind: 'text', text: c.subheading, x: MX, y: 3.3, w: CW, h: 0.8, fontSize: 20, color: hex(p.muted), align: 'center', fontFace: body })
      break
    case 'section':
      if (c.kicker) ops.push({ kind: 'text', text: c.kicker, x: MX, y: 2.0, w: CW, h: 0.6, fontSize: 16, color: hex(p.muted), align: 'center', fontFace: body })
      ops.push({ kind: 'text', text: c.heading, x: MX, y: 2.5, w: CW, h: 1.0, fontSize: 32, bold: true, color: hex(p.primary), align: 'center', fontFace: disp })
      break
    case 'bullets':
      ops.push(heading(c.heading), bulletsOp(c.items))
      break
    case 'twoCol':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.left, MX, 4.2))
      ops.push(bulletsOp(c.right, MX + 4.4, 4.2))
      break
    case 'imageText':
      // imageSide 留待 Phase 3 圖片 UI；Phase 2 只輸出標題 + 內文
      ops.push(heading(c.heading))
      ops.push({ kind: 'text', text: c.body, x: MX, y: BODY_Y, w: CW, h: BODY_H, fontSize: 18, color: hex(p.text), align: 'left', fontFace: body })
      break
    case 'quote':
      ops.push({ kind: 'text', text: `「${c.text}」`, x: MX, y: 2.0, w: CW, h: 1.6, fontSize: 30, italic: true, bold: true, color: hex(p.text), align: 'center', fontFace: disp })
      if (c.attribution) ops.push({ kind: 'text', text: `— ${c.attribution}`, x: MX, y: 3.7, w: CW, h: 0.6, fontSize: 16, color: hex(p.muted), align: 'center', fontFace: body })
      break
    case 'compare':
      ops.push(heading(c.heading))
      ops.push({ kind: 'table', rows: c.rows.map((r) => [r.label, r.a, r.b]), x: MX, y: BODY_Y, w: CW, fontSize: 16, color: hex(p.text), headColor: hex(p.primary), fontFace: body })
      break
    case 'timeline':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.steps.map((s, i) => `${i + 1}. ${s.label}${s.detail ? ` — ${s.detail}` : ''}`)))
      break
    case 'quiz':
      ops.push(heading(c.question))
      ops.push(bulletsOp(c.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)))
      break
    case 'summary':
      ops.push(heading(c.heading))
      ops.push(bulletsOp(c.points.map((pt) => `✓ ${pt}`)))
      break
  }
  return ops
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/pptx/spec.test.ts`
Expected: PASS（全部）

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/pptx/spec.ts src/features/work/slides/pptx/spec.test.ts
git commit -m "feat(slides): pptx 純映射核心 buildSlideOps（每 slide-type → 繪製指令）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 3：PptxGenJS glue（pptx/export.ts）

**Files:**
- Create: `src/features/work/slides/pptx/export.ts`
- Test: `src/features/work/slides/pptx/export.test.ts`

- [ ] **Step 1：寫失敗測試（mock pptxgenjs）**

```ts
// src/features/work/slides/pptx/export.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const addText = vi.fn()
const addTable = vi.fn()
const addShape = vi.fn()
const slideObj = { addText, addTable, addShape, background: undefined as unknown }
const addSlide = vi.fn(() => slideObj)
const writeFile = vi.fn(() => Promise.resolve('deck.pptx'))

vi.mock('pptxgenjs', () => {
  return {
    default: class {
      static LAYOUT_16x9 = 'LAYOUT_16x9'
      layout = ''
      addSlide = addSlide
      writeFile = writeFile
    },
  }
})

import { exportDeckPptx, pptxFileName } from './export'
import { getTheme } from '../themes'
import type { SlideDeck } from '../types'

const deck: SlideDeck = {
  id: 'd1', title: '通脹 / 報告', themeId: 'academic', slides: [
    { id: 's1', content: { type: 'title', heading: '通脹' } },
    { id: 's2', content: { type: 'bullets', heading: '成因', items: ['需求'] } },
  ], createdAt: 'x', updatedAt: 'x',
}

describe('slides/pptx/export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pptxFileName 消毒非法檔名字元並加副檔名', () => {
    expect(pptxFileName('通脹 / 報告')).toBe('通脹 _ 報告.pptx')
  })

  it('每張 slide 都 addSlide，最後 writeFile（檔名來自 deck.title）', async () => {
    await exportDeckPptx(deck, getTheme('academic'))
    expect(addSlide).toHaveBeenCalledTimes(2)
    expect(addText).toHaveBeenCalled()      // title + bullets 都會 addText
    expect(writeFile).toHaveBeenCalledWith({ fileName: '通脹 _ 報告.pptx' })
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/pptx/export.test.ts`
Expected: FAIL（找不到 `./export`）

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/pptx/export.ts
import pptxgen from 'pptxgenjs'
import type { SlideDeck } from '../types'
import type { Theme } from '../themes'
import { buildSlideOps, type SlideOp } from './spec'

// 檔名消毒：去走 OS 不容許嘅字元，補 .pptx
export function pptxFileName(title: string): string {
  const safe = (title.trim() || 'slides').replace(/[\\/:*?"<>|]/g, '_')
  return `${safe}.pptx`
}

function applyOp(slide: pptxgen.Slide, pptx: pptxgen, op: SlideOp): void {
  switch (op.kind) {
    case 'fill':
      slide.background = { color: op.color }
      break
    case 'text':
      slide.addText(op.text, {
        x: op.x, y: op.y, w: op.w, h: op.h,
        fontSize: op.fontSize, bold: op.bold, italic: op.italic,
        color: op.color, align: op.align, fontFace: op.fontFace,
        valign: 'top',
      })
      break
    case 'bullets':
      slide.addText(
        op.items.map((text) => ({ text, options: { bullet: op.bullet, fontSize: op.fontSize, color: op.color, fontFace: op.fontFace } })),
        { x: op.x, y: op.y, w: op.w, h: op.h, valign: 'top' },
      )
      break
    case 'table':
      slide.addTable(
        op.rows.map((row) => row.map((cell) => ({ text: cell, options: { fontSize: op.fontSize, color: op.color, fontFace: op.fontFace } }))),
        { x: op.x, y: op.y, w: op.w, border: { type: 'solid', pt: 0.5, color: op.headColor } },
      )
      break
    case 'shape':
      slide.addShape(pptx.ShapeType.rect, { x: op.x, y: op.y, w: op.w, h: op.h, fill: { color: op.color } })
      break
  }
}

// 主入口：把一份 deck 匯出成 .pptx 並觸發下載（瀏覽器）。
export async function exportDeckPptx(deck: SlideDeck, theme: Theme): Promise<void> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  for (const s of deck.slides) {
    const slide = pptx.addSlide()
    for (const op of buildSlideOps(s, theme)) applyOp(slide, pptx, op)
    if (s.speakerNotes) slide.addNotes(s.speakerNotes)
  }
  await pptx.writeFile({ fileName: pptxFileName(deck.title) })
}
```

> 註：測試 mock 嘅 slide stub 無 `addNotes`；上面 `exportDeckPptx` 測試用嘅 deck slides 無 `speakerNotes`，故唔會叫 `addNotes`，測試通過。若日後測試帶 notes，請喺 mock 加 `addNotes: vi.fn()`。

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/pptx/export.test.ts`
Expected: PASS

- [ ] **Step 5：型別檢查**

Run: `npx tsc --noEmit`
Expected: 零錯誤（若 `pptxgen.Slide` / `pptx.ShapeType` 型別名與安裝版本不同，依 `node_modules/pptxgenjs` 型別定義調整，並喺 commit note 說明）

- [ ] **Step 6：commit**

```bash
git add src/features/work/slides/pptx/export.ts src/features/work/slides/pptx/export.test.ts
git commit -m "feat(slides): PptxGenJS 匯出 glue（ops → .pptx + 檔名消毒 + 講者備註）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 4：i18n key + DeckView 接掣

**Files:**
- Modify: `src/features/work/slides/i18n.ts`
- Modify: `src/features/work/slides/DeckView.tsx`

- [ ] **Step 1：i18n 加 3 個 en key**

喺 `slides` bundle（`i18n.ts`）內，`exportPdf` 附近加：

```ts
      exportPptx: 'Export PPTX',
      exportingPptx: 'Exporting PPTX…',
      exportFailed: 'Export failed, please retry',
```

- [ ] **Step 2：DeckView 加掣 + 處理**

喺 `DeckView.tsx`：
1. import 加 `Presentation` icon 同 export 函數、`useState`（已有）：

```ts
import { Play, FileDown, Trash2, Presentation } from 'lucide-react'
import { exportDeckPptx } from './pptx/export'
```

2. 喺 component 內加狀態與處理：

```ts
  const [exporting, setExporting] = useState(false)

  const downloadPptx = async () => {
    try {
      setExporting(true)
      await exportDeckPptx(deck, theme)
    } catch {
      toast.error(t('slides.exportFailed', { defaultValue: '匯出失敗，請再試' }))
    } finally {
      setExporting(false)
    }
  }
```

3. 喺操作列（「匯出 PDF」掣之後）插入：

```tsx
          <Button size="sm" variant="secondary" icon={Presentation} disabled={exporting} onClick={() => void downloadPptx()}>
            {exporting ? t('slides.exportingPptx', { defaultValue: '匯出中…' }) : t('slides.exportPptx', { defaultValue: '匯出 PPTX' })}
          </Button>
```

- [ ] **Step 3：型別檢查 + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 零錯誤、build 成功

- [ ] **Step 4：commit**

```bash
git add src/features/work/slides/i18n.ts src/features/work/slides/DeckView.tsx
git commit -m "feat(slides): DeckView 加「匯出 PPTX」掣 + i18n

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 5：文件 + 全套驗證

**Files:** Modify `docs/SETUP.md`

- [ ] **Step 1：SETUP.md 補一句**

喺「教學簡報」一節加：

```md
.pptx 匯出純前端（PptxGenJS），無需任何設定／API key；撳「匯出 PPTX」即下載可編輯嘅 PowerPoint。
```

- [ ] **Step 2：全套驗證**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc 乾淨、build 成功、**所有測試通過**（3741 baseline + 新增 pptx 測試）

- [ ] **Step 3：commit + push**

```bash
git add docs/SETUP.md
git commit -m "docs(slides): Phase 2 .pptx 匯出說明 + 收尾

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
git push -u origin claude/remote-control-fiz0i
```

---

## Self-Review（對 spec §6 Pptx 匯出）

**Spec coverage：**
- §6「Pptx 匯出（Phase 2）：用 PptxGenJS，食同一套 theme tokens」→ Task 1（依賴）+ Task 2（buildSlideOps 食 palette/fonts/align）+ Task 3（glue）✓
- §6「裝飾 SVG → pptx shape 或 PNG 背景」→ Phase 2 先做純色背景 + accent（`shape` op 已備型別）；複雜裝飾 / 圖片留 Phase 3（見下「已知缺口」）。
- §10 測試「pptxExport 對每種 slide-type 產出對應 pptx 物件（mock PptxGenJS）」→ Task 2 對 10 種 type 全覆蓋（純 ops）+ Task 3 mock glue ✓

**已知缺口（蓄意收窄）：**
1. **圖片 / 主題裝飾插圖** 唔包喺 Phase 2 —— Phase 1 仲未有圖片插入 UI（決定咗 Phase 3 先做），所以 deck 暫時無 `imageRef`，`imageText` 只輸出文字。待 Phase 3 圖片落地後，補一個 `image` op + `addImage` glue（可加 base64 內嵌）。已喺 spec §5/§9 與本 plan 註明。
2. **每種 theme 嘅獨特字體** 喺 .pptx 靠 `fontFace` 名 + PowerPoint 端字體替換（手寫體 / 思源宋體 用戶機未必有）；屬 pptx 格式固有限制，可接受。

**Placeholder scan：** 無 TBD／TODO。`pptxgen.Slide` / `pptx.ShapeType` 型別名已標明「以安裝版本型別為準」嘅調整指引（接駁點，非 placeholder）。

**Type consistency：** `SlideOp`、`buildSlideOps`、`hex`、`pptxFace`、`exportDeckPptx`、`pptxFileName`、`applyOp` 跨 task 命名一致；`Theme.tokens.palette`/`fonts`、`Slide.content` 判別欄位與 Phase 1 `types.ts` / `layout.ts` 完全對齊 ✓。
