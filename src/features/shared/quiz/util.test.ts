import { describe, it, expect } from 'vitest'
import {
  isQuizableMc,
  isQuizableShort,
  isQuizable,
  formatDateTime,
  fmtDuration,
  scoreColor,
  scoreTone,
  pct,
  grade,
  verdict,
  normalizeAnswer,
  shortMatches,
  timedPoints,
  itemFromFrozen,
  settingsFromAttempt,
  scoreSeries,
  topicMastery,
  difficultyMastery,
  attemptsToCsvRows,
  itemsResultString,
  QUIZ_CSV_HEADER,
  BASE_POINTS,
  SPEED_BONUS,
  DEFAULT_SETTINGS,
  type FrozenQuestion,
} from './util'
import type { Question, QuizAttempt, QuizAttemptItem } from '../../../data/types'

// ── 測試小工具：砌最小合法物件 ──
const q = (over: Partial<Question>): Question => ({
  id: 'q',
  topicId: 't',
  type: 'mc',
  difficulty: 'easy',
  stem: '題目',
  createdAt: '2026-01-01T00:00:00',
  ...over,
})

const item = (over: Partial<QuizAttemptItem>): QuizAttemptItem => ({
  questionId: 'q',
  topicId: 't',
  difficulty: 'easy',
  stem: '題目',
  options: ['A', 'B'],
  answerIndex: 0,
  selectedIndex: 0,
  correct: true,
  ...over,
})

const attempt = (over: Partial<QuizAttempt>): QuizAttempt => ({
  id: 'a',
  createdAt: '2026-05-04T10:00:00',
  mode: 'learning',
  title: 't',
  topicIds: [],
  difficulty: 'all',
  total: 1,
  correctCount: 1,
  durationSec: 60,
  items: [],
  ...over,
})

const frozen = (over: Partial<FrozenQuestion>): FrozenQuestion => ({
  questionId: 'q',
  kind: 'mc',
  topicId: 't',
  difficulty: 'easy',
  stem: '題目',
  options: ['A', 'B', 'C'],
  answerIndex: 1,
  explanation: '',
  ...over,
})

// ============================================================
describe('isQuizableMc / isQuizableShort / isQuizable', () => {
  it('合法 MC：>=2 選項 + 有效 index', () => {
    expect(isQuizableMc(q({ type: 'mc', options: ['A', 'B'], answerIndex: 0 }))).toBe(true)
    expect(isQuizableMc(q({ type: 'mc', options: ['A', 'B', 'C'], answerIndex: 2 }))).toBe(true)
  })

  it('MC 邊界：只得 1 個選項 / index 越界 / 負 index 全部不合格', () => {
    expect(isQuizableMc(q({ type: 'mc', options: ['A'], answerIndex: 0 }))).toBe(false)
    // answerIndex === options.length（越上界）
    expect(isQuizableMc(q({ type: 'mc', options: ['A', 'B'], answerIndex: 2 }))).toBe(false)
    expect(isQuizableMc(q({ type: 'mc', options: ['A', 'B'], answerIndex: -1 }))).toBe(false)
  })

  it('MC：無 options / 無 answerIndex / 非 mc type', () => {
    expect(isQuizableMc(q({ type: 'mc', options: undefined, answerIndex: 0 }))).toBe(false)
    expect(isQuizableMc(q({ type: 'mc', options: ['A', 'B'], answerIndex: undefined }))).toBe(false)
    expect(isQuizableMc(q({ type: 'short', options: ['A', 'B'], answerIndex: 0 }))).toBe(false)
    // 空陣列
    expect(isQuizableMc(q({ type: 'mc', options: [], answerIndex: 0 }))).toBe(false)
  })

  it('合法短答：short/long/case + 非空 answer', () => {
    expect(isQuizableShort(q({ type: 'short', answer: '答案' }))).toBe(true)
    expect(isQuizableShort(q({ type: 'long', answer: '長答' }))).toBe(true)
    expect(isQuizableShort(q({ type: 'case', answer: '個案' }))).toBe(true)
  })

  it('短答不合格：空字串 / 全空白 / 無 answer / mc type', () => {
    expect(isQuizableShort(q({ type: 'short', answer: '' }))).toBe(false)
    expect(isQuizableShort(q({ type: 'short', answer: '   ' }))).toBe(false)
    expect(isQuizableShort(q({ type: 'short', answer: undefined }))).toBe(false)
    expect(isQuizableShort(q({ type: 'mc', answer: '答案' }))).toBe(false)
  })

  it('isQuizable：includeShort 控制短答納不納入', () => {
    const shortQ = q({ type: 'short', answer: '答案' })
    expect(isQuizable(shortQ, false)).toBe(false)
    expect(isQuizable(shortQ, true)).toBe(true)
    // MC 永遠合格，唔受 includeShort 影響
    const mcQ = q({ type: 'mc', options: ['A', 'B'], answerIndex: 0 })
    expect(isQuizable(mcQ, false)).toBe(true)
    expect(isQuizable(mcQ, true)).toBe(true)
  })
})

