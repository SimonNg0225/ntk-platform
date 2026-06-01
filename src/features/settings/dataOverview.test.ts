import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  summarizeData,
  backupAgeDays,
  formatBackupReminder,
  COLLECTION_LABELS,
} from './dataOverview'

// ============================================================
//  我的資料一覽 + 上次備份提醒 — 純函式測試
//  ------------------------------------------------------------
//  summarizeData：純由輸入物件推導，唔讀「此刻」，唔使 fake timers。
//  backupAgeDays / formatBackupReminder：相對「今日」嘅日曆日差，故跟 repo
//  其他時間相依 test（notes/relativeTime.test.ts 等）用 vi.setSystemTime 鎖死
//  此刻；vitest.config 已全域 pin TZ=Asia/Hong_Kong，故「本地午夜」穩定。
// ============================================================

describe('summarizeData', () => {
  it('空 / 非物件 → 空 rows、total 0、nonEmpty 0', () => {
    for (const bad of [null, undefined, {}]) {
      const o = summarizeData(bad as never)
      expect(o.rows).toEqual([])
      expect(o.total).toBe(0)
      expect(o.nonEmpty).toBe(0)
    }
  })

  it('只計值係陣列嘅 key（非陣列／壞值忽略，同 importAllData 守衞一致）', () => {
    const o = summarizeData({
      learning_notes: [{ id: 'a' }, { id: 'b' }],
      questions: 'not-an-array', // 忽略
      scores: 123, // 忽略
      decks: null, // 忽略
      cards: [{ id: 'c' }],
    } as never)
    // 只剩 learning_notes(2) + cards(1)
    expect(o.rows.map((r) => r.key)).toEqual(['learning_notes', 'cards'])
    expect(o.total).toBe(3)
    expect(o.nonEmpty).toBe(2)
  })

  it('總筆數 = 各集合筆數總和（含空集合計入 total=0 部分）', () => {
    const o = summarizeData({
      learning_notes: [{ id: '1' }, { id: '2' }, { id: '3' }],
      questions: [{ id: 'q1' }],
      students: [], // 空：計入 rows 但唔加 total
    } as never)
    expect(o.total).toBe(4)
    expect(o.nonEmpty).toBe(2)
    expect(o.rows).toHaveLength(3)
  })

  it('排序：有資料行排喺空行之前', () => {
    const o = summarizeData({
      students: [], // 空
      learning_notes: [{ id: '1' }], // 有料
    } as never)
    expect(o.rows[0].key).toBe('learning_notes')
    expect(o.rows[1].key).toBe('students')
    expect(o.rows[1].count).toBe(0)
  })

  it('排序：有資料行之間按筆數降序', () => {
    const o = summarizeData({
      questions: [{ id: '1' }], // 1
      learning_notes: [{ id: '1' }, { id: '2' }, { id: '3' }], // 3
      cards: [{ id: '1' }, { id: '2' }], // 2
    } as never)
    expect(o.rows.map((r) => r.count)).toEqual([3, 2, 1])
    expect(o.rows.map((r) => r.key)).toEqual([
      'learning_notes',
      'cards',
      'questions',
    ])
  })

  it('同筆數用標籤穩定 tiebreak（次序可預期，唔受輸入 key 次序影響）', () => {
    // questions(條) 同 cards(張) 都係 1 筆；按中文標籤排序，次序固定。
    const a = summarizeData({ questions: [{ id: 'q' }], cards: [{ id: 'c' }] } as never)
    const b = summarizeData({ cards: [{ id: 'c' }], questions: [{ id: 'q' }] } as never)
    expect(a.rows.map((r) => r.key)).toEqual(b.rows.map((r) => r.key))
  })

  it('已知 key 帶友好標籤 + 量詞；未知 key fallback（label=key、unit=項）', () => {
    const o = summarizeData({
      learning_notes: [{ id: '1' }],
      __mystery_feature__: [{ id: 'x' }, { id: 'y' }],
    } as never)
    const notes = o.rows.find((r) => r.key === 'learning_notes')!
    expect(notes.label).toBe('筆記')
    expect(notes.unit).toBe('篇')
    const mystery = o.rows.find((r) => r.key === '__mystery_feature__')!
    expect(mystery.label).toBe('__mystery_feature__') // fallback = key 本身
    expect(mystery.unit).toBe('項') // 預設量詞
  })

  it('COLLECTION_LABELS 每項都有非空 label', () => {
    for (const meta of Object.values(COLLECTION_LABELS)) {
      expect(typeof meta.label).toBe('string')
      expect(meta.label.length).toBeGreaterThan(0)
    }
  })
})

