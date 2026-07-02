import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Clock,
  LayoutGrid,
  Send,
  type LucideIcon,
} from 'lucide-react'
import { useMode } from '../context/ModeContext'
import { useSettings } from '../context/SettingsContext'
import { featuresForMode, getFeature, groupedFeatures } from '../features/registry'
import type { Feature } from '../features/types'
import type { ModeId } from '../modes/modes'
import { FeatureIcon } from '../features/featureIcons'
import { useCollection } from '../lib/store'
import {
  countdownsCol,
  cycleCalendarCol,
  tasksCol,
  timetableCol,
} from '../data/collections'
import { cycleDayForDate } from '../features/work/timetable/util'
import {
  daysBetween,
  greeting as timeGreeting,
  localKey,
  WEEKDAY_LABELS,
} from '../features/work/dashboard/util'
import PlanBadge from '../components/PlanBadge'
import { featDesc, featName, groupLabel } from '../i18n/appEn'
import { cx } from '../ui'
import { getMyAppProfile, type AppProfile } from '../lib/profile'
import { getSubjectPack, type SubjectPack } from '../data/subjects'
import { loadTopicsForSubjects, dedupeTopicsCol } from '../features/work/topicImport/applyTopics'

interface Props {
  onOpen: (id: string) => void
}

const MODE_PRIMARY_IDS: Record<ModeId, readonly string[]> = {
  work: ['work-lesson-plan', 'work-generate', 'work-tasks', 'calendar'],
  learning: ['learning-ai', 'learning-flashcards', 'learning-notes', 'calendar'],
}

const MODE_QUICK_IDS: Record<ModeId, readonly string[]> = {
  work: ['work-dashboard', 'work-ai', 'work-timetable', 'work-questions', 'work-doc-digest'],
  learning: ['learning-dashboard', 'learning-ai', 'learning-card-generator', 'learning-goals', 'calendar'],
}

const MODE_AI_IDS: Record<ModeId, readonly string[]> = {
  work: ['work-generate', 'work-lesson-plan', 'work-rubric', 'ask-data'],
  learning: ['learning-card-generator', 'learning-notes', 'learning-flashcards', 'ask-data'],
}

const ROLE_LABEL: Record<string, string> = {
  teacher: '教師',
  pre_service: '準教師',
  tutor: '導師',
  other: '其他',
}

function resolveFeatures(ids: readonly string[], mode: ModeId): Feature[] {
  return ids
    .map((id) => getFeature(id))
    .filter((f): f is Feature => f != null && f.modes.includes(mode))
}

function preferredFeatures(
  ids: readonly string[],
  mode: ModeId,
  fallback: Feature[],
  limit: number,
): Feature[] {
  const preferred = resolveFeatures(ids, mode).slice(0, limit)
  return preferred.length ? preferred : fallback.slice(0, limit)
}

