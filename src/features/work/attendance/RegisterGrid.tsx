import { useMemo } from 'react'
import type { AttendanceRecord, AttendanceStatus, Student } from '../../../data/types'
import { Badge, cx } from '../../../ui'
import {
  STATUS_GLYPH,
  STATUS_STYLE,
  isWeekend,
  rateTone,
  tallyByStudent,
} from './util'

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

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/60">
      <table className="border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/60">
            <th className="sticky left-0 z-20 min-w-[120px] border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2 text-left text-xs font-semibold text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
              學生
            </th>
            {dayKeys.map((k) => {
              const day = Number(k.slice(8, 10))
              const we = isWeekend(k)
              return (
                <th
                  key={k}
                  className={cx(
                    'w-8 border-b border-slate-200 px-0 py-2 text-center text-[11px] font-semibold tabular-nums dark:border-slate-700',
                    we
                      ? 'bg-slate-100/70 text-slate-400 dark:bg-slate-900/40 dark:text-slate-600'
                      : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {day}
                </th>
              )
            })}
            <th className="sticky right-0 z-20 min-w-[64px] border-b border-l border-slate-200 bg-slate-50/95 px-2 py-2 text-center text-xs font-semibold text-slate-500 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
              出席率
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const inner = idx.get(s.id)
            const tally = tallies.get(s.id)
            return (
              <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="sticky left-0 z-10 min-w-[120px] border-r border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
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
                  return (
                    <td
                      key={k}
                      className={cx(
                        'border-l border-slate-100 p-0 text-center dark:border-slate-800/80',
                        we && 'bg-slate-50/60 dark:bg-slate-900/30',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onCycle(s.id, k, nextStatus(st))}
                        title={`${s.name}・${k}`}
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
                <td className="sticky right-0 z-10 min-w-[64px] border-l border-slate-200 bg-white px-2 py-1.5 text-center dark:border-slate-700 dark:bg-slate-800">
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
