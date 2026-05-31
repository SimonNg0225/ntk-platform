import { useMemo, useState } from 'react'
import { Timer, BarChart3, History, FolderKanban, Settings2, Flame, Target } from 'lucide-react'
import { PageHeader, Tabs, Badge } from '../../ui'
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

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Timer}
        title="專注番茄鐘"
        description="番茄工作法 · 專案分類 · 深度數據分析"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="accent" icon={Target}>
              今日 {todaySessions} 節 · {fmtDuration(todayMin)}
            </Badge>
            {streak > 0 && (
              <Badge tone="amber" icon={Flame}>
                連續 {streak} 日
              </Badge>
            )}
          </div>
        }
      />

      <Tabs<TabId>
        active={tab}
        onChange={setTab}
        icons={{
          timer: Timer,
          stats: BarChart3,
          history: History,
          projects: FolderKanban,
          settings: Settings2,
        }}
        tabs={[
          { id: 'timer', label: '計時' },
          { id: 'stats', label: '數據' },
          { id: 'history', label: '紀錄' },
          { id: 'projects', label: '專案' },
          { id: 'settings', label: '設定' },
        ]}
      />

      <div className="animate-fade-in">
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
