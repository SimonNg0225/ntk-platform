import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  practiceStreak,
  practiceHeatmap,
  syncMistakesFromAttempt,
  mistakesCol,
} from './util'
import type { QuizAttempt, QuizAttemptItem } from '../../../data/types'

// ============================================================
//  practiceStreak / practiceHeatmap / syncMistakesFromAttempt
//  ------------------------------------------------------------
//  重點：日期分桶必須用「本地時區」key（對齊 calendar/util.ts 同
//  practiceHeatmap），因為 createdAt 由 Runner.tsx 以
//  new Date().toISOString() 寫入（帶 Z 嘅 UTC ISO）。
//  直接 slice ISO 係 UTC，凌晨做題會塌落前一日。
//  本測試機係 Asia/Hong_Kong (UTC+8)，故凌晨本地時間嘅 UTC slice
//  會退一日，可實測揭發 bug。
// ============================================================

// ── 小工具 ──
const pad2 = (n: number) => String(n).padStart(2, '0')

// 本地牆鐘時間 → createdAt（仿 Runner.tsx：new Date(...).toISOString()）
// month 用 1-based 方便讀。
const localISO = (y: number, mo: number, d: number, h = 12, mi = 0): string =>
  new Date(y, mo - 1, d, h, mi, 0).toISOString()

// 本地日期 key（測試自算預期值用）
const localKey = (y: number, mo: number, d: number): string =>
  `${y}-${pad2(mo)}-${pad2(d)}`

const attempt = (over: Partial<QuizAttempt>): QuizAttempt => ({
  id: 'a',
  createdAt: localISO(2026, 5, 4, 10),
  mode: 'learning',
  title: 't',
  topicIds: [],
  difficulty: 'all',
  total: 1,
  correctCount: 1,
  durationSec: 60,
  items: [],
  ...over,
})

const item = (over: Partial<QuizAttemptItem>): QuizAttemptItem => ({
  questionId: 'q',
  topicId: 't',
  difficulty: 'easy',
  stem: '題目',
  options: ['A', 'B'],
  answerIndex: 0,
  selectedIndex: 0,
  correct: true,
  ...over,
})

// ============================================================
describe('practiceStreak — best（歷來最長連續日數）', () => {
  it('空 attempts → {current:0, best:0}', () => {
    expect(practiceStreak([])).toEqual({ current: 0, best: 0 })
  })

  it('單一 attempt（非今日/昨日）→ best=1，current=0', () => {
    // 2026-01-10 距離「今日」好遠 → current 不接上
    const a = attempt({ createdAt: localISO(2026, 1, 10, 12) })
    expect(practiceStreak([a])).toEqual({ current: 0, best: 1 })
  })

  it('同一本地日多次 attempt（去重後只算一日）→ best=1', () => {
    const a1 = attempt({ id: 'a1', createdAt: localISO(2026, 1, 10, 9) })
    const a2 = attempt({ id: 'a2', createdAt: localISO(2026, 1, 10, 14) })
    const a3 = attempt({ id: 'a3', createdAt: localISO(2026, 1, 10, 22) })
    expect(practiceStreak([a1, a2, a3]).best).toBe(1)
  })

  it('連續三日 → best=3（亂序輸入亦穩定）', () => {
    const a = [
      attempt({ id: 'a3', createdAt: localISO(2026, 1, 12, 10) }),
      attempt({ id: 'a1', createdAt: localISO(2026, 1, 10, 10) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 1, 11, 10) }),
    ]
    expect(practiceStreak(a).best).toBe(3)
  })

  it('斷一日後重開 → best 取較長一段', () => {
    // 連續 01-10,11,12（3 日），斷 01-13，再 01-14,15（2 日）→ best=3
    const a = [10, 11, 12, 14, 15].map((d, i) =>
      attempt({ id: `a${i}`, createdAt: localISO(2026, 1, d, 10) }),
    )
    expect(practiceStreak(a).best).toBe(3)
  })

  it('跨月連續（01-31 → 02-01）→ best=2', () => {
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 1, 31, 10) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 2, 1, 10) }),
    ]
    expect(practiceStreak(a).best).toBe(2)
  })

  it('跨年連續（12-31 → 01-01）→ best=2', () => {
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2025, 12, 31, 10) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 1, 1, 10) }),
    ]
    expect(practiceStreak(a).best).toBe(2)
  })
})