export default function Home({ onOpen }: Props) {
  const { t } = useTranslation()
  const { modeDef } = useMode()
  const { displayName } = useSettings()
  const tasks = useCollection(tasksCol)
  const timetable = useCollection(timetableCol)
  const cycleCalendar = useCollection(cycleCalendarCol)
  const countdowns = useCollection(countdownsCol)

  const [profile, setProfile] = useState<AppProfile | null>(null)
  useEffect(() => {
    dedupeTopicsCol()
    let alive = true
    getMyAppProfile()
      .then((p) => {
        if (!alive) return
        setProfile(p)
        if (p) loadTopicsForSubjects(p.subjects)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const now = useMemo(() => new Date(), [])
  const todayKey = localKey(now)
  const slotDay = cycleCalendar.length
    ? cycleDayForDate(todayKey, cycleCalendar) ?? 0
    : now.getDay()
  const todayLessons = timetable
    .filter((s) => s.day === slotDay)
    .slice()
    .sort((a, b) => a.period - b.period)
  const openTasks = tasks.filter((task) => !task.done)
  const nextCountdown = countdowns
    .filter(
      (item) =>
        (item.mode == null || item.mode === 'both' || item.mode === modeDef.id) &&
        item.date >= todayKey,
    )
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const daysToNext = nextCountdown ? daysBetween(todayKey, nextCountdown.date) : null

  const allFeatures = featuresForMode(modeDef.id)
  const readyFeatures = allFeatures.filter((feature) => feature.status === 'ready')
  const groups = groupedFeatures(modeDef.id)
  const primaryFeatures = preferredFeatures(
    MODE_PRIMARY_IDS[modeDef.id],
    modeDef.id,
    readyFeatures,
    4,
  )
  const quickFeatures = preferredFeatures(MODE_QUICK_IDS[modeDef.id], modeDef.id, readyFeatures, 5)
  const aiShortcutFeatures = preferredFeatures(MODE_AI_IDS[modeDef.id], modeDef.id, readyFeatures, 4)
  const aiFeature = getFeature(modeDef.id === 'work' ? 'work-ai' : 'learning-ai')

  const roleLabel = profile?.role ? ROLE_LABEL[profile.role] : null
  const school = profile?.showSchool ? profile.school?.trim() || null : null
  const subjects = (profile?.subjects ?? [])
    .map((id) => getSubjectPack(id))
    .filter((p): p is SubjectPack => Boolean(p))
  const hasProfileMeta = Boolean(roleLabel || school || subjects.length)
  const name = displayName.trim()
  const greeting = name ? `${timeGreeting(now.getHours())}，${name}` : `${timeGreeting(now.getHours())}，老師`
  const dateLabel = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${WEEKDAY_LABELS[now.getDay()]}`
  const flowItems =
    modeDef.id === 'work'
      ? [
          {
            icon: CalendarDays,
            time: todayLessons[0] ? `第 ${todayLessons[0].period} 節` : '現在',
            title: todayLessons[0]?.subject ?? '整理今日備課',
            meta: todayLessons[0]?.room ?? '用備課 / 教案處理下一堂',
            featureId: 'work-lesson-plan',
          },
          {
            icon: CheckSquare,
            time: openTasks.length ? '待辦' : '快速',
            title: openTasks[0]?.text ?? '生成一份課堂材料',
            meta: openTasks.length ? `${openTasks.length} 件未完成` : '用教材生成由零開始',
            featureId: openTasks.length ? 'work-tasks' : 'work-generate',
          },
          {
            icon: Clock,
            time: nextCountdown && daysToNext !== null ? `${daysToNext} 日` : '稍後',
            title: nextCountdown?.title ?? '打開功能分類',
            meta: nextCountdown ? '最近倒數' : `${allFeatures.length} 項功能已整理好`,
            featureId: nextCountdown ? 'countdown' : (groups[0]?.items[0]?.id ?? readyFeatures[0]?.id),
          },
        ]
      : [
          {
            icon: CalendarDays,
            time: '現在',
            title: '整理今日筆記',
            meta: '把想法先落到個人筆記',
            featureId: 'learning-notes',
          },
          {
            icon: CheckSquare,
            time: '複習',
            title: '處理到期知識卡',
            meta: '用知識卡保持記憶節奏',
            featureId: 'learning-flashcards',
          },
          {
            icon: Clock,
            time: '稍後',
            title: '設定下一個目標',
            meta: `${allFeatures.length} 項功能已整理好`,
            featureId: 'learning-goals',
          },
        ]

  const teachingLoop =
    modeDef.id === 'work'
      ? [
          {
            step: '01',
            title: '定課題',
            meta: '教案同教學指引先成形',
            featureId: 'work-lesson-plan',
          },
          {
            step: '02',
            title: '出教材',
            meta: '工作紙、小測、簡報接住做',
            featureId: 'work-generate',
          },
          {
            step: '03',
            title: '上堂用',
            meta: '時間表同課堂工具跟住走',
            featureId: 'work-timetable',
          },
          {
            step: '04',
            title: '回饋補強',
            meta: '評分準則、弱項同補充練習',
            featureId: 'work-rubric',
          },
        ]
      : []

  const openFeature = (featureId?: string) => {
    if (!featureId) return
    onOpen(featureId)
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      <section className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xs">
        <div className="flex items-stretch">
          <div className="w-1 shrink-0 bg-accent" aria-hidden />
          <div className="min-w-0 flex-1 px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                  {t(`mode.${modeDef.id}.name`, { defaultValue: modeDef.name })} · {dateLabel}
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
                  {greeting}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  先處理今日工作，再需要時打開完整功能庫。
                </p>

                {hasProfileMeta && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {roleLabel && (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {roleLabel}
                      </span>
                    )}
                    {school && <span className="truncate">{school}</span>}
                    {subjects.length > 0 && (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <span className="text-slate-400 dark:text-slate-500">任教：</span>
                        {subjects.map((p) => (
                          <span
                            key={p.id}
                            title={p.name}
                            className="rounded-md bg-accent-soft px-1.5 py-0.5 font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
                          >
                            {p.short}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                <PlanBadge />
                <div className="flex items-baseline gap-1.5 text-slate-400 dark:text-slate-500">
                  <span className="nums text-2xl font-semibold text-slate-700 dark:text-slate-200">
                    {allFeatures.length}
                  </span>
                  <span className="text-xs">{t('shell.featuresCount', { defaultValue: '項功能' })}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric
                icon={CheckSquare}
                label="未完成待辦"
                value={openTasks.length}
                unit="件"
                hint={openTasks[0]?.text ?? '今日未有待辦壓住'}
              />
              <Metric
                icon={CalendarDays}
                label="今日課堂"
                value={todayLessons.length}
                unit="節"
                hint={todayLessons[0] ? `${todayLessons[0].subject} · 第 ${todayLessons[0].period} 節` : '今日無課堂安排'}
              />
              <Metric
                icon={Clock}
                label="最近倒數"
                value={daysToNext ?? '—'}
                unit={daysToNext === null ? undefined : '日'}
                hint={nextCountdown?.title ?? '未有即將到期事項'}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(330px,0.9fr)]">
        <section className="rounded-2xl border border-accent/20 bg-white p-4 shadow-xs dark:border-accent/25 dark:bg-slate-800 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
              <Bot size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Teaching AI
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                今日想準備咩？
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                用一句話開始，再由現有功能承接落去。
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openFeature(aiFeature?.id)}
            className="mt-4 flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3 text-left transition hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-slate-500 dark:text-slate-400">
              例如：幫我用 BAFS 市場營銷出 10 題 MC
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <Send size={15} strokeWidth={2} />
            </span>
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {aiShortcutFeatures.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => onOpen(feature.id)}
                className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-accent-soft px-2 text-xs font-semibold text-accent-strong transition hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent"
              >
                <FeatureIcon icon={feature.icon} size={14} strokeWidth={1.75} />
                <span className="truncate">{featName(t, feature)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-xs dark:bg-slate-800 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                Today Flow
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                今日流程
              </h2>
            </div>
            <button
              type="button"
              onClick={() => openFeature('calendar')}
              className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-accent/15"
            >
              排程
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {flowItems.map((item, index) => (
              <FlowRow
                key={`${item.time}-${item.title}`}
                icon={item.icon}
                time={item.time}
                title={item.title}
                meta={item.meta}
                active={index === 0}
                onClick={() => openFeature(item.featureId)}
              />
            ))}
          </div>
        </section>
      </div>

      {teachingLoop.length > 0 && (
        <section className="rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-xs dark:bg-slate-800 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Teacher-first loop
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                由備課到回饋，一位老師都開得起
              </h2>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
              先散戶 · 後科組
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {teachingLoop.map((item) => (
              <button
                key={item.step}
                type="button"
                onClick={() => openFeature(item.featureId)}
                className="group flex min-h-[112px] cursor-pointer flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] p-3 text-left transition hover:border-accent/40 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-800"
              >
                <span className="nums w-fit rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-300">
                  {item.step}
                </span>
                <span className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {item.title}
                </span>
                <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.meta}
                </span>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-accent">
                  開始
                  <ArrowRight size={13} strokeWidth={2} className="transition group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              ['教師覆核', 'AI 先出初稿，最後判斷留返畀你'],
              ['私隱先行', '避免輸入可識別學生資料'],
              ['即開即用', '不用先建立學校或科組帳戶'],
            ].map(([title, meta]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-800/60"
              >
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {meta}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              今日要做咩？
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              保留最常用入口，其餘放入分類。
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primaryFeatures.map((feature, index) => (
            <ActionCard
              key={feature.id}
              feature={feature}
              index={index + 1}
              primary={index === 0}
              onOpen={() => onOpen(feature.id)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
            快速入口
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {quickFeatures.map((feature) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => onOpen(feature.id)}
                className="group flex min-h-[76px] w-full cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 text-left transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800 dark:hover:border-accent/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                  <FeatureIcon icon={feature.icon} size={17} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {featName(t, feature)}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500 dark:text-slate-400">
                    {featDesc(t, feature)}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
                />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
            功能庫
          </h2>
          <div className="space-y-2">
            {groups.map((group) => {
              const firstFeature = group.items.find((item) => item.status === 'ready') ?? group.items[0]
              return (
                <button
                  key={group.group}
                  type="button"
                  onClick={() => openFeature(firstFeature?.id)}
                  className="flex min-h-[54px] w-full cursor-pointer items-center justify-between rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 text-left transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      <LayoutGrid size={15} strokeWidth={1.75} />
                    </span>
                    <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">
                      {groupLabel(t, group.group)}
                    </span>
                  </span>
                  <span className="ml-3 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                    {group.items.length}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  unit?: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <Icon size={16} strokeWidth={1.75} className="text-accent" />
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="nums text-2xl font-semibold text-slate-800 dark:text-slate-100">
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-slate-400">{unit}</span>}
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  )
}

function FlowRow({
  icon: Icon,
  time,
  title,
  meta,
  active,
  onClick,
}: {
  icon: LucideIcon
  time: string
  title: string
  meta: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex min-h-[66px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'border-accent/30 bg-accent-soft/70 dark:border-accent/30 dark:bg-accent/15'
          : 'border-[color:var(--border)] bg-[color:var(--surface-2)] hover:border-accent/35',
      )}
    >
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          active
            ? 'bg-accent text-white'
            : 'bg-white text-slate-400 dark:bg-slate-700 dark:text-slate-300',
        )}
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-300">
            {time}
          </span>
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
          {meta}
        </span>
      </span>
      <ChevronRight
        size={15}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </button>
  )
}

function ActionCard({
  feature,
  index,
  primary,
  onOpen,
}: {
  feature: Feature
  index: number
  primary?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'group flex min-h-[172px] w-full cursor-pointer flex-col rounded-xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        primary
          ? 'border-accent bg-accent text-white shadow-sm hover:bg-accent-strong'
          : 'border-[color:var(--border)] bg-white hover:border-accent/40 hover:shadow-sm dark:bg-slate-800 dark:hover:border-accent/40',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            primary
              ? 'bg-white/15 text-white'
              : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
          )}
        >
          <FeatureIcon icon={feature.icon} size={19} strokeWidth={1.75} />
        </span>
        <span
          className={cx(
            'nums rounded-full px-2 py-0.5 text-xs font-semibold',
            primary
              ? 'bg-white/15 text-white'
              : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-300',
          )}
        >
          {index}
        </span>
      </div>
      <h3
        className={cx(
          'mt-4 text-base font-semibold',
          primary ? 'text-white' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {featName(t, feature)}
      </h3>
      <p
        className={cx(
          'mt-1 flex-1 text-sm leading-relaxed',
          primary ? 'text-white/80' : 'text-slate-500 dark:text-slate-400',
        )}
      >
        {featDesc(t, feature)}
      </p>
      <span
        className={cx(
          'mt-4 inline-flex items-center gap-1 text-sm font-semibold',
          primary ? 'text-white' : 'text-accent',
        )}
      >
        開始
        <ArrowRight size={15} strokeWidth={2} className="transition group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
