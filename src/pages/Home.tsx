import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Highlighter,
  Inbox,
  Mic,
  Search,
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
  inboxCol,
  lessonPlansCol,
  meetingNotesCol,
  papersCol,
  questionsCol,
  resourcesCol,
  tasksCol,
  timetableCol,
} from '../data/collections'
import { cycleDayForDate } from '../features/work/timetable/util'
import {
  daysBetween,
  greeting as timeGreeting,
  localKey,
} from '../features/work/dashboard/util'
import { featDesc, featName } from '../i18n/appEn'
import { cx } from '../ui'
import { getMyAppProfile, type AppProfile } from '../lib/profile'
import { getSubjectPack, type SubjectPack } from '../data/subjects'
import { loadTopicsForSubjects, dedupeTopicsCol } from '../features/work/topicImport/applyTopics'
import { useToast } from '../context/ToastContext'
import { writeAiHandoff } from '../features/shared/aiAssistant/handoff'
import { writeComposerHandoff } from '../features/shared/composerHandoff'
import { inferLearningComposerRoute, inferWorkToolRoute } from './homeRouting'
import { track, trackOnce } from '../lib/observability'
import type { AppNavParams } from '../context/NavContext'
import { classroomPacksCol } from '../features/work/classroomPack/store'
import { slideDecksCol } from '../features/work/slides/slideStore'

interface Props {
  onOpen: (id: string, params?: AppNavParams) => void
}

const MODE_QUICK_IDS: Record<ModeId, readonly string[]> = {
  work: [
    'work-dashboard',
    'work-prompt-library',
    'work-timetable',
    'work-questions',
    'work-doc-digest',
  ],
  learning: ['learning-dashboard', 'learning-ai', 'learning-card-generator', 'learning-goals', 'calendar'],
}

type TaskFlow = {
  id: string
  title: string
  desc: string
  prompt: string
  outcome: string
  steps: string[]
  icon: LucideIcon
}

