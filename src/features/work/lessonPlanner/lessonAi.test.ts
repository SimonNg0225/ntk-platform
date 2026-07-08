import { describe, it, expect } from 'vitest'
import { buildLessonSystem, parseLessonGen } from './lessonAi'

const good = JSON.stringify({
  objectives: '1. 學生能說明收入的定義\n2. 學生能用五步模型確認收入',
  phases: [
    { label: '引入', minutes: 5, detail: '提問：賣出貨品但未收款是否算收入？' },
    { label: '講解', minutes: 20, detail: '逐步講五步模型' },
    { label: '課堂活動', minutes: 20, detail: '分組做個案' },
    { label: '總結', minutes: 10, detail: '回顧重點' },
  ],
  materials: ['PowerPoint 簡報', '課堂工作紙', 'DSE 過往試題'],
  activities: '分組討論香港零售個案，匯報收入確認時點。',
})

describe('parseLessonGen', () => {
  it('解析正常回應', () => {
    const r = parseLessonGen(good)
    expect(r.objectives).toContain('收入的定義')
    expect(r.phases).toHaveLength(4)
    expect(r.phases[0]).toEqual({ label: '引入', minutes: 5, detail: '提問：賣出貨品但未收款是否算收入？' })
    expect(r.materials).toEqual(['PowerPoint 簡報', '課堂工作紙', 'DSE 過往試題'])
    expect(r.activities).toContain('分組討論')
  })

  it('包住 markdown code fence 都解到', () => {
    const r = parseLessonGen('```json\n' + good + '\n```')
    expect(r.phases).toHaveLength(4)
  })

  it('minutes clamp 0–120、取整', () => {
    const r = parseLessonGen(
      JSON.stringify({ objectives: 'x', phases: [{ label: 'A', minutes: 999, detail: '' }, { label: 'B', minutes: -5, detail: '' }, { label: 'C', minutes: 12.7, detail: '' }], materials: [], activities: '' }),
    )
    expect(r.phases[0].minutes).toBe(120)
    expect(r.phases[1].minutes).toBe(0)
    expect(r.phases[2].minutes).toBe(13)
  })

  it('phases 上限 8、materials 上限 12', () => {
    const phases = Array.from({ length: 12 }, (_, i) => ({ label: `P${i}`, minutes: 5, detail: '' }))
    const materials = Array.from({ length: 20 }, (_, i) => `M${i}`)
    const r = parseLessonGen(JSON.stringify({ objectives: 'x', phases, materials, activities: '' }))
    expect(r.phases).toHaveLength(8)
    expect(r.materials).toHaveLength(12)
  })

  it('phase 無 label 跳過；materials 空字串隔走', () => {
    const r = parseLessonGen(
      JSON.stringify({ objectives: 'x', phases: [{ label: '', minutes: 5, detail: 'd' }, { label: '有效', minutes: 5, detail: '' }], materials: ['', '  ', '工作紙'], activities: '' }),
    )
    expect(r.phases).toHaveLength(1)
    expect(r.phases[0].label).toBe('有效')
    expect(r.materials).toEqual(['工作紙'])
  })

  it('壞 JSON → throw', () => {
    expect(() => parseLessonGen('不是 json')).toThrow()
  })

  it('完全冇 objectives 同 phases → throw', () => {
    expect(() => parseLessonGen(JSON.stringify({ objectives: '', phases: [], materials: [], activities: '' }))).toThrow()
  })

  it('detail / objectives / activities 過長會截斷', () => {
    const long = 'x'.repeat(500)
    const r = parseLessonGen(
      JSON.stringify({ objectives: long, phases: [{ label: 'A', minutes: 5, detail: long }], materials: [], activities: long }),
    )
    expect(r.objectives.length).toBeLessThanOrEqual(600)
    expect(r.phases[0].detail.length).toBeLessThanOrEqual(200)
    expect(r.activities.length).toBeLessThanOrEqual(600)
  })
})

describe('buildLessonSystem', () => {
  it('未選教學設計元素時不加入理論指令', () => {
    const prompt = buildLessonSystem({ topic: '收入確認', brief: '', durationMin: 55 })
    expect(prompt).not.toContain('教學設計元素：必須自然融入以下元素')
  })

  it('選中的教學設計元素會注入 prompt', () => {
    const prompt = buildLessonSystem({
      topic: '市場營銷',
      brief: '用個案分析',
      pedagogyIds: ['ai-learning', 'bloom-taxonomy', 'assessment-for-learning'],
    })
    expect(prompt).toContain('配合 AI 學習元素')
    expect(prompt).toContain('Bloom Taxonomy')
    expect(prompt).toContain('促進學習的評估')
    expect(prompt).toContain('不要把教案變成理論清單')
  })

  it('未知 id 會被忽略', () => {
    const prompt = buildLessonSystem({
      topic: '市場營銷',
      brief: '',
      pedagogyIds: ['missing', 'udl'],
    })
    expect(prompt).toContain('UDL')
    expect(prompt).not.toContain('missing')
  })
})
