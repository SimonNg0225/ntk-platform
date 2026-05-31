import { describe, expect, it } from 'vitest'
import type { Student } from '../../../data/types'
import type { StudentMeta } from './types'
import {
  buildSeatGrid,
  demographicsOf,
  initials,
  parseBulk,
  pctTone,
  sortStudents,
  splitGroups,
  studentSortKey,
} from './util'

// ============================================================
//  補充測試 — 覆蓋 util.test.ts 未涵蓋嘅函式（splitGroups）、
//  審查列出嘅額外邊界 case，以及兩個疑似計算 bug。
//  （node 環境、純函式、絕不掂 DOM / React）
// ============================================================

const stu = (over: Partial<Student> & { id: string }): Student => ({
  classId: 'c1',
  name: 'N',
  ...over,
})

const smeta = (over: Partial<StudentMeta> & { studentId: string }): StudentMeta => ({
  id: 'm-' + over.studentId,
  status: 'active',
  updatedAt: '2026-01-01',
  ...over,
})

// ============================================================
//  splitGroups — 平均分 n 組，round-robin（i % groups.length）
// ============================================================
describe('splitGroups', () => {
  // splitGroups 內部會 shuffle（用 Math.random），所以斷言只鎖定
  // 「與洗牌結果無關」嘅不變量：組數、各組大細（round-robin 決定）、
  // 每件物品恰好出現一次。組大細：第 i 組 = ceil((N-i)/G)。

  // 與洗牌無關嘅輔助：排序後比較成員齊全
  const sortedFlat = (gs: number[][]) => gs.flat().sort((a, b) => a - b)
  const sizesAsc = (gs: number[][]) => gs.map((g) => g.length).sort((a, b) => a - b)

  it('5 人分 2 組 → 3 / 2（round-robin 餘數分配；大細與洗牌無關）', () => {
    const groups = splitGroups([1, 2, 3, 4, 5], 2)
    expect(groups.length).toBe(2)
    // 組0 = ceil(5/2)=3、組1 = ceil(4/2)=2
    expect(groups[0].length).toBe(3)
    expect(groups[1].length).toBe(2)
    expect(sortedFlat(groups)).toEqual([1, 2, 3, 4, 5])
  })

  it('每件物品恰好出現一次（11 分 3 → 4 / 4 / 3）', () => {
    const items = Array.from({ length: 11 }, (_, i) => i)
    const groups = splitGroups(items, 3)
    expect(groups.length).toBe(3)
    expect(sortedFlat(groups)).toEqual(items)
    // round-robin：組0 ceil(11/3)=4、組1 ceil(10/3)=4、組2 ceil(9/3)=3
    expect(groups.map((g) => g.length)).toEqual([4, 4, 3])
    // 任何元素唔重複
    expect(new Set(groups.flat()).size).toBe(11)
  })

  it('n <= 0 夾到最少 1 組（全部一組）', () => {
    const g0 = splitGroups([1, 2, 3], 0)
    expect(g0.length).toBe(1)
    expect(sortedFlat(g0)).toEqual([1, 2, 3])
    expect(splitGroups([1, 2, 3], -5).length).toBe(1)
  })

  it('items 空 → n 個空組', () => {
    expect(splitGroups([], 3)).toEqual([[], [], []])
  })

  it('items 少於 n → 部分組空（2 件分 4 組 → 兩組各 1、兩組空）', () => {
    const groups = splitGroups([1, 2], 4)
    expect(groups.length).toBe(4)
    expect(sizesAsc(groups)).toEqual([0, 0, 1, 1])
    expect(sortedFlat(groups)).toEqual([1, 2])
  })

  it('n = 1 → 全部一組（且元素齊全）', () => {
    const groups = splitGroups([1, 2, 3, 4], 1)
    expect(groups.length).toBe(1)
    expect(sortedFlat(groups)).toEqual([1, 2, 3, 4])
  })
})

// ============================================================
//  studentSortKey — 額外邊界（科學記數 / 前導零 / 超 MAX 精度）
// ============================================================
describe('studentSortKey（額外邊界）', () => {
  it("前導零 '01' 仍當數值 1（Number 解析）", () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '01' }))).toEqual([1, '01'])
    // '01' 與 '1' 數值相同，但保留原字串做 tie-break 鍵
    expect(studentSortKey(stu({ id: 's', studentNo: '1' }))).toEqual([1, '1'])
  })

  it("科學記數 '1e3' 被 Number 當 1000（記錄現行行為）", () => {
    // 文件已標示「可能非預期」：此測試鎖定當前行為，避免無意改動
    expect(studentSortKey(stu({ id: 's', studentNo: '1e3' }))).toEqual([1000, '1e3'])
  })

  it('帶正負號 / 小數都被 Number 接受', () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '-3' }))).toEqual([-3, '-3'])
    expect(studentSortKey(stu({ id: 's', studentNo: '2.5' }))).toEqual([2.5, '2.5'])
  })
})

