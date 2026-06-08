import { useMemo, useState } from 'react'
import {
  Compass,
  Target,
  AlertTriangle,
  ListOrdered,
  Users,
  SlidersHorizontal,
  ClipboardCheck,
  Sparkles,
  Trash2,
  Clock,
  NotebookPen,
  GraduationCap,
  FileText,
  Printer,
  type LucideIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  SectionTitle,
  SegmentedControl,
  Select,
  Textarea,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useNav } from '../../../context/NavContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { topicsCol } from '../../../data/collections'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, printDoc, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { teachGuideCol, type GuideRecord } from './guideStore'
import { buildGuideSystem, parseGuide, isEmptyGuide, type GuideResult } from './prompts'

const MODEL_OPTIONS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

type BadgeTone = Parameters<typeof Badge>[0]['tone']

const SECTIONS: {
  key: keyof GuideResult
  label: string
  icon: LucideIcon
  tone: BadgeTone
  ordered?: boolean
}[] = [
  { key: 'keyPoints', label: '教學重點', icon: Target, tone: 'accent' },
  { key: 'misconceptions', label: '學生常見誤解', icon: AlertTriangle, tone: 'rose' },
  { key: 'steps', label: '建議教學步驟', icon: ListOrdered, tone: 'blue', ordered: true },
  { key: 'activities', label: '課堂活動', icon: Users, tone: 'green' },
  { key: 'differentiation', label: '差異化建議', icon: SlidersHorizontal, tone: 'amber' },
  { key: 'assessment', label: '評估方式', icon: ClipboardCheck, tone: 'slate' },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export default function TeachGuide() {
  const toast = useToast()
  const confirm = useConfirm()
  const nav = useNav()
  const { subjectPackId } = useSettings()
  const subjectName =
    subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const allTopics = useCollection(topicsCol)
  const topics = useMemo(
    () => [...allTopics].sort((a, b) => a.order - b.order),
    [allTopics],
  )
  const records = useCollection(teachGuideCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [extra, setExtra] = useState('')
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<GuideRecord | null>(null)

  async function run() {
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    if (!topic) {
      toast.info('未有課題 — 可去設定揀任教科目')
      return
    }
    setBusy(true)
    try {
      const raw = await complete({
        system: buildGuideSystem(subjectName),
        messages: [
          {
            role: 'user',
            content: `課題：${topic.topic}${extra.trim() ? `\n補充要求：${extra.trim()}` : ''}`,
          },
        ],
        model,
        temperature: 0.4,
      })
      const result = parseGuide(raw)
      if (isEmptyGuide(result)) {
        throw new Error('AI 出唔到內容，試吓換 Pro 或補充課題說明。')
      }
      const rec = teachGuideCol.add({
        createdAt: new Date().toISOString(),
        topicId: topic.id,
        topicName: topic.topic,
        model,
        ...result,
      })
      setCurrent(rec)
      toast.success('教學指引已生成')
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢份指引？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    teachGuideCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Compass}
        title="教學指引未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Compass size={13} className="shrink-0" />
          教學備課 · Teaching Guide
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          教學指引
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          揀一個課題，AI 教你「點教」：重點、學生常見誤解、教學步驟、活動、差異化、評估。
        </p>
      </header>

      {/* 輸入 */}
      <Card padded className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="課題">
            <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="模型">
            <Tooltip label="Flash 快 · Pro 強">
              <SegmentedControl options={MODEL_OPTIONS} value={model} onChange={setModel} />
            </Tooltip>
          </Field>
        </div>
        <Field label="補充（選填）" hint="例如班級程度、想強調嘅角度、節數">
          <Textarea
            rows={2}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="例：中四基礎班，2 節，想多啲生活例子"
          />
        </Field>
        <div className="flex justify-end">
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={topics.length === 0}>
            {busy ? '生成緊…' : '生成指引'}
          </Button>
        </div>
      </Card>

      {/* 生成教材（跳去現有功能） */}
      <Card padded className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">
          生成教材：
        </span>
        <Button variant="secondary" size="sm" icon={Sparkles} onClick={() => nav.open('work-generate')}>
          教材生成
        </Button>
        <Button variant="secondary" size="sm" icon={NotebookPen} onClick={() => nav.open('work-lesson-plan')}>
          備課 / 教案
        </Button>
        <Button variant="secondary" size="sm" icon={GraduationCap} onClick={() => nav.open('quiz')}>
          自我測驗
        </Button>
      </Card>

      {/* 結果 */}
      {current && <GuideView rec={current} />}

      {/* 歷史 */}
      {history.length > 0 && (
        <div>
          <SectionTitle icon={Clock}>歷史</SectionTitle>
          <div className="space-y-2">
            {history.map((r) => (
              <Card
                key={r.id}
                hover
                onClick={() => setCurrent(r)}
                className={cx('p-3', current?.id === r.id && 'ring-1 ring-accent/30')}
              >
                <div className="flex items-center gap-2.5">
                  <Compass size={16} className="shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.topicName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <IconButton label="刪除" size="sm" tone="danger" onClick={() => void del(r.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && !current && (
        <EmptyState
          icon={Compass}
          title="未有教學指引"
          hint="揀一個課題，生成第一份「點教」指引。"
        />
      )}
    </div>
  )
}

function guideToDoc(rec: GuideRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  for (const sec of SECTIONS) {
    const items = rec[sec.key]
    if (!items || items.length === 0) continue
    blocks.push({ kind: 'heading', text: sec.label, level: 1 })
    blocks.push(sec.ordered ? { kind: 'numbered', items } : { kind: 'bullets', items })
  }
  return { title: `${rec.topicName} — 教學指引`, blocks }
}

function GuideView({ rec }: { rec: GuideRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(guideToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const dlPdf = () => {
    try {
      printDoc(guideToDoc(rec))
    } catch (e) {
      toast.error((e as Error).message || '列印失敗')
    }
  }
  return (
    <Card padded className="space-y-5 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Compass}>
          教學指引
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.topicName}
        </h2>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={dlPdf}>
          PDF
        </Button>
      </div>

      {SECTIONS.map((sec) => {
        const items = rec[sec.key]
        if (!items || items.length === 0) return null
        const Ico = sec.icon
        return (
          <div key={sec.key}>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Ico size={15} className="text-accent" />
              {sec.label}
            </p>
            {sec.ordered ? (
              <ol className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="space-y-1.5">
                {items.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </Card>
  )
}