// ============================================================
describe('formatDateTime（本地時區，無 UTC off-by-one）', () => {
  it('無時區 ISO → 當本地時間，原樣輸出 wall-clock', () => {
    // 「無 offset」嘅 date-time 由 JS 當本地時間解析，
    // 所以本地 getter 應原樣回我寫嘅牆鐘時間（任何機器時區都一致）。
    expect(formatDateTime('2026-05-04T13:30:00')).toBe('2026-05-04 13:30')
    expect(formatDateTime('2026-01-01T00:00:00')).toBe('2026-01-01 00:00')
    expect(formatDateTime('2026-12-31T23:59:00')).toBe('2026-12-31 23:59')
  })

  it('個位月/日/時/分補零', () => {
    expect(formatDateTime('2026-03-05T08:07:00')).toBe('2026-03-05 08:07')
  })

  it('非法 ISO → 原樣回傳', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
    expect(formatDateTime('')).toBe('')
  })
})

// ============================================================
describe('fmtDuration（秒 → mm:ss）', () => {
  it('一般換算', () => {
    expect(fmtDuration(0)).toBe('00:00')
    expect(fmtDuration(59)).toBe('00:59')
    expect(fmtDuration(60)).toBe('01:00')
    expect(fmtDuration(90)).toBe('01:30')
    expect(fmtDuration(3599)).toBe('59:59')
    expect(fmtDuration(3600)).toBe('60:00')
  })

  it('負數 clamp 到 0', () => {
    expect(fmtDuration(-5)).toBe('00:00')
    expect(fmtDuration(-0.4)).toBe('00:00')
  })

  it('小數四捨五入', () => {
    expect(fmtDuration(59.4)).toBe('00:59')
    expect(fmtDuration(59.5)).toBe('01:00')
  })
})

// ============================================================
describe('scoreColor / scoreTone（命中率 → 色）', () => {
  it('邊界 80 / 50', () => {
    expect(scoreColor(80)).toBe('text-emerald-600 dark:text-emerald-400')
    expect(scoreColor(79)).toBe('text-amber-600 dark:text-amber-400')
    expect(scoreColor(50)).toBe('text-amber-600 dark:text-amber-400')
    expect(scoreColor(49)).toBe('text-rose-600 dark:text-rose-400')
  })

  it('極端值', () => {
    expect(scoreColor(100)).toBe('text-emerald-600 dark:text-emerald-400')
    expect(scoreColor(0)).toBe('text-rose-600 dark:text-rose-400')
  })

  it('scoreTone 同邊界對齊', () => {
    expect(scoreTone(80)).toBe('green')
    expect(scoreTone(79)).toBe('amber')
    expect(scoreTone(50)).toBe('amber')
    expect(scoreTone(49)).toBe('rose')
  })
})

