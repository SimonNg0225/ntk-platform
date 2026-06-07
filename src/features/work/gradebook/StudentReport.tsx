import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import type { Assessment } from '../../../data/types'
import { Badge, Button, IconButton, Modal, cx } from '../../../ui'
import {
  BookMarked,
  Calculator,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Printer,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { MiniSpark } from './Charts'
import {
  TONE_TEXT,
  assessmentSortKey,
  gradeOf,
  shortDate,
  type GradeBand,
  type GradeScaleKey,
  type GradingScheme,
  type StudentResult,
} from './util'

// ============================================================
//  學生成績單（report card）—— 可打印
//  類似 PowerSchool / 學校通告附頁：總成績、等級、班內名次、
//  逐評估明細、走勢迷你圖、班平均對比。
// ============================================================

export default function StudentReport({
  open,
  onClose,
  result,
  rank,
  classSize,
  percentile,
  assessments,
  classAvg,
  assessmentAvg,
  scheme,
  bands,
  className,
}: {
  open: boolean
  onClose: () => void
  result: StudentResult | null
  rank: number | null
  classSize: number
  /** 班內百分位（0–100）；null = 無從比較 */
  percentile: number | null
  assessments: Assessment[]
  classAvg: number | null
  /** assessmentId → 全班平均(%) */
  assessmentAvg: Map<string, number | null>
  scheme: GradingScheme
  /** 已套用自訂分界嘅 bands（未提供則用內建）*/
  bands?: GradeBand[]
  className: string
}) {
  const { t, i18n } = useTranslation()
  if (!result) return null
  const scale: GradeScaleKey = scheme.scale
  const sorted = [...assessments].sort((a, b) =>
    assessmentSortKey(a).localeCompare(assessmentSortKey(b)),
  )
  const total = result.weighted
  const band = total != null ? gradeOf(total, scale, bands) : null
  const trend = sorted
    .map((a) => result.perAssessment[a.id])
    .filter((x): x is number => x != null)

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=720,height=900')
    if (!win) return
    const rows = sorted
      .map((a) => {
        const p = result.perAssessment[a.id]
        const av = assessmentAvg.get(a.id)
        return `<tr>
          <td>${esc(a.name)}</td>
          <td style="text-align:center">${esc(a.type)}</td>
          <td style="text-align:right">${p == null ? '—' : Math.round(p) + '%'}</td>
          <td style="text-align:right;color:#64748b">${av == null ? '—' : Math.round(av) + '%'}</td>
        </tr>`
      })
      .join('')
    const printTitle = t('gradebook.reportPrintTitle', {
      name: result.student.name,
      defaultValue: '成績單 — {{name}}',
    })
    const reportHeading = t('gradebook.reportTitle', {
      className,
      defaultValue: '{{className}} 成績單',
    })
    const studentLine = t('gradebook.reportPrintStudent', {
      name:
        result.student.name +
        (result.student.studentNo ? `（${result.student.studentNo}）` : ''),
      defaultValue: '學生：{{name}}',
    })
    const printDateLine = t('gradebook.reportPrintDate', {
      date: new Date().toLocaleDateString(
        i18n.language === 'en' ? 'en-GB' : 'zh-HK',
      ),
      defaultValue: '列印日期：{{date}}',
    })
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${esc(printTitle)}</title>
      <style>
        body{font-family:-apple-system,'PingFang HK','Microsoft JhengHei',sans-serif;padding:32px;color:#1e293b}
        h1{font-size:20px;margin:0 0 4px}
        .sub{color:#64748b;font-size:13px;margin-bottom:20px}
        .big{font-size:40px;font-weight:700;margin:8px 0}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
        th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0}
        th{text-align:left;color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase}
        .meta{display:flex;gap:32px;margin:16px 0}
        .meta div span{display:block;color:#64748b;font-size:11px}
        .meta div b{font-size:18px}
        .foot{margin-top:28px;color:#94a3b8;font-size:11px}
      </style></head><body>
      <h1>${esc(reportHeading)}</h1>
      <div class="sub">${esc(studentLine)}　·　${esc(printDateLine)}</div>
      <div class="big">${total == null ? '—' : Math.round(total) + '%'}　<span style="font-size:20px;color:#64748b">${band ? band.label : ''}</span></div>
      <div class="meta">
        <div><span>${esc(t('gradebook.reportPrintRank', { defaultValue: '班內名次' }))}</span><b>${rank == null ? '—' : rank + ' / ' + classSize}</b></div>
        <div><span>${esc(t('gradebook.reportPrintPercentile', { defaultValue: '班內百分位' }))}</span><b>${percentile == null ? '—' : percentile + 'th'}</b></div>
        <div><span>${esc(t('gradebook.reportPrintSubmitted', { defaultValue: '已交評估' }))}</span><b>${result.submitted} / ${result.expected}</b></div>
        <div><span>${esc(t('gradebook.reportPrintClassAvg', { defaultValue: '班級平均' }))}</span><b>${classAvg == null ? '—' : Math.round(classAvg) + '%'}</b></div>
      </div>
      <table><thead><tr><th>${esc(t('gradebook.reportPrintColAssessment', { defaultValue: '評估' }))}</th><th style="text-align:center">${esc(t('gradebook.reportPrintColType', { defaultValue: '類型' }))}</th><th style="text-align:right">${esc(t('gradebook.reportPrintColScore', { defaultValue: '得分' }))}</th><th style="text-align:right">${esc(t('gradebook.reportPrintColClassAvg', { defaultValue: '班平均' }))}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">${esc(
        t('gradebook.reportPrintFoot', {
          scheme: scheme.weighted
            ? t('gradebook.reportSchemeEnabled', { defaultValue: '已啟用' })
            : t('gradebook.reportSchemeEqual', { defaultValue: '等權平均' }),
          defaultValue: '由 教學易 自動產生 · 加權方案：{{scheme}}',
        }),
      )}</div>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  const studentNo = result.student.studentNo

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('gradebook.reportClose', { defaultValue: '關閉' })}
          </Button>
          <Button icon={Printer} onClick={handlePrint}>
            {t('gradebook.reportPrint', { defaultValue: '列印 / 存 PDF' })}
          </Button>
        </>
      }
    >
      {/* ───────── 成績單封面抬頭：呼應 Gradebook masthead（kicker + serif + 鋼印 + 帳簿雙線）───────── */}
      <header className="relative -mx-5 -mt-5 mb-4 overflow-hidden border-b border-slate-200/80 bg-accent-soft/40 px-5 pb-4 pt-5 dark:border-slate-700/60 dark:bg-accent/10 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        {/* 右上鋼印（純裝飾，同 masthead 一致）*/}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 top-2 hidden -rotate-6 select-none rounded-lg border-2 border-dashed border-accent/20 px-3 py-1.5 font-serif text-[10px] font-semibold uppercase tracking-[0.25em] text-accent/25 dark:border-accent/25 dark:text-accent/25 sm:block"
        >
          {t('gradebook.reportStampLedger', { defaultValue: '成績冊 · Ledger' })}
        </span>
        <div className="flex items-start gap-3 pr-9 sm:pr-28">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-accent-strong dark:bg-white/10 dark:text-accent">
            <GraduationCap size={22} strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
              <BookMarked size={12} className="shrink-0" />
              {t('gradebook.reportKicker', { defaultValue: '成績單 · Report Card' })}
            </p>
            <h2 className="mt-1 flex flex-wrap items-baseline gap-x-2 font-serif text-[24px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[28px]">
              {result.student.name}
              {studentNo && (
                <span className="font-sans text-sm font-normal tabular-nums text-slate-400 dark:text-slate-500">
                  {t('gradebook.reportStudentNo', {
                    no: studentNo,
                    defaultValue: '學號 {{no}}',
                  })}
                </span>
              )}
            </h2>
            <p className="mt-1.5 truncate text-sm text-slate-500 dark:text-slate-400">
              {className} ·{' '}
              {scheme.weighted
                ? t('gradebook.reportWeighted', { defaultValue: '加權計分' })
                : t('gradebook.reportUnweighted', { defaultValue: '等權平均' })}
            </p>
          </div>
        </div>
        <IconButton
          label={t('gradebook.reportClose', { defaultValue: '關閉' })}
          onClick={onClose}
          className="absolute right-3 top-3 sm:right-4 sm:top-4"
        >
          <X size={18} />
        </IconButton>
        {/* 帳簿雙線（封面分隔感，同 masthead）*/}
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-300/70 dark:bg-slate-600/50" />
          <span className="block h-px bg-slate-300/40 dark:bg-slate-600/30" />
        </div>
      </header>

      <div className="space-y-4">
        {/* 總覽 —— 成績單封面清算：serif 巨型總分 + 等第章 + 名次/百分位/已交（帳簿清點欄）*/}
        <section className="overflow-hidden rounded-2xl border border-accent/25 dark:border-accent/30">
          {/* 主格：總成績 — accent 底、serif 巨數、等第章 */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-accent-soft/50 px-5 py-4 dark:bg-accent/10">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent-strong/80 dark:text-accent/80">
                <Target size={12} className="shrink-0" />
                {scheme.weighted
                  ? t('gradebook.reportWeightedTotalGrade', { defaultValue: '加權總成績' })
                  : t('gradebook.reportTotalGrade', { defaultValue: '總成績' })}
              </p>
              <p className="mt-0.5 flex items-baseline gap-2">
                <span
                  className={cx(
                    'font-serif text-[42px] font-semibold leading-none tabular-nums slashed-zero',
                    band ? TONE_TEXT[band.tone] : 'text-slate-400',
                  )}
                >
                  {total == null ? '—' : `${Math.round(total)}`}
                  {total != null && (
                    <span className="ml-0.5 font-sans text-lg font-normal text-slate-400">
                      %
                    </span>
                  )}
                </span>
                {band && <Badge tone={band.tone}>{band.label}</Badge>}
              </p>
            </div>
            <div
              className="flex h-10 items-center"
              title={t('gradebook.reportTrendTitle', { defaultValue: '逐評估走勢' })}
            >
              <MiniSpark values={trend} scale={scale} />
            </div>
          </div>
          {/* 清點欄：名次 / 百分位 / 已交 —— hairline grid、serif 數字 */}
          <div className="grid grid-cols-3 gap-px border-t border-accent/20 bg-slate-200/70 dark:border-accent/25 dark:bg-slate-700/50">
            <LedgerCell
              label={t('gradebook.reportRankInClass', { defaultValue: '班內名次' })}
              icon={Trophy}
            >
              {rank == null ? '—' : `${rank}`}
              {rank != null && (
                <span className="font-sans text-sm font-normal text-slate-400">
                  {' '}
                  / {classSize}
                </span>
              )}
            </LedgerCell>
            <LedgerCell
              label={t('gradebook.reportPercentile', { defaultValue: '百分位' })}
              icon={Target}
            >
              {percentile == null ? '—' : `${percentile}`}
              {percentile != null && (
                <span className="font-sans text-sm font-normal text-slate-400">
                  {' '}
                  th
                </span>
              )}
            </LedgerCell>
            <LedgerCell
              label={t('gradebook.reportSubmitted', { defaultValue: '已交評估' })}
              icon={ListChecks}
            >
              {result.submitted}
              <span className="font-sans text-sm font-normal text-slate-400">
                {' '}
                / {result.expected}
              </span>
            </LedgerCell>
          </div>
        </section>

        {/* 逐評估明細 —— 改卷簿明細頁：ruled 帳格 · serif 題號／得分 · 結算行 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          {/* 明細卷頭（呼應主畫面「成績矩陣」題頭帶）*/}
          <div className="flex items-center gap-1.5 border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/60">
            <NotebookPen size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('gradebook.reportScoreSheet', { defaultValue: '成績明細 · Score Sheet' })}
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {t('gradebook.reportItemsCount', {
                count: sorted.length,
                defaultValue: '{{count}} 項',
              })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t('gradebook.reportColAssessment', { defaultValue: '評估' })}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    {t('gradebook.reportColType', { defaultValue: '類型' })}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t('gradebook.reportColScore', { defaultValue: '得分' })}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t('gradebook.reportColVsAvg', { defaultValue: 'vs 班平均' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sorted.map((a, i) => {
                  const p = result.perAssessment[a.id]
                  const av = assessmentAvg.get(a.id) ?? null
                  const diff = p != null && av != null ? p - av : null
                  const tone = p != null ? gradeOf(p, scale, bands).tone : 'slate'
                  return (
                    <tr
                      key={a.id}
                      className="transition-colors hover:bg-accent-soft/20 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <span className="flex items-baseline gap-2">
                          <span className="font-serif text-[11px] tabular-nums slashed-zero text-slate-300 dark:text-slate-600">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0">
                            {a.name}
                            {a.date && (
                              <span className="ml-1.5 text-xs text-slate-400">
                                {shortDate(a.date)}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge tone="slate">{a.type}</Badge>
                      </td>
                      <td
                        className={cx(
                          'px-3 py-2 text-right font-serif text-[15px] font-semibold tabular-nums slashed-zero',
                          TONE_TEXT[tone],
                        )}
                      >
                        {p == null ? (
                          <span className="font-sans text-sm font-normal text-slate-300 dark:text-slate-600">
                            {t('gradebook.reportNotSubmitted', { defaultValue: '未交' })}
                          </span>
                        ) : (
                          `${Math.round(p)}%`
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-serif tabular-nums slashed-zero">
                        {diff == null ? (
                          <span className="font-sans text-slate-300 dark:text-slate-600">—</span>
                        ) : (
                          <span
                            className={
                              diff >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {diff >= 0 ? '+' : ''}
                            {Math.round(diff)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* 結算行（同主畫面成績矩陣 tfoot 一致）*/}
              <tfoot>
                <tr className="border-t-2 border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-800/60">
                  <td
                    colSpan={2}
                    className="px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      <Calculator size={12} className="shrink-0" />
                      {scheme.weighted
                        ? t('gradebook.reportWeightedTotal', { defaultValue: '加權總分' })
                        : t('gradebook.reportTotal', { defaultValue: '總分' })}
                    </span>
                  </td>
                  <td
                    className={cx(
                      'px-3 py-2.5 text-right font-serif text-[15px] font-bold tabular-nums slashed-zero',
                      band ? TONE_TEXT[band.tone] : 'text-slate-300 dark:text-slate-600',
                    )}
                  >
                    {total == null ? '—' : `${Math.round(total)}%`}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {classAvg == null ? (
                      <span className="font-serif text-[13px] tabular-nums text-slate-300 dark:text-slate-600">
                        —
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                        <Users size={11} className="shrink-0" />
                        {t('gradebook.reportClassShort', {
                          value: Math.round(classAvg),
                          defaultValue: '班 {{value}}%',
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 帳簿頁腳註（同主畫面成績矩陣底部說明小字風格）*/}
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-0.5 text-xs text-slate-400 dark:text-slate-500">
          <span>
            {t('gradebook.reportFootVsAvg', {
              defaultValue: '「vs 班平均」為該生喺每項評估與全班平均嘅差距（百分點）。',
            })}
          </span>
          <span aria-hidden className="text-slate-300 dark:text-slate-600">·</span>
          <span>
            {t('gradebook.reportFootBy', { defaultValue: '由 教學易 自動結算。' })}
          </span>
        </p>
      </div>
    </Modal>
  )
}

// ───────── 帳簿清點格（封面清算欄；serif 大數字、hairline 分隔）─────────
//  同 Gradebook masthead 嘅 LedgerStat 同一套視覺：一格一個關鍵數。
function LedgerCell({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: typeof Target
  children: ReactNode
}) {
  return (
    <div className="bg-accent-soft/30 px-4 py-3 dark:bg-accent/5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <Icon size={12} className="shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 font-serif text-xl font-semibold leading-none tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
        {children}
      </p>
    </div>
  )
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}
