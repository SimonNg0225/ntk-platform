import { describe, it, expect } from 'vitest'
import { toDraft, buildQuickAddPrompt, type ParsedDraft } from './parse'

// ============================================================
//  快速加入 — 解析引擎純函式測試
//  ------------------------------------------------------------
//  只測 toDraft（純函數）+ buildQuickAddPrompt（純字串組裝）。
//  **刻意唔 call parseQuickAdd / complete()** —— 唔掂網絡 / AI。
//  預期值由 spec 規則人手推導：
//    · kind 白名單 {task,countdown,event}，唔啱 → 'task'
//    · title trim 後必須非空，否則 → null
//    · date 必須真實 YYYY-MM-DD，否則 undefined
//    · time/endTime 正規化 24h HH:mm（補零），否則 undefined
//    · category 限 exam|deadline|assessment|event|other
//    · event 缺 time 仍可（allDay 留俾寫入層）
//  today 統一用一個固定值（toDraft 目前唔依賴佢做正規化）。
// ============================================================

const TODAY = '2026-06-03'

describe('toDraft — 三類正常路徑', () => {
  it('event：有明確時間 → kind=event、time 正規化', () => {
    const raw = {
      kind: 'event',
      title: '同 5A 家長開會',
      date: '2026-06-10',
      time: '15:00',
      endTime: null,
      category: null,
      notes: null,
    }
    expect(toDraft(raw, 'work', TODAY)).toEqual<ParsedDraft>({
      kind: 'event',
      title: '同 5A 家長開會',
      date: '2026-06-10',
      time: '15:00',
      mode: 'work',
    })
  })

  it('event：有時段（time + endTime 都齊）', () => {
    const raw = {
      kind: 'event',
      title: '工作坊',
      date: '2026-06-11',
      time: '14:00',
      endTime: '16:00',
    }
    expect(toDraft(raw, 'work', TODAY)).toEqual<ParsedDraft>({
      kind: 'event',
      title: '工作坊',
      date: '2026-06-11',
      time: '14:00',
      endTime: '16:00',
      mode: 'work',
    })
  })

  it('countdown：有死線日子 → kind=countdown、保留 category', () => {
    const raw = {
      kind: 'countdown',
      title: '提交專題報告',
      date: '2026-06-20',
      time: null,
      endTime: null,
      category: 'deadline',
      notes: null,
    }
    expect(toDraft(raw, 'work', TODAY)).toEqual<ParsedDraft>({
      kind: 'countdown',
      title: '提交專題報告',
      date: '2026-06-20',
      category: 'deadline',
      mode: 'work',
    })
  })

  it('task：無日期純做嘅事 → kind=task、無 date/time', () => {
    const raw = {
      kind: 'task',
      title: '影印筆記',
      date: null,
      time: null,
      endTime: null,
      category: null,
      notes: null,
    }
    expect(toDraft(raw, 'learning', TODAY)).toEqual<ParsedDraft>({
      kind: 'task',
      title: '影印筆記',
      mode: 'learning',
    })
  })

  it('相對日期已由上游解成絕對日期 → 原樣通過', () => {
    // 「下星期三」假設 AI 已解成 2026-06-10；toDraft 只校驗格式
    const raw = { kind: 'event', title: '開會', date: '2026-06-10', time: '15:00' }
    const d = toDraft(raw, 'work', TODAY)
    expect(d?.date).toBe('2026-06-10')
    expect(d?.kind).toBe('event')
  })

  it('mode 由參數帶入（唔睇 raw）', () => {
    const raw = { kind: 'task', title: '跟進家長電郵', mode: 'work' }
    expect(toDraft(raw, 'learning', TODAY)?.mode).toBe('learning')
  })

  it('notes 非空會保留並 trim', () => {
    const raw = { kind: 'task', title: '買文具', notes: '  要 A4 紙  ' }
    expect(toDraft(raw, 'work', TODAY)?.notes).toBe('要 A4 紙')
  })
})

