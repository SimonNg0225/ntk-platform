import { describe, it, expect } from 'vitest'
import {
  filterExercises,
  muscleIndex,
  equipmentList,
  countByCategory,
} from './util'
import { EXERCISES, type Exercise } from './data'

// ───────── 小型 fixture（獨立於 curated 資料，斷言唔受擴充影響）─────────
const ex = (over: Partial<Exercise> & { id: string }): Exercise => ({
  name: 'X',
  category: '胸',
  equipment: [],
  primaryMuscles: [],
  secondaryMuscles: [],
  formCues: [],
  safety: '',
  ...over,
})

const SAMPLE: Exercise[] = [
  ex({
    id: 'a',
    name: '槓鈴臥推（Bench Press）',
    category: '胸',
    equipment: ['槓鈴', '臥推架'],
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['肱三頭肌'],
  }),
  ex({
    id: 'b',
    name: '掌上壓（Push-up）',
    category: '胸',
    equipment: ['徒手'],
    primaryMuscles: ['胸大肌'],
    secondaryMuscles: ['肱三頭肌', '核心'],
  }),
  ex({
    id: 'c',
    name: '深蹲（Back Squat）',
    category: '腿',
    equipment: ['槓鈴', '深蹲架'],
    primaryMuscles: ['股四頭肌'],
    secondaryMuscles: ['臀大肌'],
  }),
]

describe('filterExercises', () => {
  it('無篩選回傳全部、保持原次序', () => {
    const out = filterExercises(SAMPLE)
    expect(out).toHaveLength(3)
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('q 對名稱大小寫無關 substring（中文）', () => {
    const out = filterExercises(SAMPLE, { q: '臥推' })
    expect(out.map((e) => e.id)).toEqual(['a'])
  })

  it('q 大小寫無關（英文）', () => {
    const out = filterExercises(SAMPLE, { q: 'squat' })
    expect(out).toHaveLength(1)
    expect(out[0]!.id).toBe('c')
  })

  it('q 空字串 / 全空白當作唔篩', () => {
    expect(filterExercises(SAMPLE, { q: '' })).toHaveLength(3)
    expect(filterExercises(SAMPLE, { q: '   ' })).toHaveLength(3)
  })

  it('q 無命中回空陣列（唔係 NaN/undefined）', () => {
    const out = filterExercises(SAMPLE, { q: '唔存在嘅動作' })
    expect(out).toEqual([])
  })

  it('按 category 篩', () => {
    expect(filterExercises(SAMPLE, { category: '胸' }).map((e) => e.id)).toEqual(
      ['a', 'b'],
    )
    expect(filterExercises(SAMPLE, { category: '腿' }).map((e) => e.id)).toEqual(
      ['c'],
    )
  })

  it("category '全部' 唔篩", () => {
    expect(filterExercises(SAMPLE, { category: '全部' })).toHaveLength(3)
  })

  it('按 equipment 篩（陣列包含比對）', () => {
    expect(
      filterExercises(SAMPLE, { equipment: '槓鈴' }).map((e) => e.id),
    ).toEqual(['a', 'c'])
    expect(
      filterExercises(SAMPLE, { equipment: '徒手' }).map((e) => e.id),
    ).toEqual(['b'])
  })

  it("equipment '全部' 唔篩", () => {
    expect(filterExercises(SAMPLE, { equipment: '全部' })).toHaveLength(3)
  })

  it('多條件 AND：胸 + 槓鈴 只剩 a', () => {
    const out = filterExercises(SAMPLE, { category: '胸', equipment: '槓鈴' })
    expect(out.map((e) => e.id)).toEqual(['a'])
  })

  it('多條件 AND：q + category 互相收窄', () => {
    const out = filterExercises(SAMPLE, { q: '掌上壓', category: '胸' })
    expect(out.map((e) => e.id)).toEqual(['b'])
    // q 命中但 category 唔夾 → 空
    expect(filterExercises(SAMPLE, { q: '掌上壓', category: '腿' })).toEqual([])
  })

  it('空陣列守衞', () => {
    expect(filterExercises([])).toEqual([])
    expect(filterExercises([], { q: '臥推' })).toEqual([])
  })

  it('all 非陣列守衞（回 []，唔 throw）', () => {
    // @ts-expect-error 故意傳錯型別測守衞
    expect(filterExercises(null)).toEqual([])
    // @ts-expect-error 故意傳錯型別測守衞
    expect(filterExercises(undefined)).toEqual([])
  })
})

describe('muscleIndex', () => {
  it('歸類主 / 次肌群（多對多）', () => {
    const idx = muscleIndex(SAMPLE)
    const chest = idx.find((b) => b.muscle === '胸大肌')!
    expect(chest).toBeTruthy()
    expect(chest.primary.map((e) => e.id)).toEqual(['a', 'b'])
    expect(chest.secondary).toHaveLength(0)

    const triceps = idx.find((b) => b.muscle === '肱三頭肌')!
    expect(triceps.primary).toHaveLength(0)
    expect(triceps.secondary.map((e) => e.id)).toEqual(['a', 'b'])
  })

  it('同肌群可同時有主同次（這裡股四頭=主、臀大肌=次）', () => {
    const idx = muscleIndex(SAMPLE)
    expect(idx.find((b) => b.muscle === '股四頭肌')!.primary.map((e) => e.id)).toEqual(
      ['c'],
    )
    expect(idx.find((b) => b.muscle === '臀大肌')!.secondary.map((e) => e.id)).toEqual(
      ['c'],
    )
  })

  it('涵蓋全部出現過嘅肌群（精確 6 個）', () => {
    const idx = muscleIndex(SAMPLE)
    expect(idx.map((b) => b.muscle).sort()).toEqual(
      ['股四頭肌', '肱三頭肌', '胸大肌', '臀大肌', '核心'].sort(),
    )
    expect(idx).toHaveLength(5)
  })

  it('按總出現次數由多到少排（胸大肌=2、肱三頭肌=2 排最前）', () => {
    const idx = muscleIndex(SAMPLE)
    const counts = idx.map((b) => b.primary.length + b.secondary.length)
    // 應為非升序
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i - 1]!).toBeGreaterThanOrEqual(counts[i]!)
    }
    expect(counts[0]).toBe(2)
  })

  it('忽略空字串肌群、缺欄位當空', () => {
    const weird: Exercise[] = [
      ex({ id: 'x', primaryMuscles: ['', '腹直肌'] }),
      // 缺 secondaryMuscles 仍要安全
      { id: 'y', name: 'Y', category: '核心', equipment: [], primaryMuscles: ['腹直肌'], secondaryMuscles: [], formCues: [], safety: '' },
    ]
    const idx = muscleIndex(weird)
    expect(idx).toHaveLength(1)
    expect(idx[0]!.muscle).toBe('腹直肌')
    expect(idx[0]!.primary).toHaveLength(2)
  })

  it('空陣列 / 非陣列守衞', () => {
    expect(muscleIndex([])).toEqual([])
    // @ts-expect-error 故意傳錯型別
    expect(muscleIndex(null)).toEqual([])
  })
})