// ============================================================
describe('pct（命中率，除零保護）', () => {
  it('一般四捨五入', () => {
    expect(pct(1, 2)).toBe(50)
    expect(pct(1, 3)).toBe(33) // 33.33… → 33
    expect(pct(2, 3)).toBe(67) // 66.66… → 67
    expect(pct(3, 3)).toBe(100)
    expect(pct(0, 4)).toBe(0)
  })

  it('total = 0 → 0（唔係 NaN）', () => {
    expect(pct(0, 0)).toBe(0)
    expect(pct(5, 0)).toBe(0)
    expect(Number.isNaN(pct(1, 0))).toBe(false)
  })
})

// ============================================================
describe('grade（等第）', () => {
  it('各邊界', () => {
    expect(grade(100)).toBe('A+')
    expect(grade(90)).toBe('A+')
    expect(grade(89)).toBe('A')
    expect(grade(80)).toBe('A')
    expect(grade(70)).toBe('B')
    expect(grade(60)).toBe('C')
    expect(grade(50)).toBe('D')
    expect(grade(49)).toBe('F')
    expect(grade(0)).toBe('F')
  })
})

// ============================================================
describe('verdict（鼓勵語）', () => {
  it('滿分專屬', () => {
    expect(verdict(100)).toContain('滿分')
  })
  it('各區間', () => {
    expect(verdict(90)).toBe('非常出色，掌握得好穩')
    expect(verdict(80)).toBe('做得好，繼續保持')
    expect(verdict(79)).toBe('及格有餘，再操幾轉就更穩')
    expect(verdict(60)).toBe('及格有餘，再操幾轉就更穩')
    expect(verdict(59)).toBe('有基礎，重點係錯題本')
    expect(verdict(40)).toBe('有基礎，重點係錯題本')
    expect(verdict(39)).toBe('別氣餒，由錯題本逐題突破')
    expect(verdict(0)).toBe('別氣餒，由錯題本逐題突破')
  })
})

// ============================================================
describe('normalizeAnswer（去空白/標點/全形/大小寫）', () => {
  it('去頭尾空白 + 內部空白 + 小寫', () => {
    expect(normalizeAnswer('  Hello World  ')).toBe('helloworld')
  })
  it('去標點（中英全形）', () => {
    expect(normalizeAnswer('需求，供給。')).toBe('需求供給')
    expect(normalizeAnswer('a-b_c/d')).toBe('abcd')
    expect(normalizeAnswer('「香港」（特區）')).toBe('香港特區')
  })
  it('空字串 / 純標點 → 空', () => {
    expect(normalizeAnswer('')).toBe('')
    expect(normalizeAnswer('，。！？')).toBe('')
    expect(normalizeAnswer('   ')).toBe('')
  })
})

// ============================================================
describe('shortMatches（短答自動判斷）', () => {
  it('正規化後嚴格相等（忽略空白/標點/大小寫）', () => {
    expect(shortMatches('需求 供給', '需求，供給')).toBe(true)
    expect(shortMatches('GDP', 'gdp')).toBe(true)
  })
  it('任一方為空（含純標點）→ 不命中', () => {
    expect(shortMatches('', '答案')).toBe(false)
    expect(shortMatches('答案', '')).toBe(false)
    expect(shortMatches('，。', '答案')).toBe(false)
  })
  it('長度 >= 3 時，一方包含另一方算命中', () => {
    // 參考答案「需求定律」(len 4 >= 3)，學生答多咗字仍含關鍵字
    expect(shortMatches('我認為係需求定律啦', '需求定律')).toBe(true)
    // 反向：學生答關鍵字，參考答案更長
    expect(shortMatches('需求定律', '需求定律的應用')).toBe(true)
  })
  it('短答案（正規化後 < 3 字）唔做包含 fuzzy，避免誤判', () => {
    // b = 「是」(len 1)：唔相等亦唔做 includes
    expect(shortMatches('這是對的', '是')).toBe(false)
    // b = 「ab」(len 2)：唔做 includes
    expect(shortMatches('abc', 'ab')).toBe(false)
    // 但完全相等仍命中
    expect(shortMatches('ab', 'ab')).toBe(true)
  })
})