describe('toDraft — kind 校驗', () => {
  it('未知 kind → fallback 做 task', () => {
    const raw = { kind: 'meeting', title: '某事' }
    expect(toDraft(raw, 'work', TODAY)?.kind).toBe('task')
  })

  it('缺 kind 欄位 → fallback 做 task', () => {
    expect(toDraft({ title: '某事' }, 'work', TODAY)?.kind).toBe('task')
  })

  it('kind 大細階唔敏感（"Event" → event）', () => {
    const raw = { kind: 'Event', title: '開會', date: '2026-06-10', time: '09:00' }
    expect(toDraft(raw, 'work', TODAY)?.kind).toBe('event')
  })

  it('kind 非字串（數字）→ fallback task', () => {
    expect(toDraft({ kind: 3, title: 'x' }, 'work', TODAY)?.kind).toBe('task')
  })
})

describe('toDraft — title 必填', () => {
  it('缺 title → null', () => {
    expect(toDraft({ kind: 'task' }, 'work', TODAY)).toBeNull()
  })

  it('title 空字串 → null', () => {
    expect(toDraft({ kind: 'task', title: '' }, 'work', TODAY)).toBeNull()
  })

  it('title 純空白 → null', () => {
    expect(toDraft({ kind: 'task', title: '   ' }, 'work', TODAY)).toBeNull()
  })

  it('title 非字串（數字）→ null', () => {
    expect(toDraft({ kind: 'task', title: 123 }, 'work', TODAY)).toBeNull()
  })

  it('title 前後空白會 trim', () => {
    expect(toDraft({ kind: 'task', title: '  影印  ' }, 'work', TODAY)?.title).toBe(
      '影印',
    )
  })
})