describe('equipmentList', () => {
  it('去重 + 保插入序', () => {
    expect(equipmentList(SAMPLE)).toEqual(['槓鈴', '臥推架', '徒手', '深蹲架'])
  })

  it('空陣列 / 非陣列守衞', () => {
    expect(equipmentList([])).toEqual([])
    // @ts-expect-error 故意傳錯型別
    expect(equipmentList(undefined)).toEqual([])
  })
})

describe('countByCategory', () => {
  it('準確逐類計數', () => {
    const c = countByCategory(SAMPLE)
    expect(c.胸).toBe(2)
    expect(c.腿).toBe(1)
    expect(c.背).toBe(0)
    expect(c.全身).toBe(0)
  })

  it('空 / 非陣列回全 0', () => {
    const c = countByCategory([])
    expect(c.胸).toBe(0)
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(0)
    // @ts-expect-error 故意傳錯型別
    expect(countByCategory(null).胸).toBe(0)
  })
})

// ───────── curated 資料完整性（內容品質守門）─────────
describe('EXERCISES 資料完整性', () => {
  it('至少 24 個動作', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(24)
  })

  it('涵蓋全部 7 個 category', () => {
    const cats = new Set(EXERCISES.map((e) => e.category))
    expect(cats.size).toBe(7)
    for (const c of ['胸', '背', '腿', '肩', '手臂', '核心', '全身'] as const) {
      expect(cats.has(c)).toBe(true)
    }
  })

  it('每個動作 id 獨一無二', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每個動作 form cues 為 2-4 條、有主肌群同器材同 safety', () => {
    for (const e of EXERCISES) {
      expect(e.formCues.length).toBeGreaterThanOrEqual(2)
      expect(e.formCues.length).toBeLessThanOrEqual(4)
      expect(e.primaryMuscles.length).toBeGreaterThanOrEqual(1)
      expect(e.equipment.length).toBeGreaterThanOrEqual(1)
      expect(e.safety.length).toBeGreaterThan(0)
    }
  })
})