// ============================================================
describe('practiceStreak — current（由今日/昨日往回連續），用 fake timer 釘死「今日」', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // 釘死「今日」= 本地 2026-05-31 中午（避開時區邊界）
  const pinToday = () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0))
  }

  it('今日有做 + 連續往回三日 → current=3', () => {
    pinToday()
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 29, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 30, 9) }),
      attempt({ id: 'a3', createdAt: localISO(2026, 5, 31, 9) }),
    ]
    expect(practiceStreak(a).current).toBe(3)
  })

  it('今日無做但昨日有 → current 由昨日起算', () => {
    pinToday()
    // 昨日 05-30 + 前日 05-29，今日 05-31 無做 → current=2
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 29, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 30, 9) }),
    ]
    expect(practiceStreak(a).current).toBe(2)
  })

  it('今日無做、昨日亦無做 → current=0（但 best 仍保留）', () => {
    pinToday()
    // 最近一次係 05-28（前日），今日/昨日皆無 → current=0
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 27, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 28, 9) }),
    ]
    expect(practiceStreak(a)).toEqual({ current: 0, best: 2 })
  })

  it('斷一日後 current 應歸零、best 保留', () => {
    pinToday()
    // 今日 05-31 有做，但 05-30 無做（斷），之前 05-27/28/29 連 3 日
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 27, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 28, 9) }),
      attempt({ id: 'a3', createdAt: localISO(2026, 5, 29, 9) }),
      attempt({ id: 'a4', createdAt: localISO(2026, 5, 31, 9) }),
    ]
    // current 由今日 05-31 往回：05-30 缺 → current=1；best=3
    expect(practiceStreak(a)).toEqual({ current: 1, best: 3 })
  })

  it('current 回溯跨月正確（今日 06-01、昨日 05-31…）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 1, 12, 0, 0)) // 本地 2026-06-01 中午
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 30, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 31, 9) }),
      attempt({ id: 'a3', createdAt: localISO(2026, 6, 1, 9) }),
    ]
    // 06-01 → 05-31 → 05-30 連續 → current=3
    expect(practiceStreak(a).current).toBe(3)
  })
})

// ============================================================
describe('practiceStreak — [bug] 凌晨做題本地分桶（UTC slice 會塌日）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // 揭發 bug #1（days set 用 UTC slice）：
  // 本測試機 HKT(UTC+8)，本地早上時間嘅 UTC slice 會落前一日。
  // 三個連續本地日，若用 UTC slice 會塌成兩日，令 best 被低估。
  it('三個連續本地日，凌晨做題仍應算連續 3 日（best=3）', () => {
    // 本地 05-29 09:00 / 05-30 01:00 / 05-31 01:00（凌晨）。
    // 在 HKT，05-30 01:00 與 05-31 01:00 嘅 UTC 係前一日 17:00，
    // 舊 code slice 後 → {05-29, 05-30} 兩日（best 被低估成 2）。
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 29, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 30, 1) }),
      attempt({ id: 'a3', createdAt: localISO(2026, 5, 31, 1) }),
    ]
    // 確認 fixture 真係踩到 HKT 塌日情境（否則此測試在其他 TZ 無意義）
    const utcDays = new Set(a.map((x) => x.createdAt.slice(0, 10)))
    const localDays = new Set(
      a.map((x) => {
        const d = new Date(x.createdAt)
        return localKey(d.getFullYear(), d.getMonth() + 1, d.getDate())
      }),
    )
    // 在 UTC+8（含其他正偏移 TZ）UTC 桶會少過本地桶；以此確保測試有意義。
    expect(localDays.size).toBe(3)
    // 正確行為：3 個連續本地日 → best=3
    expect(practiceStreak(a).best).toBe(3)
    // 順帶確認 fixture 確實會令舊 UTC-slice 法塌成 2 日（守住回歸方向）
    if (utcDays.size < localDays.size) {
      expect(utcDays.size).toBe(2)
    }
  })

  it('current 凌晨做題：今日凌晨 + 連續往回，本地分桶 → current=3', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 1, 30, 0)) // 本地 2026-05-31 01:30（凌晨）
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 29, 9) }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 30, 1) }),
      attempt({ id: 'a3', createdAt: localISO(2026, 5, 31, 1) }),
    ]
    // 今日（本地 05-31）有凌晨做題，連續往回 05-30 / 05-29 → current=3
    expect(practiceStreak(a).current).toBe(3)
  })
})

