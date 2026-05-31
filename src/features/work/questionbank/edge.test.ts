import { describe, it, expect } from 'vitest'
import {
  computeStats,
  buildTopicRows,
  similarity,
  findDuplicates,
  assemblePaper,
  questionsToCsv,
  parseCsv,
  rowsToQuestions,
  type TopicLite,
  type Blueprint,
} from './util'
import type { Question } from '../../../data/types'

// ───────── 測試用 Question 工廠 ─────────
let _seq = 0
const q = (over: Partial<Question> = {}): Question => {
  _seq++
  return {
    id: over.id ?? `q${_seq}`,
    topicId: 'T1',
    type: 'short',
    difficulty: 'medium',
    stem: '題目',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

const bp = (over: Partial<Blueprint> = {}): Blueprint => ({
  topicIds: [],
  type: '',
  counts: { easy: 0, medium: 0, hard: 0 },
  ...over,
})

// ============================================================
//  computeStats — 補充未覆蓋嘅四捨五入邊界（向上）
// ============================================================
describe('computeStats（補充邊界）', () => {
  it('1易2難：avg=7/3，難度指數向上四捨五入 → 67', () => {
    // easy(1)+hard(3)+hard(3) = 7, n=3, avg=7/3
    //  ((7/3 - 1)/2)*100 = ((1.3333)/2)*100 = 66.67 → round = 67
    const s = computeStats(
      [
        q({ difficulty: 'easy' }),
        q({ difficulty: 'hard' }),
        q({ difficulty: 'hard' }),
      ],
      10,
    )
    expect(s.difficultyIndex).toBe(67)
  })

  it('單題題庫：n=1 唔觸發除零，difficultyIndex 正常', () => {
    const easy = computeStats([q({ difficulty: 'easy' })], 1)
    expect(easy.difficultyIndex).toBe(0)
    expect(Number.isNaN(easy.difficultyIndex)).toBe(false)
    expect(easy.total).toBe(1)
  })

  it('全部同一課題：topicsCovered = 1（去重）', () => {
    const s = computeStats(
      [q({ topicId: 'X' }), q({ topicId: 'X' }), q({ topicId: 'X' })],
      5,
    )
    expect(s.topicsCovered).toBe(1)
  })
})

// ============================================================
//  buildTopicRows — 多題同課題各桶累加 + marks 缺值當 0
// ============================================================
describe('buildTopicRows（補充）', () => {
  const topics: TopicLite[] = [{ id: 'T1', topic: '課題一', area: '甲部' }]

  it('多題同課題：各難度 / 題型桶分別累加，marks 缺值當 0', () => {
    const rows = buildTopicRows(
      [
        q({ topicId: 'T1', difficulty: 'easy', type: 'mc', marks: 2 }),
        q({ topicId: 'T1', difficulty: 'easy', type: 'mc', marks: undefined }),
        q({ topicId: 'T1', difficulty: 'hard', type: 'short', marks: 3 }),
      ],
      topics,
    )
    const t1 = rows.find((r) => r.topicId === 'T1')!
    expect(t1.total).toBe(3)
    expect(t1.byDiff).toEqual({ easy: 2, medium: 0, hard: 1 })
    expect(t1.byType).toEqual({ mc: 2, short: 1, long: 0, case: 0 })
    expect(t1.marks).toBe(5) // 2 + 0 + 3
  })

  it('多條題目落同一未知課題 → 合併到同一「未分類」行', () => {
    const rows = buildTopicRows(
      [q({ topicId: 'GHOST' }), q({ topicId: 'GHOST' })],
      topics,
    )
    const ghost = rows.filter((r) => r.topicId === 'GHOST')
    expect(ghost).toHaveLength(1)
    expect(ghost[0].topic).toBe('未分類')
    expect(ghost[0].total).toBe(2)
  })
})

// ============================================================
//  similarity — threshold 兩邊（剛好等於 / 略低）由 findDuplicates 用
//  呢度直接驗 similarity 數值，確保下面 findDuplicates 嘅手算正確
// ============================================================
describe('similarity（補充數值錨點）', () => {
  it('1234567890 vs 1234567abc → 0.5（供 transitivity 測試用）', () => {
    expect(similarity('1234567890', '1234567abc')).toBeCloseTo(0.5, 6)
  })
  it('1234567abc vs abc4567890 → 約 0.3846（< 0.45 threshold）', () => {
    expect(similarity('1234567abc', 'abc4567890')).toBeCloseTo(0.3846, 3)
  })
  it('abcdefghij vs abcdefghik → 0.8（供 cluster-3 測試用）', () => {
    expect(similarity('abcdefghij', 'abcdefghik')).toBeCloseTo(0.8, 6)
  })
})

// ============================================================
//  findDuplicates — 補充：used set / cluster min / 傳遞性 / 排序
// ============================================================
describe('findDuplicates（補充）', () => {
  it('已被 exact 標記嘅題唔再進 similar 比對（used set）', () => {
    // a,b 完全相同（exact）；c 同 a 高相似但 a 已被 used，c 自成單獨（唔成群）
    const groups = findDuplicates(
      [
        q({ id: 'a', type: 'short', stem: 'abcdefgh' }),
        q({ id: 'b', type: 'short', stem: 'abcdefgh' }), // 同 a → exact
        q({ id: 'c', type: 'short', stem: 'abcdefgi' }), // 同 a 相似 0.75
      ],
      0.5,
    )
    // 只應有 1 個 exact 群（a,b）；c 唔會同已 used 嘅 a 成 similar 群
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('exact')
    expect(groups[0].questions.map((x) => x.id).sort()).toEqual(['a', 'b'])
  })

  it('相似群 cluster score = Math.min(錨點 vs 各成員)（3 成員）', () => {
    // 三題互不完全相同（避免 exact），錨點 a 對 b、c 各 0.8
    const groups = findDuplicates(
      [
        q({ id: 'a', stem: 'abcdefghij' }),
        q({ id: 'b', stem: 'abcdefghik' }), // a~b = 0.8
        q({ id: 'c', stem: 'abcdefghil' }), // a~c = 0.8
      ],
      0.7,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('similar')
    expect(groups[0].questions).toHaveLength(3)
    // cluster score = min(a~b, a~c) = 0.8
    expect(groups[0].score).toBeCloseTo(0.8, 6)
  })

  it('傳遞性：a~b 且 a~c（>= thr）但 b 唔~c → 仍全併入錨點 a 嘅群', () => {
    // a~b = a~c = 0.5 (>=0.45)，b~c ≈ 0.385 (<0.45)
    const groups = findDuplicates(
      [
        q({ id: 'a', stem: '1234567890' }),
        q({ id: 'b', stem: '1234567abc' }),
        q({ id: 'c', stem: 'abc4567890' }),
      ],
      0.45,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('similar')
    // b、c 雖然互相唔似，但都由錨點 a 拉入同一群
    expect(groups[0].questions.map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
    // cluster score = min(a~b, a~c) = 0.5
    expect(groups[0].score).toBeCloseTo(0.5, 6)
  })

  it('threshold 剛好等於 → 成群（>= 而非 >）', () => {
    // a~b = 0.75；threshold 設 0.75 → 應成群
    const groups = findDuplicates(
      [q({ id: 'a', stem: 'abcdefgh' }), q({ id: 'b', stem: 'abcdefgi' })],
      0.75,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('similar')
  })

  it('多個群組按 score 降序排列（exact=1 排最前）', () => {
    const groups = findDuplicates(
      [
        // exact 群 (score 1)
        q({ id: 'x1', type: 'short', stem: '完全相同題' }),
        q({ id: 'x2', type: 'short', stem: '完全相同題' }),
        // similar 群 (score 0.75 < 1)
        q({ id: 's1', type: 'long', stem: 'abcdefgh' }),
        q({ id: 's2', type: 'long', stem: 'abcdefgi' }),
      ],
      0.5,
    )
    expect(groups).toHaveLength(2)
    // 降序：第一個 score 應 >= 第二個
    expect(groups[0].score).toBeGreaterThanOrEqual(groups[1].score)
    expect(groups[0].score).toBe(1) // exact 在前
    expect(groups[0].reason).toBe('exact')
    expect(groups[1].reason).toBe('similar')
  })
})

// ============================================================
//  assemblePaper — round-robin 平均覆蓋 + 揭發 counts 溢位 bug
// ============================================================
describe('assemblePaper（補充）', () => {
  it('round-robin：need < 課題數時，先逐課題各抽一題（平均覆蓋）', () => {
    // 3 個課題、每課題 2 題 easy（共 6 題），只需 3 題 easy
    // round-robin 第一輪即抽滿 3 題 → 應每個課題各 1 題（覆蓋 3 個課題）
    // shuffle 有隨機性，故跑多次驗證「每次都覆蓋 3 個唔同課題」嘅不變量
    const pool = [
      q({ id: 'a1', topicId: 'A', difficulty: 'easy' }),
      q({ id: 'a2', topicId: 'A', difficulty: 'easy' }),
      q({ id: 'b1', topicId: 'B', difficulty: 'easy' }),
      q({ id: 'b2', topicId: 'B', difficulty: 'easy' }),
      q({ id: 'c1', topicId: 'C', difficulty: 'easy' }),
      q({ id: 'c2', topicId: 'C', difficulty: 'easy' }),
    ]
    for (let i = 0; i < 30; i++) {
      const r = assemblePaper(pool, bp({ counts: { easy: 3, medium: 0, hard: 0 } }))
      expect(r.picked).toHaveLength(3)
      const topicsHit = new Set(r.picked.map((x) => x.topicId))
      expect(topicsHit.size).toBe(3) // 三個課題都各被覆蓋
      expect(r.shortfall.easy).toBe(0)
    }
  })

  it('單一課題池夠多：照抽指定數量（無 round-robin 偏差）', () => {
    const pool = Array.from({ length: 5 }, (_, i) =>
      q({ id: `e${i}`, topicId: 'ONLY', difficulty: 'easy' }),
    )
    const r = assemblePaper(pool, bp({ counts: { easy: 3, medium: 0, hard: 0 } }))
    expect(r.picked).toHaveLength(3)
    expect(r.picked.every((x) => x.topicId === 'ONLY')).toBe(true)
    expect(r.shortfall.easy).toBe(0)
  })

  it('counts 為極大值（> 2^31-1）：應抽盡題池而非因整數溢位抽 0 題', () => {
    // UI（QuestionBank.tsx setCount）只移除非數字、無上限 clamp，
    // 故老師貼上 10 位數字時 counts 可達溢位範圍。
    // 正確行為：把題池抽盡（此處 2 題 easy），shortfall = 需求 - 已抽。
    const pool = [
      q({ id: 'e1', topicId: 'A', difficulty: 'easy' }),
      q({ id: 'e2', topicId: 'B', difficulty: 'easy' }),
    ]
    const huge = 3_000_000_000 // > 2147483647，位元 OR 會溢位變負
    const r = assemblePaper(
      pool,
      bp({ counts: { easy: huge, medium: 0, hard: 0 } }),
    )
    expect(r.picked).toHaveLength(2) // 抽盡題池
    expect(r.shortfall.easy).toBe(huge - 2) // 欠數正確（非負、非 0）
  })
})

// ============================================================
//  questionsToCsv — 補充：MC 缺 answerIndex / 空陣列
// ============================================================
describe('questionsToCsv（補充）', () => {
  const name = (id: string) => (id === 'T1' ? '課題一' : '未分類')

  it('MC 缺 answerIndex → answer 欄為空字串', () => {
    const csv = questionsToCsv(
      [q({ type: 'mc', stem: 'Q', options: ['a', 'b'], answerIndex: undefined })],
      name,
    )
    const cols = csv.split('\n')[1].split(',')
    expect(cols[8]).toBe('') // answer 欄
  })

  it('MC answerIndex=0 → 字母 A（0 係有效 index）', () => {
    const csv = questionsToCsv(
      [q({ type: 'mc', stem: 'Q', options: ['a', 'b'], answerIndex: 0 })],
      name,
    )
    const cols = csv.split('\n')[1].split(',')
    expect(cols[8]).toBe('A')
  })

  it('空題目陣列 → 只有表頭一行', () => {
    const csv = questionsToCsv([], name)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(
      'topic,type,difficulty,stem,optionA,optionB,optionC,optionD,answer,marks',
    )
  })
})

// ============================================================
//  parseCsv — 補充：檔尾無換行嘅最後一行收尾
// ============================================================
describe('parseCsv（補充）', () => {
  it('檔尾無換行：最後一行正確收尾', () => {
    // 無結尾 \n，收尾邏輯應 push 最後 row
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('單一無換行行：收尾 push', () => {
    expect(parseCsv('only')).toEqual([['only']])
  })

  it('結尾引號欄無換行：正確 push', () => {
    expect(parseCsv('a,"b,c"')).toEqual([['a', 'b,c']])
  })
})

// ============================================================
//  rowsToQuestions — 補充：小寫答案字母 / 小數 marks / fuzzy 反向
// ============================================================
describe('rowsToQuestions（補充）', () => {
  const topics: TopicLite[] = [
    { id: 'T1', topic: '香港營商環境' },
    { id: 'T2', topic: '會計概念' },
  ]

  it('MC 小寫答案字母 a–d → 對應 index', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'o1', 'o2', 'o3', 'o4', 'c', '1']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].answerIndex).toBe(2) // c → 2
  })

  it('marks 帶小數「2.5分」→ 抽出 2.5', () => {
    const rows = [['T', 'short', 'easy', '題幹', '', '', '', '', '', '2.5分']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].marks).toBe(2.5)
  })

  it('課題 fuzzy 反向：題目課題名較長、包含現有課題名', () => {
    // n='香港營商環境（必修甲一）' 包含 t.topic='香港營商環境' → n.includes(t.topic)
    const rows = [
      ['香港營商環境（必修甲一）', 'short', 'easy', '題幹', '', '', '', '', '', ''],
    ]
    expect(rowsToQuestions(rows, topics).parsed[0].topicId).toBe('T1')
  })

  it('MC answer=1（1-based）→ index 0', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'o1', 'o2', '', '', '1', '1']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].answerIndex).toBe(0)
  })

  it('無 topics（空陣列）：fallbackTopic = 空字串', () => {
    const rows = [['任何課題', 'short', 'easy', '題幹', '', '', '', '', '', '']]
    const { parsed } = rowsToQuestions(rows, [])
    expect(parsed[0].topicId).toBe('')
  })
})
