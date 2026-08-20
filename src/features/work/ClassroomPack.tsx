import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Circle,
  FileText,
  Layers3,
  Loader2,
  NotebookPen,
  Plus,
  Presentation,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useNav, type AppNavParams } from '../../context/NavContext'
import { useSettings } from '../../context/SettingsContext'
import { useToast } from '../../context/ToastContext'
import { lessonPlansCol, papersCol, questionsCol } from '../../data/collections'
import { getSubjectPack } from '../../data/subjects'
import { classifyAIError } from '../../lib/aiError'
import { isAIConfigured } from '../../lib/aiClient'
import { track, trackOutputSaved } from '../../lib/observability'
import { useCollection } from '../../lib/store'
import ServiceStatus from '../../components/ServiceStatus'
import { useSubscription } from '../../hooks/useSubscription'
import {
  Badge,
  Button,
  Field,
  Input,
  PageHero,
  Select,
  Textarea,
  cx,
} from '../../ui'
import { slideDecksCol } from './slides/slideStore'
import { consumeComposerHandoff } from '../shared/composerHandoff'
import {
  generateClassroomPack,
  type ClassroomPackInput,
} from './classroomPack/engine'
import {
  persistClassroomPack,
  setClassroomPackOutputReviewed,
  setEntireClassroomPackReviewed,
} from './classroomPack/persist'
import {
  classroomPacksCol,
  packReviewStatus,
  type ClassroomPack,
  type ClassroomPackOutput,
} from './classroomPack/store'

const CURRICULUM_OPTIONS = [
  '香港課程發展議會課程指引',
  '公開考試課程／評核框架',
  '校本課程與進度表',
  '自訂課程依據',
]

type FormState = {
  topic: string
  subject: string
  className: string
  durationMin: string
  curriculumBasis: string
  referenceText: string
}

