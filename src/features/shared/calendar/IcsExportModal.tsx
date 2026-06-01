import { useMemo, useState } from 'react'
import { CalendarHeart, Download, Hourglass } from 'lucide-react'
import type { CalendarEvent, CalendarCategory, Countdown } from '../../../data/types'
import { Button, Modal, cx } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { downloadText } from '../../learning/journal/util'
import { buildICS, exportStamp, eventsToVevents, countdownsToVevents } from './ics'
import { toKey } from './util'

// ============================================================
//  匯出 .ics — 把可見事件（尊重行事曆開關 + 重複展開）同／或全部倒數
//  寫成標準 iCalendar 檔，下載後可匯入 Apple / Google / Outlook。
//  範圍：今日前 6 個月 → 今日後 24 個月（覆蓋過去半年同未來兩年嘅重複）。
// ============================================================

const MONTHS_BACK = 6
const MONTHS_FWD = 24

function shiftMonthsKey(base: Date, months: number): string {
  return toKey(new Date(base.getFullYear(), base.getMonth() + months, base.getDate(), 12))
}

function CheckRow({
  checked,
  onToggle,
  icon: Icon,
  title,
  count,
}: {
  checked: boolean
  onToggle: () => void
  icon: typeof CalendarHeart
  title: string
  count: number
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        checked
          ? 'border-accent bg-accent-soft/60 dark:border-accent dark:bg-accent/10'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600',
      )}
    >
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          checked
            ? 'bg-accent text-white'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400',
        )}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {count} 項
        </span>
      </span>
      <span
        className={cx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition',
          checked
            ? 'border-accent bg-accent text-white'
            : 'border-slate-300 dark:border-slate-600',
        )}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
            <path
              d="M5 10.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </button>
  )
}

export default function IcsExportModal({
  events,
  cats,
  countdowns,
  onClose,
}: {
  events: CalendarEvent[]
  cats: CalendarCategory[]
  countdowns: Countdown[]
  onClose: () => void
}) {
  const toast = useToast()
  const [withEvents, setWithEvents] = useState(true)
  const [withCountdowns, setWithCountdowns] = useState(true)

  const now = useMemo(() => new Date(), [])
  const rangeStart = useMemo(() => shiftMonthsKey(now, -MONTHS_BACK), [now])
  const rangeEnd = useMemo(() => shiftMonthsKey(now, MONTHS_FWD), [now])

  // 預覽計數（用同一套組裝邏輯數 VEVENT 數量，所見即所得）。
  // 永遠數可匯出嘅總數（唔受勾選狀態影響），讓使用者知有幾多可揀。
  const eventCount = useMemo(
    () =>
      eventsToVevents(events, cats, rangeStart, rangeEnd, '').filter(
        (l) => l === 'BEGIN:VEVENT',
      ).length,
    [events, cats, rangeStart, rangeEnd],
  )
  const countdownCount = useMemo(
    () => countdownsToVevents(countdowns, '').filter((l) => l === 'BEGIN:VEVENT').length,
    [countdowns],
  )

  const total = (withEvents ? eventCount : 0) + (withCountdowns ? countdownCount : 0)

  function doExport() {
    if (!withEvents && !withCountdowns) {
      toast.error('揀返要匯出邊類先')
      return
    }
    const ics = buildICS({
      events,
      cats,
      countdowns,
      rangeStart,
      rangeEnd,
      includeEvents: withEvents,
      includeCountdowns: withCountdowns,
      now,
      calName: 'NTK 行事曆匯出',
    })
    downloadText(`ntk-calendar-${exportStamp(now)}.ics`, ics, 'text/calendar')
    toast.success(total > 0 ? `已匯出 ${total} 項到 .ics` : '已匯出（暫時無內容）')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="匯出行事曆（.ics）" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          下載標準 iCalendar 檔，匯入 Apple / Google / Outlook
          行事曆。只匯出顯示中嘅行事曆，重複事件會展開成逐次（涵蓋過去半年至未來兩年）。
        </p>

        <div className="space-y-2.5">
          <CheckRow
            checked={withEvents}
            onToggle={() => setWithEvents((v) => !v)}
            icon={CalendarHeart}
            title="行事曆事件（顯示中）"
            count={eventCount}
          />
          <CheckRow
            checked={withCountdowns}
            onToggle={() => setWithCountdowns((v) => !v)}
            icon={Hourglass}
            title="倒數（全部）"
            count={countdownCount}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            合共 {total} 項
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              icon={Download}
              onClick={doExport}
              disabled={!withEvents && !withCountdowns}
            >
              下載 .ics
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
