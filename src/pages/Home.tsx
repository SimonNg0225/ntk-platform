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
  LayoutGrid,
  Mic,
  Plus,
  Presentation,
  Send,
  Sparkles,
  WandSparkles,
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
import { useToast } from '../context/ToastContext'
import { patchMeta } from '../features/shared/inbox/store'
import type { InboxKind } from '../features/shared/inbox/types'
import { writeAiHandoff } from '../features/shared/aiAssistant/handoff'
import {
  writeComposerHandoff,
  type ComposerMaterialTool,
} from '../features/shared/composerHandoff'

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

const ROLE_LABEL: Record<string, string> = {
  teacher: '教師',
  pre_service: '準教師',
  tutor: '導師',
  other: '其他',
}

const LESSON_PACKS: {
  title: string
  desc: string
  featureId: string
  capturePrefix: string
  kind: InboxKind
  icon: LucideIcon
}[] = [
  {
    title: '明天上課包',
    desc: '教案、教學重點、課堂活動',
    featureId: 'work-lesson-plan',
    capturePrefix: '準備下一堂',
    kind: 'task',
    icon: ClipboardList,
  },
  {
    title: '10 分鐘小測包',
    desc: '題目、答案、評分點一次起稿',
    featureId: 'work-generate',
    capturePrefix: '出一份小測',
    kind: 'question',
    icon: FileText,
  },
  {
    title: '簡報包',
    desc: '由課題生成 PowerPoint 初稿',
    featureId: 'work-slides',
    capturePrefix: '製作教學簡報',
    kind: 'reference',
    icon: Presentation,
  },
  {
    title: '課後回饋包',
    desc: '評分準則、弱項、補充練習',
    featureId: 'work-rubric',
    capturePrefix: '整理課後回饋',
    kind: 'task',
    icon: Highlighter,
  },
]

type ComposerRoute = {
  featureId: string
  label: string
  materialTool?: ComposerMaterialTool
}

const hasIntent = (text: string, patterns: readonly RegExp[]) => patterns.some((re) => re.test(text))

function inferMaterialTool(text: string): ComposerMaterialTool {
  if (hasIntent(text, [/試卷|組卷|mock|paper|卷[一二三四1-4]?/i])) return 'paper'
  if (hasIntent(text, [/工作紙|練習|worksheet|exercise|小測|測驗|quiz|test/i])) return 'worksheet'
  if (hasIntent(text, [/mc|選擇題|multiple choice/i])) return 'mc'
  if (hasIntent(text, [/短答|short/i])) return 'short'
  if (hasIntent(text, [/個案|case study|case/i])) return 'case'
  if (hasIntent(text, [/長題|結構式|long/i])) return 'long'
  return 'worksheet'
}