type RecentWork = {
  id: string
  featureId: string
  title: string
  meta: string
  createdAt: string
  icon: LucideIcon
  resume?: AppNavParams
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
  const { modeDef } = useMode()
  const { displayName } = useSettings()
  const toast = useToast()
  const tasks = useCollection(tasksCol)
  const timetable = useCollection(timetableCol)
  const cycleCalendar = useCollection(cycleCalendarCol)
  const countdowns = useCollection(countdownsCol)
  const inboxItems = useCollection(inboxCol)
  const lessonPlans = useCollection(lessonPlansCol)
  const questions = useCollection(questionsCol)
  const resources = useCollection(resourcesCol)
  const meetingNotes = useCollection(meetingNotesCol)
  const papers = useCollection(papersCol)
  const classroomPacks = useCollection(classroomPacksCol)
  const slideDecks = useCollection(slideDecksCol)
  const [lessonTopic, setLessonTopic] = useState(() => {
    try {
      return localStorage.getItem('eziteach.nextLessonTopic') ?? ''
    } catch {
      return ''
    }
  })

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
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-HK', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(now),
    [now],
  )
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
  const quickFeatures = preferredFeatures(MODE_QUICK_IDS[modeDef.id], modeDef.id, readyFeatures, 5)
  const aiFeature = getFeature(modeDef.id === 'work' ? 'work-ai' : 'learning-ai')
  const isWorkMode = modeDef.id === 'work'

  const subjects = (profile?.subjects ?? [])
    .map((id) => getSubjectPack(id))
    .filter((p): p is SubjectPack => Boolean(p))
  const topicSuggestion =
    todayLessons[0]?.subject || subjects[0]?.name || subjects[0]?.short || 'DSE 課題'
  const taskFlows: TaskFlow[] = isWorkMode
      ? [
        {
          id: 'classroom-pack',
          title: '建立課堂套裝',
          desc: '一次建立互相一致的教案、工作紙及簡報。',
          prompt: `為「${topicSuggestion}」建立課堂套裝，包括教案、工作紙及簡報`,
          outcome: '教案＋工作紙＋簡報',
          steps: ['教案', '工作紙', '簡報'],
          icon: ClipboardList,
        },
        {
          id: 'assessment',
          title: '出工作紙 / 小測',
          desc: '生成工作紙、小測、答案和評分準則。',
          prompt: `生成一份「${topicSuggestion}」工作紙，連答案和評分準則`,
          outcome: '題目＋答案',
          steps: ['工作紙', '題庫', '評分'],
          icon: FileText,
        },
        {
          id: 'grades',
          title: '分析成績',
          desc: '找出班級弱項、預測等級和安排跟進。',
          prompt: '分析今次測驗成績、預測等級和找出弱項',
          outcome: '弱項＋跟進',
          steps: ['分析', '預測', '跟進'],
          icon: BookOpenCheck,
        },
        {
          id: 'admin',
          title: '整理行政文件',
          desc: '把通告、報告和會議文件變成重點與待辦。',
          prompt: '把這份行政文件摘要成重點和待辦',
          outcome: '摘要＋待辦',
          steps: ['摘要', '行動', '存檔'],
          icon: ClipboardList,
        },
      ]
    : [
        {
          id: 'organise',
          title: '整理筆記',
          desc: '把今日內容整理成重點和問題。',
          prompt: '幫我整理今日筆記重點',
          outcome: '筆記重點',
          steps: ['整理', '提問', '保存'],
          icon: ClipboardList,
        },
        {
          id: 'cards',
          title: '生成知識卡',
          desc: '把內容變成可複習的卡片。',
          prompt: '把這段內容變成知識卡',
          outcome: '知識卡',
          steps: ['生成', '複習', '記憶'],
          icon: BookOpenCheck,
        },
        {
          id: 'plan',
          title: '安排學習',
          desc: '拆解目標和下一步學習節奏。',
          prompt: '設計一個 25 分鐘溫習計劃',
          outcome: '學習計劃',
          steps: ['目標', '時間', '行動'],
          icon: Clock,
        },
        {
          id: 'find',
          title: '找回資料',
          desc: '搜尋自己的筆記、日程和知識卡。',
          prompt: '搜尋我最近整理過的筆記',
          outcome: '資料定位',
          steps: ['搜尋', '問資料', '回顧'],
          icon: Search,
        },
      ]
  const recentWorkItems = useMemo<RecentWork[]>(() => {
    const rows: RecentWork[] = [
      ...classroomPacks.map((item) => ({
        id: `pack-${item.id}`,
        featureId: 'work-classroom-pack',
        title: item.topic || '未命名課堂套裝',
        meta: `課堂套裝 · ${item.reviewedOutputs.length}/3 已覆核`,
        createdAt: item.updatedAt,
        icon: ClipboardList,
        resume: { item: item.id },
      })),
      ...lessonPlans.map((item) => ({
        id: `lesson-${item.id}`,
        featureId: 'work-lesson-plan',
        title: item.title || '未命名教案',
        meta: '教案 · 待覆核',
        createdAt: item.createdAt,
        icon: ClipboardList,
        resume: { item: item.id },
      })),
      ...papers.map((item) => ({
        id: `paper-${item.id}`,
        featureId: 'work-questions',
        title: item.title || '未命名試卷',
        meta: `${item.questionIds.length} 題 · 試卷`,
        createdAt: item.createdAt,
        icon: FileText,
        resume: { view: 'paper', item: item.id },
      })),
      ...questions.map((item) => ({
        id: `question-${item.id}`,
        featureId: 'work-questions',
        title: item.stem || '未命名題目',
        meta: `${item.type.toUpperCase()} · 題庫`,
        createdAt: item.createdAt,
        icon: FileText,
        resume: { view: 'question', item: item.id },
      })),
      ...resources.map((item) => ({
        id: `resource-${item.id}`,
        featureId: 'work-resources',
        title: item.title || '未命名資源',
        meta: '資源庫 · 可重用',
        createdAt: item.createdAt,
        icon: Search,
        resume: { item: item.id },
      })),
      ...meetingNotes.map((item) => ({
        id: `meeting-${item.id}`,
        featureId: 'work-meeting-notes',
        title: item.title || '未命名會議',
        meta: '會議記錄 · 跟進',
        createdAt: item.createdAt,
        icon: ClipboardList,
        resume: { item: item.id },
      })),
      ...slideDecks.map((item) => ({
        id: `slides-${item.id}`,
        featureId: 'work-slides',
        title: item.title || '未命名簡報',
        meta: `${item.slides.length} 頁 · 簡報`,
        createdAt: item.createdAt,
        icon: FileText,
        resume: { item: item.id },
      })),
      ...inboxItems
        .filter((item) => item.mode === 'work')
        .map((item) => ({
          id: `inbox-${item.id}`,
          featureId: 'inbox',
          title: item.text,
          meta: '快速擷取 · 待整理',
          createdAt: item.createdAt,
          icon: Highlighter,
        })),
    ]
    return rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
  }, [classroomPacks, inboxItems, lessonPlans, meetingNotes, papers, questions, resources, slideDecks])
  const name = displayName.trim()
  const greeting = name ? `${timeGreeting(now.getHours())}，${name}` : `${timeGreeting(now.getHours())}，老師`
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

  const composerPlaceholder = isWorkMode
    ? '輸入問題或任務，直接開始對話'
    : '輸入內容、目標、搜尋或資料問題'

  useEffect(() => {
    try {
      const value = lessonTopic.trim()
      if (value) localStorage.setItem('eziteach.nextLessonTopic', value)
      else localStorage.removeItem('eziteach.nextLessonTopic')
    } catch {
      /* ignore */
    }
  }, [lessonTopic])

  const openFeature = (featureId?: string, params?: AppNavParams) => {
    if (!featureId) return
    onOpen(featureId, params)
  }

  const dispatchComposerPrompt = (
    input?: string,
    source: 'composer' | 'shortcut' = 'composer',
  ) => {
    const raw = (input ?? lessonTopic).trim()
    if (isWorkMode) {
      const taskText = raw || `幫我準備「${topicSuggestion}」一堂課`
      const route = inferWorkToolRoute(raw)
      if (route) {
        track('home_task_submitted', {
          source,
          destination: route.featureId,
          route_kind: 'tool',
          has_input: Boolean(raw),
        })
        trackOnce('activation_task_started', {
          source,
          destination: route.featureId,
        })
        writeComposerHandoff({
          featureId: route.featureId,
          text: route.handoffText ?? taskText,
          materialTool: route.materialTool,
        })
        toast.success(`已按內容打開「${route.label}」`)
        onOpen(route.featureId)
        return
      }
      track('home_task_submitted', {
        source,
        destination: 'work-ai',
        route_kind: 'assistant',
        has_input: Boolean(raw),
      })
      trackOnce('activation_task_started', {
        source,
        destination: 'work-ai',
      })
      writeAiHandoff('work', taskText, { autoSend: true })
      toast.success('正在開始教學助手對話')
      onOpen('work-ai')
      return
    }

    const prompt = raw || '幫我整理今日筆記重點，列出要記住的概念、可測自己的問題，以及下一步學習安排。'
    const route = inferLearningComposerRoute(raw)
    track('home_task_submitted', {
      source,
      destination: route.featureId,
      route_kind: route.featureId === 'learning-ai' ? 'assistant' : 'tool',
      has_input: Boolean(raw),
    })
    trackOnce('activation_task_started', {
      source,
      destination: route.featureId,
    })
    if (route.featureId === 'learning-ai') {
      writeAiHandoff('learning', prompt)
      toast.success('已帶入 AI 助手')
    } else {
      writeComposerHandoff({ featureId: route.featureId, text: route.handoffText ?? prompt })
      toast.success(`已按內容打開「${route.label}」`)
    }
    onOpen(route.featureId || aiFeature?.id || 'learning-ai')
  }

  const askTeachingAi = () => {
    dispatchComposerPrompt()
  }

  const startTaskFlow = (flow: TaskFlow) => {
    setLessonTopic(flow.prompt)
    dispatchComposerPrompt(flow.prompt, 'shortcut')
  }

  return (
    <div className="-mx-4 -my-5 sm:-mx-6 sm:-my-6 lg:-mx-8">
      <section className="border-b border-slate-200/80 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1180px] py-6 sm:py-8">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              <CalendarDays size={16} strokeWidth={1.8} />
              {todayLabel}
            </p>
            <h1 className="mt-2 max-w-4xl text-[30px] font-semibold leading-[1.15] text-slate-950 sm:text-[34px] lg:text-[36px] dark:text-white">
              {isWorkMode ? '今日想先完成什麼？' : '今日想整理什麼？'}
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-6 text-slate-600 dark:text-slate-300">
              {greeting}。由課題開始，或選一個常用任務。
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                askTeachingAi()
              }}
              className="mt-5 w-full rounded-[18px] bg-white p-1 shadow-sm ring-1 ring-slate-200/90 focus-within:ring-2 focus-within:ring-accent/35 dark:bg-slate-900 dark:ring-slate-700/80"
            >
              <label htmlFor="home-ai-composer" className="sr-only">
                {isWorkMode ? '輸入課題或教學任務' : '輸入學習內容或問題'}
              </label>
              <div className="flex min-h-[62px] items-center gap-1.5 rounded-[17px] border border-slate-100 bg-white p-2 text-left dark:border-slate-700/70 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => onOpen('inbox')}
                  aria-label="打開快速擷取"
                  title="快速擷取"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Inbox size={20} strokeWidth={1.8} />
                </button>
                <input
                  id="home-ai-composer"
                  value={lessonTopic}
                  onChange={(event) => setLessonTopic(event.target.value)}
                  placeholder={composerPlaceholder}
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => onOpen(isWorkMode ? 'work-voice-assistant' : aiFeature?.id ?? 'learning-ai')}
                  aria-label={isWorkMode ? '打開語音助手' : '打開語音輸入'}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Mic size={20} strokeWidth={1.9} />
                </button>
                <button
                  type="submit"
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="按內容開始處理"
                >
                  <Send size={19} strokeWidth={2.1} />
                </button>
              </div>
            </form>

            <div className="mt-4 grid w-full gap-2 text-left sm:grid-cols-2 lg:grid-cols-4">
              {taskFlows.map((flow) => (
                <HeroTaskShortcut
                  key={flow.id}
                  flow={flow}
                  onStart={() => startTaskFlow(flow)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1420px] space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-accent">
                今日
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                今日重點
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                只保留現在最有用的三件事，其他工具需要時才打開。
              </p>
            </div>
            <button
              type="button"
              onClick={() => openFeature('calendar')}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-accent/35 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800 dark:text-slate-300"
            >
              排程
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="grid divide-y divide-slate-200/80 overflow-hidden rounded-[16px] bg-white shadow-xs ring-1 ring-inset ring-slate-200/80 dark:divide-slate-700/70 dark:bg-slate-800 dark:ring-slate-700/70 md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-slate-200/80 dark:md:divide-slate-700/70">
            {flowItems.map((item, index) => (
              <FocusCard
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

        <div
          className={cx(
            'grid gap-6 border-t border-slate-200/80 pt-5 dark:border-slate-800',
            recentWorkItems.length > 0 &&
              'lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]',
          )}
        >
          {recentWorkItems.length > 0 && (
            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-accent">
                    最近
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    繼續上次工作
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    直接接回上次的教案、題目和記錄。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openFeature('search')}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-accent/35 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800 dark:text-slate-300"
                >
                  查看全部
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {recentWorkItems.map((item) => (
                  <RecentWorkRow
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      track('recent_work_opened', {
                        feature_id: item.featureId,
                        item_kind: item.id.split('-')[0],
                      })
                      openFeature(item.featureId, item.resume)
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                其他
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                更多工具
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                低頻工具收在這裡，需要時才打開。
              </p>
            </div>
            <div
              className={cx(
                'grid gap-2',
                recentWorkItems.length === 0 && 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {quickFeatures.map((feature) => (
                <ToolShelfRow
                  key={feature.id}
                  feature={feature}
                  onOpen={() => onOpen(feature.id)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function HeroTaskShortcut({
  flow,
  onStart,
}: {
  flow: TaskFlow
  onStart: () => void
}) {
  const Icon = flow.icon
  return (
    <button
      type="button"
      onClick={onStart}
      className="group flex min-h-[80px] w-full cursor-pointer items-center gap-3 rounded-[14px] bg-slate-50/90 p-3 text-left transition duration-150 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {flow.title}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {flow.outcome}
        </span>
      </span>
      <ArrowRight
        size={15}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
        strokeWidth={2}
      />
    </button>
  )
}

function RecentWorkRow({
  item,
  onOpen,
}: {
  item: RecentWork
  onOpen: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[64px] w-full cursor-pointer items-center gap-3 rounded-[13px] bg-white px-3.5 py-3 text-left shadow-xs transition hover:bg-[color:var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {item.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
          {item.meta} · {formatShortDate(item.createdAt)}
        </span>
      </span>
      <ChevronRight
        size={16}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </button>
  )
}

function ToolShelfRow({
  feature,
  onOpen,
}: {
  feature: Feature
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[68px] w-full cursor-pointer items-center gap-3 rounded-[13px] bg-white px-3.5 py-3 text-left shadow-xs transition hover:bg-[color:var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
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
        className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </button>
  )
}

function FocusCard({
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
        'group flex min-h-[104px] w-full cursor-pointer items-center gap-3 px-4 py-4 text-left transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40',
        active
          ? 'bg-accent-soft/60 hover:bg-accent-soft dark:bg-accent/15'
          : 'bg-white hover:bg-[color:var(--surface-2)] dark:bg-slate-800',
      )}
    >
      <span
        className={cx(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]',
          active
            ? 'bg-accent text-white'
            : 'bg-[color:var(--surface-2)] text-slate-400 dark:text-slate-300',
        )}
      >
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          {time}
        </span>
        <span className="mt-1 block truncate text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </span>
        <span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">
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

function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '剛剛'
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 864e5)
  if (diffDays <= 0) return '今日'
  if (diffDays === 1) return '昨日'
  if (diffDays < 7) return `${diffDays} 日前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}