// ============================================================
describe('timedPoints（計時搶分，除零保護）', () => {
  it('答錯 → 0 分（唔理剩餘時間）', () => {
    expect(timedPoints(false, 20, 20)).toBe(0)
    expect(timedPoints(false, 0, 20)).toBe(0)
  })
  it('答啱：基本分 + 速度比例獎勵', () => {
    // 剩足 100% 時間 → BASE + SPEED
    expect(timedPoints(true, 20, 20)).toBe(BASE_POINTS + SPEED_BONUS)
    // 剩 0 → 淨基本分
    expect(timedPoints(true, 0, 20)).toBe(BASE_POINTS)
    // 剩一半 → BASE + 0.5*SPEED
    expect(timedPoints(true, 10, 20)).toBe(BASE_POINTS + Math.round(0.5 * SPEED_BONUS))
  })
  it('剩餘時間越界 clamp 到 [0,1]', () => {
    // 剩餘 > limit → 當 1
    expect(timedPoints(true, 30, 20)).toBe(BASE_POINTS + SPEED_BONUS)
    // 剩餘負 → 當 0
    expect(timedPoints(true, -5, 20)).toBe(BASE_POINTS)
  })
  it('limit = 0（除零保護）→ 答啱只得基本分', () => {
    expect(timedPoints(true, 10, 0)).toBe(BASE_POINTS)
    expect(Number.isNaN(timedPoints(true, 10, 0))).toBe(false)
  })
})

// ============================================================
describe('itemFromFrozen（frozen + 答案 → 計分快照）', () => {
  it('MC 答啱', () => {
    const r = itemFromFrozen(frozen({ kind: 'mc', answerIndex: 1 }), 1, undefined)
    expect(r.correct).toBe(true)
    expect(r.selectedIndex).toBe(1)
    expect(r.options).toEqual(['A', 'B', 'C'])
    expect(r.answerIndex).toBe(1)
  })
  it('MC 答錯', () => {
    const r = itemFromFrozen(frozen({ kind: 'mc', answerIndex: 1 }), 0, undefined)
    expect(r.correct).toBe(false)
    expect(r.selectedIndex).toBe(0)
  })
  it('MC 跳過（null）→ 不對', () => {
    const r = itemFromFrozen(frozen({ kind: 'mc', answerIndex: 1 }), null, undefined)
    expect(r.correct).toBe(false)
    expect(r.selectedIndex).toBe(null)
  })
  it('短答答啱 → selectedIndex=0，options 清空', () => {
    const r = itemFromFrozen(
      frozen({ kind: 'short', answerIndex: 0, explanation: '需求定律', options: ['需求定律'] }),
      null,
      '需求 定律',
    )
    expect(r.correct).toBe(true)
    expect(r.selectedIndex).toBe(0)
    expect(r.options).toEqual([])
  })
  it('短答答錯 / 未填 → selectedIndex=null', () => {
    const wrong = itemFromFrozen(
      frozen({ kind: 'short', explanation: '需求定律' }),
      null,
      '完全唔啱',
    )
    expect(wrong.correct).toBe(false)
    expect(wrong.selectedIndex).toBe(null)

    const empty = itemFromFrozen(frozen({ kind: 'short', explanation: '需求定律' }), null, undefined)
    expect(empty.correct).toBe(false)
    expect(empty.selectedIndex).toBe(null)
  })
})