// ============================================================
describe('practiceHeatmap — 近 N 日每日題數', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const pinToday = () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0)) // 本地 2026-05-31 中午
  }

  it('空 attempts → 全部格 count=0、長度=days', () => {
    pinToday()
    const out = practiceHeatmap([], 7)
    expect(out).toHaveLength(7)
    expect(out.every((c) => c.count === 0)).toBe(true)
  })

  it('days=0 → 空陣列', () => {
    pinToday()
    expect(practiceHeatmap([attempt({})], 0)).toEqual([])
  })

  it('days=1 → 淨係今日一格', () => {
    pinToday()
    const a = attempt({ createdAt: localISO(2026, 5, 31, 9), total: 5 })
    const out = practiceHeatmap([a], 1)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ key: localKey(2026, 5, 31), count: 5 })
  })

  it('輸出順序：最舊→最新（index 0 = days-1 日前，最後 = 今日）', () => {
    pinToday()
    const out = practiceHeatmap([], 3)
    expect(out.map((c) => c.key)).toEqual([
      localKey(2026, 5, 29),
      localKey(2026, 5, 30),
      localKey(2026, 5, 31),
    ])
  })

  it('同一日多次 attempt：累加題數（用 a.total，唔係次數）', () => {
    pinToday()
    const a = [
      attempt({ id: 'a1', createdAt: localISO(2026, 5, 30, 9), total: 3 }),
      attempt({ id: 'a2', createdAt: localISO(2026, 5, 30, 14), total: 4 }),
      attempt({ id: 'a3', createdAt: localISO(2026, 5, 31, 9), total: 10 }),
    ]
    const out = practiceHeatmap(a, 3)
    const byKey = new Map(out.map((c) => [c.key, c.count]))
    expect(byKey.get(localKey(2026, 5, 30))).toBe(7) // 3 + 4（題數加總）
    expect(byKey.get(localKey(2026, 5, 31))).toBe(10)
    expect(byKey.get(localKey(2026, 5, 29))).toBe(0)
  })

  it('窗口外的舊 attempt 唔出現喺輸出', () => {
    pinToday()
    // 05-20 落喺 7 日窗（05-25..05-31）以外
    const a = [
      attempt({ id: 'old', createdAt: localISO(2026, 5, 20, 9), total: 99 }),
      attempt({ id: 'new', createdAt: localISO(2026, 5, 31, 9), total: 2 }),
    ]
    const out = practiceHeatmap(a, 7)
    expect(out).toHaveLength(7)
    expect(out.find((c) => c.key === localKey(2026, 5, 20))).toBeUndefined()
    expect(out.reduce((s, c) => s + c.count, 0)).toBe(2) // 只計窗內
  })

  it('凌晨做題本地分桶要落正確日（非 UTC）', () => {
    pinToday()
    // 本地 05-31 01:00（凌晨）；HKT 嘅 UTC 係 05-30 17:00。
    // 舊 slice 法會落 05-30；正確應落本地 05-31。
    const a = attempt({ createdAt: localISO(2026, 5, 31, 1), total: 6 })
    const out = practiceHeatmap([a], 7)
    const byKey = new Map(out.map((c) => [c.key, c.count]))
    expect(byKey.get(localKey(2026, 5, 31))).toBe(6) // 落本地今日
    expect(byKey.get(localKey(2026, 5, 30))).toBe(0) // 唔好落 UTC 前一日
  })

  it('createdAt 為非法日期 → fallback slice(0,10) 唔擲錯', () => {
    pinToday()
    const a = attempt({ createdAt: 'not-a-date', total: 5 })
    expect(() => practiceHeatmap([a], 7)).not.toThrow()
    const out = practiceHeatmap([a], 7)
    // 非法 key 唔會 match 任何窗格 → 全 0，亦唔崩
    expect(out).toHaveLength(7)
    expect(out.every((c) => c.count === 0)).toBe(true)
  })

  it('跨月回溯時 key 格式正確（補零）', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 2, 12, 0, 0)) // 本地 2026-06-02 中午
    const out = practiceHeatmap([], 5)
    // 06-02 往回 5 格：05-29, 05-30, 05-31, 06-01, 06-02（月/日補零）
    expect(out.map((c) => c.key)).toEqual([
      '2026-05-29',
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
    ])
  })
})

