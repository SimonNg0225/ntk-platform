import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eye,
  Plus,
  Printer,
  Copy,
  FileText,
  Trash2,
  Clock,
  Loader2,
  Sparkles,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  Field,
  IconButton,
  Input,
  PageHero,
  SectionTitle,
  Textarea,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { classifyAIError } from '../../../lib/aiError'
import { downloadDocx, printDoc } from '../../../lib/export'
import {
  hasCriteriaNotes,
  observationsCol,
  observationToDoc,
  type Observation,
} from './observationStore'
import {
  CRITERIA,
  buildObservationSystem,
  buildObservationUser,
  parseObservationSummary,
} from './observationPrompts'

const MODEL: AIModel = 'gemini-2.5-flash'

const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '開新觀課，填好基本資料',
    desc: '記低被觀老師、班別／科目、日期、節次同課題；觀嘅係同事嘅課，唔涉學生個人資料。',
  },
  {
    title: '貼上課堂內容文字稿',
    desc: '將觀課筆記或錄音轉出嘅文字稿貼入去；越具體 AI 撮要越準。',
  },
  {
    title: '一鍵 AI 撮要，再儲存／列印',
    desc: 'AI 會對住六大準則逐項觀察，列出亮點同改進建議；可複製、出 Word 或列印存檔。',
  },
]

type View = 'list' | 'form' | 'detail'

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export default function Observation() {
  const { t } = useTranslation()
  const toast = useToast()
  const confirm = useConfirm()
  const records = useCollection(observationsCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [view, setView] = useState<View>('list')
  const [current, setCurrent] = useState<Observation | null>(null)

  // ── 表單欄位 ──
  const [teacher, setTeacher] = useState('')
  const [subject, setSubject] = useState('')
  const [klass, setKlass] = useState('')
  const [date, setDate] = useState(today())
  const [period, setPeriod] = useState('')
  const [topic, setTopic] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)

  function resetForm() {
    setTeacher('')
    setSubject('')
    setKlass('')
    setDate(today())
    setPeriod('')
    setTopic('')
    setSource('')
  }

  function openForm() {
    resetForm()
    setView('form')
  }

  const canRun = teacher.trim() !== '' && subject.trim() !== '' && source.trim() !== ''

  // 最新表單值放 ref：retry（toast onClick）唔會攞到舊 closure 快照，
  // 用家改完表單再撳「重試」會用返最新值。
  const formRef = useRef({ teacher, subject, klass, date, period, topic, source })
  formRef.current = { teacher, subject, klass, date, period, topic, source }

  // unmount 後唔再 setState（SPA 切走功能頁時 in-flight 請求 resolve）
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  async function run() {
    const f = formRef.current
    const valid =
      f.teacher.trim() !== '' && f.subject.trim() !== '' && f.source.trim() !== ''
    if (busy || !valid) return
    setBusy(true)
    const meta = {
      teacher: f.teacher,
      subject: f.subject,
      klass: f.klass,
      topic: f.topic,
      period: f.period,
      date: f.date,
    }
    try {
      const raw = await complete({
        system: buildObservationSystem(),
        messages: [{ role: 'user', content: buildObservationUser(meta, f.source) }],
        model: MODEL,
        temperature: 0.3,
        feature: 'observation', // 走獨立每月桶（未核實主程序額度 key，待接駁確認）
        source: 'observation',
      })
      const summary = parseObservationSummary(raw)
      if (!aliveRef.current) return
      const rec = observationsCol.add({
        createdAt: new Date().toISOString(),
        teacher: f.teacher.trim(),
        subject: f.subject.trim(),
        klass: f.klass.trim(),
        date: f.date,
        period: f.period.trim(),
        topic: f.topic.trim(),
        source: f.source.trim(),
        ...summary,
        model: MODEL,
      })
      setCurrent(rec)
      setView('detail')
      toast.success(t('observation.toast.done', { defaultValue: '觀課撮要完成' }))
    } catch (e) {
      if (!aliveRef.current) return
      toast.error(classifyAIError(e).message, {
        label: t('observation.toast.retry', { defaultValue: '重試' }),
        onClick: () => void run(),
      })
    } finally {
      if (aliveRef.current) setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({
      title: t('observation.del.title', { defaultValue: '刪除呢個觀課記錄？' }),
      tone: 'danger',
      confirmText: t('observation.del.confirm', { defaultValue: '刪除' }),
    })
    if (!ok) return
    observationsCol.remove(id)
    if (current?.id === id) {
      setCurrent(null)
      setView('list')
    }
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Eye}
        title={t('observation.notReady.title', { defaultValue: '觀課工具未啟用' })}
        hint={t('observation.notReady.hint', {
          defaultValue: '要設定好 Supabase 並部署 gemini Edge Function 先用到（步驟見 docs/SETUP.md）。',
        })}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHero
        guideKey="observation"
        icon={Eye}
        kicker={t('observation.kicker', { defaultValue: 'Observation' })}
        title={t('observation.title', { defaultValue: '觀課評課' })}
        description={t('observation.subtitle', {
          defaultValue:
            '記低觀同事課堂嘅內容，AI 對住六大準則逐項觀察，列出亮點同改進建議，一鍵存檔／列印。',
        })}
      />

      <FeatureGuide
        storageKey="observation"
        title={t('observation.guide.title', { defaultValue: '觀課評課點用？' })}
        steps={GUIDE_STEPS}
      />

      {view === 'list' && (
        <ListView
          history={history}
          onNew={openForm}
          onOpen={(r) => {
            setCurrent(r)
            setView('detail')
          }}
          onDelete={(id) => void del(id)}
        />
      )}

      {view === 'form' && (
        <FormView
          teacher={teacher}
          subject={subject}
          klass={klass}
          date={date}
          period={period}
          topic={topic}
          source={source}
          busy={busy}
          canRun={canRun}
          setTeacher={setTeacher}
          setSubject={setSubject}
          setKlass={setKlass}
          setDate={setDate}
          setPeriod={setPeriod}
          setTopic={setTopic}
          setSource={setSource}
          onBack={() => setView('list')}
          onRun={() => void run()}
        />
      )}

      {view === 'detail' && current && (
        <DetailView
          rec={current}
          onBack={() => setView('list')}
          onDelete={() => void del(current.id)}
        />
      )}
    </div>
  )
}

