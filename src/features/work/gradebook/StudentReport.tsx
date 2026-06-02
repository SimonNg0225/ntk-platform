import type { Assessment } from '../../../data/types'
import { Badge, Button, Modal } from '../../../ui'
import { Printer } from 'lucide-react'
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
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>成績單 — ${esc(result.student.name)}</title>
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
      <h1>${esc(className)} 成績單</h1>
      <div class="sub">學生：${esc(result.student.name)}${result.student.studentNo ? '（' + esc(result.student.studentNo) + '）' : ''}　·　列印日期：${new Date().toLocaleDateString('zh-HK')}</div>
      <div class="big">${total == null ? '—' : Math.round(total) + '%'}　<span style="font-size:20px;color:#64748b">${band ? band.label : ''}</span></div>
      <div class="meta">
        <div><span>班內名次</span><b>${rank == null ? '—' : rank + ' / ' + classSize}</b></div>
        <div><span>班內百分位</span><b>${percentile == null ? '—' : percentile + 'th'}</b></div>
        <div><span>已交評估</span><b>${result.submitted} / ${result.expected}</b></div>
        <div><span>班級平均</span><b>${classAvg == null ? '—' : Math.round(classAvg) + '%'}</b></div>
      </div>
      <table><thead><tr><th>評估</th><th style="text-align:center">類型</th><th style="text-align:right">得分</th><th style="text-align:right">班平均</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="foot">由 NTK Platform 自動產生 · 加權方案：${scheme.weighted ? '已啟用' : '等權平均'}</div>
      </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 250)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`成績單 — ${result.student.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            關閉
          </Button>
          <Button icon={Printer} onClick={handlePrint}>
            列印 / 存 PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 總覽 —— 成績單封面：serif 巨型總分 + 等第章 + 名次/百分位/已交清算 */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft/50 p-5 dark:border-accent/30 dark:bg-accent/10">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              總成績
            </p>
            <p className="mt-0.5 flex items-baseline gap-2">
              <span
                className={`font-serif text-[42px] font-semibold leading-none tabular-nums slashed-zero ${
                  band ? TONE_TEXT[band.tone] : 'text-slate-400'
                }`}
              >
                {total == null ? '—' : `${Math.round(total)}%`}
              </span>
              {band && <Badge tone={band.tone}>{band.label}</Badge>}
            </p>
          </div>
          <div className="flex gap-5 text-center">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">班內名次</p>
              <p className="mt-0.5 font-serif text-xl font-semibold tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
                {rank == null ? '—' : `${rank}`}
                <span className="font-sans text-sm font-normal text-slate-400">
                  {' '}
                  / {classSize}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">百分位</p>
              <p className="mt-0.5 font-serif text-xl font-semibold tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
                {percentile == null ? (
                  '—'
                ) : (
                  <>
                    {percentile}
                    <span className="font-sans text-sm font-normal text-slate-400">
                      {' '}
                      th
                    </span>
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">已交</p>
              <p className="mt-0.5 font-serif text-xl font-semibold tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
                {result.submitted}
                <span className="font-sans text-sm font-normal text-slate-400">
                  {' '}
                  / {result.expected}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">走勢</p>
              <div className="flex h-9 items-center justify-center">
                <MiniSpark values={trend} scale={scale} />
              </div>
            </div>
          </div>
        </div>

        {/* 逐評估明細 */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">評估</th>
                <th className="px-3 py-2.5 text-center font-semibold">類型</th>
                <th className="px-3 py-2.5 text-right font-semibold">得分</th>
                <th className="px-3 py-2.5 text-right font-semibold">vs 班平均</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((a) => {
                const p = result.perAssessment[a.id]
                const av = assessmentAvg.get(a.id) ?? null
                const diff = p != null && av != null ? p - av : null
                const t = p != null ? gradeOf(p, scale, bands).tone : 'slate'
                return (
                  <tr key={a.id} className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      {a.name}
                      {a.date && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          {shortDate(a.date)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge tone="slate">{a.type}</Badge>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-serif text-[15px] font-semibold tabular-nums slashed-zero ${TONE_TEXT[t]}`}
                    >
                      {p == null ? (
                        <span className="font-sans text-sm font-normal text-slate-300 dark:text-slate-600">
                          未交
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
          </table>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          「vs 班平均」顯示該生喺每項評估與全班平均嘅差距（百分點）。
        </p>
      </div>
    </Modal>
  )
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;',
  )
}