describe('toDraft — date 正規化', () => {
  it('合法 YYYY-MM-DD 保留', () => {
    expect(toDraft({ kind: 'countdown', title: 'x', date: '2026-12-31' }, 'work', TODAY)?.date).toBe(
      '2026-12-31',
    )
  })

  it('AI 吐字串 "null" → undefined（唔當合法日期）', () => {
    expect(
      toDraft({ kind: 'task', title: 'x', date: 'null' }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })

  it('非日期字串 → undefined', () => {
    expect(
      toDraft({ kind: 'task', title: 'x', date: '聽日' }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })

  it('唔合法月份（2026-13-01）→ undefined', () => {
    expect(
      toDraft({ kind: 'countdown', title: 'x', date: '2026-13-01' }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })

  it('唔合法日子（2026-02-30）→ undefined', () => {
    expect(
      toDraft({ kind: 'countdown', title: 'x', date: '2026-02-30' }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })

  it('非零填充格式（2026-6-3）→ undefined（要求嚴格 YYYY-MM-DD）', () => {
    expect(
      toDraft({ kind: 'countdown', title: 'x', date: '2026-6-3' }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })

  it('date 為 null（JSON null）→ undefined', () => {
    expect(
      toDraft({ kind: 'task', title: 'x', date: null }, 'work', TODAY)?.date,
    ).toBeUndefined()
  })
})

describe('toDraft — time / endTime 正規化', () => {
  it('HH:mm 保留', () => {
    expect(
      toDraft({ kind: 'event', title: 'x', date: '2026-06-10', time: '09:30' }, 'work', TODAY)?.time,
    ).toBe('09:30')
  })

  it('H:mm 補前導零（9:05 → 09:05）', () => {
    expect(
      toDraft({ kind: 'event', title: 'x', date: '2026-06-10', time: '9:05' }, 'work', TODAY)?.time,
    ).toBe('09:05')
  })

  it('唔合法鐘數（25:00）→ undefined', () => {
    expect(
      toDraft({ kind: 'event', title: 'x', date: '2026-06-10', time: '25:00' }, 'work', TODAY)?.time,
    ).toBeUndefined()
  })

  it('唔合法分鐘（10:75）→ undefined', () => {
    expect(
      toDraft({ kind: 'event', title: 'x', date: '2026-06-10', time: '10:75' }, 'work', TODAY)?.time,
    ).toBeUndefined()
  })

  it('AI 吐 "null" 時間 → undefined', () => {
    expect(
      toDraft({ kind: 'event', title: 'x', date: '2026-06-10', time: 'null' }, 'work', TODAY)?.time,
    ).toBeUndefined()
  })

  it('event 缺 time 仍可（draft 成立、time undefined）', () => {
    const d = toDraft({ kind: 'event', title: '全日活動', date: '2026-06-10' }, 'work', TODAY)
    expect(d).not.toBeNull()
    expect(d?.kind).toBe('event')
    expect(d?.time).toBeUndefined()
  })

  it('endTime 正規化獨立於 time', () => {
    const d = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', time: '14:00', endTime: '6:00' },
      'work',
      TODAY,
    )
    expect(d?.endTime).toBe('06:00')
  })
})

describe('toDraft — category 校驗', () => {
  it('合法 category（exam）保留', () => {
    expect(
      toDraft({ kind: 'countdown', title: 'x', date: '2026-06-10', category: 'exam' }, 'work', TODAY)
        ?.category,
    ).toBe('exam')
  })

  it.each(['deadline', 'assessment', 'event', 'other'])(
    '合法 category（%s）保留',
    (cat) => {
      expect(
        toDraft(
          { kind: 'countdown', title: 'x', date: '2026-06-10', category: cat },
          'work',
          TODAY,
        )?.category,
      ).toBe(cat)
    },
  )

  it('非法 category（urgent）→ undefined', () => {
    expect(
      toDraft(
        { kind: 'countdown', title: 'x', date: '2026-06-10', category: 'urgent' },
        'work',
        TODAY,
      )?.category,
    ).toBeUndefined()
  })

  it('category 為 "null" → undefined', () => {
    expect(
      toDraft(
        { kind: 'countdown', title: 'x', date: '2026-06-10', category: 'null' },
        'work',
        TODAY,
      )?.category,
    ).toBeUndefined()
  })
})

describe('toDraft — 亂格式 / 非物件 → null', () => {
  it('null → null', () => {
    expect(toDraft(null, 'work', TODAY)).toBeNull()
  })

  it('undefined → null', () => {
    expect(toDraft(undefined, 'work', TODAY)).toBeNull()
  })

  it('字串 → null', () => {
    expect(toDraft('影印筆記', 'work', TODAY)).toBeNull()
  })

  it('數字 → null', () => {
    expect(toDraft(42, 'work', TODAY)).toBeNull()
  })

  it('陣列 → null（頂層要 object，唔要 array）', () => {
    expect(toDraft([{ kind: 'task', title: 'x' }], 'work', TODAY)).toBeNull()
  })

  it('空物件 {} → null（無 title）', () => {
    expect(toDraft({}, 'work', TODAY)).toBeNull()
  })
})

describe('toDraft — recurrence 正規化（只限 event）', () => {
  it('event + 每日：{freq:daily,interval:1} 保留', () => {
    const d = toDraft(
      {
        kind: 'event',
        title: '晨會',
        date: '2026-06-10',
        time: '09:00',
        recurrence: { freq: 'daily', interval: 1 },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toEqual({ freq: 'daily', interval: 1 })
  })

  it('event + 每週逢一三五：byWeekday 去重 + 升序保留', () => {
    const d = toDraft(
      {
        kind: 'event',
        title: '週會',
        date: '2026-06-10',
        time: '09:00',
        recurrence: { freq: 'weekly', interval: 1, byWeekday: [5, 1, 3, 1] },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toEqual({ freq: 'weekly', interval: 1, byWeekday: [1, 3, 5] })
  })

  it('interval 缺 → 預設 1', () => {
    const d = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', recurrence: { freq: 'daily' } },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toEqual({ freq: 'daily', interval: 1 })
  })

  it('interval 非正 / 非整數 → 夾返 1（0 → 1、2.9 → 2）', () => {
    const zero = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', recurrence: { freq: 'daily', interval: 0 } },
      'work',
      TODAY,
    )
    expect(zero?.recurrence?.interval).toBe(1)
    const frac = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'daily', interval: 2.9 },
      },
      'work',
      TODAY,
    )
    expect(frac?.recurrence?.interval).toBe(2)
  })

  it('非法 freq（monthly / 亂字串）→ 整體 drop（undefined）', () => {
    const monthly = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'monthly', interval: 1 },
      },
      'work',
      TODAY,
    )
    expect(monthly?.recurrence).toBeUndefined()
    const junk = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', recurrence: { freq: '每日' } },
      'work',
      TODAY,
    )
    expect(junk?.recurrence).toBeUndefined()
  })

  it('byWeekday 全部越界 / 非數字 → 唔帶 byWeekday', () => {
    // 7、-1 越界；'1'（字串）非 number；NaN → 全部過濾走
    const d = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'weekly', byWeekday: [7, -1, '1', NaN] },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toEqual({ freq: 'weekly', interval: 1 })
    expect(d?.recurrence?.byWeekday).toBeUndefined()
  })

  it('byWeekday 小數會 floor（2.7 → 2，仍合法保留）', () => {
    const d = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'weekly', byWeekday: [2.7] },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence?.byWeekday).toEqual([2])
  })

  it('byWeekday 部分越界 → 只保留合法（[1,7,5] → [1,5]）', () => {
    const d = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'weekly', byWeekday: [1, 7, 5] },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence?.byWeekday).toEqual([1, 5])
  })

  it('daily 帶 byWeekday → 一律唔保留 byWeekday（只 weekly 用）', () => {
    const d = toDraft(
      {
        kind: 'event',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'daily', byWeekday: [1, 3] },
      },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toEqual({ freq: 'daily', interval: 1 })
    expect(d?.recurrence?.byWeekday).toBeUndefined()
  })

  it('無 recurrence 欄位 → undefined（無重複就唔加）', () => {
    const d = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', time: '09:00' },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toBeUndefined()
  })

  it('recurrence = null（JSON null）→ undefined', () => {
    const d = toDraft(
      { kind: 'event', title: 'x', date: '2026-06-10', recurrence: null },
      'work',
      TODAY,
    )
    expect(d?.recurrence).toBeUndefined()
  })

  it('recurrence 非物件（字串 / 陣列）→ undefined', () => {
    expect(
      toDraft(
        { kind: 'event', title: 'x', date: '2026-06-10', recurrence: 'daily' },
        'work',
        TODAY,
      )?.recurrence,
    ).toBeUndefined()
    expect(
      toDraft(
        { kind: 'event', title: 'x', date: '2026-06-10', recurrence: [{ freq: 'daily' }] },
        'work',
        TODAY,
      )?.recurrence,
    ).toBeUndefined()
  })

  it('非 event（task / countdown）→ recurrence 一律唔解（drop）', () => {
    const task = toDraft(
      { kind: 'task', title: 'x', recurrence: { freq: 'daily', interval: 1 } },
      'work',
      TODAY,
    )
    expect(task?.recurrence).toBeUndefined()
    const cd = toDraft(
      {
        kind: 'countdown',
        title: 'x',
        date: '2026-06-10',
        recurrence: { freq: 'weekly', interval: 1 },
      },
      'work',
      TODAY,
    )
    expect(cd?.recurrence).toBeUndefined()
  })
})

