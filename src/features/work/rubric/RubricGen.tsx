import { useMemo, useState } from 'react'
import { Scale, Sparkles, FileText, Copy, Trash2, Clock } from 'lucide-react'
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
import { useCollection } from '../../../lib/store'
import { complete, isAIConfigured, type AIModel } from '../../../lib/aiClient'
import { getSubjectPack } from '../../../data/subjects'
import { downloadDocx, type ExportBlock, type ExportDoc } from '../../../lib/export'
import { rubricCol, type RubricRecord } from './rubricStore'
import {
  buildSchemeSystem,
  parseScheme,
  buildRubricSystem,
  parseRubric,
  type RubricMode,
} from './rubricPrompts'

const MODE_OPTS: { id: RubricMode; label: string }[] = [
  { id: 'scheme', label: '評分指引' },
  { id: 'rubric', label: '評分量表' },
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

export default function RubricGen() {
  const toast = useToast()
  const confirm = useConfirm()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const records = useCollection(rubricCol)
  const history = useMemo(
    () => [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [records],
  )

  const [mode, setMode] = useState<RubricMode>('scheme')
  const [question, setQuestion] = useState('')
  const [totalMarks, setTotalMarks] = useState(10)
  const [levelCount, setLevelCount] = useState(4)
  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [busy, setBusy] = useState(false)
  const [current, setCurrent] = useState<RubricRecord | null>(null)

  async function run() {
    if (busy || !question.trim()) return
    setBusy(true)
    try {
      const q = question.trim()
      let rec: RubricRecord
      if (mode === 'scheme') {
        const raw = await complete({
          system: buildSchemeSystem(subjectName, totalMarks),
          messages: [{ role: 'user', content: q }],
          model,
          temperature: 0.3,
        })
        rec = rubricCol.add({
          createdAt: new Date().toISOString(),
          mode,
          question: q.slice(0, 60),
          model,
          scheme: parseScheme(raw),
        })
      } else {
        const raw = await complete({
          system: buildRubricSystem(subjectName, levelCount),
          messages: [{ role: 'user', content: q }],
          model,
          temperature: 0.3,
        })
        rec = rubricCol.add({
          createdAt: new Date().toISOString(),
          mode,
          question: q.slice(0, 60),
          model,
          rubric: parseRubric(raw),
        })
      }
      setCurrent(rec)
      toast.success('已生成')
    } catch (e) {
      toast.error((e as Error).message || '生成失敗，請再試。')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: '刪除呢個準則？', tone: 'danger', confirmText: '刪除' })
    if (!ok) return
    rubricCol.remove(id)
    if (current?.id === id) setCurrent(null)
  }

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Scale}
        title="評分準則未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Scale size={13} className="shrink-0" />
          教學備課 · Rubric
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          評分準則
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          貼上題目或任務，AI 一鍵擬「評分指引」（參考答案＋評分點）或「評分量表」（準則×等級）。
        </p>
      </header>

      <Card padded className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl options={MODE_OPTS} value={mode} onChange={setMode} />
          <Tooltip label="Flash 快 · Pro 強">
            <SegmentedControl size="sm" options={MODEL_OPTS} value={model} onChange={setModel} />
          </Tooltip>
        </div>
        <Field label="題目 / 任務">
          <Textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="貼上題目、寫作任務或專題要求…"
          />
        </Field>
        <div className="flex flex-wrap items-end justify-between gap-3">
          {mode === 'scheme' ? (
            <Field label="總分">
              <Select value={String(totalMarks)} onChange={(e) => setTotalMarks(Number(e.target.value))}>
                {[5, 8, 10, 15, 20, 25].map((n) => (
                  <option key={n} value={n}>
                    {n} 分
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="等級數">
              <Select value={String(levelCount)} onChange={(e) => setLevelCount(Number(e.target.value))}>
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} 級
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button icon={Sparkles} onClick={run} loading={busy} disabled={!question.trim()}>
            {busy ? '生成緊…' : '生成'}
          </Button>
        </div>
      </Card>

      {current && <ResultCard rec={current} />}

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
                  <Badge tone={r.mode === 'rubric' ? 'blue' : 'accent'}>
                    {r.mode === 'rubric' ? '量表' : '指引'}
                  </Badge>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {r.question}
                  </p>
                  <span className="shrink-0 text-[11px] text-slate-400">{fmtDate(r.createdAt)}</span>
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
        <EmptyState icon={Scale} title="未有評分準則" hint="貼上第一條題目，試吓 AI 出評分指引。" />
      )}
    </div>
  )
}

function recToDoc(rec: RubricRecord): ExportDoc {
  const blocks: ExportBlock[] = []
  if (rec.mode === 'scheme' && rec.scheme) {
    if (rec.scheme.modelAnswer) {
      blocks.push({ kind: 'heading', text: '參考答案', level: 1 })
      blocks.push({ kind: 'paragraph', text: rec.scheme.modelAnswer })
    }
    blocks.push({ kind: 'heading', text: `評分點（共 ${rec.scheme.total} 分）`, level: 1 })
    blocks.push({
      kind: 'bullets',
      items: rec.scheme.points.map((p) => `${p.text}（${p.marks} 分）`),
    })
  } else if (rec.mode === 'rubric' && rec.rubric) {
    for (const c of rec.rubric.criteria) {
      blocks.push({ kind: 'heading', text: c.name, level: 2 })
      blocks.push({
        kind: 'bullets',
        items: c.levels.map((l) => `${l.label}（${l.marks} 分）：${l.descriptor}`),
      })
    }
  }
  return { title: `評分準則：${rec.question}`, blocks }
}

function ResultCard({ rec }: { rec: RubricRecord }) {
  const toast = useToast()
  const dlWord = async () => {
    try {
      await downloadDocx(recToDoc(rec))
      toast.success('已下載 Word')
    } catch (e) {
      toast.error((e as Error).message || '下載失敗')
    }
  }
  const copyAll = () => {
    const doc = recToDoc(rec)
    const text = doc.blocks
      .map((b) =>
        b.kind === 'heading' ? `【${b.text}】` : b.kind === 'paragraph' ? b.text : b.kind === 'bullets' ? b.items.map((i) => `• ${i}`).join('\n') : '',
      )
      .join('\n')
    void navigator.clipboard?.writeText(text)
    toast.success('已複製')
  }

  return (
    <Card padded className="space-y-4 ring-1 ring-accent/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" icon={Scale}>
          {rec.mode === 'rubric' ? '評分量表' : '評分指引'}
        </Badge>
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-slate-600 dark:text-slate-300">
          {rec.question}
        </h2>
        <Button variant="secondary" size="sm" icon={Copy} onClick={copyAll}>
          複製
        </Button>
        <Button variant="secondary" size="sm" icon={FileText} onClick={dlWord}>
          Word
        </Button>
      </div>

      {rec.mode === 'scheme' && rec.scheme && (
        <div className="space-y-3">
          {rec.scheme.modelAnswer && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">參考答案</p>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {rec.scheme.modelAnswer}
              </p>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              評分點（共 {rec.scheme.total} 分）
            </p>
            <div className="space-y-1.5">
              {rec.scheme.points.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <Badge tone="slate">{p.marks}</Badge>
                  <span className="flex-1">{p.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {rec.mode === 'rubric' && rec.rubric && (
        <div className="space-y-3">
          {rec.rubric.criteria.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40"
            >
              <p className="mb-2 text-sm font-semibold text-accent-strong dark:text-accent">{c.name}</p>
              <div className="space-y-1.5">
                {c.levels.map((l, li) => (
                  <div key={li} className="flex items-start gap-2 text-[13px]">
                    <Badge tone="accent">{l.label}</Badge>
                    <span className="shrink-0 tabular-nums text-slate-400">{l.marks}分</span>
                    <span className="flex-1 text-slate-700 dark:text-slate-200">{l.descriptor}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
