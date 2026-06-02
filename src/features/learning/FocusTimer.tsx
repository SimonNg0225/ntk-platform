import { useMemo, useState } from 'react'
import { BarChart3, History, FolderKanban, Settings2, Flame, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../../ui'
import { useCollection } from '../../lib/store'
import {
  focusLogsCol,
  focusProjectsCol,
  focusSettingsCol,
  getSettings,
  SETTINGS_ID,
  currentStreak,
  todayKey,
  keyOf,
  fmtDuration,
} from './focus/store'
import TimerView from './focus/TimerView'
import StatsView from './focus/StatsView'
import HistoryView from './focus/HistoryView'
import ProjectsView from './focus/ProjectsView'
import SettingsView from './focus/SettingsView'
import type { FocusSettings } from './focus/types'

type TabId = 'timer' | 'stats' | 'history' | 'projects' | 'settings'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'timer', label: '計時', icon: Timer },
  { id: 'stats', label: '數據', icon: BarChart3 },
  { id: 'history', label: '紀錄', icon: History },
  { id: 'projects', label: '專案', icon: FolderKanban },
  { id: 'settings', label: '設定', icon: Settings2 },
]

export default function FocusTimer() {
  const logs = useCollection(focusLogsCol)
  const projects = useCollection(focusProjectsCol)
  const settingsAll = useCollection(focusSettingsCol)
  const settings = getSettings(settingsAll)

  const [tab, setTab] = useState<TabId>('timer')

  function patchSettings(patch: Partial<FocusSettings>) {
    focusSettingsCol.update(SETTINGS_ID, patch)
  }

  // header 小統計
  const { todayMin, todaySessions, streak } = useMemo(() => {
    const tk = todayKey()
    const todayFocus = logs.filter(
      (l) => l.kind === 'focus' && l.completed && keyOf(l.startedAt) === tk,
    )
    return {
      todayMin: todayFocus.reduce((s, l) => s + l.actualMin, 0),
      todaySessions: todayFocus.length,
      streak: currentStreak(logs),
    }
  }, [logs])

  const onTimer = tab === 'timer'

  return (
    <div className="space-y-8">
      {/* ── 靜謐 masthead：置中、留白、似一頁禪修扉頁 ── */}
      <header className="flex flex-col items-center pt-1 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
          專注時刻
        </p>
        <h1 className="mt-2.5 font-serif text-[28px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[34px]">
          靜下來，做一件事
        </h1>
        {/* 今日節奏：一句溫和摘要，唔用搶眼 badge */}
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
          {todaySessions > 0 ? (
            <span className="tabular-nums">
              今日已完成{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {todaySessions}
              </span>{' '}
              節 · {fmtDuration(todayMin)}
            </span>
          ) : (
            <span>準備好就由一節開始</span>
          )}
          {streak > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Flame size={13} className="shrink-0" />
                <span className="tabular-nums">連續 {streak} 日</span>
              </span>
            </>
          )}
        </p>
      </header>

      {/* ── 安靜索引：底線式 tab，唔搶計時盤風頭 ── */}
      <nav
        aria-label="專注番茄鐘分頁"
        className="-mx-1 overflow-x-auto"
      >
        <div className="mx-auto flex w-max min-w-full items-center justify-center gap-1 border-b border-slate-200/70 px-1 dark:border-slate-700/50">
          {TABS.map((t) => {
            const on = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className={cx(
                  'group relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
                  on
                    ? 'text-accent-strong dark:text-accent'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
                )}
              >
                <Icon size={15} className="shrink-0" />
                {t.label}
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all duration-300',
                    on ? 'bg-accent opacity-100' : 'bg-transparent opacity-0',
                  )}
                />
              </button>
            )
          })}
        </div>
      </nav>

      {/* 計時盤要大量留白；其餘數據頁回到常規節奏 */}
      <div className={cx('animate-fade-in', onTimer && 'pb-6 pt-2 sm:pt-6')}>
        {tab === 'timer' && (
          <TimerView
            settings={settings}
            logs={logs}
            projects={projects}
            patchSettings={patchSettings}
          />
        )}
        {tab === 'stats' && <StatsView logs={logs} projects={projects} />}
        {tab === 'history' && <HistoryView logs={logs} projects={projects} />}
        {tab === 'projects' && <ProjectsView projects={projects} logs={logs} />}
        {tab === 'settings' && <SettingsView settings={settings} patch={patchSettings} />}
      </div>
    </div>
  )
}