// ============================================================
describe('syncMistakesFromAttempt — 錯題本累加 / 遞減 / 掌握判斷', () => {
  // 模組級 singleton collection；每個 case 前清空以保隔離。
  beforeEach(() => {
    mistakesCol.set([])
  })

  const NOW = '2026-05-31T10:00:00.000Z'

  it('全新答錯題 → 新增 wrongCount=1、mastered=false、lastWrongAt=attempt.createdAt', () => {
    syncMistakesFromAttempt(
      attempt({
        createdAt: NOW,
        items: [item({ questionId: 'q1', correct: false, stem: '題1', topicId: 'T1', difficulty: 'medium' })],
      }),
    )
    const list = mistakesCol.get()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      questionId: 'q1',
      wrongCount: 1,
      mastered: false,
      stem: '題1',
      topicId: 'T1',
      difficulty: 'medium',
      lastWrongAt: NOW, // 用 attempt.createdAt
    })
  })

  it('既有答錯題再錯 → wrongCount 累加、mastered 重置 false', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '舊題幹',
        wrongCount: 2,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: true, // 之前已掌握
        masteredAt: '2026-05-02T00:00:00.000Z',
      },
    ])
    syncMistakesFromAttempt(
      attempt({
        createdAt: NOW,
        items: [item({ questionId: 'q1', correct: false, stem: '新題幹' })],
      }),
    )
    const m = mistakesCol.get()[0]
    expect(m.wrongCount).toBe(3) // 2 + 1
    expect(m.mastered).toBe(false) // 重置
    expect(m.masteredAt).toBeUndefined()
    expect(m.lastWrongAt).toBe(NOW)
    expect(m.stem).toBe('新題幹') // 更新成最新題幹
  })

  it('既有 wrongCount=1 答啱 → next=0 → 即標 mastered（一次即 master）', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '題1',
        wrongCount: 1,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: false,
      },
    ])
    syncMistakesFromAttempt(
      attempt({ createdAt: NOW, items: [item({ questionId: 'q1', correct: true })] }),
    )
    const m = mistakesCol.get()[0]
    expect(m.wrongCount).toBe(0)
    expect(m.mastered).toBe(true)
    expect(m.masteredAt).toBe(NOW)
  })

  it('既有 wrongCount=3 答啱 → wrongCount=2、仍未 master', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '題1',
        wrongCount: 3,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: false,
      },
    ])
    syncMistakesFromAttempt(
      attempt({ createdAt: NOW, items: [item({ questionId: 'q1', correct: true })] }),
    )
    const m = mistakesCol.get()[0]
    expect(m.wrongCount).toBe(2)
    expect(m.mastered).toBe(false)
    expect(m.masteredAt).toBeUndefined()
  })

  it('已 mastered 題再答啱 → 唔郁（existing && !mastered 守衛）', () => {
    const before = {
      id: 'm1',
      questionId: 'q1',
      topicId: 'T1',
      difficulty: 'easy' as const,
      stem: '題1',
      wrongCount: 0,
      lastWrongAt: '2026-05-01T00:00:00.000Z',
      mastered: true,
      masteredAt: '2026-05-02T00:00:00.000Z',
    }
    mistakesCol.set([{ ...before }])
    syncMistakesFromAttempt(
      attempt({ createdAt: NOW, items: [item({ questionId: 'q1', correct: true })] }),
    )
    expect(mistakesCol.get()[0]).toEqual(before) // 完全唔變
  })

  it('已 mastered 題再答錯 → wrongCount+1 且 mastered 重置 false', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '題1',
        wrongCount: 0,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: true,
        masteredAt: '2026-05-02T00:00:00.000Z',
      },
    ])
    syncMistakesFromAttempt(
      attempt({ createdAt: NOW, items: [item({ questionId: 'q1', correct: false })] }),
    )
    const m = mistakesCol.get()[0]
    expect(m.wrongCount).toBe(1) // 0 + 1
    expect(m.mastered).toBe(false)
    expect(m.masteredAt).toBeUndefined()
  })

  it('答啱一條未喺錯題本嘅題 → 唔新增（只跟錯題走）', () => {
    syncMistakesFromAttempt(
      attempt({ createdAt: NOW, items: [item({ questionId: 'qNew', correct: true })] }),
    )
    expect(mistakesCol.get()).toHaveLength(0)
  })

  it('空 items → 錯題本不變', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '題1',
        wrongCount: 2,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: false,
      },
    ])
    const snapshot = JSON.stringify(mistakesCol.get())
    syncMistakesFromAttempt(attempt({ createdAt: NOW, items: [] }))
    expect(JSON.stringify(mistakesCol.get())).toBe(snapshot)
  })

  it('混合 items：一啱一錯各自處理', () => {
    mistakesCol.set([
      {
        id: 'm1',
        questionId: 'q1',
        topicId: 'T1',
        difficulty: 'easy',
        stem: '題1',
        wrongCount: 1,
        lastWrongAt: '2026-05-01T00:00:00.000Z',
        mastered: false,
      },
    ])
    syncMistakesFromAttempt(
      attempt({
        createdAt: NOW,
        items: [
          item({ questionId: 'q1', correct: true }), // 既有 wrongCount=1 答啱 → master
          item({ questionId: 'q2', correct: false, stem: '題2' }), // 新答錯 → 新增
        ],
      }),
    )
    const byQid = new Map(mistakesCol.get().map((m) => [m.questionId, m]))
    expect(byQid.get('q1')).toMatchObject({ wrongCount: 0, mastered: true, masteredAt: NOW })
    expect(byQid.get('q2')).toMatchObject({ wrongCount: 1, mastered: false })
  })
})