// ============================================================
describe('settingsFromAttempt（由歷史 attempt 還原設定）', () => {
  it('total 喺標準題數選項內 → 沿用該 count', () => {
    const s = settingsFromAttempt(
      attempt({ total: 10, topicIds: ['topic-1'], difficulty: 'hard' }),
    )
    expect(s.count).toBe('10')
    expect(s.topicId).toBe('topic-1')
    expect(s.difficulty).toBe('hard')
    // 其餘跟 DEFAULT
    expect(s.mode).toBe(DEFAULT_SETTINGS.mode)
  })
  it('total 非標準（例如 7 / 0）→ count = all', () => {
    expect(settingsFromAttempt(attempt({ total: 7 })).count).toBe('all')
    expect(settingsFromAttempt(attempt({ total: 0 })).count).toBe('all')
  })
  it('空 topicIds → topicId 為空字串', () => {
    expect(settingsFromAttempt(attempt({ topicIds: [] })).topicId).toBe('')
  })
})

// ============================================================
describe('scoreSeries（按時間升序折線資料）', () => {
  it('空輸入 → 空陣列', () => {
    expect(scoreSeries([])).toEqual([])
  })
  it('亂序輸入按 createdAt 升序排好，並計 pct', () => {
    const a1 = attempt({ id: 'a1', createdAt: '2026-05-03T10:00:00', total: 4, correctCount: 2 })
    const a2 = attempt({ id: 'a2', createdAt: '2026-05-01T10:00:00', total: 4, correctCount: 1 })
    const a3 = attempt({ id: 'a3', createdAt: '2026-05-02T10:00:00', total: 4, correctCount: 4 })
    const out = scoreSeries([a1, a2, a3])
    expect(out.map((p) => p.attemptId)).toEqual(['a2', 'a3', 'a1'])
    expect(out.map((p) => p.pct)).toEqual([25, 100, 50])
    expect(out[0]).toMatchObject({ total: 4, correct: 1 })
  })
  it('createdAt 相同：保持輸入次序（comparator 自反，穩定）', () => {
    const a1 = attempt({ id: 'a1', createdAt: '2026-05-02T10:00:00', total: 4, correctCount: 2 })
    const a2 = attempt({ id: 'a2', createdAt: '2026-05-02T10:00:00', total: 4, correctCount: 3 })
    expect(scoreSeries([a1, a2]).map((p) => p.attemptId)).toEqual(['a1', 'a2'])
  })
})

// ============================================================
describe('topicMastery（課題掌握度，弱在前）', () => {
  it('空輸入 → 空陣列', () => {
    expect(topicMastery([])).toEqual([])
  })
  it('合併多次 attempt 嘅逐題，按 pct 升序', () => {
    const a = attempt({
      items: [
        item({ topicId: 'T1', correct: true }),
        item({ topicId: 'T1', correct: false }),
        item({ topicId: 'T2', correct: true }),
        item({ topicId: 'T2', correct: true }),
      ],
    })
    const b = attempt({
      items: [item({ topicId: 'T1', correct: false })],
    })
    const out = topicMastery([a, b])
    // T1: 1 對 / 3 題 = 33%；T2: 2/2 = 100% → 弱(T1)在前
    expect(out).toEqual([
      { topicId: 'T1', correct: 1, total: 3, pct: 33 },
      { topicId: 'T2', correct: 2, total: 2, pct: 100 },
    ])
  })
})

// ============================================================
describe('difficultyMastery（難度掌握度）', () => {
  it('空輸入 → 空陣列（無資料難度全濾走）', () => {
    expect(difficultyMastery([])).toEqual([])
  })
  it('依 easy/medium/hard 次序，只回有資料嘅難度', () => {
    const a = attempt({
      items: [
        item({ difficulty: 'easy', correct: true }),
        item({ difficulty: 'easy', correct: false }),
        item({ difficulty: 'hard', correct: true }),
      ],
    })
    const out = difficultyMastery([a])
    // medium 無題 → 濾走；次序維持 easy → hard
    expect(out).toEqual([
      { diff: 'easy', correct: 1, total: 2 },
      { diff: 'hard', correct: 1, total: 1 },
    ])
  })
})

