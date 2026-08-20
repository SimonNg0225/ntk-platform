import { useMemo, useRef, useState } from 'react'
import type { CellObject, ExcelDataType, WorkSheet } from 'xlsx'
import {
  AlertTriangle,
  Activity,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Download,
  FileText,
  FileSpreadsheet,
  Gauge,
  Lightbulb,
  LineChart,
  ListChecks,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  TrendingUp,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import {
  Badge,
  Button,
  Card,
  Field,
  ProgressBar,
  SectionTitle,
  StatCard,
  Textarea,
  cx,
} from '../../ui'

type ViewId = 'overview' | 'actuarial' | 'report' | 'questions' | 'students' | 'import'

type QuestionSpec = {
  id: string
  title: string
  max: number
  topic: string
  skill: string
  distribution: Record<number, number>
  advice: string
}

type StudentScore = {
  id: string
  scores: Record<string, number>
}

type QuestionStat = QuestionSpec & {
  average: number
  rate: number
  std: number
  fullCount: number
  lowCount: number
  samples: number
  distribution: Record<number, number>
}

type StudentInsight = {
  id: string
  total: number
  percent: number
  grade: string
  gradeProbabilities: { grade: string; probability: number }[]
  passProbability: number
  excellenceProbability: number
  downsidePercent: number
  upsidePercent: number
  riskScore: number
  risk: 'high' | 'watch' | 'stable' | 'stretch'
  weakest: QuestionStat
  nextStep: string
}

type QuestionLeverage = {
  question: QuestionStat
  expectedGain: number
  affectedStudents: number
  riskReduction: number
  efficiency: number
}

type RiskBucket = {
  label: string
  hint: string
  count: number
  tone: 'rose' | 'amber' | 'green' | 'blue'
}

type Analysis = {
  sampleSize: number
  totalMax: number
  classAverage: number
  classPercent: number
  medianPercent: number
  classStd: number
  ciLow: number
  ciHigh: number
  p10: number
  p25: number
  p75: number
  p90: number
  volatility: number
  riskIndex: number
  confidenceScore: number
  passRate: number
  excellenceRate: number
  atRiskCount: number
  confidence: '高' | '中' | '低'
  questionStats: QuestionStat[]
  weakest: QuestionStat[]
  gradeDistribution: Record<string, number>
  expectedGradeDistribution: { grade: string; expected: number }[]
  questionLeverage: QuestionLeverage[]
  riskBuckets: RiskBucket[]
  students: StudentInsight[]
}

type SubjectProfileId = 'economics' | 'math' | 'chinese' | 'english' | 'general'

type SubjectProfile = {
  id: SubjectProfileId
  label: string
  subject: string
  paperName: string
  overviewNoun: string
  answerLens: string
  evidenceLens: string
  lossLens: string
  followUpLens: string
  gradeNote: string
}

type ReportMeta = {
  school: string
  classLevel: string
  examName: string
  paperTitle: string
  source: string
  date: string
  brand: string
}

const QUESTION_SPECS: QuestionSpec[] = [
  {
    id: 'Q1',
    title: '核心概念理解；基礎知識應用',
    max: 8,
    topic: '核心概念',
    skill: '概念辨識',
    distribution: { 4: 2, 5: 4, 6: 6, 7: 10, 8: 21 },
    advice: '保留高分題做信心題，整理常見答題句式給低分學生補底。',
  },
  {
    id: 'Q2',
    title: '資料理解與例子應用',
    max: 8,
    topic: '例子連結',
    skill: '例子連結',
    distribution: { 2: 1, 3: 3, 4: 3, 5: 1, 6: 9, 7: 1, 8: 25 },
    advice: '針對 3 至 5 分學生安排「概念 + 例子 + 效果」三步句式練習。',
  },
  {
    id: 'Q3',
    title: '比較題與短論述',
    max: 8,
    topic: '比較論述',
    skill: '比較論述',
    distribution: { 3: 2, 4: 8, 5: 1, 6: 5, 7: 9, 8: 18 },
    advice: '用表格比較兩個概念，要求學生逐欄寫出理據和影響。',
  },
  {
    id: 'Q4',
    title: '數據解釋與情境分析',
    max: 8,
    topic: '數據解釋',
    skill: '數據解釋',
    distribution: { 0: 2, 1: 1, 2: 4, 3: 5, 4: 4, 5: 3, 6: 13, 8: 11 },
    advice: '先重教資料解讀步驟，再用錯例拆解「描述」和「解釋」的差別。',
  },
  {
    id: 'Q5',
    title: '公式/步驟題與簡短評論',
    max: 4,
    topic: '程序應用',
    skill: '公式應用',
    distribution: { 0: 5, 1: 2, 2: 2, 3: 10, 4: 24 },
    advice: '把計算步驟做成檢核清單，先穩住單位、公式、評論三件事。',
  },
  {
    id: 'Q6',
    title: '多概念整合題',
    max: 16,
    topic: '綜合概念',
    skill: '多概念整合',
    distribution: { 1: 1, 5: 2, 6: 1, 7: 1, 8: 3, 9: 2, 10: 3, 11: 2, 12: 5, 13: 4, 14: 8, 15: 1, 16: 10 },
    advice: '多概念題要分拆短練習，逐段建立關鍵詞和答題架構。',
  },
  {
    id: 'Q7',
    title: '跨課題應用題',
    max: 16,
    topic: '綜合個案分析',
    skill: '跨課題應用',
    distribution: { 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 4, 14: 5, 15: 7, 16: 18 },
    advice: '此題表現佳，可抽取高分答案做同儕互評範例。',
  },
  {
    id: 'Q8/Q9',
    title: '高階分析 / 延伸題',
    max: 18,
    topic: '高階應用',
    skill: '高階分析',
    distribution: { 2: 2, 3: 3, 4: 1, 5: 1, 6: 1, 7: 5, 8: 3, 9: 3, 10: 2, 11: 4, 12: 4, 13: 3, 14: 1, 15: 3, 16: 2, 17: 2, 18: 3 },
    advice: '這是主要拉開分數題，建議分層教：先穩公式，再做評估語句和取捨判斷。',
  },
]

const GRADE_ORDER = ['5**', '5*', '5', '4', '3', '2', '1', 'U']

const VIEW_TABS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: '總覽' },
  { id: 'actuarial', label: '精算風險' },
  { id: 'report', label: '成績報告' },
  { id: 'questions', label: '題目診斷' },
  { id: 'students', label: '跟進名單' },
  { id: 'import', label: '匯入' },
]

const VIEW_ICONS: Record<ViewId, LucideIcon> = {
  overview: BarChart3,
  actuarial: Calculator,
  report: FileText,
  questions: Search,
  students: Users,
  import: Upload,
}

const SAMPLE_CSV = `學生,Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8/Q9
S01,8,8,8,8,4,16,16,18
S02,8,8,7,6,4,14,15,12
S03,7,6,6,3,3,10,14,9`

const MARK_TEMPLATE_FILENAME = 'EziTeach_AI_Cal_Mark_Template.xlsx'
const MARK_INPUT_SHEET = '輸入分數'
const MARK_CONFIG_SHEET = '設定'
const MARK_SUMMARY_SHEET = '分析摘要'
const MARK_HELP_SHEET = '使用說明'
const MARK_TEMPLATE_ROWS = 60
const MARK_INPUT_HEADER_ROW = 10
const MARK_INPUT_FIRST_DATA_ROW = 12

const SUBJECT_PROFILES: SubjectProfile[] = [
  {
    id: 'economics',
    label: '經濟',
    subject: '經濟',
    paperName: '測驗 / 試卷',
    overviewNoun: '經濟概念、圖表分析及政策評估',
    answerLens: '定義 - 圖表/數據 - 因果推論 - 評估',
    evidenceLens: '題目、評分準則、學生分數及匿名分佈',
    lossLens: '概念混淆、圖表標示不足、因果鏈不完整',
    followUpLens: '用概念卡、圖表改錯和政策短評做補救',
    gradeNote: '以校本 cut-off 及歷屆表現作預測參考',
  },
  {
    id: 'math',
    label: '數學',
    subject: '數學',
    paperName: '測驗 / 試卷',
    overviewNoun: '程序運算、代數推理及應用題',
    answerLens: '方法選擇 - 步驟完整 - 運算準確 - 答案檢查',
    evidenceLens: '題目、評分步驟、學生得分及錯誤類型',
    lossLens: '概念未穩、運算失誤、缺少必要步驟或單位',
    followUpLens: '以錯因分類安排重做題、短練習和同類題遷移',
    gradeNote: '按題型掌握度與分數線估算後續表現',
  },
  {
    id: 'chinese',
    label: '中文',
    subject: '中國語文',
    paperName: '閱讀 / 寫作 / 綜合',
    overviewNoun: '理解、表達、組織及語文運用',
    answerLens: '文本證據 - 答題方向 - 表達準確 - 結構完整',
    evidenceLens: '題目、評分參考、學生得分及答題表現摘要',
    lossLens: '未能扣題、引文不足、語意含糊或段落組織鬆散',
    followUpLens: '用範文拆解、句式重寫和段落重組提升表達',
    gradeNote: '按卷別表現和校本等級線作分層參考',
  },
  {
    id: 'english',
    label: '英文',
    subject: 'English Language',
    paperName: 'Reading / Writing / Listening',
    overviewNoun: 'comprehension, language accuracy and task fulfilment',
    answerLens: 'task requirement - evidence - organisation - language accuracy',
    evidenceLens: 'question paper, marking scheme, score profile and anonymous distribution',
    lossLens: 'weak task focus, limited evidence, grammar issues or unclear organisation',
    followUpLens: 'use targeted language drills, model paragraphs and task-based rewrites',
    gradeNote: 'based on school-based grade boundaries for instructional grouping',
  },
  {
    id: 'general',
    label: '通用科目',
    subject: '科目',
    paperName: '測驗 / 試卷',
    overviewNoun: '知識、技能及應用表現',
    answerLens: '要求理解 - 答案證據 - 應用 - 表達',
    evidenceLens: '題目、評分準則、學生得分及匿名分數分佈',
    lossLens: '題意理解不足、答案欠證據、應用或表達未夠完整',
    followUpLens: '先針對共同弱項，再安排分層練習和重測',
    gradeNote: '以校本分數線和題目掌握度作預測參考',
  },
]

const CONTROL_CLASS =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'

const toneForRate = (rate: number): 'green' | 'amber' | 'rose' | 'accent' =>
  rate >= 80 ? 'green' : rate >= 65 ? 'amber' : rate >= 50 ? 'accent' : 'rose'

