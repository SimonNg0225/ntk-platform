import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AttendanceRecord, AttendanceStatus, Student } from '../../../data/types'
import { Badge, cx } from '../../../ui'
import './i18n'
import {
  STATUS_GLYPH,
  STATUS_LABEL,
  STATUS_STYLE,
  isWeekend,
  rateTone,
  tallyByStudent,
  todayKey,
} from './util'

const STATUS_T_KEY: Record<AttendanceStatus, string> = {
  present: 'attend.statusPresent',
  late: 'attend.statusLate',
  absent: 'attend.statusAbsent',
}

// ============================================================
//  月度點名冊（學生 × 日子矩陣）
//  ------------------------------------------------------------
//  仿紙本考勤冊：橫向係該月每一日，直向係學生。
//  每格顯示狀態代號（✓ / L / ✕），右邊欄為個人月出席率。
//  撳格可快速循環切換狀態（present→late→absent→清除）。
// ============================================================

const CYCLE: (AttendanceStatus | null)[] = ['present', 'late', 'absent', null]

function nextStatus(curr: AttendanceStatus | undefined): AttendanceStatus | null {
  const i = CYCLE.indexOf(curr ?? null)
  return CYCLE[(i + 1) % CYCLE.length]
}

export default function RegisterGrid({
  students,
  records,
  dayKeys,
  onCycle,
}: {
  students: Student[]
  records: AttendanceRecord[] // 已過濾到該班 + 該月
  dayKeys: string[] // 該月每一日（由 1 號到月尾）
  onCycle: (studentId: string, date: string, next: AttendanceStatus | null) => void
}) {
  const { t } = useTranslation()
  // studentId -> date -> status
  const idx = useMemo(() => {
    const m = new Map<string, Map<string, AttendanceStatus>>()
    for (const r of records) {
      let inner = m.get(r.studentId)
      if (!inner) {
        inner = new Map()
        m.set(r.studentId, inner)
      }
      inner.set(r.date, r.status)
    }
    return m
  }, [records])

  const tallies = useMemo(
    () => tallyByStudent(records, students.map((s) => s.id), dayKeys),
    [records, students, dayKeys],
  )

  const today = todayKey()

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
      <table className="border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/60">
            <th className="sticky left-0 z-20 min-w-[120px] border-b border-r border-slate-200/80 bg-slate-50/95 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95 dark:text-slate-400">
              {t('attend.colStudent', { defaultValue: '學生' })}
            </th>
            {dayKeys.map((k) => {
              const day = Number(k.slice(8, 10))
              const we = isWeekend(k)
              const isToday = k === today
              return (
                <th
                  key={k}
                  className={cx(
                    'w-8 border-b border-slate-200/80 px-0 py-2.5 text-center text-[11px] font-semibold tabular-nums dark:border-slate-700/60',
                    isToday
                      ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : we
                        ? 'bg-slate-100/70 text-slate-400 dark:bg-slate-900/40 dark:text-slate-600'
                        : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {isToday ? (
                    <span className="flex flex-col items-center leading-none">
                      <span>{day}</span>
                      <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" />
                    </span>
                  ) : (
                    day
                  )}
                </th>
              )
            })}
            <th className="sticky right-0 z-20 min-w-[64px] border-b border-l border-slate-200/80 bg-slate-50/95 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur dark:border-slate-700/60 dark:bg-slate-800/95 dark:text-slate-400">
              {t('attend.colRate', { defaultValue: '出席率' })}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const inner = idx.get(s.id)
            const tally = tallies.get(s.id)
            return (
              <tr key={s.id} className="group border-t border-slate-100 transition-colors hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                <td className="sticky left-0 z-10 min-w-[120px] border-r border-slate-200/80 bg-white px-3 py-1.5 transition-colors group-hover:bg-slate-50/95 dark:border-slate-700/60 dark:bg-slate-800 dark:group-hover:bg-slate-800/95">
                  <div className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {s.name}
                  </div>
                  {s.studentNo && (
                    <div className="text-[10px] text-slate-400">{s.studentNo}</div>
                  )}
                </td>
                {dayKeys.map((k) => {
                  const st = inner?.get(k)
                  const we = isWeekend(k)
                  const isToday = k === today
                  return (
                    <td
                      key={k}
                      className={cx(
                        'border-l border-slate-100 p-0 text-center dark:border-slate-800/80',
                        isToday && 'bg-accent-soft/40 dark:bg-accent/5',
                        we && !isToday && 'bg-slate-50/60 dark:bg-slate-900/30',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onCycle(s.id, k, nextStatus(st))}
                        title={`${s.name}・${k}`}
                        aria-label={t('attend.cellAria', {
                          name: s.name,
                          date: k,
                          status: st
                            ? t(STATUS_T_KEY[st], { defaultValue: STATUS_LABEL[st] })
                            : t('attend.unmarked', { defaultValue: '未標記' }),
                          defaultValue: `${s.name}・${k}：${st ? STATUS_LABEL[st] : '未標記'}`,
                        })}
                        className={cx(
                          'flex h-8 w-full items-center justify-center text-xs font-semibold tabular-nums transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
                          st
                            ? STATUS_STYLE[st].cell
                            : 'text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-700/50',
                        )}
                      >
                        {st ? STATUS_GLYPH[st] : '·'}
                      </button>
                    </td>
                  )
                })}
                <td className="sticky right-0 z-10 min-w-[64px] border-l border-slate-200/80 bg-white px-2 py-1.5 text-center transition-colors group-hover:bg-slate-50/95 dark:border-slate-700/60 dark:bg-slate-800 dark:group-hover:bg-slate-800/95">
                  {tally && tally.marked > 0 ? (
                    <Badge tone={rateTone(tally.rate)} className="tabular-nums">
                      {tally.rate}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