// 本地 2026-06-02 12:00（中午錨點，避開任何日界 off-by-one）
const TODAY = new Date(2026, 5, 2, 12, 0, 0)

describe('backupAgeDays（now = 本地 2026-06-02 12:00）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('無時間戳 / 空字串 / 無效 → null', () => {
    expect(backupAgeDays(null)).toBeNull()
    expect(backupAgeDays(undefined)).toBeNull()
    expect(backupAgeDays('')).toBeNull()
    expect(backupAgeDays('not-a-date')).toBeNull()
  })

  it('用日曆日差：今日稍早備份 → 0（唔係 24 小時整除）', () => {
    // 今朝 08:00 備份，而家中午 → 同一日曆日 → 0
    expect(backupAgeDays(new Date(2026, 5, 2, 8, 0, 0).toISOString())).toBe(0)
    // 今日凌晨剛過 00:01 都係 0
    expect(backupAgeDays(new Date(2026, 5, 2, 0, 1, 0).toISOString())).toBe(0)
  })

  it('尋日任何時間 → 1', () => {
    expect(backupAgeDays(new Date(2026, 5, 1, 23, 59, 0).toISOString())).toBe(1)
    expect(backupAgeDays(new Date(2026, 5, 1, 0, 0, 0).toISOString())).toBe(1)
  })

  it('3 個日曆日前 → 3', () => {
    expect(backupAgeDays(new Date(2026, 4, 30, 12, 0, 0).toISOString())).toBe(3)
  })

  it('跨月邊界正常（5/30 → 6/2 = 3 日）', () => {
    expect(backupAgeDays(new Date(2026, 4, 30, 9, 0, 0).toISOString())).toBe(3)
  })

  it('未來時間戳（多機時鐘偏差）clamp 到 0', () => {
    expect(backupAgeDays(new Date(2026, 5, 5, 12, 0, 0).toISOString())).toBe(0)
  })
})

describe('formatBackupReminder（now = 本地 2026-06-02 12:00）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('從未備份 → never + stale，文案「未試過匯出備份」', () => {
    const r = formatBackupReminder(null)
    expect(r.never).toBe(true)
    expect(r.stale).toBe(true)
    expect(r.ageDays).toBeNull()
    expect(r.text).toBe('未試過匯出備份')
  })

  it('今日已備份 → 唔 stale、文案「今日已備份」', () => {
    const r = formatBackupReminder(new Date(2026, 5, 2, 8, 0, 0).toISOString())
    expect(r.never).toBe(false)
    expect(r.stale).toBe(false)
    expect(r.ageDays).toBe(0)
    expect(r.text).toBe('今日已備份')
  })

  it('尋日 → 文案「上次備份：尋日」、唔 stale', () => {
    const r = formatBackupReminder(new Date(2026, 5, 1, 10, 0, 0).toISOString())
    expect(r.ageDays).toBe(1)
    expect(r.text).toBe('上次備份：尋日')
    expect(r.stale).toBe(false)
  })

  it('3 日前 → 文案「上次備份：3 日前」、唔 stale（< 預設 7）', () => {
    const r = formatBackupReminder(new Date(2026, 4, 30, 12, 0, 0).toISOString())
    expect(r.text).toBe('上次備份：3 日前')
    expect(r.stale).toBe(false)
  })

  it('剛好 staleDays（預設 7）→ stale（>= 邊界）', () => {
    const r = formatBackupReminder(new Date(2026, 4, 26, 12, 0, 0).toISOString())
    expect(r.ageDays).toBe(7)
    expect(r.text).toBe('上次備份：7 日前')
    expect(r.stale).toBe(true)
  })

  it('6 日前（差 staleDays 1 日）→ 未 stale', () => {
    const r = formatBackupReminder(new Date(2026, 4, 27, 12, 0, 0).toISOString())
    expect(r.ageDays).toBe(6)
    expect(r.stale).toBe(false)
  })

  it('自訂 staleDays：3 日門檻下，3 日前 → stale', () => {
    const r = formatBackupReminder(
      new Date(2026, 4, 30, 12, 0, 0).toISOString(),
      Date.now(),
      3,
    )
    expect(r.ageDays).toBe(3)
    expect(r.stale).toBe(true)
  })
})
