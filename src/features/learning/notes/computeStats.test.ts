import { describe, it, expect } from 'vitest'
import { computeStats } from './util'
import type { RichNote } from './store'

// ============================================================
//  computeStats —— 本功能最重嘅聚合計算（現有 util.test.ts 未覆蓋）
//  ------------------------------------------------------------
//  注意兩套時間計法刻意分開驗：
//    · last7 / prev7：rolling ms 窗（now - createdAt 同 7/14 日比）
//    · daily / activeDays：本地時區 dayKey（getFullYear/Month/Date）
//  所以日期一律相對「執行時嘅 now」用 ms 偏移砌，唔寫死時區。
// ============================================================

const DAY = 86_400_000

// 最小 RichNote 工廠（其餘欄位安全預設）
const note = (over: Partial<RichNote> & { content: string }): RichNote => ({
  id: over.id ?? 'n',
  title: over.title ?? '',
  content: over.content,
  notebookId: over.notebookId ?? null,
  pinned: over.pinned ?? false,
  favorite: over.favorite ?? false,
  archived: over.archived ?? false,
  trashed: over.trashed ?? false,
  color: over.color ?? 'none',
  createdAt: over.createdAt ?? '2026-01-01T00:00:00.000Z',
  updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
})

// 同 util.ts 內部一致嘅本地 dayKey（複製計法，唔依賴 UTC）
function localDayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isoAgo = (ms: number) => new Date(Date.now() - ms).toISOString()

// ───────────────────── 空陣列邊界 ─────────────────────
describe('computeStats — 空陣列', () => {
  const s = computeStats([], [])

  it('total / 計數類全 0', () => {
    expect(s.total).toBe(0)
    expect(s.pinned).toBe(0)
    expect(s.favorite).toBe(0)
    expect(s.archived).toBe(0)
    expect(s.trashed).toBe(0)
  })

  it('totalWords = 0、avgWords 防除零 = 0（唔係 NaN）', () => {
    expect(s.totalWords).toBe(0)
    expect(s.avgWords).toBe(0)
    expect(Number.isNaN(s.avgWords)).toBe(false)
  })

  it('待辦 0/0、標籤 0、活躍日數 0、last7/prev7 = 0', () => {
    expect(s.todoTotal).toBe(0)
    expect(s.todoDone).toBe(0)
    expect(s.tagCount).toBe(0)
    expect(s.activeDays).toBe(0)
    expect(s.last7).toBe(0)
    expect(s.prev7).toBe(0)
  })

  it('daily 仍係 30 格、全部 count = 0', () => {
    expect(s.daily).toHaveLength(30)
    expect(s.daily.every((d) => d.count === 0)).toBe(true)
  })

  it('topTags / notebookDist 為空', () => {
    expect(s.topTags).toEqual([])
    expect(s.notebookDist).toEqual([])
  })
})

// ───────────────────── 基本聚合 ─────────────────────
describe('computeStats — 基本聚合', () => {
  it('totalWords = 各篇 wordCount 之和；avgWords = Math.round 平均', () => {
    // 內容只用「今日」時間（落 daily/last7），純驗字數聚合
    const today = isoAgo(0)
    const notes = [
      note({ id: 'a', content: '市場營銷', createdAt: today, updatedAt: today }), // 4
      note({ id: 'b', content: '一二三四五', createdAt: today, updatedAt: today }), // 5
    ]
    const s = computeStats(notes, notes)
    expect(s.totalWords).toBe(9)
    // 9 / 2 = 4.5 → Math.round = 5（向上）
    expect(s.avgWords).toBe(5)
  })

  it('avgWords 用 Math.round（4.4 → 4，驗四捨五入方向）', () => {
    const today = isoAgo(0)
    // 三篇：4 + 4 + 5 = 13；13/3 = 4.333… → round = 4
    const notes = [
      note({ id: 'a', content: '一二三四', createdAt: today, updatedAt: today }),
      note({ id: 'b', content: '一二三四', createdAt: today, updatedAt: today }),
      note({ id: 'c', content: '一二三四五', createdAt: today, updatedAt: today }),
    ]
    expect(computeStats(notes, notes).avgWords).toBe(4)
  })

  it('待辦 total/done 跨多篇累加', () => {
    const today = isoAgo(0)
    const notes = [
      note({ id: 'a', content: '- [x] 做咗\n- [ ] 未做', createdAt: today, updatedAt: today }),
      note({ id: 'b', content: '* [X] 大寫已完成', createdAt: today, updatedAt: today }),
    ]
    const s = computeStats(notes, notes)
    expect(s.todoTotal).toBe(3)
    expect(s.todoDone).toBe(2)
  })

  it('pinned / favorite 由 active 計', () => {
    const today = isoAgo(0)
    const notes = [
      note({ id: 'a', content: 'x', pinned: true, favorite: true, createdAt: today, updatedAt: today }),
      note({ id: 'b', content: 'y', pinned: true, createdAt: today, updatedAt: today }),
      note({ id: 'c', content: 'z', createdAt: today, updatedAt: today }),
    ]
    const s = computeStats(notes, notes)
    expect(s.total).toBe(3)
    expect(s.pinned).toBe(2)
    expect(s.favorite).toBe(1)
  })
})

