import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import { CalendarArrowDown, CalendarHeart, Download, Hourglass, X } from 'lucide-react'
import type { CalendarEvent, CalendarCategory, Countdown } from '../../../data/types'
import { Button, IconButton, Modal, cx } from '../../../ui'
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
  const { t } = useTranslation()
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
        <span className="block font-serif text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <span className="block text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {t('cal.countSuffix', { count, defaultValue: `${count} 項` })}
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
  const { t } = useTranslation()
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
      toast.error(t('cal.pickTypeFirst', { defaultValue: '揀返要匯出邊類先' }))
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
      calName: t('cal.exportName', { defaultValue: '教學易 行事曆匯出' }),
    })
    downloadText(`eziteach-calendar-${exportStamp(now)}.ics`, ics, 'text/calendar')
    toast.success(
      total > 0
        ? t('cal.exportedCount', { count: total, defaultValue: `已匯出 ${total} 項到 .ics` })
        : t('cal.exportedEmpty', { defaultValue: '已匯出（暫時無內容）' }),
    )
    onClose()
  }

  return (
    // 唔傳 title → 自管「週記」頁眉，令彈窗用返主畫面 serif + kicker + 雙線語言
    <Modal open onClose={onClose} size="md">
      {/* ───────── 週記頁眉：kicker + serif 標題 + 雙線封面分隔 ───────── */}
      <header className="-mx-5 -mt-5 mb-5 px-5 pt-5 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              <CalendarArrowDown size={12} className="shrink-0" />
              {t('cal.exportEyebrow', { defaultValue: '帶走一份 · Export' })}
            </p>
            <h2 className="mt-1 font-serif text-[22px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[26px]">
              {t('cal.exportCalendar', { defaultValue: '匯出行事曆' })}
            </h2>
          </div>
          <IconButton label={t('cal.close', { defaultValue: '關閉' })} onClick={onClose} className="-mr-1 shrink-0">
            <X size={18} />
          </IconButton>
        </div>
        <div className="mt-4 space-y-1" aria-hidden>
          <span className="block h-px bg-slate-200/90 dark:bg-slate-700/70" />
          <span className="block h-px bg-slate-200/60 dark:bg-slate-700/40" />
        </div>
      </header>

      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {t('cal.exportIntro', {
            defaultValue:
              '下載標準 iCalendar（.ics）檔，匯入 Apple / Google / Outlook 行事曆。只匯出顯示中嘅行事曆，重複事件會展開成逐次（涵蓋過去半年至未來兩年）。',
          })}
        </p>

        <div className="space-y-2.5">
          <CheckRow
            checked={withEvents}
            onToggle={() => setWithEvents((v) => !v)}
            icon={CalendarHeart}
            title={t('cal.exportEventsTitle', { defaultValue: '行事曆事件（顯示中）' })}
            count={eventCount}
          />
          <CheckRow
            checked={withCountdowns}
            onToggle={() => setWithCountdowns((v) => !v)}
            icon={Hourglass}
            title={t('cal.exportCountdownsTitle', { defaultValue: '倒數（全部）' })}
            count={countdownCount}
          />
        </div>

        {/* 匯出張單頁尾：總數 + 涵蓋範圍 + 下載 */}
        <div className="space-y-3 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              {t('cal.willExport', { defaultValue: '將匯出' })}
            </span>
            <span className="font-serif text-sm text-slate-600 dark:text-slate-300">
              <span className="text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">{total}</span> {t('cal.itemUnit', { defaultValue: '項' })}
            </span>
          </div>
          <p className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
            {t('cal.coverage', { start: rangeStart, end: rangeEnd, defaultValue: `涵蓋 ${rangeStart} → ${rangeEnd}` })}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('cal.cancel', { defaultValue: '取消' })}
            </Button>
            <Button
              icon={Download}
              onClick={doExport}
              disabled={!withEvents && !withCountdowns}
            >
              {t('cal.downloadIcs', { defaultValue: '下載 .ics' })}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
