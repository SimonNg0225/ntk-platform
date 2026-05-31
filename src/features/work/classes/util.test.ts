import { describe, it, expect } from 'vitest'
import type { Klass, Student } from '../../../data/types'
import type { ClassMeta, StudentMeta } from './types'
import {
  metaFor,
  classMetaFor,
  completenessOf,
  demographicsOf,
  studentSortKey,
  sortStudents,
  parseBulk,
  buildSeatGrid,
  csvEscape,
  initials,
  pctTone,
  classSizes,
} from './util'

// ───────── 測試用工廠（最小欄位 + 覆寫）─────────
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
//  metaFor — 搵到回原物件；搵唔到回完整 default
// ============================================================
describe('metaFor', () => {
  it('搵到對應 studentId 回原 meta', () => {
    const m = smeta({ studentId: 's1', gender: 'M', seat: 4 })
    expect(metaFor('s1', [m])).toBe(m)
  })

  it('搵唔到回 default（active / seat -1 / 空 id）', () => {
    expect(metaFor('ghost', [])).toEqual({
      id: '',
      studentId: 'ghost',
      status: 'active',
      seat: -1,
      updatedAt: '',
    })
  })

  it('default 嘅 studentId 跟住傳入值', () => {
    expect(metaFor('zzz', [smeta({ studentId: 's1' })]).studentId).toBe('zzz')
  })
})

// ============================================================
//  classMetaFor — 同上，default color accent / seatCols 6
// ============================================================
describe('classMetaFor', () => {
  it('搵到回原物件', () => {
    const m: ClassMeta = {
      id: 'cm1',
      classId: 'k1',
      color: 'rose',
      seatCols: 8,
      updatedAt: '2026-01-01',
    }
    expect(classMetaFor('k1', [m])).toBe(m)
  })

  it('搵唔到回 default（accent / seatCols 6）', () => {
    expect(classMetaFor('k9', [])).toEqual({
      id: '',
      classId: 'k9',
      color: 'accent',
      seatCols: 6,
      updatedAt: '',
    })
  })
})

// ============================================================
//  completenessOf — 每生 3 欄（學號 / 性別 / 監護人電話）
// ============================================================
describe('completenessOf', () => {
  it('空名冊：pct 0，無除零（denom 0）', () => {
    const r = completenessOf([], [])
    expect(r).toEqual({
      total: 0,
      filled: 0,
      pct: 0,
      missing: { studentNo: 0, gender: 0, guardian: 0 },
    })
  })

  it('全部齊：filled = total*3，pct 100', () => {
    const students = [stu({ id: 's1', studentNo: '01' }), stu({ id: 's2', studentNo: '02' })]
    const metas = [
      smeta({ studentId: 's1', gender: 'M', guardianPhone: '12345678' }),
      smeta({ studentId: 's2', gender: 'F', guardianPhone: '23456789' }),
    ]
    const r = completenessOf(students, metas)
    // 2 生 × 3 欄 = 6 denom，全齊 filled 6 → 100%
    expect(r.total).toBe(2)
    expect(r.filled).toBe(6)
    expect(r.pct).toBe(100)
    expect(r.missing).toEqual({ studentNo: 0, gender: 0, guardian: 0 })
  })

  it('部分缺：手算 filled / pct / 逐項 missing', () => {
    // s1：有學號、有性別、無電話   → filled 2，缺 guardian
    // s2：無學號、無性別、有電話   → filled 1，缺 studentNo + gender
    const students = [stu({ id: 's1', studentNo: '01' }), stu({ id: 's2' })]
    const metas = [
      smeta({ studentId: 's1', gender: 'M' }),
      smeta({ studentId: 's2', guardianPhone: '999' }),
    ]
    const r = completenessOf(students, metas)
    expect(r.filled).toBe(3) // 2 + 1
    // denom 6，filled 3 → 50%
    expect(r.pct).toBe(50)
    expect(r.missing).toEqual({ studentNo: 1, gender: 1, guardian: 1 })
    // 不變量：filled + 全部 missing = total*3
    const missTotal = r.missing.studentNo + r.missing.gender + r.missing.guardian
    expect(r.filled + missTotal).toBe(r.total * 3)
  })

  it('空白字串（只有空格）唔當填咗', () => {
    const students = [stu({ id: 's1', studentNo: '   ' })]
    const metas = [smeta({ studentId: 's1', guardianPhone: '  ' })]
    const r = completenessOf(students, metas)
    expect(r.filled).toBe(0)
    expect(r.missing).toEqual({ studentNo: 1, gender: 1, guardian: 1 })
  })

  it('pct 四捨五入：1/3 → 33（向下捨）', () => {
    // 1 生，只填 1 欄（學號），denom 3 → 33.33 → 33
    const r = completenessOf([stu({ id: 's1', studentNo: '01' })], [])
    expect(r.filled).toBe(1)
    expect(r.pct).toBe(33)
  })

  it('pct 四捨五入：2/3 → 67（向上入，證實用 round 而非 floor）', () => {
    // 1 生，填 2 欄（學號 + 性別），denom 3 → 66.67 → 67
    const r = completenessOf(
      [stu({ id: 's1', studentNo: '01' })],
      [smeta({ studentId: 's1', gender: 'F' })],
    )
    expect(r.filled).toBe(2)
    expect(r.pct).toBe(67)
  })
})