const GRADE_BANDS = [
  { grade: '5**', min: 90, max: Infinity },
  { grade: '5*', min: 85, max: 90 },
  { grade: '5', min: 80, max: 85 },
  { grade: '4', min: 70, max: 80 },
  { grade: '3', min: 60, max: 70 },
  { grade: '2', min: 50, max: 60 },
  { grade: '1', min: 40, max: 50 },
  { grade: 'U', min: -Infinity, max: 40 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function expandDistribution(distribution: Record<number, number>): number[] {
  return Object.entries(distribution)
    .flatMap(([score, count]) => Array.from({ length: count }, () => Number(score)))
    .sort((a, b) => a - b)
}

function buildDemoStudents(): StudentScore[] {
  const expanded = QUESTION_SPECS.map((q) => expandDistribution(q.distribution))
  const sampleSize = Math.max(...expanded.map((scores) => scores.length))
  const multipliers = [1, 5, 7, 11, 13, 17, 19, 23]
  return Array.from({ length: sampleSize }, (_, index) => {
    const scores: Record<string, number> = {}
    QUESTION_SPECS.forEach((q, qIndex) => {
      const bucket = expanded[qIndex]
      const cursor = (index * multipliers[qIndex] + qIndex * 3) % bucket.length
      scores[q.id] = bucket[cursor]
    })
    return { id: `S${String(index + 1).padStart(2, '0')}`, scores }
  })
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentileValue(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * clamp(percentile, 0, 100) / 100
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0
  const avg = average(values)
  const variance = average(values.map((value) => (value - avg) ** 2))
  return Math.sqrt(variance)
}

function percent(value: number, max: number): number {
  return max <= 0 ? 0 : (value / max) * 100
}

function format1(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

function format0(value: number): string {
  return String(Math.round(value))
}

function erf(value: number): number {
  const sign = value >= 0 ? 1 : -1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return sign * y
}

function normalCdf(value: number, mean: number, sd: number): number {
  if (value === Infinity) return 1
  if (value === -Infinity) return 0
  const safeSd = Math.max(0.1, sd)
  return 0.5 * (1 + erf((value - mean) / (safeSd * Math.sqrt(2))))
}

function gradeProbabilities(meanPercent: number, uncertainty: number): { grade: string; probability: number }[] {
  return GRADE_BANDS.map((band) => ({
    grade: band.grade,
    probability: clamp(
      (normalCdf(band.max, meanPercent, uncertainty) -
        normalCdf(band.min, meanPercent, uncertainty)) *
        100,
      0,
      100,
    ),
  }))
}

function modelUncertainty(percentValue: number, classStd: number, sampleSize: number): number {
  const samplePenalty = sampleSize >= 30 ? 0 : sampleSize >= 12 ? 1.5 : 3
  const edgePenalty = percentValue < 55 || percentValue > 85 ? 0.5 : 1.25
  return clamp(classStd * 0.34 + samplePenalty + edgePenalty, 4.5, 11)
}

function gradeOf(value: number): string {
  if (value >= 90) return '5**'
  if (value >= 85) return '5*'
  if (value >= 80) return '5'
  if (value >= 70) return '4'
  if (value >= 60) return '3'
  if (value >= 50) return '2'
  if (value >= 40) return '1'
  return 'U'
}

function riskOf(percentValue: number): StudentInsight['risk'] {
  if (percentValue < 55) return 'high'
  if (percentValue < 70) return 'watch'
  if (percentValue >= 82) return 'stretch'
  return 'stable'
}

function riskLabel(risk: StudentInsight['risk']): string {
  if (risk === 'high') return '優先跟進'
  if (risk === 'watch') return '邊緣提升'
  if (risk === 'stretch') return '高分拔尖'
  return '穩定'
}

function riskTone(risk: StudentInsight['risk']): 'rose' | 'amber' | 'green' | 'blue' {
  if (risk === 'high') return 'rose'
  if (risk === 'watch') return 'amber'
  if (risk === 'stretch') return 'green'
  return 'blue'
}

function toneForRiskIndex(value: number): 'rose' | 'amber' | 'green' | 'blue' {
  if (value >= 58) return 'rose'
  if (value >= 34) return 'amber'
  if (value <= 18) return 'green'
  return 'blue'
}

function probabilityTone(value: number): 'green' | 'amber' | 'rose' | 'accent' {
  if (value >= 85) return 'green'
  if (value >= 65) return 'amber'
  if (value >= 45) return 'accent'
  return 'rose'
}

function buildDistribution(scores: number[]): Record<number, number> {
  return scores.reduce<Record<number, number>>((acc, score) => {
    const safe = Math.round(score)
    acc[safe] = (acc[safe] ?? 0) + 1
    return acc
  }, {})
}

function totalPercentForStudent(student: StudentScore, questions: QuestionSpec[], totalMax: number): number {
  const total = questions.reduce((sum, q) => sum + Number(student.scores[q.id] ?? 0), 0)
  return percent(total, totalMax)
}

function analyze(students: StudentScore[], questions: QuestionSpec[]): Analysis {
  const totalMax = questions.reduce((sum, q) => sum + q.max, 0)
  const questionStats: QuestionStat[] = questions.map((q) => {
    const scores = students.map((student) => Number(student.scores[q.id] ?? 0))
    const avg = average(scores)
    return {
      ...q,
      average: avg,
      rate: percent(avg, q.max),
      std: stdDev(scores),
      fullCount: scores.filter((score) => score >= q.max).length,
      lowCount: scores.filter((score) => percent(score, q.max) < 50).length,
      samples: scores.length,
      distribution: buildDistribution(scores),
    }
  })

  const rawPercentages = students.map((student) => totalPercentForStudent(student, questions, totalMax))
  const classStd = stdDev(rawPercentages)
  const classPercent = average(rawPercentages)
  const sampleSize = students.length
  const standardError = sampleSize > 0 ? classStd / Math.sqrt(sampleSize) : 0
  const ciLow = clamp(classPercent - 1.96 * standardError, 0, 100)
  const ciHigh = clamp(classPercent + 1.96 * standardError, 0, 100)
  const p10 = percentileValue(rawPercentages, 10)
  const p25 = percentileValue(rawPercentages, 25)
  const p75 = percentileValue(rawPercentages, 75)
  const p90 = percentileValue(rawPercentages, 90)

  const studentsWithTotals: StudentInsight[] = students.map((student) => {
    const total = questions.reduce((sum, q) => sum + Number(student.scores[q.id] ?? 0), 0)
    const pct = percent(total, totalMax)
    const uncertainty = modelUncertainty(pct, classStd, sampleSize)
    const gradeBands = gradeProbabilities(pct, uncertainty)
    const passProbability = clamp((1 - normalCdf(50, pct, uncertainty)) * 100, 0, 100)
    const excellenceProbability = clamp((1 - normalCdf(80, pct, uncertainty)) * 100, 0, 100)
    const downsidePercent = clamp(pct - 1.28 * uncertainty, 0, 100)
    const upsidePercent = clamp(pct + 1.28 * uncertainty, 0, 100)
    const riskScore = clamp(
      (100 - passProbability) * 0.58 +
        Math.max(0, 70 - pct) * 0.72 +
        Math.max(0, 55 - downsidePercent) * 0.55,
      0,
      100,
    )
    const personalWeakest = [...questionStats].sort((a, b) => {
      const aScore = percent(Number(student.scores[a.id] ?? 0), a.max)
      const bScore = percent(Number(student.scores[b.id] ?? 0), b.max)
      return aScore - bScore
    })[0]
    const risk = riskOf(pct)
    const nextStep =
      risk === 'high'
        ? `先補 ${personalWeakest.topic}`
        : risk === 'watch'
          ? `衝上 3/4：重做 ${personalWeakest.id}`
          : risk === 'stretch'
            ? `挑戰高階 ${personalWeakest.skill}`
            : `保持 ${personalWeakest.topic} 練習`
    return {
      id: student.id,
      total,
      percent: pct,
      grade: gradeOf(pct),
      gradeProbabilities: gradeBands,
      passProbability,
      excellenceProbability,
      downsidePercent,
      upsidePercent,
      riskScore,
      risk,
      weakest: personalWeakest,
      nextStep,
    }
  })

  const percentages = studentsWithTotals.map((student) => student.percent)
  const gradeDistribution = GRADE_ORDER.reduce<Record<string, number>>((acc, grade) => {
    acc[grade] = studentsWithTotals.filter((student) => student.grade === grade).length
    return acc
  }, {})
  const expectedGradeDistribution = GRADE_ORDER.map((grade) => ({
    grade,
    expected: studentsWithTotals.reduce((sum, student) => {
      const band = student.gradeProbabilities.find((item) => item.grade === grade)
      return sum + (band?.probability ?? 0) / 100
    }, 0),
  }))
  const atRiskCount = studentsWithTotals.filter((student) => student.risk === 'high').length
  const questionLeverage = questionStats
    .map((question) => {
      const liftedStudents = students.map((student) => {
        const current = Number(student.scores[question.id] ?? 0)
        const lifted = Math.min(question.max, current + question.max * 0.1)
        return {
          ...student,
          scores: {
            ...student.scores,
            [question.id]: Math.round(lifted * 10) / 10,
          },
        }
      })
      const liftedPercentages = liftedStudents.map((student) =>
        totalPercentForStudent(student, questions, totalMax),
      )
      const expectedGain = average(liftedPercentages) - classPercent
      const riskReduction =
        atRiskCount - liftedPercentages.filter((studentPercent) => riskOf(studentPercent) === 'high').length
      const affectedStudents = students.filter(
        (student) => percent(Number(student.scores[question.id] ?? 0), question.max) < 65,
      ).length
      return {
        question,
        expectedGain,
        affectedStudents,
        riskReduction,
        efficiency: expectedGain * 10 + riskReduction * 2 + affectedStudents * 0.18,
      }
    })
    .sort((a, b) => b.efficiency - a.efficiency)
  const highCount = studentsWithTotals.filter((student) => student.risk === 'high').length
  const watchCount = studentsWithTotals.filter((student) => student.risk === 'watch').length
  const stableCount = studentsWithTotals.filter((student) => student.risk === 'stable').length
  const stretchCount = studentsWithTotals.filter((student) => student.risk === 'stretch').length
  const volatility = classPercent > 0 ? (classStd / classPercent) * 100 : 0
  const riskIndex = Math.round(
    clamp(
      (100 - percent(studentsWithTotals.filter((student) => student.percent >= 50).length, sampleSize)) * 0.26 +
        percent(highCount + watchCount, sampleSize) * 0.34 +
        clamp(70 - p10, 0, 45) * 0.58 +
        clamp(volatility, 0, 22) * 0.82,
      0,
      100,
    ),
  )
  const confidenceScore = Math.round(
    clamp(48 + Math.min(sampleSize, 45) * 0.72 + questions.length * 1.4 - classStd * 0.45, 35, 96),
  )
  const riskBuckets: RiskBucket[] = [
    { label: '優先補底', hint: '<55%', count: highCount, tone: 'rose' },
    { label: '邊緣提升', hint: '55-69%', count: watchCount, tone: 'amber' },
    { label: '穩定掌握', hint: '70-81%', count: stableCount, tone: 'blue' },
    { label: '高分拔尖', hint: '82%+', count: stretchCount, tone: 'green' },
  ]
  const confidence = sampleSize >= 30 ? '高' : sampleSize >= 12 ? '中' : '低'
  return {
    sampleSize,
    totalMax,
    classAverage: average(studentsWithTotals.map((student) => student.total)),
    classPercent,
    medianPercent: median(percentages),
    classStd,
    ciLow,
    ciHigh,
    p10,
    p25,
    p75,
    p90,
    volatility,
    riskIndex,
    confidenceScore,
    passRate: percent(studentsWithTotals.filter((student) => student.percent >= 50).length, sampleSize),
    excellenceRate: percent(studentsWithTotals.filter((student) => student.percent >= 80).length, sampleSize),
    atRiskCount,
    confidence,
    questionStats,
    weakest: [...questionStats].sort((a, b) => a.rate - b.rate).slice(0, 3),
    gradeDistribution,
    expectedGradeDistribution,
    questionLeverage,
    riskBuckets,
    students: studentsWithTotals.sort((a, b) => a.percent - b.percent),
  }
}

function applyScenario(
  students: StudentScore[],
  weakest: QuestionStat[],
  liftPercent: number,
): StudentScore[] {
  const targetIds = new Set(weakest.map((q) => q.id))
  return students.map((student) => ({
    ...student,
    scores: Object.fromEntries(
      Object.entries(student.scores).map(([qid, score]) => {
        const spec = QUESTION_SPECS.find((q) => q.id === qid)
        if (!spec || !targetIds.has(qid)) return [qid, score]
        const lifted = score + spec.max * (liftPercent / 100)
        return [qid, Math.min(spec.max, Math.round(lifted * 10) / 10)]
      }),
    ),
  }))
}

function parseScoreCsv(text: string): StudentScore[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('請最少提供標題列及一行學生分數。')
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map((cell) => cell.trim())
  const questionIndexes = QUESTION_SPECS.map((q) => {
    const index = headers.findIndex((header) => header.toLowerCase() === q.id.toLowerCase())
    if (index < 0) throw new Error(`找不到欄位 ${q.id}`)
    return index
  })

  return lines.slice(1).map((line, index) => {
    const cells = line.split(delimiter).map((cell) => cell.trim())
    const id = cells[0] || `S${String(index + 1).padStart(2, '0')}`
    const scores: Record<string, number> = {}
    QUESTION_SPECS.forEach((q, qIndex) => {
      const value = Number(cells[questionIndexes[qIndex]])
      if (!Number.isFinite(value)) throw new Error(`${id} 的 ${q.id} 不是有效分數。`)
      scores[q.id] = Math.max(0, Math.min(q.max, value))
    })
    return { id, scores }
  })
}

type XlsxModule = typeof import('xlsx')
let xlsxModule: XlsxModule | null = null

async function loadXlsx(): Promise<XlsxModule> {
  xlsxModule ??= await import('xlsx')
  return xlsxModule
}

function getXlsx(): XlsxModule {
  if (!xlsxModule) throw new Error('Excel 工具尚未載入，請再試一次。')
  return xlsxModule
}

type ExcelCellWithStyle = CellObject & {
  s?: Record<string, unknown>
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const prefix = type.startsWith('text/csv') ? '\ufeff' : ''
  downloadBlob(filename, new Blob([`${prefix}${text}`], { type }))
}

function studentsToCsv(students: StudentScore[]): string {
  const header = ['學生', ...QUESTION_SPECS.map((q) => q.id)]
  const rows = students.map((student) => [
    student.id,
    ...QUESTION_SPECS.map((q) => String(student.scores[q.id] ?? 0)),
  ])
  return [header, ...rows].map((row) => row.join(',')).join('\n')
}

function setCellStyle(sheet: WorkSheet, address: string, style: Record<string, unknown>): void {
  const cell = sheet[address] as ExcelCellWithStyle | undefined
  if (!cell) return
  cell.s = { ...(cell.s ?? {}), ...style }
}

function setRangeStyle(sheet: WorkSheet, rangeRef: string, style: Record<string, unknown>): void {
  const XLSX = getXlsx()
  const range = XLSX.utils.decode_range(rangeRef)
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      setCellStyle(sheet, XLSX.utils.encode_cell({ r: row, c: col }), style)
    }
  }
}

function setRangeNumberFormat(sheet: WorkSheet, rangeRef: string, format: string): void {
  const XLSX = getXlsx()
  const range = XLSX.utils.decode_range(rangeRef)
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = sheet[address] as ExcelCellWithStyle | undefined
      if (cell) cell.z = format
    }
  }
}

