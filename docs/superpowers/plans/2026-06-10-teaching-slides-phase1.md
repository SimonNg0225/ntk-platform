# 教學簡報生成器 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 由課題用 AI 生成一份教學簡報，套上 4 個有個性嘅樣板，喺 app 內預覽/放映/匯出 PDF。

**Architecture:** 內容（SlideDeck，純語意）與設計（Theme，design tokens + 版面食譜）徹底分離；HTML renderer 食 theme 顯示。AI 經現有 Gemini edge function 串流生成，解析成 SlideDeck。儲存沿用 `createCollection`（`ntk.` 前綴）。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind、react-i18next、現有 `aiClient.streamChat`、`createCollection`、vitest。Phase 1 **無新 npm 依賴**（純 HTML/CSS；圖庫用 `fetch`）。

**規範（全程遵守）：**
- 絕不更改任何 `ntk.*` storage key；新 collection 用 `ntk.slides.decks`。
- i18n 用解耦 per-feature bundle：只 `addResourceBundle('en', …)`，zh-HK 靠 `defaultValue` byte-identical。
- 跟現有 code style（單引號、無分號）。
- 每個 task 結尾 commit；維持現有 3728 測試 baseline 全綠。
- commit message 結尾加：`https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK`

---

## File Structure（Phase 1）

```
src/features/work/Slides.tsx                 # 主組件：gate + tabs（生成 / 我的簡報）
src/features/work/slides/
  types.ts          types.test.ts            # SlideDeck / Slide / SlideContent / ImageRef
  themes/
    layout.ts                                # LayoutParams / Theme interface + helpers
    index.ts        index.test.ts            # theme registry（getTheme / allThemes）
    academic.ts playful.ts minimal.ts chalk.ts
  prompts.ts        prompts.test.ts          # buildSlidesSystem / buildSlidesPrompt
  parse.ts          parse.test.ts            # parseDeck：AI JSON → Slide[]（容錯）
  store.ts                                   # decksCol（ntk.slides.decks）+ helpers
  i18n.ts                                    # ns slides（en bundle）
  styleMap.ts       styleMap.test.ts         # theme tokens → CSS 變數（兩 renderer 共用）
  SlidePreview.tsx                           # 單頁 render（食 theme + styleMap）
  Generator.tsx                              # 課題輸入 + 串流生成 + 儲存
  DeckView.tsx                               # 一份 deck 縮圖列 + 放映/PDF/刪除
  PresentMode.tsx                            # 全螢幕放映（鍵盤翻頁）
  images/
    provider.ts     provider.test.ts         # 圖庫搜尋（預設 Pexels，可插拔，未配置優雅停用）
src/features/registry.ts                     # 新增 work-slides（修改）
src/features/featureIcons.tsx                # 新增 icon 對應（修改，如需要）
docs/SETUP.md                                # 圖庫 key / storage 說明（修改）
```

> 註：圖片「上載到 Supabase storage」與「內建 SVG 插圖」屬增強，列為 Task 12 / 13（可選，最後做）；Phase 1 核心 = AI 生成 + 4 樣板 + 放映 + PDF + 圖庫搜尋。

---

## Task 1：資料 Model（types.ts）

**Files:**
- Create: `src/features/work/slides/types.ts`
- Test: `src/features/work/slides/types.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/types.test.ts
import { describe, it, expect } from 'vitest'
import { SLIDE_TYPES, emptyContent, type SlideType } from './types'

describe('slides/types', () => {
  it('涵蓋 10 種 slide-type', () => {
    expect(SLIDE_TYPES).toEqual([
      'title', 'section', 'bullets', 'twoCol', 'imageText',
      'quote', 'compare', 'timeline', 'quiz', 'summary',
    ])
  })

  it('每種 type 都有預設 content（必要欄位齊）', () => {
    for (const t of SLIDE_TYPES) {
      const c = emptyContent(t as SlideType)
      expect(c).toBeTypeOf('object')
    }
    expect(emptyContent('bullets')).toEqual({ heading: '', items: [] })
    expect(emptyContent('quiz')).toEqual({ question: '', options: [] })
    expect(emptyContent('compare')).toEqual({ heading: '', rows: [] })
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/types.test.ts`
Expected: FAIL（找不到模組 `./types`）

- [ ] **Step 3：寫最小實作**

```ts
// src/features/work/slides/types.ts

export const SLIDE_TYPES = [
  'title', 'section', 'bullets', 'twoCol', 'imageText',
  'quote', 'compare', 'timeline', 'quiz', 'summary',
] as const
export type SlideType = (typeof SLIDE_TYPES)[number]

export interface ImageRef {
  kind: 'builtin' | 'upload' | 'stock'
  src: string
  credit?: string
  alt?: string
}

export interface TitleContent { heading: string; subheading?: string }
export interface SectionContent { heading: string; kicker?: string }
export interface BulletsContent { heading: string; items: string[] }
export interface TwoColContent { heading: string; left: string[]; right: string[] }
export interface ImageTextContent { heading: string; body: string; imageSide: 'left' | 'right' | 'full' }
export interface QuoteContent { text: string; attribution?: string }
export interface CompareContent { heading: string; rows: { label: string; a: string; b: string }[] }
export interface TimelineContent { heading: string; steps: { label: string; detail?: string }[] }
export interface QuizContent { question: string; options: string[]; answerIndex?: number }
export interface SummaryContent { heading: string; points: string[] }

export type SlideContent =
  | ({ type: 'title' } & TitleContent)
  | ({ type: 'section' } & SectionContent)
  | ({ type: 'bullets' } & BulletsContent)
  | ({ type: 'twoCol' } & TwoColContent)
  | ({ type: 'imageText' } & ImageTextContent)
  | ({ type: 'quote' } & QuoteContent)
  | ({ type: 'compare' } & CompareContent)
  | ({ type: 'timeline' } & TimelineContent)
  | ({ type: 'quiz' } & QuizContent)
  | ({ type: 'summary' } & SummaryContent)

export interface Slide {
  id: string
  content: SlideContent
  imageRef?: ImageRef
  speakerNotes?: string
}

export interface SlideDeck {
  id: string
  title: string
  subjectPackId?: string
  themeId: string
  slides: Slide[]
  createdAt: string
  updatedAt: string
}

// 各 type 的空白 content（手動新增 / 解析容錯時用）
export function emptyContent(type: SlideType): Omit<SlideContent, 'type'> {
  switch (type) {
    case 'title': return { heading: '' }
    case 'section': return { heading: '' }
    case 'bullets': return { heading: '', items: [] }
    case 'twoCol': return { heading: '', left: [], right: [] }
    case 'imageText': return { heading: '', body: '', imageSide: 'right' }
    case 'quote': return { text: '' }
    case 'compare': return { heading: '', rows: [] }
    case 'timeline': return { heading: '', steps: [] }
    case 'quiz': return { question: '', options: [] }
    case 'summary': return { heading: '', points: [] }
  }
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/types.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/types.ts src/features/work/slides/types.test.ts
git commit -m "feat(slides): SlideDeck 資料 model + 各 slide-type content

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 2：Theme interface + registry（themes/layout.ts、themes/index.ts、academic.ts）

**Files:**
- Create: `src/features/work/slides/themes/layout.ts`
- Create: `src/features/work/slides/themes/academic.ts`
- Create: `src/features/work/slides/themes/index.ts`
- Test: `src/features/work/slides/themes/index.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/themes/index.test.ts
import { describe, it, expect } from 'vitest'
import { allThemes, getTheme } from './index'
import { SLIDE_TYPES } from '../types'

