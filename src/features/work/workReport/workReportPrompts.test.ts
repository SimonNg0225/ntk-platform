import { describe, it, expect } from 'vitest'
import { buildWorkReportSystem, buildWorkReportUser, parseWorkReport } from './workReportPrompts'
import { resolveRange, aggregate, isEmptyAggregate } from './reportRange'
import type { CalendarEvent, Task, MeetingNote } from '../../../data/types'

describe('buildWorkReportSystem', () => {
  it('要求 JSON 三欄', () => {
    const s = buildWorkReportSystem()
    expect(s).toContain('done')
    expect(s).toContain('followUps')
    expect(s).toContain('highlights')
  })
})

describe('parseWorkReport', () => {
  const good = {
    done: ['批改中三作文', '開咗科組會'],
    followUps: ['跟進缺交名單'],
    highlights: ['進度正常，建議下週收卷'],
  }
  it('解析純 JSON', () => {
    const r = parseWorkReport(JSON.stringify(good))
    expect(r.done).toHaveLength(2)
    expect(r.followUps).toEqual(['跟進缺交名單'])
    expect(r.highlights[0]).toContain('收卷')
  })
  it('帶 code fence / 缺欄位', () => {
    const r = parseWorkReport('```json\n' + JSON.stringify({ done: ['只有做咗'] }) + '\n```')
    expect(r.done).toEqual(['只有做咗'])
    expect(r.followUps).toEqual([])
    expect(r.highlights).toEqual([])
  })
  it('過濾非字串 / 空白', () => {
    const r = parseWorkReport(JSON.stringify({ done: ['ok', 1, '', null, '  trim  '] }))
    expect(r.done).toEqual(['ok', 'trim'])
  })
  it('非物件 throw', () => {
    expect(() => parseWorkReport('不是 JSON')).toThrow()
  })
})

describe('resolveRange', () => {
  it('week — 由星期日至星期六（對齊行事曆）', () => {
    // 2026-05-06 係星期三
    const r = resolveRange('week', undefined, undefined, new Date(2026, 4, 6))
    expect(r.start).toBe('2026-05-03') // 星期日
    expect(r.end).toBe('2026-05-09') // 星期六
  })
  it('month — 當月 1 號至月底（閏年 2 月）', () => {
    const r = resolveRange('month', undefined, undefined, new Date(2024, 1, 15)) // 2024-02
    expect(r.start).toBe('2024-02-01')
    expect(r.end).toBe('2024-02-29')
  })
  it('custom — start>end 自動對調', () => {
    const r = resolveRange('custom', '2026-06-20', '2026-06-10')
    expect(r.start).toBe('2026-06-10')
    expect(r.end).toBe('2026-06-20')
  })
  it('custom — 缺值 fallback 今日', () => {
    const r = resolveRange('custom', undefined, undefined, new Date(2026, 5, 24))
    expect(r.start).toBe('2026-06-24')
    expect(r.end).toBe('2026-06-24')
  })
})

describe('aggregate', () => {
  const ev = (id: string, date: string): CalendarEvent => ({ id, title: 't' + id, date })
  const tk = (id: string, createdAt: string, done: boolean): Task => ({
    id,
    text: 'x' + id,
    done,
    createdAt,
  })
  const nt = (id: string, date: string): MeetingNote => ({
    id,
    title: 'n' + id,
    date,
    content: 'c',
    createdAt: date + 'T00:00:00.000Z',
  })
  const range = { start: '2026-06-01', end: '2026-06-30' }

  it('range 過濾 + done/open split + counts', () => {
    const events = [ev('1', '2026-06-05'), ev('2', '2026-05-31'), ev('3', '2026-07-01')]
    const tasks = [
      tk('a', '2026-06-10T08:00:00.000Z', true),
      tk('b', '2026-06-12T08:00:00.000Z', false),
      tk('c', '2026-05-01T08:00:00.000Z', false), // out of range
    ]
    const notes = [nt('n1', '2026-06-15'), nt('n2', '2026-04-01')]
    const agg = aggregate(events, tasks, notes, range)
    expect(agg.counts.events).toBe(1)
    expect(agg.counts.done).toBe(1)
    expect(agg.counts.open).toBe(1)
    expect(agg.counts.notes).toBe(1)
    expect(agg.tasksDone[0].id).toBe('a')
    expect(agg.tasksOpen[0].id).toBe('b')
  })

  it('全空 → isEmptyAggregate true', () => {
    const agg = aggregate([], [], [], range)
    expect(isEmptyAggregate(agg)).toBe(true)
  })

  it('週期性事件展開：每週科組會喺整個月計多次', () => {
    const weekly: CalendarEvent = {
      id: 'w',
      title: '科組會',
      date: '2026-06-01', // 6 月內逢週一（首發），interval 1
      recurrence: { freq: 'weekly', interval: 1 },
    }
    const agg = aggregate([weekly], [], [], range)
    // 2026-06 內由 06-01 起每 7 日：01/08/15/22/29 → 5 次
    expect(agg.counts.events).toBe(5)
    expect(agg.events.every((e) => e.title === '科組會')).toBe(true)
  })

  it('週期性事件尊重 exDates（被刪嗰次唔計）', () => {
    const weekly: CalendarEvent = {
      id: 'w',
      title: '科組會',
      date: '2026-06-01',
      recurrence: { freq: 'weekly', interval: 1 },
      exDates: ['2026-06-15'],
    }
    const agg = aggregate([weekly], [], [], range)
    expect(agg.counts.events).toBe(4)
    expect(agg.events.some((e) => e.date === '2026-06-15')).toBe(false)
  })
})

describe('buildWorkReportUser', () => {
  it('含時段 + 各分段標題 + 待辦建立日期備註', () => {
    const agg = aggregate(
      [{ id: '1', title: '科組會', date: '2026-06-10', type: '會議' }],
      [{ id: 'a', text: '改卷', done: true, createdAt: '2026-06-11T00:00:00.000Z' }],
      [{ id: 'n', title: '家長會', date: '2026-06-12', content: '跟進缺席', createdAt: '2026-06-12' }],
      { start: '2026-06-01', end: '2026-06-30' },
    )
    const u = buildWorkReportUser(agg, { start: '2026-06-01', end: '2026-06-30' })
    expect(u).toContain('時段：2026-06-01 至 2026-06-30')
    expect(u).toContain('【行事曆事件】')
    expect(u).toContain('【已完成待辦】')
    expect(u).toContain('【會議筆記／跟進】')
    expect(u).toContain('建立日期')
    expect(u).toContain('科組會')
  })
})
