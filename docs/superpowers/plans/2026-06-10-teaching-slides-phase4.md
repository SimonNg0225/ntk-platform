# 教學簡報生成器 — Phase 4（教案轉簡報）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老師可由現有「備課 / 教案（LessonPlanner）」一鍵轉成一份教學簡報，套用樣板後即可編輯 / 放映 / 匯出。

**Architecture:** 新增純函數 `lessonPlanToSlides(plan, meta?): Slide[]`，將教案（`LessonPlan` 自由文字 + `PlanMeta` 結構化環節/教材）映射成 Phase 1 嘅 `Slide[]`。UI 喺「教學簡報」加第三個分頁「由教案」，揀教案 + 樣板 → 轉換 → 經 `slideDecksCol.add` 存檔 → 跳去「我的簡報」即可用 Phase 3 編輯器微調。

**Tech Stack:** 既有 React/TS、vitest、Phase 1-3 模組。**無新依賴。**

**已落地可依賴嘅接口（確認過）：**
- `src/data/types.ts`：`LessonPlan { id, title, classId?, topicId?, date?, objectives?: string, activities?: string, resourcesNote?: string, createdAt }`。
- `src/data/collections.ts`：`lessonPlansCol = createCollection<LessonPlan>('lesson_plans', [])`。
- `src/features/work/lessonPlanner/util.ts`：`PlanMeta { id(==plan.id), status, phases: LessonPhase[], materials: MaterialItem[], ... }`；`LessonPhase { id, label, minutes, detail }`；`MaterialItem { id, text, done }`；`planMetaCol = createCollection<PlanMeta>('lesson_plan_meta', [])`。
- slides：`Slide`、`SlideContent`、`SlideDeck`、`slideDecksCol`、`allThemes`、`uid`（'../../../lib/store'）、`useCollection`。
- `Slides.tsx`：頂部分頁（現為 `gen` / `mine`）。

**規範（全程）：** 絕不改 `ntk.*` key；i18n 只加 `en`、zh-HK 靠 `defaultValue`；單引號無分號；每 task commit；維持測試全綠；NEVER `git stash`；commit 結尾 `https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK`。

---

## File Structure（Phase 4）

```
src/features/work/slides/
  fromLessonPlan.ts   fromLessonPlan.test.ts   # 純：lessonPlanToSlides(plan, meta?) → Slide[]
  FromPlan.tsx                                 # 「由教案」分頁：揀教案 + 樣板 + 轉換
  Slides.tsx          (modify)                 # 加第三分頁 'plan'
  i18n.ts             (modify)                 # 加 by-plan en key
docs/SETUP.md         (modify)                 # 一句：教案轉簡報用法
```

**非目標（本期不做，附理由）：** spec §9 提到「（可選）AI 生圖」。本期**不實作 AI 生圖** —— 現有 Gemini edge function 只做文字串流，無圖像生成端點；要做需新增後端基建 + 成本評估，屬獨立增強，留待日後。教案轉出嘅簡報仍可用 Phase 3 圖片三源（內建 / 上載 / 圖庫）手動配圖。

---

## Task 1：教案 → 簡報 純轉換器（fromLessonPlan.ts）

**Files:** Create `src/features/work/slides/fromLessonPlan.ts` + `fromLessonPlan.test.ts`

- [ ] **Step 1：寫失敗測試**