// ============================================================
//  demographicsOf — 性別 / 未知 / 班社（count desc） / 狀態
// ============================================================
describe('demographicsOf', () => {
  it('空名冊：全 0', () => {
    expect(demographicsOf([], [])).toEqual({
      gender: { M: 0, F: 0, X: 0 },
      genderUnknown: 0,
      house: [],
      status: { active: 0, transferred: 0, withdrawn: 0 },
    })
  })

  it('性別計數 + 未知（無 meta / 無 gender 都算未知）', () => {
    const students = [
      stu({ id: 's1' }),
      stu({ id: 's2' }),
      stu({ id: 's3' }),
      stu({ id: 's4' }), // 完全無 meta → 未知 + active
    ]
    const metas = [
      smeta({ studentId: 's1', gender: 'M' }),
      smeta({ studentId: 's2', gender: 'F' }),
      smeta({ studentId: 's3' }), // 有 meta 但無 gender → 未知
    ]
    const d = demographicsOf(students, metas)
    expect(d.gender).toEqual({ M: 1, F: 1, X: 0 })
    expect(d.genderUnknown).toBe(2) // s3 + s4
    // 4 個都係 active（s4 default active）
    expect(d.status).toEqual({ active: 4, transferred: 0, withdrawn: 0 })
  })

  it('狀態計數（default active 計入）', () => {
    const students = [stu({ id: 's1' }), stu({ id: 's2' }), stu({ id: 's3' })]
    const metas = [
      smeta({ studentId: 's1', status: 'withdrawn' }),
      smeta({ studentId: 's2', status: 'transferred' }),
      // s3 無 meta → active
    ]
    const d = demographicsOf(students, metas)
    expect(d.status).toEqual({ active: 1, transferred: 1, withdrawn: 1 })
  })

  it('班社按 count 由大到小排，空白 house 忽略', () => {
    // 紅 ×3、藍 ×2、（空白）×1（忽略）
    const students = [
      stu({ id: 's1' }),
      stu({ id: 's2' }),
      stu({ id: 's3' }),
      stu({ id: 's4' }),
      stu({ id: 's5' }),
      stu({ id: 's6' }),
    ]
    const metas = [
      smeta({ studentId: 's1', house: '紅' }),
      smeta({ studentId: 's2', house: '紅' }),
      smeta({ studentId: 's3', house: '紅' }),
      smeta({ studentId: 's4', house: '藍' }),
      smeta({ studentId: 's5', house: '藍' }),
      smeta({ studentId: 's6', house: '   ' }), // 空白 → 忽略
    ]
    const d = demographicsOf(students, metas)
    expect(d.house).toEqual([
      { name: '紅', count: 3 },
      { name: '藍', count: 2 },
    ])
  })
})

// ============================================================
//  studentSortKey — 數字學號照數字；否則 MAX + 字串
// ============================================================
describe('studentSortKey', () => {
  it('純數字學號 → [數值, 學號字串]', () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '12' }))).toEqual([12, '12'])
  })

  it('無學號 → [MAX, 姓名]', () => {
    expect(studentSortKey(stu({ id: 's', name: 'Amy' }))).toEqual([
      Number.MAX_SAFE_INTEGER,
      'Amy',
    ])
  })

  it('非數字學號（含字母）→ [MAX, 學號]', () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '5A', name: 'Bob' }))).toEqual([
      Number.MAX_SAFE_INTEGER,
      '5A',
    ])
  })

  it('學號前後空白會 trim', () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '  7  ' }))).toEqual([7, '7'])
  })

  it('空白字串學號 → 當無學號（用姓名做次序鍵）', () => {
    expect(studentSortKey(stu({ id: 's', studentNo: '   ', name: 'Zoe' }))).toEqual([
      Number.MAX_SAFE_INTEGER,
      'Zoe',
    ])
  })
})

