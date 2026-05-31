import { describe, it, expect } from 'vitest'
import type { ParentComm } from '../../../data/types'
import { monthlyTrend, type CommRow, type CommMeta } from './util'

// ============================================================
//  monthlyTrend — deterministic 測試（注入固定 anchor）
//  ------------------------------------------------------------
//  此檔專門揭發 / 守護 suspectedBug #1：
//  monthlyTrend 原本硬 call recentMonthKeys(months) 冇傳 anchor，
//  令圖表月份永遠錨定「真實今日」(new Date())，無法 deterministic
//  測較舊月份嘅分流，亦同 buildOverview(rows, anchor) 行為不一致。
//  修法：monthlyTrend(rows, months, anchor = new Date())，把 anchor
//  傳落 recentMonthKeys(months, anchor)。以下測試靠注入固定 anchor，
//  驗證每個月份桶嘅落點同 incoming/outgoing 分流都正確。
// ============================================================

const comm = (over: Partial<ParentComm> = {}): ParentComm => ({
  id: 'c',
  classId: 'k1',
  date: '2026-05-15',
  channel: '電話',
  summary: '',
  createdAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const meta = (over: Partial<CommMeta> = {}): CommMeta => ({
  id: 'm',
  commId: 'c',
  updatedAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const row = (c: Partial<ParentComm> = {}, m?: Partial<CommMeta>): CommRow => ({
  comm: comm(c),
  meta: m ? meta(m) : undefined,
})

describe('monthlyTrend（注入固定 anchor，deterministic）', () => {
  // 固定 anchor = 2026-05-15（避開「真實今日」漂移）
  const anchor = new Date(2026, 4, 15)

  it('keys 由舊到新、長度 = months、最後一個 = anchor 當月、label 無補零', () => {
    const pts = monthlyTrend([], 3, anchor)
    expect(pts.map((p) => p.key)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(pts.map((p) => p.label)).toEqual(['3月', '4月', '5月'])
    expect(pts.every((p) => p.total === 0 && p.incoming === 0 && p.outgoing === 0)).toBe(true)
  })

  it('months = 0 → 空陣列', () => {
    expect(monthlyTrend([], 0, anchor)).toEqual([])
  })

  it('記錄按月份分桶（非當月嘅較舊月份都要正確落點）', () => {
    const rows: CommRow[] = [
      row({ date: '2026-03-02' }), // 3月
      row({ date: '2026-03-28' }), // 3月
      row({ date: '2026-04-15' }), // 4月
      row({ date: '2026-05-31' }), // 5月（當月）
    ]
    const pts = monthlyTrend(rows, 3, anchor)
    expect(pts.find((p) => p.key === '2026-03')!.total).toBe(2)
    expect(pts.find((p) => p.key === '2026-04')!.total).toBe(1)
    expect(pts.find((p) => p.key === '2026-05')!.total).toBe(1)
  })

  it('每月 incoming / outgoing 分流（無 meta 當 outgoing；incoming+outgoing===total）', () => {
    const rows: CommRow[] = [
      row({ date: '2026-04-03' }, { direction: 'incoming' }),
      row({ date: '2026-04-10' }, { direction: 'outgoing' }),
      row({ date: '2026-04-20' }), // 無 meta → outgoing
      row({ date: '2026-04-25' }, {}), // 有 meta 但無 direction → outgoing
    ]
    const apr = monthlyTrend(rows, 3, anchor).find((p) => p.key === '2026-04')!
    expect(apr.incoming).toBe(1)
    expect(apr.outgoing).toBe(3)
    expect(apr.total).toBe(4)
    expect(apr.incoming + apr.outgoing).toBe(apr.total)
  })

  it('範圍外（早於最舊月份 / 晚於 anchor 當月）嘅記錄唔計入', () => {
    const rows: CommRow[] = [
      row({ date: '2026-02-28' }), // 早過最舊月(3月)，唔計
      row({ date: '2026-06-01' }), // 晚過 anchor 當月(5月)，唔計
      row({ date: '2026-04-15' }), // 範圍內
    ]
    const pts = monthlyTrend(rows, 3, anchor)
    const sum = pts.reduce((s, p) => s + p.total, 0)
    expect(sum).toBe(1)
    expect(pts.find((p) => p.key === '2026-04')!.total).toBe(1)
  })

  it('跨年倒數（anchor = 2026-01 → 含上年 11 / 12 月），舊月份分流正確', () => {
    const janAnchor = new Date(2026, 0, 15)
    const rows: CommRow[] = [
      row({ date: '2025-11-10' }, { direction: 'incoming' }),
      row({ date: '2025-12-20' }),
      row({ date: '2026-01-05' }, { direction: 'incoming' }),
    ]
    const pts = monthlyTrend(rows, 3, janAnchor)
    expect(pts.map((p) => p.key)).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(pts.find((p) => p.key === '2025-11')!.incoming).toBe(1)
    expect(pts.find((p) => p.key === '2025-12')!.outgoing).toBe(1)
    expect(pts.find((p) => p.key === '2026-01')!.incoming).toBe(1)
  })

  it('預設 anchor = new Date()：唔傳 anchor 時最後一個 key = 真實當月（向後相容）', () => {
    const pts = monthlyTrend([], 6)
    expect(pts).toHaveLength(6)
    const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    expect(pts[pts.length - 1].key).toBe(nowKey)
  })
})