```ts
// src/features/work/slides/fromLessonPlan.test.ts
import { describe, it, expect } from 'vitest'
import { lessonPlanToSlides } from './fromLessonPlan'
import type { LessonPlan } from '../../../data/types'
import type { PlanMeta } from '../lessonPlanner/util'

const plan: LessonPlan = {
  id: 'p1', title: '通脹與物價', date: '2026-03-15',
  objectives: '理解通脹定義\n認識三大成因\n計算 CPI', activities: '小組討論\n個案分析',
  resourcesNote: 'CPI 數據表', createdAt: 'x',
}
const meta: PlanMeta = {
  id: 'p1', status: 'ready',
  phases: [
    { id: 'a', label: '引入', minutes: 5, detail: '新聞引入' },
    { id: 'b', label: '講解', minutes: 20, detail: '三大成因' },
  ],
  materials: [{ id: 'm1', text: '工作紙', done: false }, { id: 'm2', text: 'PPT', done: true }],
  updatedAt: 'x',
}

describe('slides/fromLessonPlan', () => {
  it('首頁 title（含日期），尾頁 summary', () => {
    const s = lessonPlanToSlides(plan, meta)
    expect(s[0].content).toMatchObject({ type: 'title', heading: '通脹與物價', subheading: '2026-03-15' })
    expect(s[s.length - 1].content.type).toBe('summary')
  })

  it('objectives → bullets（逐行）', () => {
    const s = lessonPlanToSlides(plan, meta)
    const obj = s.find((x) => x.content.type === 'bullets' && x.content.heading === '教學目標')
    expect(obj?.content).toMatchObject({ items: ['理解通脹定義', '認識三大成因', '計算 CPI'] })
  })

  it('phases → timeline（label 含分鐘，detail 保留）', () => {
    const s = lessonPlanToSlides(plan, meta)
    const tl = s.find((x) => x.content.type === 'timeline')
    expect(tl?.content).toMatchObject({ heading: '課堂流程', steps: [
      { label: '引入（5 分）', detail: '新聞引入' },
      { label: '講解（20 分）', detail: '三大成因' },
    ] })
  })

  it('activities → bullets；materials(+resourcesNote) → bullets', () => {
    const s = lessonPlanToSlides(plan, meta)
    expect(s.some((x) => x.content.type === 'bullets' && x.content.heading === '課堂活動' && x.content.items.includes('小組討論'))).toBe(true)
    const mat = s.find((x) => x.content.type === 'bullets' && x.content.heading === '教材準備')
    expect(mat?.content.items).toEqual(['工作紙', 'PPT', 'CPI 數據表'])
  })

  it('每張 slide 有唯一 id', () => {
    const s = lessonPlanToSlides(plan, meta)
    const ids = s.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('最簡教案（只有 title）→ 至少 title + summary，唔會崩', () => {
    const s = lessonPlanToSlides({ id: 'p2', title: '只有題目', createdAt: 'x' })
    expect(s[0].content.type).toBe('title')
    expect(s[s.length - 1].content.type).toBe('summary')
    expect(s.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2：跑測試確認 fail** — Run: `npx vitest run src/features/work/slides/fromLessonPlan.test.ts` → FAIL

- [ ] **Step 3：寫實作**

```ts
// src/features/work/slides/fromLessonPlan.ts
import { uid } from '../../../lib/store'
import type { LessonPlan } from '../../../data/types'
import type { PlanMeta } from '../lessonPlanner/util'
import type { Slide, SlideContent } from './types'

// 自由文字 → 逐行清單（去 bullet 符號 / 空白行）
function splitLines(text?: string): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*–·]\s*/, '').trim())
    .filter(Boolean)
}

const mk = (content: SlideContent): Slide => ({ id: uid(), content })

// 教案（LessonPlan + 可選 PlanMeta）→ Phase 1 Slide[]
export function lessonPlanToSlides(plan: LessonPlan, meta?: PlanMeta): Slide[] {
  const slides: Slide[] = []

  // 封面
  slides.push(mk({ type: 'title', heading: plan.title || '教學簡報', subheading: plan.date }))

  // 教學目標
  const objectives = splitLines(plan.objectives)
  if (objectives.length) slides.push(mk({ type: 'bullets', heading: '教學目標', items: objectives }))

  // 課堂流程（環節）
  const phases = meta?.phases ?? []
  if (phases.length) {
    slides.push(mk({
      type: 'timeline', heading: '課堂流程',
      steps: phases.map((p) => ({ label: `${p.label}（${p.minutes} 分）`, detail: p.detail?.trim() || undefined })),
    }))
  }

  // 課堂活動
  const activities = splitLines(plan.activities)
  if (activities.length) slides.push(mk({ type: 'bullets', heading: '課堂活動', items: activities }))

  // 教材準備（materials + resourcesNote）
  const materials = [
    ...(meta?.materials ?? []).map((m) => m.text.trim()).filter(Boolean),
    ...splitLines(plan.resourcesNote),
  ]
  if (materials.length) slides.push(mk({ type: 'bullets', heading: '教材準備', items: materials }))

  // 總結（用目標做重點；無目標就用標題兜底）
  slides.push(mk({ type: 'summary', heading: '總結', points: objectives.length ? objectives : [plan.title || '重點回顧'] }))

  return slides
}
```

- [ ] **Step 4：跑測試確認 pass** — Run: `npx vitest run src/features/work/slides/fromLessonPlan.test.ts` → PASS

- [ ] **Step 5：commit**

```bash
git add src/features/work/slides/fromLessonPlan.ts src/features/work/slides/fromLessonPlan.test.ts
git commit -m "feat(slides): 教案 → 簡報純轉換器 lessonPlanToSlides

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
```

---

## Task 2：「由教案」分頁（FromPlan.tsx）+ 接線 + i18n + 驗證

**Files:** Create `src/features/work/slides/FromPlan.tsx`；Modify `Slides.tsx`、`i18n.ts`、`docs/SETUP.md`

- [ ] **Step 1：FromPlan.tsx**

```tsx
// src/features/work/slides/FromPlan.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Presentation } from 'lucide-react'
import { Button, Field, Select, SegmentedControl, EmptyState } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useCollection, uid } from '../../../lib/store'
import { lessonPlansCol } from '../../../data/collections'
import { planMetaCol } from '../lessonPlanner/util'
import { lessonPlanToSlides } from './fromLessonPlan'
import { allThemes } from './themes'
import { slideDecksCol } from './store'