function inferWorkComposerRoute(input: string): ComposerRoute {
  const text = input.trim().toLowerCase()
  if (!text) return { featureId: 'work-lesson-plan', label: '備課 / 教案' }

  if (hasIntent(text, [/錄音|轉文字|逐字稿|transcrib|audio|聲音|mp3|m4a/i])) {
    return { featureId: 'work-transcribe', label: '錄音轉文字' }
  }
  if (hasIntent(text, [/掃描|影低|影相|相片|scan|拍照|pdf\s*掃描/i])) {
    return { featureId: 'work-scan', label: '掃描 PDF' }
  }
  if (hasIntent(text, [/簡報|powerpoint|ppt|投影片|slide|deck|presentation/i])) {
    return { featureId: 'work-slides', label: '簡報工作室' }
  }
  if (
    hasIntent(text, [
      /生成|出題|題目|工作紙|練習|小測|測驗|quiz|test|試卷|組卷|mc|選擇題|短答|長題|個案|case|dse\s*風格/i,
    ])
  ) {
    return { featureId: 'work-generate', label: '教材生成', materialTool: inferMaterialTool(text) }
  }
  if (hasIntent(text, [/評分準則|rubric|marking|評分點|參考答案|量表|評語|回饋/i])) {
    return { featureId: 'work-rubric', label: '評分準則' }
  }
  if (hasIntent(text, [/會議|meeting|議程|minutes|決議|會議記錄|會議紀錄|跟進清單/i])) {
    return { featureId: 'work-meeting-notes', label: '會議筆記' }
  }
  if (hasIntent(text, [/時間表|課表|行事曆|日程|排程|calendar|schedule/i])) {
    return { featureId: 'calendar', label: '行事曆' }
  }
  if (hasIntent(text, [/文件速讀|通告|摘要|撮要|歸納|行政文件|pdf|docx|word|表格|document/i])) {
    return { featureId: 'work-doc-digest', label: '文件速讀' }
  }
  if (hasIntent(text, [/觀課|評課|聽課|observation/i])) {
    return { featureId: 'work-observation', label: '觀課 / 評課' }
  }
  if (hasIntent(text, [/週報|周報|工作報告|報告|總結本週|weekly report/i])) {
    return { featureId: 'work-report', label: '工作週報' }
  }
  if (hasIntent(text, [/課程指引|syllabus|curriculum|課題匯入|課綱/i])) {
    return { featureId: 'work-topic-import', label: '課題匯入' }
  }
  if (hasIntent(text, [/資源庫|收藏|教材連結|存檔|resource|library/i])) {
    return { featureId: 'work-resources', label: '教學資源庫' }
  }
  if (hasIntent(text, [/批改|待辦|todo|功課|作業|改卷|行政事項|跟進/i])) {
    return { featureId: 'work-tasks', label: '待辦 / 批改' }
  }
  if (hasIntent(text, [/點教|教學指引|教學步驟|常見誤解|差異化|引導|提問/i])) {
    return { featureId: 'work-teach-guide', label: '教學指引' }
  }
  if (hasIntent(text, [/教案|備課|下一堂|一堂|課堂|lesson|教學目標|教學活動|分鐘課|40\s*分鐘/i])) {
    return { featureId: 'work-lesson-plan', label: '備課 / 教案' }
  }
  if (hasIntent(text, [/dse|公開試|文憑試|操練|drill/i])) {
    return { featureId: 'work-dse', label: 'DSE 操練' }
  }

  return { featureId: 'work-ai', label: '教學 AI' }
}

