import { useMemo, useState, type ReactNode } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  classesCol,
  studentsCol,
  assessmentsCol,
  scoresCol,
  topicsCol,
} from '../../data/collections'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Pills,
  SegmentedControl,
  Select,
  StatCard,
  Tabs,
  Tooltip,
  cx,
} from '../../ui'
import {
  ArrowDownAZ,
  ArrowUpDown,
  BarChart3,
  BookMarked,
  Calculator,
  Check,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  RotateCcw,
  School,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { GradeDonut, Histogram, BoxPlot, TrendLine } from './gradebook/Charts'
import StudentReport from './gradebook/StudentReport'
import {
  DEFAULT_WEIGHTS,
  SCALE_LABEL,
  TONE_FILL,
  TONE_TEXT,
  assessmentSortKey,
  bandsOf,
  computeResults,
  defaultBandCuts,
  ensureScheme,
  gradeOf,
  gradingSchemesCol,
  histogram,
  mean,
  median,
  pctTone,
  percentileOf,
  quartiles,
  rankByImprovement,
  resolveBands,
  round1,
  shortDate,
  stdev,
  downloadCsv,
  type GradeScaleKey,
  type GradingScheme,
} from './gradebook/util'

type Tab = 'grid' | 'analysis' | 'students' | 'assessments' | 'scheme'

const TABS: { id: Tab; label: string }[] = [
  { id: 'grid', label: '成績表' },
  { id: 'analysis', label: '分析' },
  { id: 'students', label: '學生' },
  { id: 'assessments', label: '評估' },
  { id: 'scheme', label: '評分方案' },
]

const TAB_ICONS: Partial<Record<Tab, typeof BarChart3>> = {
  grid: ListChecks,
  analysis: BarChart3,
  students: Users,
  assessments: FolderOpen,
  scheme: SlidersHorizontal,
}

// ───────── 成績冊 masthead：改卷簿封面（kicker + serif 標題 + 卷務行 + 戳印）─────────
//  訂造概念 = 教師成績冊 / 分數矩陣：封面似一本帳簿，右上一個淡淡「成績冊」鋼印。
function GradebookHeader({ subtitle }: { subtitle?: ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none sm:px-7 sm:py-6">
      {/* 封面右上鋼印（純裝飾，唔搶主次）*/}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 top-3 hidden -rotate-6 select-none rounded-xl border-2 border-dashed border-accent/20 px-4 py-2 font-serif text-xs font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:block"
      >
        成績冊 · Ledger
      </span>
      <div className="flex items-start gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <GraduationCap size={24} />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <BookMarked size={13} />
            分數矩陣 · Gradebook
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
            成績管理
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {subtitle ?? '加權計分、等級分佈、課題弱項同個人成績單——對齊學校評核標準。'}
          </p>
        </div>
      </div>
      {/* 帳簿雙線（封面分隔感）*/}
      <div className="mt-5 space-y-1" aria-hidden>
        <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
        <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
      </div>
    </header>
  )
}

// ───────── 帳簿清點格（hairline grid · serif 大數字；達標 hot 高亮）─────────
//  成績冊概念：似改卷簿封底嘅清點欄，一格一個關鍵數，serif 數字、ledger 質感。
function LedgerStat({
  label,
  value,
  unit,
  icon: Icon,
  hot,
}: {
  label: string
  value: number | string
  unit?: string
  icon: LucideIcon
  hot?: boolean
}) {
  return (
    <div
      className={cx(
        'px-4 py-3.5 transition-colors',
        hot ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white dark:bg-slate-800',
      )}
    >
      <p
        className={cx(
          'flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide',
          hot
            ? 'text-emerald-600/80 dark:text-emerald-400/80'
            : 'text-slate-400 dark:text-slate-500',
        )}
      >
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cx(
          'mt-1 font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero',
          hot
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-sm font-normal text-slate-400">
            {unit}
          </span>
        )}
      </p>
    </div>
  )
}

export default function Gradebook() {
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [tab, setTab] = useState<Tab>('grid')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  if (classes.length === 0) {
    return (
      <div className="space-y-5">
        <GradebookHeader />
        <EmptyState
          icon={School}
          art="empty-gradebook"
          title="由第一班開始"
          hint="先去「班別管理」開好班別，呢度就可以記錄成績、睇分析同打印成績單。"
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <GradebookHeader
        subtitle={
          <>
            加權計分、等級分佈、課題弱項同個人成績單。
            {classes.length > 1 && (
              <span className="ml-1 tabular-nums text-slate-400 dark:text-slate-500">
                · 本冊收錄 {classes.length} 班
              </span>
            )}
          </>
        }
      />

      {/* 帳簿索引：班別書籤 + 分頁標籤（似帳簿側邊書脊）*/}
      <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        <div className="flex items-center gap-2 px-0.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <BookMarked size={13} className="shrink-0" />
            班別
          </span>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700/60" />
          <div className="min-w-0 flex-1">
            <Pills
              options={classes.map((c) => ({ id: c.id, label: c.name }))}
              active={activeClass?.id ?? ''}
              onChange={setClassId}
            />
          </div>
        </div>
        <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICONS} />
      </div>

      {activeClass && tab === 'grid' && (
        <ScoreGrid classId={activeClass.id} className={activeClass.name} />
      )}
      {activeClass && tab === 'analysis' && (
        <AnalysisTab classId={activeClass.id} className={activeClass.name} />
      )}
      {activeClass && tab === 'students' && (
        <StudentsTab classId={activeClass.id} />
      )}
      {activeClass && tab === 'assessments' && (
        <AssessmentsTab classId={activeClass.id} />
      )}
      {activeClass && tab === 'scheme' && <SchemeTab classId={activeClass.id} />}
    </div>
  )
}

// ───── 共用：取某班嘅 scheme + 已排序評估 ─────
function useClassData(classId: string) {
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const assessmentsRaw = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const scores = useCollection(scoresCol)
  const schemes = useCollection(gradingSchemesCol)
  const scheme = ensureScheme(classId, schemes)
  const assessments = useMemo(
    () =>
      [...assessmentsRaw].sort((a, b) =>
        assessmentSortKey(a).localeCompare(assessmentSortKey(b)),
      ),
    [assessmentsRaw],
  )
  // 套用自訂等級分界（無設定 → 內建）。所有等級顯示經此 bands。
  const bands = useMemo(
    () => resolveBands(scheme.scale, scheme.bandCuts?.[scheme.scale]),
    [scheme.scale, scheme.bandCuts],
  )
  return { students, assessments, scores, scheme, bands }
}

// ============================================================
//  成績表（學生 × 評估）—— 加權、排序、熱力底色、列印
// ============================================================
type SortMode = 'name' | 'total-desc' | 'total-asc'

