import { describe, expect, it } from 'vitest'
import {
  buildClassroomPackSystem,
  parseClassroomPack,
  type ClassroomPackInput,
} from './engine'

const input: ClassroomPackInput = {
  topic: '百分比應用',
  subjectName: '數學',
  className: '中二',
  durationMin: 45,
  curriculumBasis: '香港課程指引',
}

const validResponse = JSON.stringify({
  lesson: {
    objectives: '1. 能計算百分比\n2. 能解答生活應用題',
    phases: [
      { label: '引入', minutes: 5, detail: '觀察折扣標籤' },
      { label: '講解', minutes: 15, detail: '示範計算方法' },
      { label: '練習', minutes: 20, detail: '完成分層題目' },
      { label: '總結', minutes: 5, detail: '出口票' },
    ],
    materials: ['折扣標籤', '工作紙'],
    activities: '小組比較不同折扣方案。',
  },
  worksheet: {
    questions: [
      { type: 'mc', stem: '八折代表？', options: ['8%', '20%', '80%', '120%'], answerIndex: 2, marks: 1 },
      { type: 'mc', stem: '原價100元九折後？', options: ['10', '90', '100', '110'], answerIndex: 1, marks: 1 },
      { type: 'short', stem: '計算200元七五折後售價。', answer: '150元', marks: 2 },
      { type: 'mc', stem: '25% 等於？', options: ['0.025', '0.25', '2.5', '25'], answerIndex: 1, marks: 1 },
      { type: 'short', stem: '原價80元加價25%後是多少？', answer: '100元', marks: 2 },
      { type: 'short', stem: '解釋八折的意思。', answer: '售價是原價的80%。', marks: 2 },
    ],
  },
  presentation: {
    title: '百分比與折扣',
    subtitle: '數學 · 中二',
    slides: [
      { title: '折扣就在身邊', bullets: ['觀察售價標籤', '比較原價與售價'] },
      { title: '百分比化成小數', bullets: ['80% = 0.8', '售價 = 原價 × 折扣率'] },
      { title: '示範折扣計算', bullets: ['找出原價', '乘以折扣率'] },
      { title: '比較不同方案', bullets: ['先統一計算售價', '再比較差額'] },
      { title: '課堂練習', bullets: ['獨立完成', '核對計算步驟'] },
      { title: '總結', bullets: ['百分比化成小數', '連結生活情境'] },
    ],
  },
  curriculum: {
    alignment: ['運用百分比解決生活情境問題'],
    sourceSummary: '沒有外部來源；按所選課程框架作概括對應。',
  },
})

describe('課堂套裝生成引擎', () => {
  it('prompt 明確禁止虛構官方來源', () => {
    const prompt = buildClassroomPackSystem(input)
    expect(prompt).toContain('禁止虛構')
    expect(prompt).toContain('互相一致')
    expect(prompt).toContain('45 分鐘')
  })

  it('把一次生成拆成教案、工作紙及簡報', () => {
    const result = parseClassroomPack(validResponse, input.topic)
    expect(result.lesson.phases).toHaveLength(4)
    expect(result.questions).toHaveLength(6)
    expect(result.questions[0].type).toBe('mc')
    expect(result.deck.title).toBe('百分比與折扣')
    expect(result.curriculumAlignment).toEqual(['運用百分比解決生活情境問題'])
  })

  it('工作紙題目不足時拒絕儲存半製成品', () => {
    const broken = JSON.parse(validResponse)
    broken.worksheet.questions = broken.worksheet.questions.slice(0, 5)
    expect(() => parseClassroomPack(JSON.stringify(broken), input.topic)).toThrow(
      '工作紙題目不足',
    )
  })

  it('簡報不足五頁時拒絕儲存半製成品', () => {
    const broken = JSON.parse(validResponse)
    broken.presentation.slides = broken.presentation.slides.slice(0, 4)
    expect(() => parseClassroomPack(JSON.stringify(broken), input.topic)).toThrow(
      '簡報頁數不足',
    )
  })
})
