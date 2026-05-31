import {
  Brain,
  Coffee,
  RefreshCw,
  Bell,
  Target,
  Play,
  Volume2,
} from 'lucide-react'
import { Field, Input, SectionTitle, cx } from '../../../ui'
import type { FocusSettings } from './types'
import { DEFAULT_SETTINGS } from './types'

export default function SettingsView({
  settings,
  patch,
}: {
  settings: FocusSettings
  patch: (p: Partial<FocusSettings>) => void
}) {
  const num = (key: keyof FocusSettings, min: number, max: number) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={settings[key] as number}
      onChange={(e) =>
        patch({ [key]: Math.min(max, Math.max(min, Number(e.target.value) || min)) })
      }
    />
  )

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* 時長 */}
      <section>
        <SectionTitle icon={Brain}>時長設定</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="專注（分）">{num('focusMin', 1, 180)}</Field>
          <Field label="短休息">{num('shortBreakMin', 1, 60)}</Field>
          <Field label="長休息">{num('longBreakMin', 1, 60)}</Field>
          <Field label="長休息間隔">{num('longBreakEvery', 2, 12)}</Field>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Coffee size={13} />
          每完成 {settings.longBreakEvery} 節專注 → 一次長休息
        </p>
      </section>

      {/* 目標 */}
      <section>
        <SectionTitle icon={Target}>每日目標</SectionTitle>
        <Field label="目標番茄數（0 = 不設）" hint="計時器頁會顯示今日進度條">
          {num('dailyGoal', 0, 30)}
        </Field>
      </section>

      {/* 自動化 */}
      <section>
        <SectionTitle icon={RefreshCw}>自動化</SectionTitle>
        <div className="space-y-2">
          <Toggle
            icon={Play}
            label="自動開始休息"
            desc="專注完成後即刻開始休息倒數"
            on={settings.autoStartBreaks}
            onChange={(v) => patch({ autoStartBreaks: v })}
          />
          <Toggle
            icon={Play}
            label="自動開始下一節專注"
            desc="休息完成後即刻開始專注"
            on={settings.autoStartFocus}
            onChange={(v) => patch({ autoStartFocus: v })}
          />
        </div>
      </section>

      {/* 聲音 */}
      <section>
        <SectionTitle icon={Bell}>提示音</SectionTitle>
        <div className="space-y-2">
          <Toggle
            icon={Bell}
            label="完成鈴聲"
            desc="一節結束時播放提示音"
            on={settings.chimeSound}
            onChange={(v) => patch({ chimeSound: v })}
          />
          <Toggle
            icon={Volume2}
            label="滴答聲"
            desc="專注期間每秒輕微滴答（提升臨場感）"
            on={settings.tickSound}
            onChange={(v) => patch({ tickSound: v })}
          />
        </div>
      </section>

      {/* 重設 */}
      <button
        onClick={() => patch({ ...DEFAULT_SETTINGS })}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-accent"
      >
        <RefreshCw size={13} />
        還原預設設定
      </button>
    </div>
  )
}

function Toggle({
  icon: I,
  label,
  desc,
  on,
  onChange,
}: {
  icon: typeof Bell
  label: string
  desc: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
    >
      <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent' : 'bg-slate-100 text-slate-400 dark:bg-slate-700')}>
        <I size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
      <span
        className={cx(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
          on ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-600',
        )}
      >
        <span
          className={cx(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
            on ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}