function ScoreGrid({ classId, className }: { classId: string; className: string }) {
  const toast = useToast()
  const { students, assessments, scores, scheme, bands } = useClassData(classId)
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [heatmap, setHeatmap] = useState(true)
  const [reportFor, setReportFor] = useState<string | null>(null)

  const setScore = (aId: string, sId: string, raw: string, max: number) => {
    const val = raw === '' ? null : Math.max(0, Math.min(max, Number(raw)))
    const rec = scores.find(
      (x) => x.assessmentId === aId && x.studentId === sId,
    )
    if (rec) scoresCol.update(rec.id, { score: val })
    else scoresCol.add({ assessmentId: aId, studentId: sId, score: val })
  }

  const results = useMemo(
    () => computeResults(students, assessments, scores, scheme),
    [students, assessments, scores, scheme],
  )
  const resultById = useMemo(
    () => new Map(results.map((r) => [r.student.id, r])),
    [results],
  )

  // 以 `${評估}|${學生}` 為鍵索引原始分數，令格仔取分由全表 find()（O(分數)）降到 O(1)。
  // 保留 find() 的「首個命中為準」語意：若有重複記錄，只記第一個（後來者唔覆蓋）。
  const scoreByKey = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const x of scores) {
      const key = `${x.assessmentId}|${x.studentId}`
      if (!m.has(key)) m.set(key, x.score)
    }
    return m
  }, [scores])

  // 名次（按加權總分）
  const ranked = useMemo(
    () =>
      [...results]
        .filter((r) => r.weighted != null)
        .sort((a, b) => (b.weighted ?? 0) - (a.weighted ?? 0)),
    [results],
  )
  const rankById = useMemo(() => {
    const m = new Map<string, number>()
    ranked.forEach((r, i) => m.set(r.student.id, i + 1))
    return m
  }, [ranked])

  const orderedResults = useMemo(() => {
    const arr = [...results]
    if (sortMode === 'name') {
      arr.sort((a, b) =>
        (a.student.studentNo ?? a.student.name).localeCompare(
          b.student.studentNo ?? b.student.name,
          'zh-Hant',
        ),
      )
    } else {
      arr.sort((a, b) => {
        const av = a.weighted ?? -1
        const bv = b.weighted ?? -1
        return sortMode === 'total-desc' ? bv - av : av - bv
      })
    }
    return arr
  }, [results, sortMode])

  // 每評估全班平均（讀已 memo 嘅 results.perAssessment，免逐格重掃 scores）
  const assessmentAvg = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const a of assessments) {
      const pts = results
        .map((r) => r.perAssessment[a.id])
        .filter((x): x is number => x != null)
      m.set(a.id, mean(pts))
    }
    return m
  }, [assessments, results])

  // 全班加權總分（有分嘅），同時供班平均同百分位用
  const classTotals = useMemo(
    () =>
      results.map((r) => r.weighted).filter((x): x is number => x != null),
    [results],
  )
  const classAvg = useMemo(() => mean(classTotals), [classTotals])

  const exportCsv = () => {
    const header = [
      '學號',
      '學生',
      ...assessments.map((a) => `${a.name}（/${a.maxScore}）`),
      '加權總分(%)',
      '等級',
      '名次',
    ]
    const rows = orderedResults.map((r) => {
      const cells: (string | number)[] = [
        r.student.studentNo ?? '',
        r.student.name,
      ]
      assessments.forEach((a) => {
        const rec = scores.find(
          (x) => x.assessmentId === a.id && x.studentId === r.student.id,
        )
        cells.push(rec?.score == null ? '' : rec.score)
      })
      cells.push(r.weighted == null ? '' : r.weighted)
      cells.push(r.weighted == null ? '' : gradeOf(r.weighted, scheme.scale, bands).label)
      cells.push(rankById.get(r.student.id) ?? '')
      return cells
    })
    downloadCsv(`${className}_成績.csv`, [header, ...rows])
    toast.success(`已匯出 ${className} 成績 CSV`)
  }

  if (students.length === 0 || assessments.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        art="empty-gradebook"
        title="準備好就可以入分"
        hint="先去「學生」同「評估」分頁加入名單同測考，呢張成績表就會即刻郁起嚟。"
      />
    )
  }

  const reportResult = reportFor ? resultById.get(reportFor) ?? null : null
  const gradedAssessments = assessments.filter((a) =>
    results.some((r) => r.perAssessment[a.id] != null),
  ).length

  const classBand =
    classAvg != null ? gradeOf(classAvg, scheme.scale, bands) : null

  return (
    <div className="space-y-4">
      {/* 帳簿總結帶：班級平均做主角（serif 大數字 + 等第章），右接清點格 */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200/70 ring-1 ring-slate-200/80 dark:bg-slate-700/50 dark:ring-slate-700/60 sm:grid-cols-4">
        {/* 主格：班級（加權）平均 — 跨兩欄、accent 底、serif 巨數 */}
        <div className="col-span-2 flex items-center justify-between gap-3 bg-accent-soft/70 px-4 py-3.5 dark:bg-accent/10 sm:px-5">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent-strong/80 dark:text-accent/80">
              <Target size={12} className="shrink-0" />
              {scheme.weighted ? '班級加權平均' : '班級平均'}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-[34px] font-semibold leading-none tabular-nums slashed-zero text-accent-strong dark:text-accent">
                {classAvg == null ? '—' : `${Math.round(classAvg)}`}
                {classAvg != null && (
                  <span className="ml-0.5 font-sans text-lg font-normal text-accent-strong/60 dark:text-accent/60">
                    %
                  </span>
                )}
              </span>
              {classBand && <Badge tone={classBand.tone}>{classBand.label}</Badge>}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-accent-strong dark:bg-white/10 dark:text-accent">
            <BookMarked size={22} strokeWidth={1.8} />
          </span>
        </div>
        <LedgerStat label="學生在冊" value={students.length} unit="人" icon={Users} />
        <LedgerStat
          label="已入分評估"
          value={gradedAssessments}
          unit={`/${assessments.length}`}
          icon={ClipboardList}
          hot={gradedAssessments > 0 && gradedAssessments === assessments.length}
        />
      </section>

      {/* 卷務工具列 — 排序為主、底色開關 + 匯出成組 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SegmentedControl<SortMode>
            size="sm"
            value={sortMode}
            onChange={setSortMode}
            options={[
              { id: 'name', label: '學號', icon: ArrowDownAZ },
              { id: 'total-desc', label: '高→低', icon: ArrowUpDown },
            ]}
          />
          {scheme.weighted && (
            <Badge tone="accent" icon={Calculator}>
              加權計分
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip label={heatmap ? '關閉等第底色' : '開啟等第底色'}>
            <IconButton
              label="切換等第底色"
              active={heatmap}
              onClick={() => setHeatmap((v) => !v)}
            >
              <SlidersHorizontal size={16} strokeWidth={1.8} />
            </IconButton>
          </Tooltip>
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>
            匯出 CSV
          </Button>
        </div>
      </div>

      {/* ───────── 成績矩陣（改卷簿）：ruled 帳格 · serif 題號 · ledger spine ───────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
        <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/60">
          <NotebookPen size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            成績矩陣 · Score Matrix
          </span>
          <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {students.length} 行 × {assessments.length} 項
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200/80 bg-slate-50/95 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95 dark:text-slate-400">
                  學生
                </th>
                {assessments.map((a, i) => (
                  <th
                    key={a.id}
                    className="whitespace-nowrap border-b border-slate-200/80 px-3 py-2 align-bottom dark:border-slate-700/60"
                  >
                    <span className="block font-serif text-[11px] font-semibold tabular-nums slashed-zero text-slate-300 dark:text-slate-600">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="block font-semibold text-slate-600 dark:text-slate-300">
                      {a.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                      {a.type} · /{a.maxScore}
                      {scheme.weighted && scheme.weights[a.type] != null && (
                        <span className="text-accent"> · {scheme.weights[a.type]}%</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="border-b border-l border-slate-200/80 px-3 py-2.5 text-center text-xs font-semibold text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
                  {scheme.weighted ? '加權總分' : '平均'}
                </th>
                <th className="border-b border-slate-200/80 px-2 py-2.5 text-center text-xs font-semibold text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
                  名次
                </th>
                <th className="border-b border-slate-200/80 px-2 py-2.5 dark:border-slate-700/60" />
              </tr>
            </thead>
            <tbody>
              {orderedResults.map((r, rowIdx) => {
                const s = r.student
                const total = r.weighted
                const band = total != null ? gradeOf(total, scheme.scale, bands) : null
                const rank = rankById.get(s.id)
                return (
                  <tr
                    key={s.id}
                    className="group border-t border-slate-100 transition-colors hover:bg-accent-soft/20 dark:border-slate-800 dark:hover:bg-slate-800/40"
                  >
                    {/* ledger spine（帳簿書脊）：serif 行號 + 姓名，右邊分隔線 */}
                    <td className="sticky left-0 z-10 border-r border-slate-200/80 bg-white px-3 py-2 transition-colors group-hover:bg-accent-soft/30 dark:border-slate-700/60 dark:bg-slate-800 dark:group-hover:bg-slate-800/95">
                      <div className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-right font-serif text-[11px] tabular-nums text-slate-300 dark:text-slate-600">
                          {rowIdx + 1}
                        </span>
                        <span className="min-w-0">
                          {s.studentNo && (
                            <span className="mr-1.5 text-xs tabular-nums text-slate-400">
                              {s.studentNo}
                            </span>
                          )}
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {s.name}
                          </span>
                        </span>
                      </div>
                    </td>
                    {assessments.map((a) => {
                      const sc = scoreByKey.get(`${a.id}|${s.id}`)
                      const p = r.perAssessment[a.id]
                      const tone = p != null ? pctTone(p) : null
                      const cellBg =
                        heatmap && tone
                          ? HEAT_BG[tone]
                          : 'border-slate-200/90 bg-transparent text-slate-700 dark:border-slate-600 dark:text-slate-200'
                      const empty = sc == null
                      return (
                        <td key={a.id} className="px-2 py-1.5 text-center">
                          <input
                            type="number"
                            inputMode="numeric"
                            aria-label={`${s.name}・${a.name} 分數（滿分 ${a.maxScore}）`}
                            value={sc ?? ''}
                            onChange={(e) =>
                              setScore(a.id, s.id, e.target.value, a.maxScore)
                            }
                            className={cx(
                              'w-14 rounded-lg border px-1.5 py-1 text-center font-serif text-[15px] font-semibold tabular-nums slashed-zero outline-none transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/25 dark:focus:bg-slate-800',
                              empty && !heatmap && 'border-dashed',
                              cellBg,
                            )}
                          />
                        </td>
                      )
                    })}
                    {/* 結算欄：加權總分 + 等第章 */}
                    <td className="border-l border-slate-100 px-3 py-2 text-center dark:border-slate-800">
                      {total == null ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className={cx(
                              'font-serif text-[15px] font-semibold tabular-nums slashed-zero',
                              band ? TONE_TEXT[band.tone] : '',
                            )}
                          >
                            {total}%
                          </span>
                          {band && <Badge tone={band.tone}>{band.label}</Badge>}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {rank == null ? (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      ) : rank <= 3 ? (
                        <span
                          className={cx(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full font-serif text-xs font-bold tabular-nums',
                            rank === 1
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                              : rank === 2
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                          )}
                        >
                          {rank}
                        </span>
                      ) : (
                        <span className="font-serif text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                          {rank}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <IconButton
                        label="查看成績單"
                        onClick={() => setReportFor(s.id)}
                      >
                        <FileText size={15} strokeWidth={1.8} />
                      </IconButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-800/60">
                <td className="sticky left-0 z-10 border-r border-slate-200/80 bg-slate-50/95 px-3 py-2.5 backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    <Calculator size={12} className="shrink-0" />
                    結算 · 全班平均
                  </span>
                </td>
                {assessments.map((a) => {
                  const av = assessmentAvg.get(a.id) ?? null
                  return (
                    <td
                      key={a.id}
                      className={cx(
                        'px-3 py-2 text-center font-serif text-[13px] font-semibold tabular-nums slashed-zero',
                        av == null
                          ? 'text-slate-300 dark:text-slate-600'
                          : av < 50
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-300',
                      )}
                    >
                      {av == null ? '—' : `${Math.round(av)}%`}
                    </td>
                  )
                })}
                <td className="border-l border-slate-200/80 px-3 py-2 text-center font-serif text-[15px] font-bold tabular-nums slashed-zero text-accent dark:border-slate-700/60">
                  {classAvg == null ? '—' : `${Math.round(classAvg)}%`}
                </td>
                <td className="px-2 py-2" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 帳簿頁腳註：似改卷簿底部嘅說明小字 */}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-xs text-slate-400 dark:text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" />
          低於 50% 以紅色等第標示。
        </span>
        <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
        <span>
          {scheme.weighted
            ? '總分按「評分方案」嘅類別權重計算。'
            : '總分為各評估等權平均（可去「評分方案」開啟加權）。'}
        </span>
      </p>

      <StudentReport
        open={reportFor != null}
        onClose={() => setReportFor(null)}
        result={reportResult}
        rank={reportFor ? (rankById.get(reportFor) ?? null) : null}
        classSize={ranked.length}
        percentile={
          reportResult?.weighted != null
            ? percentileOf(reportResult.weighted, classTotals)
            : null
        }
        assessments={assessments}
        classAvg={classAvg}
        assessmentAvg={assessmentAvg}
        scheme={scheme}
        bands={bands}
        className={className}
      />
    </div>
  )
}

// 卡片標題：小色 chip + 標題 + 選填說明（統一分析卡頭部，營造層次）
const CHART_HEAD_CHIP: Record<'accent' | 'violet' | 'sky' | 'rose' | 'emerald' | 'amber', string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
}

function ChartHead({
  icon: Icon,
  tone,
  hint,
  children,
}: {
  icon: typeof BarChart3
  tone: keyof typeof CHART_HEAD_CHIP
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', CHART_HEAD_CHIP[tone])}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{children}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

const HEAT_BG: Record<'green' | 'accent' | 'blue' | 'amber' | 'rose' | 'slate', string> = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  accent: 'border-accent/30 bg-accent-soft/60 text-accent-strong dark:border-accent/40 dark:bg-accent/10 dark:text-accent',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  rose: 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
  slate: 'border-slate-200 dark:border-slate-600 dark:bg-slate-700',
}

// ============================================================
//  分析分頁 —— 統計卡 + 多圖表 + 弱項 + 排名榜
// ============================================================
type AnalysisView = 'overview' | 'assessments' | 'topics' | 'ranking'

const ANALYSIS_VIEWS: { id: AnalysisView; label: string }[] = [
  { id: 'overview', label: '總覽' },
  { id: 'assessments', label: '逐項評估' },
  { id: 'topics', label: '課題弱項' },
  { id: 'ranking', label: '排名榜' },
]

function AnalysisTab({ classId, className }: { classId: string; className: string }) {
  const { students, assessments, scores, scheme, bands } = useClassData(classId)
  const topics = useCollection(topicsCol)
  const [view, setView] = useState<AnalysisView>('overview')

  const results = useMemo(
    () => computeResults(students, assessments, scores, scheme),
    [students, assessments, scores, scheme],
  )

  const stats = useMemo(() => {
    const totals = results
      .map((r) => r.weighted)
      .filter((x): x is number => x != null)
    const classAvg = mean(totals)
    const med = median(totals)
    const sd = stdev(totals)
    const passMark = scheme.scale === 'hkdse' ? 30 : 50
    const passRate = totals.length
      ? Math.round(
          (totals.filter((x) => x >= passMark).length / totals.length) * 100,
        )
      : null

    const ranked = results
      .filter((r) => r.weighted != null)
      .sort((a, b) => (b.weighted ?? 0) - (a.weighted ?? 0))
    const top = ranked[0] ?? null
    const bottom = ranked.length ? ranked[ranked.length - 1] : null

    // 完成度
    const expectedTotal = students.length * assessments.length
    const submittedTotal = results.reduce((a, r) => a + r.submitted, 0)
    const completion = expectedTotal
      ? Math.round((submittedTotal / expectedTotal) * 100)
      : 0

    // 等級分佈（按 scheme.scale + 自訂分界）
    const gradeCounts = bands.map((band) => ({
      band,
      n: totals.filter((t) => gradeOf(t, scheme.scale, bands).label === band.label)
        .length,
    }))

    // 直方圖
    const hist = histogram(totals)

    // 箱形
    const q = quartiles(totals)
    const box = q
      ? {
          min: q[0],
          q1: q[1],
          med: q[2],
          q3: q[3],
          max: q[4],
          mean: classAvg ?? q[2],
        }
      : null

    // 需關注學生（總分 < passMark）
    const weak = ranked.filter((r) => (r.weighted ?? 100) < passMark)

    return {
      classAvg,
      med,
      sd,
      passRate,
      passMark,
      top,
      bottom,
      completion,
      gradeCounts,
      hist,
      box,
      weak,
      gradedCount: assessments.filter((a) =>
        results.some((r) => r.perAssessment[a.id] != null),
      ).length,
    }
  }, [results, students, assessments, scheme, bands])

  // 逐項評估統計（讀已 memo 嘅 results.perAssessment，免逐格重掃 scores）
  const perAssessment = useMemo(() => {
    return assessments.map((a) => {
      const pts = results
        .map((r) => r.perAssessment[a.id])
        .filter((x): x is number => x != null)
      return {
        a,
        avg: mean(pts),
        med: median(pts),
        sd: stdev(pts),
        n: pts.length,
        passRate: pts.length
          ? Math.round(
              (pts.filter((x) => x >= stats.passMark).length / pts.length) *
                100,
            )
          : null,
        box: (() => {
          const q = quartiles(pts)
          return q
            ? {
                min: q[0],
                q1: q[1],
                med: q[2],
                q3: q[3],
                max: q[4],
                mean: mean(pts) ?? q[2],
              }
            : null
        })(),
      }
    })
  }, [assessments, results, stats.passMark])

  // 課題弱項（讀已 memo 嘅 results.perAssessment，免逐格重掃 scores）
  const topicStats = useMemo(() => {
    const byTopic = new Map<string, number[]>()
    assessments.forEach((a) => {
      if (!a.topicId) return
      results.forEach((r) => {
        const p = r.perAssessment[a.id]
        if (p != null) {
          const arr = byTopic.get(a.topicId!) ?? []
          arr.push(p)
          byTopic.set(a.topicId!, arr)
        }
      })
    })
    return [...byTopic.entries()]
      .map(([tid, arr]) => ({
        id: tid,
        topic: topics.find((t) => t.id === tid)?.topic ?? '未分類',
        area: topics.find((t) => t.id === tid)?.area ?? '',
        avg: round1(mean(arr) ?? 0),
        n: arr.length,
      }))
      .sort((a, b) => a.avg - b.avg)
  }, [assessments, results, topics])

  // 趨勢
  const trendPoints = useMemo(
    () =>
      perAssessment
        .filter((x) => x.avg != null)
        .map((x) => ({
          label: x.a.name,
          value: x.avg!,
          sub: shortDate(x.a.date),
        })),
    [perAssessment],
  )

  const ranking = useMemo(
    () =>
      results
        .filter((r) => r.weighted != null)
        .sort((a, b) => (b.weighted ?? 0) - (a.weighted ?? 0)),
    [results],
  )

  // 進步榜：按時間次序逐評估 % 計線性趨勢，抽最進步 / 最退步
  const improvement = useMemo(() => {
    const orderedIds = [...assessments]
      .sort((a, b) =>
        assessmentSortKey(a).localeCompare(assessmentSortKey(b)),
      )
      .map((a) => a.id)
    return rankByImprovement(results, orderedIds)
  }, [results, assessments])

  const exportSummary = () => {
    const header = ['評估', '類型', '已交', '平均(%)', '中位數(%)', '標準差', '及格率(%)']
    const rows = perAssessment.map((x) => [
      x.a.name,
      x.a.type,
      x.n,
      x.avg == null ? '' : Math.round(x.avg),
      x.med == null ? '' : Math.round(x.med),
      x.sd == null ? '' : round1(x.sd),
      x.passRate == null ? '' : x.passRate,
    ])
    downloadCsv(`${className}_評估統計.csv`, [header, ...rows])
  }

  if (students.length === 0 || assessments.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="分析住緊等你"
        hint="加入學生同評估、入埋分數，呢度就會自動畫出分佈、等級佔比同課題強弱。"
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl<AnalysisView>
          size="sm"
          value={view}
          onChange={setView}
          options={ANALYSIS_VIEWS}
        />
        {view === 'assessments' && (
          <Button variant="secondary" size="sm" icon={Download} onClick={exportSummary}>
            匯出統計
          </Button>
        )}
      </div>

      {view === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="班級平均"
              value={stats.classAvg == null ? '—' : Math.round(stats.classAvg)}
              unit={stats.classAvg == null ? undefined : '%'}
              icon={Target}
              highlight
              hint={stats.med == null ? undefined : `中位數 ${Math.round(stats.med)}%`}
            />
            <StatCard
              label="及格率"
              value={stats.passRate == null ? '—' : stats.passRate}
              unit={stats.passRate == null ? undefined : '%'}
              icon={UserCheck}
              hint={`及格線 ${stats.passMark}%`}
            />
            <StatCard
              label="成績離散度"
              value={stats.sd == null ? '—' : round1(stats.sd)}
              icon={ArrowUpDown}
              hint="標準差（越細越平均）"
            />
            <StatCard
              label="填分完成度"
              value={stats.completion}
              unit="%"
              icon={ListChecks}
              hint={`${stats.gradedCount}/${assessments.length} 評估已入分`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-3xl p-5">
              <ChartHead icon={BarChart3} tone="accent">分數分佈（全班總分）</ChartHead>
              <Histogram bins={stats.hist} passMark={stats.passMark} />
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                每條代表落入該分數區間嘅學生人數；紅色為不及格區間。
              </p>
            </Card>

            <Card className="rounded-3xl p-5">
              <ChartHead icon={Trophy} tone="violet">
                等級佔比（{SCALE_LABEL[scheme.scale]}）
              </ChartHead>
              <GradeDonut counts={stats.gradeCounts} scale={scheme.scale} bands={bands} />
            </Card>

            <Card className="rounded-3xl p-5">
              <ChartHead icon={ArrowUpDown} tone="sky">全班成績離散（箱形圖）</ChartHead>
              <BoxPlot stats={stats.box} passMark={stats.passMark} />
            </Card>

            <Card className="rounded-3xl p-5">
              <ChartHead icon={UserCheck} tone="rose">
                需關注學生（總分低於 {stats.passMark}%）
              </ChartHead>
              {stats.weak.length === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl bg-emerald-50/60 px-3 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Check size={16} strokeWidth={2.5} />
                  暫時冇人跌穿及格線，全班企穩。
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {stats.weak.map((r) => (
                    <li
                      key={r.student.id}
                      className="flex items-center justify-between rounded-xl bg-rose-50/60 px-3 py-1.5 text-sm dark:bg-rose-950/20"
                    >
                      <span className="text-slate-700 dark:text-slate-200">
                        {r.student.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          已交 {r.submitted}/{r.expected}
                        </span>
                        <Badge tone="rose" className="tabular-nums">
                          {r.weighted}%
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="rounded-3xl p-5">
            <ChartHead
              icon={Sparkles}
              tone="emerald"
              hint="按評估日期排序，睇班級表現走勢。"
            >
              評估趨勢（全班平均）
            </ChartHead>
            <TrendLine points={trendPoints} passMark={stats.passMark} />
          </Card>
        </div>
      )}

      {view === 'assessments' && (
        <div className="space-y-3">
          {perAssessment.map((x) => {
            const band = x.avg != null ? gradeOf(x.avg, scheme.scale, bands) : null
            return (
              <Card key={x.a.id} className="rounded-3xl p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {x.a.name}
                    </span>
                    <Badge tone="slate">{x.a.type}</Badge>
                    {x.a.date && (
                      <span className="text-xs text-slate-400">
                        {shortDate(x.a.date)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    <span>已交 {x.n}/{students.length}</span>
                    <span>中位 {x.med == null ? '—' : Math.round(x.med)}</span>
                    <span>σ {x.sd == null ? '—' : round1(x.sd)}</span>
                    <span>及格 {x.passRate == null ? '—' : `${x.passRate}%`}</span>
                    <span className="flex items-center gap-1">
                      <span
                        className={cx(
                          'font-bold',
                          band ? TONE_TEXT[band.tone] : 'text-slate-400',
                        )}
                      >
                        {x.avg == null ? '—' : `${Math.round(x.avg)}%`}
                      </span>
                      {band && <Badge tone={band.tone}>{band.label}</Badge>}
                    </span>
                  </div>
                </div>
                <BoxPlot stats={x.box} passMark={stats.passMark} />
              </Card>
            )
          })}
        </div>
      )}

      {view === 'topics' && (
        <Card className="rounded-3xl p-5">
          <ChartHead
            icon={Target}
            tone="amber"
            hint="把評估連住 BAFS 課題（評估分頁設定），就會喺呢度睇到課題層面嘅強弱。"
          >
            各課題表現（由弱到強）
          </ChartHead>
          {topicStats.length === 0 ? (
            <EmptyState
              icon={Target}
              title="未連起課題"
              hint="去「評估」分頁，為測驗／考試揀返對應 BAFS 課題，就會睇到弱項。"
            />
          ) : (
            <ul className="space-y-3">
              {topicStats.map((t) => {
                const tone = pctTone(t.avg)
                const band = gradeOf(t.avg, scheme.scale, bands)
                return (
                  <li key={t.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        {t.area && (
                          <Badge tone="slate" className="shrink-0">
                            {t.area}
                          </Badge>
                        )}
                        {t.topic}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-400 tabular-nums">
                          n={t.n}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {t.avg}%
                        </span>
                        <Badge tone={band.tone}>{band.label}</Badge>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className={cx('h-full rounded-full transition-all', TONE_FILL[tone])}
                        style={{ width: `${t.avg}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {view === 'ranking' && (() => {
        const improved = improvement.filter((e) => (e.slope ?? 0) > 0).slice(0, 3)
        const declined = improvement
          .filter((e) => (e.slope ?? 0) < 0)
          .slice(-3)
          .reverse()
        const fmtSlope = (s: number) =>
          `${s >= 0 ? '+' : ''}${round1(s)} 分/評估`
        return (
      <>
        {(improved.length > 0 || declined.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="rounded-3xl p-4">
              <ChartHead icon={TrendingUp} tone="emerald">
                進步最大
                <span className="ml-1 font-normal text-slate-400">
                  逐評估走勢向上
                </span>
              </ChartHead>
              {improved.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                  暫時未有明顯上升嘅同學。
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {improved.map((e) => (
                    <li
                      key={e.student.id}
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm"
                    >
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                        {e.student.studentNo && (
                          <span className="mr-1.5 text-xs text-slate-400">
                            {e.student.studentNo}
                          </span>
                        )}
                        {e.student.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmtSlope(e.slope!)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="rounded-3xl p-4">
              <ChartHead icon={TrendingDown} tone="rose">
                需要關注
                <span className="ml-1 font-normal text-slate-400">
                  逐評估走勢向下
                </span>
              </ChartHead>
              {declined.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">
                  暫時未有明顯下跌嘅同學，繼續保持。
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {declined.map((e) => (
                    <li
                      key={e.student.id}
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm"
                    >
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">
                        {e.student.studentNo && (
                          <span className="mr-1.5 text-xs text-slate-400">
                            {e.student.studentNo}
                          </span>
                        )}
                        {e.student.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                        {fmtSlope(e.slope!)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
        <Card className="rounded-3xl p-2">
          {ranking.length === 0 ? (
            <EmptyState icon={Trophy} title="排名榜未開賽" hint="入分之後，班內名次就會即刻排好。" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ranking.map((r, i) => {
                const band = gradeOf(r.weighted!, scheme.scale, bands)
                const rank = i + 1
                return (
                  <li
                    key={r.student.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    {rank <= 3 ? (
                      <span
                        className={cx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-serif text-sm font-bold tabular-nums slashed-zero',
                          rank === 1
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                            : rank === 2
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
                        )}
                      >
                        {rank}
                      </span>
                    ) : (
                      <span className="w-7 text-center font-serif text-sm font-bold tabular-nums slashed-zero text-slate-400">
                        {rank}
                      </span>
                    )}
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {r.student.studentNo && (
                        <span className="mr-1.5 text-xs tabular-nums text-slate-400">
                          {r.student.studentNo}
                        </span>
                      )}
                      {r.student.name}
                    </span>
                    <div className="hidden w-40 sm:block">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          className={cx('h-full rounded-full', TONE_FILL[band.tone])}
                          style={{ width: `${r.weighted}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={cx(
                        'w-12 text-right font-serif text-[15px] font-semibold tabular-nums slashed-zero',
                        TONE_TEXT[band.tone],
                      )}
                    >
                      {r.weighted}%
                    </span>
                    <Badge tone={band.tone}>{band.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </>
        )
      })()}
    </div>
  )
}

// ============================================================
//  學生分頁 —— 批量加入 + 編輯
// ============================================================
function StudentsTab({ classId }: { classId: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const students = useCollection(studentsCol).filter((s) => s.classId === classId)
  const [name, setName] = useState('')
  const [no, setNo] = useState('')
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNo, setEditNo] = useState('')

  const add = () => {
    if (!name.trim()) return
    studentsCol.add({
      classId,
      name: name.trim(),
      studentNo: no.trim() || undefined,
    })
    toast.success(`已新增學生「${name.trim()}」`)
    setName('')
    setNo('')
  }

  // 批量：每行「學號 姓名」或「姓名」（學號可選，用空白／逗號／tab 分隔）
  const addBulk = () => {
    const lines = bulk
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) return
    let count = 0
    for (const line of lines) {
      const m = line.match(/^(\S+)[\s,，\t]+(.+)$/)
      let sNo: string | undefined
      let sName: string
      if (m && /^[\w\-./]+$/.test(m[1])) {
        sNo = m[1]
        sName = m[2].trim()
      } else {
        sName = line
      }
      if (!sName) continue
      studentsCol.add({ classId, name: sName, studentNo: sNo })
      count++
    }
    toast.success(`已批量加入 ${count} 位學生`)
    setBulk('')
    setShowBulk(false)
  }

  const startEdit = (id: string, n: string, num?: string) => {
    setEditId(id)
    setEditName(n)
    setEditNo(num ?? '')
  }
  const saveEdit = () => {
    if (!editId || !editName.trim()) return
    studentsCol.update(editId, {
      name: editName.trim(),
      studentNo: editNo.trim() || undefined,
    })
    toast.success('已更新學生')
    setEditId(null)
  }

  const remove = async (id: string, sName: string) => {
    const ok = await confirm({
      title: '刪除學生？',
      message: `將會移除「${sName}」及其所有成績記錄，此操作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    studentsCol.remove(id)
    // 同步移除該生分數
    scoresCol.set(scoresCol.get().filter((x) => x.studentId !== id))
    toast.success('已刪除學生')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-24">
          <Field label="學號">
            <Input
              value={no}
              onChange={(e) => setNo(e.target.value)}
              placeholder="選填"
            />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field label="學生姓名">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="輸入姓名"
            />
          </Field>
        </div>
        <Button onClick={add}>加入</Button>
        <Button
          variant="secondary"
          icon={Users}
          onClick={() => setShowBulk((v) => !v)}
        >
          批量
        </Button>
      </div>

      {showBulk && (
        <Card className="space-y-2 rounded-2xl border-accent/30 bg-accent-soft/30 p-4">
          <Field
            label="批量加入（每行一位）"
            hint="格式：「學號 姓名」或淨係「姓名」。可由 Excel 直接複製貼上。"
          >
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={'1\t陳大文\n2\t李小明\n王美玲'}
              className="min-h-[120px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base sm:text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowBulk(false)}>
              取消
            </Button>
            <Button size="sm" onClick={addBulk}>
              加入 {bulk.split('\n').filter((l) => l.trim()).length} 位
            </Button>
          </div>
        </Card>
      )}

      {students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="加入第一位學生"
          hint="喺上面打個名就得，或者撳「批量」由 Excel 一次過貼晒成班入嚟。"
        />
      ) : (
        <Card className="rounded-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 text-xs font-medium text-slate-400">
            <span>共 {students.length} 位學生</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {students.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 px-4 py-2.5">
                {editId === s.id ? (
                  <>
                    <Input
                      value={editNo}
                      onChange={(e) => setEditNo(e.target.value)}
                      placeholder="學號"
                      className="w-20"
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className="flex-1"
                    />
                    <IconButton label="儲存" onClick={saveEdit}>
                      <Check size={16} strokeWidth={2} />
                    </IconButton>
                  </>
                ) : (
                  <>
                    {s.studentNo && <Badge tone="slate">{s.studentNo}</Badge>}
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {s.name}
                    </span>
                    <IconButton
                      label="編輯學生"
                      onClick={() => startEdit(s.id, s.name, s.studentNo)}
                      className="opacity-100 transition focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Pencil size={15} strokeWidth={1.8} />
                    </IconButton>
                    <IconButton
                      label="刪除學生"
                      tone="danger"
                      onClick={() => remove(s.id, s.name)}
                      className="opacity-100 transition focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ============================================================
//  評估分頁 —— 連課題 + 日期 + 編輯
// ============================================================
function AssessmentsTab({ classId }: { classId: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const assessmentsRaw = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const assessments = [...assessmentsRaw].sort((a, b) =>
    assessmentSortKey(a).localeCompare(assessmentSortKey(b)),
  )
  const topics = useCollection(topicsCol)
  const [name, setName] = useState('')
  const [type, setType] = useState('測驗')
  const [maxScore, setMaxScore] = useState('100')
  const [date, setDate] = useState('')
  const [topicId, setTopicId] = useState('')

  const add = () => {
    if (!name.trim()) return
    assessmentsCol.add({
      classId,
      name: name.trim(),
      type,
      maxScore: Number(maxScore) || 100,
      date: date || undefined,
      topicId: topicId || undefined,
      createdAt: new Date().toISOString(),
    })
    toast.success(`已新增評估「${name.trim()}」`)
    setName('')
    setMaxScore('100')
    setDate('')
    setTopicId('')
  }

  const remove = async (id: string, aName: string) => {
    const ok = await confirm({
      title: '刪除評估？',
      message: `將會移除「${aName}」及其所有成績記錄，此操作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    assessmentsCol.remove(id)
    scoresCol.set(scoresCol.get().filter((x) => x.assessmentId !== id))
    toast.success('已刪除評估')
  }

  const setField = (id: string, patch: Partial<{ topicId: string; date: string }>) => {
    assessmentsCol.update(id, {
      topicId: patch.topicId === '' ? undefined : patch.topicId,
      ...(patch.date !== undefined ? { date: patch.date || undefined } : {}),
    })
  }

  // 課題按範疇分組（optgroup）
  const topicGroups = useMemo(() => {
    const m = new Map<string, typeof topics>()
    for (const t of topics) {
      const arr = m.get(t.area) ?? []
      arr.push(t)
      m.set(t.area, arr)
    }
    return [...m.entries()]
  }, [topics])

  return (
    <div className="space-y-3">
      <Card className="space-y-3 rounded-2xl border-accent/30 bg-accent-soft/40 p-4">
        <div className="flex flex-wrap gap-2">
          <div className="min-w-[160px] flex-1">
            <Field label="評估名稱">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="例如 第一次測驗"
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="類型">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {['測驗', '考試', '功課', '專題', '課堂表現'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-20">
            <Field label="滿分">
              <Input
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ''))}
                placeholder="100"
              />
            </Field>
          </div>
          <div className="w-36">
            <Field label="日期（選填）">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="課題（選填）" hint="連住課題之後可做課題弱項分析">
              <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
                <option value="">— 唔連課題 —</option>
                {topicGroups.map(([area, list]) => (
                  <optgroup key={area} label={area}>
                    {list.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.topic}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={add}>新增</Button>
        </div>
      </Card>

      {assessments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="開一份評估先"
          hint="喺上面加測驗、考試或功課；連埋課題仲可以做課題弱項分析。"
        />
      ) : (
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5 dark:border-slate-700/60">
            <FolderOpen size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              評估清單
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              共 {assessments.length} 項
            </span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {assessments.map((a, i) => {
              return (
                <li key={a.id} className="group px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* 卷面序號（同成績矩陣欄號呼應）*/}
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-serif text-xs font-bold tabular-nums slashed-zero text-slate-400 dark:bg-slate-700/60 dark:text-slate-500">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {a.name}
                      <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
                        <Badge tone="slate">{a.type}</Badge>
                        <Badge tone="accent">滿分 {a.maxScore}</Badge>
                        {a.date && <Badge tone="blue">{shortDate(a.date)}</Badge>}
                      </span>
                    </span>
                    <IconButton
                      label="刪除評估"
                      tone="danger"
                      onClick={() => remove(a.id, a.name)}
                      className="opacity-100 transition focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </IconButton>
                  </div>
                  {/* 行內快速設定課題 + 日期 */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-10">
                    <span className="text-xs text-slate-400">課題</span>
                    <select
                      value={a.topicId ?? ''}
                      onChange={(e) => setField(a.id, { topicId: e.target.value })}
                      aria-label={`${a.name} — 連結課題`}
                      className="max-w-[200px] cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-base sm:text-xs text-slate-600 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <option value="">— 未連 —</option>
                      {topicGroups.map(([area, list]) => (
                        <optgroup key={area} label={area}>
                          {list.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.topic}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={a.date ?? ''}
                      onChange={(e) => setField(a.id, { date: e.target.value })}
                      aria-label={`${a.name} — 評估日期`}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-base sm:text-xs text-slate-600 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ============================================================
//  評分方案分頁 —— 類別加權、等級制、drop lowest
// ============================================================
function SchemeTab({ classId }: { classId: string }) {
  const toast = useToast()
  const schemes = useCollection(gradingSchemesCol)
  const assessmentsRaw = useCollection(assessmentsCol).filter(
    (a) => a.classId === classId,
  )
  const scheme = ensureScheme(classId, schemes)

  // 班內實際出現過嘅類別（+ 預設常見類別）
  const usedTypes = useMemo(() => {
    const set = new Set<string>(Object.keys(DEFAULT_WEIGHTS))
    assessmentsRaw.forEach((a) => set.add(a.type))
    Object.keys(scheme.weights).forEach((t) => set.add(t))
    return [...set]
  }, [assessmentsRaw, scheme.weights])

  const persist = (patch: Partial<GradingScheme>) => {
    const existing = schemes.find((s) => s.classId === classId)
    if (existing) {
      gradingSchemesCol.update(existing.id, {
        ...patch,
        updatedAt: new Date().toISOString(),
      })
    } else {
      gradingSchemesCol.add({
        classId,
        weights: { ...DEFAULT_WEIGHTS },
        weighted: true,
        scale: 'hkdse',
        dropLowest: false,
        ...patch,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const setWeight = (type: string, v: number) => {
    persist({ weights: { ...scheme.weights, [type]: Math.max(0, Math.min(100, v)) } })
  }

  const totalWeight = useMemo(
    () =>
      usedTypes.reduce((sum, t) => sum + (scheme.weights[t] ?? 0), 0),
    [usedTypes, scheme.weights],
  )

  const normalize = () => {
    if (totalWeight === 0) return
    const next: Record<string, number> = {}
    usedTypes.forEach((t) => {
      next[t] = Math.round(((scheme.weights[t] ?? 0) / totalWeight) * 100)
    })
    persist({ weights: next })
    toast.success('已把權重正規化為合計 100%')
  }

  // ── 自訂等級分界 ──
  const baseBands = bandsOf(scheme.scale)
  const defaultCuts = defaultBandCuts(scheme.scale)
  // 目前生效嘅 cuts（已覆蓋預設）；只有最高那幾級可調，最底一級固定 0
  const currentCuts: Record<string, number> = {
    ...defaultCuts,
    ...(scheme.bandCuts?.[scheme.scale] ?? {}),
  }
  const editableBands = baseBands.filter((b) => b.min > 0) // 最底級固定 0，唔列
  const customized = baseBands.some(
    (b) => b.min > 0 && currentCuts[b.label] !== defaultCuts[b.label],
  )
  // 驗證：分界要嚴格遞減（高級下限 > 低級下限），否則等級會壓縮
  const cutsValid = editableBands.every((b, i) => {
    const next = editableBands[i + 1]
    const lower = next ? currentCuts[next.label] : 0
    return currentCuts[b.label] > lower
  })

  const setBandCut = (label: string, raw: number) => {
    const v = Math.max(0, Math.min(100, Math.round(raw) || 0))
    const scaleCuts = { ...currentCuts, [label]: v }
    persist({
      bandCuts: { ...(scheme.bandCuts ?? {}), [scheme.scale]: scaleCuts },
    })
  }

  const resetBandCuts = () => {
    const rest = { ...(scheme.bandCuts ?? {}) }
    delete rest[scheme.scale]
    persist({ bandCuts: rest })
    toast.success('已還原為預設分界')
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 rounded-2xl p-5">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            等級制
          </p>
          <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
            影響成績表 / 分析顯示嘅等級標籤（5**–U、優良、A–F）。
          </p>
          <SegmentedControl<GradeScaleKey>
            value={scheme.scale}
            onChange={(v) => persist({ scale: v })}
            options={[
              { id: 'hkdse', label: 'DSE 5**–U' },
              { id: 'percent', label: '優／良／及格' },
              { id: 'simple', label: 'A–F' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={scheme.weighted}
              onChange={(e) => persist({ weighted: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-600 dark:bg-slate-700"
            />
            啟用類別加權計分
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={scheme.dropLowest}
              onChange={(e) => persist({ dropLowest: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent dark:border-slate-600 dark:bg-slate-700"
            />
            每類剔除最低分一次
          </label>
        </div>
      </Card>

      <Card className="space-y-3 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              等級分界（自訂）
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              調整「{SCALE_LABEL[scheme.scale]}」每級嘅百分比下限，配合你校本標準。
              最低一級固定由 0 起。未改 = 用預設。
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={RotateCcw}
            onClick={resetBandCuts}
            disabled={!customized}
          >
            還原預設
          </Button>
        </div>

        <ul className="space-y-2">
          {editableBands.map((b, i) => {
            const next = editableBands[i + 1]
            const lower = next ? currentCuts[next.label] : 0
            const cur = currentCuts[b.label]
            const isDefault = cur === defaultCuts[b.label]
            const bad = cur <= lower
            return (
              <li key={b.label} className="flex items-center gap-3">
                <Badge tone={b.tone} className="w-12 shrink-0 justify-center">
                  {b.label}
                </Badge>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ≥
                </span>
                <div className="flex w-20 items-center">
                  {/* ring 用 box-shadow，唔會同 Input 既有 border utility 撞色（Tailwind 同特異度按 CSS 次序，border-rose 會輸畀 base border-slate） */}
                  <span
                    className={cx(
                      'block flex-1 rounded-lg',
                      bad && 'ring-2 ring-rose-400 dark:ring-rose-500',
                    )}
                  >
                    <Input
                      value={String(cur)}
                      onChange={(e) =>
                        setBandCut(
                          b.label,
                          Number(e.target.value.replace(/\D/g, '')) || 0,
                        )
                      }
                      aria-label={`「${b.label}」等級嘅百分比下限`}
                      aria-invalid={bad || undefined}
                      className="text-center font-serif font-semibold tabular-nums slashed-zero"
                    />
                  </span>
                  <span className="ml-1 text-sm text-slate-400">%</span>
                </div>
                <span className="flex-1 text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {i === 0 ? `${cur} 分以上` : `${cur}–${currentCuts[editableBands[i - 1].label]} 分`}
                  {!isDefault && (
                    <span className="ml-1.5 text-accent">
                      （預設 {defaultCuts[b.label]}）
                    </span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>

        {!cutsValid && (
          <p className="rounded-lg bg-rose-50/70 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">
            分界要由高到低嚴格遞減（高等級嘅下限要大過低等級），否則部分等級會無人落到。請調整紅框數值。
          </p>
        )}
      </Card>

      <Card className="space-y-3 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              類別權重
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              各類別佔總成績嘅百分比。只計算實際有分嘅類別（自動正規化）。
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={Calculator}
            onClick={normalize}
            disabled={!scheme.weighted}
          >
            正規化 100%
          </Button>
        </div>

        <div
          className={cx(
            'space-y-3 transition-opacity',
            scheme.weighted ? '' : 'pointer-events-none opacity-40',
          )}
        >
          {usedTypes.map((t) => {
            const v = scheme.weights[t] ?? 0
            const count = assessmentsRaw.filter((a) => a.type === t).length
            return (
              <div key={t} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-slate-600 dark:text-slate-300">
                  {t}
                  <span className="ml-1 text-xs text-slate-400">
                    ({count})
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={v}
                  onChange={(e) => setWeight(t, Number(e.target.value))}
                  aria-label={`「${t}」類別權重（%）`}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent dark:bg-slate-700"
                />
                <div className="flex w-16 items-center">
                  <Input
                    value={String(v)}
                    onChange={(e) =>
                      setWeight(t, Number(e.target.value.replace(/\D/g, '')) || 0)
                    }
                    aria-label={`「${t}」類別權重百分比`}
                    className="text-center tabular-nums"
                  />
                  <span className="ml-1 text-sm text-slate-400">%</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
          <span className="text-xs text-slate-400">合計權重</span>
          <span className="flex items-baseline gap-1.5">
            <span
              className={cx(
                'font-serif text-lg font-bold tabular-nums slashed-zero',
                totalWeight === 100
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {totalWeight}%
            </span>
            {totalWeight !== 100 && (
              <span className="text-xs font-normal text-slate-400">
                （唔等於 100% 都會自動按比例計算）
              </span>
            )}
          </span>
        </div>
      </Card>

      <Card className="flex items-start gap-3 rounded-2xl bg-slate-50/60 p-5 dark:bg-slate-800/40">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <Calculator size={16} />
        </span>
        <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <p className="mb-1 font-semibold text-slate-600 dark:text-slate-300">
            計分原理
          </p>
          先把同類評估（如所有「測驗」）取平均，再按上面權重做加權總和。
          某類別若完全未有分數，其權重會剔出、其餘類別按比例補上，所以期初未齊卷都計到合理總分。
          關閉加權則所有評估等權平均。
        </div>
      </Card>
    </div>
  )
}