// ───────── 列表 ─────────
function ListView({
  history,
  onNew,
  onOpen,
  onDelete,
}: {
  history: Observation[]
  onNew: () => void
  onOpen: (r: Observation) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Clock}>
          {t('observation.list.title', { defaultValue: '觀課記錄' })}
        </SectionTitle>
        <Button icon={Plus} onClick={onNew}>
          {t('observation.list.new', { defaultValue: '開新觀課' })}
        </Button>
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={Eye}
          title={t('observation.empty.title', { defaultValue: '未有任何觀課記錄' })}
          hint={t('observation.empty.hint', {
            defaultValue: '開第一個觀課記錄，貼上課堂文字稿，AI 即刻幫你對住六大準則撮要。',
          })}
          action={
            <Button size="sm" variant="secondary" icon={Plus} onClick={onNew}>
              {t('observation.empty.cta', { defaultValue: '開新觀課' })}
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {history.map((r) => {
            const analyzed = hasCriteriaNotes(r)
            return (
              <div
                key={r.id}
                className="group relative flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white pl-3 pr-12 transition duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
              >
                <button
                  type="button"
                  onClick={() => onOpen(r)}
                  aria-label={r.teacher}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.99]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <Eye size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.teacher || t('observation.card.noTeacher', { defaultValue: '（未填老師）' })}
                      <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
                        {[r.subject, r.klass].filter(Boolean).join(' · ')}
                      </span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>{r.date || fmtDate(r.createdAt)}</span>
                      {analyzed ? (
                        <Badge tone="green">
                          {t('observation.card.analyzed', { defaultValue: '已分析' })}
                        </Badge>
                      ) : (
                        <Badge tone="amber">
                          {t('observation.card.pending', { defaultValue: '未分析' })}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <IconButton
                    label={t('observation.card.delete', { defaultValue: '刪除' })}
                    size="sm"
                    tone="danger"
                    onClick={() => onDelete(r.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ───────── 表單 ─────────
function FormView(props: {
  teacher: string
  subject: string
  klass: string
  date: string
  period: string
  topic: string
  source: string
  busy: boolean
  canRun: boolean
  setTeacher: (v: string) => void
  setSubject: (v: string) => void
  setKlass: (v: string) => void
  setDate: (v: string) => void
  setPeriod: (v: string) => void
  setTopic: (v: string) => void
  setSource: (v: string) => void
  onBack: () => void
  onRun: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={props.onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        {t('observation.form.back', { defaultValue: '返回列表' })}
      </button>

      <Card padded className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('observation.form.teacher', { defaultValue: '被觀老師' })} required>
            <Input
              value={props.teacher}
              onChange={(e) => props.setTeacher(e.target.value)}
              placeholder={t('observation.form.teacherPh', { defaultValue: '陳老師' })}
            />
          </Field>
          <Field label={t('observation.form.subject', { defaultValue: '科目' })} required>
            <Input
              value={props.subject}
              onChange={(e) => props.setSubject(e.target.value)}
              placeholder={t('observation.form.subjectPh', { defaultValue: '中文 / 數學…' })}
            />
          </Field>
          <Field label={t('observation.form.klass', { defaultValue: '班別' })}>
            <Input
              value={props.klass}
              onChange={(e) => props.setKlass(e.target.value)}
              placeholder={t('observation.form.klassPh', { defaultValue: '3A' })}
            />
          </Field>
          <Field label={t('observation.form.date', { defaultValue: '日期' })}>
            <Input type="date" value={props.date} onChange={(e) => props.setDate(e.target.value)} />
          </Field>
          <Field label={t('observation.form.period', { defaultValue: '節次' })}>
            <Input
              value={props.period}
              onChange={(e) => props.setPeriod(e.target.value)}
              placeholder={t('observation.form.periodPh', { defaultValue: '第 3 節 / Day A P5' })}
            />
          </Field>
          <Field label={t('observation.form.topic', { defaultValue: '課題' })}>
            <Input
              value={props.topic}
              onChange={(e) => props.setTopic(e.target.value)}
              placeholder={t('observation.form.topicPh', { defaultValue: '本課課題' })}
            />
          </Field>
        </div>

        <Field
          label={t('observation.form.source', { defaultValue: '課堂內容（文字稿）' })}
          hint={t('observation.form.sourceHint', {
            defaultValue: '貼上觀課筆記或錄音轉出嘅文字稿；越具體 AI 撮要越準。',
          })}
          required
        >
          <Textarea
            value={props.source}
            onChange={(e) => props.setSource(e.target.value)}
            rows={10}
            className="min-h-[180px]"
            placeholder={t('observation.form.sourcePh', {
              defaultValue: '例：老師先用提問引入，再分組討論…',
            })}
          />
        </Field>

        <div className="flex flex-col items-end gap-1.5">
          <Button
            icon={props.busy ? Loader2 : Sparkles}
            onClick={props.onRun}
            loading={props.busy}
            disabled={!props.canRun}
          >
            {props.busy
              ? t('observation.form.running', { defaultValue: '分析中…' })
              : t('observation.form.run', { defaultValue: '分析並儲存' })}
          </Button>
          {props.busy ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {t('observation.form.wait', { defaultValue: 'AI 對住六大準則整理緊，請等一等…' })}
            </p>
          ) : (
            !props.canRun && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {t('observation.form.need', {
                  defaultValue: '請先填被觀老師、科目，同貼上課堂內容文字稿。',
                })}
              </p>
            )
          )}
        </div>
      </Card>
    </div>
  )
}

// ───────── 結果／詳情 ─────────
function DetailView({
  rec,
  onBack,
  onDelete,
}: {
  rec: Observation
  onBack: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()

  const dlWord = async () => {
    try {
      await downloadDocx(observationToDoc(rec))
      toast.success(t('observation.result.dlOk', { defaultValue: '已下載 Word' }))
    } catch (e) {
      toast.error(
        (e as Error).message || t('observation.result.dlFail', { defaultValue: '下載失敗' }),
      )
    }
  }
  const doPrint = () => {
    try {
      printDoc(observationToDoc(rec))
    } catch (e) {
      toast.error(
        (e as Error).message || t('observation.result.printFail', { defaultValue: '列印失敗' }),
      )
    }
  }
  const copyAll = async () => {
    const text = observationToDoc(rec)
      .blocks.map((b) =>
        b.kind === 'heading'
          ? `\n【${b.text}】`
          : b.kind === 'bullets'
            ? b.items.map((i) => `• ${i}`).join('\n')
            : b.kind === 'paragraph'
              ? b.text
              : '',
      )
      .join('\n')
      .trim()
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      toast.success(t('observation.result.copyOk', { defaultValue: '已複製' }))
    } catch {
      toast.error(t('observation.result.copyFail', { defaultValue: '複製失敗，請手動選取文字' }))
    }
  }

  const analyzed = hasCriteriaNotes(rec)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        {t('observation.result.back', { defaultValue: '返回列表' })}
      </button>

      <Card padded className="space-y-4 ring-1 ring-accent/20">
        {/* meta header */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" icon={Eye}>
            {t('observation.result.badge', { defaultValue: '觀課' })}
          </Badge>
          <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {rec.teacher}
            <span className="ml-1.5 text-sm font-normal text-slate-400 dark:text-slate-500">
              {[rec.subject, rec.klass].filter(Boolean).join(' · ')}
            </span>
          </h2>
          <Button variant="secondary" size="sm" icon={Copy} onClick={() => void copyAll()}>
            {t('observation.result.copy', { defaultValue: '複製' })}
          </Button>
          <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
            {t('observation.result.word', { defaultValue: 'Word' })}
          </Button>
          <Button variant="secondary" size="sm" icon={Printer} onClick={doPrint}>
            {t('observation.result.print', { defaultValue: '列印' })}
          </Button>
          <Button variant="secondary" size="sm" icon={Trash2} onClick={onDelete}>
            {t('observation.result.delete', { defaultValue: '刪除' })}
          </Button>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {[
            rec.date && `${t('observation.result.date', { defaultValue: '日期' })}：${rec.date}`,
            rec.period && `${t('observation.result.period', { defaultValue: '節次' })}：${rec.period}`,
            rec.topic && `${t('observation.result.topic', { defaultValue: '課題' })}：${rec.topic}`,
          ]
            .filter(Boolean)
            .join('　')}
        </p>

        {!analyzed && (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-50/60 px-3 py-2.5 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <Sparkles size={16} className="shrink-0" />
            {t('observation.result.notAnalyzed', {
              defaultValue: '今次未抽到準則觀察，可返回列表重新開一個記錄再試。',
            })}
          </div>
        )}

        {/* 六準則逐項 */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('observation.section.criteria', { defaultValue: '觀課準則' })}
          </p>
          <div className="space-y-2.5">
            {CRITERIA.map(({ key, label }) => {
              const note = rec.criteria.find((c) => c.key === key)?.note?.trim()
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-slate-700/60 dark:bg-slate-800/40"
                >
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                    {label}
                  </p>
                  <p
                    className={cx(
                      'mt-1 text-sm leading-relaxed',
                      note
                        ? 'text-slate-600 dark:text-slate-300'
                        : 'text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {note || '—'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <DotList
          title={t('observation.section.highlights', { defaultValue: '整體亮點' })}
          items={rec.highlights}
          tone="emerald"
        />
        <DotList
          title={t('observation.section.improvements', { defaultValue: '改進建議' })}
          items={rec.improvements}
          tone="amber"
        />

        {rec.source.trim() && (
          <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
            <summary className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              <ChevronRight
                size={14}
                className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-90"
              />
              {t('observation.result.fullSource', { defaultValue: '課堂內容文字稿' })}
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {rec.source}
            </p>
          </details>
        )}
      </Card>
    </div>
  )
}

const DOT_TONE = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
} as const

function DotList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: keyof typeof DOT_TONE
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200">
            <span className={cx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', DOT_TONE[tone])} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