describe('slides/themes', () => {
  it('getTheme 無效 id 回退第一個 theme', () => {
    expect(getTheme('nope').id).toBe(allThemes[0].id)
  })

  it('每個 theme 對所有 slide-type 都有 recipe，且 token 完整', () => {
    for (const th of allThemes) {
      expect(th.id).toBeTruthy()
      expect(th.tokens.palette.bg).toBeTruthy()
      expect(th.tokens.fonts.display).toBeTruthy()
      for (const t of SLIDE_TYPES) {
        expect(th.recipe[t], `${th.id} 缺 ${t} recipe`).toBeDefined()
      }
    }
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/themes/index.test.ts`
Expected: FAIL（找不到 `./index`）

- [ ] **Step 3：寫最小實作**

```ts
// src/features/work/slides/themes/layout.ts
import type { SlideType } from '../types'

export interface LayoutParams {
  align: 'left' | 'center'
  titleScale: number   // 標題字級倍率
  density: 'airy' | 'normal' | 'tight'
}

export interface Theme {
  id: string
  nameKey: string       // i18n key（slides.theme<Id>）
  nameDefault: string   // zh-HK 回退
  tokens: {
    palette: {
      bg: string; surface: string; primary: string
      accent: string; text: string; muted: string
    }
    fonts: { display: string; body: string }
    bg: 'solid' | 'gradient' | 'geometric' | 'grid' | 'paper' | 'chalk'
    shape: { radius: number; border: boolean; shadow: boolean; accentBar: boolean }
  }
  recipe: Record<SlideType, LayoutParams>
  motif: { iconStyle: 'flat' | 'line' | 'doodle' | 'sketch' }
  favors: SlideType[]
}

// 大部分 theme 共用的版面食譜底；個別 theme 可覆蓋。
export function baseRecipe(over: Partial<Record<SlideType, LayoutParams>> = {}): Record<SlideType, LayoutParams> {
  const d: LayoutParams = { align: 'left', titleScale: 1, density: 'normal' }
  const base: Record<SlideType, LayoutParams> = {
    title: { align: 'center', titleScale: 1.6, density: 'airy' },
    section: { align: 'center', titleScale: 1.3, density: 'airy' },
    bullets: { ...d },
    twoCol: { ...d },
    imageText: { ...d },
    quote: { align: 'center', titleScale: 1.2, density: 'airy' },
    compare: { ...d },
    timeline: { ...d },
    quiz: { ...d, density: 'airy' },
    summary: { ...d },
  }
  return { ...base, ...over }
}
```

```ts
// src/features/work/slides/themes/academic.ts
import { baseRecipe, type Theme } from './layout'

export const academic: Theme = {
  id: 'academic',
  nameKey: 'slides.themeAcademic',
  nameDefault: '學術藍',
  tokens: {
    palette: {
      bg: '#f8fafc', surface: '#ffffff', primary: '#1e3a8a',
      accent: '#2563eb', text: '#0f172a', muted: '#64748b',
    },
    fonts: { display: '"Source Han Serif", Georgia, serif', body: 'system-ui, sans-serif' },
    bg: 'grid',
    shape: { radius: 6, border: true, shadow: false, accentBar: true },
  },
  recipe: baseRecipe(),
  motif: { iconStyle: 'line' },
  favors: ['bullets', 'compare', 'summary'],
}
```

```ts
// src/features/work/slides/themes/index.ts
import type { Theme } from './layout'
import { academic } from './academic'

export type { Theme, LayoutParams } from './layout'

// Task 3 會 append playful / minimal / chalk
export const allThemes: Theme[] = [academic]

export function getTheme(id: string): Theme {
  return allThemes.find((t) => t.id === id) ?? allThemes[0]
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/themes/index.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/themes/
git commit -m "feat(slides): Theme interface + registry + 學術藍樣板

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 3：其餘 3 個樣板（playful / minimal / chalk）

**Files:**
- Create: `src/features/work/slides/themes/playful.ts`
- Create: `src/features/work/slides/themes/minimal.ts`
- Create: `src/features/work/slides/themes/chalk.ts`
- Modify: `src/features/work/slides/themes/index.ts`
- Modify: `src/features/work/slides/themes/index.test.ts`

- [ ] **Step 1：擴充測試（斷言 4 個 theme）**

喺 `index.test.ts` 加：

```ts
import { allThemes } from './index'
it('開檔有 4 個樣板', () => {
  expect(allThemes.map((t) => t.id)).toEqual(['academic', 'playful', 'minimal', 'chalk'])
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/themes/index.test.ts`
Expected: FAIL（只有 1 個 theme）

- [ ] **Step 3：寫 3 個 theme + 註冊**

```ts
// src/features/work/slides/themes/playful.ts
import { baseRecipe, type Theme } from './layout'

export const playful: Theme = {
  id: 'playful',
  nameKey: 'slides.themePlayful',
  nameDefault: '活力橙',
  tokens: {
    palette: {
      bg: '#fff7ed', surface: '#ffffff', primary: '#ea580c',
      accent: '#0d9488', text: '#1c1917', muted: '#78716c',
    },
    fonts: { display: '"Nunito", system-ui, sans-serif', body: '"Nunito", system-ui, sans-serif' },
    bg: 'geometric',
    shape: { radius: 24, border: false, shadow: true, accentBar: false },
  },
  recipe: baseRecipe({ imageText: { align: 'left', titleScale: 1.2, density: 'airy' } }),
  motif: { iconStyle: 'doodle' },
  favors: ['imageText', 'quiz', 'title'],
}
```

```ts
// src/features/work/slides/themes/minimal.ts
import { baseRecipe, type Theme } from './layout'

export const minimal: Theme = {
  id: 'minimal',
  nameKey: 'slides.themeMinimal',
  nameDefault: '極簡墨',
  tokens: {
    palette: {
      bg: '#ffffff', surface: '#ffffff', primary: '#111111',
      accent: '#dc2626', text: '#111111', muted: '#9ca3af',
    },
    fonts: { display: '"Inter", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif' },
    bg: 'solid',
    shape: { radius: 0, border: false, shadow: false, accentBar: false },
  },
  recipe: baseRecipe({
    quote: { align: 'left', titleScale: 1.5, density: 'airy' },
    bullets: { align: 'left', titleScale: 1.1, density: 'airy' },
  }),
  motif: { iconStyle: 'line' },
  favors: ['quote', 'imageText', 'section'],
}
```

```ts
// src/features/work/slides/themes/chalk.ts
import { baseRecipe, type Theme } from './layout'

export const chalk: Theme = {
  id: 'chalk',
  nameKey: 'slides.themeChalk',
  nameDefault: '黑板綠',
  tokens: {
    palette: {
      bg: '#1f3b30', surface: '#27483b', primary: '#fef9c3',
      accent: '#fde047', text: '#f8fafc', muted: '#a7c4b5',
    },
    fonts: { display: '"Patrick Hand", "Comic Sans MS", cursive', body: 'system-ui, sans-serif' },
    bg: 'chalk',
    shape: { radius: 4, border: true, shadow: false, accentBar: false },
  },
  recipe: baseRecipe({ timeline: { align: 'left', titleScale: 1.1, density: 'normal' } }),
  motif: { iconStyle: 'sketch' },
  favors: ['timeline', 'compare', 'bullets'],
}
```

修改 `index.ts`：

```ts
import type { Theme } from './layout'
import { academic } from './academic'
import { playful } from './playful'
import { minimal } from './minimal'
import { chalk } from './chalk'

export type { Theme, LayoutParams } from './layout'

export const allThemes: Theme[] = [academic, playful, minimal, chalk]

export function getTheme(id: string): Theme {
  return allThemes.find((t) => t.id === id) ?? allThemes[0]
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/themes/index.test.ts`
Expected: PASS（4 themes、每個涵蓋全 slide-type）

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/themes/
git commit -m "feat(slides): 活力橙 / 極簡墨 / 黑板綠 三個樣板

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 4：styleMap（theme tokens → CSS 變數）

**Files:**
- Create: `src/features/work/slides/styleMap.ts`
- Test: `src/features/work/slides/styleMap.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/styleMap.test.ts
import { describe, it, expect } from 'vitest'
import { themeVars } from './styleMap'
import { getTheme } from './themes'

describe('slides/styleMap', () => {
  it('將 theme palette 轉成 CSS 變數', () => {
    const v = themeVars(getTheme('academic'))
    expect(v['--sl-bg']).toBe('#f8fafc')
    expect(v['--sl-primary']).toBe('#1e3a8a')
    expect(v['--sl-font-display']).toContain('serif')
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/styleMap.test.ts`
Expected: FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/styleMap.ts
import type { CSSProperties } from 'react'
import type { Theme } from './themes'

// theme → CSS custom properties（HTML renderer 與 Phase 2 pptx 都讀同一套值）
export function themeVars(theme: Theme): Record<string, string> {
  const { palette, fonts } = theme.tokens
  return {
    '--sl-bg': palette.bg,
    '--sl-surface': palette.surface,
    '--sl-primary': palette.primary,
    '--sl-accent': palette.accent,
    '--sl-text': palette.text,
    '--sl-muted': palette.muted,
    '--sl-font-display': fonts.display,
    '--sl-font-body': fonts.body,
    '--sl-radius': `${theme.tokens.shape.radius}px`,
  }
}

export function themeStyle(theme: Theme): CSSProperties {
  return themeVars(theme) as CSSProperties
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/styleMap.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/styleMap.ts src/features/work/slides/styleMap.test.ts
git commit -m "feat(slides): theme tokens → CSS 變數對應

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 5：AI prompt builder（prompts.ts）

**Files:**
- Create: `src/features/work/slides/prompts.ts`
- Test: `src/features/work/slides/prompts.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/prompts.test.ts
import { describe, it, expect } from 'vitest'
import { buildSlidesSystem, buildSlidesPrompt } from './prompts'

describe('slides/prompts', () => {
  it('system 要求 JSON 陣列 + 指明合法 slide type', () => {
    const s = buildSlidesSystem('企業、會計與財務概論')
    expect(s).toContain('JSON')
    expect(s).toContain('bullets')
    expect(s).toContain('企業、會計與財務概論')
  })

  it('prompt 帶課題與頁數', () => {
    const p = buildSlidesPrompt({ topic: '通脹', slideCount: 8, extra: '加例子' })
    expect(p).toContain('通脹')
    expect(p).toContain('8')
    expect(p).toContain('加例子')
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/prompts.test.ts`
Expected: FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/prompts.ts
import { SLIDE_TYPES } from './types'

export function buildSlidesSystem(subjectName?: string): string {
  const subj = subjectName ? `你而家為「${subjectName}」科備課。` : ''
  return [
    `你係香港資深教師嘅簡報助理。${subj}`,
    '請就用戶課題，產出一份教學簡報，輸出**純 JSON 陣列**（唔好有 markdown fence 或多餘文字）。',
    '每個元素代表一頁，格式：{ "type": <type>, "content": {…}, "speakerNotes"?: string }。',
    `合法 type：${SLIDE_TYPES.join(', ')}。`,
    'content 欄位按 type：',
    '- title: { heading, subheading? }',
    '- section: { heading, kicker? }',
    '- bullets: { heading, items: string[] }',
    '- twoCol: { heading, left: string[], right: string[] }',
    '- imageText: { heading, body, imageSide: "left"|"right"|"full" }',
    '- quote: { text, attribution? }',
    '- compare: { heading, rows: [{ label, a, b }] }',
    '- timeline: { heading, steps: [{ label, detail? }] }',
    '- quiz: { question, options: string[], answerIndex? }',
    '- summary: { heading, points: string[] }',
    '第一頁用 title，最後一頁用 summary。內容用繁體中文（港式用語），精煉、適合投影。',
  ].join('\n')
}

export function buildSlidesPrompt(o: { topic: string; slideCount: number; extra?: string }): string {
  const lines = [`課題：${o.topic}`, `頁數：約 ${o.slideCount} 頁`]
  if (o.extra?.trim()) lines.push(`額外要求：${o.extra.trim()}`)
  return lines.join('\n')
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/prompts.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/prompts.ts src/features/work/slides/prompts.test.ts
git commit -m "feat(slides): AI 簡報 prompt builder

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 6：解析器（parse.ts）

**Files:**
- Create: `src/features/work/slides/parse.ts`
- Test: `src/features/work/slides/parse.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/parse.test.ts
import { describe, it, expect } from 'vitest'
import { parseSlides } from './parse'

describe('slides/parse', () => {
  it('解析合法 JSON，過濾不明 type，補 id', () => {
    const raw = JSON.stringify([
      { type: 'title', content: { heading: '通脹' } },
      { type: 'bogus', content: {} },
      { type: 'bullets', content: { heading: '成因', items: ['需求', '成本'] } },
    ])
    const slides = parseSlides(raw)
    expect(slides).toHaveLength(2)
    expect(slides[0].content.type).toBe('title')
    expect(slides[0].id).toBeTruthy()
    expect(slides[1].content).toMatchObject({ type: 'bullets', items: ['需求', '成本'] })
  })

  it('容忍 markdown fence 與前後雜訊', () => {
    const raw = '```json\n[{"type":"quote","content":{"text":"知識就是力量"}}]\n```'
    const slides = parseSlides(raw)
    expect(slides).toHaveLength(1)
    expect(slides[0].content.type).toBe('quote')
  })

  it('缺欄位用 emptyContent 補齊', () => {
    const slides = parseSlides('[{"type":"bullets","content":{"heading":"X"}}]')
    expect(slides[0].content).toMatchObject({ type: 'bullets', heading: 'X', items: [] })
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/parse.test.ts`
Expected: FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/parse.ts
import { uid } from '../../../lib/store'
import { SLIDE_TYPES, emptyContent, type Slide, type SlideContent, type SlideType } from './types'

// 由 AI 回應（可能帶 fence / 雜訊）抽出 JSON 陣列字串
function extractArray(raw: string): string {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start >= 0 && end > start) return raw.slice(start, end + 1)
  return raw
}

export function parseSlides(raw: string): Slide[] {
  let arr: unknown
  try {
    arr = JSON.parse(extractArray(raw))
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []

  const out: Slide[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = rec.type as SlideType
    if (!SLIDE_TYPES.includes(type)) continue
    const incoming = (rec.content && typeof rec.content === 'object' ? rec.content : {}) as Record<string, unknown>
    const content = { type, ...emptyContent(type), ...incoming } as SlideContent
    out.push({
      id: uid(),
      content,
      speakerNotes: typeof rec.speakerNotes === 'string' ? rec.speakerNotes : undefined,
    })
  }
  return out
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/parse.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/parse.ts src/features/work/slides/parse.test.ts
git commit -m "feat(slides): AI JSON → Slide[] 容錯解析

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 7：儲存（store.ts）

**Files:**
- Create: `src/features/work/slides/store.ts`

> 參考：先 `grep -n \"createCollection\" src/data/collections.ts` 確認簽名與既有用法（例如 `decksCol` / `papersCol`），照抄同一寫法。

- [ ] **Step 1：寫實作（依現有 createCollection 慣例）**

```ts
// src/features/work/slides/store.ts
import { createCollection } from '../../../lib/store'
import type { SlideDeck } from './types'

// ⚠️ storage key 一旦定下不可改
export const slideDecksCol = createCollection<SlideDeck>('ntk.slides.decks')
```

> 註：若 `createCollection` 簽名與此不同（例如需要 schema/version 參數），**以 `src/data/collections.ts` 既有用法為準**，跟住改呢行。

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit`
Expected: 無新錯誤

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/store.ts
git commit -m "feat(slides): decks collection（ntk.slides.decks）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 8：i18n bundle（i18n.ts）

**Files:**
- Create: `src/features/work/slides/i18n.ts`

> 參考既有 `src/features/work/grading/i18n.ts` 完全相同寫法。

- [ ] **Step 1：寫 en bundle（ns slides）**

```ts
// src/features/work/slides/i18n.ts
import i18n from '../../../i18n'

// 教學簡報 Slides — 功能級 i18n bundle（decoupled side-effect）：只加 'en' 嘅 `slides` namespace。
i18n.addResourceBundle(
  'en',
  'translation',
  {
    slides: {
      needSupabase: 'AI slides need Supabase + Gemini',
      setupHint: 'See docs/SETUP.md for setup.',
      loginTitle: 'Sign in to generate slides',
      loginHint: 'AI runs on your own Supabase + Gemini.',
      loginBtn: 'Sign in with Google',
      tabGenerate: 'Generate',
      tabMine: 'My decks',
      topicLabel: 'Topic',
      topicPh: 'e.g. Three causes of inflation',
      countLabel: 'Slides',
      extraLabel: 'Extra notes (optional)',
      extraPh: 'e.g. add HK SME examples',
      themeLabel: 'Template',
      btnGenerate: 'Generate slides',
      btnStop: 'Stop',
      generating: 'AI is building your deck…',
      needTopic: 'Enter a topic',
      genFailed: 'Generation failed, please retry',
      saved: 'Deck saved',
      emptyMine: 'No decks yet. Generate one on the left.',
      present: 'Present',
      exportPdf: 'Export PDF',
      delete: 'Delete',
      confirmDelete: 'Delete this deck?',
      deleted: 'Deck deleted',
      slideOf: 'Slide {{n}} / {{total}}',
      speakerNotes: 'Speaker notes',
      exitPresent: 'Exit (Esc)',
      themeAcademic: 'Academic Blue',
      themePlayful: 'Vivid Orange',
      themeMinimal: 'Minimal Ink',
      themeChalk: 'Chalkboard',
      imgSearch: 'Search images',
      imgSearchPh: 'Keyword…',
      imgDisabled: 'Image search not configured',
      imgCredit: 'Photo: {{credit}}',
    },
  },
  true,
  true,
)
```

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit`
Expected: 無新錯誤

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/i18n.ts
git commit -m "feat(slides): i18n bundle（ns slides，中英）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 9：圖庫 provider（images/provider.ts）

**Files:**
- Create: `src/features/work/slides/images/provider.ts`
- Test: `src/features/work/slides/images/provider.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/images/provider.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isImageSearchConfigured, searchImages } from './provider'

describe('slides/images/provider', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('未配置 key → 停用、回空陣列', async () => {
    vi.stubEnv('VITE_PEXELS_API_KEY', '')
    expect(isImageSearchConfigured()).toBe(false)
    expect(await searchImages('inflation')).toEqual([])
  })

  it('有 key → 解析回應為 ImageRef[]', async () => {
    vi.stubEnv('VITE_PEXELS_API_KEY', 'k')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ photos: [{ src: { large: 'http://img/1' }, photographer: 'Jo' }] }),
    }))
    const res = await searchImages('inflation')
    expect(res[0]).toMatchObject({ kind: 'stock', src: 'http://img/1', credit: 'Jo' })
  })
})
```

- [ ] **Step 2：跑測試確認 fail**

Run: `npx vitest run src/features/work/slides/images/provider.test.ts`
Expected: FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/images/provider.ts
import type { ImageRef } from '../types'

const KEY = () => (import.meta.env.VITE_PEXELS_API_KEY as string | undefined) ?? ''

export function isImageSearchConfigured(): boolean {
  return Boolean(KEY())
}

// 預設 Pexels provider；未配置 key 時優雅停用（回空陣列）。
export async function searchImages(query: string): Promise<ImageRef[]> {
  const key = KEY()
  if (!key || !query.trim()) return []
  try {
    const url = `https://api.pexels.com/v1/search?per_page=12&query=${encodeURIComponent(query)}`
    const r = await fetch(url, { headers: { Authorization: key } })
    if (!r.ok) return []
    const data = (await r.json()) as { photos?: { src?: { large?: string }; photographer?: string }[] }
    return (data.photos ?? [])
      .filter((p) => p.src?.large)
      .map((p) => ({ kind: 'stock' as const, src: p.src!.large!, credit: p.photographer, alt: query }))
  } catch {
    return []
  }
}
```

- [ ] **Step 4：跑測試確認 pass**

Run: `npx vitest run src/features/work/slides/images/provider.test.ts`
Expected: PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/images/
git commit -m "feat(slides): 圖庫搜尋 provider（Pexels，未配置優雅停用）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 10：單頁 render（SlidePreview.tsx）

**Files:**
- Create: `src/features/work/slides/SlidePreview.tsx`

> 此為視覺組件，邏輯靠前面已測試的 `themeVars` / content 型別。重點：16:9、食 `--sl-*` 變數、按 `slide.content.type` switch 出版面。

- [ ] **Step 1：寫實作**

```tsx
// src/features/work/slides/SlidePreview.tsx
import type { Slide } from './types'
import type { Theme } from './themes'
import { themeStyle } from './styleMap'

interface Props {
  slide: Slide
  theme: Theme
  className?: string
}

// 固定 16:9 舞台；用 CSS 變數令同一組件適配所有 theme。
export default function SlidePreview({ slide, theme, className = '' }: Props) {
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden ${className}`}
      style={{
        ...themeStyle(theme),
        background: 'var(--sl-bg)',
        color: 'var(--sl-text)',
        fontFamily: 'var(--sl-font-body)',
      }}
    >
      <div className="flex h-full flex-col justify-center px-[6%] py-[5%]">
        <Body slide={slide} />
      </div>
      {slide.imageRef?.credit && (
        <span className="absolute bottom-1 right-2 text-[10px]" style={{ color: 'var(--sl-muted)' }}>
          {slide.imageRef.credit}
        </span>
      )}
    </div>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[2.6vw] font-bold leading-tight" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>
      {children}
    </h2>
  )
}

function Body({ slide }: { slide: Slide }) {
  const c = slide.content
  switch (c.type) {
    case 'title':
      return (
        <div className="text-center">
          <h1 className="text-[4vw] font-extrabold" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>{c.heading}</h1>
          {c.subheading && <p className="mt-2 text-[1.8vw]" style={{ color: 'var(--sl-muted)' }}>{c.subheading}</p>}
        </div>
      )
    case 'section':
      return <h1 className="text-center text-[3.4vw] font-bold" style={{ color: 'var(--sl-primary)', fontFamily: 'var(--sl-font-display)' }}>{c.heading}</h1>
    case 'bullets':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ul className="space-y-2 text-[1.6vw]">
            {c.items.map((it, i) => (
              <li key={i} className="flex gap-2"><span style={{ color: 'var(--sl-accent)' }}>•</span><span>{it}</span></li>
            ))}
          </ul>
        </>
      )
    case 'twoCol':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <div className="grid grid-cols-2 gap-[4%] text-[1.4vw]">
            <ul className="space-y-1.5">{c.left.map((x, i) => <li key={i}>• {x}</li>)}</ul>
            <ul className="space-y-1.5">{c.right.map((x, i) => <li key={i}>• {x}</li>)}</ul>
          </div>
        </>
      )
    case 'imageText':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <p className="text-[1.5vw]">{c.body}</p>
        </>
      )
    case 'quote':
      return (
        <blockquote className="text-center">
          <p className="text-[2.6vw] font-semibold italic" style={{ fontFamily: 'var(--sl-font-display)' }}>「{c.text}」</p>
          {c.attribution && <footer className="mt-3 text-[1.3vw]" style={{ color: 'var(--sl-muted)' }}>— {c.attribution}</footer>}
        </blockquote>
      )
    case 'compare':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <table className="w-full text-[1.3vw]">
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--sl-muted)' }}>
                  <td className="py-1 font-semibold">{r.label}</td><td className="py-1">{r.a}</td><td className="py-1">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )
    case 'timeline':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ol className="space-y-2 text-[1.4vw]">
            {c.steps.map((s, i) => (
              <li key={i} className="flex gap-2"><span className="font-bold" style={{ color: 'var(--sl-accent)' }}>{i + 1}.</span><span>{s.label}{s.detail ? ` — ${s.detail}` : ''}</span></li>
            ))}
          </ol>
        </>
      )
    case 'quiz':
      return (
        <>
          <Heading>{c.question}</Heading>
          <ul className="space-y-2 text-[1.5vw]">
            {c.options.map((o, i) => (
              <li key={i} className="rounded px-3 py-1" style={{ background: 'var(--sl-surface)' }}>{String.fromCharCode(65 + i)}. {o}</li>
            ))}
          </ul>
        </>
      )
    case 'summary':
      return (
        <>
          <Heading>{c.heading}</Heading>
          <ul className="space-y-2 text-[1.6vw]">{c.points.map((p, i) => <li key={i}>✓ {p}</li>)}</ul>
        </>
      )
  }
}
```

- [ ] **Step 2：型別檢查 + build**

Run: `npx tsc --noEmit`
Expected: 無錯誤（switch 已涵蓋全部 type，TS exhaustive）

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/SlidePreview.tsx
git commit -m "feat(slides): 單頁 HTML render（16:9，食 theme 變數）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 11：放映模式（PresentMode.tsx）

**Files:**
- Create: `src/features/work/slides/PresentMode.tsx`

- [ ] **Step 1：寫實作**

```tsx
// src/features/work/slides/PresentMode.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SlideDeck } from './types'
import { getTheme } from './themes'
import SlidePreview from './SlidePreview'

interface Props {
  deck: SlideDeck
  onClose: () => void
}

// 全螢幕放映：← → / Space 翻頁，Esc 離開。
export default function PresentMode({ deck, onClose }: Props) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const theme = getTheme(deck.themeId)
  const total = deck.slides.length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === ' ') setI((n) => Math.min(n + 1, total - 1))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onClose])

  const slide = deck.slides[i]
  if (!slide) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/95">
      <div className="w-full max-w-6xl px-4">
        <SlidePreview slide={slide} theme={theme} className="rounded-lg shadow-2xl" />
      </div>
      <div className="mt-4 flex items-center gap-4 text-white">
        <button onClick={() => setI((n) => Math.max(n - 1, 0))} aria-label="prev"><ChevronLeft /></button>
        <span className="tabular-nums text-sm">{t('slides.slideOf', { defaultValue: 'Slide {{n}} / {{total}}', n: i + 1, total })}</span>
        <button onClick={() => setI((n) => Math.min(n + 1, total - 1))} aria-label="next"><ChevronRight /></button>
      </div>
      {slide.speakerNotes && (
        <p className="mt-3 max-w-3xl px-4 text-center text-xs text-white/60">{slide.speakerNotes}</p>
      )}
      <button onClick={onClose} className="absolute right-5 top-5 text-white/80 hover:text-white" aria-label={t('slides.exitPresent', { defaultValue: 'Exit (Esc)' })}>
        <X size={24} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/PresentMode.tsx
git commit -m "feat(slides): 全螢幕放映模式（鍵盤翻頁 + 講者備註）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 12：deck 檢視（DeckView.tsx，含 PDF 匯出）

**Files:**
- Create: `src/features/work/slides/DeckView.tsx`

> PDF 匯出沿用瀏覽器列印：開新視窗、注入 print CSS（`@page { size: landscape }`、每頁 `page-break-after`），呼 `window.print()`。參考 `src/features/work/timetable/PrintView.tsx` 既有手法。

- [ ] **Step 1：寫實作**

```tsx
// src/features/work/slides/DeckView.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, FileDown, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../ui'
import { useConfirm } from '../../context/ConfirmContext'
import { useToast } from '../../context/ToastContext'
import type { SlideDeck } from './types'
import { getTheme } from './themes'
import { slideDecksCol } from './store'
import SlidePreview from './SlidePreview'
import PresentMode from './PresentMode'

export default function DeckView({ deck }: { deck: SlideDeck }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const toast = useToast()
  const [present, setPresent] = useState(false)
  const theme = getTheme(deck.themeId)

  const remove = async () => {
    if (await confirm({ title: t('slides.confirmDelete', { defaultValue: '刪除呢份簡報？' }) })) {
      slideDecksCol.remove(deck.id)
      toast.success(t('slides.deleted', { defaultValue: '已刪除簡報' }))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold">{deck.title}</h3>
        <div className="flex gap-1">
          <Button size="sm" icon={Play} onClick={() => setPresent(true)}>{t('slides.present', { defaultValue: '放映' })}</Button>
          <Button size="sm" variant="secondary" icon={FileDown} onClick={() => exportDeckPdf(deck)}>{t('slides.exportPdf', { defaultValue: '匯出 PDF' })}</Button>
          <IconButton label={t('slides.delete', { defaultValue: '刪除' })} size="sm" onClick={() => void remove()}><Trash2 size={15} /></IconButton>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {deck.slides.map((s) => (
          <SlidePreview key={s.id} slide={s} theme={theme} className="rounded-md border border-[color:var(--border)]" />
        ))}
      </div>
      {present && <PresentMode deck={deck} onClose={() => setPresent(false)} />}
    </div>
  )
}

// 開新視窗、render slide 縮圖、用瀏覽器列印成 PDF（橫向、逐頁分頁）。
function exportDeckPdf(deck: SlideDeck) {
  const w = window.open('', '_blank')
  if (!w) return
  const theme = getTheme(deck.themeId)
  const p = theme.tokens.palette
  const slidesHtml = deck.slides
    .map((s) => `<section class="sl"><h2>${escapeHtml(slideHeading(s))}</h2></section>`)
    .join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title)}</title>
    <style>
      @page { size: A4 landscape; margin: 0 }
      body { margin: 0; font-family: ${p ? 'system-ui' : 'system-ui'} }
      .sl { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;
            background: ${p.bg}; color: ${p.text}; page-break-after: always; }
      .sl h2 { color: ${p.primary}; font-size: 32px; padding: 0 8% }
    </style></head><body>${slidesHtml}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

// 取每頁主標題（PDF 簡化版只印標題；完整視覺以 app 內放映為準）。
function slideHeading(s: SlideDeck['slides'][number]): string {
  const c = s.content
  if ('heading' in c) return c.heading
  if (c.type === 'quote') return c.text
  if (c.type === 'quiz') return c.question
  return ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))
}
```

> 註：Phase 1 嘅 PDF 為**簡化版**（每頁標題），完整視覺以 app 內放映為主；Phase 2 .pptx 匯出會做完整版面。如要 Phase 1 PDF 更靚，可改為把 `SlidePreview` 用 `renderToStaticMarkup` 寫入列印視窗（屬增強，非必須）。

- [ ] **Step 2：型別檢查**

Run: `npx tsc --noEmit`
Expected: 無錯誤

- [ ] **Step 3：commit**

```bash
git add src/features/work/slides/DeckView.tsx
git commit -m "feat(slides): deck 縮圖檢視 + 放映入口 + PDF 匯出

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 13：生成器 + 主組件（Generator.tsx、Slides.tsx）

**Files:**
- Create: `src/features/work/slides/Generator.tsx`
- Create: `src/features/work/Slides.tsx`

> 參考 `src/features/work/Grading.tsx` 嘅 gate（`isAIConfigured` / `useAuth`）、`streamChat` 串流、`useToast` 用法，照同一套。

- [ ] **Step 1：寫 Generator.tsx**

```tsx
// src/features/work/slides/Generator.tsx
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Square } from 'lucide-react'
import { Button, Input, Textarea, Field, Select, SegmentedControl } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useSettings } from '../../context/SettingsContext'
import { getSubjectPack } from '../../data/subjects'
import { streamChat } from '../../lib/aiClient'
import { uid } from '../../lib/store'
import { buildSlidesSystem, buildSlidesPrompt } from './prompts'
import { parseSlides } from './parse'
import { allThemes } from './themes'
import { slideDecksCol } from './store'

export default function Generator({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(8)
  const [extra, setExtra] = useState('')
  const [themeId, setThemeId] = useState(allThemes[0].id)
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stop = () => { abortRef.current?.abort(); setBusy(false) }

  async function generate() {
    if (!topic.trim()) { toast.error(t('slides.needTopic', { defaultValue: '請輸入課題' })); return }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    let acc = ''
    try {
      for await (const chunk of streamChat({
        system: buildSlidesSystem(subjectName),
        messages: [{ role: 'user', content: buildSlidesPrompt({ topic, slideCount: count, extra }) }],
        model: 'gemini-2.5-flash',
        signal: controller.signal,
      })) acc += chunk
      const slides = parseSlides(acc)
      if (slides.length === 0) { toast.error(t('slides.genFailed', { defaultValue: 'AI 生成失敗，請再試' })); return }
      const now = new Date().toISOString()
      const id = uid()
      slideDecksCol.add({ id, title: topic.trim(), subjectPackId, themeId, slides, createdAt: now, updatedAt: now })
      toast.success(t('slides.saved', { defaultValue: '已儲存簡報' }))
      onCreated(id)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message || t('slides.genFailed', { defaultValue: 'AI 生成失敗，請再試' }))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <Field label={t('slides.topicLabel', { defaultValue: '課題' })}>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('slides.topicPh', { defaultValue: '例如：通脹嘅三個成因' })} />
      </Field>
      <Field label={t('slides.countLabel', { defaultValue: '頁數' })}>
        <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
          {[6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </Field>
      <Field label={t('slides.extraLabel', { defaultValue: '額外要求（選填）' })}>
        <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t('slides.extraPh', { defaultValue: '例如：加香港中小企例子' })} />
      </Field>
      <Field label={t('slides.themeLabel', { defaultValue: '樣板' })}>
        <SegmentedControl<string>
          value={themeId}
          onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))}
        />
      </Field>
      <div className="flex justify-end">
        {busy
          ? <Button variant="secondary" icon={Square} onClick={stop}>{t('slides.btnStop', { defaultValue: '停止' })}</Button>
          : <Button icon={Sparkles} onClick={() => void generate()}>{t('slides.btnGenerate', { defaultValue: '生成簡報' })}</Button>}
      </div>
      {busy && <p className="text-center text-sm text-slate-400">{t('slides.generating', { defaultValue: 'AI 砌緊你份簡報…' })}</p>}
    </div>
  )
}
```

- [ ] **Step 2：寫 Slides.tsx（gate + tabs）**

```tsx
// src/features/work/Slides.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import './slides/i18n'
import { Button, EmptyState, cx } from '../ui'
import { useAuth } from '../context/AuthContext'
import { isAIConfigured } from '../lib/aiClient'
import { useCollection } from '../lib/store'
import { slideDecksCol } from './slides/store'
import Generator from './slides/Generator'
import DeckView from './slides/DeckView'

export default function Slides() {
  const { t } = useTranslation()
  const { user, configured, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<'gen' | 'mine'>('gen')
  const decks = useCollection(slideDecksCol)

  if (!isAIConfigured) {
    return <EmptyState icon={Sparkles} title={t('slides.needSupabase', { defaultValue: 'AI 簡報需要接好 Supabase + Gemini' })} hint={t('slides.setupHint', { defaultValue: '設定步驟見 docs/SETUP.md。' })} />
  }
  if (!user) {
    return <EmptyState icon={Sparkles} title={t('slides.loginTitle', { defaultValue: '登入先可以生成簡報' })} hint={t('slides.loginHint', { defaultValue: 'AI 功能經你自己嘅 Supabase + Gemini 運作。' })}
      action={configured ? <Button onClick={() => void signInWithGoogle()}>{t('slides.loginBtn', { defaultValue: '用 Google 登入' })}</Button> : undefined} />
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {(['gen', 'mine'] as const).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={cx('flex-1 rounded-md px-3 py-1.5 font-medium transition',
              tab === tb ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}>
            {tb === 'gen' ? t('slides.tabGenerate', { defaultValue: '生成' }) : t('slides.tabMine', { defaultValue: '我的簡報' })}
          </button>
        ))}
      </div>
      {tab === 'gen'
        ? <Generator onCreated={() => setTab('mine')} />
        : decks.length === 0
          ? <p className="py-10 text-center text-sm text-slate-400">{t('slides.emptyMine', { defaultValue: '仲未有簡報，去左邊生成一份。' })}</p>
          : <div className="space-y-8">{decks.map((d) => <DeckView key={d.id} deck={d} />)}</div>}
    </div>
  )
}
```

- [ ] **Step 3：型別檢查 + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 無錯誤、build 成功

- [ ] **Step 4：commit**

```bash
git add src/features/work/slides/Generator.tsx src/features/work/Slides.tsx
git commit -m "feat(slides): AI 生成器 + 主組件（gate + tabs）

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 14：接入 registry + lazy route

**Files:**
- Modify: `src/features/registry.ts`（新增 `work-slides` 條目，教學組，icon）
- Modify: 功能載入處（lazy import `Slides`，依現有功能 component 對應方式）

> 先 `grep -n "work-lesson-plan\|work-generate" src/features/registry.ts` 同搵出功能 id → component 嘅對應（例如 `src/App.tsx` 或 features 載入表），照同一 pattern 加 `work-slides`。

- [ ] **Step 1：registry 新增條目**

喺教學組附近（`work-lesson-plan` 後）加：

```ts
  {
    id: 'work-slides',
    modes: ['work'],
    group: '教學',
    name: '教學簡報',
    description: 'AI 由課題生成簡報，多個有個性樣板，可放映同匯出。',
    icon: '🖼️',
    status: 'ready',
  },
```

> 欄位以 `registry.ts` 既有條目實際 shape 為準（照抄相鄰條目）。

- [ ] **Step 2：接 component 載入**

跟現有「功能 id → lazy component」對應表，加：

```ts
'work-slides': lazy(() => import('./features/work/Slides')),
```

（確切位置／寫法以 codebase 既有 pattern 為準。）

- [ ] **Step 3：型別檢查 + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 無錯誤；功能喺 Work 模式側欄/首頁出現

- [ ] **Step 4：commit**

```bash
git add src/features/registry.ts src/App.tsx
git commit -m "feat(slides): 接入 registry + 教學簡報功能入口

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 15：文件 + 全套驗證

**Files:**
- Modify: `docs/SETUP.md`

- [ ] **Step 1：SETUP.md 加圖庫設定**

加一節：

```md
### 教學簡報 — 圖庫搜尋（選用）

簡報生成可用 Pexels 免費圖庫搜圖。喺環境變數加：

    VITE_PEXELS_API_KEY=你嘅_pexels_key

未設定時，圖庫搜尋會自動停用（仍可用內建插圖／上載圖片）。
申請：https://www.pexels.com/api/
```

- [ ] **Step 2：全套驗證**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc 乾淨、build 成功、**所有測試通過（3728 baseline + 新增 slides 測試）**

- [ ] **Step 3：commit + push**

```bash
git add docs/SETUP.md
git commit -m "docs(slides): SETUP 圖庫 key 說明 + Phase 1 收尾

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
git push -u origin claude/remote-control-fiz0i
```

---

## Self-Review（對 spec）

**Spec coverage：**
- §2 資料 model → Task 1 ✓
- §3 Theme 系統（4 樣板）→ Task 2-3 ✓；token→CSS → Task 4 ✓
- §4 AI 由課題生成 → Task 5（prompt）+ 6（parse）+ 13（生成流程）✓
- §5 圖片：圖庫搜尋 → Task 9 ✓；**上載 / 內建插圖** → 標記為 Phase 1 增強，未列為獨立 task（見下「已知缺口」）
- §6 HTML renderer + 放映 + PDF → Task 10（render）+ 11（放映）+ 12（PDF）✓
- §7 平台慣例（registry / ntk. / i18n / AI）→ Task 7、8、13、14 ✓
- §10 測試 → 各 task 內 TDD ✓
- §12 部署設定（Pexels key）→ Task 9 + 15 ✓

**已知缺口（蓄意，Phase 1 範圍收窄）：**
1. **圖片「上載到 Supabase storage」與「內建 SVG 插圖庫」** 未做成獨立 task。Generator 生成嘅 deck 暫時以文字版面為主，圖片搜尋 provider（Task 9）已就緒但未接入 slide 編輯插圖 UI（因 Phase 1 無手動編輯器，插圖主要喺 Phase 3 編輯器接入）。**決定：** Phase 1 聚焦「生成 + 樣板 + 放映 + PDF」；圖片插入 UI 隨 Phase 3 手動編輯器一齊做。已在 spec §5 與此 plan File Structure 註明。若你要 Phase 1 就能搜圖插入，補一個「imageText 頁自動配圖」task 即可。

**Placeholder scan：** 無 TBD／TODO；component task 提供完整可執行 code（個別「以 codebase 既有 pattern 為準」處，屬接駁點，已指明參考檔）。

**Type consistency：** `SlideDeck` / `Slide` / `SlideContent` / `ImageRef` / `Theme` / `themeVars` / `themeStyle` / `parseSlides` / `slideDecksCol` / `buildSlidesSystem` / `buildSlidesPrompt` / `searchImages` 跨 task 命名一致 ✓。

---

## Phase 2-4（後續，各自出 plan）

- **Phase 2 — .pptx 匯出**：加 `pptxgenjs`；`slides/pptxExport.ts` 食同一 theme tokens；每種 slide-type 對應 pptx 物件（mock 測試）。
- **Phase 3 — 手動編輯器**：`slides/editor/`；逐頁加/刪/改/換版面/排序；接入圖片三源（上載 + 圖庫 + 內建插圖）插入 UI。
- **Phase 4 — 教案轉簡報**：`slides/fromLessonPlan.ts`；（可選）AI 生圖。