// ============================================================
//  sortStudents — 數字升序，非數字殿後，tie 用 localeCompare
// ============================================================
describe('sortStudents', () => {
  it('數字學號升序（10 喺 2 之後，非字典序）', () => {
    const input = [
      stu({ id: 'a', studentNo: '10' }),
      stu({ id: 'b', studentNo: '2' }),
      stu({ id: 'c', studentNo: '1' }),
    ]
    expect(sortStudents(input).map((s) => s.studentNo)).toEqual(['1', '2', '10'])
  })

  it('非數字學號排去尾，數字喺前', () => {
    const input = [
      stu({ id: 'a', studentNo: 'B12' }),
      stu({ id: 'b', studentNo: '3' }),
      stu({ id: 'c', studentNo: '1' }),
    ]
    // 1、3 喺前（升序），B12 殿後（MAX）
    expect(sortStudents(input).map((s) => s.studentNo)).toEqual(['1', '3', 'B12'])
  })

  it('純函式：唔變動原陣列', () => {
    const input = [stu({ id: 'a', studentNo: '2' }), stu({ id: 'b', studentNo: '1' })]
    const snapshot = input.map((s) => s.id)
    sortStudents(input)
    expect(input.map((s) => s.id)).toEqual(snapshot) // 原陣列次序不變
  })

  it('空陣列 → 空陣列', () => {
    expect(sortStudents([])).toEqual([])
  })
})

// ============================================================
//  parseBulk — 多行貼上解析（學號喺前 / 後 / 純名）
// ============================================================
describe('parseBulk', () => {
  it('學號喺前（tab 分隔）', () => {
    expect(parseBulk('01\t陳大文')).toEqual([{ studentNo: '01', name: '陳大文' }])
  })

  it('學號喺後（逗號分隔）', () => {
    expect(parseBulk('陳大文,12')).toEqual([{ studentNo: '12', name: '陳大文' }])
  })

  it('名喺前、學號喺後（多空格分隔）', () => {
    expect(parseBulk('Mary Lee   03')).toEqual([{ studentNo: '03', name: 'Mary Lee' }])
  })

  it('純名（無似學號者）', () => {
    expect(parseBulk('陳大文')).toEqual([{ name: '陳大文' }])
  })

  it('空行 / 只有空白行會略過', () => {
    expect(parseBulk('\n   \n01\tAmy\n\n')).toEqual([{ studentNo: '01', name: 'Amy' }])
  })

  it('完全空字串 → 空陣列', () => {
    expect(parseBulk('')).toEqual([])
  })

  it('多行混合', () => {
    const out = parseBulk('01\tChan\nBob,02\n陳大文')
    expect(out).toEqual([
      { studentNo: '01', name: 'Chan' },
      { studentNo: '02', name: 'Bob' },
      { name: '陳大文' },
    ])
  })

  it('首尾兩欄都似學號 → 取第一欄做學號', () => {
    expect(parseBulk('01\t02')).toEqual([{ studentNo: '01', name: '02' }])
  })

  it('學號含 9 位（超過 8）→ 唔當學號，整行做名', () => {
    // 123456789 = 9 位，looksLikeNo 上限 8 → 唔似學號
    expect(parseBulk('123456789\tFoo')).toEqual([{ name: '123456789 Foo' }])
  })

  it('CRLF 換行都處理到', () => {
    expect(parseBulk('01\tAmy\r\n02\tBob')).toEqual([
      { studentNo: '01', name: 'Amy' },
      { studentNo: '02', name: 'Bob' },
    ])
  })
})

