import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, History, FolderKanban, Settings2, Flame, Timer } from 'lucide-react'
import { cx, PageHero, FeatureGuide, type FeatureGuideStep } from '../../ui'
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

export default function FocusTimer() {
  const { t } = useTranslation()
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

  const tabs: { id: TabId; label: string }[] = [
    { id: 'timer', label: t('focus.tabTimer', { defaultValue: '計時' }) },
    { id: 'stats', label: t('focus.tabStats', { defaultValue: '數據' }) },
    { id: 'history', label: t('focus.tabHistory', { defaultValue: '紀錄' }) },
    { id: 'projects', label: t('focus.tabProjects', { defaultValue: '專案' }) },
    { id: 'settings', label: t('focus.tabSettings', { defaultValue: '設定' }) },
  ]

  const guideSteps: FeatureGuideStep[] = [
    {
      title: t('focus.guide1Title', { defaultValue: '揀時長同事項' }),
      desc: t('focus.guide1Desc', {
        defaultValue: '喺「計時」揀番專注時長，想記錄做緊邊樣就揀返專案。',
      }),
    },
    {
      title: t('focus.guide2Title', { defaultValue: '開始專注' }),
      desc: t('focus.guide2Desc', {
        defaultValue: '撳開始，期間放低手機；完成一節會自動入「紀錄」。',
      }),
    },
    {
      title: t('focus.guide3Title', { defaultValue: '休息再開' }),
      desc: t('focus.guide3Desc', {
        defaultValue: '一節完會提你小休，循環幾節之後就有長休。',
      }),
    },
    {
      title: t('focus.guide4Title', { defaultValue: '睇返成果' }),
      desc: t('focus.guide4Desc', {
        defaultValue: '去「數據」睇專注趨勢同連續日，保持節奏。',
      }),
    },
  ]

  const onTimer = tab === 'timer'

  const tabIcons: Record<TabId, typeof Timer> = {
    timer: Timer,
    stats: BarChart3,
    history: History,
    projects: FolderKanban,
    settings: Settings2,
  }

  // 今日狀態副題（原 masthead 副題搬入 hero description）
  const heroDesc =
    todaySessions > 0
      ? t('focus.todayDone', {
          n: todaySessions,
          dur: fmtDuration(todayMin),
          defaultValue: `今日已完成 ${todaySessions} 節 · ${fmtDuration(todayMin)}`,
        })
      : t('focus.todayStart', { defaultValue: '準備好就由一節開始' })

  return (
    <div className="w-full space-y-5 p-4">
      {/* ───────── 共用 PageHero（accent hero）：icon + 標題 + 今日狀態 + 連續日 + 分頁 ───────── */}
      <PageHero
        guideKey="focus-timer"
        icon={Timer}
        kicker={t('focus.kicker', { defaultValue: '學習成長 · 深度專注' })}
        title={t('focus.title', { defaultValue: '專注計時器' })}
        description={heroDesc}
        actions={
          streak > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Flame size={13} className="shrink-0" />
              <span className="tabular-nums slashed-zero">
                {t('focus.streakDays', {
                  n: streak,
                  defaultValue: `連續 ${streak} 日`,
                })}
              </span>
            </span>
          ) : undefined
        }
        tabs={tabs.map((tb) => {
          const I = tabIcons[tb.id]
          const on = tab === tb.id
          return (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              aria-pressed={on}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                on
                  ? 'bg-white font-semibold text-accent-strong'
                  : 'bg-white/15 text-white hover:bg-white/25',
              )}
            >
              <I size={14} />
              {tb.label}
            </button>
          )
        })}
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="focus-timer"
        title={t('focus.guideTitle', { defaultValue: '專注計時器點用？' })}
        steps={guideSteps}
      />

      {/* 計時盤要多啲留白；其餘數據頁回到常規節奏 */}
      <div className={cx('animate-fade-in', onTimer && 'pt-1 sm:pt-3')}>
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