// ───────── archived / trashed 由 all 計，active 只計非封存非垃圾 ─────────
describe('computeStats — archived / trashed 由 all 計', () => {
  it('archived 只數 archived && !trashed；trashed 數全部 trashed', () => {
    const today = isoAgo(0)
    const live = note({ id: 'live', content: 'a', createdAt: today, updatedAt: today })
    const arch = note({ id: 'arch', content: 'b', archived: true, createdAt: today, updatedAt: today })
    const trash = note({ id: 'trash', content: 'c', trashed: true, createdAt: today, updatedAt: today })
    // 同時 archived + trashed → 只算入 trashed，唔算 archived
    const both = note({ id: 'both', content: 'd', archived: true, trashed: true, createdAt: today, updatedAt: today })
    const all = [live, arch, trash, both]
    const active = [live] // 呼叫端負責過濾；只傳活躍

    const s = computeStats(active, all)
    expect(s.total).toBe(1) // active 只得 1
    expect(s.archived).toBe(1) // 只 arch（both 因 trashed 被排除）
    expect(s.trashed).toBe(2) // trash + both
  })
})

// ───────────────── last7 / prev7 rolling ms 窗邊界 ─────────────────
describe('computeStats — last7 / prev7 rolling 窗', () => {
  it('age 剛好 == 7d：唔入 last7、入 prev7', () => {
    // 比 7d 老少少（+1 分鐘）避免同函式內部 now 嘅微小落差造成翻來覆去
    const n = note({ id: 'x', content: 'x', createdAt: isoAgo(7 * DAY + 60_000) })
    const s = computeStats([n], [n])
    expect(s.last7).toBe(0)
    expect(s.prev7).toBe(1)
  })

  it('age == 14d：兩個窗都跌出', () => {
    const n = note({ id: 'x', content: 'x', createdAt: isoAgo(14 * DAY + 60_000) })
    const s = computeStats([n], [n])
    expect(s.last7).toBe(0)
    expect(s.prev7).toBe(0)
  })

  it('age 略少於 7d：入 last7、唔入 prev7', () => {
    const n = note({ id: 'x', content: 'x', createdAt: isoAgo(7 * DAY - 60_000) })
    const s = computeStats([n], [n])
    expect(s.last7).toBe(1)
    expect(s.prev7).toBe(0)
  })

  it('createdAt 喺未來（時鐘偏差，age < 0 < 7d）→ 仍計入 last7', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const n = note({ id: 'x', content: 'x', createdAt: future })
    const s = computeStats([n], [n])
    expect(s.last7).toBe(1)
    expect(s.prev7).toBe(0)
  })

  it('混合：3 篇分別落 last7 / prev7 / 更舊', () => {
    const inLast = note({ id: 'a', content: 'a', createdAt: isoAgo(2 * DAY) })
    const inPrev = note({ id: 'b', content: 'b', createdAt: isoAgo(10 * DAY) })
    const older = note({ id: 'c', content: 'c', createdAt: isoAgo(20 * DAY) })
    const notes = [inLast, inPrev, older]
    const s = computeStats(notes, notes)
    expect(s.last7).toBe(1)
    expect(s.prev7).toBe(1)
  })
})

// ─────────────── daily（本地 dayKey）30 日 inclusive 窗 ───────────────
describe('computeStats — daily 30 日逐日新增', () => {
  it('daily 永遠 30 格、末格係今日、首格係倒數第 29 日', () => {
    const s = computeStats([], [])
    expect(s.daily).toHaveLength(30)
    const now = Date.now()
    expect(s.daily[29].key).toBe(localDayKey(now))
    expect(s.daily[0].key).toBe(localDayKey(now - 29 * DAY))
  })

  it('label = 月/日（本地）', () => {
    const s = computeStats([], [])
    const d = new Date()
    expect(s.daily[29].label).toBe(`${d.getMonth() + 1}/${d.getDate()}`)
  })

  it('createdAt 落對應本地 day 格；同日兩篇 → count 累加', () => {
    // 用「今日中午」避免午夜邊界令本地 day 同 UTC day 唔同步嘅歧義
    const noonToday = new Date()
    noonToday.setHours(12, 0, 0, 0)
    const iso = noonToday.toISOString()
    const notes = [
      note({ id: 'a', content: 'a', createdAt: iso, updatedAt: iso }),
      note({ id: 'b', content: 'b', createdAt: iso, updatedAt: iso }),
    ]
    const s = computeStats(notes, notes)
    const todayCell = s.daily.find((c) => c.key === localDayKey(noonToday.getTime()))
    expect(todayCell?.count).toBe(2)
    // 其餘格仍係 0
    const sum = s.daily.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(2)
  })

  it('createdAt 早過 30 日窗 → 唔出現喺任何 daily 格', () => {
    const old = note({ id: 'a', content: 'a', createdAt: isoAgo(40 * DAY) })
    const s = computeStats([old], [old])
    const sum = s.daily.reduce((acc, c) => acc + c.count, 0)
    expect(sum).toBe(0)
  })
})