// ============================================================
//  sortStudents — 額外邊界（單元素 / 全無學號 localeCompare / 前導零）
// ============================================================
describe('sortStudents（額外邊界）', () => {
  it('單元素 → 原樣', () => {
    const input = [stu({ id: 'a', studentNo: '5' })]
    expect(sortStudents(input).map((s) => s.id)).toEqual(['a'])
  })

  it('全部無學號 → 純用姓名 localeCompare(zh-HK)', () => {
    const input = [
      stu({ id: 'a', name: 'Charlie' }),
      stu({ id: 'b', name: 'Alice' }),
      stu({ id: 'c', name: 'Bob' }),
    ]
    expect(sortStudents(input).map((s) => s.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it("前導零學號照數值排（'01' < '2' < '10'）", () => {
    const input = [
      stu({ id: 'a', studentNo: '10' }),
      stu({ id: 'b', studentNo: '01' }),
      stu({ id: 'c', studentNo: '2' }),
    ]
    expect(sortStudents(input).map((s) => s.studentNo)).toEqual(['01', '2', '10'])
  })

  it('數字 tie（同數值）用學號字串 localeCompare 做穩定次序', () => {
    // '01' 與 '1' 同為數值 1 → 次序鍵比字串：'01' < '1'
    const input = [stu({ id: 'a', studentNo: '1' }), stu({ id: 'b', studentNo: '01' })]
    expect(sortStudents(input).map((s) => s.studentNo)).toEqual(['01', '1'])
  })
})

// ============================================================
//  demographicsOf — 額外邊界（重複 house 累加 / tie 穩定性）
// ============================================================
describe('demographicsOf（額外邊界）', () => {
  it('重複 house 名累加 count', () => {
    const students = [stu({ id: 's1' }), stu({ id: 's2' }), stu({ id: 's3' })]
    const metas = [
      smeta({ studentId: 's1', house: '青' }),
      smeta({ studentId: 's2', house: '青' }),
      smeta({ studentId: 's3', house: '青' }),
    ]
    const d = demographicsOf(students, metas)
    expect(d.house).toEqual([{ name: '青', count: 3 }])
  })

  it('house tie（同 count）：保留首次出現次序（sort 穩定）', () => {
    // 甲、乙各 1 人，count 相同 → Array.sort 穩定，甲先出現排前
    const students = [stu({ id: 's1' }), stu({ id: 's2' })]
    const metas = [
      smeta({ studentId: 's1', house: '甲' }),
      smeta({ studentId: 's2', house: '乙' }),
    ]
    const d = demographicsOf(students, metas)
    expect(d.house).toEqual([
      { name: '甲', count: 1 },
      { name: '乙', count: 1 },
    ])
  })

  it('只有空格嘅 house 忽略，但同名非空 house 照計', () => {
    const students = [stu({ id: 's1' }), stu({ id: 's2' })]
    const metas = [
      smeta({ studentId: 's1', house: '  ' }), // 忽略
      smeta({ studentId: 's2', house: '紅' }),
    ]
    const d = demographicsOf(students, metas)
    expect(d.house).toEqual([{ name: '紅', count: 1 }])
  })

  it('gender X 計入正確 bucket', () => {
    const students = [stu({ id: 's1' }), stu({ id: 's2' })]
    const metas = [smeta({ studentId: 's1', gender: 'X' }), smeta({ studentId: 's2', gender: 'X' })]
    const d = demographicsOf(students, metas)
    expect(d.gender).toEqual({ M: 0, F: 0, X: 2 })
    expect(d.genderUnknown).toBe(0)
  })
})

// ============================================================
//  parseBulk — 額外邊界（單欄無分隔 / 多 token 名 join / 全空白多行）
// ============================================================
describe('parseBulk（額外邊界）', () => {
  it('單欄無分隔（純名，無數字）→ 整行做名', () => {
    expect(parseBulk('陳大文')).toEqual([{ name: '陳大文' }])
  })

  it('純數字單欄（無第二欄）→ 整行做名（唔當學號，因 parts.length < 2）', () => {
    // 規則只喺 parts.length >= 2 時抽學號；單欄一律做名
    expect(parseBulk('12345')).toEqual([{ name: '12345' }])
  })

  it('名有多個 token，最後一欄係學號 → 名用空格 join', () => {
    expect(parseBulk('Mary Anne Lee\t07')).toEqual([{ studentNo: '07', name: 'Mary Anne Lee' }])
  })

  it('全部係空白 / 空行 → 空陣列', () => {
    expect(parseBulk('   \n\t\n  \r\n')).toEqual([])
  })

  it('學號喺前但中文名含空格（多空格分隔）', () => {
    expect(parseBulk('15   陳 大文')).toEqual([{ studentNo: '15', name: '陳 大文' }])
  })
})

// ============================================================
//  initials — 額外邊界（emoji / 多 codepoint 首字會被 charAt 切半）
// ============================================================
describe('initials（額外邊界）', () => {
  it('emoji 首字：charAt(0) 只取首個 UTF-16 code unit（記錄現行行為）', () => {
    // 👨‍🏫 等 emoji 係多 code unit；charAt(0) 會切半 → 鎖定當前行為
    const r = initials('👍ok')
    expect(r).toBe('\uD83D') // surrogate pair 高位
    expect(r.length).toBe(1)
  })

  it('tab / 全形空白前置都 trim（一般空白）', () => {
    expect(initials('\t\n  Ken')).toBe('K')
  })

  it('數字開頭名 → 取該數字字符', () => {
    expect(initials('3號 學生')).toBe('3')
  })
})

// ============================================================
//  pctTone — 額外邊界（>100 / 非整數小數邊界）
// ============================================================
describe('pctTone（額外邊界）', () => {
  it('>100 仍 green', () => {
    expect(pctTone(150)).toBe('green')
  })

  it('小數邊界：79.9 → accent（<80）、80.0 → green', () => {
    expect(pctTone(79.9)).toBe('accent')
    expect(pctTone(80.0)).toBe('green')
  })

  it('小數邊界：49.99 → amber（<50）、24.99 → rose（<25）', () => {
    expect(pctTone(49.99)).toBe('amber')
    expect(pctTone(24.99)).toBe('rose')
  })
})

// ============================================================
//  buildSeatGrid — 疑似 bug #1：重複 seat 令學生消失（已修）
//  + 稀疏大 seat index + stale meta id
// ============================================================
describe('buildSeatGrid（bug #1：重複座位 + 額外邊界）', () => {
  it('兩生同 seat：兩者都唔應消失，總人數守恆', () => {
    // 修復前：A 被 B 覆寫且兩者都 seated → A 從 grid 整個消失。
    // 修復後：座位已佔用就唔覆寫，A 落補位流程，三人齊全。
    const students = [stu({ id: 'A' }), stu({ id: 'B' }), stu({ id: 'C' })]
    const metas = [
      smeta({ studentId: 'A', seat: 0 }),
      smeta({ studentId: 'B', seat: 0 }), // 與 A 撞位
    ]
    const grid = buildSeatGrid(students, metas, 3)
    const present = grid
      .flat()
      .filter((s): s is Student => s !== null)
      .map((s) => s.id)
      .sort()
    expect(present).toEqual(['A', 'B', 'C'])
    // grid 非 null 格數 = 學生數
    expect(grid.flat().filter(Boolean).length).toBe(students.length)
  })

  it('先到先得：先出現嘅 A 佔座位 0，後撞位嘅 B 去補位', () => {
    const students = [stu({ id: 'A' }), stu({ id: 'B' })]
    const metas = [smeta({ studentId: 'A', seat: 0 }), smeta({ studentId: 'B', seat: 0 })]
    const grid = buildSeatGrid(students, metas, 2)
    // A 守住 seat0；B 補去下一個空位 idx1
    expect(grid.map((r) => r.map((s) => s?.id ?? null))).toEqual([['A', 'B']])
  })

  it('三生全撞同一 seat：全部齊全（無任何消失）', () => {
    const students = [stu({ id: 'A' }), stu({ id: 'B' }), stu({ id: 'C' })]
    const metas = [
      smeta({ studentId: 'A', seat: 1 }),
      smeta({ studentId: 'B', seat: 1 }),
      smeta({ studentId: 'C', seat: 1 }),
    ]
    const grid = buildSeatGrid(students, metas, 3)
    const present = grid
      .flat()
      .filter((s): s is Student => s !== null)
      .map((s) => s.id)
      .sort()
    expect(present).toEqual(['A', 'B', 'C'])
  })

  it('稀疏大 seat index：seat=5 但得 1 人 → 產生足夠行容納該 index', () => {
    const students = [stu({ id: 'A' })]
    const grid = buildSeatGrid(students, [smeta({ studentId: 'A', seat: 5 })], 3)
    // placed 長度 6（index 5），cols 3 → rows = ceil(6/3) = 2
    expect(grid.length).toBe(2)
    expect(grid[0].length).toBe(3)
    // A 喺 index 5 → row1 col2
    expect(grid[1][2]?.id).toBe('A')
    // 其餘全 null，且 A 只出現一次
    expect(grid.flat().filter(Boolean).length).toBe(1)
  })

  it('stale meta：meta 指向已不在名冊嘅 id → 該 meta 被無視，在學學生照排', () => {
    const students = [stu({ id: 'A' }), stu({ id: 'B' })]
    // ghost 已唔喺 students，但 meta 仍佔 seat 0
    const metas = [
      smeta({ studentId: 'ghost', seat: 0 }),
      smeta({ studentId: 'A', seat: 1 }),
    ]
    const grid = buildSeatGrid(students, metas, 2)
    const present = grid
      .flat()
      .filter((s): s is Student => s !== null)
      .map((s) => s.id)
      .sort()
    // 只應出現名冊內嘅 A、B；ghost 唔會憑空冒出
    expect(present).toEqual(['A', 'B'])
    expect(grid.flat().filter(Boolean).length).toBe(2)
  })
})