function setFormulaCell(
  sheet: WorkSheet,
  address: string,
  formula: string,
  type: ExcelDataType = 'n',
  format?: string,
): void {
  sheet[address] = { f: formula, t: type, z: format } as ExcelCellWithStyle
}

function gradeFormula(percentCell: string): string {
  return `IF(${percentCell}="","",IF(${percentCell}>=0.9,"5**",IF(${percentCell}>=0.85,"5*",IF(${percentCell}>=0.8,"5",IF(${percentCell}>=0.7,"4",IF(${percentCell}>=0.6,"3",IF(${percentCell}>=0.5,"2",IF(${percentCell}>=0.4,"1","U"))))))))`
}

function riskFormula(percentCell: string): string {
  return `IF(${percentCell}="","",IF(${percentCell}<0.55,"優先跟進",IF(${percentCell}<0.7,"邊緣提升",IF(${percentCell}>=0.82,"高分拔尖","穩定掌握"))))`
}

const MARK_TEMPLATE_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="0.0%"/>
    <numFmt numFmtId="165" formatCode="0.0"/>
  </numFmts>
  <fonts count="6">
    <font><sz val="11"/><color rgb="FF334155"/><name val="Aptos"/></font>
    <font><b/><sz val="20"/><color rgb="FF1E293B"/><name val="Aptos Display"/></font>
    <font><sz val="12"/><color rgb="FF64748B"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><color rgb="FF3730A3"/><name val="Aptos"/></font>
    <font><sz val="11"/><color rgb="FF334155"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><color rgb="FF475569"/><name val="Aptos"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="3">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="11">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="165" fontId="4" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
  <dxfs count="0"/>
  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`

type CellPoint = {
  col: number
  row: number
}

function columnNumber(label: string): number {
  return label.split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0)
}

function cellPoint(ref: string): CellPoint | null {
  const match = /^([A-Z]+)(\d+)$/.exec(ref)
  if (!match) return null
  return {
    col: columnNumber(match[1]),
    row: Number(match[2]),
  }
}

function inRect(point: CellPoint, startCol: number, startRow: number, endCol: number, endRow: number): boolean {
  return point.col >= startCol && point.col <= endCol && point.row >= startRow && point.row <= endRow
}

function styleWorksheetXml(xml: string, styleForRef: (ref: string) => number | undefined): string {
  const documentXml = new DOMParser().parseFromString(xml, 'application/xml')
  Array.from(documentXml.getElementsByTagName('c')).forEach((cell) => {
    const ref = cell.getAttribute('r')
    if (!ref) return
    const style = styleForRef(ref)
    if (style !== undefined) cell.setAttribute('s', String(style))
  })
  return new XMLSerializer().serializeToString(documentXml)
}

function inputSheetStyle(ref: string): number | undefined {
  const point = cellPoint(ref)
  if (!point) return undefined
  if (ref === 'A1') return 1
  if (ref === 'A2') return 2
  if (inRect(point, 1, 4, 15, 4)) return 8
  if (inRect(point, 1, 5, 15, 8)) return 9
  if (inRect(point, 1, 10, 15, 10)) return 3
  if (inRect(point, 1, 11, 15, 11)) return 8
  if (inRect(point, 1, 12, 10, 71) || inRect(point, 15, 12, 15, 71)) return 4
  if (inRect(point, 11, 12, 11, 71)) return 7
  if (inRect(point, 12, 12, 12, 71)) return 6
  if (inRect(point, 13, 12, 14, 71)) return 5
  return undefined
}

function configSheetStyle(ref: string): number | undefined {
  const point = cellPoint(ref)
  if (!point) return undefined
  if (ref === 'A1') return 1
  if (ref === 'A2') return 2
  if (inRect(point, 1, 4, 4, 6)) return 8
  if (inRect(point, 1, 8, 5, 8)) return 3
  if (inRect(point, 1, 18, 2, 18)) return 3
  if (inRect(point, 1, 9, 5, 16) || inRect(point, 1, 19, 2, 26)) return 4
  return undefined
}

function summarySheetStyle(ref: string): number | undefined {
  const point = cellPoint(ref)
  if (!point) return undefined
  if (ref === 'A1') return 1
  if (ref === 'A2') return 2
  if (inRect(point, 1, 4, 6, 4) || inRect(point, 1, 7, 7, 7)) return 3
  if (inRect(point, 1, 5, 6, 5)) return point.col === 3 || point.col === 4 || point.col === 5 ? 6 : 10
  if (inRect(point, 2, 8, 3, 15) || inRect(point, 5, 8, 6, 15)) return 7
  if (inRect(point, 4, 8, 4, 15)) return 6
  if (inRect(point, 7, 8, 7, 15)) return 9
  if (inRect(point, 1, 8, 1, 15)) return 4
  return undefined
}

function helpSheetStyle(ref: string): number | undefined {
  const point = cellPoint(ref)
  if (!point) return undefined
  if (ref === 'A1') return 1
  if (inRect(point, 1, 3, 1, 7)) return 3
  if (inRect(point, 1, 9, 1, 11)) return 8
  if (inRect(point, 2, 3, 2, 11)) return 9
  return undefined
}

async function applyMarkTemplateStyles(payload: ArrayBuffer): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(payload)
  zip.file('xl/styles.xml', MARK_TEMPLATE_STYLES_XML)
  const styleTargets: [string, (ref: string) => number | undefined][] = [
    ['xl/worksheets/sheet1.xml', inputSheetStyle],
    ['xl/worksheets/sheet2.xml', configSheetStyle],
    ['xl/worksheets/sheet3.xml', summarySheetStyle],
    ['xl/worksheets/sheet4.xml', helpSheetStyle],
  ]
  await Promise.all(
    styleTargets.map(async ([path, resolver]) => {
      const file = zip.file(path)
      if (!file) return
      const xml = await file.async('string')
      zip.file(path, styleWorksheetXml(xml, resolver))
    }),
  )
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
  })
}

function buildMarkInputSheet(profile: SubjectProfile, meta: ReportMeta): WorkSheet {
  const XLSX = getXlsx()
  const headers = [
    '學生編號',
    '姓名/代號',
    ...QUESTION_SPECS.map((q) => q.id),
    '總分',
    '得分率',
    '預測等級',
    '風險分層',
    '備註',
  ]
  const maxRow = [
    '滿分',
    '',
    ...QUESTION_SPECS.map((q) => q.max),
    '',
    '',
    '',
    '',
    '',
  ]
  const rows: (string | number)[][] = [
    ['EziTeach AI Cal Mark'],
    ['成績分析專用輸入表'],
    [],
    ['科目', profile.subject, '評估', meta.paperTitle, '級別', meta.classLevel, '日期', meta.date],
    [
      '使用方式',
      '只需填寫學生編號及每題得分；總分、得分率、等級及風險分層會自動計算。請保留題號標題，以便平台上載讀取。',
    ],
    [],
    ['資料私隱', '建議使用學生編號或匿名代號；上載後平台只以分數及代號分析，不需要學生全名。'],
    ['可改欄位', '學生編號、姓名/代號、Q1 至 Q8/Q9 得分、備註。其餘計算欄可保留公式。'],
    [],
    headers,
    maxRow,
    ...Array.from({ length: MARK_TEMPLATE_ROWS }, (_, index) => [
      `S${String(index + 1).padStart(2, '0')}`,
      '',
      ...QUESTION_SPECS.map(() => ''),
      '',
      '',
      '',
      '',
      '',
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const lastCol = XLSX.utils.encode_col(headers.length - 1)
  const firstQuestionCol = XLSX.utils.encode_col(2)
  const lastQuestionCol = XLSX.utils.encode_col(1 + QUESTION_SPECS.length)
  const totalCol = XLSX.utils.encode_col(2 + QUESTION_SPECS.length)
  const percentCol = XLSX.utils.encode_col(3 + QUESTION_SPECS.length)
  const gradeCol = XLSX.utils.encode_col(4 + QUESTION_SPECS.length)
  const riskCol = XLSX.utils.encode_col(5 + QUESTION_SPECS.length)
  const tableHeaderRow = MARK_INPUT_HEADER_ROW
  const maxExcelRow = MARK_INPUT_HEADER_ROW + 1
  const firstDataRow = MARK_INPUT_FIRST_DATA_ROW
  const lastDataRow = MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1

  setFormulaCell(sheet, `${totalCol}${maxExcelRow}`, `SUM(${firstQuestionCol}${maxExcelRow}:${lastQuestionCol}${maxExcelRow})`, 'n', '0')
  for (let row = firstDataRow; row <= lastDataRow; row += 1) {
    setFormulaCell(
      sheet,
      `${totalCol}${row}`,
      `IF(COUNTA(${firstQuestionCol}${row}:${lastQuestionCol}${row})=0,"",SUM(${firstQuestionCol}${row}:${lastQuestionCol}${row}))`,
      'n',
      '0.0',
    )
    setFormulaCell(sheet, `${percentCol}${row}`, `IF(${totalCol}${row}="","",${totalCol}${row}/$${totalCol}$${maxExcelRow})`, 'n', '0.0%')
    setFormulaCell(sheet, `${gradeCol}${row}`, gradeFormula(`${percentCol}${row}`), 's')
    setFormulaCell(sheet, `${riskCol}${row}`, riskFormula(`${percentCol}${row}`), 's')
  }

  sheet['!merges'] = [
    XLSX.utils.decode_range(`A1:${lastCol}1`),
    XLSX.utils.decode_range(`A2:${lastCol}2`),
    XLSX.utils.decode_range(`B5:${lastCol}5`),
    XLSX.utils.decode_range(`B7:${lastCol}7`),
    XLSX.utils.decode_range(`B8:${lastCol}8`),
  ]
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    ...QUESTION_SPECS.map(() => ({ wch: 9 })),
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 24 },
  ]
  sheet['!rows'] = [
    { hpt: 28 },
    { hpt: 22 },
    {},
    { hpt: 22 },
    { hpt: 34 },
    {},
    { hpt: 26 },
    { hpt: 26 },
    {},
    { hpt: 26 },
    { hpt: 24 },
  ]
  sheet['!autofilter'] = { ref: `A${tableHeaderRow}:${lastCol}${tableHeaderRow}` }

  const titleStyle = { font: { bold: true, color: { rgb: '1E293B' }, sz: 20 } }
  const subtitleStyle = { font: { color: { rgb: '475569' }, sz: 12 } }
  const headerStyle = {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { bold: true, color: { rgb: '3730A3' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } },
  }
  const inputStyle = {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
  }
  const formulaStyle = {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { color: { rgb: '334155' } },
  }
  setCellStyle(sheet, 'A1', titleStyle)
  setCellStyle(sheet, 'A2', subtitleStyle)
  setRangeStyle(sheet, `A${tableHeaderRow}:${lastCol}${tableHeaderRow}`, headerStyle)
  setRangeStyle(sheet, `${firstQuestionCol}${firstDataRow}:${lastQuestionCol}${lastDataRow}`, inputStyle)
  setRangeStyle(sheet, `${totalCol}${firstDataRow}:${riskCol}${lastDataRow}`, formulaStyle)
  setRangeNumberFormat(sheet, `${firstQuestionCol}${firstDataRow}:${lastQuestionCol}${lastDataRow}`, '0.0')
  setRangeNumberFormat(sheet, `${totalCol}${firstDataRow}:${totalCol}${lastDataRow}`, '0.0')
  setRangeNumberFormat(sheet, `${percentCol}${firstDataRow}:${percentCol}${lastDataRow}`, '0.0%')
  return sheet
}

function buildMarkConfigSheet(profile: SubjectProfile, meta: ReportMeta): WorkSheet {
  const XLSX = getXlsx()
  const rows = [
    ['EziTeach AI Cal Mark 設定'],
    ['本頁用作標記科目、評估及題目結構。上載平台時會按「輸入分數」工作表的題號讀取。'],
    [],
    ['科目', profile.subject, '評估', meta.paperTitle],
    ['級別', meta.classLevel, '學校/班級', meta.school],
    ['資料來源', meta.source, '報告日期', meta.date],
    [],
    ['題號', '滿分', '課題', '能力焦點', '平台跟進建議'],
    ...QUESTION_SPECS.map((q) => [q.id, q.max, q.topic, q.skill, q.advice]),
    [],
    ['等級線', '下限百分比'],
    ['5**', '90%'],
    ['5*', '85%'],
    ['5', '80%'],
    ['4', '70%'],
    ['3', '60%'],
    ['2', '50%'],
    ['1', '40%'],
    ['U', '<40%'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [
    XLSX.utils.decode_range('A1:E1'),
    XLSX.utils.decode_range('A2:E2'),
  ]
  sheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 18 }, { wch: 52 }]
  setCellStyle(sheet, 'A1', { font: { bold: true, color: { rgb: '1E293B' }, sz: 18 } })
  setRangeStyle(sheet, 'A8:E8', {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { bold: true, color: { rgb: '3730A3' } },
  })
  setRangeStyle(sheet, 'A18:B18', {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { bold: true, color: { rgb: '334155' } },
  })
  return sheet
}

function buildMarkSummarySheet(): WorkSheet {
  const XLSX = getXlsx()
  const rows = [
    ['EziTeach AI 成績摘要'],
    ['此頁會根據「輸入分數」自動計算，方便老師在上載前快速檢查分數是否合理。'],
    [],
    ['樣本數', '總滿分', '班平均', '預測合格', '預測 5 或以上', '優先跟進'],
    ['', '', '', '', '', ''],
    [],
    ['題目', '滿分', '平均', '得分率', '低於半分', '滿分人數', '教學提示'],
    ...QUESTION_SPECS.map((q) => [q.id, q.max, '', '', '', '', q.advice]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [
    XLSX.utils.decode_range('A1:G1'),
    XLSX.utils.decode_range('A2:G2'),
  ]
  sheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 56 }]
  setFormulaCell(sheet, 'A5', `COUNT('${MARK_INPUT_SHEET}'!K${MARK_INPUT_FIRST_DATA_ROW}:K${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1})`, 'n', '0')
  setFormulaCell(sheet, 'B5', `'${MARK_INPUT_SHEET}'!K${MARK_INPUT_HEADER_ROW + 1}`, 'n', '0')
  setFormulaCell(sheet, 'C5', `IF(A5=0,"",AVERAGE('${MARK_INPUT_SHEET}'!L${MARK_INPUT_FIRST_DATA_ROW}:L${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1}))`, 'n', '0.0%')
  setFormulaCell(sheet, 'D5', `IF(A5=0,"",COUNTIF('${MARK_INPUT_SHEET}'!L${MARK_INPUT_FIRST_DATA_ROW}:L${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1},">=0.5")/A5)`, 'n', '0.0%')
  setFormulaCell(sheet, 'E5', `IF(A5=0,"",COUNTIF('${MARK_INPUT_SHEET}'!L${MARK_INPUT_FIRST_DATA_ROW}:L${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1},">=0.8")/A5)`, 'n', '0.0%')
  setFormulaCell(sheet, 'F5', `COUNTIF('${MARK_INPUT_SHEET}'!L${MARK_INPUT_FIRST_DATA_ROW}:L${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1},"<0.55")`, 'n', '0')
  QUESTION_SPECS.forEach((_, index) => {
    const row = 8 + index
    const inputCol = XLSX.utils.encode_col(2 + index)
    setFormulaCell(sheet, `B${row}`, `'${MARK_INPUT_SHEET}'!${inputCol}${MARK_INPUT_HEADER_ROW + 1}`, 'n', '0')
    setFormulaCell(sheet, `C${row}`, `IF($A$5=0,"",AVERAGE('${MARK_INPUT_SHEET}'!${inputCol}${MARK_INPUT_FIRST_DATA_ROW}:${inputCol}${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1}))`, 'n', '0.0')
    setFormulaCell(sheet, `D${row}`, `IF($A$5=0,"",C${row}/B${row})`, 'n', '0.0%')
    setFormulaCell(sheet, `E${row}`, `COUNTIF('${MARK_INPUT_SHEET}'!${inputCol}${MARK_INPUT_FIRST_DATA_ROW}:${inputCol}${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1},"<"&B${row}*0.5)`, 'n', '0')
    setFormulaCell(sheet, `F${row}`, `COUNTIF('${MARK_INPUT_SHEET}'!${inputCol}${MARK_INPUT_FIRST_DATA_ROW}:${inputCol}${MARK_INPUT_FIRST_DATA_ROW + MARK_TEMPLATE_ROWS - 1},B${row})`, 'n', '0')
  })
  setCellStyle(sheet, 'A1', { font: { bold: true, color: { rgb: '1E293B' }, sz: 18 } })
  setRangeStyle(sheet, 'A4:F4', {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { bold: true, color: { rgb: '3730A3' } },
    alignment: { horizontal: 'center' },
  })
  setRangeStyle(sheet, 'A7:G7', {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { bold: true, color: { rgb: '334155' } },
  })
  return sheet
}

function buildMarkHelpSheet(): WorkSheet {
  const XLSX = getXlsx()
  const rows = [
    ['EziTeach AI Cal Mark 使用說明'],
    [],
    ['1', '下載模板後，先在「設定」頁確認科目、評估及題目滿分。'],
    ['2', '到「輸入分數」頁，只填寫學生編號 / 代號及各題得分。'],
    ['3', '如某學生缺席或未完成，請留空整行；不要輸入文字到分數欄。'],
    ['4', '系統會讀取第 10 列的題號欄位；請不要刪除或改名 Q1 至 Q8/Q9。'],
    ['5', '填妥後回到 EziTeach AI 成績分析頁，按「上載 Excel 並分析」。'],
    [],
    ['私隱建議', '使用學生編號或匿名代號即可；不需要上載學生全名。'],
    ['支援格式', '.xlsx、.xls、.csv、.tsv。Excel 模板效果最佳。'],
    ['分析輸出', '平台會生成班平均、等級預測、精算風險、題目診斷、跟進名單及成績報告。'],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!merges'] = [XLSX.utils.decode_range('A1:B1')]
  sheet['!cols'] = [{ wch: 14 }, { wch: 86 }]
  setCellStyle(sheet, 'A1', { font: { bold: true, color: { rgb: '1E293B' }, sz: 18 } })
  setRangeStyle(sheet, 'A3:A7', {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { bold: true, color: { rgb: '3730A3' } },
    alignment: { horizontal: 'center' },
  })
  return sheet
}

async function downloadMarkTemplate(profile: SubjectProfile, meta: ReportMeta): Promise<void> {
  const XLSX = await loadXlsx()
  const workbook = XLSX.utils.book_new()
  workbook.Props = {
    Title: 'EziTeach AI Cal Mark Template',
    Subject: `${profile.subject} 成績分析`,
    Author: 'EziTeach AI',
    Company: 'EziTeach AI',
    CreatedDate: new Date(),
  }
  XLSX.utils.book_append_sheet(workbook, buildMarkInputSheet(profile, meta), MARK_INPUT_SHEET)
  XLSX.utils.book_append_sheet(workbook, buildMarkConfigSheet(profile, meta), MARK_CONFIG_SHEET)
  XLSX.utils.book_append_sheet(workbook, buildMarkSummarySheet(), MARK_SUMMARY_SHEET)
  XLSX.utils.book_append_sheet(workbook, buildMarkHelpSheet(), MARK_HELP_SHEET)
  const payload = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
    cellStyles: true,
  }) as ArrayBuffer
  downloadBlob(MARK_TEMPLATE_FILENAME, await applyMarkTemplateStyles(payload))
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
}

function matchesQuestionHeader(value: unknown, question: QuestionSpec): boolean {
  const header = normalizeHeader(value)
  const target = normalizeHeader(question.id)
  if (header === target) return true
  if (question.id !== 'Q8/Q9') return false
  return ['q8', 'q9', 'q8q9', 'q8/q9', 'q8或q9'].includes(header)
}

function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

function parseScoreCell(value: unknown, label: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value).trim())
  if (!Number.isFinite(parsed)) throw new Error(`${label} 不是有效分數。`)
  return parsed
}

function parseScoreRows(rows: unknown[][]): StudentScore[] {
  const headerRowIndex = rows.findIndex((row) =>
    QUESTION_SPECS.every((q) => row.some((cell) => matchesQuestionHeader(cell, q))),
  )
  if (headerRowIndex < 0) throw new Error('找不到題號標題列，請保留 Q1 至 Q8/Q9 欄位。')
  const headers = rows[headerRowIndex]
  const questionIndexes = QUESTION_SPECS.map((q) => {
    const index = headers.findIndex((header) => matchesQuestionHeader(header, q))
    if (index < 0) throw new Error(`找不到欄位 ${q.id}`)
    return index
  })
  const studentIndex = headers.findIndex((header) =>
    ['學生', '學生編號', '學生代號', 'student', 'studentid', 'id'].includes(normalizeHeader(header)),
  )
  const parsed: StudentScore[] = []
  rows.slice(headerRowIndex + 1).forEach((row, rowOffset) => {
    const rawId = studentIndex >= 0 ? row[studentIndex] : row[0]
    const id = String(rawId ?? '').trim()
    if (normalizeHeader(id) === '滿分') return
    const questionCells = questionIndexes.map((index) => row[index])
    const allScoresBlank = questionCells.every(isBlankCell)
    if (allScoresBlank) return
    const safeId = id || `S${String(parsed.length + 1).padStart(2, '0')}`
    const scores: Record<string, number> = {}
    QUESTION_SPECS.forEach((q, qIndex) => {
      const rawScore = questionCells[qIndex]
      if (isBlankCell(rawScore)) throw new Error(`${safeId} 的 ${q.id} 未有分數。`)
      const value = parseScoreCell(rawScore, `${safeId} 的 ${q.id}`)
      scores[q.id] = clamp(value, 0, q.max)
    })
    parsed.push({ id: safeId, scores })
    if (rowOffset > 500) throw new Error('暫時最多支援 500 行學生資料。')
  })
  if (parsed.length === 0) throw new Error('未找到任何學生分數，請在模板內輸入分數後再上載。')
  return parsed
}

function parseScoreWorkbook(buffer: ArrayBuffer): StudentScore[] {
  const XLSX = getXlsx()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    workbook.SheetNames.find((name) => normalizeHeader(name) === normalizeHeader(MARK_INPUT_SHEET)) ??
    workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Excel 檔案沒有可讀取的工作表。')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  })
  return parseScoreRows(rows)
}

function getSubjectProfile(id: SubjectProfileId): SubjectProfile {
  return SUBJECT_PROFILES.find((profile) => profile.id === id) ?? SUBJECT_PROFILES[0]
}

function distributionScores(question: QuestionStat): number[] {
  return expandDistribution(question.distribution)
}

function scoreRange(question: QuestionStat): string {
  const scores = distributionScores(question)
  if (scores.length === 0) return '-'
  return `${Math.min(...scores)}-${Math.max(...scores)}`
}

function questionMedian(question: QuestionStat): number {
  return median(distributionScores(question))
}

function scoreBandCounts(question: QuestionStat): {
  full: number
  high: number
  mid: number
  low: number
} {
  const scores = distributionScores(question)
  return {
    full: scores.filter((score) => score >= question.max).length,
    high: scores.filter((score) => score < question.max && percent(score, question.max) >= 80).length,
    mid: scores.filter((score) => {
      const rate = percent(score, question.max)
      return rate >= 50 && rate < 80
    }).length,
    low: scores.filter((score) => percent(score, question.max) < 50).length,
  }
}

function splitQuestionParts(question: QuestionStat): string[] {
  return question.title
    .split(/[；;]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function questionRequirementBullets(question: QuestionStat, profile: SubjectProfile): string[] {
  const parts = splitQuestionParts(question)
  if (parts.length === 0) return [`處理 ${question.topic}，展示${profile.overviewNoun}。`]
  return parts.slice(0, 4).map((part, index) => {
    const label = parts.length > 1 ? `${question.id}(${String.fromCharCode(97 + index)})` : question.id
    return `${label} 處理「${part}」，並展示${profile.answerLens}。`
  })
}

function referencePointBullets(question: QuestionStat, profile: SubjectProfile): string[] {
  return [
    `${question.topic} 要扣回題目情境，避免只背概念。`,
    `${question.skill} 建議使用「${profile.answerLens}」作答。`,
    `高分答案需要同時有關鍵詞、證據及清楚推論。`,
  ]
}

function performanceBullets(question: QuestionStat, profile: SubjectProfile): string[] {
  const strong = question.rate >= 80
  const weak = question.rate < 65
  if (strong) {
    return [
      `本題平均得分率 ${format1(question.rate)}%，整體表現穩定，反映學生能掌握${question.topic}。`,
      `滿分或高分比例較高，可抽取答案結構作同儕互評或示例。`,
      `後續重點是提升答案精準度，避免在容易題失去細分。`,
    ]
  }
  if (weak) {
    return [
      `本題平均得分率 ${format1(question.rate)}%，是本份報告的主要補強位置。`,
      `低於半分共有 ${question.lowCount} 人，顯示學生在${profile.lossLens}上有共同風險。`,
      `建議先用共同錯因重教，再安排分層練習。`,
    ]
  }
  return [
    `本題平均得分率 ${format1(question.rate)}%，屬中等穩定但仍有提升空間。`,
    `學生大致掌握${question.topic}，但在${question.skill}上仍有分化。`,
    `可把邊緣學生集中處理，提升整體中位數。`,
  ]
}

function lossPointBullets(question: QuestionStat, profile: SubjectProfile): string[] {
  return [
    `${profile.lossLens}。`,
    `未能把答案扣回「${question.topic}」或忽略題目限制。`,
    `${question.skill} 表達不夠完整，令答案只停留在部分得分。`,
  ]
}

function followUpBullets(question: QuestionStat, profile: SubjectProfile): string[] {
  return [
    question.advice,
    profile.followUpLens,
    `把 ${question.id} 拆成 10-15 分鐘短練習，完成後用同類題重測。`,
  ]
}

function buildReportMarkdown(
  profile: SubjectProfile,
  meta: ReportMeta,
  analysis: Analysis,
): string {
  const stable = [...analysis.questionStats].sort((a, b) => b.rate - a.rate).slice(0, 3)
  const weak = analysis.weakest
  const rows = analysis.questionStats
    .map((q) => `| ${q.id} | ${q.title} | ${format1(q.average)}/${q.max} | ${format1(q.rate)}% | ${q.lowCount} |`)
    .join('\n')
  const chapters = analysis.questionStats
    .map((q) => {
      const bands = scoreBandCounts(q)
      return [
        `## ${q.id} 學生作答內容及得分分析`,
        `資料來源：${meta.source}。私隱處理：本報告只顯示匿名統計及分數分佈。`,
        '',
        `### 一、得分概覽`,
        `- 樣本數：${analysis.sampleSize} 份`,
        `- 滿分：${q.max} 分`,
        `- 平均分：${format1(q.average)} / ${q.max}`,
        `- 得分率：${format1(q.rate)}%`,
        `- 中位數：${format1(questionMedian(q))}`,
        `- 分數範圍：${scoreRange(q)}`,
        `- 標準差：${format1(q.std)}`,
        `- 滿分：${bands.full} 人；80% 或以上但未滿分：${bands.high} 人；50% 至 79%：${bands.mid} 人；低於 50%：${bands.low} 人`,
        '',
        `### 二、題目要求`,
        ...questionRequirementBullets(q, profile).map((item) => `- ${item}`),
        '',
        `### 三、參考答案重點`,
        ...referencePointBullets(q, profile).map((item) => `- ${item}`),
        '',
        `### 四、學生作答表現分析`,
        ...performanceBullets(q, profile).map((item) => `- ${item}`),
        '',
        `### 五、常見失分位`,
        ...lossPointBullets(q, profile).map((item) => `- ${item}`),
        '',
        `### 六、跟進建議`,
        ...followUpBullets(q, profile).map((item) => `- ${item}`),
      ].join('\n')
    })
    .join('\n\n')
  return [
    `# ${meta.paperTitle} 學生表現分析總報告`,
    '',
    `POST-EXAM ANALYSIS | ${meta.brand}`,
    `${meta.school}｜${meta.examName}｜${meta.classLevel} ${profile.subject} ${profile.paperName}｜${meta.date}`,
    '',
    `## 本合併版用途`,
    `- 快速掌握全卷每題表現、常見失分位及跟進方向。`,
    `- 方便列印或分享給同科老師作試後檢討。`,
    `- 後續每題章節保留匿名分數分佈、作答分析和跟進建議，不包含逐份試卷或檔案得分紀錄。`,
    '',
    `## 全卷總結摘要`,
    `整體表現最穩定的是 ${stable.map((q) => q.id).join('、')}；最需要補強的是 ${weak.map((q) => q.id).join('、')}。`,
    '',
    `| 題目 | 考核重點 | 平均 | 得分率 | 低於半分 |`,
    `| --- | --- | ---: | ---: | ---: |`,
    rows,
    '',
    `## 試後跟進優先次序`,
    ...weak.map((q, index) => `- 第${index + 1}優先：${q.id} ${q.topic}。${q.advice}`),
    '',
    `## 目錄`,
    ...analysis.questionStats.map((q) => `- ${q.id} ${q.id} 學生作答內容及得分分析`),
    '',
    chapters,
  ].join('\n')
}