const REVIEW_META = {
  draft: { label: '待覆核', tone: 'amber' as const },
  partial: { label: '部分覆核', tone: 'blue' as const },
  reviewed: { label: '老師已覆核', tone: 'green' as const },
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-HK', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function topicFromHandoff(text: string): string {
  const quoted = text.match(/[「『“\"]([^」』”\"]{2,80})[」』”\"]/)?.[1]
  if (quoted) return quoted.trim()
  return text
    .replace(/^(幫我|請)?\s*(為|就)?\s*/i, '')
    .replace(/(建立|製作|生成|準備).*(課堂套裝|教案|工作紙|簡報).*$/i, '')
    .trim()
    .slice(0, 100)
}

export default function ClassroomPack() {
  const nav = useNav()
  const toast = useToast()
  const location = useLocation()
  const subscription = useSubscription()
  const { subjectPackId } = useSettings()
  const configuredSubject =
    subjectPackId && subjectPackId !== 'custom'
      ? getSubjectPack(subjectPackId)?.name ?? ''
      : ''

  const packs = useCollection(classroomPacksCol)
  const lessons = useCollection(lessonPlansCol)
  const papers = useCollection(papersCol)
  const questions = useCollection(questionsCol)
  const decks = useCollection(slideDecksCol)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<FormState>({
    topic: '',
    subject: configuredSubject,
    className: '',
    durationMin: '45',
    curriculumBasis: CURRICULUM_OPTIONS[0],
    referenceText: '',
  })
  const resumeRef = useRef('')

  const focusTopic = () => {
    requestAnimationFrame(() => document.getElementById('classroom-pack-topic')?.focus())
  }

  const history = useMemo(
    () => [...packs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [packs],
  )
  const selected = packs.find((pack) => pack.id === selectedId) ?? history[0] ?? null

  useEffect(() => {
    if (!form.subject && configuredSubject) {
      setForm((current) => ({ ...current, subject: configuredSubject }))
    }
  }, [configuredSubject, form.subject])

  useEffect(() => {
    const handoff = consumeComposerHandoff('work-classroom-pack')
    const topic = handoff ? topicFromHandoff(handoff.text) : ''
    if (topic) setForm((current) => ({ ...current, topic }))
  }, [])

  useEffect(() => {
    const item = new URLSearchParams(location.search).get('item')
    if (!item || resumeRef.current === item) return
    if (packs.some((pack) => pack.id === item)) {
      resumeRef.current = item
      setSelectedId(item)
    }
  }, [location.search, packs])

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const startNew = () => {
    setSelectedId(null)
    setForm((current) => ({ ...current, topic: '', referenceText: '' }))
    focusTopic()
  }

  const generate = async () => {
    const topic = form.topic.trim()
    if (!topic) {
      toast.error('先輸入今堂課題')
      focusTopic()
      return
    }
    if (!isAIConfigured || busy) return
    const input: ClassroomPackInput = {
      topic,
      subjectName: form.subject.trim() || undefined,
      className: form.className.trim() || undefined,
      durationMin: Math.max(20, Math.min(120, Number(form.durationMin) || 45)),
      curriculumBasis: form.curriculumBasis,
      referenceText: form.referenceText.trim() || undefined,
    }
    setBusy(true)
    track('classroom_pack_generation_started', {
      has_subject: Boolean(input.subjectName),
      has_class: Boolean(input.className),
      has_reference_source: Boolean(input.referenceText),
      duration_min: input.durationMin,
    })
    const startedAt = Date.now()
    try {
      const generation = await generateClassroomPack(input)
      const pack = persistClassroomPack(input, generation)
      setSelectedId(pack.id)
      track('classroom_pack_generation_completed', {
        pack_id: pack.id,
        latency_ms: Date.now() - startedAt,
        question_count: pack.questionIds.length,
        slide_count: generation.deck.slides.length,
        has_reference_source: Boolean(input.referenceText),
      })
      trackOutputSaved('classroom_pack', 'classroom_pack', {
        output_count: 3,
      })
      toast.success('課堂套裝已建立，三份成果已存入相應工作區')
    } catch (error) {
      track('classroom_pack_generation_failed', {
        error_kind: (error as Error).name || 'Error',
      })
      toast.error(classifyAIError(error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggleReviewed = (pack: ClassroomPack, output: ClassroomPackOutput) => {
    const reviewed = !pack.reviewedOutputs.includes(output)
    setClassroomPackOutputReviewed(pack, output, reviewed)
    track('classroom_pack_review_toggled', {
      output_kind: output,
      reviewed,
    })
  }

  const reviewAll = (pack: ClassroomPack) => {
    setEntireClassroomPackReviewed(pack)
    track('classroom_pack_review_completed', {
      pack_id: pack.id,
      output_count: 3,
    })
    toast.success('整套成果已標記為老師覆核')
  }

  const openOutput = (
    featureId: string,
    params: AppNavParams,
    output: ClassroomPackOutput,
  ) => {
    track('classroom_pack_output_opened', { output_kind: output })
    nav.open(featureId, params)
  }

  const selectedLesson = selected
    ? lessons.find((item) => item.id === selected.lessonPlanId)
    : undefined
  const selectedPaper = selected
    ? papers.find((item) => item.id === selected.paperId)
    : undefined
  const selectedQuestions = selected
    ? questions.filter((item) => selected.questionIds.includes(item.id))
    : []
  const selectedDeck = selected
    ? decks.find((item) => item.id === selected.slideDeckId)
    : undefined

  return (
    <div className="space-y-5">
      <PageHero
        guideKey="classroom-pack"
        icon={Layers3}
        kicker="整套備課"
        title="課堂套裝"
        description="輸入一次課題，建立互相一致的教案、工作紙及簡報；每份成果分開編輯和覆核。"
        actions={
          <Button variant="secondary" icon={Plus} onClick={startNew}>
            新建套裝
          </Button>
        }
      />

      {!isAIConfigured && (
        <ServiceStatus
          title="智能生成服務暫時未連接"
          message="你仍可查看及覆核已建立的課堂套裝；建立新套裝請稍後再試。"
          adminDetails="請檢查 Supabase 連線及 gemini Edge Function；用戶不需要處理技術設定。"
        />
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-[16px] bg-white p-4 shadow-xs ring-1 ring-inset ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700/70 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            今堂要教什麼？
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            最少輸入課題；提供來源後，課程對應會更可靠。
          </p>

          <div className="mt-4 space-y-3.5">
            <Field label="課題" required>
              <Input
                id="classroom-pack-topic"
                value={form.topic}
                onChange={(event) => update('topic', event.target.value)}
                placeholder="例如：百分比應用"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="科目">
                <Input
                  value={form.subject}
                  onChange={(event) => update('subject', event.target.value)}
                  placeholder="例如：數學"
                />
              </Field>
              <Field label="班別／年級">
                <Input
                  value={form.className}
                  onChange={(event) => update('className', event.target.value)}
                  placeholder="例如：中二"
                />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_112px] gap-3">
              <Field label="課程依據">
                <Select
                  value={form.curriculumBasis}
                  onChange={(event) => update('curriculumBasis', event.target.value)}
                >
                  {CURRICULUM_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </Select>
              </Field>
              <Field label="課時（分鐘）">
                <Input
                  value={form.durationMin}
                  onChange={(event) =>
                    update('durationMin', event.target.value.replace(/\D/g, ''))
                  }
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Field
              label="參考來源（建議）"
              hint="貼上課程目標、課本章節、教材摘要或來源連結；不會把內容公開。"
            >
              <Textarea
                rows={4}
                value={form.referenceText}
                onChange={(event) => update('referenceText', event.target.value)}
                placeholder="例如：校本進度表第 3 單元；學生需要能夠……"
              />
            </Field>
            <Button
              fullWidth
              icon={busy ? Loader2 : Layers3}
              loading={busy}
              disabled={!isAIConfigured || !form.topic.trim()}
              onClick={() => void generate()}
            >
              {busy ? '正在統一三份成果…' : '建立課堂套裝'}
            </Button>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              一次生成並自動儲存；內容預設為「待覆核」，不會假裝成官方認證材料。
            </p>
          </div>

          {history.length > 0 && (
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                最近套裝
              </p>
              <div className="mt-2 space-y-1">
                {history.slice(0, 5).map((pack) => {
                  const review = REVIEW_META[packReviewStatus(pack)]
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => setSelectedId(pack.id)}
                      className={cx(
                        'flex min-h-[58px] w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        selected?.id === pack.id
                          ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                      )}
                    >
                      <Layers3 size={17} className="shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{pack.topic}</span>
                        <span className="mt-0.5 block text-xs opacity-70">{fmtDate(pack.updatedAt)}</span>
                      </span>
                      <Badge tone={review.tone}>{review.label}</Badge>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0">
          {selected ? (
            <PackWorkspace
              pack={selected}
              lesson={selectedLesson}
              paperTitle={selectedPaper?.title}
              questionCount={selectedQuestions.length}
              deckTitle={selectedDeck?.title}
              slideCount={selectedDeck?.slides.length ?? 0}
              slidesPaid={subscription.isPaid}
              onToggleReviewed={(output) => toggleReviewed(selected, output)}
              onReviewAll={() => reviewAll(selected)}
              onOpenLesson={() =>
                openOutput('work-lesson-plan', { item: selected.lessonPlanId }, 'lesson')
              }
              onOpenWorksheet={() =>
                openOutput(
                  'work-questions',
                  { view: 'paper', item: selected.paperId },
                  'worksheet',
                )
              }
              onOpenSlides={() =>
                openOutput('work-slides', { item: selected.slideDeckId }, 'slides')
              }
            />
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center border-y border-slate-200 px-6 py-12 text-center dark:border-slate-800">
              <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <Layers3 size={25} strokeWidth={1.7} />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                一次完成一堂課的基本材料
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                由左邊輸入課題。完成後可以逐份打開編輯、下載，並記錄老師覆核狀態。
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function PackWorkspace({
  pack,
  lesson,
  paperTitle,
  questionCount,
  deckTitle,
  slideCount,
  slidesPaid,
  onToggleReviewed,
  onReviewAll,
  onOpenLesson,
  onOpenWorksheet,
  onOpenSlides,
}: {
  pack: ClassroomPack
  lesson?: { title: string; objectives?: string }
  paperTitle?: string
  questionCount: number
  deckTitle?: string
  slideCount: number
  slidesPaid: boolean
  onToggleReviewed: (output: ClassroomPackOutput) => void
  onReviewAll: () => void
  onOpenLesson: () => void
  onOpenWorksheet: () => void
  onOpenSlides: () => void
}) {
  const status = packReviewStatus(pack)
  const review = REVIEW_META[status]
  return (
    <div className="space-y-5">
      <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={review.tone}>{review.label}</Badge>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                更新於 {fmtDate(pack.updatedAt)}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {pack.topic}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {[pack.subject, pack.className, `${pack.durationMin} 分鐘`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {status !== 'reviewed' && (
            <Button variant="secondary" icon={CheckCircle2} onClick={onReviewAll}>
              整套標記已覆核
            </Button>
          )}
        </div>
      </header>

      <section className="rounded-[14px] bg-emerald-50/70 px-4 py-4 dark:bg-emerald-500/10">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" size={20} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
              課程依據與來源
            </h3>
            <p className="mt-1 text-sm text-emerald-900/80 dark:text-emerald-100/80">
              {pack.curriculumBasis}
            </p>
            <p className="mt-2 text-xs leading-5 text-emerald-900/75 dark:text-emerald-100/75">
              {pack.sourceSummary}
            </p>
            {pack.referenceText && (
              <details className="mt-2 text-xs text-emerald-950 dark:text-emerald-100">
                <summary className="cursor-pointer font-semibold">查看老師提供的來源</summary>
                <p className="mt-2 whitespace-pre-wrap leading-5">{pack.referenceText}</p>
              </details>
            )}
          </div>
        </div>
      </section>

      {pack.curriculumAlignment.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <BookOpenCheck size={17} className="text-accent" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              課程對應建議
            </h3>
            <Badge tone="slate">待老師確認</Badge>
          </div>
          <ul className="mt-2 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {pack.curriculumAlignment.map((item) => (
              <li key={item} className="py-2.5 text-sm leading-6 text-slate-700 dark:text-slate-200">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          三份課堂成果
        </h3>
        <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <OutputRow
            icon={NotebookPen}
            title={lesson?.title ?? '課堂教案'}
            meta="教學目標、時間流程、活動與教材"
            preview={lesson?.objectives?.split('\n')[0]}
            reviewed={pack.reviewedOutputs.includes('lesson')}
            onToggle={() => onToggleReviewed('lesson')}
            onOpen={onOpenLesson}
          />
          <OutputRow
            icon={FileText}
            title={paperTitle ?? '課堂工作紙'}
            meta={`${questionCount} 題 · 連答案及分數`}
            reviewed={pack.reviewedOutputs.includes('worksheet')}
            onToggle={() => onToggleReviewed('worksheet')}
            onOpen={onOpenWorksheet}
          />
          <OutputRow
            icon={Presentation}
            title={deckTitle ?? '教學簡報'}
            meta={`${slideCount} 版 · 可逐頁編輯${slidesPaid ? '' : ' · Plus 開啟'}`}
            reviewed={pack.reviewedOutputs.includes('slides')}
            onToggle={() => onToggleReviewed('slides')}
            onOpen={onOpenSlides}
          />
        </div>
      </section>
    </div>
  )
}

function OutputRow({
  icon: Icon,
  title,
  meta,
  preview,
  reviewed,
  onToggle,
  onOpen,
}: {
  icon: LucideIcon
  title: string
  meta: string
  preview?: string
  reviewed: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{meta}</p>
        {preview && (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
            {preview}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-pressed={reviewed}
          onClick={onToggle}
          className={cx(
            'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            reviewed
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
          )}
        >
          {reviewed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
          {reviewed ? '已覆核' : '標記覆核'}
        </button>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`開啟編輯：${title}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  )
}