export default function FromPlan({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const plans = useCollection(lessonPlansCol)
  const [planId, setPlanId] = useState('')
  const [themeId, setThemeId] = useState(allThemes[0].id)

  if (plans.length === 0) {
    return <EmptyState title={t('slides.planNone', { defaultValue: '仲未有教案' })} hint={t('slides.planNoneHint', { defaultValue: '去「備課 / 教案」整一份，再返嚟轉做簡報。' })} />
  }

  const convert = () => {
    const plan = plans.find((p) => p.id === planId) ?? plans[0]
    const meta = planMetaCol.get().find((m) => m.id === plan.id)
    const slides = lessonPlanToSlides(plan, meta)
    const now = new Date().toISOString()
    const id = uid()
    slideDecksCol.add({ id, title: plan.title, themeId, slides, createdAt: now, updatedAt: now })
    toast.success(t('slides.planConverted', { defaultValue: '已由教案生成簡報' }))
    onCreated(id)
  }

  return (
    <div className="space-y-3">
      <Field label={t('slides.planPick', { defaultValue: '揀一份教案' })}>
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">{t('slides.planPickPh', { defaultValue: '— 揀教案 —' })}</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
      </Field>
      <Field label={t('slides.themeLabel', { defaultValue: '樣板' })}>
        <SegmentedControl<string> value={themeId} onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))} />
      </Field>
      <div className="flex justify-end">
        <Button icon={Presentation} disabled={!planId} onClick={convert}>
          {t('slides.planConvert', { defaultValue: '轉做簡報' })}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2：Slides.tsx 加第三分頁 'plan'**

修改 `Slides.tsx`：
1. `import FromPlan from './slides/FromPlan'`。
2. tab 型別由 `'gen' | 'mine'` → `'gen' | 'plan' | 'mine'`。
3. 分頁陣列由 `(['gen','mine'] as const)` → `(['gen','plan','mine'] as const)`，label 對應：`gen`→`slides.tabGenerate`（生成）、`plan`→`slides.tabFromPlan`（由教案）、`mine`→`slides.tabMine`（我的簡報）。
4. 內容區：`tab === 'gen'` → `<Generator onCreated={() => setTab('mine')} />`；新增 `tab === 'plan'` → `<FromPlan onCreated={() => setTab('mine')} />`；否則「我的簡報」維持原狀（含 editId / DeckEditor 邏輯不變）。

> 注意：保留 Phase 3 加入嘅 `editId` 編輯器邏輯與 i18n 側效 import，唔好移除。

- [ ] **Step 3：i18n.ts 加 en key**

喺 `slides` bundle 加：`tabFromPlan: 'From plan'`, `planPick: 'Pick a lesson plan'`, `planPickPh: '— pick a plan —'`, `planConvert: 'Convert to slides'`, `planConverted: 'Slides created from plan'`, `planNone: 'No lesson plans yet'`, `planNoneHint: 'Create one in Lesson planning, then come back to convert.'`。（`themeLabel` 已存在，重用。）

- [ ] **Step 4：docs/SETUP.md**

教學簡報一節補一句：`亦可喺「教學簡報 → 由教案」分頁，揀一份備課教案一鍵轉成簡報初稿，再用編輯器微調。`

- [ ] **Step 5：全套驗證**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: tsc 乾淨、build 成功、**所有測試通過**（baseline + 新增 fromLessonPlan 測試）

- [ ] **Step 6：commit + push**

```bash
git add src/features/work/slides/FromPlan.tsx src/features/work/Slides.tsx src/features/work/slides/i18n.ts docs/SETUP.md
git commit -m "feat(slides): 「由教案」分頁，一鍵將備課教案轉成簡報

https://claude.ai/code/session_01S7siZDE12uJhCgbDkd9bNK"
git push -u origin claude/remote-control-fiz0i
```

---

## Self-Review（對 spec §4「教案轉簡報」）

**Spec coverage：**
- §4「教案轉簡報（Phase 4）：接 LessonPlanner，一個 lessonPlan → SlideDeck 轉換器」→ Task 1（`lessonPlanToSlides` 純轉換，食 LessonPlan + PlanMeta）+ Task 2（「由教案」分頁接線，存成 deck）✓。
- §9「（可選）AI 生圖」→ **明確列為本期非目標**（理由：現有 edge function 無圖像端點，需新基建）；轉出簡報可用 Phase 3 圖片三源手動配圖。

**Placeholder scan：** 無 TBD/TODO。Slides.tsx 改動以文字步驟描述（因需保留 Phase 3 既有 editId 邏輯，逐點指明），其餘均有完整 code。

**Type consistency：** `lessonPlanToSlides(plan: LessonPlan, meta?: PlanMeta): Slide[]`、`SlideContent` 各 type 欄位（title.subheading / bullets.items / timeline.steps[{label,detail?}] / summary.points）與 Phase 1 `types.ts` 完全對齊；`lessonPlansCol`（'lesson_plans'）、`planMetaCol`（'lesson_plan_meta'）、`slideDecksCol.add`、`allThemes`、`uid`、`useCollection` 與既有 codebase 一致 ✓。
