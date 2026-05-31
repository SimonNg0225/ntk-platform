import { useMemo, useState } from 'react'
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
  Calculator,
  Check,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  School,
  SlidersHorizontal,
  Target,
  Trash2,
  Trophy,
  UserCheck,
  Users,
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
  ensureScheme,
  gradeOf,
  gradingSchemesCol,
  histogram,
  mean,
  median,
  pctFor,
  pctTone,
  quartiles,
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

export default function Gradebook() {
  const classes = useCollection(classesCol)
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [tab, setTab] = useState<Tab>('grid')

  const activeClass = classes.find((c) => c.id === classId) ?? classes[0]

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={School}
        title="仲未有班別"
        hint="請先去「班別管理」新增班別，先可以記錄成績。"
      />
    )
  }

  return (
    <div className="space-y-4">
      <Pills
        options={classes.map((c) => ({ id: c.id, label: c.name }))}
        active={activeClass?.id ?? ''}
        onChange={setClassId}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICONS} />

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
  return { students, assessments, scores, scheme }
}

// ============================================================
//  成績表（學生 × 評估）—— 加權、排序、熱力底色、列印
// ============================================================
type SortMode = 'name' | 'total-desc' | 'total-asc'

function ScoreGrid({ classId, className }: { classId: string; className: string }) {
  const toast = useToast()
  const { students, assessments, scores, scheme } = useClassData(classId)
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

  // 每評估全班平均
  const assessmentAvg = useMemo(() => {
    const m = new Map<string, number | null>()
    for (const a of assessments) {
      const pts = students
        .map((s) => pctFor(scores, a.id, s.id, a.maxScore))
        .filter((x): x is number => x != null)
      m.set(a.id, mean(pts))
    }
    return m
  }, [assessments, students, scores])

  const classAvg = useMemo(() => {
    const vals = results
      .map((r) => r.weighted)
      .filter((x): x is number => x != null)
    return mean(vals)
  }, [results])

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
      cells.push(r.weighted == null ? '' : gradeOf(r.weighted, scheme.scale).label)
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
        title="未夠資料填成績"
        hint="請先喺「學生」同「評估」分頁加入資料，先可以填成績。"
      />
    )
  }

  const reportResult = reportFor ? resultById.get(reportFor) ?? null : null

  return (
    <div className="space-y-3">
      {/* 工具列 */}
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
          <Tooltip label={heatmap ? '關閉熱力底色' : '開啟熱力底色'}>
            <IconButton
              label="切換熱力底色"
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

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                學生
              </th>
              {assessments.map((a) => (
                <th
                  key={a.id}
                  className="whitespace-nowrap px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300"
                >
                  {a.name}
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    {a.type} · /{a.maxScore}
                    {scheme.weighted && scheme.weights[a.type] != null && (
                      <span className="text-accent"> · {scheme.weights[a.type]}%</span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                {scheme.weighted ? '加權總分' : '平均'}
              </th>
              <th className="px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                名次
              </th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {orderedResults.map((r) => {
              const s = r.student
              const total = r.weighted
              const band = total != null ? gradeOf(total, scheme.scale) : null
              const rank = rankById.get(s.id)
              return (
                <tr
                  key={s.id}
                  className="border-t border-slate-100 dark:border-slate-700"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {s.studentNo && (
                      <span className="mr-1.5 text-xs text-slate-400">
                        {s.studentNo}
                      </span>
                    )}
                    {s.name}
                  </td>
                  {assessments.map((a) => {
                    const rec = scores.find(
                      (x) =>
                        x.assessmentId === a.id && x.studentId === s.id,
                    )
                    const sc = rec?.score
                    const p = r.perAssessment[a.id]
                    const tone = p != null ? pctTone(p) : null
                    const cellBg =
                      heatmap && tone
                        ? HEAT_BG[tone]
                        : 'border-slate-200 dark:border-slate-600 dark:bg-slate-700'
                    return (
                      <td key={a.id} className="px-2 py-1.5 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={sc ?? ''}
                          onChange={(e) =>
                            setScore(a.id, s.id, e.target.value, a.maxScore)
                          }
                          className={cx(
                            'w-14 rounded-lg border px-1.5 py-1 text-center font-medium tabular-nums outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25',
                            cellBg,
                          )}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center">
                    {total == null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={cx(
                            'font-semibold tabular-nums',
                            band ? TONE_TEXT[band.tone] : '',
                          )}
                        >
                          {total}%
                        </span>
                        {band && <Badge tone={band.tone}>{band.label}</Badge>}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {rank ?? '—'}
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
            <tr className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
              <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                全班平均
              </td>
              {assessments.map((a) => {
                const av = assessmentAvg.get(a.id) ?? null
                return (
                  <td
                    key={a.id}
                    className={cx(
                      'px-3 py-2 text-center text-xs font-semibold tabular-nums',
                      av == null
                        ? 'text-slate-300'
                        : av < 50
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-300',
                    )}
                  >
                    {av == null ? '—' : `${Math.round(av)}%`}
                  </td>
                )
              })}
              <td className="px-3 py-2 text-center text-xs font-bold tabular-nums text-accent">
                {classAvg == null ? '—' : `${Math.round(classAvg)}%`}
              </td>
              <td className="px-2 py-2" colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500">
        低於 50% 嘅分數會以紅色標示。
        {scheme.weighted
          ? ' 總分按「評分方案」嘅類別權重計算。'
          : ' 總分為各評估等權平均（可去「評分方案」開啟加權）。'}
      </p>

      <StudentReport
        open={reportFor != null}
        onClose={() => setReportFor(null)}
        result={reportResult}
        rank={reportFor ? (rankById.get(reportFor) ?? null) : null}
        classSize={ranked.length}
        assessments={assessments}
        classAvg={classAvg}
        assessmentAvg={assessmentAvg}
        scheme={scheme}
        className={className}
      />
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
  const { students, assessments, scores, scheme } = useClassData(classId)
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

    // 等級分佈（按 scheme.scale）
    const bands = bandsOf(scheme.scale)
    const gradeCounts = bands.map((band) => ({
      band,
      n: totals.filter((t) => gradeOf(t, scheme.scale).label === band.label)
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
        students.some((s) => pctFor(scores, a.id, s.id, a.maxScore) != null),
      ).length,
    }
  }, [results, students, assessments, scores, scheme])

  // 逐項評估統計
  const perAssessment = useMemo(() => {
    return assessments.map((a) => {
      const pts = students
        .map((s) => pctFor(scores, a.id, s.id, a.maxScore))
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
  }, [assessments, students, scores, stats.passMark])

  // 課題弱項
  const topicStats = useMemo(() => {
    const byTopic = new Map<string, number[]>()
    assessments.forEach((a) => {
      if (!a.topicId) return
      students.forEach((s) => {
        const p = pctFor(scores, a.id, s.id, a.maxScore)
        if (p != null) {
          const arr = byTopic.get(a.topicId!) ?? []
          arr.push(p)
          byTopic.set(a.topicId!, arr)
        }
      })
    })
    return [...byTopic.entries()]
      .map(([tid, arr]) => ({
        topic: topics.find((t) => t.id === tid)?.topic ?? '未分類',
        area: topics.find((t) => t.id === tid)?.area ?? '',
        avg: round1(mean(arr) ?? 0),
        n: arr.length,
      }))
      .sort((a, b) => a.avg - b.avg)
  }, [assessments, students, scores, topics])

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
        title="未夠資料分析"
        hint="加入學生同評估、入埋分數後，呢度會自動整理班級表現。"
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
            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                分數分佈（全班總分）
              </p>
              <Histogram bins={stats.hist} passMark={stats.passMark} />
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                每條代表落入該分數區間嘅學生人數；紅色為不及格區間。
              </p>
            </Card>

            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                等級佔比（{SCALE_LABEL[scheme.scale]}）
              </p>
              <GradeDonut counts={stats.gradeCounts} scale={scheme.scale} />
            </Card>

            <Card className="p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                全班成績離散（箱形圖）
              </p>
              <BoxPlot stats={stats.box} passMark={stats.passMark} />
            </Card>

            <Card className="p-4">
              <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
                需關注學生（總分低於 {stats.passMark}%）
              </p>
              {stats.weak.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">暫時冇（或者未夠資料）。</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {stats.weak.map((r) => (
                    <li
                      key={r.student.id}
                      className="flex items-center justify-between rounded-lg bg-rose-50/60 px-3 py-1.5 text-sm dark:bg-rose-950/20"
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

          <Card className="p-4">
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              評估趨勢（全班平均）
            </p>
            <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
              按評估日期排序，睇班級表現走勢。
            </p>
            <TrendLine points={trendPoints} passMark={stats.passMark} />
          </Card>
        </div>
      )}

      {view === 'assessments' && (
        <div className="space-y-3">
          {perAssessment.map((x) => {
            const band = x.avg != null ? gradeOf(x.avg, scheme.scale) : null
            return (
              <Card key={x.a.id} className="p-4">
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
        <Card className="p-4">
          <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            各課題表現（由弱到強）
          </p>
          <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">
            把評估連住 BAFS 課題（評估分頁設定），就會喺呢度睇到課題層面嘅強弱。
          </p>
          {topicStats.length === 0 ? (
            <EmptyState
              icon={Target}
              title="未有課題資料"
              hint="去「評估」分頁，為測驗／考試揀返對應 BAFS 課題。"
            />
          ) : (
            <ul className="space-y-3">
              {topicStats.map((t) => {
                const tone = pctTone(t.avg)
                const band = gradeOf(t.avg, scheme.scale)
                return (
                  <li key={t.topic}>
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

      {view === 'ranking' && (
        <Card className="p-2">
          {ranking.length === 0 ? (
            <EmptyState icon={Trophy} title="未有成績" hint="入分後即見班內排名。" />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {ranking.map((r, i) => {
                const band = gradeOf(r.weighted!, scheme.scale)
                const medal =
                  i === 0
                    ? 'text-amber-500'
                    : i === 1
                      ? 'text-slate-400'
                      : i === 2
                        ? 'text-amber-700'
                        : 'text-slate-300'
                return (
                  <li
                    key={r.student.id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span
                      className={cx(
                        'w-7 text-center text-sm font-bold tabular-nums',
                        i < 3 ? medal : 'text-slate-400',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {r.student.studentNo && (
                        <span className="mr-1.5 text-xs text-slate-400">
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
                        'w-12 text-right text-sm font-semibold tabular-nums',
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
      )}
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
        <Card className="space-y-2 border-accent/30 bg-accent-soft/30 p-4">
          <Field
            label="批量加入（每行一位）"
            hint="格式：「學號 姓名」或淨係「姓名」。可由 Excel 直接複製貼上。"
          >
            <textarea
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={'1\t陳大文\n2\t李小明\n王美玲'}
              className="min-h-[120px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
          title="仲未有學生"
          hint="喺上面輸入姓名加入第一位學生，或用「批量」一次過貼上整班。"
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-400">
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
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Pencil size={15} strokeWidth={1.8} />
                    </IconButton>
                    <IconButton
                      label="刪除學生"
                      tone="danger"
                      onClick={() => remove(s.id, s.name)}
                      className="opacity-0 transition group-hover:opacity-100"
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
      <Card className="space-y-3 border-accent/30 bg-accent-soft/40 p-4">
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
          title="仲未有評估"
          hint="喺上面新增測驗、考試或功課，先可以入分。"
        />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {assessments.map((a) => {
              return (
                <li key={a.id} className="group px-4 py-3">
                  <div className="flex items-center gap-3">
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
                      className="opacity-0 transition group-hover:opacity-100"
                    >
                      <Trash2 size={16} strokeWidth={1.8} />
                    </IconButton>
                  </div>
                  {/* 行內快速設定課題 + 日期 */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">課題</span>
                    <select
                      value={a.topicId ?? ''}
                      onChange={(e) => setField(a.id, { topicId: e.target.value })}
                      className="max-w-[200px] cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
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

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
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

      <Card className="space-y-3 p-4">
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
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent dark:bg-slate-700"
                />
                <div className="flex w-16 items-center">
                  <Input
                    value={String(v)}
                    onChange={(e) =>
                      setWeight(t, Number(e.target.value.replace(/\D/g, '')) || 0)
                    }
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
          <span
            className={cx(
              'text-sm font-bold tabular-nums',
              totalWeight === 100
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400',
            )}
          >
            {totalWeight}%
            {totalWeight !== 100 && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                （唔等於 100% 都會自動按比例計算）
              </span>
            )}
          </span>
        </div>
      </Card>

      <Card className="flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
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