export default function GradeAnalytics() {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [view, setView] = useState<ViewId>('overview')
  const [students, setStudents] = useState<StudentScore[]>(() => buildDemoStudents())
  const [activeQuestionId, setActiveQuestionId] = useState('Q8/Q9')
  const [scenarioLift, setScenarioLift] = useState(8)
  const [importText, setImportText] = useState(SAMPLE_CSV)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<SubjectProfileId>('general')
  const [reportMeta, setReportMeta] = useState<ReportMeta>(() => ({
    school: '寧波第二中學',
    classLevel: '中五級',
    examName: '2025-2026 第二學期考試',
    paperTitle: 'S5 T2 DSE 模擬卷',
    source: '考生 PDF 封面逐題分數、題目文件及參考答案',
    date: new Date().toISOString().slice(0, 10),
    brand: 'EziTeach AI',
  }))

  const analysis = useMemo(() => analyze(students, QUESTION_SPECS), [students])
  const scenario = useMemo(
    () => analyze(applyScenario(students, analysis.weakest, scenarioLift), QUESTION_SPECS),
    [analysis.weakest, scenarioLift, students],
  )
  const subjectProfile = getSubjectProfile(subjectId)
  const activeQuestion =
    analysis.questionStats.find((question) => question.id === activeQuestionId) ??
    analysis.weakest[0]
  const uplift = scenario.classPercent - analysis.classPercent
  const savedFromRisk = analysis.atRiskCount - scenario.atRiskCount

  const updateReportMeta = (key: keyof ReportMeta, value: string) => {
    setReportMeta((current) => ({ ...current, [key]: value }))
  }

  const exportReport = () => {
    downloadText(
      'eziteach-grade-report.md',
      buildReportMarkdown(subjectProfile, reportMeta, analysis),
      'text/markdown;charset=utf-8',
    )
  }

  const applyImportedScores = (parsed: StudentScore[], sourceLabel: string) => {
    setStudents(parsed)
    setUploadedFileName(sourceLabel)
    toast.success(`已匯入 ${parsed.length} 位學生分數`)
    setView('overview')
  }

  const importCsv = () => {
    try {
      const parsed = parseScoreCsv(importText)
      applyImportedScores(parsed, '貼上 CSV / TSV')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '匯入失敗，請檢查格式。')
    }
  }

  const importScoreFile = async (file: File | null | undefined) => {
    if (!file) return
    try {
      const lowerName = file.name.toLowerCase()
      if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || file.type.includes('csv')) {
        const text = await file.text()
        applyImportedScores(parseScoreCsv(text), file.name)
        return
      }
      const buffer = await file.arrayBuffer()
      await loadXlsx()
      applyImportedScores(parseScoreWorkbook(buffer), file.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上載失敗，請檢查 Excel 欄位及分數格式。')
    }
  }

  return (
    <div className="-mx-4 -mt-1 bg-slate-50/70 pb-8 dark:bg-slate-950 sm:-mx-6 lg:-mx-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,text/csv"
        className="hidden"
        aria-label="上載 Excel 或 CSV 分數檔"
        onChange={(event) => {
          void importScoreFile(event.currentTarget.files?.[0])
          event.currentTarget.value = ''
        }}
      />
      <section className="border-b border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge tone="accent" icon={BrainCircuit}>預測模型 beta</Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[32px]">
                成績分析
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                由分數分佈去到等級預測、弱項診斷、分層跟進。加入精算式風險分層、信心區間與補救 ROI，預設載入匿名樣本，可匯入你自己科目的 CSV / Excel 分數。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                icon={FileText}
                onClick={() => setView('report')}
              >
                成績報告
              </Button>
              <Button
                variant="secondary"
                icon={Download}
                onClick={() => {
                  void downloadMarkTemplate(subjectProfile, reportMeta)
                }}
              >
                Excel 模板
              </Button>
              <Button
                variant="secondary"
                icon={Download}
                onClick={() => downloadText('eziteach-grade-analytics.csv', studentsToCsv(students))}
              >
                匯出 CSV
              </Button>
              <Button icon={Upload} onClick={() => setView('import')}>
                匯入分數
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label="班平均"
              value={format1(analysis.classPercent)}
              unit="%"
              icon={TrendingUp}
              highlight
              hint={`95% 區間 ${format1(analysis.ciLow)}-${format1(analysis.ciHigh)}%`}
            />
            <StatCard
              label="預測合格"
              value={format1(analysis.passRate)}
              unit="%"
              icon={CheckCircle2}
              hint={`中位數 ${format1(analysis.medianPercent)}%`}
            />
            <StatCard
              label="預測 5 或以上"
              value={format1(analysis.excellenceRate)}
              unit="%"
              icon={Target}
              hint="按校內分數線估算"
            />
            <StatCard
              label="優先跟進"
              value={analysis.atRiskCount}
              unit="人"
              icon={AlertTriangle}
              trend={{
                value: savedFromRisk > 0 ? `-${savedFromRisk}` : '0',
                dir: savedFromRisk > 0 ? 'down' : 'flat',
              }}
              hint="預測低於 55%"
            />
            <StatCard
              label="風險指數"
              value={analysis.riskIndex}
              unit="/100"
              icon={Gauge}
              hint={`模型信心 ${analysis.confidenceScore}/100`}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
        <GradeAnalysisTabs tabs={VIEW_TABS} active={view} onChange={setView} icons={VIEW_ICONS} />

        {view === 'overview' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <div className="space-y-5">
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={BarChart3} description="按全卷百分比推算 DSE-style 等級分佈">
                  預測等級分佈
                </SectionTitle>
                <GradeBars distribution={analysis.gradeDistribution} total={analysis.sampleSize} />
              </Card>

              <Card className="p-4 sm:p-5">
                <SectionTitle
                  icon={Search}
                  description="點擊題目切換右側分佈；色階越深代表得分率越低"
                >
                  題目表現地圖
                </SectionTitle>
                <QuestionMap
                  questions={analysis.questionStats}
                  activeId={activeQuestion.id}
                  onSelect={setActiveQuestionId}
                />
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={Calculator} description="班級尾部風險與預測穩定度">
                  精算摘要
                </SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <MiniMetric label="P10 下行情境" value={`${format1(analysis.p10)}%`} />
                  <MiniMetric label="波動率" value={`${format1(analysis.volatility)}%`} />
                  <MiniMetric label="P90 上行情境" value={`${format1(analysis.p90)}%`} />
                  <MiniMetric label="信心分" value={`${analysis.confidenceScore}/100`} />
                </div>
              </Card>

              <Card className="p-4 sm:p-5">
                <SectionTitle icon={SlidersHorizontal} description="假設最弱三題平均提升">
                  提升情境
                </SectionTitle>
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      弱項題目提升
                    </span>
                    <span className="text-lg font-bold tabular-nums text-accent">
                      +{scenarioLift}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={15}
                    value={scenarioLift}
                    onChange={(event) => setScenarioLift(Number(event.target.value))}
                    className="mt-4 w-full accent-[color:var(--accent)]"
                    aria-label="弱項題目提升百分比"
                  />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MiniMetric label="班平均變化" value={`+${format1(Math.max(0, uplift))}%`} />
                    <MiniMetric label="離開風險" value={`${Math.max(0, savedFromRisk)} 人`} />
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-5">
                <SectionTitle icon={BarChart3} description={`${activeQuestion.id} · ${activeQuestion.topic}`}>
                  分數分佈
                </SectionTitle>
                <Histogram question={activeQuestion} />
              </Card>
            </div>
          </div>
        )}

        {view === 'actuarial' && (
          <ActuarialView analysis={analysis} scenario={scenario} scenarioLift={scenarioLift} />
        )}

        {view === 'report' && (
          <ReportView
            analysis={analysis}
            activeQuestion={activeQuestion}
            onSelectQuestion={setActiveQuestionId}
            profile={subjectProfile}
            subjectId={subjectId}
            onSubjectChange={setSubjectId}
            meta={reportMeta}
            onMetaChange={updateReportMeta}
            onExport={exportReport}
          />
        )}

        {view === 'questions' && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)]">
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={ListChecks} description="按得分率由低至高排序">
                題目診斷
              </SectionTitle>
              <div className="space-y-3">
                {[...analysis.questionStats]
                  .sort((a, b) => a.rate - b.rate)
                  .map((question) => (
                    <QuestionRow
                      key={question.id}
                      question={question}
                      active={activeQuestion.id === question.id}
                      onSelect={() => setActiveQuestionId(question.id)}
                    />
                  ))}
              </div>
            </Card>

            <div className="space-y-5">
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={Lightbulb} description="系統按題目表現自動生成">
                  教學跟進建議
                </SectionTitle>
                <InsightList weakest={analysis.weakest} />
              </Card>
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={BarChart3} description={activeQuestion.title}>
                  {activeQuestion.id} 匿名分佈
                </SectionTitle>
                <Histogram question={activeQuestion} compact />
              </Card>
            </div>
          </div>
        )}

        {view === 'students' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={Users} description="匿名顯示，避免在投影時暴露學生身份">
                分層跟進名單
              </SectionTitle>
              <StudentTable students={analysis.students} totalMax={analysis.totalMax} />
            </Card>
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={Lightbulb} description="可直接轉化為課後行動">
                分組策略
              </SectionTitle>
              <div className="space-y-3">
                <ActionCard
                  tone="rose"
                  title="優先補底"
                  meta={`${analysis.students.filter((s) => s.risk === 'high').length} 人`}
                  body="安排 15 分鐘小組重教，集中最弱題目的概念與公式。"
                />
                <ActionCard
                  tone="amber"
                  title="邊緣提升"
                  meta={`${analysis.students.filter((s) => s.risk === 'watch').length} 人`}
                  body="派一份短練習，把 2/3 邊緣學生推上 3/4。"
                />
                <ActionCard
                  tone="green"
                  title="高分拔尖"
                  meta={`${analysis.students.filter((s) => s.risk === 'stretch').length} 人`}
                  body="用 Q8/Q9 延伸題做高階判斷和論述訓練。"
                />
              </div>
            </Card>
          </div>
        )}

        {view === 'import' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="p-4 sm:p-5">
              <SectionTitle icon={FileSpreadsheet} description="下載平台專用 Excel，填分後直接上載分析">
                EziTeach Cal Mark Excel
              </SectionTitle>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-accent/20 bg-accent-soft/60 p-4 dark:bg-accent/10">
                  <p className="text-sm font-semibold text-accent-strong dark:text-accent-light">
                    老師工作流
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    模板已內置題號、滿分、總分公式、得分率、預測等級及風險分層。老師只需要填學生編號和每題分數。
                  </p>
                </div>

                <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {[
                    ['01', '下載模板', '取得 EziTeach AI 專用 .xlsx，欄位與平台分析模型一致。'],
                    ['02', '輸入分數', '在「輸入分數」工作表填 Q1 至 Q8/Q9，公式即時計算。'],
                    ['03', '上載分析', '平台讀取 Excel 後生成預測、風險、弱項及報告。'],
                  ].map(([step, title, body]) => (
                    <div key={step} className="grid gap-3 p-3 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm font-semibold text-accent shadow-sm ring-1 ring-accent/10 dark:bg-slate-900">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                        <p className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    icon={Download}
                    onClick={() => {
                      void downloadMarkTemplate(subjectProfile, reportMeta)
                    }}
                  >
                    下載 Excel 模板
                  </Button>
                  <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                    上載 Excel 並分析
                  </Button>
                  <Button
                    variant="ghost"
                    icon={FileSpreadsheet}
                    onClick={() => setImportText(studentsToCsv(buildDemoStudents()))}
                  >
                    載入 demo CSV
                  </Button>
                </div>

                {uploadedFileName && (
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    最近上載：{uploadedFileName}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionTitle icon={ShieldCheck} description="專業模板，減少上載錯誤">
                模板設計
              </SectionTitle>
              <div className="space-y-4">
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {[
                    ['輸入分數', '老師唯一需要填寫的工作表'],
                    ['設定', '科目、評估、題目滿分及等級線'],
                    ['分析摘要', '上載前可先核對平均、合格率及弱項'],
                    ['使用說明', '清楚列明可改欄位和私隱建議'],
                  ].map(([title, body]) => (
                    <div key={title} className="flex gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
                        <p className="text-slate-500 dark:text-slate-400">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    目前題目滿分
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUESTION_SPECS.map((question) => (
                      <span
                        key={question.id}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {question.id} / {question.max}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 sm:p-5 xl:col-span-2">
              <SectionTitle icon={BrainCircuit} description="給已有 CSV 或想由 Excel 複製貼上的老師使用">
                進階匯入
              </SectionTitle>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <Field
                  label="CSV / TSV 內容"
                  hint="欄位格式：學生,Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8/Q9"
                >
                  <Textarea
                    value={importText}
                    onChange={(event) => setImportText(event.target.value)}
                    className="min-h-[220px] font-mono text-sm"
                  />
                </Field>
                <div className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    上載規則
                  </p>
                  <p>1. Excel 會自動搜尋含 Q1 至 Q8/Q9 的標題列。</p>
                  <p>2. 分數可留整行空白；如某題漏填，系統會提示學生與題號。</p>
                  <p>3. 可使用學生編號或匿名代號，不需要輸入真名。</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button icon={Upload} onClick={importCsv}>
                      匯入文字
                    </Button>
                    <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
                      選擇檔案
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportView({
  analysis,
  activeQuestion,
  onSelectQuestion,
  profile,
  subjectId,
  onSubjectChange,
  meta,
  onMetaChange,
  onExport,
}: {
  analysis: Analysis
  activeQuestion: QuestionStat
  onSelectQuestion: (id: string) => void
  profile: SubjectProfile
  subjectId: SubjectProfileId
  onSubjectChange: (id: SubjectProfileId) => void
  meta: ReportMeta
  onMetaChange: (key: keyof ReportMeta, value: string) => void
  onExport: () => void
}) {
  const stable = [...analysis.questionStats].sort((a, b) => b.rate - a.rate).slice(0, 3)
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon={Settings2} description="同一框架，可按科目語言調整">
            報告設定
          </SectionTitle>
          <div className="space-y-3">
            <Field label="科目 profile">
              <select
                value={subjectId}
                onChange={(event) => onSubjectChange(event.target.value as SubjectProfileId)}
                className={CONTROL_CLASS}
              >
                {SUBJECT_PROFILES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="報告標題">
              <input
                value={meta.paperTitle}
                onChange={(event) => onMetaChange('paperTitle', event.target.value)}
                className={CONTROL_CLASS}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="級別">
                <input
                  value={meta.classLevel}
                  onChange={(event) => onMetaChange('classLevel', event.target.value)}
                  className={CONTROL_CLASS}
                />
              </Field>
              <Field label="日期">
                <input
                  value={meta.date}
                  onChange={(event) => onMetaChange('date', event.target.value)}
                  className={CONTROL_CLASS}
                />
              </Field>
            </div>
            <Field label="學校 / 班級">
              <input
                value={meta.school}
                onChange={(event) => onMetaChange('school', event.target.value)}
                className={CONTROL_CLASS}
              />
            </Field>
            <Field label="考試名稱">
              <input
                value={meta.examName}
                onChange={(event) => onMetaChange('examName', event.target.value)}
                className={CONTROL_CLASS}
              />
            </Field>
            <Field label="資料來源">
              <Textarea
                value={meta.source}
                onChange={(event) => onMetaChange('source', event.target.value)}
                className="min-h-[96px] text-sm"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={Download} onClick={onExport}>
              下載報告
            </Button>
            <Button variant="secondary" icon={BookOpenCheck} onClick={() => window.print()}>
              列印
            </Button>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon={FileText} description="按你提供的 PDF 骨架生成">
            報告框架
          </SectionTitle>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {[
              '封面：POST-EXAM ANALYSIS、報告標題、用途',
              '全卷總結摘要：穩定題、補強題、逐題總表',
              '試後跟進優先次序：由弱項轉成行動',
              '目錄：Q1 至 Q8/Q9 逐題章節',
              '逐題報告：得分概覽、分佈、題目要求、答案重點',
              '作答分析、常見失分位、跟進建議',
            ].map((item, index) => (
              <div key={item} className="flex gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                <span className="font-semibold tabular-nums text-accent">{String(index + 1).padStart(2, '0')}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon={ListChecks} description="選擇右側預覽焦點">
            章節導覽
          </SectionTitle>
          <div className="space-y-2">
            {analysis.questionStats.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => onSelectQuestion(question.id)}
                className={cx(
                  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  activeQuestion.id === question.id
                    ? 'border-accent/30 bg-accent-soft text-accent-strong'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-accent/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
                )}
              >
                <span className="text-sm font-semibold">{question.id}</span>
                <span className="text-xs tabular-nums">{format1(question.rate)}%</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge tone="accent" icon={FileText}>
                  成績報告
                </Badge>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  最穩定：{stable.map((q) => q.id).join('、')} · 最需補強：{analysis.weakest.map((q) => q.id).join('、')}
                </p>
              </div>
              <Badge tone="slate">{profile.subject} · {analysis.sampleSize} 份樣本</Badge>
            </div>
          </div>
          <div className="bg-slate-100 p-3 dark:bg-slate-950 sm:p-5">
            <ReportDocument
              analysis={analysis}
              activeQuestion={activeQuestion}
              profile={profile}
              meta={meta}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

function ReportDocument({
  analysis,
  activeQuestion,
  profile,
  meta,
}: {
  analysis: Analysis
  activeQuestion: QuestionStat
  profile: SubjectProfile
  meta: ReportMeta
}) {
  const stable = [...analysis.questionStats].sort((a, b) => b.rate - a.rate).slice(0, 3)
  const weak = analysis.weakest
  return (
    <article className="mx-auto max-w-[980px] space-y-5 bg-white p-5 text-slate-950 shadow-sm ring-1 ring-slate-200 dark:bg-white dark:text-slate-950 sm:p-8">
      <section className="rounded-sm border border-slate-300 bg-slate-50 p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-500">POST-EXAM ANALYSIS</p>
        <div className="mt-3 flex items-end justify-between border-t border-slate-800 pt-3">
          <div>
            <p className="text-5xl font-light tracking-tight">{meta.brand}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">NOTE · THINK · KNOW</p>
          </div>
          <p className="text-xs uppercase tracking-wider text-slate-500">CLASSROOM REPORT</p>
        </div>
      </section>

      <section className="py-6 text-center">
        <p className="text-3xl font-semibold tracking-tight sm:text-5xl">{meta.paperTitle}</p>
        <h2 className="mt-3 text-2xl font-semibold sm:text-4xl">學生表現分析總報告</h2>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          合併 {analysis.questionStats[0]?.id} 至 {analysis.questionStats.at(-1)?.id} 逐題報告｜{analysis.sampleSize} 份匿名分數資料｜{meta.date}
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold">本合併版用途</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
          <li>快速掌握全卷每題表現、常見失分位及跟進方向。</li>
          <li>方便列印或分享給同科老師作試後檢討。</li>
          <li>後續每題章節保留匿名分數分佈、作答分析和跟進建議，不包含逐份試卷或檔案得分紀錄。</li>
        </ul>
      </section>

      <section className="border-t border-slate-200 pt-6">
        <h3 className="text-center text-2xl font-semibold">全卷總結摘要</h3>
        <p className="mt-4 text-sm leading-6">
          整體表現最穩定的是 {stable.map((q) => q.id).join('、')}；最需要補強的是 {weak.map((q) => q.id).join('、')}。
          本報告以{profile.evidenceLens}為基礎，重點分析{profile.overviewNoun}。
        </p>
        <ReportSummaryTable questions={analysis.questionStats} />
      </section>

      <section>
        <h3 className="text-xl font-semibold">試後跟進優先次序</h3>
        <div className="mt-3 space-y-2">
          {weak.map((question, index) => (
            <p key={question.id} className="text-sm leading-6">
              <span className="font-semibold">第{index + 1}優先：</span>
              {question.id} {question.topic}。{index === 0 ? `建議用「${profile.answerLens}」重建答題框架。` : question.advice}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold">目錄</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-left">章節</th>
                <th className="border border-slate-300 px-3 py-2 text-left">內容</th>
              </tr>
            </thead>
            <tbody>
              {analysis.questionStats.map((question) => (
                <tr key={question.id}>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">{question.id}</td>
                  <td className="border border-slate-300 px-3 py-2">{question.id} 學生作答內容及得分分析</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ReportQuestionChapter question={activeQuestion} analysis={analysis} profile={profile} meta={meta} />
    </article>
  )
}

function ReportSummaryTable({ questions }: { questions: QuestionStat[] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-3 py-2 text-left">題目</th>
            <th className="border border-slate-300 px-3 py-2 text-left">考核重點</th>
            <th className="border border-slate-300 px-3 py-2 text-left">平均</th>
            <th className="border border-slate-300 px-3 py-2 text-left">得分率</th>
            <th className="border border-slate-300 px-3 py-2 text-left">低於半分</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <tr key={question.id} className="even:bg-slate-50">
              <td className="border border-slate-300 px-3 py-2 font-semibold">{question.id}</td>
              <td className="border border-slate-300 px-3 py-2">{question.title}</td>
              <td className="border border-slate-300 px-3 py-2 tabular-nums">{format1(question.average)}/{question.max}</td>
              <td className="border border-slate-300 px-3 py-2 tabular-nums">{format1(question.rate)}%</td>
              <td className="border border-slate-300 px-3 py-2 tabular-nums">{question.lowCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportQuestionChapter({
  question,
  analysis,
  profile,
  meta,
}: {
  question: QuestionStat
  analysis: Analysis
  profile: SubjectProfile
  meta: ReportMeta
}) {
  const bands = scoreBandCounts(question)
  return (
    <section className="border-t border-slate-200 pt-6">
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-slate-900">{question.id} 學生作答內容及得分分析</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {meta.school} {meta.examName}｜{meta.classLevel} {profile.subject} {profile.paperName}
          <br />
          資料來源：{meta.source}。樣本包括 {analysis.sampleSize} 份匿名分數資料。
          <br />
          私隱處理：本報告只顯示匿名統計及分數分佈，不列個別學生或檔案得分。
        </p>
      </div>

      <h4 className="mt-6 text-lg font-semibold">一、得分概覽</h4>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <table className="border-collapse text-sm">
          <tbody>
            {[
              ['樣本數', `${analysis.sampleSize} 份`],
              ['滿分', `${question.max} 分`],
              ['平均分', `${format1(question.average)} / ${question.max}`],
              ['得分率', `${format1(question.rate)}%`],
              ['中位數', format1(questionMedian(question))],
              ['分數範圍', scoreRange(question)],
              ['標準差', format1(question.std)],
              ['滿分人數', `${bands.full} 人`],
              ['80%或以上', `${bands.full + bands.high} 人`],
              ['低於半分', `${bands.low} 人`],
            ].map(([label, value]) => (
              <tr key={label} className="even:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2 font-semibold">{label}</td>
                <td className="border border-slate-300 px-3 py-2 tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="h-fit border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left">分數組別</th>
              <th className="border border-slate-300 px-3 py-2 text-left">人數</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['滿分', bands.full],
              ['80%或以上但未滿分', bands.high],
              ['50%至79%', bands.mid],
              ['低於50%', bands.low],
            ].map(([label, value]) => (
              <tr key={label} className="even:bg-slate-50">
                <td className="border border-slate-300 px-3 py-2">{label}</td>
                <td className="border border-slate-300 px-3 py-2 tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <h4 className="text-lg font-semibold">得分分布</h4>
        <Histogram question={question} compact />
      </div>

      <ReportBullets title="二、題目要求" items={questionRequirementBullets(question, profile)} />
      <ReportBullets title="三、參考答案重點" items={referencePointBullets(question, profile)} />
      <ReportBullets title="四、學生作答表現分析" items={performanceBullets(question, profile)} />
      <ReportBullets title="五、常見失分位" items={lossPointBullets(question, profile)} />
      <ReportBullets title="六、跟進建議" items={followUpBullets(question, profile)} />
    </section>
  )
}

function ReportBullets({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-5">
      <h4 className="text-lg font-semibold">{title}</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function GradeAnalysisTabs<T extends string>({
  tabs,
  active,
  onChange,
  icons,
}: {
  tabs: { id: T; label: string }[]
  active: T
  onChange: (id: T) => void
  icons: Partial<Record<T, LucideIcon>>
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.07]">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const Icon = icons[tab.id] as LucideIcon | undefined
          const selected = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cx(
                'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                selected
                  ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:bg-slate-700 dark:text-slate-100 dark:ring-white/10'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {Icon && <Icon size={15} />}
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ActuarialView({
  analysis,
  scenario,
  scenarioLift,
}: {
  analysis: Analysis
  scenario: Analysis
  scenarioLift: number
}) {
  const riskTone = toneForRiskIndex(analysis.riskIndex)
  const riskCopy =
    analysis.riskIndex >= 58
      ? '班內尾部風險偏高，建議先做小組補底。'
      : analysis.riskIndex >= 34
        ? '有可控風險，重點在邊緣學生和弱題補救。'
        : '整體穩定，可把資源放在拔尖和保持表現。'
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon={ShieldCheck} description="以分數波動、尾部百分位和邊緣學生計算">
            班級風險評級
          </SectionTitle>
          <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-800/60">
              <Badge tone={riskTone} className="mb-3">
                精算風險
              </Badge>
              <p className="text-5xl font-bold tabular-nums text-slate-950 dark:text-white">
                {analysis.riskIndex}
              </p>
              <p className="text-sm text-slate-400">/100</p>
              <ProgressBar
                value={analysis.riskIndex}
                tone={riskTone === 'green' ? 'green' : riskTone === 'rose' ? 'rose' : riskTone === 'amber' ? 'amber' : 'accent'}
                className="mt-4"
              />
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
                {riskCopy}
              </p>
            </div>
            <div className="space-y-3">
              <PercentileBand analysis={analysis} />
              <div className="grid grid-cols-2 gap-3">
                <MiniMetric label="95% 班均區間" value={`${format1(analysis.ciLow)}-${format1(analysis.ciHigh)}%`} />
                <MiniMetric label="P10 尾部風險" value={`${format1(analysis.p10)}%`} />
                <MiniMetric label="標準差" value={`${format1(analysis.classStd)}%`} />
                <MiniMetric label="模型信心" value={`${analysis.confidenceScore}/100`} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon={Activity} description="用概率期望值計算，不只看單一預測等級">
            預期等級人數
          </SectionTitle>
          <ExpectedGradeBars distribution={analysis.expectedGradeDistribution} total={analysis.sampleSize} />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="p-4 sm:p-5">
          <SectionTitle icon={LineChart} description="用於決定課後支援與分層教學資源">
            風險分層
          </SectionTitle>
          <RiskBucketBars buckets={analysis.riskBuckets} total={analysis.sampleSize} />
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle icon={SlidersHorizontal} description={`假設弱項提升 ${scenarioLift}% 後的風險變化`}>
            情境壓力測試
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <MiniMetric label="平均分改善" value={`+${format1(Math.max(0, scenario.classPercent - analysis.classPercent))}%`} />
            <MiniMetric label="風險指數" value={`${analysis.riskIndex} → ${scenario.riskIndex}`} />
            <MiniMetric label="優先跟進" value={`${analysis.atRiskCount} → ${scenario.atRiskCount} 人`} />
            <MiniMetric label="預測 5+" value={`${format1(analysis.excellenceRate)} → ${format1(scenario.excellenceRate)}%`} />
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <SectionTitle icon={Target} description="估算每題提升 10% 時對全班平均與高危人數的影響">
          補救 ROI 排名
        </SectionTitle>
        <LeverageList items={analysis.questionLeverage.slice(0, 5)} />
      </Card>
    </div>
  )
}

function GradeBars({
  distribution,
  total,
}: {
  distribution: Record<string, number>
  total: number
}) {
  const max = Math.max(1, ...Object.values(distribution))
  return (
    <div className="space-y-2">
      {GRADE_ORDER.map((grade) => {
        const count = distribution[grade] ?? 0
        const width = (count / max) * 100
        return (
          <div key={grade} className="grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {grade}
            </span>
            <div className="h-8 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'h-full rounded-full transition-all duration-500',
                  grade === 'U' || grade === '1'
                    ? 'bg-rose-500'
                    : grade === '2' || grade === '3'
                      ? 'bg-amber-500'
                      : 'bg-accent',
                )}
                style={{ width: `${Math.max(width, count > 0 ? 5 : 0)}%` }}
                title={`${grade}: ${count} 人`}
              />
            </div>
            <span className="text-right text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {count} 人
            </span>
          </div>
        )
      })}
      <p className="pt-2 text-xs text-slate-400 dark:text-slate-500">
        樣本 {total} 人；預測只作教學分流參考，正式等級需配合校本分數線。
      </p>
    </div>
  )
}

function ExpectedGradeBars({
  distribution,
  total,
}: {
  distribution: { grade: string; expected: number }[]
  total: number
}) {
  const max = Math.max(1, ...distribution.map((item) => item.expected))
  return (
    <div className="space-y-2">
      {distribution.map((item) => {
        const width = (item.expected / max) * 100
        return (
          <div key={item.grade} className="grid grid-cols-[44px_minmax(0,1fr)_70px] items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {item.grade}
            </span>
            <div className="h-8 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  'h-full rounded-full transition-all duration-500',
                  item.grade === 'U' || item.grade === '1'
                    ? 'bg-rose-500'
                    : item.grade === '2' || item.grade === '3'
                      ? 'bg-amber-500'
                      : 'bg-accent',
                )}
                style={{ width: `${Math.max(width, item.expected > 0.05 ? 5 : 0)}%` }}
                title={`${item.grade}: 預期 ${format1(item.expected)} 人`}
              />
            </div>
            <span className="text-right text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {format1(item.expected)} 人
            </span>
          </div>
        )
      })}
      <p className="pt-2 text-xs text-slate-400 dark:text-slate-500">
        概率期望值總樣本 {total} 人；適合做分層資源配置，不代表正式評級。
      </p>
    </div>
  )
}

function PercentileBand({ analysis }: { analysis: Analysis }) {
  const markers = [
    { label: 'P10', value: analysis.p10, tone: 'bg-rose-500' },
    { label: 'P25', value: analysis.p25, tone: 'bg-amber-500' },
    { label: 'P50', value: analysis.medianPercent, tone: 'bg-accent' },
    { label: 'P75', value: analysis.p75, tone: 'bg-blue-500' },
    { label: 'P90', value: analysis.p90, tone: 'bg-emerald-500' },
  ]
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">百分位區間</p>
          <p className="text-xs text-slate-400">由尾部風險到高分潛力</p>
        </div>
        <Badge tone="slate">IQR {format1(analysis.p75 - analysis.p25)}%</Badge>
      </div>
      <div className="relative mt-6 h-10">
        <div className="absolute left-0 right-0 top-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800" />
        <div
          className="absolute top-4 h-2 rounded-full bg-accent/30"
          style={{
            left: `${clamp(analysis.p25, 0, 100)}%`,
            width: `${clamp(analysis.p75 - analysis.p25, 0, 100)}%`,
          }}
        />
        {markers.map((marker) => (
          <div
            key={marker.label}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${clamp(marker.value, 0, 100)}%` }}
          >
            <span className={cx('block h-10 w-1 rounded-full', marker.tone)} />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[11px] text-slate-400">
        {markers.map((marker) => (
          <span key={marker.label} className="tabular-nums">
            {marker.label} {format0(marker.value)}
          </span>
        ))}
      </div>
    </div>
  )
}

function RiskBucketBars({ buckets, total }: { buckets: RiskBucket[]; total: number }) {
  const toneClass: Record<RiskBucket['tone'], string> = {
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    green: 'bg-emerald-500',
    blue: 'bg-blue-500',
  }
  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const rate = percent(bucket.count, total)
        return (
          <div key={bucket.label} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{bucket.label}</p>
                <p className="text-xs text-slate-400">{bucket.hint}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {bucket.count} 人 · {format1(rate)}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cx('h-full rounded-full transition-all duration-500', toneClass[bucket.tone])}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeverageList({ items }: { items: QuestionLeverage[] }) {
  const maxEfficiency = Math.max(1, ...items.map((item) => item.efficiency))
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {items.map((item, index) => (
        <div
          key={item.question.id}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge tone={index === 0 ? 'accent' : index < 3 ? 'amber' : 'slate'}>
              #{index + 1}
            </Badge>
            <span className="text-xs font-semibold tabular-nums text-slate-400">
              ROI {format0((item.efficiency / maxEfficiency) * 100)}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.question.id} · {item.question.topic}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {item.question.skill}
          </p>
          <ProgressBar
            value={(item.efficiency / maxEfficiency) * 100}
            tone={index === 0 ? 'accent' : index < 3 ? 'amber' : 'green'}
            className="mt-3"
          />
          <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p>平均 +{format1(Math.max(0, item.expectedGain))}%</p>
            <p>受影響 {item.affectedStudents} 人</p>
            <p>離開風險 {Math.max(0, item.riskReduction)} 人</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function QuestionMap({
  questions,
  activeId,
  onSelect,
}: {
  questions: QuestionStat[]
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {questions.map((question) => (
        <button
          key={question.id}
          type="button"
          onClick={() => onSelect(question.id)}
          className={cx(
            'cursor-pointer rounded-2xl border p-3 text-left transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            activeId === question.id
              ? 'border-accent/35 bg-accent-soft dark:bg-accent/15'
              : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {question.id}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {question.topic}
              </p>
            </div>
            <Badge tone={toneForRate(question.rate)}>{format1(question.rate)}%</Badge>
          </div>
          <ProgressBar value={question.rate} tone={toneForRate(question.rate)} className="mt-3" />
          <p className="mt-2 text-xs text-slate-400">
            平均 {format1(question.average)} / {question.max} · 低分 {question.lowCount} 人
          </p>
        </button>
      ))}
    </div>
  )
}

function Histogram({
  question,
  compact,
}: {
  question: QuestionStat
  compact?: boolean
}) {
  const scores = Array.from({ length: question.max + 1 }, (_, score) => score)
  const maxCount = Math.max(1, ...Object.values(question.distribution))
  return (
    <div role="img" aria-label={`${question.id} 分數分佈`}>
      <div className={cx('flex items-end gap-1.5', compact ? 'h-40' : 'h-52')}>
        {scores.map((score) => {
          const count = question.distribution[score] ?? 0
          const height = (count / maxCount) * 100
          return (
            <div key={score} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100">
                {count || ''}
              </span>
              <div
                className={cx(
                  'w-full rounded-t-md transition-all duration-500',
                  score / question.max < 0.5 ? 'bg-rose-400' : score / question.max < 0.75 ? 'bg-amber-400' : 'bg-accent',
                )}
                style={{ height: `${Math.max(height, count > 0 ? 4 : 1)}%` }}
                title={`${score} 分：${count} 人`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {scores.map((score) => (
          <span key={score} className="min-w-0 flex-1 text-center text-[10px] tabular-nums text-slate-400">
            {score % Math.ceil(question.max / 5) === 0 || score === question.max ? score : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniMetric label="平均" value={`${format1(question.average)}/${question.max}`} />
        <MiniMetric label="滿分" value={`${question.fullCount} 人`} />
        <MiniMetric label="標準差" value={format1(question.std)} />
      </div>
    </div>
  )
}

function QuestionRow({
  question,
  active,
  onSelect,
}: {
  question: QuestionStat
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        'w-full cursor-pointer rounded-2xl border p-4 text-left transition hover:border-accent/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent/35 bg-accent-soft dark:bg-accent/15'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {question.id} · {question.title}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {question.topic} · {question.skill}
          </p>
        </div>
        <Badge tone={toneForRate(question.rate)}>{format1(question.rate)}%</Badge>
      </div>
      <ProgressBar value={question.rate} tone={toneForRate(question.rate)} className="mt-3" />
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>平均 {format1(question.average)} / {question.max}</span>
        <span>低於半分 {question.lowCount} 人</span>
        <span>滿分 {question.fullCount} 人</span>
      </div>
    </button>
  )
}

function InsightList({ weakest }: { weakest: QuestionStat[] }) {
  return (
    <div className="space-y-3">
      {weakest.map((question, index) => (
        <div
          key={question.id}
          className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge tone={index === 0 ? 'rose' : 'amber'}>{question.id}</Badge>
            <span className="text-xs font-semibold tabular-nums text-slate-400">
              {format1(question.rate)}%
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {question.topic}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {question.advice}
          </p>
        </div>
      ))}
    </div>
  )
}

function StudentTable({
  students,
  totalMax,
}: {
  students: StudentInsight[]
  totalMax: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-700">
            <th className="py-2 pr-3 font-semibold">學生</th>
            <th className="py-2 pr-3 font-semibold">預測</th>
            <th className="py-2 pr-3 font-semibold">分數</th>
            <th className="py-2 pr-3 font-semibold">及格概率</th>
            <th className="py-2 pr-3 font-semibold">下行情境</th>
            <th className="py-2 pr-3 font-semibold">最弱題</th>
            <th className="py-2 pr-3 font-semibold">建議行動</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <td className="py-3 pr-3 font-semibold text-slate-800 dark:text-slate-100">
                {student.id}
              </td>
              <td className="py-3 pr-3">
                <Badge tone={riskTone(student.risk)}>{riskLabel(student.risk)}</Badge>
              </td>
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-12 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {student.grade}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {format1(student.total)} / {totalMax}
                  </span>
                  <span className="text-slate-400">({format1(student.percent)}%)</span>
                </div>
              </td>
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                    {format0(student.passProbability)}%
                  </span>
                  <ProgressBar
                    value={student.passProbability}
                    tone={probabilityTone(student.passProbability)}
                    size="sm"
                    className="w-24"
                  />
                </div>
              </td>
              <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">P10 {format1(student.downsidePercent)}%</span>
                <span className="ml-2 text-xs text-slate-400">風險 {format0(student.riskScore)}</span>
              </td>
              <td className="py-3 pr-3 text-slate-500 dark:text-slate-400">
                {student.weakest.id} · {student.weakest.topic}
              </td>
              <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">
                {student.nextStep}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  )
}

function ActionCard({
  tone,
  title,
  meta,
  body,
}: {
  tone: 'rose' | 'amber' | 'green'
  title: string
  meta: string
  body: string
}) {
  const toneClass =
    tone === 'rose'
      ? 'border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
        : 'border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
  return (
    <div className={cx('rounded-2xl border p-3', toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{title}</p>
        <span className="text-xs font-semibold">{meta}</span>
      </div>
      <p className="mt-1 text-sm leading-6 opacity-85">{body}</p>
    </div>
  )
}
