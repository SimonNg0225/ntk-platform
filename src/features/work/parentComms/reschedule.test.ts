import { describe, it, expect } from 'vitest'
import type { ParentComm } from '../../../data/types'
import { planFollowUpReschedule, type CommRow, type CommMeta } from './util'

// ============================================================
//  planFollowUpReschedule — 批量重排跟進到期日（純函式）
//  ------------------------------------------------------------
//  只測純函式，注入固定資料。著重：
//   · 設日期：待跟進 + 已完成混合，計 scheduled / reopened
//   · 清除日期（undefined）唔當作 scheduled，但仍會重開已完成
//   · 無變化（同待跟進、同日期）跳過，無謂寫入
//   · 空輸入安全
//   · changes 帶返 metaId（可能 undefined）
//   · 不變更原 rows（純函式）
// ============================================================

const comm = (over: Partial<ParentComm> = {}): ParentComm => ({
  id: 'c',
  classId: 'k1',
  date: '2026-05-15',
  channel: '電話',
  summary: '',
  followUp: false,
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

describe('planFollowUpReschedule — 設定到期日', () => {
  it('已完成記錄 → 重開成待跟進 + 設到期日', () => {
    const plan = planFollowUpReschedule(
      [row({ id: 'a', followUp: false }, { id: 'ma' })],
      '2026-06-10',
    )
    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0]).toEqual({
      commId: 'a',
      metaId: 'ma',
      setFollowUp: true,
      followUpDate: '2026-06-10',
    })
    expect(plan.scheduled).toBe(1)
    expect(plan.reopened).toBe(1)
  })

  it('已係待跟進、改去新到期日 → scheduled 計數但唔當重開', () => {
    const plan = planFollowUpReschedule(
      [row({ id: 'a', followUp: true }, { id: 'ma', followUpDate: '2026-06-01' })],
      '2026-06-10',
    )
    expect(plan.scheduled).toBe(1)
    expect(plan.reopened).toBe(0)
    expect(plan.changes[0].setFollowUp).toBe(false)
    expect(plan.changes[0].followUpDate).toBe('2026-06-10')
  })

  it('混合：待跟進改期 + 已完成重開 + 無變化跳過', () => {
    const plan = planFollowUpReschedule(
      [
        row({ id: 'keep', followUp: true }, { id: 'mk', followUpDate: '2026-06-10' }), // 同日 → 跳過
        row({ id: 'move', followUp: true }, { id: 'mm', followUpDate: '2026-06-01' }), // 改期
        row({ id: 'reopen', followUp: false }, { id: 'mr' }), // 重開
        row({ id: 'reopen2', followUp: false }), // 重開（無 meta）
      ],
      '2026-06-10',
    )
    expect(plan.changes.map((c) => c.commId).sort()).toEqual(['move', 'reopen', 'reopen2'])
    expect(plan.scheduled).toBe(3) // move + 2 reopen 都係改到新日期
    expect(plan.reopened).toBe(2) // reopen + reopen2
  })
})

describe('planFollowUpReschedule — 清除到期日（undefined）', () => {
  it('清除待跟進記錄嘅到期日：唔計 scheduled，metaId 帶返', () => {
    const plan = planFollowUpReschedule(
      [row({ id: 'a', followUp: true }, { id: 'ma', followUpDate: '2026-06-10' })],
      undefined,
    )
    expect(plan.scheduled).toBe(0)
    expect(plan.reopened).toBe(0)
    expect(plan.changes[0]).toEqual({
      commId: 'a',
      metaId: 'ma',
      setFollowUp: false,
      followUpDate: undefined,
    })
  })

  it('待跟進、本身已無到期日 → 完全無變化（跳過）', () => {
    const plan = planFollowUpReschedule([row({ id: 'a', followUp: true })], undefined)
    expect(plan.changes).toHaveLength(0)
    expect(plan.scheduled).toBe(0)
    expect(plan.reopened).toBe(0)
  })

  it('已完成記錄 + 清除日期 → 仍會重開（reopened），但唔計 scheduled', () => {
    const plan = planFollowUpReschedule(
      [row({ id: 'a', followUp: false }, { id: 'ma' })],
      undefined,
    )
    expect(plan.reopened).toBe(1)
    expect(plan.scheduled).toBe(0)
    expect(plan.changes[0].setFollowUp).toBe(true)
    expect(plan.changes[0].followUpDate).toBeUndefined()
  })
})

describe('planFollowUpReschedule — 邊界', () => {
  it('空輸入 → 空 plan，零計數', () => {
    const plan = planFollowUpReschedule([], '2026-06-10')
    expect(plan.changes).toEqual([])
    expect(plan.scheduled).toBe(0)
    expect(plan.reopened).toBe(0)
  })

  it('純函式：唔變更原 rows', () => {
    const rows = [row({ id: 'a', followUp: false }, { id: 'ma' })]
    const snapshot = JSON.parse(JSON.stringify(rows))
    planFollowUpReschedule(rows, '2026-06-10')
    expect(rows).toEqual(snapshot)
  })

  it('全部無變化 → changes 為空（多條同日待跟進）', () => {
    const plan = planFollowUpReschedule(
      [
        row({ id: 'a', followUp: true }, { id: 'ma', followUpDate: '2026-06-10' }),
        row({ id: 'b', followUp: true }, { id: 'mb', followUpDate: '2026-06-10' }),
      ],
      '2026-06-10',
    )
    expect(plan.changes).toHaveLength(0)
  })
})
