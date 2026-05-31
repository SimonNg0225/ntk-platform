import { describe, it, expect } from 'vitest'
import {
  sortQuestions,
  computeStats,
  difficultyIndexLabel,
  buildTopicRows,
  coverageGaps,
  normStem,
  similarity,
  findDuplicates,
  assemblePaper,
  questionsToCsv,
  parseCsv,
  rowsToQuestions,
  csvTemplate,
  buildPrintHtml,
  emptyBlueprint,
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

// ============================================================
//  sortQuestions
// ============================================================
describe('sortQuestions', () => {
  it('new：createdAt 由新到舊（降序）', () => {
    const list = [
      q({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
      q({ id: 'b', createdAt: '2026-03-01T00:00:00Z' }),
      q({ id: 'c', createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortQuestions(list, 'new').map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('old：createdAt 由舊到新（升序）', () => {
    const list = [
      q({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }),
      q({ id: 'b', createdAt: '2026-03-01T00:00:00Z' }),
      q({ id: 'c', createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortQuestions(list, 'old').map((x) => x.id)).toEqual(['a', 'c', 'b'])
  })

  it('marksDesc / marksAsc：缺 marks 當作 0', () => {
    const list = [
      q({ id: 'a', marks: 5 }),
      q({ id: 'b', marks: undefined }),
      q({ id: 'c', marks: 10 }),
    ]
    expect(sortQuestions(list, 'marksDesc').map((x) => x.id)).toEqual([
      'c',
      'a',
      'b',
    ])
    expect(sortQuestions(list, 'marksAsc').map((x) => x.id)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('difficulty：易→中→難（按權重 1<2<3）', () => {
    const list = [
      q({ id: 'h', difficulty: 'hard' }),
      q({ id: 'e', difficulty: 'easy' }),
      q({ id: 'm', difficulty: 'medium' }),
    ]
    expect(sortQuestions(list, 'difficulty').map((x) => x.id)).toEqual([
      'e',
      'm',
      'h',
    ])
  })

  it('唔修改原陣列（純函式）', () => {
    const list = [q({ id: 'a' }), q({ id: 'b' })]
    const snapshot = list.map((x) => x.id)
    sortQuestions(list, 'old')
    expect(list.map((x) => x.id)).toEqual(snapshot)
  })

  it('空陣列回空陣列', () => {
    expect(sortQuestions([], 'new')).toEqual([])
    expect(sortQuestions([], 'difficulty')).toEqual([])
  })
})

// ============================================================
//  computeStats — 含除法 / 難度指數映射 / 空輸入
// ============================================================
describe('computeStats', () => {
  it('空題庫：所有值 0，difficultyIndex 唔係 NaN', () => {
    const s = computeStats([], 5)
    expect(s.total).toBe(0)
    expect(s.totalMarks).toBe(0)
    expect(s.withAnswer).toBe(0)
    expect(s.aiCount).toBe(0)
    expect(s.topicsCovered).toBe(0)
    expect(s.difficultyIndex).toBe(0)
    expect(Number.isNaN(s.difficultyIndex)).toBe(false)
    expect(s.byType).toEqual({ mc: 0, short: 0, long: 0, case: 0 })
    expect(s.byDiff).toEqual({ easy: 0, medium: 0, hard: 0 })
  })

  it('全 easy → difficultyIndex 0；全 hard → 100；全 medium → 50', () => {
    const easy = computeStats(
      [q({ difficulty: 'easy' }), q({ difficulty: 'easy' })],
      10,
    )
    expect(easy.difficultyIndex).toBe(0)

    const hard = computeStats(
      [q({ difficulty: 'hard' }), q({ difficulty: 'hard' })],
      10,
    )
    expect(hard.difficultyIndex).toBe(100)

    const med = computeStats([q({ difficulty: 'medium' })], 10)
    expect(med.difficultyIndex).toBe(50)
  })

  it('混合難度：weightSum/n 線性映射至 0–100（手算）', () => {
    // easy(1)+medium(2)+hard(3) = 6, n=3, avg=2 → ((2-1)/2)*100 = 50
    const mix = computeStats(
      [
        q({ difficulty: 'easy' }),
        q({ difficulty: 'medium' }),
        q({ difficulty: 'hard' }),
      ],
      10,
    )
    expect(mix.difficultyIndex).toBe(50)

    // easy+easy+hard = 1+1+3 = 5, n=3, avg=5/3 → ((5/3-1)/2)*100
    //  = ((0.6667)/2)*100 = 33.33 → round = 33
    const skew = computeStats(
      [
        q({ difficulty: 'easy' }),
        q({ difficulty: 'easy' }),
        q({ difficulty: 'hard' }),
      ],
      10,
    )
    expect(skew.difficultyIndex).toBe(33)
  })

  it('byType / byDiff 分桶計數', () => {
    const s = computeStats(
      [
        q({ type: 'mc', difficulty: 'easy' }),
        q({ type: 'mc', difficulty: 'hard' }),
        q({ type: 'long', difficulty: 'medium' }),
      ],
      10,
    )
    expect(s.byType).toEqual({ mc: 2, short: 0, long: 1, case: 0 })
    expect(s.byDiff).toEqual({ easy: 1, medium: 1, hard: 1 })
    expect(s.total).toBe(3)
  })

  it('totalMarks 累加（缺者當 0）', () => {
    const s = computeStats(
      [q({ marks: 5 }), q({ marks: undefined }), q({ marks: 3 })],
      10,
    )
    expect(s.totalMarks).toBe(8)
  })

  it('withAnswer：MC 看 answerIndex（0 都算有），非 MC 看 answer.trim()', () => {
    const s = computeStats(
      [
        q({ type: 'mc', answerIndex: 0 }), // 有（index 0 係有效答案）
        q({ type: 'mc', answerIndex: undefined }), // 無
        q({ type: 'short', answer: '  ' }), // 空白 → 無
        q({ type: 'short', answer: '答案' }), // 有
      ],
      10,
    )
    expect(s.withAnswer).toBe(2)
  })

  it('aiCount：source 含 AI', () => {
    const s = computeStats(
      [
        q({ source: 'AI 生成' }),
        q({ source: '手動' }),
        q({ source: undefined }),
        q({ source: 'imported-AI' }),
      ],
      10,
    )
    expect(s.aiCount).toBe(2)
  })

  it('topicsCovered：唔同課題去重，且封頂於 totalTopics', () => {
    const s = computeStats(
      [q({ topicId: 'A' }), q({ topicId: 'A' }), q({ topicId: 'B' })],
      5,
    )
    expect(s.topicsCovered).toBe(2)

    // 出現 3 個課題但 totalTopics=2 → 封頂 2
    const capped = computeStats(
      [q({ topicId: 'A' }), q({ topicId: 'B' }), q({ topicId: 'C' })],
      2,
    )
    expect(capped.topicsCovered).toBe(2)

    // totalTopics=0 → fallback 用實際課題數
    const zero = computeStats([q({ topicId: 'A' }), q({ topicId: 'B' })], 0)
    expect(zero.topicsCovered).toBe(2)
  })
})

// ============================================================
//  difficultyIndexLabel — 邊界
// ============================================================
describe('difficultyIndexLabel', () => {
  it('邊界：<34 偏易、34..66 適中、>=67 偏難', () => {
    expect(difficultyIndexLabel(0)).toBe('偏易')
    expect(difficultyIndexLabel(33)).toBe('偏易')
    expect(difficultyIndexLabel(34)).toBe('適中')
    expect(difficultyIndexLabel(50)).toBe('適中')
    expect(difficultyIndexLabel(66)).toBe('適中')
    expect(difficultyIndexLabel(67)).toBe('偏難')
    expect(difficultyIndexLabel(100)).toBe('偏難')
  })
})

// ============================================================
//  buildTopicRows / coverageGaps
// ============================================================
describe('buildTopicRows', () => {
  const topics: TopicLite[] = [
    { id: 'T1', topic: '香港營商環境', area: '甲部' },
    { id: 'T2', topic: '會計概念' }, // 無 area → 預設「其他」
  ]

  it('每個課題建一行，無題目時計數為 0，area 預設「其他」', () => {
    const rows = buildTopicRows([], topics)
    expect(rows).toHaveLength(2)
    const t1 = rows.find((r) => r.topicId === 'T1')!
    expect(t1.total).toBe(0)
    expect(t1.area).toBe('甲部')
    expect(t1.byDiff).toEqual({ easy: 0, medium: 0, hard: 0 })
    const t2 = rows.find((r) => r.topicId === 'T2')!
    expect(t2.area).toBe('其他')
  })

  it('累加題目到對應課題，分難度 / 題型 / 分數', () => {
    const rows = buildTopicRows(
      [
        q({ topicId: 'T1', difficulty: 'easy', type: 'mc', marks: 1 }),
        q({ topicId: 'T1', difficulty: 'hard', type: 'long', marks: 5 }),
        q({ topicId: 'T2', difficulty: 'medium', type: 'short', marks: 3 }),
      ],
      topics,
    )
    const t1 = rows.find((r) => r.topicId === 'T1')!
    expect(t1.total).toBe(2)
    expect(t1.byDiff).toEqual({ easy: 1, medium: 0, hard: 1 })
    expect(t1.byType).toEqual({ mc: 1, short: 0, long: 1, case: 0 })
    expect(t1.marks).toBe(6)
    const t2 = rows.find((r) => r.topicId === 'T2')!
    expect(t2.total).toBe(1)
    expect(t2.marks).toBe(3)
  })

  it('未知課題 → 建「未分類」合成行', () => {
    const rows = buildTopicRows([q({ topicId: 'GHOST' })], topics)
    const ghost = rows.find((r) => r.topicId === 'GHOST')!
    expect(ghost).toBeTruthy()
    expect(ghost.topic).toBe('未分類')
    expect(ghost.total).toBe(1)
  })
})

describe('coverageGaps', () => {
  it('回 total=0 嘅真課題，排除「未分類」合成行', () => {
    const topics: TopicLite[] = [
      { id: 'T1', topic: '有題目' },
      { id: 'T2', topic: '冇題目' },
    ]
    const rows = buildTopicRows([q({ topicId: 'T1' }), q({ topicId: 'X' })], topics)
    const gaps = coverageGaps(rows)
    expect(gaps.map((r) => r.topicId)).toEqual(['T2'])
  })

  it('全部有題目 → 無缺口', () => {
    const topics: TopicLite[] = [{ id: 'T1', topic: 'a' }]
    const rows = buildTopicRows([q({ topicId: 'T1' })], topics)
    expect(coverageGaps(rows)).toEqual([])
  })
})

// ============================================================
//  normStem — 標準化（標點 / 空白 / 全形空格 / 大小寫）
// ============================================================
describe('normStem', () => {
  it('去普通空白 + 全形空格', () => {
    expect(normStem('a b　c')).toBe('abc')
    expect(normStem('  hello  world ')).toBe('helloworld')
  })

  it('去中英標點', () => {
    expect(normStem('你好，世界。')).toBe('你好世界')
    expect(normStem('Hello, World!')).toBe('helloworld')
    expect(normStem('(a)[b]{c}')).toBe('abc')
  })

  it('轉細楷', () => {
    expect(normStem('ABC')).toBe('abc')
  })

  it('空字串 → 空字串', () => {
    expect(normStem('')).toBe('')
    expect(normStem('！？。、')).toBe('')
  })
})

// ============================================================
//  similarity — Jaccard bigram，含除零 / 邊界
// ============================================================
describe('similarity', () => {
  it('完全相同 → 1', () => {
    expect(similarity('機會成本', '機會成本')).toBe(1)
    expect(similarity('abcd', 'abcd')).toBe(1)
  })

  it('完全唔同 → 0', () => {
    expect(similarity('abcd', 'wxyz')).toBe(0)
  })

  it('部分重疊：手算 Jaccard', () => {
    // 'abc' bigrams {ab,bc}；'abd' bigrams {ab,bd}
    //  交集 {ab}=1，聯集 = 2+2-1 = 3 → 1/3
    expect(similarity('abc', 'abd')).toBeCloseTo(1 / 3, 6)
  })

  it('單字元：相同→1、不同→0（不除零）', () => {
    expect(similarity('a', 'a')).toBe(1)
    expect(similarity('a', 'b')).toBe(0)
  })

  it('兩個空字串 → 1（皆標準化為空）', () => {
    expect(similarity('', '')).toBe(1)
  })

  it('標準化後忽略標點 / 大小寫差異', () => {
    expect(similarity('機會成本？', '機會成本')).toBe(1)
    expect(similarity('Hello World', 'helloworld')).toBe(1)
  })
})

// ============================================================
//  findDuplicates — exact + similar，含空輸入
// ============================================================
describe('findDuplicates', () => {
  it('空輸入 → 空陣列', () => {
    expect(findDuplicates([])).toEqual([])
  })

  it('無重複 → 空陣列', () => {
    const groups = findDuplicates([
      q({ id: 'a', stem: '機會成本是甚麼？' }),
      q({ id: 'b', stem: '何謂供應鏈管理？' }),
    ])
    expect(groups).toEqual([])
  })

  it('完全相同（標準化後）→ exact 群組，score 1', () => {
    const groups = findDuplicates([
      q({ id: 'a', type: 'short', stem: '機會成本是甚麼？' }),
      q({ id: 'b', type: 'short', stem: '機會成本是甚麼?' }), // 半形問號
      q({ id: 'c', type: 'short', stem: '無關題目' }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('exact')
    expect(groups[0].score).toBe(1)
    expect(groups[0].questions.map((x) => x.id).sort()).toEqual(['a', 'b'])
  })

  it('同題幹但唔同題型 → 唔當 exact', () => {
    const groups = findDuplicates([
      q({ id: 'a', type: 'mc', stem: '同一題幹' }),
      q({ id: 'b', type: 'short', stem: '同一題幹' }),
    ])
    // 標準化題幹一樣，相似度=1 >= threshold → 會被 similar 抓到
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('similar')
    expect(groups[0].score).toBe(1)
  })

  it('高相似（>= threshold）→ similar 群組', () => {
    const groups = findDuplicates(
      [
        q({ id: 'a', stem: 'abcdefgh' }),
        q({ id: 'b', stem: 'abcdefgi' }), // 7/7 bigram 重疊中 6 個
      ],
      0.5,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].reason).toBe('similar')
    // bigrams a: {ab,bc,cd,de,ef,fg,gh}(7), b:{ab,bc,cd,de,ef,fg,gi}(7)
    //  交集 6，聯集 7+7-6=8 → 6/8 = 0.75
    expect(groups[0].score).toBeCloseTo(0.75, 6)
  })

  it('低於 threshold → 唔成群', () => {
    const groups = findDuplicates(
      [q({ id: 'a', stem: 'abcdefgh' }), q({ id: 'b', stem: 'abcdefgi' })],
      0.9,
    )
    expect(groups).toEqual([])
  })
})

// ============================================================
//  assemblePaper — 抽題（shortfall / 範圍過濾係確定性）
// ============================================================
describe('assemblePaper', () => {
  const bp = (over: Partial<Blueprint> = {}): Blueprint => ({
    topicIds: [],
    type: '',
    counts: { easy: 0, medium: 0, hard: 0 },
    ...over,
  })

  it('題池充足：抽到要求數量，無 shortfall', () => {
    const pool = [
      q({ id: 'e1', difficulty: 'easy' }),
      q({ id: 'e2', difficulty: 'easy' }),
      q({ id: 'm1', difficulty: 'medium' }),
    ]
    const r = assemblePaper(pool, bp({ counts: { easy: 2, medium: 1, hard: 0 } }))
    expect(r.picked).toHaveLength(3)
    expect(r.shortfall).toEqual({ easy: 0, medium: 0, hard: 0 })
    expect(r.picked.filter((x) => x.difficulty === 'easy')).toHaveLength(2)
    expect(r.picked.filter((x) => x.difficulty === 'medium')).toHaveLength(1)
  })

  it('題池不足：picked 封頂，shortfall 記欠數', () => {
    const pool = [q({ id: 'e1', difficulty: 'easy' })]
    const r = assemblePaper(pool, bp({ counts: { easy: 3, medium: 2, hard: 0 } }))
    expect(r.picked).toHaveLength(1)
    expect(r.shortfall).toEqual({ easy: 2, medium: 2, hard: 0 })
  })

  it('counts 全 0 → 無抽題', () => {
    const pool = [q({ id: 'e1', difficulty: 'easy' })]
    const r = assemblePaper(pool, bp())
    expect(r.picked).toEqual([])
    expect(r.shortfall).toEqual({ easy: 0, medium: 0, hard: 0 })
  })

  it('topicIds 過濾：只抽指定課題', () => {
    const pool = [
      q({ id: 'a', topicId: 'T1', difficulty: 'easy' }),
      q({ id: 'b', topicId: 'T2', difficulty: 'easy' }),
    ]
    const r = assemblePaper(
      pool,
      bp({ topicIds: ['T1'], counts: { easy: 5, medium: 0, hard: 0 } }),
    )
    expect(r.picked).toHaveLength(1)
    expect(r.picked[0].id).toBe('a')
    expect(r.shortfall.easy).toBe(4)
  })

  it('type 過濾：只抽指定題型', () => {
    const pool = [
      q({ id: 'a', type: 'mc', difficulty: 'easy' }),
      q({ id: 'b', type: 'short', difficulty: 'easy' }),
    ]
    const r = assemblePaper(
      pool,
      bp({ type: 'mc', counts: { easy: 5, medium: 0, hard: 0 } }),
    )
    expect(r.picked.map((x) => x.id)).toEqual(['a'])
  })

  it('負數 / 小數 counts：截成非負整數', () => {
    const pool = [
      q({ id: 'e1', difficulty: 'easy' }),
      q({ id: 'e2', difficulty: 'easy' }),
      q({ id: 'e3', difficulty: 'easy' }),
    ]
    // easy: 2.9 → 2 ；medium: -3 → 0
    const r = assemblePaper(
      pool,
      bp({ counts: { easy: 2.9, medium: -3, hard: 0 } }),
    )
    expect(r.picked).toHaveLength(2)
    expect(r.shortfall).toEqual({ easy: 0, medium: 0, hard: 0 })
  })

  it('emptyBlueprint 的預設值合理', () => {
    const e = emptyBlueprint()
    expect(e.topicIds).toEqual([])
    expect(e.type).toBe('')
    expect(e.counts).toEqual({ easy: 3, medium: 4, hard: 2 })
  })
})

// ============================================================
//  questionsToCsv — 引號逃逸 / MC 答案字母
// ============================================================
describe('questionsToCsv', () => {
  const name = (id: string) => (id === 'T1' ? '香港營商環境' : '未分類')

  it('表頭 + 每題一行', () => {
    const csv = questionsToCsv([q({ type: 'short', stem: '簡述', marks: 3 })], name)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(
      'topic,type,difficulty,stem,optionA,optionB,optionC,optionD,answer,marks',
    )
    expect(lines).toHaveLength(2)
  })

  it('MC：answerIndex 轉字母 A/B/C/D', () => {
    const csv = questionsToCsv(
      [
        q({
          type: 'mc',
          stem: 'Q',
          options: ['o1', 'o2', 'o3'],
          answerIndex: 2,
          marks: 1,
        }),
      ],
      name,
    )
    // answer 欄（第 9 欄，index 8）應為 'C'
    const cols = csv.split('\n')[1].split(',')
    expect(cols[8]).toBe('C')
  })

  it('含逗號 / 引號 / 換行 → 用引號包並逃逸雙引號', () => {
    const csv = questionsToCsv(
      [q({ type: 'short', stem: 'a,b "c"\nd', answer: 'x', marks: 2 })],
      name,
    )
    // stem 欄需被引號包住，內部 " 變成 ""
    expect(csv).toContain('"a,b ""c""\nd"')
  })

  it('非 MC 缺 answer → 空字串欄', () => {
    const csv = questionsToCsv([q({ type: 'short', stem: 'Q' })], name)
    const cols = csv.split('\n')[1].split(',')
    expect(cols[8]).toBe('') // answer 欄
  })
})

// ============================================================
//  parseCsv — 引號 / 逃逸 / 換行 / 空行 / 空輸入
// ============================================================
describe('parseCsv', () => {
  it('空字串 → 空陣列', () => {
    expect(parseCsv('')).toEqual([])
  })

  it('基本逗號分隔', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']])
  })

  it('多行', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('CRLF / CR 都當換行', () => {
    expect(parseCsv('a,b\r\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ])
  })

  it('引號包欄位內含逗號 / 換行', () => {
    expect(parseCsv('"a,b","c\nd"')).toEqual([['a,b', 'c\nd']])
  })

  it('逃逸雙引號 ""', () => {
    expect(parseCsv('"he said ""hi"""')).toEqual([['he said "hi"']])
  })

  it('丟掉全空白行', () => {
    expect(parseCsv('a,b\n\n  ,  \nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('保留有內容行的空欄位', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']])
  })

  it('round-trip：questionsToCsv → parseCsv 還原棘手欄位', () => {
    const name = () => 'topic,with comma'
    const csv = questionsToCsv(
      [q({ type: 'short', stem: '有"引號"\n同換行', answer: '答', marks: 2 })],
      name,
    )
    const rows = parseCsv(csv)
    expect(rows[1][0]).toBe('topic,with comma')
    expect(rows[1][3]).toBe('有"引號"\n同換行')
  })
})

// ============================================================
//  rowsToQuestions — 表頭偵測 / NaN marks / answerIndex 邊界
// ============================================================
describe('rowsToQuestions', () => {
  const topics: TopicLite[] = [
    { id: 'T1', topic: '香港營商環境' },
    { id: 'T2', topic: '會計概念' },
  ]

  it('空 rows → 空結果', () => {
    expect(rowsToQuestions([], topics)).toEqual({ parsed: [], skipped: 0 })
  })

  it('偵測表頭並按欄名對應；中文題型 / 難度', () => {
    const rows = parseCsv(
      [
        'topic,type,difficulty,stem,optionA,optionB,optionC,optionD,answer,marks',
        '會計概念,短答題,中,何謂歷史成本,,,,,實際成本入帳,3',
      ].join('\n'),
    )
    const { parsed, skipped } = rowsToQuestions(rows, topics)
    expect(skipped).toBe(0)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toMatchObject({
      topicId: 'T2',
      type: 'short',
      difficulty: 'medium',
      stem: '何謂歷史成本',
      answer: '實際成本入帳',
      marks: 3,
    })
    expect(parsed[0].options).toBeUndefined()
  })

  it('無表頭 → 用固定欄位順序', () => {
    const rows = [['香港營商環境', 'short', 'easy', '題幹', '', '', '', '', 'ans', '2']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].topicId).toBe('T1')
    expect(parsed[0].difficulty).toBe('easy')
    expect(parsed[0].marks).toBe(2)
  })

  it('缺題幹 → skip 並計數', () => {
    const rows = [
      ['T', 'short', 'easy', '', '', '', '', '', '', '1'],
      ['T', 'short', 'easy', '有題幹', '', '', '', '', '', '1'],
    ]
    const { parsed, skipped } = rowsToQuestions(rows, topics)
    expect(parsed).toHaveLength(1)
    expect(skipped).toBe(1)
  })

  it('未知題型 / 難度 → 預設 short / medium', () => {
    const rows = [['香港營商環境', '???', '???', '題幹', '', '', '', '', '', '']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].type).toBe('short')
    expect(parsed[0].difficulty).toBe('medium')
  })

  it('marks 非數字 → undefined（唔係 NaN）', () => {
    const rows = [['T', 'short', 'easy', '題幹', '', '', '', '', '', 'abc']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].marks).toBeUndefined()
    expect(Number.isNaN(parsed[0].marks as number)).toBe(false)
  })

  it('marks 帶單位「3分」→ 抽出數字 3', () => {
    const rows = [['T', 'short', 'easy', '題幹', '', '', '', '', '', '3分']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].marks).toBe(3)
  })

  it('MC 答案字母 A/B/C/D → 對應 index', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'o1', 'o2', 'o3', 'o4', 'C', '1']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].type).toBe('mc')
    expect(parsed[0].answerIndex).toBe(2)
    expect(parsed[0].options).toEqual(['o1', 'o2', 'o3', 'o4'])
  })

  it('MC 答案數字 → index（1-based 轉 0-based）', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'o1', 'o2', '', '', '2', '1']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].answerIndex).toBe(1)
  })

  it('MC 答案越界（超過選項數）→ 退回 0', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'o1', 'o2', '', '', '5', '1']]
    const { parsed } = rowsToQuestions(rows, topics)
    expect(parsed[0].answerIndex).toBe(0)
  })

  it('MC 選項少於 2 → skip', () => {
    const rows = [['T', 'mc', 'easy', 'Q', 'only-one', '', '', '', 'A', '1']]
    const { parsed, skipped } = rowsToQuestions(rows, topics)
    expect(parsed).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('課題 fuzzy 對應；對唔到落第一個課題', () => {
    // 'fuzzy include'：'香港' 係 '香港營商環境' 的子字串
    const rows = [['香港', 'short', 'easy', '題幹', '', '', '', '', '', '']]
    expect(rowsToQuestions(rows, topics).parsed[0].topicId).toBe('T1')

    // 完全對唔到 → fallback 第一個課題
    const rows2 = [['火星', 'short', 'easy', '題幹', '', '', '', '', '', '']]
    expect(rowsToQuestions(rows2, topics).parsed[0].topicId).toBe('T1')
  })

  it('空課題名 → fallback 第一個課題', () => {
    const rows = [['', 'short', 'easy', '題幹', '', '', '', '', '', '']]
    expect(rowsToQuestions(rows, topics).parsed[0].topicId).toBe('T1')
  })
})

// ============================================================
//  csvTemplate — 結構穩定
// ============================================================
describe('csvTemplate', () => {
  it('首行 = 表頭，且可被 parseCsv + rowsToQuestions 正確解析', () => {
    const tpl = csvTemplate()
    const lines = tpl.split('\n')
    expect(lines[0]).toBe(
      'topic,type,difficulty,stem,optionA,optionB,optionC,optionD,answer,marks',
    )
    const topics: TopicLite[] = [
      { id: 'T1', topic: '香港營商環境' },
      { id: 'T2', topic: '會計原則與概念' },
    ]
    const { parsed, skipped } = rowsToQuestions(parseCsv(tpl), topics)
    expect(skipped).toBe(0)
    expect(parsed).toHaveLength(2)
    // 第一條範本係 MC（選擇題），答案 A → index 0
    expect(parsed[0].type).toBe('mc')
    expect(parsed[0].answerIndex).toBe(0)
    expect(parsed[0].topicId).toBe('T1')
    // 第二條係短答題
    expect(parsed[1].type).toBe('short')
    expect(parsed[1].topicId).toBe('T2')
  })
})

// ============================================================
//  buildPrintHtml — 確定性 HTML（跳脫 / 答案顯示）
// ============================================================
describe('buildPrintHtml', () => {
  const meta = {
    title: '期中試卷',
    className: '5A',
    durationMin: '60',
    totalMarks: 50,
  }
  const name = () => '課題'

  it('HTML 含標題（已跳脫）+ 班別 + 總分', () => {
    const html = buildPrintHtml(meta, [], name, false)
    expect(html).toContain('期中試卷')
    expect(html).toContain('5A')
    expect(html).toContain('50 分')
    expect(html).toContain('未有題目') // 空題目提示
  })

  it('特殊字元跳脫（< > & "）', () => {
    const html = buildPrintHtml(
      { ...meta, title: 'a<b>&"c' },
      [],
      name,
      false,
    )
    expect(html).toContain('a&lt;b&gt;&amp;&quot;c')
    expect(html).not.toContain('a<b>&"c')
  })

  it('MC 帶答案：標示正確選項並打勾', () => {
    const html = buildPrintHtml(
      meta,
      [q({ type: 'mc', stem: 'Q', options: ['錯1', '對', '錯2'], answerIndex: 1 })],
      name,
      true,
    )
    expect(html).toContain('✓')
    expect(html).toContain('class="correct"')
    // 選項字母由 A 起
    expect(html).toContain('A. 錯1')
    expect(html).toContain('B. 對')
  })

  it('非 MC 不顯示答案時 → 留作答白位（blank）', () => {
    const html = buildPrintHtml(
      meta,
      [q({ type: 'short', stem: 'Q', answer: '機密答案' })],
      name,
      false,
    )
    expect(html).toContain('class="blank"')
    expect(html).not.toContain('機密答案')
  })

  it('非 MC 顯示答案時 → 出參考答案', () => {
    const html = buildPrintHtml(
      meta,
      [q({ type: 'short', stem: 'Q', answer: '參考答案文字' })],
      name,
      true,
    )
    expect(html).toContain('參考答案文字')
    expect(html).toContain('參考答案：')
  })

  it('題號連續由 1 起', () => {
    const html = buildPrintHtml(
      meta,
      [q({ stem: 'A' }), q({ stem: 'B' })],
      name,
      false,
    )
    expect(html).toContain('>1.</span>')
    expect(html).toContain('>2.</span>')
  })
})