// ============================================================
//  buildSeatGrid — 固定座位優先，其餘填最前空格
// ============================================================
describe('buildSeatGrid', () => {
  it('固定座位 + 自動補位（rows × cols 形狀正確）', () => {
    const students = [
      stu({ id: 'A' }),
      stu({ id: 'B' }),
      stu({ id: 'C' }),
    ]
    // A 坐 2、B 坐 0、C 未排
    const metas = [
      smeta({ studentId: 'A', seat: 2 }),
      smeta({ studentId: 'B', seat: 0 }),
    ]
    const grid = buildSeatGrid(students, metas, 2)
    // placed = [B, C, A]（C 補去最前空格 idx1），rows = ceil(3/2)=2
    const ids = grid.map((row) => row.map((s) => s?.id ?? null))
    expect(ids).toEqual([
      ['B', 'C'],
      ['A', null],
    ])
  })

  it('全部未排座位：照原次序由前填滿', () => {
    const students = [stu({ id: 'A' }), stu({ id: 'B' }), stu({ id: 'C' }), stu({ id: 'D' })]
    const grid = buildSeatGrid(students, [], 2)
    const ids = grid.map((row) => row.map((s) => s?.id ?? null))
    expect(ids).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ])
  })

  it('cols <= 0 會夾到最少 1 欄（避免除零 / 空 grid）', () => {
    const students = [stu({ id: 'A' }), stu({ id: 'B' })]
    const grid = buildSeatGrid(students, [], 0)
    // C=max(1,0)=1，2 生 → 2 行 1 欄
    expect(grid.map((r) => r.map((s) => s?.id ?? null))).toEqual([['A'], ['B']])
  })

  it('空名冊：至少 1 行 1 欄（全 null）', () => {
    const grid = buildSeatGrid([], [], 3)
    // filledLen 0 → rows = max(1, ceil(0/3)) = 1
    expect(grid).toEqual([[null, null, null]])
  })

  it('每格都係 students 入面嘅實體（無殘留外來 id）', () => {
    const students = [stu({ id: 'A' })]
    const grid = buildSeatGrid(students, [smeta({ studentId: 'A', seat: 0 })], 1)
    expect(grid[0][0]).toBe(students[0])
  })
})

// ============================================================
//  csvEscape — 含 " , \n 先加引號；引號 double
// ============================================================
describe('csvEscape', () => {
  it('普通字串原樣', () => {
    expect(csvEscape('abc')).toBe('abc')
  })

  it('含逗號 → 包引號', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('含引號 → 包引號且引號 double', () => {
    expect(csvEscape('a"b')).toBe('"a""b"')
  })

  it('含換行 → 包引號', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })

  it('數字轉字串', () => {
    expect(csvEscape(42)).toBe('42')
  })

  it('數字 0 唔會變空（?? 唔當 0 為缺值）', () => {
    expect(csvEscape(0)).toBe('0')
  })
})

// ============================================================
//  initials — 取首字符；空 → '?'
// ============================================================
describe('initials', () => {
  it('英文首字母', () => {
    expect(initials('Chan')).toBe('C')
  })

  it('中文首字', () => {
    expect(initials('陳大文')).toBe('陳')
  })

  it('前置空白會 trim', () => {
    expect(initials('   John')).toBe('J')
  })

  it('空字串 → ?', () => {
    expect(initials('')).toBe('?')
  })

  it('只有空白 → ?', () => {
    expect(initials('   ')).toBe('?')
  })
})

// ============================================================
//  pctTone — 分段：>=80 green / >=50 accent / >=25 amber / else rose
// ============================================================
describe('pctTone', () => {
  it('邊界值（>=80 green）', () => {
    expect(pctTone(100)).toBe('green')
    expect(pctTone(80)).toBe('green')
    expect(pctTone(79)).toBe('accent')
  })

  it('邊界值（>=50 accent）', () => {
    expect(pctTone(50)).toBe('accent')
    expect(pctTone(49)).toBe('amber')
  })

  it('邊界值（>=25 amber）', () => {
    expect(pctTone(25)).toBe('amber')
    expect(pctTone(24)).toBe('rose')
  })

  it('0 / 負數 → rose', () => {
    expect(pctTone(0)).toBe('rose')
    expect(pctTone(-10)).toBe('rose')
  })
})

// ============================================================
//  classSizes — 逐班數人
// ============================================================
describe('classSizes', () => {
  const k = (id: string, name: string): Klass => ({ id, name, subject: 'BAFS' })

  it('正確計每班人數', () => {
    const classes = [k('k1', '5A'), k('k2', '5B')]
    const students = [
      stu({ id: 's1', classId: 'k1' }),
      stu({ id: 's2', classId: 'k1' }),
      stu({ id: 's3', classId: 'k2' }),
      stu({ id: 's4', classId: 'kX' }), // 唔屬任何列出嘅班
    ]
    const r = classSizes(classes, students)
    expect(r.map((x) => x.count)).toEqual([2, 1])
    expect(r[0].klass.id).toBe('k1')
  })

  it('無學生嘅班 → count 0', () => {
    const r = classSizes([k('k1', '5A')], [])
    expect(r).toEqual([{ klass: { id: 'k1', name: '5A', subject: 'BAFS' }, count: 0 }])
  })

  it('空班別陣列 → 空結果', () => {
    expect(classSizes([], [stu({ id: 's1' })])).toEqual([])
  })
})
