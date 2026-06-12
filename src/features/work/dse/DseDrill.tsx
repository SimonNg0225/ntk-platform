import { useMemo, useState } from 'react'
import {
  GraduationCap,
  Sparkles,
  FileText,
  Trash2,
  Clock,
  CalendarClock,
  Target,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SectionTitle,
  SegmentedControl,
  Select,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { useSettings } from '../../../context/SettingsContext'
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { topicsCol } from '../../../data/collections'
import type { Difficulty } from '../../../data/types'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { dseCol, getDseDate, setDseDate, type DseRecord } from './dseStore'
import { buildDseSystem, parseDse, DSE_PAPERS, type DsePaper } from './dsePrompts'

const DIFF_OPTS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '淺' },
  { id: 'medium', label: '中' },
  { id: 'hard', label: '深' },
]
const MODEL_OPTS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: 'Flash' },
  { id: 'gemini-2.5-pro', label: 'Pro' },
]

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}
function daysLeft(dateStr: string): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

export default function DseDrill() {
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const allTopics = useCollection(topicsCol)
  const topics = useMemo(() => [...allTopics].sort((a, b) => a.order - b.order), [allTopics])
  const records = useCollection(dseCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? '')
  const [paper, setPaper] = useState<DsePaper>('mc')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(5)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<DseRecord | null>(null)
  const [dseDate, setDseDateState] = useState<string>(() => getDseDate())

  const dleft = daysLeft(dseDate)

  async function run() {
    const topic = topics.find((t) => t.id === topicId) ?? topics[0]
    if (!topic) {
      toast.info('未有課題 — 可去設定揀任教科目')
      return
    }
    setBusy(true)
    try {
      const raw = await complete({
        system: buildDseSystem(subjectName, paper, difficulty, count),
        messages: [{ role: 'user', content: `課題：${topic.topic}` }],
        model,
        temperature: 0.5,
        source: 'dse-drill',
      })
      const questions = parseDse(raw)
      const rec = dseCol.add({
        createdAt: new Date().toISOString(),
        topicName: topic.topic,
        paper,
        model,
        questions,
      })
      setCurrent(rec)
      toast.success(`已生成 ${questions.length} 題`)
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢套操練？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    dseCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="DSE 操練未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <GraduationCap size={13} className="shrink-0" />
          公開試 · DSE
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          DSE 操練
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          按課題出 DSE 公開試風格題目，連評分要點同達標提示；設定 DSE 日期睇倒數。
        </p>
      </header>

      {/* DSE 倒數 */}
      <Card padded className="flex flex-wrap items-center gap-3">
        <CalendarClock size={18} className="shrink-0 text-accent" />
        {dleft != null && dleft >= 0 ? (
          <span className="text-sm text-slate-700 dark:text-slate-200">
            距離 DSE 還有 <span className="text-lg font-bold tabular-nums text-accent-strong dark:text-accent">{dleft}</span> 日
          </span>
        ) : dleft != null ? (
          <span className="text-sm text-slate-500">DSE 已過（{dseDate}）</span>
        ) : (
          <span className="text-sm text-slate-400">設定 DSE 日期睇倒數</span>
        )}
        <Input
          type="date"
          value={dseDate}
          onChange={(e) => {
            setDseDateState(e.target.value)
            setDseDate(e.target.value)
          }}
          className="ml-auto max-w-[10rem]"
        />
      </Card>

      {/* 出題設定 */}
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
          <Field label="卷別 / 題型">
            <SegmentedControl options={DSE_PAPERS} value={paper} onChange={setPaper} />
          </Field>
          <Field label="難度">
            <SegmentedControl options={DIFF_OPTS} value={difficulty} onChange={setDifficulty} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="數量">
              <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                {[3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} 題
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="模型">
              <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end">
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={topics.length === 0}>
            {busy ? '出題中…' : '出 DSE 題'}
          </Button>
        </div>
      </Card>

      {current && <DseView rec={current} />}

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
                  <Badge tone="accent">{DSE_PAPERS.find((p) => p.id === r.paper)?.label ?? r.paper}</Badge>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {r.topicName}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {fmtDate(r.createdAt)} · {r.questions.length} 題
                  </span>
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
        <EmptyState icon={GraduationCap} title="未有操練" hint="揀課題，出第一套 DSE 風格題目。" />
      )}
    </div>
  )
}

function dseToDoc(rec: DseRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  rec.questions.forEach((q, i) => {
    blocks.push({ kind: 'heading', text: `第 ${i + 1} 題（${q.marks} 分）`, level: 2 })
    blocks.push({ kind: 'paragraph', text: q.stem })
    if (q.options && q.options.length) {
      blocks.push({
        kind: 'bullets',
        items: q.options.map(
          (o, oi) => `${String.fromCharCode(65 + oi)}. ${o}${oi === q.answerIndex ? '（答案）' : ''}`,
        ),
      })
    }
    if (q.markingPoints.length) {
      blocks.push({ kind: 'paragraph', text: '評分要點：' })
      blocks.push({ kind: 'bullets', items: q.markingPoints })
    }
    if (q.levelHint) blocks.push({ kind: 'paragraph', text: `達標提示：${q.levelHint}` })
  })
  return { title: `DSE 操練：${rec.topicName}`, blocks }
}

function DseView({ rec }: { rec: DseRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(dseToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={GraduationCap}>
          {rec.questions.length} 題
        </Badge>
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          {rec.topicName}
        </h2>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
      </div>
      <div className="space-y-3">
        {rec.questions.map((q, i) => (
          <div
            key={i}
            className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
              <p className="min-w-0 flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{q.stem}</p>
              <Badge tone="slate">{q.marks} 分</Badge>
            </div>
            {q.options && q.options.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-6">
                {q.options.map((o, oi) => (
                  <li
                    key={oi}
                    className={cx(
                      'text-xs',
                      oi === q.answerIndex
                        ? 'font-medium text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {String.fromCharCode(65 + oi)}. {o}
                    {oi === q.answerIndex && ' ✓'}
                  </li>
                ))}
              </ul>
            )}
            {q.markingPoints.length > 0 && (
              <div className="mt-2 pl-6">
                <p className="text-[11px] font-semibold text-slate-400">評分要點</p>
                <ul className="mt-0.5 space-y-0.5">
                  {q.markingPoints.map((p, pi) => (
                    <li key={pi} className="flex gap-1.5 text-[13px] text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {q.levelHint && (
              <p className="mt-1.5 flex items-start gap-1.5 pl-6 text-[11px] text-accent-strong dark:text-accent">
                <Target size={12} className="mt-0.5 shrink-0" />
                達標：{q.levelHint}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