// ============================================================
describe('itemsResultString（逐題對錯緊湊字串）', () => {
  it('啱 → ✓、錯 → ✗，保留作答次序', () => {
    const items = [
      item({ correct: true }),
      item({ correct: false }),
      item({ correct: true }),
      item({ correct: true }),
      item({ correct: false }),
    ]
    expect(itemsResultString(items)).toBe('✓✗✓✓✗')
  })
  it('空題 → 空字串', () => {
    expect(itemsResultString([])).toBe('')
  })
})

// ============================================================
describe('attemptsToCsvRows（匯出試算表：成績 + 逐題對錯）', () => {
  // 釘死本地時區 = Asia/Hong_Kong（vitest.config 已設）；formatDateTime 用本地時間。
  const nameOf = (id: string) => ({ T1: '細胞分裂', T2: '光合作用' }[id] ?? '未分類')

  it('空輸入：只得表頭一行', () => {
    const out = attemptsToCsvRows([], nameOf)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual([...QUIZ_CSV_HEADER])
  })

  it('表頭固定 9 欄（日期…逐題對錯）', () => {
    expect([...QUIZ_CSV_HEADER]).toEqual([
      '日期',
      '模式',
      '範圍',
      '難度',
      '題數',
      '答啱',
      '命中率%',
      '用時',
      '逐題對錯',
    ])
  })

  it('一行：欄位映射 + 命中率% + mm:ss 用時 + 逐題 ✓✗', () => {
    const a = attempt({
      createdAt: '2026-05-04T10:30:00',
      mode: 'learning',
      topicIds: ['T1'],
      difficulty: 'medium',
      total: 4,
      correctCount: 3,
      durationSec: 95, // 01:35
      items: [
        item({ correct: true }),
        item({ correct: true }),
        item({ correct: false }),
        item({ correct: true }),
      ],
    })
    const [, row] = attemptsToCsvRows([a], nameOf)
    expect(row).toEqual([
      '2026-05-04 10:30',
      '學習',
      '細胞分裂',
      '中',
      4,
      3,
      75, // round(3/4*100)
      '01:35',
      '✓✓✗✓',
    ])
  })

  it('全部課題（topicIds 空）→ 範圍「全部課題」；不限難度 → 「不限」；work → 「工作」', () => {
    const a = attempt({
      mode: 'work',
      topicIds: [],
      difficulty: 'all',
      total: 0,
      correctCount: 0,
      durationSec: 0,
      items: [],
    })
    const [, row] = attemptsToCsvRows([a], nameOf)
    expect(row[1]).toBe('工作')
    expect(row[2]).toBe('全部課題')
    expect(row[3]).toBe('不限')
    expect(row[6]).toBe(0) // 0 題 → 命中率 0（pct 防除零）
    expect(row[7]).toBe('00:00')
    expect(row[8]).toBe('')
  })

  it('多課題範圍：以 / 串連課題名（找唔到 → 未分類）', () => {
    const a = attempt({ topicIds: ['T1', 'T2', 'TX'] })
    const [, row] = attemptsToCsvRows([a], nameOf)
    expect(row[2]).toBe('細胞分裂 / 光合作用 / 未分類')
  })

  it('多次：最新喺前（createdAt 降序），唔 mutate 入參', () => {
    const older = attempt({ id: 'old', createdAt: '2026-05-01T08:00:00' })
    const newer = attempt({ id: 'new', createdAt: '2026-05-10T08:00:00' })
    const input = [older, newer]
    const out = attemptsToCsvRows(input, nameOf)
    // 第 0 行係表頭；data 由第 1 行起
    expect(out[1][0]).toBe('2026-05-10 08:00')
    expect(out[2][0]).toBe('2026-05-01 08:00')
    // 入參次序不變（純函式）
    expect(input.map((a) => a.id)).toEqual(['old', 'new'])
  })
})