describe('buildQuickAddPrompt — 內容包含關鍵指示', () => {
  const prompt = buildQuickAddPrompt('下星期三 3pm 同 5A 家長開會', TODAY, '星期三', 'work')

  it('含今日日期', () => {
    expect(prompt).toContain(TODAY)
  })

  it('含星期（畀 AI 解相對日期）', () => {
    expect(prompt).toContain('星期三')
  })

  it('含用戶原文', () => {
    expect(prompt).toContain('下星期三 3pm 同 5A 家長開會')
  })

  it('含三類 kind 名', () => {
    expect(prompt).toContain('task')
    expect(prompt).toContain('countdown')
    expect(prompt).toContain('event')
  })

  it('要求只回 JSON 陣列（可多項）/ 唔好 markdown 圍欄', () => {
    expect(prompt).toContain('JSON 陣列')
    expect(prompt).toContain('拆成獨立項目')
    expect(prompt).toContain('```')
  })

  it('含重複偵測指示（recurrence + freq daily/weekly + byWeekday）', () => {
    expect(prompt).toContain('重複規則')
    expect(prompt).toContain('recurrence')
    expect(prompt).toContain('每朝')
    expect(prompt).toContain('逢星期五')
    // schema 行示範 byWeekday 數字編碼
    expect(prompt).toContain('byWeekday')
  })

  it('work 模式 label = 工作', () => {
    expect(prompt).toContain('工作')
  })

  it('learning 模式 label = 學習', () => {
    expect(buildQuickAddPrompt('溫書', TODAY, '星期三', 'learning')).toContain('學習')
  })
})