function inferLearningComposerRoute(input: string): ComposerRoute {
  const text = input.trim().toLowerCase()
  if (!text) return { featureId: 'learning-ai', label: '個人 AI 助手' }
  if (hasIntent(text, [/知識卡|flashcard|卡片|溫習卡/i])) {
    return { featureId: 'learning-card-generator', label: 'AI 生成知識卡' }
  }
  if (hasIntent(text, [/筆記|整理|總結|note|notes/i])) {
    return { featureId: 'learning-notes', label: '個人筆記' }
  }
  if (hasIntent(text, [/複習|溫習|到期|記憶|srs|flashcard/i])) {
    return { featureId: 'learning-flashcards', label: '知識卡 + 複習' }
  }
  if (hasIntent(text, [/目標|計劃|plan|下一步|goal/i])) {
    return { featureId: 'learning-goals', label: '個人目標' }
  }
  return { featureId: 'learning-ai', label: '個人 AI 助手' }
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
  const toast = useToast()
  const tasks = useCollection(tasksCol)
  const timetable = useCollection(timetableCol)
  const cycleCalendar = useCollection(cycleCalendarCol)
  const countdowns = useCollection(countdownsCol)
  const inboxItems = useCollection(inboxCol)
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
  const aiFeature = getFeature(modeDef.id === 'work' ? 'work-ai' : 'learning-ai')
  const isWorkMode = modeDef.id === 'work'

  const roleLabel = profile?.role ? ROLE_LABEL[profile.role] : null
  const school = profile?.showSchool ? profile.school?.trim() || null : null
  const subjects = (profile?.subjects ?? [])
    .map((id) => getSubjectPack(id))
    .filter((p): p is SubjectPack => Boolean(p))
  const topicSuggestion =
    todayLessons[0]?.subject || subjects[0]?.name || subjects[0]?.short || '市場營銷'
  const nextLessonCaptures = useMemo(
    () =>
      inboxItems
        .filter(
          (item) =>
            item.mode === 'work' &&
            item.text.includes('#下一堂課'),
        )
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 2),
    [inboxItems],
  )
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

  const composerPlaceholder = isWorkMode
    ? '輸入課題或任務'
    : '輸入想整理的內容、目標或問題'
  const composerSuggestions = isWorkMode
    ? [
        `幫我準備「${topicSuggestion}」一堂 40 分鐘課`,
        '生成一份 DSE 風格工作紙',
        '整理學生常見誤解同提問',
        '把會議重點變成跟進清單',
      ]
    : [
        '幫我整理今日筆記重點',
        '把這段內容變成知識卡',
        '設計一個 25 分鐘溫習計劃',
        '幫我拆解下一個學習目標',
      ]
  const guideSteps = isWorkMode
    ? [
        { icon: Plus, title: '輸入課題', meta: '一句話開始' },
        { icon: WandSparkles, title: '選任務包', meta: '教案、出題、簡報' },
        { icon: BookOpenCheck, title: '教師覆核', meta: '再帶入課堂' },
      ]
    : [
        { icon: Plus, title: '輸入內容', meta: '筆記、目標、問題' },
        { icon: WandSparkles, title: '交給 AI', meta: '整理、拆解、生成' },
        { icon: BookOpenCheck, title: '回到工具', meta: '知識卡、筆記、目標' },
      ]

  useEffect(() => {
    try {
      const value = lessonTopic.trim()
      if (value) localStorage.setItem('eziteach.nextLessonTopic', value)
      else localStorage.removeItem('eziteach.nextLessonTopic')
    } catch {
      /* ignore */
    }
  }, [lessonTopic])

  const openFeature = (featureId?: string) => {
    if (!featureId) return
    onOpen(featureId)
  }

  const askTeachingAi = () => {
    const raw = lessonTopic.trim()
    if (isWorkMode) {
      const route = inferWorkComposerRoute(raw)
      const taskText = raw || `幫我準備「${topicSuggestion}」一堂課`
      if (route.featureId === 'work-ai') {
        writeAiHandoff('work', taskText)
        toast.success('已帶入教學 AI')
      } else {
        writeComposerHandoff({
          featureId: route.featureId,
          text: taskText,
          materialTool: route.materialTool,
        })
        toast.success(`已按內容打開「${route.label}」`)
      }
      onOpen(route.featureId)
      return
    }

    const prompt = raw || '幫我整理今日筆記重點，列出要記住的概念、可測自己的問題，以及下一步學習安排。'
    const route = inferLearningComposerRoute(raw)
    if (route.featureId === 'learning-ai') {
      writeAiHandoff('learning', prompt)
      toast.success('已帶入 AI 助手')
    } else {
      writeComposerHandoff({ featureId: route.featureId, text: prompt })
      toast.success(`已按內容打開「${route.label}」`)
    }
    onOpen(route.featureId || aiFeature?.id || 'learning-ai')
  }

  const startLessonPack = (pack: (typeof LESSON_PACKS)[number]) => {
    const topic = lessonTopic.trim() || topicSuggestion
    const item = inboxCol.add({
      text: `${pack.capturePrefix}：${topic} #下一堂課`,
      mode: 'work',
      createdAt: new Date().toISOString(),
    })
    patchMeta(item.id, {
      kind: pack.kind,
      tags: ['下一堂課'],
      pinned: true,
    })
    toast.success(`已記低「${topic}」`, {
      label: '看 Inbox',
      onClick: () => onOpen('inbox'),
    })
    onOpen(pack.featureId)
  }

  return (
    <div className="-mx-4 -mt-1 sm:-mx-6 lg:-mx-8">
      <section className="relative isolate overflow-hidden border-b border-slate-200/80 bg-white px-4 pb-8 pt-7 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
        <div className="relative mx-auto flex min-h-[455px] max-w-[1180px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-accent">
                {t(`mode.${modeDef.id}.name`, { defaultValue: modeDef.name })} · {dateLabel}
              </p>
              {hasProfileMeta && (
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {roleLabel && (
                    <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 font-semibold text-slate-600 shadow-xs dark:bg-slate-900/70 dark:text-slate-300">
                      {roleLabel}
                    </span>
                  )}
                  {school && <span className="truncate">{school}</span>}
                  {subjects.length > 0 && (
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span className="text-slate-400 dark:text-slate-500">任教</span>
                      {subjects.slice(0, 3).map((p) => (
                        <span
                          key={p.id}
                          title={p.name}
                          className="rounded-full bg-white/80 px-2 py-1 font-semibold text-accent-strong shadow-xs dark:bg-accent/15 dark:text-accent"
                        >
                          {p.short}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              )}
            </div>
            <PlanBadge />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/70 px-3.5 text-sm font-semibold text-indigo-800 shadow-xs dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:text-indigo-200">
              <Sparkles size={17} strokeWidth={1.9} />
              EziTeach AI
            </span>
            <h1 className="mt-5 max-w-4xl text-[38px] font-semibold leading-[1.12] text-slate-950 sm:text-[46px] lg:text-[52px] dark:text-white">
              {isWorkMode ? '想準備哪一堂課？' : '今日想整理什麼？'}
            </h1>
            <p className="mt-4 max-w-2xl text-[16px] leading-7 text-slate-600 sm:text-[17px] dark:text-slate-300">
              {greeting}。由一句課題或任務開始，EziTeach AI 會把你帶到最合適的教學工具。
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                askTeachingAi()
              }}
              className="mt-7 w-full max-w-[900px] rounded-[28px] bg-white p-1 shadow-[0_22px_60px_-44px_rgba(79,70,229,0.65)] ring-1 ring-slate-200/90 dark:bg-slate-900 dark:ring-slate-700/80"
            >
              <label htmlFor="home-ai-composer" className="sr-only">
                {isWorkMode ? '輸入課題或教學任務' : '輸入學習內容或問題'}
              </label>
              <div className="flex min-h-[64px] items-center gap-2 rounded-[24px] border border-slate-100 bg-white p-2 text-left dark:border-slate-700/70 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => onOpen('inbox')}
                  aria-label="打開收件匣"
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Plus size={24} strokeWidth={1.8} />
                </button>
                <input
                  id="home-ai-composer"
                  value={lessonTopic}
                  onChange={(event) => setLessonTopic(event.target.value)}
                  placeholder={composerPlaceholder}
                  className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <span className="hidden min-h-11 shrink-0 items-center rounded-full bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200 sm:inline-flex">
                  {isWorkMode ? '教師 AI' : '學習 AI'}
                </span>
                <button
                  type="button"
                  onClick={() => onOpen(isWorkMode ? 'work-transcribe' : aiFeature?.id ?? 'learning-ai')}
                  aria-label={isWorkMode ? '打開錄音轉文字' : '打開語音輸入'}
                  className="hidden h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800 sm:flex"
                >
                  <Mic size={20} strokeWidth={1.9} />
                </button>
                <button
                  type="submit"
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="按內容開始處理"
                >
                  <Send size={19} strokeWidth={2.1} />
                </button>
              </div>
            </form>

            <div className="mt-4 flex max-w-[900px] flex-wrap justify-center gap-2">
              {composerSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setLessonTopic(suggestion)}
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-600 shadow-xs transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <ol className="mt-6 grid w-full max-w-[840px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-1 text-left shadow-xs dark:border-slate-700/70 dark:bg-slate-900 sm:grid-cols-3">
              {guideSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <li
                    key={step.title}
                    className="relative flex min-h-[70px] items-center gap-3 rounded-[16px] px-3.5 py-3 sm:after:absolute sm:after:right-0 sm:after:top-1/2 sm:after:h-9 sm:after:w-px sm:after:-translate-y-1/2 sm:after:bg-slate-200 sm:last:after:hidden dark:sm:after:bg-slate-700"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-400">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="block truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                        {step.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        {step.meta}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-accent">
                Workspace
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                今日工作區
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                先揀一件事開始，右邊保留今日最需要留意的狀態。
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

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid auto-rows-min gap-2 self-start sm:grid-cols-2">
              {primaryFeatures.map((feature, index) => (
                <ActionCard
                  key={feature.id}
                  feature={feature}
                  primary={index === 0}
                  onOpen={() => onOpen(feature.id)}
                />
              ))}
            </div>

            <aside className="rounded-[18px] border border-[color:var(--border)] bg-white p-3 shadow-xs dark:bg-slate-800 sm:p-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">
                  Today flow
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  今日流程
                </h3>
              </div>

              <div className="mt-4 space-y-2">
                <Metric
                  icon={CheckSquare}
                  label="待辦"
                  value={openTasks.length}
                  unit="件"
                  hint={openTasks[0]?.text ?? '今日未有待辦壓住'}
                />
                <Metric
                  icon={CalendarDays}
                  label="課堂"
                  value={todayLessons.length}
                  unit="節"
                  hint={todayLessons[0] ? `${todayLessons[0].subject} · 第 ${todayLessons[0].period} 節` : '今日無課堂安排'}
                />
                <Metric
                  icon={Clock}
                  label="倒數"
                  value={daysToNext ?? '—'}
                  unit={daysToNext === null ? undefined : '日'}
                  hint={nextCountdown?.title ?? '未有即將到期事項'}
                />
              </div>

              <div className="mt-4 space-y-2 border-t border-[color:var(--border)] pt-3">
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
            </aside>
          </div>
        </section>

        {isWorkMode && (
          <section className="rounded-[18px] border border-[color:var(--border)] bg-white p-4 shadow-xs dark:bg-slate-800 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300">
                  Teacher packs
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  一鍵開始下一堂
                </h2>
              </div>
              {nextLessonCaptures.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpen('inbox')}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-accent transition hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-accent/15"
                >
                  最近下一堂
                  <ArrowRight size={13} strokeWidth={2} />
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {LESSON_PACKS.map((pack) => {
                const Icon = pack.icon
                return (
                  <button
                    key={pack.title}
                    type="button"
                    onClick={() => startLessonPack(pack)}
                    className="group flex min-h-[118px] cursor-pointer flex-col rounded-[16px] border border-[color:var(--border)] bg-[color:var(--surface-2)] p-4 text-left transition hover:border-accent/40 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-800"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span className="mt-4 block text-sm font-bold text-slate-800 dark:text-slate-100">
                      {pack.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      {pack.desc}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                      開始
                      <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
              其他常用入口
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickFeatures.map((feature) => (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => onOpen(feature.id)}
                  className="group flex min-h-[76px] w-full cursor-pointer items-center gap-3 rounded-[16px] border border-[color:var(--border)] bg-white px-4 py-3 text-left transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800 dark:hover:border-accent/40"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <FeatureIcon icon={feature.icon} size={18} strokeWidth={1.75} />
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
              按分類瀏覽
            </h2>
            <div className="space-y-2">
              {groups.map((group) => {
                const firstFeature = group.items.find((item) => item.status === 'ready') ?? group.items[0]
                return (
                  <button
                    key={group.group}
                    type="button"
                    onClick={() => openFeature(firstFeature?.id)}
                    className="flex min-h-[54px] w-full cursor-pointer items-center justify-between rounded-[16px] border border-[color:var(--border)] bg-white px-4 py-3 text-left transition hover:border-accent/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-800"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        <LayoutGrid size={17} strokeWidth={1.75} />
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
    <div className="flex min-h-[58px] items-center gap-3 rounded-[14px] bg-[color:var(--surface-2)] px-3 py-2.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-accent shadow-xs dark:bg-slate-700">
        <Icon size={17} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      </span>
      <span className="nums shrink-0 text-right text-xl font-semibold text-slate-800 dark:text-slate-100">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-slate-400">{unit}</span>}
      </span>
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
        'group flex min-h-[58px] w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'bg-accent-soft/70 dark:bg-accent/15'
          : 'hover:bg-[color:var(--surface-2)]',
      )}
    >
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          active
            ? 'bg-accent text-white'
            : 'bg-[color:var(--surface-2)] text-slate-400 dark:text-slate-300',
        )}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="w-11 shrink-0 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
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
  primary,
  onOpen,
}: {
  feature: Feature
  primary?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'group flex min-h-[96px] w-full cursor-pointer items-center gap-3 rounded-[16px] border px-3.5 py-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        primary
          ? 'border-accent/35 bg-accent-soft/80 hover:border-accent/45 dark:bg-accent/15'
          : 'border-[color:var(--border)] bg-white hover:border-accent/35 hover:bg-[color:var(--surface-2)] dark:bg-slate-800 dark:hover:border-accent/35',
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <FeatureIcon icon={feature.icon} size={19} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {featName(t, feature)}
          </span>
          {primary && (
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-accent shadow-xs dark:bg-slate-800">
              建議
            </span>
          )}
        </span>
        <span className="mt-1 block truncate text-xs leading-relaxed text-slate-500 dark:text-slate-400">
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