// ─────────────── activeDays（create + update 本地日，30 日內）───────────────
describe('computeStats — activeDays', () => {
  it('同一篇 createdAt 同 updatedAt 同一日 → 只當一日', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const iso = noon.toISOString()
    const n = note({ id: 'a', content: 'a', createdAt: iso, updatedAt: iso })
    expect(computeStats([n], [n]).activeDays).toBe(1)
  })

  it('createdAt 同 updatedAt 分散兩日（都喺 30 日內）→ 計兩日', () => {
    const created = new Date()
    created.setHours(12, 0, 0, 0)
    created.setTime(created.getTime() - 5 * DAY) // 5 日前中午
    const updated = new Date()
    updated.setHours(12, 0, 0, 0) // 今日中午
    const n = note({
      id: 'a',
      content: 'a',
      createdAt: created.toISOString(),
      updatedAt: updated.toISOString(),
    })
    expect(computeStats([n], [n]).activeDays).toBe(2)
  })

  it('createdAt/updatedAt 都早過 30 日窗 → activeDays = 0', () => {
    const old = isoAgo(40 * DAY)
    const n = note({ id: 'a', content: 'a', createdAt: old, updatedAt: old })
    expect(computeStats([n], [n]).activeDays).toBe(0)
  })

  it('兩篇活躍喺同一日 → activeDays 仍只當一日（用 Set 去重）', () => {
    const noon = new Date()
    noon.setHours(12, 0, 0, 0)
    const iso = noon.toISOString()
    const notes = [
      note({ id: 'a', content: 'a', createdAt: iso, updatedAt: iso }),
      note({ id: 'b', content: 'b', createdAt: iso, updatedAt: iso }),
    ]
    expect(computeStats(notes, notes).activeDays).toBe(1)
  })
})

// ───────────────── topTags / tagCount / notebookDist ─────────────────
describe('computeStats — 標籤與筆記本分佈', () => {
  it('topTags 取前 8（標籤多過 8 時截斷）；tagCount 係全部去重總數', () => {
    const today = isoAgo(0)
    // 砌 10 個唯一標籤，各出現次數遞減以保證排序穩定可預期
    // tag i 出現 (10 - i) 次（i = 0..9）→ tag0 最多、tag9 最少
    const notes: RichNote[] = []
    for (let i = 0; i < 10; i++) {
      for (let r = 0; r < 10 - i; r++) {
        notes.push(
          note({ id: `t${i}-${r}`, content: `#tag${i}`, createdAt: today, updatedAt: today }),
        )
      }
    }
    const s = computeStats(notes, notes)
    expect(s.tagCount).toBe(10) // 全部唯一標籤數
    expect(s.topTags).toHaveLength(8) // 截前 8
    expect(s.topTags[0]).toEqual({ tag: 'tag0', count: 10 })
    expect(s.topTags[7]).toEqual({ tag: 'tag7', count: 3 })
    // tag8 / tag9 被截走
    expect(s.topTags.some((t) => t.tag === 'tag8')).toBe(false)
  })

  it('notebookId = null → 歸入 "__none__" 一籃；多個 null 累加', () => {
    const today = isoAgo(0)
    const notes = [
      note({ id: 'a', content: 'a', notebookId: null, createdAt: today, updatedAt: today }),
      note({ id: 'b', content: 'b', notebookId: null, createdAt: today, updatedAt: today }),
      note({ id: 'c', content: 'c', notebookId: 'nb-x', createdAt: today, updatedAt: today }),
    ]
    const s = computeStats(notes, notes)
    const none = s.notebookDist.find((d) => d.id === '__none__')
    const nbx = s.notebookDist.find((d) => d.id === 'nb-x')
    expect(none?.count).toBe(2)
    expect(nbx?.count).toBe(1)
    expect(s.notebookDist).toHaveLength(2)
  })
})
