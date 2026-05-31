import { describe, it, expect } from 'vitest'
import { countWords, buildHeatGrid } from './util'
import type { JournalDoc } from './util'

// ============================================================
//  學習日誌 — 補充邊界測試（純函式，零時間依賴）
//  ------------------------------------------------------------
//  util.test.ts 已覆蓋 countWords / buildHeatGrid 嘅主路徑；本檔補
//  審查列明但未測到嘅邊界：
//   · countWords：CJK 標點唔計、平假名 / 片假名 / 諺文逐字
//   · buildHeatGrid：閏年 2/29、1 月 1 號落唔同星期（日 / 六）嘅年
//                    仍砌出 12 個月標籤
// ============================================================

const doc = (over: Partial<JournalDoc>): JournalDoc => ({
  id: 'd',
  date: '2026-05-04',
  content: '',
  createdAt: '2026-05-04T08:00:00.000Z',
  updatedAt: '2026-05-04T08:00:00.000Z',
  ...over,
})

describe('countWords — CJK 標點 / 假名 / 諺文', () => {
  it('CJK 標點（、。！？）唔計入字數，只計實字', () => {
    // 你好世界 = 4 隻 CJK 字；、。 屬標點，正則只配 漢字 / 假名 / 諺文，唔配標點
    expect(countWords('你好、世界。')).toBe(4)
    expect(countWords('完成！？')).toBe(2) // 完成 = 2，！？ 唔計
  })

  it('平假名 / 片假名逐字計', () => {
    expect(countWords('あい')).toBe(2) // 平假名 2 隻
    expect(countWords('カ')).toBe(1) // 片假名 1 隻
    expect(countWords('こんにちは')).toBe(5) // 5 隻平假名
  })

  it('諺文（韓文）逐字計', () => {
    expect(countWords('한글')).toBe(2)
  })

  it('CJK + 拉丁夾標點混合', () => {
    // 學 = 1 CJK；React = 1 詞；。 標點唔計 → 共 2
    expect(countWords('學 React。')).toBe(2)
  })
})

describe('buildHeatGrid — 閏年 2/29', () => {
  it('2024（閏年）含 2/29 格、inYear=true、count 正確', () => {
    const grid = buildHeatGrid([doc({ date: '2024-02-29' })], 2024)
    const feb29 = grid.weeks.flat().find((c) => c.key === '2024-02-29')
    expect(feb29).toBeDefined()
    expect(feb29!.inYear).toBe(true)
    expect(feb29!.count).toBe(1)
    expect(grid.total).toBe(1)
    expect(grid.activeDays).toBe(1)
  })

  it('2024 閏年：53 週、每週 7 格、12 個月標籤齊', () => {
    const grid = buildHeatGrid([], 2024)
    expect(grid.weeks).toHaveLength(53)
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true)
    expect(grid.monthLabels).toHaveLength(12)
  })
})

describe('buildHeatGrid — 1 月 1 號落唔同星期', () => {
  it('Jan 1 為星期日（2023）：首格正正係 2023-01-01、12 個月標籤齊', () => {
    // 2023-01-01 本身就係星期日 → 退到星期日 = 自己
    const grid = buildHeatGrid([], 2023)
    expect(grid.weeks[0][0].key).toBe('2023-01-01')
    expect(grid.weeks[0][0].inYear).toBe(true)
    expect(grid.monthLabels).toHaveLength(12)
    expect(grid.monthLabels[0]).toEqual({ col: 0, label: '1月' })
    expect(grid.monthLabels[11].label).toBe('12月')
  })

  it('Jan 1 為星期六（2022）：首格退到前一年 2021-12-26、12 個月標籤齊', () => {
    // 2022-01-01 = 星期六 → 退 6 日到星期日 2021-12-26
    const grid = buildHeatGrid([], 2022)
    expect(grid.weeks[0][0].key).toBe('2021-12-26')
    expect(grid.weeks[0][0].inYear).toBe(false)
    expect(grid.monthLabels).toHaveLength(12)
    expect(grid.monthLabels.map((m) => m.label)).toEqual([
      '1月', '2月', '3月', '4月', '5月', '6月',
      '7月', '8月', '9月', '10月', '11月', '12月',
    ])
  })

  it('每月標籤喺該月首週首格出現（col 嚴格遞增）', () => {
    const grid = buildHeatGrid([], 2026)
    const cols = grid.monthLabels.map((m) => m.col)
    for (let i = 1; i < cols.length; i++) {
      expect(cols[i]).toBeGreaterThan(cols[i - 1])
    }
  })
})
